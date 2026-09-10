#!/usr/bin/env python3
import os
import sys
import json
import urllib.request
import urllib.parse

project_dir = os.path.abspath(".ultraskills/storyboard-video/documentaries/shih-tzu-puppies")
assets_dir = os.path.join(project_dir, "public", "assets")
os.makedirs(assets_dir, exist_ok=True)

search_script = os.path.abspath(".agents/skills/media-research/scripts/search_media.py")

queries = [
    ("shih tzu puppy", "puppy_01_hero.jpg"),
    ("cute small puppy fluffy", "puppy_02_origem.jpg"),
    ("shih tzu dog face", "puppy_03_face.jpg"),
    ("sleepy puppy cute", "puppy_04_sleepy.jpg"),
    ("shih tzu grooming", "puppy_05_care.jpg"),
    ("dog hugging owner cute", "puppy_06_love.jpg"),
    ("happy shih tzu", "puppy_07_happy.jpg"),
]

import subprocess

for query, filename in queries:
    target_path = os.path.join(assets_dir, filename)
    if os.path.exists(target_path):
        print(f"Already exists: {filename}")
        continue
    
    print(f"Searching for '{query}'...")
    cmd = [
        sys.executable,
        search_script,
        query,
        "--type", "image",
        "--env_path", os.path.abspath(".env")
    ]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode == 0:
        try:
            items = json.loads(proc.stdout)
            if items:
                img_url = items[0]["url"]
                print(f"Downloading {filename} from {items[0]['source']}...")
                headers = {"User-Agent": "Mozilla/5.0"}
                req = urllib.request.Request(img_url, headers=headers)
                with urllib.request.urlopen(req) as resp, open(target_path, "wb") as out:
                    out.write(resp.read())
                print(f"Saved {filename} ({os.path.getsize(target_path)} bytes)")
                continue
        except Exception as e:
            print(f"Error parsing/downloading {filename}: {e}")

print("Puppy assets download process completed.")
