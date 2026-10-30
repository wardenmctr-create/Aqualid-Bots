"""Keşif Robotu: robot hali + 5 araç hali (uçak, gemi, denizaltı, arazi aracı, matkaplı makine).

Koordinatlar robot.py ile aynı: ön yüz +Z, y yukarı, birim = doku pikseli (16 = 1 blok).
Bedrock dosyasına yazarken Y etrafında 180 derece çevrilir (ön yüz -Z).
Tüm haller tek geometride; robot halinin kemikleri diğer robotlarla aynı adları taşır
(yürüme/bekleme animasyonları aynen çalışsın diye). Araç kemikleri önekli: u_ g_ d_ a_ m_.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
for p in (HERE, os.path.join(HERE, 'addon', 'test'), os.path.join(HERE, 'addon', 'gen')):
    if p not in sys.path:
        sys.path.insert(0, p)
from PIL import Image  # noqa: E402
import robot as R  # noqa: E402
from robot import RP, G, plate, put  # noqa: E402

RP.update({
    '7': (200, 150, 92), '8': (88, 56, 30),                       # deri: açık, çok koyu (orta 'o', koyu 'm')
    '4': (244, 238, 222), '5': (216, 204, 178), '6': (178, 164, 136),  # krem atkı / kabin
    '9': (250, 252, 252),                                         # beyaz
    '0': (14, 40, 46),                                            # koyu cam
    '!': (255, 120, 40), '#': (255, 196, 70), '$': (255, 244, 170),    # alev / lamba
    '%': (70, 78, 86), '&': (104, 114, 124), '*': (150, 160, 170),     # çelik: koyu, orta, açık
    '+': (196, 206, 214),                                         # çelik parlak
    '=': (150, 36, 36),                                           # gemi altı kırmızısı
    '~': (170, 226, 255), '^': (84, 160, 236), '@': (40, 92, 176),     # gözlük camı
    '<': (120, 200, 255), '>': (20, 50, 110),                          # cam (araç), koyu mavi
})
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT2 = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
OUT = os.path.join(HERE, 'onizleme')


# ------------------------------------------------------------------ çizim yardımcıları
def fill(w, h, c):
    return G(w, h, c)


def panel(w, h, base='M', t='H', b='D', l='L', r='D'):
    return plate(w, h, base, top=t, bottom=b, left=l, right=r)


def rows(*rs):
    """Metin satırlarından ızgara (boşluk = saydam)."""
    return [list(r) for r in rs]


def over(g, pat, ox, oy):
    """Deseni (boşluklar saydam) ızgaraya bas; taşan kısmı kes."""
    for y, row in enumerate(pat):
        for x, ch in enumerate(row):
            if ch != ' ' and 0 <= oy + y < len(g) and 0 <= ox + x < len(g[0]):
                g[oy + y][ox + x] = ch
    return g


def hline(g, y, c, x0=0, x1=None):
    x1 = len(g[0]) if x1 is None else x1
    if 0 <= y < len(g):
        for x in range(max(0, x0), min(len(g[0]), x1)):
            g[y][x] = c
    return g


def vline(g, x, c, y0=0, y1=None):
    y1 = len(g) if y1 is None else y1
    if 0 <= x < len(g[0]):
        for y in range(max(0, y0), min(len(g), y1)):
            g[y][x] = c
    return g


def dots(g, pts, c):
    for x, y in pts:
        if 0 <= y < len(g) and 0 <= x < len(g[0]):
            g[y][x] = c
    return g


def mirror_h(g):
    return [r[::-1] for r in g]


def eyes_screen(w, h, eye_w=3, gap=None, frame='M'):
    """Robotun ekran yüzü: koyu cam, iki parlak göz (robotlardaki göz şekli)."""
    g = fill(w, h, 'k')
    if frame:
        for x in range(w):
            g[0][x] = frame
            g[h - 1][x] = frame
        for y in range(h):
            g[y][0] = frame
            g[y][w - 1] = frame
    eye = R.EYE if eye_w == 3 else [r for r in R.EYE]
    ew, eh = 3, 4
    gap = gap if gap is not None else max(1, (w - 2 * ew) // 3)
    total = 2 * ew + gap
    ox = (w - total) // 2
    oy = (h - eh) // 2
    put(g, eye, ox, oy)
    put(g, eye, ox + ew + gap, oy)
    return g


COMPASS5 = ["  y  ",
            " yRy ",
            "ycWcy",
            " yay ",
            "  y  "]


# ------------------------------------------------------------------ model
class Part:
    def __init__(self, bone, box, glow=''):
        self.bone, self.box, self.glow = bone, box, glow


class Form:
    def __init__(self, key, name):
        self.key, self.name = key, name
        self.parts = []
        self.bones = {}       # ad -> (ebeveyn, pivot)
        self.order = []

    def bone(self, name, parent, pivot, rot=None):
        self.bones[name] = (parent, pivot, rot)
        self.order.append(name)
        return name

    def add(self, bone, name, a, b, glow='', **faces):
        bx = R.box(name, a, b, **faces)
        self.parts.append(Part(bone, bx, glow))
        return bx


def robot_form():
    f = Form('robot', 'Keşif Robotu')
    for n, par, piv, *rot in [('root', None, (0, 0, 0)), ('body', 'root', (0, 3, 0)), ('head', 'body', (0, 10, 0)),
                        ('right_arm', 'body', (5, 9.5, 0)), ('left_arm', 'body', (-5, 9.5, 0)),
                        ('right_leg', 'root', (2, 3, 0)), ('left_leg', 'root', (-2, 3, 0)),
                        ('rightItem', 'right_arm', (5, 5.5, 0.5)),
                        ('k_cap', 'head', (0, 19, 0)), ('k_goggles', 'head', (0, 20, 6)),
                        ('k_radar', 'head', (0, 25, 0), (-25, 0, 0)), ('k_scarf', 'body', (0, 9, 0)),
                        ('k_scarf_tail', 'k_scarf', (0, 9, -5)), ('k_jet', 'body', (0, 6, -3.5)),
                        ('k_flame', 'k_jet', (0, 3, -3.5))]:
        f.bone(n, par, piv, rot[0] if rot else None)
    base = R.base_robot('kesif')
    bone_of = {'leg_l': 'left_leg', 'leg_r': 'right_leg', 'arm_l': 'left_arm', 'arm_r': 'right_arm',
               'body': 'body', 'head': 'head'}
    for p in base:
        if p.name == 'body':
            bf = panel(8, 7)
            over(bf, [list(r) for r in COMPASS5], 1, 1)
            bf[1][6] = 'H'
            p.f['front'] = bf
        glow = 'WL' if p.name == 'head' else ''
        f.parts.append(Part(bone_of[p.name], p, glow if p.name != 'head' else 'EYES'))
    # deri pilot başlığı: kat kat yuvarlak kubbe
    bf = fill(13, 2, 'o')
    hline(bf, 0, '7')
    dots(bf, [(1, 1), (4, 1), (8, 1), (11, 1)], '7')
    bs = fill(11, 2, 'o')
    hline(bs, 0, 'm')
    dots(bs, [(5, 0)], 'y')
    dots(bs, [(4, 0), (6, 0)], 'Q')
    bt = fill(13, 11, 'o')
    for x in range(13):
        bt[0][x] = '7'
    f.add('k_cap', 'k_cap_band', (-6.5, 18, -5.5), (6.5, 20, 5.5), front=bf, back=[r[:] for r in bf],
          left=bs, right=mirror_h(bs), top=bt, bottom=fill(13, 11, 'm'))
    df = fill(12, 2, 'o')
    hline(df, 0, '7')
    vline(df, 6, 'm')
    ds = fill(10, 2, 'o')
    hline(ds, 0, '7')
    vline(ds, 5, 'm')
    dt = fill(12, 10, 'o')
    hline(dt, 0, '7')
    vline(dt, 0, '7')
    vline(dt, 6, 'm')
    f.add('k_cap', 'k_cap_dome', (-6, 20, -5), (6, 22, 5), front=df, back=[r[:] for r in df], left=ds,
          right=[r[:] for r in ds], top=dt, bottom=fill(12, 10, 'm'))
    tt = fill(9, 7, 'o')
    hline(tt, 0, '7')
    vline(tt, 0, '7')
    vline(tt, 4, 'm')
    dots(tt, [(4, 3)], 'y')
    f.add('k_cap', 'k_cap_top', (-4.5, 22, -3.5), (4.5, 23, 3.5), front=[list('777777777')],
          back=[list('mmmmmmmmm')], left=[list('7777777')], right=[list('mmmmmmm')], top=tt,
          bottom=fill(9, 7, 'm'))
    # ense kapağı (kürk kenarlı)
    fb = fill(13, 6, 'o')
    hline(fb, 5, '4')
    hline(fb, 4, '5')
    vline(fb, 6, 'm', 0, 4)
    dots(fb, [(2, 1), (10, 1)], '7')
    f.add('k_cap', 'k_cap_back', (-6.5, 12, -6), (6.5, 18, -5), front=fill(13, 6, 'm'), back=fb,
          left=rows('o', 'o', 'o', 'o', '5', '4'), right=rows('o', 'o', 'o', 'o', '5', '4'),
          top=fill(13, 1, 'o'), bottom=fill(13, 1, '4'))
    # kulak kapakları
    ef = fill(4, 6, 'o')
    vline(ef, 0, '5')
    vline(ef, 3, '5')
    hline(ef, 5, '4')
    hline(ef, 0, '7')
    dots(ef, [(1, 4), (2, 4)], 'y')
    for nm, x0 in (('k_flap_l', -7.5), ('k_flap_r', 6.5)):
        f.add('k_cap', nm, (x0, 12, -2.5), (x0 + 1, 18, 1.5), left=[r[:] for r in ef], right=mirror_h(ef),
              front=rows('o', 'o', 'o', 'o', '5', '4'), back=rows('o', 'o', 'o', 'o', '5', '4'),
              top=fill(1, 4, '7'), bottom=fill(1, 4, '4'))
    # pirinç pilot gözlüğü (alında; araç halinde gözlerin üstüne iner)
    L = [" yYy ", "y~~^y", "y^@@y", " yQy "]
    Bm = ["  ", "yy", "  ", "  "]
    gf = rows(*[L[i] + Bm[i] + L[i] for i in range(4)])
    gb = rows(*[r.replace('~', 'y').replace('^', 'y').replace('@', 'y').replace('Y', 'y') for r in
                [L[i] + Bm[i] + L[i] for i in range(4)]])
    f.add('k_goggles', 'k_goggles', (-6, 19, 5.5), (6, 23, 6.5), front=gf, back=gb,
          left=rows(' ', 'y', 'y', ' '), right=rows(' ', 'y', 'y', ' '),
          top=rows(" yYy    yYy "), bottom=rows(" yQy    yQy "), glow='~^@')
    # radar anteni
    f.add('k_cap', 'k_antenna', (-0.5, 23, -0.5), (0.5, 25, 0.5), front=rows('L', 'M'), back=rows('M', 'D'),
          left=rows('L', 'M'), right=rows('M', 'D'), top=rows('L'))
    f.add('k_radar', 'k_radar', (-2.5, 25, -0.5), (2.5, 28, 0.5),
          front=rows("LHWHL", "HMyMH", "LDDDL"), back=rows("MDDDM", "D%%%D", "MDDDM"),
          left=rows('L', 'M', 'D'), right=rows('M', 'D', 'D'), top=rows('HWWWH'), bottom=rows('DDDDD'))
    f.add('k_radar', 'k_radar_feed', (-0.5, 26, 0.5), (0.5, 27, 2.5), front=rows('Y'), back=rows('y'),
          left=rows('yy'), right=rows('yy'), top=rows('Y', 'y'), bottom=rows('Q', 'Q'))
    # krem pilot atkısı
    sf = fill(9, 2, '4')
    hline(sf, 1, '5')
    dots(sf, [(4, 0), (4, 1)], '6')
    ss = fill(6, 2, '4')
    hline(ss, 1, '5')
    f.add('k_scarf', 'k_scarf', (-4.5, 8, -3), (4.5, 10, 3), front=sf, back=[r[:] for r in sf], left=ss,
          right=[r[:] for r in ss], top=fill(9, 6, '4'), bottom=fill(9, 6, '5'))
    tl = rows('44', '45', '54', '45', '44', '56', '66')
    f.add('k_scarf_tail', 'k_scarf_tail', (-1, 2, -5.5), (1, 9, -4.5), front=[r[:] for r in tl],
          back=[r[:] for r in tl], left=rows('4', '4', '5', '4', '4', '5', '6'),
          right=rows('5', '4', '4', '5', '4', '6', '6'), top=rows('44'), bottom=rows('66'))
    # jet çantası (iki tüp)
    tf = fill(3, 5, 'M')
    hline(tf, 0, 'H')
    hline(tf, 1, 'y')
    hline(tf, 3, 'y')
    hline(tf, 4, 'D')
    vline(tf, 0, 'L', 0, 1)
    ts = fill(2, 5, 'M')
    hline(ts, 0, 'H')
    hline(ts, 1, 'y')
    hline(ts, 3, 'y')
    hline(ts, 4, 'D')
    for nm, x0 in (('k_tank_l', -3.5), ('k_tank_r', 0.5)):
        f.add('k_jet', nm, (x0, 4, -4.5), (x0 + 3, 9, -2.5), front=fill(3, 5, 'D'), back=[r[:] for r in tf],
              left=[r[:] for r in ts], right=[r[:] for r in ts], top=rows('HWH', 'LHL'), bottom=fill(3, 2, 'g'))
    for nm, x0 in (('k_noz_l', -3), ('k_noz_r', 1)):
        f.add('k_jet', nm, (x0, 3, -4), (x0 + 2, 4, -3), front=rows('gg'), back=rows('%%'), left=rows('g'),
              right=rows('g'), top=rows('gg'), bottom=rows('!!'), glow='!')
    for nm, x0 in (('k_flame_l', -2.5), ('k_flame_r', 1.5)):
        fl = rows('#', '!', '!')
        f.add('k_flame', nm, (x0, 0, -4), (x0 + 1, 3, -3), front=fl, back=[r[:] for r in fl], left=[r[:] for r in fl],
              right=[r[:] for r in fl], top=rows('$'), bottom=rows('!'), glow='#!$')
    return f


FORMS = {}


def all_forms():
    if not FORMS:
        import kesif_araclar as KA
        for fn in [robot_form] + KA.ALL:
            fm = fn()
            FORMS[fm.key] = fm
    return FORMS


# ------------------------------------------------------------------ geometri + atlas
def to_file(a, b):
    (x0, y0, z0), (x1, y1, z1) = a, b
    return [-x1, y0, -z1]


def isize(bx):
    s = [bx.b[i] - bx.a[i] for i in range(3)]
    for v in s:
        assert abs(v - round(v)) < 1e-6 and round(v) >= 1, (bx.name, s)
    return [int(round(v)) for v in s]


def pack(items, W):
    items = sorted(items, key=lambda t: (-t[2], -t[1], t[0]))
    x = y = sh = 0
    pos = {}
    for key, w, h in items:
        if x + w > W:
            x, y, sh = 0, y + sh, 0
        pos[key] = (x, y)
        x += w
        sh = max(sh, h)
    H = y + sh
    p2 = 16
    while p2 < H:
        p2 *= 2
    return pos, p2


def grid_rgba(g):
    h, w = len(g), len(g[0])
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for yy in range(h):
        for xx in range(w):
            ch = g[yy][xx]
            c = RP.get(ch) if ch not in (' ', '.') else None
            if c is not None:
                im.putpixel((xx, yy), tuple(c) + (255,))
    return im


def glow_of(part, face, g):
    m = [[False] * len(g[0]) for _ in g]
    if part.glow == 'EYES':
        if face == 'front':
            for yy in range(2, 6):
                for xx in list(range(2, 5)) + list(range(7, 10)):
                    if g[yy][xx] in ('W', 'L'):
                        m[yy][xx] = True
        return m
    if part.glow:
        for yy in range(len(g)):
            for xx in range(len(g[0])):
                if g[yy][xx] in part.glow:
                    m[yy][xx] = True
    return m


def build(forms=None, W=256, ident='geometry.aqualit.kesif'):
    forms = forms or list(all_forms().values())
    items = []
    for fm in forms:
        for i, p in enumerate(fm.parts):
            w, h, d = isize(p.box)
            items.append(((fm.key, i), 2 * (w + d), d + h))
    pos, H = pack(items, W)
    tex = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    bones = []
    for fm in forms:
        bmap = {}
        for name in fm.order:
            par, piv, rot = fm.bones[name]
            b = {'name': name, 'pivot': [-piv[0], piv[1], -piv[2]]}
            if rot:
                b['rotation'] = [rot[0], -rot[1], -rot[2]]
            if par:
                b['parent'] = par
            bmap[name] = b
            bones.append(b)
        for i, p in enumerate(fm.parts):
            u, v = pos[(fm.key, i)]
            w, h, d = isize(p.box)
            bmap[p.bone].setdefault('cubes', []).append({'origin': to_file(p.box.a, p.box.b), 'size': [w, h, d],
                                                         'uv': [u, v]})
            regions = [('top', u + d, v), ('bottom', u + d + w, v), ('left', u, v + d),
                       ('front', u + d, v + d), ('right', u + d + w, v + d), ('back', u + 2 * d + w, v + d)]
            exp = {'top': (w, d), 'bottom': (w, d), 'left': (d, h), 'right': (d, h), 'front': (w, h), 'back': (w, h)}
            for face, x, y in regions:
                g = p.box.f[face]
                ew, eh = exp[face]
                assert len(g) == eh and all(len(r) == ew for r in g), (fm.key, p.box.name, face, (len(g[0]), len(g)), (ew, eh))
                im = grid_rgba(g)
                tex.alpha_composite(im, (x, y))
                gm = glow_of(p, face, g)
                for yy in range(eh):
                    for xx in range(ew):
                        if gm[yy][xx]:
                            glow.putpixel((x + xx, y + yy), im.getpixel((xx, yy)))
    geo = {'format_version': '1.12.0', 'minecraft:geometry': [{
        'description': {'identifier': ident, 'texture_width': W, 'texture_height': H,
                        'visible_bounds_width': 9, 'visible_bounds_height': 6, 'visible_bounds_offset': [0, 2, 0]},
        'bones': bones}]}
    return geo, tex, glow


def roots_except(forms, key):
    return {fm.order[0] for fm in forms if fm.key != key}


def card(title, panels, out, notes=None, bg=(30, 36, 42)):
    from PIL import ImageDraw, ImageFont
    pad = 22
    ft, fl, fn = ImageFont.truetype(FONT, 28), ImageFont.truetype(FONT2, 18), ImageFont.truetype(FONT2, 17)
    ph = max(im.size[1] for im, _ in panels)
    W = pad + sum(im.size[0] + pad for im, _ in panels)
    nh = (len(notes) * 24 + 12) if notes else 0
    H = 70 + ph + 36 + nh + 10
    img = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(img)
    d.text((pad, 18), title, font=ft, fill=(140, 234, 224))
    x = pad
    for im, lab in panels:
        img.paste(im, (x, 70 + (ph - im.size[1]) // 2))
        tw = d.textlength(lab, font=fl)
        d.text((x + (im.size[0] - tw) / 2, 70 + ph + 8), lab, font=fl, fill=(214, 220, 224))
        x += im.size[0] + pad
    if notes:
        y = 70 + ph + 40
        for n in notes:
            d.text((pad, y), '• ' + n, font=fn, fill=(170, 182, 188))
            y += 24
    img.save(out)
    return out


def shot(geo, tex, glow, form_key, pose=None, hide=(), yaw=30, elev=18, scale=12, size=(320, 380), center=(0, 12, 0),
         ground=(52, 60, 68), water=None, shift=(0, 0)):
    import render_z as Z
    forms = list(all_forms().values())
    hidden = roots_except(forms, form_key) | set(hide)
    gr = {'y': 0, 'color': ground} if ground and water is None else None
    return Z.render(geo, tex, pose or {}, hidden, Z.Cam(yaw=yaw, elev=elev, scale=scale, size=size, center=center,
                                                          shift=shift), glow=glow, ground=gr, water=water)


if __name__ == '__main__':
    import render_z as Z
    fm = all_forms()
    geo, tex, glow = build()
    D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tmp', 'kesif')
    os.makedirs(D, exist_ok=True)
    tex.save(D + '/tex.png')
    ims = [Z.render(geo, tex, {}, {'k_flame'}, Z.Cam(yaw=y, elev=18, scale=12, size=(320, 380), center=(0, 12, 0)), glow=glow,
                    ground={'y': 0, 'color': (52, 60, 68)}) for y in (32, 150, -40)]
    W = Image.new('RGB', (960, 380))
    for i, im in enumerate(ims):
        W.paste(im, (i * 320, 0))
    W.save(D + '/robot_test.png')
    print('ok', tex.size)
