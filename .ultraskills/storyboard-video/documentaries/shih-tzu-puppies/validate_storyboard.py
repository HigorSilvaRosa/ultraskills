#!/usr/bin/env python3
import json
import os
import sys

base_dir = os.path.abspath(".ultraskills/storyboard-video/documentaries/shih-tzu-puppies")
storyboard_file = os.path.join(base_dir, "storyboard.json")
scenes_dir = os.path.abspath(".ultraskills/remotion/scenes")

with open(storyboard_file, "r", encoding="utf-8") as f:
    sb = json.load(f)

print(f"Title: {sb['title']}")
print(f"Resolution: {sb['width']}x{sb['height']} @ {sb['fps']}fps")
print(f"Scenes count: {len(sb['scenes'])}")

total_frames = 0
transition_frames = 0

for idx, scene in enumerate(sb['scenes']):
    slug = scene['sceneSlug']
    scene_path = os.path.join(scenes_dir, f"{slug}.tsx")
    assert os.path.exists(scene_path), f"Scene file missing: {scene_path}"
    
    # Check media
    props = scene.get('props', {})
    if 'media' in props and 'src' in props['media']:
        media_path = os.path.join(base_dir, "public", props['media']['src'])
        assert os.path.exists(media_path), f"Media file missing: {media_path}"
    
    # Check audio
    audio = scene.get('audio', {})
    if 'voiceoverSrc' in audio:
        vo_path = os.path.join(base_dir, "public", audio['voiceoverSrc'])
        assert os.path.exists(vo_path), f"Voiceover file missing: {vo_path}"
        
    duration = scene['durationInFrames']
    total_frames += duration
    
    tout = scene.get('transitionOut')
    if tout:
        transition_frames += tout['durationInFrames']
        
    print(f"  Scene {idx+1} ({slug}): {duration} frames ({duration/sb['fps']:.2f}s)")

# Check BGM
if 'audio' in sb and 'bgm' in sb['audio']:
    bgm_path = os.path.join(base_dir, "public", sb['audio']['bgm'])
    assert os.path.exists(bgm_path), f"BGM file missing: {bgm_path}"
    print(f"BGM: {sb['audio']['bgm']} (OK)")

net_duration = total_frames - transition_frames
print(f"Gross duration: {total_frames} frames ({total_frames/sb['fps']:.2f}s)")
print(f"Transitions: {transition_frames} frames")
print(f"Net composition duration: {net_duration} frames ({net_duration/sb['fps']:.2f}s)")
print("ALL VALIDATIONS PASSED!")
