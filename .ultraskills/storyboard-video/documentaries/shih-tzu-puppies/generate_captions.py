#!/usr/bin/env python3
import os
import re
import json

audio_dir = os.path.abspath(".ultraskills/storyboard-video/documentaries/shih-tzu-puppies/public/audio")
out_file = os.path.abspath(".ultraskills/storyboard-video/documentaries/shih-tzu-puppies/src/captions.json")
os.makedirs(os.path.dirname(out_file), exist_ok=True)

vtt_files = [
    "scene_01_hook.vtt",
    "scene_02_origem.vtt",
    "scene_03_caracteristicas.vtt",
    "scene_04_rotina.vtt",
    "scene_05_cuidados.vtt",
    "scene_06_amor.vtt",
    "scene_07_desfecho.vtt",
]

timestamp_pattern = re.compile(
    r'(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})'
)

def parse_ms(h, m, s, ms):
    return (int(h) * 3600 + int(m) * 60 + int(s)) * 1000 + int(ms)

captions_by_scene = {}

for vtt_name in vtt_files:
    scene_key = vtt_name.replace(".vtt", "")
    path = os.path.join(audio_dir, vtt_name)
    words = []
    
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            lines = [l.strip() for l in f if l.strip()]
        
        i = 0
        while i < len(lines):
            line = lines[i]
            match = timestamp_pattern.search(line)
            if match:
                g = match.groups()
                start_ms = parse_ms(g[0], g[1], g[2], g[3])
                end_ms = parse_ms(g[4], g[5], g[6], g[7])
                
                # Next line is the text
                if i + 1 < len(lines):
                    text = lines[i + 1]
                    # Split words and distribute timing
                    word_tokens = text.split()
                    if word_tokens:
                        total_duration = max(100, end_ms - start_ms)
                        step = total_duration / len(word_tokens)
                        for idx, w in enumerate(word_tokens):
                            w_start = start_ms + int(idx * step)
                            w_end = start_ms + int((idx + 1) * step)
                            words.append({
                                "text": w,
                                "startMs": w_start,
                                "endMs": w_end
                            })
                    i += 1
            i += 1
            
    captions_by_scene[scene_key] = words

with open(out_file, "w", encoding="utf-8") as f:
    json.dump(captions_by_scene, f, indent=2, ensure_ascii=False)

print(f"Generated {out_file} with {len(captions_by_scene)} scenes.")
