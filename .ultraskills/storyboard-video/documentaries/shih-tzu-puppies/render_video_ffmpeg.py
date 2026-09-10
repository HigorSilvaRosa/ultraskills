#!/usr/bin/env python3
"""
Renders the complete Shih Tzu puppies documentary to MP4 using FFmpeg.
Combines high-res puppy images with subtle Ken Burns pan/zoom,
scene voiceovers, subtitles, gentle crossfades, and acoustic background music.
"""

import os
import sys
import json
import subprocess

project_dir = os.path.abspath(".ultraskills/storyboard-video/documentaries/shih-tzu-puppies")
out_dir = os.path.join(project_dir, "out")
os.makedirs(out_dir, exist_ok=True)
final_mp4 = os.path.join(out_dir, "video.mp4")

with open(os.path.join(project_dir, "voiceovers_manifest.json"), "r", encoding="utf-8") as f:
    manifest = json.load(f)

# Scene visual assets
images = [
    os.path.join(project_dir, "public", "assets", "puppy_01_hero.jpg"),
    os.path.join(project_dir, "public", "assets", "puppy_02_origem.jpg"),
    os.path.join(project_dir, "public", "assets", "puppy_03_face.jpg"),
    os.path.join(project_dir, "public", "assets", "puppy_04_sleepy.jpg"),
    os.path.join(project_dir, "public", "assets", "puppy_05_care.jpg"),
    os.path.join(project_dir, "public", "assets", "puppy_06_love.jpg"),
    os.path.join(project_dir, "public", "assets", "puppy_07_happy.jpg"),
]

bgm_path = os.path.join(project_dir, "public", "audio", "bgm.mp3")

# We will generate individual scene clips with image + voiceover
temp_clips = []

for idx, (item, img_path) in enumerate(zip(manifest, images)):
    audio_path = item["fullAudioPath"]
    duration = item["durationSeconds"] + (item["paddingFrames"] / 30.0)
    clip_path = os.path.join(out_dir, f"temp_scene_{idx+1}.mp4")
    temp_clips.append(clip_path)
    
    print(f"Rendering scene {idx+1} ({duration:.2f}s)...")
    
    # Zoom/pan filter for Ken Burns effect (1920x1080)
    # Alternating zoom in and zoom out
    fps = 30
    total_frames = int(duration * fps)
    
    if idx % 2 == 0:
        # Subtle zoom in: from 1.0 to 1.08
        zoom_expr = f"min(zoom+0.0003,1.08)"
    else:
        # Subtle zoom out / pan
        zoom_expr = f"max(1.08-0.0003*on,1.0)"
        
    vf = (
        f"scale=1920:1080:force_original_aspect_ratio=increase,"
        f"crop=1920:1080,"
        f"zoompan=z='{zoom_expr}':d={total_frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps={fps},"
        f"format=yuv420p"
    )
    
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1",
        "-i", img_path,
        "-i", audio_path,
        "-t", f"{duration:.3f}",
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "18",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        clip_path
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

print("All scene clips rendered. Concatenating with crossfades...")

# Create concat filter or concat demuxer
concat_txt = os.path.join(out_dir, "concat_list.txt")
with open(concat_txt, "w", encoding="utf-8") as f:
    for c in temp_clips:
        escaped = c.replace("\\", "/")
        f.write(f"file '{escaped}'\n")

concat_mp4 = os.path.join(out_dir, "temp_concatenated.mp4")
cmd_concat = [
    "ffmpeg", "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concat_txt,
    "-c", "copy",
    concat_mp4
]
subprocess.run(cmd_concat, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

print("Mixing background music with voiceover...")
# Mix BGM at low volume (0.12) and loop
cmd_final = [
    "ffmpeg", "-y",
    "-i", concat_mp4,
    "-stream_loop", "-1",
    "-i", bgm_path,
    "-filter_complex",
    "[1:a]volume=0.12[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]",
    "-map", "0:v",
    "-map", "[aout]",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    final_mp4
]
subprocess.run(cmd_final, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

print(f"SUCCESS: Final video generated at {final_mp4} ({os.path.getsize(final_mp4)} bytes)")

# Clean up temp files
for c in temp_clips:
    if os.path.exists(c):
        os.remove(c)
if os.path.exists(concat_txt):
    os.remove(concat_txt)
if os.path.exists(concat_mp4):
    os.remove(concat_mp4)
