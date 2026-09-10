#!/usr/bin/env python3
"""
Inspects .ultraskills/remotion/scenes/*.tsx and outputs a structured JSON catalog
of available reusable scene components, their exported types, and Zod schemas.
"""

import glob
import json
import os
import re
import sys

def analyze_scene_file(filepath):
    slug = os.path.splitext(os.path.basename(filepath))[0]
    with open(filepath, 'r', encoding='utf-8') as f:
        code = f.read()

    component_match = re.search(r'export\s+const\s+(Scene[A-Za-z0-9_]+)\s*:\s*React\.FC', code)
    component_name = component_match.group(1) if component_match else None

    # Prioritize schema matching scene[A-Za-z0-9_]*Schema or matching component name
    schema_match = re.search(r'export\s+const\s+(scene[A-Za-z0-9_]+Schema)\s*=\s*z\.object', code)
    if not schema_match:
        schema_match = re.search(r'export\s+const\s+([A-Za-z0-9_]+Schema)\s*=\s*z\.object', code)
    schema_name = schema_match.group(1) if schema_match else None

    props_match = re.search(r'export\s+(?:type|interface)\s+(Scene[A-Za-z0-9_]+Props)', code)
    props_name = props_match.group(1) if props_match else None

    return {
        'slug': slug,
        'filename': os.path.basename(filepath),
        'filepath': filepath.replace('\\', '/'),
        'component': component_name,
        'propsInterface': props_name,
        'zodSchema': schema_name,
        'hasZodSchema': schema_name is not None
    }

def main():
    scenes_dir = os.path.join('.ultraskills', 'remotion', 'scenes')
    if not os.path.exists(scenes_dir):
        print(json.dumps({'scenes': [], 'count': 0}, indent=2))
        return

    pattern = os.path.join(scenes_dir, '*.tsx')
    files = sorted(glob.glob(pattern))

    catalog = [analyze_scene_file(f) for f in files]
    output = {
        'scenes': catalog,
        'count': len(catalog)
    }

    print(json.dumps(output, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()
