"""Keşif Robotu araçlarının tasarım kartları ve animasyonlu GIF'leri.
Her GIF: robot bekler -> dönüşür -> araç kendi hareketini yapar (döngü)."""
import math
import random
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'addon', 'test'))
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402
import kesif as K  # noqa: E402
import render_z as Z  # noqa: E402

GEO, TEX, GLOW = K.build(W=512)
FORMS = K.all_forms()
OUT = K.OUT
SIZE = (460, 340)
FPS_MS = 50


def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def back_out(x, k=1.7):
    x = max(0.0, min(1.0, x))
    x -= 1
    return x * x * ((k + 1) * x + k) + 1


def hidden_for(keys, extra=()):
    roots = {fm.order[0] for fm in FORMS.values() if fm.key not in keys}
    return roots | set(extra)


def sky(size, off=0.0, clouds=True):
    w, h = size
    img = Image.new('RGB', size)
    d = ImageDraw.Draw(img)
    for y in range(h):
        k = y / h
        d.line([(0, y), (w, y)], fill=(int(120 + 70 * k), int(186 + 40 * k), int(238 + 10 * k)))
    if clouds:
        rnd = random.Random(7)
        for i in range(9):
            cx = (rnd.uniform(0, w * 1.6) + off * (0.6 + 0.4 * (i % 3))) % (w * 1.6) - w * 0.3
            cy = rnd.uniform(20, h * 0.75)
            s = rnd.uniform(0.6, 1.3)
            for (dx, dy, rw, rh) in ((0, 0, 46, 14), (14, -9, 30, 14), (-16, -4, 24, 10), (26, 2, 26, 10)):
                x0, y0 = cx + dx * s, cy + dy * s
                d.rectangle([x0, y0, x0 + rw * s, y0 + rh * s], fill=(246, 250, 252))
            d.rectangle([cx - 14 * s, cy + 10 * s, cx + 52 * s, cy + 14 * s], fill=(222, 232, 240))
    return img


def draw_particles(img, cam, parts):
    if not parts:
        return img
    ov = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    P = np.array([p['pos'] for p in parts], float)
    S, _ = cam.proj(P)
    for (sx, sy), p in zip(S, parts):
        r = p.get('size', 3)
        a = int(255 * max(0, min(1, p.get('alpha', 1))))
        c = tuple(p.get('color', (255, 255, 255))) + (a,)
        d.rectangle([sx - r, sy - r, sx + r, sy + r], fill=c)
    base = img.convert('RGBA')
    base.alpha_composite(ov)
    return base.convert('RGB')


def flash(img, a):
    if a <= 0:
        return img
    w = Image.new('RGB', img.size, (225, 255, 248))
    return Image.blend(img, w, min(0.6, a))


# ------------------------------------------------------------------ dönüşüm
def robot_idle_pose(t, hover=0.0):
    return {'k_radar': [0, t * 720, 0],
            'k_scarf_tail': [math.sin(t * 6.283 * 2) * 10, 0, math.sin(t * 6.283) * 6],
            'root': {'p': [0, hover + math.sin(t * 6.283) * 0.3, 0]},
            'right_arm': [0, 0, 3 + math.sin(t * 6.283) * 2], 'left_arm': [0, 0, -3 - math.sin(t * 6.283) * 2]}


def transform_poses(t, vroot, hover=0.0):
    """t: 0..1. Robot çömelir, gözlük iner, zıplayıp döner ve küçülür; araç dönerek büyür."""
    rp = {}
    e1 = ease(t / 0.2)
    rp['k_goggles'] = {'p': [0, -6 * e1, 0]}
    rp['k_radar'] = [0, t * 900, 0]
    jump = math.sin(math.pi * max(0, min(1, (t - 0.2) / 0.45))) * 9 if t > 0.2 else 0
    crouch = -1.5 * e1 * (1 - ease((t - 0.2) / 0.1))
    spin = 540 * ease((t - 0.2) / 0.45)
    s = 1 - ease((t - 0.38) / 0.25)
    rp['root'] = {'p': [0, hover + crouch + jump + (1 - s) * 9, 0], 'r': [0, spin, 0], 's': max(0.001, s)}
    rp['right_arm'] = [0, 0, 40 * ease((t - 0.15) / 0.2)]
    rp['left_arm'] = [0, 0, -40 * ease((t - 0.15) / 0.2)]
    vp = {}
    g = (t - 0.45) / 0.45
    vs = back_out(g) if g > 0 else 0
    vp[vroot] = {'s': max(0.001, vs), 'r': [0, -200 * (1 - ease(g)), 0], 'p': [0, 7 * (1 - ease(g)), 0]}
    robot_visible = s > 0.002
    vehicle_visible = vs > 0.002
    return rp, vp, robot_visible, vehicle_visible


def sparkles(t, center, n=46, seed=3):
    if not (0.36 <= t <= 0.95):
        return []
    rnd = random.Random(seed)
    k = (t - 0.36) / 0.59
    out = []
    for i in range(n):
        a = rnd.uniform(0, 6.283)
        el = rnd.uniform(-0.4, 1.0)
        sp = rnd.uniform(14, 30)
        r = sp * ease(k * 1.3)
        pos = (center[0] + math.cos(a) * r * math.cos(el), center[1] + math.sin(el) * r * 0.8 + 4 * k,
               center[2] + math.sin(a) * r * math.cos(el))
        col = [(122, 211, 183), (213, 242, 231), (43, 176, 143), (255, 244, 170)][i % 4]
        out.append({'pos': pos, 'size': 2.4 * (1 - k) + 1, 'color': col, 'alpha': 1 - k ** 2})
    return out


# ------------------------------------------------------------------ sahneler
SCENES = {}


def scene(key):
    def deco(fn):
        SCENES[key] = fn
        return fn
    return deco


def common_vehicle(key):
    return dict(cam=Z.Cam(yaw=35, elev=22, scale=6.0, size=SIZE, center=(0, 13, 0)))


@scene('ucak')
def sc_ucak():
    cam = Z.Cam(yaw=38, elev=20, scale=4.6, size=SIZE, center=(0, 14, 9))

    def env(phase, t, rise):
        off = t * 120 if phase == 'fly' else 0
        bg = sky(SIZE, off=off)
        gr = {'y': -rise, 'color': (104, 162, 76), 'pattern': 'grass', 'alpha': max(0.0, 1 - rise / 30),
              'off': (0, -rise * 3)}
        return dict(bg_image=bg, ground=gr, shadow_alpha=max(0.0, 0.45 - rise / 50))

    def motion(t):
        rise = 22 * ease(t / 0.35)
        bank = math.sin((t - 0.25) * 6.283) * 20 if t > 0.25 else 0
        gear = ease((t - 0.15) / 0.25)
        pose = {'u_prop': [0, 0, t * 2600],
                'u_root': {'p': [0, rise, 0], 'r': [-6 * ease(t / 0.3) + 6 * ease((t - 0.4) / 0.2), 0, bank]},
                'u_ail_l': [bank * 0.9, 0, 0], 'u_ail_r': [-bank * 0.9, 0, 0],
                'u_elev': [-12 * ease(t / 0.3) + 12 * ease((t - 0.4) / 0.2), 0, 0],
                'u_rudder': [0, bank * 0.5, 0],
                'u_gear_l': [0, 0, -100 * gear], 'u_gear_r': [0, 0, 100 * gear],
                'u_scarf': [math.sin(t * 40) * 8, math.sin(t * 25) * 14, 0],
                'u_flame': {'s': [1, 1, 0.8 + 0.4 * abs(math.sin(t * 90))]}}
        hide = set() if 0.1 < t < 0.6 else {'u_flame'}
        return pose, hide, rise, []
    return dict(cam=cam, env=env, motion=motion, root='u_root', hover=0.0, center=(0, 10, 0))


@scene('gemi')
def sc_gemi():
    cam = Z.Cam(yaw=35, elev=24, scale=5.5, size=SIZE, center=(0, 13, 0))

    def env(phase, t, rise):
        return dict(water={'y': 5, 'off': (0, t * 50 if phase == 'move' else 0), 'phase': t * 6}, bg=(24, 70, 100))

    def motion(t):
        w = t * 6.283
        pose = {'g_root': {'p': [0, math.sin(w * 2) * 0.6, 0], 'r': [math.sin(w * 2 + 1) * 1.5, 0, math.sin(w) * 3]},
                'g_flag': [0, math.sin(w * 4) * 22, 0], 'g_radar': [0, t * 720, 0], 'g_screw': [0, 0, t * 1800]}
        parts = []
        rnd = random.Random(11)
        for i in range(10):
            k = (t * 2 + i / 10) % 1
            parts.append({'pos': (rnd.uniform(-1, 1) + k * 2, 27 + k * 14, 16 + k * 8), 'size': 2 + k * 4,
                          'color': (226, 230, 232), 'alpha': 0.9 * (1 - k)})
        for i in range(14):
            k = (t * 3 + i / 14) % 1
            sgn = 1 if i % 2 else -1
            parts.append({'pos': (sgn * (4 + k * 10), 5.2, -32 + k * 16), 'size': 2.2 * (1 - k) + 0.8,
                          'color': (236, 248, 250), 'alpha': 1 - k})
        return pose, set(), 0, parts
    return dict(cam=cam, env=env, motion=motion, root='g_root', hover=7.0, center=(0, 12, 0))


@scene('denizalti')
def sc_denizalti():
    cam = Z.Cam(yaw=35, elev=24, scale=4.8, size=SIZE, center=(0, 13, 4))

    def env(phase, t, rise):
        return dict(water={'y': 9, 'off': (0, t * 30 if phase == 'move' else 0), 'phase': t * 6, 'alpha': 0.62},
                    bg=(20, 60, 92))

    def motion(t):
        w = t * 6.283
        dive = ease((t - 0.55) / 0.35)
        pose = {'d_root': {'p': [0, -16 * dive + math.sin(w * 2) * 0.4 * (1 - dive), 0],
                           'r': [6 * math.sin(math.pi * dive), 0, math.sin(w) * 2 * (1 - dive)]},
                'd_prop': [0, 0, t * 2200], 'd_radar': [0, t * 720, 0],
                'd_scope': {'p': [0, -7 * ease((t - 0.45) / 0.15), 0], 'r': [0, math.sin(w * 1.5) * 60, 0]},
                'd_flag': [0, math.sin(w * 4) * 20, 0],
                'd_plane_l': [10 * math.sin(math.pi * dive), 0, 0], 'd_plane_r': [10 * math.sin(math.pi * dive), 0, 0]}
        parts = []
        rnd = random.Random(5)
        if t > 0.5:
            for i in range(26):
                k = (t * 2.5 + i / 26) % 1
                parts.append({'pos': (rnd.uniform(-9, 9), 2 + k * 14 - 16 * dive, rnd.uniform(-30, 30) + k * 4),
                              'size': 1.4 + rnd.random() * 1.4, 'color': (210, 240, 255), 'alpha': 0.85 * (1 - k)})
        return pose, set(), 0, parts
    return dict(cam=cam, env=env, motion=motion, root='d_root', hover=8.0, center=(0, 14, 0))


@scene('arazi')
def sc_arazi():
    cam = Z.Cam(yaw=35, elev=22, scale=6.6, size=SIZE, center=(0, 12, 0))

    def env(phase, t, rise):
        off = (0, -t * 140) if phase == 'move' else (0, 0)
        return dict(ground={'y': 0, 'color': (110, 162, 78), 'pattern': 'grass', 'off': off}, bg=(150, 198, 236))

    def motion(t):
        w = t * 6.283
        ang = t * 1440
        pose = {f'a_wheel_{n}': [ang, 0, 0] for n in ('fl', 'fr', 'bl', 'br')}
        st = math.sin(w) * 14
        pose['a_steer_fl'] = [0, st, 0]
        pose['a_steer_fr'] = [0, st, 0]
        pose['a_body'] = {'p': [0, abs(math.sin(w * 4)) * 0.7, 0], 'r': [math.sin(w * 4) * 1.2, 0, -st * 0.12]}
        pose['a_flag'] = [0, math.sin(w * 5) * 25, 0]
        pose['a_radar'] = [0, t * 720, 0]
        parts = []
        rnd = random.Random(9)
        for i in range(22):
            k = (t * 3 + i / 22) % 1
            sgn = 1 if i % 2 else -1
            parts.append({'pos': (sgn * 13 + rnd.uniform(-3, 3), 1 + k * 7, 20 + k * 16), 'size': 1.5 + k * 3.5,
                          'color': (168, 140, 100), 'alpha': 0.8 * (1 - k)})
        return pose, set(), 0, parts
    return dict(cam=cam, env=env, motion=motion, root='a_root', hover=0.0, center=(0, 10, 0))


@scene('matkap')
def sc_matkap():
    cam = Z.Cam(yaw=35, elev=22, scale=6.0, size=SIZE, center=(0, 12, -4))

    def env(phase, t, rise):
        off = (0, -t * 40) if phase == 'move' else (0, 0)
        return dict(ground={'y': 0, 'color': (118, 116, 120), 'pattern': 'stone', 'off': off}, bg=(64, 70, 80))

    def motion(t):
        w = t * 6.283
        rnd = random.Random(int(t * 1000))
        pose = {'m_drill': [0, 0, t * 2880], 'm_radar': [0, t * 720, 0],
                'm_body': {'p': [rnd.uniform(-0.15, 0.15), abs(math.sin(w * 12)) * 0.25, 0]}}
        for side in 'lr':
            for i in range(3):
                pose[f'm_rw_{side}{i}'] = [t * 720, 0, 0]
        parts = []
        r2 = random.Random(4)
        for i in range(30):
            k = (t * 3 + i / 30) % 1
            a = r2.uniform(0, 6.283)
            sp = r2.uniform(8, 18)
            parts.append({'pos': (math.cos(a) * sp * k, 11 + math.sin(a) * sp * k * 0.8 + 6 * k - 10 * k * k, -32 + k * 8),
                          'size': 1.6 + r2.random() * 1.6,
                          'color': [(138, 138, 138), (104, 104, 104), (122, 122, 122), (90, 90, 90)][i % 4],
                          'alpha': 1 - k * 0.6})
        for i in range(8):
            k = (t * 2 + i / 8) % 1
            sgn = 1 if i % 2 else -1
            parts.append({'pos': (sgn * 6.5, 28 + k * 12, 14.5 + k * 6), 'size': 2 + k * 3, 'color': (90, 94, 98),
                          'alpha': 0.75 * (1 - k)})
        return pose, set(), 0, parts
    return dict(cam=cam, env=env, motion=motion, root='m_root', hover=0.0, center=(0, 10, 0))


def render_frame(sc, keys, rpose, vpose, extra_hide, env_kw, parts, cam):
    pose = dict(rpose)
    pose.update(vpose)
    hide = hidden_for(keys, extra_hide)
    kw = dict(env_kw)
    img = Z.render(GEO, TEX, pose, hide, cam, glow=GLOW, **kw)
    return draw_particles(img, cam, parts)


def animate(key, n_idle=10, n_tr=26, n_move=44):
    sc = SCENES[key]()
    cam, env, motion, vroot, hover = sc['cam'], sc['env'], sc['motion'], sc['root'], sc['hover']
    frames = []
    flame_hide = set() if hover else {'k_flame'}
    for i in range(n_idle):
        t = i / n_idle
        rp = robot_idle_pose(t, hover=hover + (math.sin(t * 6.283) * 0.8 if hover else 0))
        frames.append(render_frame(sc, ['robot'], rp, {}, flame_hide, env('idle', t, 0), [], cam))
    for i in range(n_tr):
        t = i / (n_tr - 1)
        rp, vp, rv, vv = transform_poses(t, vroot, hover=hover)
        mpose, mh, rise, _ = motion(0)
        vp2 = dict(mpose)
        base = vp2.get(vroot, {})
        tv = vp[vroot]
        if isinstance(base, dict):
            tv = dict(tv)
            tv['p'] = [a + b for a, b in zip(tv['p'], base.get('p', [0, 0, 0]))]
        vp2[vroot] = tv
        keys = (['robot'] if rv else []) + ([key] if vv else [])
        hide = set(mh) | ({'k_flame'} if not hover and t < 0.2 else set())
        img = render_frame(sc, keys or ['robot'], rp, vp2 if vv else {}, hide, env('idle', 0, 0),
                           sparkles(t, (0, 10 + hover, 0)), cam)
        frames.append(flash(img, 0.5 * math.exp(-((t - 0.52) / 0.06) ** 2)))
    for i in range(n_move):
        t = i / n_move
        mpose, mh, rise, parts = motion(t)
        frames.append(render_frame(sc, [key], {}, mpose, mh, env('fly' if key == 'ucak' else 'move', t, rise), parts, cam))
    return frames


def card_views(key):
    sc = SCENES[key]()
    env = sc['env']('idle', 0, 0)
    env.pop('bg_image', None) if key == 'ucak' else None
    cams = [Z.Cam(yaw=35, elev=22, scale=sc['cam'].scale, size=SIZE, center=sc['cam'].center if hasattr(sc['cam'], 'center') else (0, 12, 0)),
            ]
    return env


if __name__ == '__main__':
    import os
    keys = sys.argv[1:] or list(SCENES)
    for k in keys:
        fr = animate(k)
        p = f'{OUT}/kesif_{k}.gif'
        Z.gif(fr, p, ms=FPS_MS)
        print(k, len(fr), os.path.getsize(p) // 1024, 'KB')
