#!/usr/bin/env python3
"""Keşif Robotu — yumuşak dönüşüm animasyonları (V3c) ve 3D önizlemeler.

Her araç için zaman çizelgesi (saniye, dönüşüm başından):
  0.00-0.22  hazırlık: çömelme, gözlük iner (tık sesi)
  0.18-0.55  jetlerle zıplama, kollar ve bacaklar katlanır
  0.50-1.10  dönerek küçülüp parlayan bir çekirdeğe dönüşür (servo ve cırcır sesleri)
  0.80-1.60  araç çekirdekten açılır; kanat, tekerlek, pervane gibi parçalar sırayla yerine oturur
  1.58       kilitlenme (tok ses ve tıslama), 1.60-2.00 yaylanıp durulma
  1.85       motor çalışır, ardından aracın kendi hareketi

Aynı zaman çizelgesi oyundaki animasyonun ve ses efektlerinin kaynağıdır (bake_bedrock).
Çıktı: onizleme/kesif_donusum_<araç>.gif ve onizleme/kesif_donusum_<araç>.mp4 (sesli)
Kullanım: python3 kesif_donusum.py [ucak gemi denizalti arazi matkap]
"""
import math
import os
import random
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'addon', 'test'))
import kesif_onizleme as KO  # noqa: E402
import render_z as Z  # noqa: E402

FPS = 25
IDLE_S, TR_S, MOVE_S = 1.0, 2.0, 2.4
OUT = KO.OUT
WAV = os.path.join(HERE, 'sesler', 'wav')
SR = 44100


# ------------------------------------------------------------------ yumuşatma eğrileri
def c01(x):
    return max(0.0, min(1.0, x))


def seg(t, a, b):
    return c01((t - a) / (b - a))


def smooth(x):
    x = c01(x)
    return x * x * x * (x * (x * 6 - 15) + 10)


def inout_cubic(x):
    x = c01(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def out_cubic(x):
    return 1 - (1 - c01(x)) ** 3


def in_cubic(x):
    return c01(x) ** 3


def out_back(x, k=1.25):
    x = c01(x) - 1
    return x * x * ((k + 1) * x + k) + 1


def inout_sine(x):
    return -(math.cos(math.pi * c01(x)) - 1) / 2


def keys(t, ks):
    """Anahtar karelerin arasını yumuşak geçişle doldurur. ks: [(zaman, değer|liste)]"""
    if t <= ks[0][0]:
        return ks[0][1]
    for (t0, v0), (t1, v1) in zip(ks, ks[1:]):
        if t <= t1:
            k = smooth((t - t0) / (t1 - t0))
            if isinstance(v0, (list, tuple)):
                return [a + (b - a) * k for a, b in zip(v0, v1)]
            return v0 + (v1 - v0) * k
    return ks[-1][1]


def as_d(v):
    if v is None:
        return {'r': [0, 0, 0], 'p': [0, 0, 0], 's': [1, 1, 1]}
    if isinstance(v, (list, tuple)):
        return {'r': list(v), 'p': [0, 0, 0], 's': [1, 1, 1]}
    s = v.get('s', 1)
    return {'r': list(v.get('r', [0, 0, 0])), 'p': list(v.get('p', [0, 0, 0])),
            's': list(s) if isinstance(s, (list, tuple)) else [s, s, s]}


def combine(a, b):
    """İki pozu birleştir: dönüş ve konum toplanır, ölçek çarpılır."""
    A, B = as_d(a), as_d(b)
    return {'r': [x + y for x, y in zip(A['r'], B['r'])], 'p': [x + y for x, y in zip(A['p'], B['p'])],
            's': [max(0.001, x * y) for x, y in zip(A['s'], B['s'])]}


def merge_pose(base, extra):
    out = dict(base)
    for k, v in extra.items():
        out[k] = combine(out.get(k), v)
    return out


# ------------------------------------------------------------------ araçlara özel açılma (parça, başla, süre, tür)
# tür: {'s': başlangıç ölçeği (liste olabilir), 'r': başlangıç dönüşü, 'p': başlangıç konumu}; hepsi 0'a (kimliğe) gider
UNFOLD = {
    'ucak': {
        'body_lag': ('u_body', [0.22, 1, 1], 0.95, 0.5),   # kanatlar yana açılır
        'parts': [('u_gear_l', 1.0, 0.4, {'r': [0, 0, -100]}), ('u_gear_r', 1.0, 0.4, {'r': [0, 0, 100]}),
                  ('u_prop', 1.08, 0.36, {'s': 0.0, 'spin': [0, 0, 720]}), ('u_rudder', 1.16, 0.32, {'s': [1, 0, 1]}),
                  ('u_elev', 1.22, 0.32, {'s': [0, 1, 1]}), ('u_ail_l', 1.28, 0.3, {'r': [35, 0, 0]}),
                  ('u_ail_r', 1.28, 0.3, {'r': [35, 0, 0]}), ('u_scarf', 1.36, 0.3, {'s': 0.0})],
        'ground': 'dust',
    },
    'gemi': {
        'body_lag': ('g_body', [1, 0.35, 1], 0.95, 0.5),    # kamara yükselir
        'parts': [('g_screw', 1.08, 0.35, {'s': 0.0, 'spin': [0, 0, 720]}), ('g_radar', 1.2, 0.35, {'p': [0, -5, 0], 's': 0.2}),
                  ('g_flag', 1.32, 0.32, {'s': [0, 1, 1]})],
        'ground': 'splash',
    },
    'denizalti': {
        'body_lag': ('d_body', [1, 1, 0.3], 0.95, 0.5),     # gövde boyuna uzar
        'parts': [('d_prop', 1.06, 0.35, {'s': 0.0, 'spin': [0, 0, 720]}), ('d_plane_l', 1.14, 0.35, {'r': [0, 80, 0]}),
                  ('d_plane_r', 1.14, 0.35, {'r': [0, -80, 0]}), ('d_scope', 1.24, 0.36, {'p': [0, -8, 0]}),
                  ('d_radar', 1.3, 0.3, {'p': [0, -4, 0], 's': 0.2}), ('d_flag', 1.38, 0.3, {'s': [0, 1, 1]})],
        'ground': 'splash',
    },
    'arazi': {
        'body_lag': ('a_body', [1, 0.4, 1], 0.95, 0.5),     # kasa yükselir
        'parts': [('a_wheel_fl', 1.02, 0.34, {'s': 0.0, 'p': [0, 4, 0], 'spin': [360, 0, 0]}),
                  ('a_wheel_fr', 1.09, 0.34, {'s': 0.0, 'p': [0, 4, 0], 'spin': [360, 0, 0]}),
                  ('a_wheel_bl', 1.16, 0.34, {'s': 0.0, 'p': [0, 4, 0], 'spin': [360, 0, 0]}),
                  ('a_wheel_br', 1.23, 0.34, {'s': 0.0, 'p': [0, 4, 0], 'spin': [360, 0, 0]}),
                  ('a_radar', 1.3, 0.3, {'p': [0, -4, 0], 's': 0.2}), ('a_flag', 1.36, 0.3, {'s': [0, 1, 1]})],
        'ground': 'dust',
    },
    'matkap': {
        'body_lag': ('m_body', [1, 1, 0.35], 0.95, 0.5),    # gövde öne uzar
        'parts': [(f'm_rw_{s}{i}', 1.0 + 0.05 * i + (0.02 if s == 'r' else 0), 0.3, {'s': 0.0, 'spin': [360, 0, 0]})
                  for s in 'lr' for i in range(3)] +
                 [('m_drill', 1.18, 0.42, {'p': [0, 0, -9], 's': [0.6, 0.6, 0.2], 'spin': [0, 0, 1080]}),
                  ('m_radar', 1.34, 0.3, {'p': [0, -4, 0], 's': 0.2})],
        'ground': 'dust',
    },
}

# ses ipuçları: (ses, başlangıç saniyesi (dönüşüm başına göre), kazanç)
TRANSFORM_CUES = [('kesif_gozluk', 0.05, 0.9), ('kesif_donusum', 0.12, 0.85), ('kesif_parilti', 0.5, 0.55),
                  ('kesif_kilit', 1.58, 0.95)]
ENGINE = {
    'ucak': [('kesif_ucak', 1.85, 0.9), ('kesif_ucak_dongu', 4.05, 0.75), ('kesif_ucak_dongu', 5.05, 0.75)],
    'gemi': [('kesif_gemi', 1.85, 0.9), ('kesif_gemi_dongu', 3.65, 0.75), ('kesif_gemi_dongu', 4.65, 0.75)],
    'denizalti': [('kesif_denizalti_dongu', 1.9, 0.7), ('kesif_denizalti_dongu', 2.9, 0.7),
                  ('kesif_denizalti_dongu', 3.9, 0.7), ('kesif_sonar', 2.3, 0.9), ('kesif_sonar', 3.6, 0.6)],
    'arazi': [('kesif_arazi', 1.85, 0.9), ('kesif_arazi_dongu', 3.45, 0.75), ('kesif_arazi_dongu', 4.45, 0.75)],
    'matkap': [('kesif_matkap', 1.85, 0.9), ('kesif_matkap_dongu', 3.65, 0.75), ('kesif_matkap_dongu', 4.65, 0.75)],
}


# ------------------------------------------------------------------ dönüşüm pozları
def vehicle_core(key, sc):
    geo_bones = {b['name']: b for b in KO.GEO['minecraft:geometry'][0]['bones']}
    piv = list(geo_bones[sc['root']].get('pivot', [0, 0, 0]))
    base = as_d(sc['motion'](0)[0].get(sc['root']))
    return [piv[0] + base['p'][0], piv[1] + base['p'][1], piv[2] + base['p'][2]]


def robot_pose(ts, sc, core):
    """Robotun dönüşüm pozu (ts: dönüşüm başından saniye)."""
    hover = sc['hover']
    p = {}
    p['k_goggles'] = {'p': [0, -6 * out_back(seg(ts, 0.0, 0.22), 1.6), 0]}
    p['k_radar'] = [0, ts * 900, 0]
    p['k_scarf_tail'] = [math.sin(ts * 25) * (8 + 14 * seg(ts, 0.2, 0.6)), 0, math.sin(ts * 15) * 8]
    p['right_arm'] = keys(ts, [(0.0, [0, 0, 3]), (0.25, [0, 0, 48]), (0.62, [-85, 0, 12])])
    p['left_arm'] = keys(ts, [(0.0, [0, 0, -3]), (0.25, [0, 0, -48]), (0.62, [-85, 0, -12])])
    p['right_leg'] = keys(ts, [(0.15, [0, 0, 0]), (0.55, [-62, 0, 6])])
    p['left_leg'] = keys(ts, [(0.15, [0, 0, 0]), (0.55, [-62, 0, -6])])
    p['head'] = keys(ts, [(0.18, [0, 0, 0]), (0.5, [14, 0, 0])])
    p['k_flame'] = {'s': [1, 1, 0.7 + 0.5 * abs(math.sin(ts * 60))]}
    crouch = -1.3 * smooth(seg(ts, 0.0, 0.18)) * (1 - smooth(seg(ts, 0.18, 0.3)))
    hop = 5.5 * out_cubic(seg(ts, 0.18, 0.55))
    y_hop = hover + crouch + hop
    s = 1 - 0.68 * inout_cubic(seg(ts, 0.5, 0.95))
    s *= 1 - in_cubic(seg(ts, 0.95, 1.1))
    m = inout_cubic(seg(ts, 0.55, 1.0))
    cen = 10.0  # robotun gövde ortası
    core_p = [core[0], core[1] - s * cen, core[2]]
    pos = [core_p[0] * m, y_hop + (core_p[1] - y_hop) * m, core_p[2] * m]
    spin = 540 * inout_sine(seg(ts, 0.2, 1.05))
    p['root'] = {'p': pos, 'r': [0, spin, 0], 's': max(0.001, s)}
    visible = s > 0.01
    return p, visible


def vehicle_pose(ts, key, sc):
    root = sc['root']
    base, mhide, _, _ = sc['motion'](0)
    u = UNFOLD[key]
    extra = {}
    g = seg(ts, 0.8, 1.6)
    vs = 0.3 + 0.7 * out_back(g, 0.9)
    yaw = -120 * (1 - inout_cubic(g))
    lock = seg(ts, 1.6, 2.0)
    bounce = 0.9 * math.sin(lock * math.pi * 3) * math.exp(-lock * 3.2) if ts > 1.6 else 0.0
    rise = 3.0 * (1 - out_cubic(g)) if ts < 1.6 else 0.0
    extra[root] = {'p': [0, rise + bounce, 0], 'r': [0, yaw, 0], 's': vs}
    bn, s0, a, d = u['body_lag']
    k = out_back(seg(ts, a, a + d), 1.1)
    extra[bn] = {'s': [s0[i] + (1 - s0[i]) * k for i in range(3)]}
    for bone, a, d, spec in u['parts']:
        k = seg(ts, a, a + d)
        ek = out_back(k, 1.3)
        e = {}
        if 's' in spec:
            s0 = spec['s']
            s0 = s0 if isinstance(s0, list) else [s0] * 3
            e['s'] = [max(0.001, s0[i] + (1 - s0[i]) * ek) for i in range(3)]
        r = [0, 0, 0]
        if 'r' in spec:
            r = [v * (1 - out_cubic(k)) for v in spec['r']]
        if 'spin' in spec:
            r = [r[i] + spec['spin'][i] * (1 - out_cubic(k)) for i in range(3)]
        e['r'] = r
        if 'p' in spec:
            e['p'] = [v * (1 - out_cubic(k)) for v in spec['p']]
        extra[bone] = e
    pose = merge_pose(base, extra)
    visible = ts >= 0.8
    return pose, set(mhide), visible


# ------------------------------------------------------------------ parçacıklar ve parıltı
COLS = [(122, 211, 183), (213, 242, 231), (43, 176, 143), (255, 244, 170)]


def tr_particles(ts, key, sc, core):
    out = []
    rnd = random.Random(17)
    # çekirdeğin etrafında dönen halka
    if 0.35 <= ts <= 1.2:
        k = seg(ts, 0.35, 1.2)
        a_in = smooth(seg(ts, 0.35, 0.5)) * (1 - smooth(seg(ts, 1.0, 1.2)))
        for i in range(40):
            a = rnd.uniform(0, 6.283) + ts * (5 + rnd.uniform(-1, 1))
            r = (16 - 10 * inout_cubic(k)) * rnd.uniform(0.8, 1.1)
            h = math.sin(a * 2 + i) * 3
            out.append({'pos': (core[0] + math.cos(a) * r, core[1] + h, core[2] + math.sin(a) * r),
                        'size': 1.6 + rnd.random(), 'color': COLS[i % 4], 'alpha': a_in})
    # araç açılırken dışa saçılan ışıklar
    if 0.95 <= ts <= 1.75:
        k = seg(ts, 0.95, 1.75)
        for i in range(34):
            a = rnd.uniform(0, 6.283)
            el = rnd.uniform(-0.3, 1.0)
            sp = rnd.uniform(16, 30)
            r = 3 + sp * out_cubic(k)
            out.append({'pos': (core[0] + math.cos(a) * r * math.cos(el), core[1] + math.sin(el) * r * 0.7 - 6 * k * k,
                                core[2] + math.sin(a) * r * math.cos(el)),
                        'size': 2.2 * (1 - k) + 0.8, 'color': COLS[(i + 1) % 4], 'alpha': 1 - k * k})
    # kilitlenmede toz ya da su halkası
    if 1.58 <= ts <= 2.0:
        k = seg(ts, 1.58, 2.0)
        kind = UNFOLD[key]['ground']
        gy = sc.get('ground_y', 0.0)
        for i in range(26):
            a = i / 26 * 6.283
            r = 14 + 14 * out_cubic(k)
            if kind == 'dust':
                col, y = (190, 170, 135), gy + 1 + 3 * k
            else:
                col, y = (236, 248, 252), gy + 1 + 4 * math.sin(math.pi * k)
            out.append({'pos': (core[0] + math.cos(a) * r, y, core[2] + math.sin(a) * r * 1.2),
                        'size': 2.4 * (1 - k) + 1, 'color': col, 'alpha': 0.85 * (1 - k)})
    return out


def glow(img, cam, core, amount, radius=70):
    if amount <= 0.01:
        return img
    S, _ = cam.proj(np.array([core], float))
    sx, sy = float(S[0][0]), float(S[0][1])
    w, h = img.size
    yy, xx = np.mgrid[0:h, 0:w]
    d2 = ((xx - sx) ** 2 + (yy - sy) ** 2) / (radius ** 2)
    g = np.exp(-d2 * 2.2)[..., None] * amount
    a = np.asarray(img, np.float32)
    col = np.array([190, 255, 238], np.float32)
    a = a + (255 - a) * g * (col / 255)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


# ------------------------------------------------------------------ kamera: robottan araca yumuşak geçiş
CAMS = {'ucak': dict(yaw=38, elev=20, scale=4.6, center=(0, 14, 9)),
        'gemi': dict(yaw=35, elev=24, scale=5.5, center=(0, 13, 0)),
        'denizalti': dict(yaw=35, elev=24, scale=4.8, center=(0, 13, 4)),
        'arazi': dict(yaw=35, elev=22, scale=6.6, center=(0, 12, 0)),
        'matkap': dict(yaw=35, elev=22, scale=6.0, center=(0, 12, -4))}


def cam_at(key, sc, k):
    """k=0: robota yakın, k=1: aracın kamerası."""
    c = CAMS[key]
    rs = min(8.6, c['scale'] * 1.6)
    rc = (0, sc['hover'] + 13, 0)
    sc_ = rs + (c['scale'] - rs) * k
    cen = tuple(a + (b - a) * k for a, b in zip(rc, c['center']))
    return Z.Cam(yaw=c['yaw'], elev=c['elev'], scale=sc_, size=KO.SIZE, center=cen)


def tr_frame(key, sc, core, ts):
    hover = sc['hover']
    rp, rv = robot_pose(ts, sc, core)
    vp, vh, vv = vehicle_pose(ts, key, sc)
    keys_ = (['robot'] if rv else []) + ([key] if vv else [])
    hide = set(vh)
    if not hover and not (0.18 <= ts <= 0.62):
        hide.add('k_flame')
    pose = {}
    if rv:
        pose.update(rp)
    if vv:
        pose.update(vp)
    cam = cam_at(key, sc, inout_cubic(seg(ts, 0.6, 1.6)))
    img = KO.render_frame(sc, keys_ or ['robot'], pose, {}, hide, sc['env']('idle', 0, 0),
                          tr_particles(ts, key, sc, core), cam)
    return glow(img, cam, core, 0.42 * math.exp(-((ts - 1.0) / 0.2) ** 2))


def prep(key):
    sc = KO.SCENES[key]()
    sc['ground_y'] = {'ucak': 0.0, 'arazi': 0.0, 'matkap': 0.0, 'gemi': 5.0, 'denizalti': 9.0}[key]
    return sc, vehicle_core(key, sc)


# ------------------------------------------------------------------ sahne kaydı
def frames_for(key):
    sc, core = prep(key)
    env, motion, hover = sc['env'], sc['motion'], sc['hover']
    frames = []
    flame_hide = set() if hover else {'k_flame'}
    n_idle, n_tr, n_mv = int(IDLE_S * FPS), int(TR_S * FPS), int(MOVE_S * FPS)
    cam0 = cam_at(key, sc, 0)
    for i in range(n_idle):
        t = i / n_idle
        rp = KO.robot_idle_pose(t, hover=hover + (math.sin(t * 6.283) * 0.8 if hover else 0))
        frames.append(KO.render_frame(sc, ['robot'], rp, {}, flame_hide, env('idle', t, 0), [], cam0))
    for i in range(n_tr):
        frames.append(tr_frame(key, sc, core, i / FPS))
    cam1 = cam_at(key, sc, 1)
    for i in range(n_mv):
        t = i / n_mv
        mpose, mh, rise, parts = motion(t)
        frames.append(KO.render_frame(sc, [key], {}, mpose, mh, env('fly' if key == 'ucak' else 'move', t, rise),
                                      parts, cam1))
    return frames


def audio_for(key, total):
    out = np.zeros(int(total * SR) + SR)

    def add(name, start, gain):
        sr, y = wavfile.read(os.path.join(WAV, name + '.wav'))
        y = y.astype(float) / 32767
        i = int(start * SR)
        if i >= len(out):
            return
        k = min(len(y), len(out) - i)
        out[i:i + k] += gain * y[:k]

    add('robot_ambient2', 0.25, 0.6)
    for n, st, g in TRANSFORM_CUES:
        add(n, IDLE_S + st, g)
    for n, st, g in ENGINE[key]:
        add(n, IDLE_S + st, g)
    out = out[:int(total * SR)]
    nf = int(0.25 * SR)
    out[-nf:] *= np.linspace(1, 0, nf)
    return out / max(1e-6, np.abs(out).max()) * 0.9


def export(key):
    fr = frames_for(key)
    gp = os.path.join(OUT, f'kesif_donusum_{key}.gif')
    total = len(fr) / FPS
    tmp = tempfile.mkdtemp(dir=os.environ.get('TMPDIR'))
    for i, f in enumerate(fr):
        f.save(os.path.join(tmp, f'f{i:04d}.png'))
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', str(FPS), '-i', os.path.join(tmp, 'f%04d.png'),
                    '-vf', 'split[a][b];[a]palettegen=max_colors=160:stats_mode=full[p];'
                           '[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
                    '-loop', '0', gp], check=True)
    wavfile.write(os.path.join(tmp, 'a.wav'), SR, (audio_for(key, total) * 32767).astype(np.int16))
    mp = os.path.join(OUT, f'kesif_donusum_{key}.mp4')
    w, h = fr[0].size
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(tmp, 'f%04d.png'),
                    '-i', os.path.join(tmp, 'a.wav'), '-vf', f'scale={w * 2}:{h * 2}:flags=lanczos',
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '160k',
                    '-shortest', '-movflags', '+faststart', mp], check=True)
    return gp, mp, len(fr)


if __name__ == '__main__':
    ks = sys.argv[1:] or ['ucak', 'gemi', 'denizalti', 'arazi', 'matkap']
    for k in ks:
        gp, mp, n = export(k)
        print(k, n, 'kare', f'gif {os.path.getsize(gp) / 1e6:.1f} MB', f'mp4 {os.path.getsize(mp) / 1e6:.1f} MB')
