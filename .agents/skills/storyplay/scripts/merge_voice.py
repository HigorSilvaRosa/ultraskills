"""
Storyplay — manual single-video narration merger (escape hatch for granular control).

Generates the narration with the shared narration engine (real sentence windows,
same voice/rate defaults as the full pipeline), merges it into one recorded video
and writes the subtitle sidecars.

Usage:
  python .agents/skills/storyplay/scripts/merge_voice.py \
    --text-file e2e/evidence/blog/narracao.txt \
    --video .videos/blog/recording.webm

  # reuse an existing audio file without re-synthesizing:
  python .agents/skills/storyplay/scripts/merge_voice.py --skip-audio \
    --audio .videos/blog/narracao.mp3 --video .videos/blog/recording.webm

Output defaults to .ultraskills/storyplay/<yyyy-mm-dd_hh-mm>_<slug>/final.mp4
(+ final.srt / final.vtt). Requires: edge-tts, moviepy, ffmpeg.
"""
from __future__ import annotations

import argparse
import shutil
import sys
import warnings
from datetime import datetime
from pathlib import Path

warnings.filterwarnings("ignore", category=UserWarning, module=r"moviepy(\..*)?")
warnings.filterwarnings("ignore", message=r".*Using the last valid frame instead.*")

sys.path.insert(0, str(Path(__file__).resolve().parent))

from narration import (  # noqa: E402
    DEFAULT_RATE, DEFAULT_VOICE, probe_duration_ms, synth, write_srt, write_vtt,
)

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

DEFAULT_OUT_ROOT = ".ultraskills/storyplay"


def find_latest_video(video_dir: Path, pattern: str = "") -> Path | None:
    if not video_dir.exists():
        return None
    candidates = [p for p in video_dir.iterdir()
                  if p.suffix.lower() in (".webm", ".mp4") and (pattern in p.name if pattern else True)]
    if not candidates:
        return None
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0]


def merge(video_path: Path, audio_path: Path, out_path: Path) -> float:
    from moviepy import AudioFileClip, VideoFileClip
    from moviepy.video.fx import Freeze

    source = VideoFileClip(str(video_path))
    clip = source
    try:
        audio = AudioFileClip(str(audio_path))
        freeze = 0.0
        if audio.duration > clip.duration:
            freeze = audio.duration - clip.duration
            print(f"áudio {freeze:.2f}s mais longo — congelando o último frame")
            clip = clip.with_effects([Freeze(t="end", total_duration=audio.duration)])
        final = clip.with_audio(audio)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        final.write_videofile(str(out_path), codec="libx264", audio_codec="aac",
                              fps=clip.fps or 30, logger=None)
        duration = final.duration
        for obj in (final, clip, audio):
            try:
                obj.close()
            except Exception:
                pass
        return duration
    finally:
        try:
            source.close()
        except Exception:
            pass


def run_dir_for(out_root: Path, slug: str) -> Path:
    stamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
    run_dir = out_root / f"{stamp}_{slug}"
    n = 2
    while run_dir.exists():
        run_dir = out_root / f"{stamp}_{slug}-{n}"
        n += 1
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_dir


def main() -> int:
    ap = argparse.ArgumentParser(description="Narrate a single recorded video (storyplay escape hatch)")
    ap.add_argument("--text-file", type=Path)
    ap.add_argument("--text", type=str)
    ap.add_argument("--voice", default=DEFAULT_VOICE)
    ap.add_argument("--rate", default=DEFAULT_RATE)
    ap.add_argument("--skip-audio", action="store_true", help="não sintetiza, usa --audio existente")
    ap.add_argument("--audio", type=Path, default=None)
    ap.add_argument("--video", type=Path, default=None)
    ap.add_argument("--video-dir", type=Path, default=Path(".videos"))
    ap.add_argument("--video-pattern", type=str, default="")
    ap.add_argument("--out-root", type=Path, default=Path(DEFAULT_OUT_ROOT))
    ap.add_argument("--out-dir", type=Path, default=None, help="diretório do run (default: out-root/<stamp>_<slug>)")
    ap.add_argument("--slug", type=str, default="manual")
    args = ap.parse_args()

    text = args.text
    if not text and args.text_file:
        text = args.text_file.read_text(encoding="utf-8")
    if not text and not args.skip_audio:
        print("informe --text/--text-file ou use --skip-audio", file=sys.stderr)
        return 2

    run_dir = args.out_dir.resolve() if args.out_dir else run_dir_for(args.out_root.resolve(), args.slug)
    out_mp4 = run_dir / "final.mp4"
    out_srt = run_dir / "final.srt"
    out_vtt = run_dir / "final.vtt"
    cues: list[tuple[int, int, str]] = []

    audio_path = args.audio or (run_dir / "narration.mp3")
    if args.skip_audio:
        if not audio_path.exists():
            print(f"áudio não encontrado: {audio_path}", file=sys.stderr)
            return 2
    else:
        audio_ms, cues = synth(text, args.voice, out_mp3=audio_path, out_srt=out_srt, rate=args.rate)
        write_vtt(cues, out_vtt, 0)
        print(f"narração {audio_ms / 1000:.2f}s, {len(cues)} cues")

    video_path = args.video or find_latest_video(args.video_dir, args.video_pattern)
    if not video_path or not video_path.exists():
        print(f"vídeo não encontrado (--video ou --video-dir {args.video_dir})", file=sys.stderr)
        return 2

    merge(video_path, audio_path, out_mp4)
    duration = probe_duration_ms(out_mp4) / 1000
    print(f"OK  {out_mp4}  {duration:.1f}s")
    if out_srt.exists():
        print(f"legendas: {out_srt.name}, {out_vtt.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
