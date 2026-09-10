#!/usr/bin/env python3
import os
import sys
import json
import urllib.request
import urllib.parse

project_dir = os.path.abspath(".ultraskills/storyboard-video/documentaries/shih-tzu-puppies")
videos_dir = os.path.join(project_dir, "public", "videos")
os.makedirs(videos_dir, exist_ok=True)

search_script = os.path.abspath(".agents/skills/media-research/scripts/search_media.py")

video_queries = [
    ("shih tzu puppy", "video_01_hero.mp4"),
    ("cute small dog puppy indoors", "video_02_lap.mp4"),
    ("shih tzu dog face", "video_03_closeup.mp4"),
    ("puppy running grass playful", "video_04_running.mp4"),
    ("grooming brushing dog puppy", "video_05_petting.mp4"),
    ("dog hugging cuddling owner", "video_06_cuddle.mp4"),
    ("happy dog puppy wagging tail", "video_07_happy.mp4"),
]

import subprocess

for query, filename in video_queries:
    target_path = os.path.join(videos_dir, filename)
    if os.path.exists(target_path) and os.path.getsize(target_path) > 100000:
        print(f"Already downloaded: {filename}")
        continue
    
    print(f"Searching video for '{query}'...")
    cmd = [
        sys.executable,
        search_script,
        query,
        "--type", "video",
        "--env_path", os.path.abspath(".env")
    ]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode == 0:
        try:
            items = json.loads(proc.stdout)
            # Filter for videos with valid URL
            valid_items = [it for it in items if it.get("url") and it["url"].endswith(".mp4")]
            if not valid_items and items:
                valid_items = items
            
            if valid_items:
                video_url = valid_items[0]["url"]
                print(f"Downloading {filename} from {valid_items[0].get('source')} ({video_url[:60]}...)...")
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                req = urllib.request.Request(video_url, headers=headers)
                with urllib.request.urlopen(req) as resp, open(target_path, "wb") as out:
                    out.write(resp.read())
                print(f"Saved {filename} ({os.path.getsize(target_path)} bytes)")
                continue
        except Exception as e:
            print(f"Error downloading {filename}: {e}")

print("Video download process completed.")
