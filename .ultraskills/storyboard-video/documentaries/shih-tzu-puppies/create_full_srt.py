#!/usr/bin/env python3
import os
import re
import json

base_dir = os.path.abspath(".ultraskills/storyboard-video/documentaries/shih-tzu-puppies")
out_dir = os.path.join(base_dir, "out")
os.makedirs(out_dir, exist_ok=True)
srt_path = os.path.join(out_dir, "video.srt")

with open(os.path.join(base_dir, "voiceovers_manifest.json"), "r", encoding="utf-8") as f:
    manifest = json.load(f)

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

def format_srt_time(ms):
    s, ms = divmod(ms, 1000)
    m, s = divmod(s, 60)
    h, m = divmod(m, 60)
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{int(ms):03d}"

def parse_ms(h, m, s, ms):
    return (int(h) * 3600 + int(m) * 60 + int(s)) * 1000 + int(ms)

current_offset_ms = 0
global_cue_id = 1
srt_lines = []

for item, vtt_name in zip(manifest, vtt_files):
    vtt_path = os.path.join(base_dir, "public", "audio", vtt_name)
    duration_ms = int(item["durationSeconds"] * 1000) + int((item["paddingFrames"] / 30.0) * 1000)
    
    if os.path.exists(vtt_path):
        with open(vtt_path, "r", encoding="utf-8") as f:
            lines = [l.strip() for l in f if l.strip()]
        
        i = 0
        while i < len(lines):
            line = lines[i]
            match = timestamp_pattern.search(line)
            if match:
                g = match.groups()
                start_ms = parse_ms(g[0], g[1], g[2], g[3]) + current_offset_ms
                end_ms = parse_ms(g[4], g[5], g[6], g[7]) + current_offset_ms
                if i + 1 < len(lines):
                    text = lines[i + 1]
                    srt_lines.append(f"{global_cue_id}\n{format_srt_time(start_ms)} --> {format_srt_time(end_ms)}\n{text}\n")
                    global_cue_id += 1
                    i += 1
            i += 1
            
    current_offset_ms += duration_ms

with open(srt_path, "w", encoding="utf-8") as f:
    f.write("\n".join(srt_lines))

print(f"Generated {srt_path} with {global_cue_id - 1} subtitle cues.")
