#!/usr/bin/env python3
"""Mimar ve mini dron mimarların 3D önizleme GIF'leri.

Oyundaki animasyon verisinin aynısı kullanılır (gen/entities.py, gen/dron.py).
Çıktılar: onizleme/60_dron_mimar.gif, onizleme/61_mimar_baret_dronlar.gif
"""
import math
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'addon', 'test'))
sys.path.insert(0, os.path.join(HERE, 'addon', 'gen'))
import render_z as Z  # noqa: E402
import dron as DR  # noqa: E402

SCR = os.path.join(HERE, 'tmp', 'mimar')
OUT = os.path.join(HERE, 'onizleme')
os.makedirs(SCR, exist_ok=True)


# ------------------------------------------------------------------ Molang / anahtar kare değerlendirici
def _ev(x, t):
    if isinstance(x, (int, float)):
        return float(x)
    s = x.replace('q.anim_time', f'({t})').replace('math.sin(', '_s(').replace('math.cos(', '_c(') \
        .replace('math.abs(', 'abs(')
    return float(eval(s, {'_s': lambda d: math.sin(math.radians(d)), '_c': lambda d: math.cos(math.radians(d)),
                          'abs': abs}))


def _ch(v, t):
    if isinstance(v, dict):
        ks = sorted(((float(k), val) for k, val in v.items()), key=lambda a: a[0])
        if t <= ks[0][0]:
            return [_ev(a, t) for a in ks[0][1]]
        for (t0, a), (t1, b) in zip(ks, ks[1:]):
            if t <= t1:
                k = (t - t0) / (t1 - t0) if t1 > t0 else 1
                return [_ev(x, t) + (_ev(y, t) - _ev(x, t)) * k for x, y in zip(a, b)]
        return [_ev(a, t) for a in ks[-1][1]]
    if isinstance(v, (int, float, str)):
        return [_ev(v, t)] * 3
    return [_ev(a, t) for a in v]


def pose_of(anims, names_times, pose=None):
    """anims: {ad: animasyon}; names_times: [(ad, t)] → render_z pozu (eklenerek)."""
    pose = pose or {}
    for name, t in names_times:
        a = anims[name]
        ln = a.get('animation_length')
        if ln:
            t = (t % ln) if a.get('loop') is True else min(t, ln)
        for bone, ch in a['bones'].items():
            d = pose.setdefault(bone, {'r': [0, 0, 0], 'p': [0, 0, 0], 's': 1})
            if 'rotation' in ch:
                d['r'] = [x + y for x, y in zip(d['r'], _ch(ch['rotation'], t))]
            if 'position' in ch:
                d['p'] = [x + y for x, y in zip(d['p'], _ch(ch['position'], t))]
            if 'scale' in ch:
                d['s'] = _ch(ch['scale'], t)
    return pose


def dron_gif():
    geo = DR.build(SCR)
    tex = Image.open(os.path.join(SCR, 'dron.png')).convert('RGBA')
    glow = Image.open(os.path.join(SCR, 'dron_glow.png')).convert('RGBA')
    anims = {k.split('.')[-1]: v for k, v in DR.animations()['animations'].items()}
    frames = []
    n = 48
    for i in range(n):
        t = i / 20
        seq = [('fly', t)]
        if 24 <= i < 40:
            seq.append(('place', (i - 24) / 20))
        pose = pose_of(anims, seq)
        cam = Z.Cam(yaw=30 + i * 7.5, elev=18, scale=22, size=(360, 360), center=(0, 6, 0))
        frames.append(Z.render(geo, tex, pose, cam=cam, glow=glow, ground={'y': -3, 'color': (58, 66, 74)}))
    return Z.gif(frames, os.path.join(OUT, '60_dron_mimar.gif'), ms=50)




# ------------------------------------------------------------------ Mimar: baret → dronlar
import robotgeo as RG  # noqa: E402
import entities as E  # noqa: E402

OTHER = {'helmet', 'antenna_ball20', 'sand_bag', 'antenna_ball19', 'scarf', 'antenna_leaf19', 'cape', 'right_shoulder',
         'left_shoulder', 'hat', 'antenna_sprout23', 'backpack', 'headset', 'cap', 'visor', 'kova'}


def birlesik(n_dron):
    """Robot + n dron tek geometri/doku (dron dokusu robot dokusunun altına)."""
    import copy
    _, rgeo = RG.build(SCR, os.path.join(SCR, 'robot.geo.json'))
    dgeo = DR.build(SCR)
    rt = Image.open(os.path.join(SCR, 'insaatci.png')).convert('RGBA')
    rg = Image.open(os.path.join(SCR, 'insaatci_glow.png')).convert('RGBA')
    dt = Image.open(os.path.join(SCR, 'dron.png')).convert('RGBA')
    dg = Image.open(os.path.join(SCR, 'dron_glow.png')).convert('RGBA')
    tex = Image.new('RGBA', (128, 160), (0, 0, 0, 0))
    glow = Image.new('RGBA', (128, 160), (0, 0, 0, 0))
    tex.paste(rt, (0, 0))
    glow.paste(rg, (0, 0))
    tex.paste(dt, (0, 128))
    glow.paste(dg, (0, 128))
    geo = copy.deepcopy(rgeo)
    d = geo['minecraft:geometry'][0]
    d['description']['texture_height'] = 160
    for i in range(n_dron):
        for b in dgeo['minecraft:geometry'][0]['bones']:
            nb = copy.deepcopy(b)
            nb['name'] = f'd{i}_' + b['name']
            if 'parent' in b:
                nb['parent'] = f'd{i}_' + b['parent']
            for c in nb.get('cubes', []):
                c['uv'] = [c['uv'][0], c['uv'][1] + 128]
            d['bones'].append(nb)
    return geo, tex, glow


def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def mimar_gif():
    N = 6
    geo, tex, glow = birlesik(N)
    ranim = {k.split('.')[-1]: v for k, v in E.robot_animations()['animations'].items()}
    danim = {k.split('.')[-1]: v for k, v in DR.animations()['animations'].items()}
    FPS = 20
    T_OFF, T_HOLD, T_BACK, T_ON, T_END = 0.5, 2.0, 5.6, 6.8, 8.4
    HAT = (0, 13.5, -11)           # ters baretin ağzı (model pikseli)
    frames = []
    for f in range(int(T_END * FPS)):
        t = f / FPS
        seq = [('idle', t)]
        if T_OFF <= t < T_HOLD:
            seq.append(('hat_off', t - T_OFF))
        elif T_HOLD <= t < T_ON:
            seq.append(('hat_hold', t - T_HOLD))
        elif T_ON <= t < T_ON + 1.3:
            seq.append(('hat_on', t - T_ON))
        pose = pose_of(ranim, seq)
        hidden = set(OTHER)
        for i in range(N):
            born = T_HOLD + 0.15 + i * 0.32
            back = T_BACK + i * 0.15
            pre = f'd{i}_'
            if not (born <= t < back + 0.5):
                hidden.add(pre + 'root')
                continue
            ang = math.radians(i * 360 / N + (t - born) * 70)
            out = ease((t - born - 0.25) / 0.9)
            inn = ease((t - back) / 0.45)
            k = out * (1 - inn)
            x = HAT[0] + math.cos(ang) * 16 * k
            z = HAT[2] + math.sin(ang) * 16 * k
            y = HAT[1] + 1 + (7 + 3 * math.sin(t * 3 + i)) * k
            dseq = [('fly', t + i * 0.13)]
            if t < born + 0.5:
                dseq.append(('out', t - born))
            elif t >= back:
                dseq.append(('in', t - back))
            elif (int((t - born) * 2) + i) % 3 == 0:
                dseq.append(('place', t - born))
            dp = pose_of(danim, dseq)
            for bone, v in dp.items():
                pose[pre + bone] = v
            rs = pose.get(pre + 'root', {}).get('s', 1)
            rs = rs if isinstance(rs, list) else [rs] * 3
            pose[pre + 'root'] = {'r': pose.get(pre + 'root', {}).get('r', [0, 0, 0]), 'p': [x, y, z],
                                  's': [v * 0.5 for v in rs]}
        cam = Z.Cam(yaw=25 + t * 9, elev=16, scale=8.5, size=(460, 420), center=(0, 15, -6))
        frames.append(Z.render(geo, tex, pose, hidden=hidden, cam=cam, glow=glow,
                               ground={'y': 0, 'color': (58, 66, 74)}))
    return Z.gif(frames, os.path.join(OUT, '61_mimar_baret_dronlar.gif'), ms=50)


if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] == 'dron':
        print(dron_gif())
    if len(sys.argv) < 2 or sys.argv[1] == 'mimar':
        print(mimar_gif())
