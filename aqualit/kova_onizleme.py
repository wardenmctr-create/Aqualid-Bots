#!/usr/bin/env python3
"""Çiftçinin Aqualit kova numarası: 3D önizleme GIF'i ve sesli video.

Oyundaki animasyon verisinin aynısı kullanılır (gen/entities.py robot_animations), zamanlama da
jobs.js conjureWater ile aynıdır (tik = 1/20 sn).
Çıktı: onizleme/ciftci_su_numarasi.gif ve .mp4
"""
import math
import os
import random
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'addon', 'test'))
sys.path.insert(0, os.path.join(HERE, 'addon', 'gen'))
import render_z as Z  # noqa: E402
import robotgeo as RG  # noqa: E402
import entities as E  # noqa: E402

SCR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tmp', 'kova')
os.makedirs(SCR, exist_ok=True)
NAMES, GEO = RG.build(SCR, os.path.join(SCR, 'robot.geo.json'))
TEX = Image.open(os.path.join(SCR, 'ciftci.png')).convert('RGBA')
GLOW = Image.open(os.path.join(SCR, 'ciftci_glow.png')).convert('RGBA')
ANIMS = {k.split('.')[-1]: v for k, v in E.robot_animations()['animations'].items()}
OUT = os.path.join(HERE, 'onizleme')
WAV = os.path.join(HERE, 'sesler', 'wav')
FPS, SR = 25, 44100
SIZE = (420, 470)
SCALE = 0.8  # istemci varlığındaki ölçek
THROW = 3.0  # blok: su topunun çıktığı yükseklik (jobs.js ile aynı)

# çiftçiye ait olmayan aksesuarlar gizli
OTHER = {'helmet', 'antenna_ball20', 'sand_bag', 'antenna_ball19', 'scarf', 'antenna_leaf19', 'cape', 'right_shoulder',
         'left_shoulder', 'hardhat', 'toolbelt', 'blueprint', 'antenna_ball24', 'backpack', 'headset', 'cap', 'visor'}


# ------------------------------------------------------------------ Molang / anahtar kare değerlendirici
def msin(d):
    return math.sin(math.radians(d))


def mcos(d):
    return math.cos(math.radians(d))


def ev(x, t):
    if isinstance(x, (int, float)):
        return float(x)
    s = x.replace('q.anim_time', f'({t})').replace('math.sin(', 'msin(').replace('math.cos(', 'mcos(') \
        .replace('math.abs(', 'abs(')
    return float(eval(s, {'msin': msin, 'mcos': mcos, 'abs': abs}))


def channel(v, t):
    if isinstance(v, dict):
        ks = sorted(((float(k), val) for k, val in v.items()), key=lambda a: a[0])
        if t <= ks[0][0]:
            return [ev(a, t) for a in ks[0][1]]
        for (t0, a), (t1, b) in zip(ks, ks[1:]):
            if t <= t1:
                k = (t - t0) / (t1 - t0)
                return [ev(x, t) + (ev(y, t) - ev(x, t)) * k for x, y in zip(a, b)]
        return [ev(a, t) for a in ks[-1][1]]
    if isinstance(v, (int, float, str)):
        return [ev(v, t)] * 3
    return [ev(a, t) for a in v]


def anim_pose(name, t, pose):
    a = ANIMS[name]
    ln = a.get('animation_length')
    if ln:
        lp = a.get('loop')
        t = (t % ln) if lp is True else min(t, ln)
    for bone, ch in a['bones'].items():
        d = pose.setdefault(bone, {'r': [0, 0, 0], 'p': [0, 0, 0], 's': [1, 1, 1]})
        if 'rotation' in ch:
            d['r'] = [x + y for x, y in zip(d['r'], channel(ch['rotation'], t))]
        if 'position' in ch:
            d['p'] = [x + y for x, y in zip(d['p'], channel(ch['position'], t))]
        if 'scale' in ch:
            d['s'] = [x * y for x, y in zip(d['s'], channel(ch['scale'], t))]
    return pose


# ------------------------------------------------------------------ zaman çizelgesi (tik)
PRE = 12
T_THROW = PRE           # water_throw başlar
T_RISE = T_THROW + 5    # su topu yükselir (12 tik)
T_CATCH = T_RISE + 12   # kova görünür, water_catch
T_SPLASH = T_CATCH + 12  # su kovaya düşer
T_POUR = T_SPLASH + 12  # water_pour
T_WATER = T_POUR + 8    # blok suya döner
T_END = T_WATER + 10    # normal duruş
TOTAL = T_END + 16


def act_at(tick):
    if tick < T_THROW:
        return None, 0
    if tick < T_CATCH:
        return 'water_throw', (tick - T_THROW) / 20
    if tick < T_POUR:
        return 'water_catch', (tick - T_CATCH) / 20
    if tick < T_END:
        return 'water_pour', (tick - T_POUR) / 20
    return None, 0


HAND = (0.0, 1.3 * 16, 0.0)          # robot ortası, el yüksekliği (piksel)
SPOT = (-16.0, 0.0, -34.0)           # su gözü (robotun önü)


def ball_at(tick):
    if T_RISE <= tick < T_CATCH:
        i = tick - T_RISE
        return HAND[1] + THROW * 16 * math.sin((i / 12) * math.pi / 2)
    if T_CATCH <= tick < T_SPLASH:
        i = 12 - (tick - T_CATCH)
        return HAND[1] + 0.6 * 16 + THROW * 16 * (1 - math.cos((i / 12) * math.pi / 2))
    return None


def particles(tick, frame_rng):
    out = []
    y = ball_at(tick)
    if y is not None:
        for k in range(14):
            a = frame_rng.uniform(0, 6.283)
            r = frame_rng.uniform(0, 3.6)
            out.append({'pos': (HAND[0] + math.cos(a) * r, y + frame_rng.uniform(-3, 3), HAND[2] + math.sin(a) * r),
                        'size': frame_rng.uniform(1.6, 3.2),
                        'color': [(72, 136, 236), (140, 192, 252), (214, 238, 255), (40, 96, 206)][k % 4],
                        'alpha': 0.95})
        # iz damlaları
        for k in range(6):
            out.append({'pos': (HAND[0] + frame_rng.uniform(-2, 2), y - frame_rng.uniform(4, 14), HAND[2] + frame_rng.uniform(-2, 2)),
                        'size': 1.2, 'color': (140, 192, 252), 'alpha': 0.6})
    for t0, center in ((T_SPLASH, (HAND[0], HAND[1] + 14, HAND[2])), (T_WATER, (SPOT[0] + 8, 2, SPOT[2] + 8))):
        if t0 <= tick < t0 + 12:
            k = (tick - t0) / 12
            rnd = random.Random(t0)
            for j in range(22):
                a = rnd.uniform(0, 6.283)
                sp = rnd.uniform(6, 14)
                out.append({'pos': (center[0] + math.cos(a) * sp * k, center[1] + 14 * k - 22 * k * k,
                                    center[2] + math.sin(a) * sp * k),
                            'size': 1.8 * (1 - k) + 0.8, 'color': (140, 192, 252), 'alpha': 1 - k})
    return out


# ------------------------------------------------------------------ çizim
CAM = Z.Cam(yaw=35, elev=16, scale=5.6, size=SIZE, center=(-6, 33, -18))


def poly(d, cam, pts, fill):
    S, _ = cam.proj(np.array(pts, float))
    d.polygon([tuple(p) for p in S], fill=fill)


def ground_img(tick):
    hide = {b['name'] for b in GEO['minecraft:geometry'][0]['bones']}
    img = Z.render(GEO, TEX, {}, hide, CAM, ground={'y': 0, 'color': (104, 162, 76), 'pattern': 'grass'}, shadow=False,
                   bg=(150, 198, 236))
    ov = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    sx, sz = SPOT[0], SPOT[2]
    # çapalanmış tarla kareleri (su gözünün çevresi)
    for dx in range(-1, 2):
        for dz in range(-1, 2):
            if dx == 0 and dz == 0:
                continue
            x0, z0 = sx + dx * 16, sz + dz * 16
            poly(d, CAM, [(x0, 0.2, z0), (x0 + 16, 0.2, z0), (x0 + 16, 0.2, z0 + 16), (x0, 0.2, z0 + 16)], (92, 62, 38, 255))
            for k in range(1, 4):
                poly(d, CAM, [(x0, 0.3, z0 + k * 4), (x0 + 16, 0.3, z0 + k * 4), (x0 + 16, 0.3, z0 + k * 4 + 0.8),
                              (x0, 0.3, z0 + k * 4 + 0.8)], (70, 46, 28, 255))
    # orta: önce çukur, sonra su
    if tick >= T_WATER:
        poly(d, CAM, [(sx, 0.25, sz), (sx + 16, 0.25, sz), (sx + 16, 0.25, sz + 16), (sx, 0.25, sz + 16)], (52, 112, 222, 235))
        poly(d, CAM, [(sx + 3, 0.3, sz + 3), (sx + 9, 0.3, sz + 3), (sx + 9, 0.3, sz + 5), (sx + 3, 0.3, sz + 5)], (150, 200, 252, 220))
    else:
        poly(d, CAM, [(sx, 0.25, sz), (sx + 16, 0.25, sz), (sx + 16, 0.25, sz + 16), (sx, 0.25, sz + 16)], (58, 40, 26, 255))
    img = img.convert('RGBA')
    img.alpha_composite(ov)
    return img.convert('RGB')


def frame(tick):
    pose = {}
    t = tick / 20
    anim_pose('setup', t, pose)
    anim_pose('idle', t, pose)
    act, at = act_at(tick)
    if act:
        anim_pose(act, at, pose)
    pose['root'] = combine_root(pose.get('root'))
    # dökerken su gözüne döner
    turn = min(1.0, max(0.0, (tick - (T_SPLASH + 4)) / 8)) * (1 - min(1.0, max(0.0, (tick - T_END) / 8)))
    pose['root']['r'] = [pose['root']['r'][0], pose['root']['r'][1] + 26 * turn, pose['root']['r'][2]]
    hidden = set(OTHER)
    if act not in ('water_catch', 'water_pour'):
        hidden.add('kova')
    bg = ground_img(tick)
    img = Z.render(GEO, TEX, pose, hidden, CAM, glow=GLOW, bg_image=bg, shadow=True)
    rng = random.Random(tick * 7 + 1)
    return draw_parts(img, particles(tick, rng))


def combine_root(d):
    d = d or {'r': [0, 0, 0], 'p': [0, 0, 0], 's': [1, 1, 1]}
    d = dict(d)
    d['s'] = [v * SCALE for v in d['s']]
    return d


def draw_parts(img, parts):
    if not parts:
        return img
    ov = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    P = np.array([p['pos'] for p in parts], float)
    S, _ = CAM.proj(P)
    for (sx, sy), p in zip(S, parts):
        r = p['size']
        c = tuple(p['color']) + (int(255 * max(0, min(1, p['alpha']))),)
        d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=c)
    base = img.convert('RGBA')
    base.alpha_composite(ov)
    return base.convert('RGB')


def audio(total_s):
    out = np.zeros(int(total_s * SR) + SR)

    def add(name, tick, gain):
        sr, y = wavfile.read(os.path.join(WAV, name + '.wav'))
        y = y.astype(float) / 32767
        i = int(tick / 20 * SR)
        k = min(len(y), len(out) - i)
        if k > 0:
            out[i:i + k] += gain * y[:k]

    add('robot_servo1', T_THROW, 0.5)
    add('robot_servo3', T_CATCH + 11, 0.4)
    add('kesif_parilti', T_CATCH, 0.35)
    out = out[:int(total_s * SR)]
    # su sesleri: kısa sentez (fırlatma, yakalama, dökme)
    def splash(at, dur, lo, hi, gain):
        n = int(dur * SR)
        t = np.arange(n) / SR
        from scipy import signal
        sos = signal.butter(2, [lo, hi], btype='band', fs=SR, output='sos')
        y = signal.sosfilt(sos, np.random.default_rng(at).standard_normal(n)) * np.exp(-t / (dur / 3))
        i = int(at / 20 * SR)
        k = min(n, len(out) - i)
        out[i:i + k] += gain * y[:k] / (np.abs(y).max() or 1)
    splash(T_RISE, 0.35, 400, 3000, 0.5)
    splash(T_SPLASH, 0.45, 300, 2500, 0.8)
    splash(T_WATER, 0.6, 200, 2200, 0.9)
    return out / max(1e-6, np.abs(out).max()) * 0.9


def main():
    nf = int(TOTAL / 20 * FPS)
    frames = [frame(i / FPS * 20) for i in range(nf)]
    tmp = tempfile.mkdtemp(dir=SCR)
    for i, f in enumerate(frames):
        f.save(os.path.join(tmp, f'f{i:04d}.png'))
    gp = os.path.join(OUT, 'ciftci_su_numarasi.gif')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', str(FPS), '-i', os.path.join(tmp, 'f%04d.png'),
                    '-vf', 'split[a][b];[a]palettegen=max_colors=160:stats_mode=full[p];'
                           '[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', '-loop', '0', gp], check=True)
    wavfile.write(os.path.join(tmp, 'a.wav'), SR, (audio(nf / FPS) * 32767).astype(np.int16))
    mp = os.path.join(OUT, 'ciftci_su_numarasi.mp4')
    w, h = frames[0].size
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(tmp, 'f%04d.png'),
                    '-i', os.path.join(tmp, 'a.wav'), '-vf', f'scale={w * 2}:{h * 2}:flags=lanczos', '-c:v', 'libx264',
                    '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-shortest',
                    '-movflags', '+faststart', mp], check=True)
    print(gp, len(frames), 'kare', f'{os.path.getsize(gp) / 1e6:.1f} MB')


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'kareler':
        ims = [frame(t) for t in (0, T_THROW + 4, T_RISE + 8, T_CATCH + 2, T_CATCH + 9, T_SPLASH + 2, T_POUR + 6, T_WATER + 4)]
        w, h = ims[0].size
        sheet = Image.new('RGB', (w * 4, h * 2))
        for i, im in enumerate(ims):
            sheet.paste(im, ((i % 4) * w, (i // 4) * h))
        sheet.resize((w * 2, h)).save(os.path.join(SCR, 'kova_kareler.png'))
        print('kareler')
    else:
        main()
