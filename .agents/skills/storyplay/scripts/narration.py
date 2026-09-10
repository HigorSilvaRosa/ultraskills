"""
Narration + subtitle engine for Storyplay (edge-tts).

Single source of truth for TTS audio and subtitle cues. Used by
storyboard_video.py, merge_voice.py and (via CLI) by storyplay-rrweb.

Timing strategy (empirically validated against edge-tts 7.2.8):
  * The engine emits `SentenceBoundary` events with REAL sentence windows.
  * `WordBoundary` is NOT emitted by 7.2.8 (verified) — so we build readable
    1-2 line cues *inside* each real sentence window, distributing the window
    duration proportionally to clause length. This keeps cue boundaries locked
    to real speech events instead of a global proportional guess.
  * The old "offsets are inflated ~5x" workaround is therefore obsolete; a
    pure-proportional fallback is kept only for engines without boundaries.

CLI (used by storyplay-rrweb, which is Node-side):
  python narration.py --text-file n.txt --voice pt-BR-FranciscaNeural \
    --out-mp3 n.mp3 --out-srt n.srt --json
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

SRT_LINE_MAX = 42          # chars per subtitle line (film style)
SRT_MAX_LINES = 2          # max lines per cue
MIN_CUE_MS = 420           # cues shorter than this are merged with a neighbour
MAX_CUE_MS = 7000          # never hold a single cue longer than this
DEFAULT_VOICE = "pt-BR-FranciscaNeural"
DEFAULT_RATE = "-4%"       # slightly slower than default: calmer narration
DEFAULT_VOLUME = "+0%"

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


# ---------------------------------------------------------------------------
# binaries
# ---------------------------------------------------------------------------

def find_bin(name: str) -> str:
    """Locate ffmpeg/ffprobe, including the WinGet package layout on Windows."""
    p = shutil.which(name)
    if p:
        return p
    la = os.environ.get("LOCALAPPDATA", "")
    if la:
        hits = sorted(Path(la).glob(f"Microsoft/WinGet/Packages/Gyan.FFmpeg*/**/bin/{name}.exe"))
        if hits:
            return str(hits[0])
    return name


def probe_duration_ms(path: Path | str) -> int:
    """Authoritative media duration in ms via ffprobe (0 when unavailable)."""
    ff = find_bin("ffprobe")
    try:
        out = subprocess.run(
            [ff, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, timeout=30,
        ).stdout.strip()
        return int(round(float(out) * 1000)) if out else 0
    except Exception:
        return 0


# ---------------------------------------------------------------------------
# cue construction
# ---------------------------------------------------------------------------

def wrap_line(text: str, width: int = SRT_LINE_MAX) -> list[str]:
    words = text.split(" ")
    lines: list[str] = []
    cur = ""
    for w in words:
        if not cur:
            cur = w
        elif len(cur) + 1 + len(w) <= width:
            cur = f"{cur} {w}"
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def split_clauses(text: str, max_chars: int) -> list[str]:
    """Split a sentence at commas/semicolons/dashes, then at spaces."""
    text = text.strip()
    if len(text) <= max_chars:
        return [text] if text else []
    parts = re.split(r"(?<=[,;:])\s+|\s+[—–]\s+", text)
    out: list[str] = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        while len(part) > max_chars:
            cut = part.rfind(" ", 0, max_chars + 1)
            if cut <= 0:
                cut = max_chars
            out.append(part[:cut].strip())
            part = part[cut:].strip()
        if part:
            out.append(part)
    return out


def _cues_for_window(text: str, start_ms: int, end_ms: int, max_chars: int) -> list[tuple[int, int, str]]:
    clauses = split_clauses(text, max_chars)
    if not clauses:
        return []
    lens = [len(c) for c in clauses]
    total = sum(lens) or 1
    span = max(end_ms - start_ms, 300)
    acc = 0
    t0 = start_ms
    out: list[tuple[int, int, str]] = []
    for clause, ln in zip(clauses, lens):
        acc += ln
        t1 = start_ms + round(span * acc / total)
        out.append((t0, max(t1, t0 + 1), clause))
        t0 = t1
    return out


def _merge_short_cues(cues: list[tuple[int, int, str]], min_ms: int, max_chars: int, max_ms: int):
    """Merge flickering short cues with a neighbour (keeps readable rhythm)."""
    out: list[tuple[int, int, str]] = []
    for cue in cues:
        if out:
            prev = out[-1]
            too_short = (cue[1] - cue[0] < min_ms) or (prev[1] - prev[0] < min_ms)
            joined = f"{prev[2]} {cue[2]}"
            if too_short and len(joined) <= max_chars and (cue[1] - prev[0]) <= max_ms:
                out[-1] = (prev[0], max(prev[1], cue[1]), joined)
                continue
        out.append(cue)
    return out


def _fix_overlaps(cues: list[tuple[int, int, str]], total_ms: int):
    """edge-tts sentence windows can overlap by ~50ms — SRT must not."""
    cues = sorted(cues, key=lambda c: (c[0], c[1]))
    fixed: list[tuple[int, int, str]] = []
    for i, (s, e, t) in enumerate(cues):
        if i + 1 < len(cues):
            nxt = cues[i + 1][0]
            if e > nxt:
                e = nxt - 20 if nxt - s >= 250 else nxt
        if total_ms and e > total_ms:
            e = total_ms
        if e - s < 120:  # too small to read: extend into free space if possible
            e = min(s + 120, total_ms or s + 120)
        fixed.append((max(s, 0), e, t))
    return fixed


def build_cues(text: str, windows: list[tuple[int, int, str]], total_ms: int):
    """Build 1-2 line cues inside real sentence windows; proportional fallback."""
    max_chars = SRT_LINE_MAX * SRT_MAX_LINES
    cues: list[tuple[int, int, str]] = []

    for start, end, wtext in windows or []:
        wtext = (wtext or "").strip()
        if wtext:
            cues.extend(_cues_for_window(wtext, int(start), int(end), max_chars))

    if not cues:
        # Fallback: no boundary information — distribute over the real audio duration.
        sentences = [s.strip() for s in re.split(r"(?<=[.!?…])\s+", text.strip()) if s.strip()]
        chunks: list[str] = []
        for s in sentences:
            chunks.extend(split_clauses(s, max_chars))
        if chunks and total_ms:
            lens = [len(c) for c in chunks]
            tot = sum(lens) or 1
            acc = 0
            t0 = 0
            for c, ln in zip(chunks, lens):
                acc += ln
                t1 = round(total_ms * acc / tot)
                cues.append((t0, max(t1, t0 + 1), c))
                t0 = t1

    cues = _merge_short_cues(cues, MIN_CUE_MS, max_chars, MAX_CUE_MS)
    return _fix_overlaps(cues, total_ms)


# ---------------------------------------------------------------------------
# writers
# ---------------------------------------------------------------------------

def fmt_ts(ms: int, sep: str = ",") -> str:
    ms = int(ms)
    h, rem = divmod(ms, 3600000)
    m, rem = divmod(rem, 60000)
    s, milli = divmod(rem, 1000)
    return f"{h:02}:{m:02}:{s:02}{sep}{milli:03}"


def write_srt(cues, path: Path, offset_ms: int = 0) -> None:
    blocks = []
    for i, (s, e, t) in enumerate(cues, 1):
        blocks.append(f"{i}\n{fmt_ts(s + offset_ms)} --> {fmt_ts(e + offset_ms)}\n{t}\n")
    Path(path).write_text("\n".join(blocks), encoding="utf-8")


def write_vtt(cues, path: Path, offset_ms: int = 0) -> None:
    """Valid WebVTT (dot milliseconds) — edge-tts CLI emits commas, we normalize."""
    blocks = ["WEBVTT\n"]
    for s, e, t in cues:
        blocks.append(f"{fmt_ts(s + offset_ms, '.')} --> {fmt_ts(e + offset_ms, '.')}\n{t}\n")
    Path(path).write_text("\n".join(blocks), encoding="utf-8")


# ---------------------------------------------------------------------------
# TTS
# ---------------------------------------------------------------------------

async def _synth_stream(text: str, voice: str, rate: str, volume: str, attempts: int):
    import edge_tts

    last_err: Exception | None = None
    for attempt in range(1, attempts + 1):
        parts: list[bytes] = []
        windows: list[tuple[int, int, str]] = []
        try:
            comm = edge_tts.Communicate(text, voice, rate=rate, volume=volume)
            async for ev in comm.stream():
                etype = ev.get("type") if isinstance(ev, dict) else (ev[0] if isinstance(ev, tuple) else None)
                if etype == "audio":
                    data = ev.get("data") if isinstance(ev, dict) else ev[1]
                    parts.append(data if isinstance(data, (bytes, bytearray)) else bytes(data))
                elif etype == "SentenceBoundary":
                    off = int(ev.get("offset", 0)) / 10000.0
                    dur = int(ev.get("duration", 0)) / 10000.0
                    windows.append((round(off), round(off + dur), ev.get("text", "")))
            if parts:
                return b"".join(parts), windows
            last_err = RuntimeError("edge-tts retornou áudio vazio")
        except Exception as exc:  # noqa: BLE001 - network/403 flakiness is expected
            last_err = exc
        if attempt < attempts:
            await asyncio.sleep(1.2 * attempt)
    raise RuntimeError(f"edge-tts falhou após {attempts} tentativa(s): {last_err}")


def synth(text: str, voice: str = DEFAULT_VOICE, out_mp3: Path | str | None = None,
          out_srt: Path | str | None = None, rate: str = DEFAULT_RATE,
          volume: str = DEFAULT_VOLUME, attempts: int = 3):
    """Synthesize narration. Returns (duration_ms, cues)."""
    text = (text or "").strip()
    if not text:
        raise ValueError("narração vazia: nada para sintetizar")
    audio, windows = asyncio.run(_synth_stream(text, voice, rate, volume, attempts))

    duration_ms = 0
    if out_mp3:
        out_mp3 = Path(out_mp3)
        out_mp3.parent.mkdir(parents=True, exist_ok=True)
        out_mp3.write_bytes(audio)
        duration_ms = probe_duration_ms(out_mp3)
    if not duration_ms:
        # 24 kHz mono @ 48 kbps ≈ 6000 bytes/s (edge-tts default output)
        duration_ms = max(400, round(len(audio) / 6000.0 * 1000))

    cues = build_cues(text, windows, duration_ms)
    if out_srt:
        out_srt = Path(out_srt)
        out_srt.parent.mkdir(parents=True, exist_ok=True)
        write_srt(cues, out_srt, 0)
    return duration_ms, cues


def synth_to_file(text: str, voice: str, out_mp3: Path | str, rate: str = DEFAULT_RATE,
                  volume: str = DEFAULT_VOLUME, attempts: int = 3) -> int:
    dur, _ = synth(text, voice, out_mp3=out_mp3, out_srt=None, rate=rate, volume=volume, attempts=attempts)
    return dur


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description="Storyplay narration + subtitle cues (edge-tts)")
    ap.add_argument("--text")
    ap.add_argument("--text-file", type=Path)
    ap.add_argument("--voice", default=DEFAULT_VOICE)
    ap.add_argument("--rate", default=DEFAULT_RATE)
    ap.add_argument("--volume", default=DEFAULT_VOLUME)
    ap.add_argument("--out-mp3", type=Path, required=True)
    ap.add_argument("--out-srt", type=Path)
    ap.add_argument("--json", action="store_true", help="print a single JSON line with the result")
    args = ap.parse_args()

    text = args.text
    if not text and args.text_file:
        text = args.text_file.read_text(encoding="utf-8")
    if not text:
        print(json.dumps({"ok": False, "error": "no --text or --text-file"}))
        sys.exit(2)

    dur, cues = synth(text, args.voice, out_mp3=args.out_mp3, out_srt=args.out_srt,
                      rate=args.rate, volume=args.volume)
    if args.json:
        print(json.dumps({
            "ok": True,
            "mp3": str(args.out_mp3),
            "srt": str(args.out_srt) if args.out_srt else None,
            "duration_ms": dur,
            "cues": [[s, e, t] for s, e, t in cues],
        }, ensure_ascii=False))
    else:
        print(f"audio {dur / 1000:.2f}s, {len(cues)} cues -> {args.out_mp3}")


if __name__ == "__main__":
    main()
