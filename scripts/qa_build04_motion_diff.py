#!/usr/bin/env python3
"""BUILD 04 motion-evidence pixel-diff (review fix #2).

The frame-triples in download/asset-qa/build04-validation/ are live captures of
one continuous scene (1.5 s apart, no re-navigation). This script measures the
per-frame pixel deltas and writes them to motion-pixel-diff.json — a still
cannot prove animation, so the committed measurement IS the evidence unit.
Usage: python3 scripts/qa_build04_motion_diff.py [repo_root_optional]
"""
import json
import os
import sys

from PIL import Image, ImageChops

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..')
QA_DIR = os.path.join(ROOT, 'download', 'asset-qa', 'build04-validation')

# (frame A, frame B, label) — every BUILD 04 motion sequence.
PAIRS = [
    ('v_talk_flap_zoom_desktop.png', 'v_talk_flap_zoom_f2_desktop.png', 'talk flap f1-f2'),
    ('v_talk_flap_zoom_f2_desktop.png', 'v_talk_flax_zoom_f3_desktop.png', 'talk flap f2-f3'),
    ('v_wave_elbow_zoom_desktop.png', 'v_wave_elbow_zoom_f2_desktop.png', 'wave elbow f1-f2'),
    ('v_plaza_hero_build04_desktop.png', 'v_plaza_hero_build04_f2_desktop.png', 'ambient sway f1-f2'),
    ('v_plaza_hero_build04_f2_desktop.png', 'v_plaza_hero_build04_f3_desktop.png', 'ambient sway f2-f3'),
]
PAIRS[1] = ('v_talk_flap_zoom_f2_desktop.png', 'v_talk_flap_zoom_f3_desktop.png', 'talk flap f2-f3')

results = []
for a, b, label in PAIRS:
    pa, pb = os.path.join(QA_DIR, a), os.path.join(QA_DIR, b)
    if not (os.path.isfile(pa) and os.path.isfile(pb)):
        results.append({'label': label, 'missing': True})
        continue
    ia = Image.open(pa).convert('RGB')
    ib = Image.open(pb).convert('RGB')
    d = ImageChops.difference(ia, ib).convert('L')
    hist = d.histogram()
    changed = sum(hist[8:])  # pixels with channel delta > 8 (noise floor)
    total = ia.size[0] * ia.size[1]
    results.append({
        'label': label,
        'frames': [a, b],
        'changedPx': changed,
        'totalPx': total,
        'ratio': round(changed / total, 6),
        'animated': changed / total > 0.001,
    })

out = {
    'note': 'Per-frame pixel deltas for BUILD 04 motion evidence (talk mouth-flap, wave elbow, ambient sway). Frames are 1.5 s apart, same live scene, no re-navigation. ratio > 0.001 proves the scene animated between captures.',
    'pairs': results,
    'allAnimated': all(r.get('animated', False) for r in results),
}
dest = os.path.join(QA_DIR, 'motion-pixel-diff.json')
with open(dest, 'w') as f:
    json.dump(out, f, indent=2)
print(json.dumps(out, indent=2))
print(f'written: {dest}')
