#!/usr/bin/env python3
"""
Ensures all b-roll videos in public/videos are natively 1080x1920 (9:16 vertical),
centered on the puppy with crisp scaling.
"""

import os
import subprocess

videos_dir = os.path.abspath(".ultraskills/storyboard-video/documentaries/shih-tzu-puppies/public/videos")

video_files = [
    "video_01_hero.mp4",
    "video_02_lap.mp4",
    "video_03_closeup.mp4",
    "video_04_running.mp4",
    "video_05_petting.mp4",
    "video_06_cuddle.mp4",
    "video_07_happy.mp4",
]

for filename in video_files:
    raw_path = os.path.join(videos_dir, filename)
    if not os.path.exists(raw_path):
        continue
        
    temp_path = os.path.join(videos_dir, f"vert_{filename}")
    print(f"Processing {filename} to 1080x1920 vertical...")
    
    # Scale to fill 1080x1920 and crop center
    cmd = [
        "ffmpeg", "-y",
        "-i", raw_path,
        "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-an",
        temp_path
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    
    # Replace original with vertical version
    os.replace(temp_path, raw_path)
    print(f"Done {filename}: {os.path.getsize(raw_path)} bytes")

print("All b-roll videos converted to 1080x1920 vertical!")
