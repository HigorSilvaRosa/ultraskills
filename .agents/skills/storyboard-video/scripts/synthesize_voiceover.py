#!/usr/bin/env python3
"""
Synthesize voiceover audio for storyboard scenes using edge-tts.
Outputs MP3 audio, VTT subtitle file, and calculates exact durationInFrames for Remotion.
"""

import argparse
import json
import os
import re
import subprocess
import sys


def parse_vtt_duration(vtt_path: str) -> float:
    """Parse the last timestamp in a VTT file to obtain the total speech duration in seconds."""
    if not os.path.exists(vtt_path):
        return 0.0

    last_end_seconds = 0.0
    timestamp_pattern = re.compile(
        r'(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})'
    )

    with open(vtt_path, 'r', encoding='utf-8') as f:
        for line in f:
            match = timestamp_pattern.search(line)
            if match:
                h, m, s, ms = map(int, match.groups()[4:])
                end_sec = h * 3600 + m * 60 + s + ms / 1000.0
                if end_sec > last_end_seconds:
                    last_end_seconds = end_sec

    return last_end_seconds


def main():
    parser = argparse.ArgumentParser(description="Synthesize scene voiceover using edge-tts.")
    parser.add_argument("--text", required=True, help="Narration text to synthesize")
    parser.add_argument(
        "--voice",
        default="pt-BR-AntonioNeural",
        help="TTS Voice name (e.g. pt-BR-AntonioNeural, pt-BR-FranciscaNeural, en-US-ChristopherNeural)",
    )
    parser.add_argument(
        "--project-dir",
        default="",
        help="Optional root directory of the Remotion project (public/audio will be created inside it)",
    )
    parser.add_argument(
        "--output-dir",
        default="public/audio",
        help="Directory to save the generated audio and vtt files (relative to project-dir if provided)",
    )
    parser.add_argument(
        "--filename",
        default="scene_voiceover",
        help="Base filename without extension (e.g. scene_01_hook)",
    )
    parser.add_argument("--fps", type=int, default=30, help="Video frame rate (default: 30)")
    parser.add_argument(
        "--padding-frames",
        type=int,
        default=15,
        help="Buffer frames added at the end for pacing/transitions (default: 15)",
    )
    parser.add_argument("--rate", default="+0%", help="Speech rate adjustment, e.g. +5% or -10%")

    args = parser.parse_args()

    effective_output_dir = os.path.join(args.project_dir, args.output_dir) if args.project_dir else args.output_dir
    os.makedirs(effective_output_dir, exist_ok=True)
    mp3_path = os.path.join(effective_output_dir, f"{args.filename}.mp3")
    vtt_path = os.path.join(effective_output_dir, f"{args.filename}.vtt")

    # Command to run edge-tts
    cmd = [
        sys.executable,
        "-m",
        "edge_tts",
        "--text",
        args.text,
        "--voice",
        args.voice,
        f"--rate={args.rate}",
        "--write-media",
        mp3_path,
        "--write-subtitles",
        vtt_path,
    ]

    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as e:
        sys.stderr.write(f"Error running edge-tts: {e.stderr.decode('utf-8', errors='replace')}\n")
        sys.exit(1)

    duration_sec = parse_vtt_duration(vtt_path)
    # If VTT parse failed or was 0, estimate fallback based on file size (~48kbps edge-tts mp3 / 6000 bytes/sec)
    if duration_sec <= 0 and os.path.exists(mp3_path):
        size_bytes = os.path.getsize(mp3_path)
        duration_sec = max(1.0, size_bytes / 6000.0)

    # Calculate exact frames
    speech_frames = int(round(duration_sec * args.fps))
    total_frames = speech_frames + args.padding_frames

    # Relative paths for Remotion staticFile()
    norm_mp3 = os.path.normpath(mp3_path).replace("\\", "/")
    norm_vtt = os.path.normpath(vtt_path).replace("\\", "/")

    if "/public/" in norm_mp3:
        rel_mp3 = norm_mp3.split("/public/")[1]
    elif norm_mp3.startswith("public/"):
        rel_mp3 = norm_mp3[len("public/"):]
    else:
        rel_mp3 = norm_mp3

    if "/public/" in norm_vtt:
        rel_vtt = norm_vtt.split("/public/")[1]
    elif norm_vtt.startswith("public/"):
        rel_vtt = norm_vtt[len("public/"):]
    else:
        rel_vtt = norm_vtt

    result = {
        "success": True,
        "text": args.text,
        "voice": args.voice,
        "audioFile": rel_mp3,
        "subtitlesFile": rel_vtt,
        "fullAudioPath": os.path.abspath(mp3_path),
        "durationSeconds": round(duration_sec, 2),
        "speechFrames": speech_frames,
        "paddingFrames": args.padding_frames,
        "totalDurationInFrames": total_frames,
        "fps": args.fps,
    }

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
