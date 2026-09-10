"""
Storyplay — storyboard-driven video evidence with narration and soft subtitles.

One command per run (token economy):
  python .agents/skills/storyplay/scripts/storyboard_video.py --execution blog_navigation

Pipeline per scene:
  edge-tts narration (real sentence windows) -> Playwright test (--grep @sceneNN)
  -> prep trim (SceneTimer) -> video+audio merge -> concat -> soft subtitles mux.

Output (default):
  <project>/.ultraskills/storyplay/<yyyy-mm-dd_hh-mm>_<slug>/
    final.mp4   final.srt   final.vtt   run.json   storyboard.json   run.log

Requires: edge-tts + moviepy (python), ffmpeg/ffprobe, Playwright (+chromium).
Missing deps are NEVER installed automatically: run --check-deps, ask the user,
then run --install-deps.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import time
import warnings
from datetime import datetime
from pathlib import Path

# Keep stdout/stderr clean (token economy): moviepy reader warnings are noise.
warnings.filterwarnings("ignore", category=UserWarning, module=r"moviepy(\..*)?")
warnings.filterwarnings("ignore", message=r".*Using the last valid frame instead.*")

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

SKILL_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = SKILL_DIR / "templates"
DEFAULT_OUT_ROOT = ".ultraskills/storyplay"
DEFAULT_EVIDENCE_DIR = "e2e/evidence"
SKILL_VERSION = "2.0.0"


# ---------------------------------------------------------------------------
# logging (compact stdout, full run.log)
# ---------------------------------------------------------------------------

class Logger:
    def __init__(self, quiet: bool):
        self.quiet = quiet
        self.lines: list[str] = []

    def log(self, message: str, *, echo: bool = False) -> None:
        self.lines.append(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        if echo or not self.quiet:
            print(message, flush=True)

    def warn(self, message: str) -> None:
        self.log(f"AVISO: {message}", echo=True)

    def error(self, message: str) -> None:
        self.log(f"ERRO: {message}", echo=True)

    def flush_to(self, path: Path) -> None:
        try:
            path.write_text("\n".join(self.lines) + "\n", encoding="utf-8")
        except Exception:
            pass


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", (value or "").strip().lower()).strip("-")
    return value[:60] or "video"


def make_run_dir(project_root: Path, out_root: str, slug: str) -> Path:
    stamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
    base = project_root / out_root
    run_dir = base / f"{stamp}_{slug}"
    n = 2
    while run_dir.exists():
        run_dir = base / f"{stamp}_{slug}-{n}"
        n += 1
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_dir


# ---------------------------------------------------------------------------
# dependencies (detect, never auto-install without user confirmation)
# ---------------------------------------------------------------------------

def _which_or_none(name: str) -> str | None:
    from narration import find_bin

    found = find_bin(name)
    if shutil.which(found) or Path(found).exists():
        return found
    return None


def _playwright_cli(project_root: Path) -> tuple[bool, str]:
    """Check the *target project's* Playwright (cwd matters for npx resolution)."""
    npx = "npx.cmd" if platform.system() == "Windows" else "npx"
    if not shutil.which(npx):
        return False, "npx não encontrado no PATH"
    try:
        out = subprocess.run([npx, "playwright", "--version"], capture_output=True, text=True,
                             timeout=180, cwd=str(project_root))
        return (out.returncode == 0, (out.stdout or out.stderr).strip()[:80])
    except Exception as exc:  # noqa: BLE001
        return False, f"falha ao executar npx playwright: {exc}"


def _chromium_present() -> tuple[bool, str]:
    roots: list[Path] = []
    if platform.system() == "Windows":
        local_appdata = os.environ.get("LOCALAPPDATA")
        if local_appdata:
            roots.append(Path(local_appdata) / "ms-playwright")
    else:
        roots.append(Path.home() / ".cache" / "ms-playwright")
    for root in roots:
        if root.exists() and any(root.glob("chromium*/**/chrome*")):
            return True, str(root)
    return False, "cache do Playwright sem chromium"


def install_commands() -> dict:
    system = platform.system()
    if system == "Windows":
        ffmpeg_cmd = ["winget", "install", "Gyan.FFmpeg", "--silent",
                      "--accept-source-agreements", "--accept-package-agreements"]
    elif system == "Darwin":
        ffmpeg_cmd = ["brew", "install", "ffmpeg"]
    else:
        ffmpeg_cmd = ["sudo", "apt-get", "install", "-y", "ffmpeg"]
    return {
        "ffmpeg": ffmpeg_cmd,
        "edge_tts/moviepy": [sys.executable, "-m", "pip", "install", "--upgrade", "edge-tts", "moviepy"],
        "playwright_cli": ["pnpm", "add", "-D", "@playwright/test"],
        "chromium": ["npx", "playwright", "install", "chromium"],
    }


def dep_report(project_root: Path) -> dict:
    checks: dict[str, dict] = {}

    for binary in ("ffmpeg", "ffprobe"):
        found = _which_or_none(binary)
        checks[binary] = {"ok": bool(found), "detail": found or "não encontrado no PATH"}

    for module in ("edge_tts", "moviepy"):
        spec = importlib.util.find_spec(module)
        checks[module] = {"ok": spec is not None, "detail": "importável" if spec else "módulo ausente"}

    cli_ok, cli_detail = _playwright_cli(project_root)
    checks["playwright_cli"] = {"ok": cli_ok, "detail": cli_detail}

    browser_ok, browser_detail = _chromium_present()
    checks["chromium"] = {"ok": browser_ok, "detail": browser_detail}

    return {
        "ok": all(item["ok"] for item in checks.values()),
        "checks": checks,
        "install": install_commands(),
    }


def print_dep_report(report: dict, as_json: bool) -> None:
    if as_json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return
    missing = [key for key, value in report["checks"].items() if not value["ok"]]
    if not missing:
        print("deps OK: " + ", ".join(report["checks"]))
        return
    print("deps AUSENTES: " + ", ".join(missing))
    for key in missing:
        cmd = report["install"].get(key)
        if cmd:
            print(f"  {key}: {' '.join(cmd)}")


def run_install(report: dict, logger: Logger) -> None:
    missing = [key for key, value in report["checks"].items() if not value["ok"]]
    done: set[str] = set()
    for key in missing:
        cmd = report["install"].get(key)
        if not cmd or key in done:
            continue
        logger.log(f"instalando {key}: {' '.join(cmd)}", echo=True)
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
            for line in (proc.stdout or proc.stderr or "").strip().splitlines()[-4:]:
                logger.log(f"  {line}")
            if proc.returncode != 0:
                logger.error(f"instalação de {key} falhou (exit {proc.returncode})")
        except Exception as exc:  # noqa: BLE001
            logger.error(f"instalação de {key} falhou: {exc}")
        done.add(key)


# ---------------------------------------------------------------------------
# provisioning of helpers (SceneTimer + human helpers imported by the specs)
# ---------------------------------------------------------------------------

def provision_evidence(evidence_dir: Path, force: bool, logger: Logger) -> list[str]:
    created: list[str] = []
    targets = [
        (TEMPLATES_DIR / "helpers" / "timing.ts", evidence_dir / "helpers" / "timing.ts"),
        (TEMPLATES_DIR / "helpers" / "human.ts", evidence_dir / "helpers" / "human.ts"),
        (TEMPLATES_DIR / "playwright.evidence.config.ts", evidence_dir / "playwright.evidence.config.ts"),
    ]
    for src, dst in targets:
        if not src.exists():
            continue
        if dst.exists() and not force:
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        created.append(str(dst))
    if created:
        logger.log("helpers provisionados: " + ", ".join(Path(path).name for path in created))
    return created


# ---------------------------------------------------------------------------
# per-scene work
# ---------------------------------------------------------------------------

def scene_grep_tag(scene_id: str) -> str:
    """`01-home-hero` -> `@scene01` (documented convention); fallback: the id."""
    prefix = scene_id.split("-", 1)[0]
    return f"@scene{prefix}" if prefix.isdigit() else scene_id


def run_playwright_scene(scene: dict, spec_path: Path, project_root: Path,
                         pw_config: str | None, run_dir: Path, timings_dir: Path,
                         base_url: str | None, logger: Logger) -> Path | None:
    npx = "npx.cmd" if platform.system() == "Windows" else "npx"
    scene_id = scene["id"]
    try:
        rel_spec = str(spec_path.relative_to(project_root)).replace("\\", "/")
    except ValueError:
        rel_spec = str(spec_path)

    pw_output = run_dir / "_pw"
    shutil.rmtree(pw_output, ignore_errors=True)

    cmd = [npx, "playwright", "test", rel_spec, "--grep", scene_grep_tag(scene_id),
           "--reporter=list", "--workers=1", f"--output={pw_output}"]
    if pw_config:
        cmd.extend(["--config", pw_config])

    env = os.environ.copy()
    env["STORYPLAY_TIMING_DIR"] = str(timings_dir)
    env["STORYPLAY_SCENE_ID"] = scene_id
    if base_url:
        env["STORYPLAY_BASE_URL"] = base_url

    logger.log(f"playwright: {' '.join(cmd)}")
    proc = subprocess.run(cmd, cwd=str(project_root), env=env, capture_output=True, text=True)
    for line in (proc.stdout or "").strip().splitlines()[-4:]:
        logger.log(f"  {line}")
    if proc.returncode != 0:
        logger.error(f"cena {scene_id}: teste falhou (exit {proc.returncode})")
        for line in (proc.stderr or "").strip().splitlines()[-6:]:
            logger.log(f"  stderr: {line}")
        return None

    candidates = sorted(pw_output.rglob("video.webm"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        logger.error(f"cena {scene_id}: nenhum video.webm em {pw_output}")
        return None
    if len(candidates) > 1:
        matching = [c for c in candidates if scene_id in c.parent.name]
        logger.warn(f"cena {scene_id}: {len(candidates)} vídeos no output, usando {matching[0].parent.name if matching else candidates[0].parent.name}")
        candidates = matching or candidates
    return candidates[0]


def merge_scene(video_path: Path, audio_path: Path, out_path: Path,
                prep_cut_sec: float, logger: Logger) -> tuple[float, float]:
    """Merge narration into the scene clip. Returns (span_sec, freeze_sec)."""
    from moviepy import AudioFileClip, VideoFileClip
    from moviepy.video.fx import Freeze

    source = VideoFileClip(str(video_path))
    clip = source
    try:
        if prep_cut_sec > 0 and prep_cut_sec < source.duration:
            clip = source.subclipped(prep_cut_sec)
            logger.log(f"  prep-trim: -{prep_cut_sec:.2f}s (bruto {source.duration:.2f}s)")
        audio = AudioFileClip(str(audio_path))
        freeze_sec = 0.0
        if audio.duration > clip.duration:
            freeze_sec = audio.duration - clip.duration
            logger.log(f"  freeze no último frame: +{freeze_sec:.2f}s")
            clip = clip.with_effects([Freeze(t="end", total_duration=audio.duration)])
        final = clip.with_audio(audio)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        final.write_videofile(str(out_path), codec="libx264", audio_codec="aac",
                              fps=clip.fps or 30, logger=None)
        span = final.duration
        for obj in (final, clip, audio):
            try:
                obj.close()
            except Exception:
                pass
        return span, freeze_sec
    finally:
        try:
            source.close()
        except Exception:
            pass
        time.sleep(0.3)


def concat_scenes(scene_mp4s: list[Path], final_path: Path, fades: bool, logger: Logger) -> float:
    from moviepy import VideoFileClip, concatenate_videoclips
    from moviepy.video.fx import FadeIn, FadeOut

    clips = [VideoFileClip(str(path)) for path in scene_mp4s]
    if fades and clips:
        clips[0] = clips[0].with_effects([FadeIn(0.3)])
        clips[-1] = clips[-1].with_effects([FadeOut(0.4)])
    final = concatenate_videoclips(clips)
    final_path.parent.mkdir(parents=True, exist_ok=True)
    final.write_videofile(str(final_path), codec="libx264", audio_codec="aac", logger=None)
    duration = final.duration
    final.close()
    for clip in clips:
        try:
            clip.close()
        except Exception:
            pass
    logger.log(f"concat: {len(scene_mp4s)} cenas, {duration:.2f}s -> {final_path.name}")
    return duration


def mux_subtitles(video_in: Path, srt_path: Path, out_path: Path, logger: Logger) -> None:
    from narration import find_bin

    cmd = [
        find_bin("ffmpeg"), "-y",
        "-i", str(video_in),
        "-i", str(srt_path),
        "-map", "0:v:0", "-map", "0:a:0", "-map", "1:0",
        "-c:v", "copy", "-c:a", "copy", "-c:s", "mov_text",
        "-metadata:s:s:0", "language=por",
        "-metadata:s:s:0", "title=Português",
        "-movflags", "+faststart",
        str(out_path),
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    logger.log(f"legenda embutida (mov_text) -> {out_path.name}")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Storyplay: storyboard -> narrated video evidence")
    ap.add_argument("--execution", required=True, help="nome da execução (ex: blog_navigation)")
    ap.add_argument("--project-root", type=Path, default=Path("."))
    ap.add_argument("--out-root", type=str, default=DEFAULT_OUT_ROOT,
                    help=f"raiz de saída relativa ao projeto (default: {DEFAULT_OUT_ROOT})")
    ap.add_argument("--slug", type=str, default="", help="slug do run (default: --execution)")
    ap.add_argument("--run-dir", type=Path, default=None, help="usa um diretório de run específico")
    ap.add_argument("--evidence-dir", type=str, default=DEFAULT_EVIDENCE_DIR)
    ap.add_argument("--storyboard", type=Path, default=None)
    ap.add_argument("--spec", type=Path, default=None)
    ap.add_argument("--playwright-config", type=str, default=None)
    ap.add_argument("--base-url", type=str, default=None, help="STORYPLAY_BASE_URL para os testes")
    ap.add_argument("--voice", default="pt-BR-FranciscaNeural")
    ap.add_argument("--rate", default="-4%", help="velocidade da narração (default: -4%%)")
    ap.add_argument("--volume", default="+0%")
    ap.add_argument("--prep-trim-offset", type=float, default=0.0,
                    help="segundos extras a cortar do início da cena (default: 0)")
    ap.add_argument("--prep-trim-max", type=float, default=15.0,
                    help="limite de segurança do corte de preparação (default: 15s)")
    ap.add_argument("--no-subtitles", action="store_true")
    ap.add_argument("--no-fades", action="store_true", help="desliga fade in/out global")
    ap.add_argument("--keep-intermediates", action="store_true")
    ap.add_argument("--allow-missing", action="store_true",
                    help="não falha quando uma cena não gera vídeo (status=partial)")
    ap.add_argument("--no-provision", action="store_true", help="não copia helpers/config para o projeto")
    ap.add_argument("--force-provision", action="store_true", help="sobrescreve helpers já existentes")
    ap.add_argument("--quiet", action="store_true", default=True)
    ap.add_argument("--verbose", dest="quiet", action="store_false")
    ap.add_argument("--json", action="store_true", help="imprime apenas o run.json ao final")
    ap.add_argument("--check-deps", action="store_true", help="somente reporta dependências")
    ap.add_argument("--install-deps", action="store_true",
                    help="instala dependências ausentes (exige confirmação prévia do usuário)")
    ap.add_argument("--videos-dir", type=str, default=None, help="(legado) alias de --out-root")
    return ap.parse_args()


def main() -> int:
    args = parse_args()
    logger = Logger(quiet=args.quiet)
    project_root = args.project_root.resolve()

    if args.videos_dir:
        args.out_root = args.videos_dir

    report = dep_report(project_root)
    if args.check_deps:
        print_dep_report(report, as_json=args.json)
        return 0 if report["ok"] else 4

    if args.install_deps:
        if report["ok"]:
            print("deps já instaladas, nada a fazer")
            return 0
        run_install(report, logger)
        report = dep_report(project_root)
        print_dep_report(report, as_json=False)
        if not report["ok"]:
            return 4

    if not report["ok"]:
        print_dep_report(report, as_json=False)
        print("\nNada foi instalado. Confirme com o usuário e rode de novo com --install-deps.")
        return 4

    evidence_dir = (project_root / args.evidence_dir).resolve()
    if not args.no_provision:
        provision_evidence(evidence_dir, force=args.force_provision, logger=logger)

    execution = args.execution
    storyboard_path = args.storyboard or (evidence_dir / execution / "storyboard.json")
    if not storyboard_path.exists():
        print(f"storyboard não encontrado: {storyboard_path}", file=sys.stderr)
        return 2
    scenes = json.loads(storyboard_path.read_text(encoding="utf-8"))
    if not isinstance(scenes, list) or not scenes:
        print(f"storyboard inválido (esperado array não vazio): {storyboard_path}", file=sys.stderr)
        return 2
    for scene in scenes:
        for required in ("id", "narration"):
            if not scene.get(required):
                print(f"storyboard: cena sem '{required}': {scene}", file=sys.stderr)
                return 2

    spec = args.spec
    if not spec:
        for candidate in (
            evidence_dir / execution / f"{execution}.spec.ts",
            evidence_dir / execution / "evidence.spec.ts",
            evidence_dir / f"{execution}.spec.ts",
        ):
            if candidate.exists():
                spec = candidate
                break
    if not spec or not spec.exists():
        print(f"spec não encontrado para {execution} em {evidence_dir}", file=sys.stderr)
        return 2

    pw_config = args.playwright_config
    if not pw_config:
        auto = evidence_dir / "playwright.evidence.config.ts"
        pw_config = str(auto.relative_to(project_root)).replace("\\", "/") if auto.exists() else None

    run_dir = args.run_dir.resolve() if args.run_dir else make_run_dir(
        project_root, args.out_root, slugify(args.slug or execution))
    run_dir.mkdir(parents=True, exist_ok=True)
    scenes_dir = run_dir / "scenes"
    timings_dir = run_dir / "timings"
    scenes_dir.mkdir(parents=True, exist_ok=True)
    timings_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(storyboard_path, run_dir / "storyboard.json")

    logger.log(f"run: {run_dir}")
    logger.log(f"storyboard: {storyboard_path} ({len(scenes)} cenas)")
    logger.log(f"spec: {spec}")
    logger.log(f"voice: {args.voice} (rate {args.rate})")

    from narration import probe_duration_ms, synth, write_srt, write_vtt  # noqa: PLC0415

    scene_records: list[dict] = []
    scene_finals: list[Path] = []
    all_cues: list[tuple[int, int, str]] = []
    warnings: list[str] = []
    errors: list[str] = []
    offset_ms = 0
    started = time.time()

    for index, scene in enumerate(scenes, 1):
        sid = scene["id"]
        title = scene.get("title", sid)
        target_sec = float(scene.get("duration_sec") or 0)
        audio_path = scenes_dir / f"{sid}.mp3"
        srt_path = scenes_dir / f"{sid}.srt"

        try:
            audio_ms, cues = synth(scene["narration"], args.voice, out_mp3=audio_path,
                                   out_srt=None if args.no_subtitles else srt_path,
                                   rate=args.rate, volume=args.volume)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{sid}: narração falhou ({exc})")
            logger.error(f"cena {sid}: narração falhou: {exc}")
            continue

        if target_sec and abs(audio_ms / 1000 - target_sec) > 1.5:
            warnings.append(f"{sid}: narração {audio_ms / 1000:.1f}s vs duration_sec {target_sec:.1f}s")

        video_src = run_playwright_scene(scene, spec, project_root, pw_config,
                                        run_dir, timings_dir, args.base_url, logger)
        if not video_src:
            errors.append(f"{sid}: sem vídeo gravado")
            continue

        prep_cut = args.prep_trim_offset
        timing_file = timings_dir / f"{sid}.json"
        if timing_file.exists():
            try:
                data = json.loads(timing_file.read_text(encoding="utf-8"))
                prep_cut += float(data.get("prep_duration_sec") or 0.0)
            except Exception as exc:  # noqa: BLE001
                warnings.append(f"{sid}: timing ilegível ({exc})")
        else:
            warnings.append(f"{sid}: SceneTimer não marcou a cena (flicker de carregamento no vídeo)")
        prep_cut = max(0.0, min(prep_cut, args.prep_trim_max))

        raw_copy = scenes_dir / f"{sid}.webm"
        shutil.copy2(video_src, raw_copy)
        scene_out = scenes_dir / f"{sid}-final.mp4"
        span_sec, freeze_sec = merge_scene(raw_copy, audio_path, scene_out, prep_cut, logger)
        if span_sec > 0 and freeze_sec / span_sec > 0.4:
            warnings.append(
                f"{sid}: {freeze_sec:.1f}s de frame congelado em {span_sec:.1f}s "
                f"({freeze_sec / span_sec * 100:.0f}%) — alongue as ações da cena"
            )

        scene_finals.append(scene_out)
        all_cues.extend((offset_ms + start, offset_ms + end, text) for start, end, text in cues)
        offset_ms += probe_duration_ms(scene_out) or audio_ms
        scene_records.append({
            "id": sid,
            "title": title,
            "narration_sec": round(audio_ms / 1000, 2),
            "video_sec": round(span_sec, 2),
            "freeze_sec": round(freeze_sec, 2),
            "prep_cut_sec": round(prep_cut, 2),
            "cues": len(cues),
        })
        logger.log(
            f"[{index}/{len(scenes)}] {sid}  narração {audio_ms / 1000:.1f}s  "
            f"vídeo {span_sec:.1f}s  prep-cortado {prep_cut:.1f}s  cues {len(cues)}",
            echo=True,
        )

        if not args.keep_intermediates:
            for path in (raw_copy, audio_path, srt_path):
                for _ in range(3):
                    try:
                        if path.exists():
                            path.unlink()
                        break
                    except PermissionError:
                        time.sleep(0.4)

    status = "ok"
    if errors:
        status = "partial" if args.allow_missing and scene_finals else "failed"

    final_path = run_dir / "final.mp4"
    srt_final = run_dir / "final.srt"
    vtt_final = run_dir / "final.vtt"
    duration_sec = 0.0
    subtitles_embedded = False

    if status == "failed":
        logger.error(f"{len(errors)} cena(s) falharam — nenhum vídeo final gerado")
        for err in errors:
            logger.error(err)
    elif args.no_subtitles:
        concat_scenes(scene_finals, final_path, not args.no_fades, logger)
        duration_sec = probe_duration_ms(final_path) / 1000
    else:
        raw_final = run_dir / "final-raw.mp4"
        concat_scenes(scene_finals, raw_final, not args.no_fades, logger)
        write_srt(all_cues, srt_final, 0)
        write_vtt(all_cues, vtt_final, 0)
        mux_subtitles(raw_final, srt_final, final_path, logger)
        raw_final.unlink(missing_ok=True)
        subtitles_embedded = True
        duration_sec = probe_duration_ms(final_path) / 1000

    if not args.keep_intermediates:
        shutil.rmtree(scenes_dir, ignore_errors=True)
        shutil.rmtree(timings_dir, ignore_errors=True)
        shutil.rmtree(run_dir / "_pw", ignore_errors=True)

    manifest = {
        "skill": "storyplay",
        "version": SKILL_VERSION,
        "status": status,
        "execution": execution,
        "slug": slugify(args.slug or execution),
        "run_dir": str(run_dir),
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "elapsed_sec": round(time.time() - started, 1),
        "voice": args.voice,
        "rate": args.rate,
        "duration_sec": round(duration_sec, 2),
        "final_mp4": str(final_path) if final_path.exists() else None,
        "srt": str(srt_final) if srt_final.exists() else None,
        "vtt": str(vtt_final) if vtt_final.exists() else None,
        "subtitles_embedded": subtitles_embedded,
        "scenes": scene_records,
        "warnings": warnings,
        "errors": errors,
    }
    (run_dir / "run.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.flush_to(run_dir / "run.log")

    if args.json:
        print(json.dumps(manifest, ensure_ascii=False))
    else:
        if final_path.exists():
            print(
                f"OK  {final_path}  {duration_sec:.1f}s  legenda: "
                + ("embutida mov_text + final.srt/.vtt" if subtitles_embedded else "desligada")
            )
        for warning in warnings:
            print(f"AVISO: {warning}")
        print(f"manifest: {run_dir / 'run.json'}")

    return 0 if status == "ok" else 3


if __name__ == "__main__":
    sys.exit(main())
