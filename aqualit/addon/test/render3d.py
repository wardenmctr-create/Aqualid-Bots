"""Bedrock geometrisi için küçük yazılımsal 3B çizici (kemik dönüşleri + yüz başına / kutu UV).
Her doku pikseli bir dörtgen olarak çizilir, ressam algoritmasıyla sıralanır."""
import math
from PIL import Image, ImageDraw


def rot_matrix(rx, ry, rz):
    # Bedrock kuralı (kanıt: bakır golem animasyonları): +X dönüşü üstü öne (-Z) eğer.
    ax, ay, az = (math.radians(a) for a in (rx, ry, rz))
    cx, sx = math.cos(ax), math.sin(ax)
    cy, sy = math.cos(ay), math.sin(ay)
    cz, sz = math.cos(az), math.sin(az)
    Rx = [[1, 0, 0], [0, cx, sx], [0, -sx, cx]]
    Ry = [[cy, 0, -sy], [0, 1, 0], [sy, 0, cy]]
    Rz = [[cz, sz, 0], [-sz, cz, 0], [0, 0, 1]]

    def mm(A, B):
        return [[sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
    return mm(Rz, mm(Ry, Rx))


def apply(M, v):
    return [sum(M[i][k] * v[k] for k in range(3)) for i in range(3)]


def bone_transforms(bones, rotations):
    """Her kemik için noktayı dünya koordinatına çeviren fonksiyon."""
    by = {b['name']: b for b in bones}
    cache = {}

    def tf(name):
        if name in cache:
            return cache[name]
        b = by[name]
        r = rotations.get(name, b.get('rotation', [0, 0, 0]))
        M = rot_matrix(*r)
        piv = b.get('pivot', [0, 0, 0])
        parent = b.get('parent')
        ptf = tf(parent) if parent and parent in by else (lambda p: p)

        def f(p, M=M, piv=piv, ptf=ptf):
            q = [p[i] - piv[i] for i in range(3)]
            q = apply(M, q)
            q = [q[i] + piv[i] for i in range(3)]
            return ptf(q)
        cache[name] = f
        return f
    return tf


def face_regions(c, down=False):
    """Yüz adı -> (u, v, w, h, köşe sırası) ; kutu UV ya da yüz başına UV."""
    (ox, oy, oz), (w, h, d) = c['origin'], c['size']
    inf = c.get('inflate', 0) or 0
    x0, y0, z0, x1, y1, z1 = ox - inf, oy - inf, oz - inf, ox + w + inf, oy + h + inf, oz + d + inf
    uv = c['uv']
    if isinstance(uv, list):
        u, v = uv
        W, H, D = (round(s) for s in c.get('_uvsize', c['size']))
        reg = {'up': (u + D, v, W, D), 'east': (u, v + D, D, H), 'north': (u + D, v + D, W, H),
               'west': (u + D + W, v + D, D, H), 'south': (u + 2 * D + W, v + D, W, H)}
        if down:
            reg['down'] = (u + D + W, v, W, D)
        if c.get('mirror'):
            reg = {k: (ru + rw, rv, -rw, rh) for k, (ru, rv, rw, rh) in reg.items()}
            reg['east'], reg['west'] = reg['west'], reg['east']
    else:
        reg = {k: (val['uv'][0], val['uv'][1], val['uv_size'][0], val['uv_size'][1]) for k, val in uv.items() if k != 'down'}
    # köşeler: sol-üst, sağ-üst, sağ-alt, sol-alt (dışarıdan bakınca)
    corners = {
        'north': [(x1, y1, z0), (x0, y1, z0), (x0, y0, z0), (x1, y0, z0)],
        'south': [(x0, y1, z1), (x1, y1, z1), (x1, y0, z1), (x0, y0, z1)],
        'east': [(x1, y1, z1), (x1, y1, z0), (x1, y0, z0), (x1, y0, z1)],
        'west': [(x0, y1, z0), (x0, y1, z1), (x0, y0, z1), (x0, y0, z0)],
        'up': [(x1, y1, z1), (x0, y1, z1), (x0, y1, z0), (x1, y1, z0)],
        'down': [(x1, y0, z0), (x0, y0, z0), (x0, y0, z1), (x1, y0, z1)],
    }
    return {k: (reg[k], corners[k]) for k in reg if k in corners}


def render(geo, tex, rotations=None, hidden=(), view_yaw=35, view_pitch=22, s=10, size=(300, 380), offset=(0, 0),
           shade=True, bg=(24, 28, 32), down=False):
    return render_multi([(geo, tex)], rotations, hidden, view_yaw, view_pitch, s, size, offset, shade, bg, down)


def render_multi(layers, rotations=None, hidden=(), view_yaw=35, view_pitch=22, s=10, size=(300, 380), offset=(0, 0),
                 shade=True, bg=(24, 28, 32), down=False):
    polys = []
    for geo, tex in layers:
        polys += _polys(geo, tex, rotations, hidden, view_yaw, view_pitch, s, size, offset, shade, down)
    img = Image.new('RGB', size, bg)
    d = ImageDraw.Draw(img)
    for depth, pts, col in sorted(polys, key=lambda t: -t[0]):
        d.polygon(pts, fill=col, outline=col)
    return img


def _polys(geo, tex, rotations, hidden, view_yaw, view_pitch, s, size, offset, shade, down=False):
    rotations = rotations or {}
    bones = geo['minecraft:geometry'][0]['bones']
    tf = bone_transforms(bones, rotations)
    by = {b['name']: b for b in bones}

    def hidden_bone(n):
        while n:
            if n in hidden:
                return True
            n = by[n].get('parent')
        return False
    yaw, pitch = math.radians(view_yaw), math.radians(view_pitch)
    # izleyici modelin önünde (-Z) ve sağ-üstünde
    def project(p):
        x, y, z = p
        x = -x  # izleyici modelin önünde (-Z), +Z'ye bakıyor: dünya +X ekranda solda
        xr = x * math.cos(yaw) - z * math.sin(yaw)
        zr = x * math.sin(yaw) + z * math.cos(yaw)
        yr = y * math.cos(pitch) - zr * math.sin(pitch)
        depth = y * math.sin(pitch) + zr * math.cos(pitch)
        return (size[0] / 2 + xr * s + offset[0], size[1] - 40 - yr * s + offset[1]), depth
    polys = []
    tw, th = tex.size
    light = {'north': 0.92, 'south': 0.78, 'east': 0.72, 'west': 0.82, 'up': 1.0, 'down': 0.6}
    for b in bones:
        if hidden_bone(b['name']) or b.get('neverRender'):
            continue
        f = tf(b['name'])
        for c in b.get('cubes', []):
            for face, ((u, v, w, h), cs) in face_regions(c, down).items():
                if w == 0 or h == 0:
                    continue
                P = [f(list(p)) for p in cs]
                aw, ah = abs(int(round(w))), abs(int(round(h)))
                for j in range(ah):
                    for i in range(aw):
                        tx = int(u + (i if w > 0 else -i - 1))
                        ty = int(v + (j if h > 0 else -j - 1))
                        if not (0 <= tx < tw and 0 <= ty < th):
                            continue
                        col = tex.getpixel((tx, ty))
                        if col[3] == 0:
                            continue

                        def at(a, bb):
                            # a: 0..1 yatay, bb: 0..1 dikey (üstten)
                            top = [P[0][k] + (P[1][k] - P[0][k]) * a for k in range(3)]
                            bot = [P[3][k] + (P[2][k] - P[3][k]) * a for k in range(3)]
                            return [top[k] + (bot[k] - top[k]) * bb for k in range(3)]
                        q = [at(i / aw, j / ah), at((i + 1) / aw, j / ah), at((i + 1) / aw, (j + 1) / ah), at(i / aw, (j + 1) / ah)]
                        pts, ds = zip(*(project(p) for p in q))
                        k = light[face] if shade else 1
                        polys.append((sum(ds) / 4, pts, tuple(int(cc * k) for cc in col[:3])))
    return polys
