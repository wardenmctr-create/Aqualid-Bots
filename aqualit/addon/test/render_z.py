"""Bedrock geometrisi için derinlik tamponlu (z-buffer) yazılımsal çizici.

render3d.py ile aynı kemik/UV kurallarını kullanır, ama:
- iç içe geçen kutular doğru görünür (her piksel için derinlik testi),
- kemiklere dönüş + konum + ölçek verilebilir (animasyon kareleri için),
- ışıyan pikseller (glow dokusu) gölgelenmez,
- isteğe bağlı yer gölgesi ve su yüzeyi.

poz: {kemik: [rx, ry, rz]} ya da {kemik: {'r': [..], 'p': [..], 's': k ya da [sx, sy, sz]}}
Kamera: yaw (derece, Y ekseni etrafında), elev (derece, yukarıdan bakış pozitif).
Model önü dosya koordinatında -Z'dir; yaw=0 iken model kameraya bakar.
"""
import math
import numpy as np
from PIL import Image, ImageFilter


def rotm(rx, ry, rz):
    ax, ay, az = (math.radians(a) for a in (rx, ry, rz))
    cx, sx = math.cos(ax), math.sin(ax)
    cy, sy = math.cos(ay), math.sin(ay)
    cz, sz = math.cos(az), math.sin(az)
    Rx = np.array([[1, 0, 0], [0, cx, sx], [0, -sx, cx]])
    Ry = np.array([[cy, 0, -sy], [0, 1, 0], [sy, 0, cy]])
    Rz = np.array([[cz, sz, 0], [-sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def _aff(M=None, t=None):
    A = np.eye(4)
    if M is not None:
        A[:3, :3] = M
    if t is not None:
        A[:3, 3] = t
    return A


def bone_mats(bones, pose):
    by = {b['name']: b for b in bones}
    cache = {}

    def mat(name):
        if name in cache:
            return cache[name]
        b = by[name]
        piv = np.array(b.get('pivot', [0, 0, 0]), float)
        base_r = b.get('rotation', [0, 0, 0])
        pz = pose.get(name)
        r, p, s = [0, 0, 0], [0, 0, 0], [1, 1, 1]
        if isinstance(pz, (list, tuple)):
            r = list(pz)
        elif isinstance(pz, dict):
            r = list(pz.get('r', [0, 0, 0]))
            p = list(pz.get('p', [0, 0, 0]))
            sc = pz.get('s', 1)
            s = list(sc) if isinstance(sc, (list, tuple)) else [sc, sc, sc]
        R = rotm(base_r[0] + r[0], base_r[1] + r[1], base_r[2] + r[2])
        S = np.diag(s)
        local = _aff(t=piv + np.array(p, float)) @ _aff(R @ S) @ _aff(t=-piv)
        par = b.get('parent')
        M = (mat(par) if par in by else np.eye(4)) @ local
        cache[name] = M
        return M
    return {n: mat(n) for n in by}


def faces_of(c):
    (ox, oy, oz), (w, h, d) = c['origin'], c['size']
    inf = c.get('inflate', 0) or 0
    x0, y0, z0, x1, y1, z1 = ox - inf, oy - inf, oz - inf, ox + w + inf, oy + h + inf, oz + d + inf
    uv = c['uv']
    if isinstance(uv, list):
        u, v = uv
        W, H, D = (int(round(s)) for s in c['size'])
        reg = {'up': (u + D, v, W, D), 'down': (u + D + W, v, W, D), 'east': (u, v + D, D, H),
               'north': (u + D, v + D, W, H), 'west': (u + D + W, v + D, D, H), 'south': (u + 2 * D + W, v + D, W, H)}
        if c.get('mirror'):
            reg = {k: (ru + rw, rv, -rw, rh) for k, (ru, rv, rw, rh) in reg.items()}
            reg['east'], reg['west'] = reg['west'], reg['east']
    else:
        reg = {k: (val['uv'][0], val['uv'][1], val['uv_size'][0], val['uv_size'][1]) for k, val in uv.items()}
    corners = {
        'north': [(x1, y1, z0), (x0, y1, z0), (x0, y0, z0), (x1, y0, z0)],
        'south': [(x0, y1, z1), (x1, y1, z1), (x1, y0, z1), (x0, y0, z1)],
        'east': [(x1, y1, z1), (x1, y1, z0), (x1, y0, z0), (x1, y0, z1)],
        'west': [(x0, y1, z0), (x0, y1, z1), (x0, y0, z1), (x0, y0, z0)],
        'up': [(x1, y1, z1), (x0, y1, z1), (x0, y1, z0), (x1, y1, z0)],
        'down': [(x1, y0, z0), (x0, y0, z0), (x0, y0, z1), (x1, y0, z1)],
    }
    return [(k, reg[k], corners[k]) for k in corners if k in reg]


class Cam:
    def __init__(self, yaw=30, elev=22, scale=8, size=(480, 360), center=(0, 0, 0), shift=(0, 0)):
        self.V = rotm(elev, 0, 0) @ rotm(0, yaw, 0)
        self.scale, self.size = scale, size
        c = self.V @ np.array(center, float)
        self.cx = size[0] / 2 - (-c[0]) * scale + shift[0]
        self.cy = size[1] / 2 + c[1] * scale + shift[1]

    def proj(self, P):
        """P: (n,3) dünya -> (n,2) ekran, (n,) derinlik (küçük = yakın)."""
        v = P @ self.V.T
        sx = self.cx + (-v[:, 0]) * self.scale
        sy = self.cy - v[:, 1] * self.scale
        return np.stack([sx, sy], 1), v[:, 2]

    def view_dir_world(self):
        return self.V.T @ np.array([0, 0, 1.0])


LIGHT = np.array([0.45, 0.85, -0.35])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def render(geo, tex, pose=None, hidden=(), cam=None, glow=None, bg=(24, 28, 32), ss=2, shadow=True,
           water=None, ground=None, only=None, bg_image=None, shadow_alpha=0.45):
    """water: {'y': su seviyesi (piksel), 'color': (r,g,b), 'alpha': 0..1}
    ground: {'y': 0, 'color': (r,g,b)} düz zemin rengi (gölge onun üstüne)
    only: yalnızca bu kemiklerin (ve çocuklarının) çizilmesi"""
    pose = pose or {}
    cam = cam or Cam()
    W, H = cam.size[0] * ss, cam.size[1] * ss
    cam2 = Cam.__new__(Cam)
    cam2.V, cam2.scale, cam2.size = cam.V, cam.scale * ss, (W, H)
    cam2.cx, cam2.cy = cam.cx * ss, cam.cy * ss
    bones = geo['minecraft:geometry'][0]['bones']
    by = {b['name']: b for b in bones}
    mats = bone_mats(bones, pose)
    T = np.asarray(tex.convert('RGBA'), dtype=np.float32)
    Gl = np.asarray(glow.convert('RGBA'))[:, :, 3] > 0 if glow is not None else None
    th, tw = T.shape[:2]
    img = np.zeros((H, W, 3), np.float32)
    img[:, :] = bg
    if bg_image is not None:
        img[:, :] = np.asarray(bg_image.convert('RGB').resize((W, H), Image.BILINEAR), np.float32)
    zbuf = np.full((H, W), np.inf, np.float32)

    def hidden_bone(n):
        while n:
            if n in hidden:
                return True
            n = by[n].get('parent')
        return False

    def wanted(n):
        if only is None:
            return True
        while n:
            if n in only:
                return True
            n = by[n].get('parent')
        return False

    vdir = cam.view_dir_world()
    shadow_pts = []
    face_list = []
    for b in bones:
        if hidden_bone(b['name']) or not wanted(b['name']) or b.get('neverRender'):
            continue
        M = mats[b['name']]
        # kemik ölçeği ~0 ise atla
        if abs(np.linalg.det(M[:3, :3])) < 1e-6:
            continue
        for c in b.get('cubes', []):
            CM = M
            if c.get('rotation'):
                cp = np.array(c.get('pivot', [0, 0, 0]), float)
                CM = M @ _aff(t=cp) @ _aff(rotm(*c['rotation'])) @ _aff(t=-cp)
            for face, (u, v, fw, fh), cs in faces_of(c):
                if fw == 0 or fh == 0:
                    continue
                P = np.array([list(p) + [1] for p in cs], float) @ CM.T
                P = P[:, :3]
                n = np.cross(P[1] - P[0], P[3] - P[0])
                ln = np.linalg.norm(n)
                if ln < 1e-9:
                    continue
                n = n / ln
                # dışa bakan normal: köşe sırası dışarıdan saat yönü -> (P1-P0)x(P3-P0) içeri bakar
                n = -n
                if np.dot(n, vdir) >= 0:
                    continue
                face_list.append((P, n, u, v, fw, fh))
                if shadow:
                    shadow_pts.append(P)
    # zemin ve gölge
    if ground is not None or shadow:
        gy = (ground or {}).get('y', 0)
        if ground is not None:
            _plane(img, zbuf, cam2, gy, ground['color'], ground.get('alpha', 1.0), pattern=ground.get('pattern'),
                   off=ground.get('off', (0, 0)))
            zbuf[:, :] = np.inf
        if shadow and shadow_pts:
            sh = Image.new('L', (W, H), 0)
            from PIL import ImageDraw
            dd = ImageDraw.Draw(sh)
            for P in shadow_pts:
                Q = P.copy()
                Q[:, 1] = gy
                s2, _ = cam2.proj(Q)
                dd.polygon([tuple(p) for p in s2], fill=255)
            sh = sh.filter(ImageFilter.GaussianBlur(4 * ss))
            a = np.asarray(sh, np.float32)[:, :, None] / 255.0 * shadow_alpha
            img = img * (1 - a)
    for P, n, u, v, fw, fh in face_list:
        S, D = cam2.proj(P)
        x0, x1 = int(max(0, math.floor(S[:, 0].min()))), int(min(W - 1, math.ceil(S[:, 0].max())))
        y0, y1 = int(max(0, math.floor(S[:, 1].min()))), int(min(H - 1, math.ceil(S[:, 1].max())))
        if x1 < x0 or y1 < y0:
            continue
        A = S[1] - S[0]
        Bv = S[3] - S[0]
        det = A[0] * Bv[1] - A[1] * Bv[0]
        if abs(det) < 1e-9:
            continue
        ys, xs = np.mgrid[y0:y1 + 1, x0:x1 + 1]
        px = xs + 0.5 - S[0][0]
        py = ys + 0.5 - S[0][1]
        s = (px * Bv[1] - py * Bv[0]) / det
        t = (A[0] * py - A[1] * px) / det
        m = (s >= 0) & (s < 1) & (t >= 0) & (t < 1)
        if not m.any():
            continue
        aw, ah = abs(fw), abs(fh)
        ix = np.clip(np.floor(s * aw).astype(int), 0, aw - 1)
        iy = np.clip(np.floor(t * ah).astype(int), 0, ah - 1)
        tx = (u + ix) if fw > 0 else (u - 1 - ix)
        ty = (v + iy) if fh > 0 else (v - 1 - iy)
        tx = np.clip(tx, 0, tw - 1).astype(int)
        ty = np.clip(ty, 0, th - 1).astype(int)
        col = T[ty, tx]
        m &= col[:, :, 3] > 0
        depth = D[0] + s * (D[1] - D[0]) + t * (D[3] - D[0])
        zr = zbuf[y0:y1 + 1, x0:x1 + 1]
        m &= depth < zr - 1e-4
        if not m.any():
            continue
        lam = 0.58 + 0.42 * max(0.0, float(np.dot(n, LIGHT)))
        if n[1] < -0.5:
            lam *= 0.75
        rgb = col[:, :, :3] * lam
        if Gl is not None:
            g = Gl[ty, tx]
            rgb = np.where(g[:, :, None], np.minimum(255, col[:, :, :3] * 1.08 + 10), rgb)
        reg = img[y0:y1 + 1, x0:x1 + 1]
        reg[m] = rgb[m]
        zr[m] = depth[m]
    if water is not None:
        _water(img, zbuf, cam2, water)
    out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB')
    if ss > 1:
        out = out.resize(cam.size, Image.LANCZOS)
    return out


def _plane_coords(cam, y):
    """Ekrandaki her piksel için y düzlemindeki (x, z) ve derinlik."""
    W, H = cam.size
    # dünya (x, y, z) -> ekran: doğrusal. x ve z için 2x2 çöz.
    o = np.array([[0, y, 0], [1, y, 0], [0, y, 1]], float)
    s, d = cam.proj(o)
    ex, ez = s[1] - s[0], s[2] - s[0]
    det = ex[0] * ez[1] - ex[1] * ez[0]
    ys, xs = np.mgrid[0:H, 0:W]
    px = xs + 0.5 - s[0][0]
    py = ys + 0.5 - s[0][1]
    X = (px * ez[1] - py * ez[0]) / det
    Z = (ex[0] * py - ex[1] * px) / det
    depth = d[0] + X * (d[1] - d[0]) + Z * (d[2] - d[0])
    return X, Z, depth


def _plane(img, zbuf, cam, y, color, alpha, pattern=None, off=(0, 0)):
    X, Z, depth = _plane_coords(cam, y)
    X = X + off[0]
    Z = Z + off[1]
    col = np.array(color, np.float32)
    if pattern == 'grass':
        k = ((np.floor(X / 4) + np.floor(Z / 4)) % 2)[..., None]
        c = col * (0.94 + 0.06 * k)
    elif pattern == 'sand':
        k = ((np.floor(X / 3) * 7 + np.floor(Z / 3) * 13) % 5)[..., None]
        c = col * (0.95 + 0.02 * k)
    elif pattern == 'dirt':
        k = ((np.floor(X / 4) * 3 + np.floor(Z / 4) * 5) % 4)[..., None]
        c = col * (0.9 + 0.05 * k)
    elif pattern == 'stone':
        k = ((np.floor(X / 4) * 11 + np.floor(Z / 4) * 7) % 3)[..., None]
        c = col * (0.92 + 0.06 * k)
    else:
        c = np.broadcast_to(col, img.shape)
    img[:, :] = img * (1 - alpha) + c * alpha
    zbuf[:, :] = np.minimum(zbuf, depth)


def _water(img, zbuf, cam, w):
    X, Z, depth = _plane_coords(cam, w['y'])
    X = X + w.get('off', (0, 0))[0]
    Z = Z + w.get('off', (0, 0))[1]
    col = np.array(w.get('color', (34, 110, 150)), np.float32)
    a = w.get('alpha', 0.55)
    wave = (np.sin(X * 0.35 + np.sin(Z * 0.21) * 2 + w.get('phase', 0)) * 0.5 + 0.5)[..., None]
    c = col * (0.9 + 0.18 * wave)
    front = depth < zbuf
    blend = img * (1 - a) + c * a
    img[front] = blend[front]
    # ön kenarda köpük çizgisi (modelin su yüzeyini kestiği yerler)
    near = (np.abs(depth - zbuf) < 1.2)
    img[near & front] = img[near & front] * 0.4 + np.array([230, 248, 250]) * 0.6


def gif(frames, path, ms=50):
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=ms, loop=0, optimize=True, disposal=2)
    return path
