#!/usr/bin/env python3
"""v0.3.6 önizleme: arazi aracının tırmanma tutucuları (kapalı -> açılır) ve düz duvara tırmanış.
Çıktı: onizleme/73_arazi_tirman.gif"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
for p in (HERE, os.path.join(HERE, 'addon', 'gen'), os.path.join(HERE, 'addon', 'test')):
    sys.path.insert(0, p)
import render_z as Z  # noqa: E402
import kesif as K  # noqa: E402
import kesif_oyun as KG  # noqa: E402

geo, tex, glow = K.build(W=512)
bones = [b['name'] for b in geo['minecraft:geometry'][0]['bones']]
digerleri = {KG.ROOT[f] for f in KG.FORMS if f != 'arazi'}
TUT = [f'a_tut_{w}' for w in ('fl', 'fr', 'bl', 'br')]
frames = []
N = 72
for i in range(N):
    t = i / N
    pose = {}
    # 0-0.3: tutucular kapalı, 0.3-0.45 açılır, sonra duvara burnunu diker
    s = 0.0 if t < 0.3 else min(1.0, (t - 0.3) / 0.15)
    for b in TUT:
        pose[b] = {'s': [max(0.001, s)] * 3}
    egim = 0 if t < 0.5 else -80 * min(1.0, (t - 0.5) / 0.15)
    for w in ('fl', 'fr', 'bl', 'br'):
        pose[f'a_wheel_{w}'] = [-t * 1440, 0, 0]
    pose['a_root'] = {'r': [egim, 0, 0], 'p': [0, 0 if egim == 0 else 14 * (egim / -80), 0]}
    cam = Z.Cam(yaw=35 + i * 5, elev=20, scale=5.2, size=(420, 380), center=(0, 14, 0))
    frames.append(Z.render(geo, tex, pose, digerleri, cam, glow=glow, ground={'y': -2, 'color': (58, 66, 74)}))
print(Z.gif(frames, os.path.join(HERE, 'onizleme', '73_arazi_tirman.gif'), ms=60))
