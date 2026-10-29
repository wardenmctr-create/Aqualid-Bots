# Aqualit sandiklari: tek + cift (oyunun sandik doku duzeni: tek 64x64, cift 128x64)
# Kapak ustu tum sandiklarda Aqualit tasi; turun amblemi on yuzde (cift sandikta kilidin iki yaninda).
import os
import sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'addon', 'test'))
from pix import PAL, FONT, FONT2  # noqa: E402
import sandiklar  # noqa: E402
import sandik_model as SM  # noqa: E402
import render3d as R  # noqa: E402

EMB = sandiklar.EMB
EMB['sword'] = ["......W",
                ".....WW",
                "....WW.",
                ".y.WW..",
                "..yW...",
                ".H.y...",
                "H......"]
EMB['swords'] = ["W.....W",
                 ".W...W.",
                 "..W.W..",
                 "...W...",
                 "..y.y..",
                 ".H...H.",
                 "H.....H"]
KINDS = [('gem', 'aqualit', 'Aqualit Sandığı'),
         ('pickaxe', 'madenci', 'Madenci'),
         ('shovel', 'kurekci', 'Kürekçi'),
         ('hoe', 'ciftci', 'Çiftçi'),
         ('axe', 'oduncu', 'Oduncu'),
         ('sword', 'kilicli', 'Kılıçlı'),
         ('house', 'insaatci', 'İnşaatçı'),
         ('crate', 'toplayici', 'Toplayıcı')]

# Aqualit tasi (kapak ustu): Aqualit blogundaki tas, koyu yuvarlak yuva icinde
GEM7 = ["...LH...",
        "..LWHL..",
        ".LWHHL..",
        "LHHLLMD.",
        ".LLMMDD.",
        "..LMDD..",
        "...DD..."]


def seal(n=11):
    import math
    g = [['.'] * n for _ in range(n)]
    c = (n - 1) / 2
    for y in range(n):
        for x in range(n):
            r = math.hypot(x - c, y - c)
            if r <= c + 0.35:
                if r > c - 0.75:
                    g[y][x] = 'H' if (x - c) + (y - c) < -1 else ('O' if (x - c) + (y - c) > 1 else 'D')
                else:
                    g[y][x] = 'D' if r > c - 1.6 else 'M'
    ox, oy = (n - 8) // 2 + 1, (n - 7) // 2
    for y, row in enumerate(GEM7):
        for x, ch in enumerate(row):
            if ch != '.':
                g[oy + y][ox + x] = ch
    return [''.join(r) for r in g]


GEM_RING = seal(11)


def mirror(e):
    return [r[::-1] for r in e]


def thick(e):
    t = [list(r) for r in e]
    for y, row in enumerate(e):
        for x, ch in enumerate(row):
            if ch == 'H' and x + 1 < len(row) and e[y][x + 1] == '.':
                t[y][x + 1] = 'H'
    return [''.join(r) for r in t]


def put(g, pat, ox, oy):
    for y, row in enumerate(pat):
        for x, ch in enumerate(row):
            if ch != '.':
                g[oy + y][ox + x] = ch


def lid_top(w):
    lt = SM.G(w, 14, 'L')
    for i in range(w):
        lt[0][i] = 'W'
        lt[13][i] = 'M'
    for i in range(14):
        lt[i][0] = 'H'
        lt[i][w - 1] = 'M'
    for i in range(1, w - 1):
        lt[1][i] = 'H'
    for i in range(1, 13):
        lt[i][1] = 'H'
    lt[1][1] = 'W'
    for x, y in [(2, 2), (w - 3, 2), (2, 11), (w - 3, 11)]:
        lt[y][x] = 'W'
    put(lt, GEM_RING, (w - 11) // 2, 2 if w == 14 else 2)
    if w > 14:   # cift: iki yanda kucuk taslar
        for cx in (6, w - 7):
            put(lt, [".W.", "WLM", ".MD"], cx - 1, 6)
    return lt


def body_front(w, emb):
    bf = SM.plate(w, 10)
    for x, y in [(2, 1), (w - 3, 1), (2, 8), (w - 3, 8)]:
        bf[y][x] = 'H'
    e = EMB[emb]
    oy = 3 if len(e) <= 6 else 2
    if w == 14:
        SM.stamp(bf, e, 4, oy, shadow='M')
    else:
        SM.stamp(bf, e, 4, oy, shadow='M')
        SM.stamp(bf, mirror(e) if emb not in ('house', 'crate', 'gem', 'swords') else e, w - 4 - len(e[0]), oy, shadow='M')
    return bf


def faces(emb, w):
    f = {}
    f['body_front'] = body_front(w, emb)
    bs = SM.plate(14, 10)
    for x, y in [(2, 1), (11, 1), (2, 8), (11, 8)]:
        bs[y][x] = 'H'
    f['body_side'] = bs
    bb = SM.plate(w, 10)
    for x, y in [(2, 1), (w - 3, 1), (2, 8), (w - 3, 8)]:
        bb[y][x] = 'H'
    f['body_back'] = bb
    bt = SM.G(w, 14, 'O')                 # ic (kapak acilinca gorunur)
    for i in range(w):
        bt[0][i] = bt[13][i] = 'M'
    for i in range(14):
        bt[i][0] = bt[i][w - 1] = 'M'
    for i in range(1, w - 1):
        bt[1][i] = 'k'
    f['body_top'] = bt
    bo = SM.G(w, 14, 'D')
    for i in range(w):
        bo[0][i] = bo[13][i] = 'O'
    for i in range(14):
        bo[i][0] = bo[i][w - 1] = 'O'
    f['body_bottom'] = bo

    def lidband(ww):
        lf = SM.G(ww, 5, 'L')
        for x in range(ww):
            lf[0][x] = 'W'
            lf[1][x] = 'H'
            lf[4][x] = 'M'
        for y in range(1, 5):
            lf[y][0] = 'H'
            lf[y][ww - 1] = 'M'
        return lf
    f['lid_front'] = lidband(w)
    f['lid_side'] = lidband(14)
    f['lid_back'] = lidband(w)
    f['lid_top'] = lid_top(w)
    lb = SM.G(w, 14, 'D')                 # kapagin ici
    for i in range(w):
        lb[0][i] = lb[13][i] = 'O'
    for i in range(14):
        lb[i][0] = lb[i][w - 1] = 'O'
    for i in range(2, w - 2):
        lb[2][i] = 'M'
    f['lid_bottom'] = lb
    f['latch_front'] = [list('WH'), list('HL'), list('LM'), list('MD')]
    f['latch_side'] = [list('M'), list('D'), list('D'), list('O')]
    f['latch_top'] = [list('HH')]
    f['latch_bottom'] = [list('DD')]
    f['latch_back'] = [list('DD')] * 4
    return f


def sheet(emb, double=False):
    w = 30 if double else 14
    f = faces(emb, w)
    s = Image.new('RGBA', (128 if double else 64, 64), (0, 0, 0, 0))
    SM.box_uv(s, 0, 0, w, 5, 14, f['lid_top'], f['lid_bottom'], f['lid_side'], f['lid_front'], f['lid_side'], f['lid_back'])
    SM.box_uv(s, 0, 19, w, 10, 14, f['body_top'], f['body_bottom'], f['body_side'], f['body_front'], f['body_side'],
              f['body_back'])
    SM.box_uv(s, 0, 0, 2, 4, 1, f['latch_top'], f['latch_bottom'], f['latch_side'], f['latch_front'], f['latch_side'],
              f['latch_back'])
    return s


def geo(double=False):
    w = 30 if double else 14
    return {'minecraft:geometry': [{'description': {'texture_width': 128 if double else 64, 'texture_height': 64},
                                    'bones': [
        {'name': 'body', 'pivot': [0, 0, 0], 'cubes': [{'origin': [-w / 2, 0, -7], 'size': [w, 10, 14], 'uv': [0, 19]}]},
        {'name': 'lid', 'parent': 'body', 'pivot': [0, 9, 7], 'cubes': [
            {'origin': [-w / 2, 9, -7], 'size': [w, 5, 14], 'uv': [0, 0]},
            {'origin': [-1, 7, -8], 'size': [2, 4, 1], 'uv': [0, 0]}]},
    ]}]}


def render(emb, double=False, open_deg=0, yaw=-32, pitch=-28, s=9, size=(240, 230), off=-22):
    return R.render(geo(double), sheet(emb, double), rotations={'lid': [-open_deg, 0, 0]}, view_yaw=yaw, view_pitch=pitch,
                    s=s, size=size, offset=(0, off), down=True)


def card(rows, title, out, note=None):
    pad = 18
    fl = ImageFont.truetype(FONT2, 17)
    ft = ImageFont.truetype(FONT, 26)
    W = max(sum(im.size[0] for im, _ in r) + pad * (len(r) + 1) for r in rows)
    H = 64 + sum(max(im.size[1] for im, _ in r) + 40 for r in rows) + (34 if note else 0)
    img = Image.new('RGB', (W, H), (24, 28, 32))
    d = ImageDraw.Draw(img)
    d.text((pad, 16), title, font=ft, fill=(122, 211, 183))
    y = 64
    for r in rows:
        x = pad
        rh = max(im.size[1] for im, _ in r)
        for im, lab in r:
            img.paste(im, (x, y + (rh - im.size[1]) // 2))
            tw = d.textlength(lab, font=fl)
            d.text((x + (im.size[0] - tw) / 2, y + rh + 6), lab, font=fl, fill=(214, 220, 224))
            x += im.size[0] + pad
        y += rh + 40
    if note:
        d.text((pad, y), note, font=fl, fill=(150, 160, 166))
    img.save(out)
    return out


if __name__ == '__main__':
    os.makedirs('dokular/sandik', exist_ok=True)
    for emb, key, _ in KINDS:
        sheet(emb).save(f'dokular/sandik/{key}.png')
        sheet(emb, True).save(f'dokular/sandik/{key}_cift.png')
    # 1) Aqualit cift sandik: kapali, acik, tek ile yan yana
    hero = [(render('gem', True, 0, s=11, size=(440, 330), off=-46), 'Çift sandık'),
            (render('gem', True, 78, s=10, size=(440, 330), off=-24), 'Çift sandık (açık)'),
            (render('gem', False, 0, s=11, size=(250, 330), off=-46), 'Tek sandık')]
    print(card([hero], 'Aqualit Çift Sandık', 'onizleme/42_cift_sandik.png'))
    # 2) tum turler: tek ve cift
    singles = [(render(e, False, 0, s=7.5, size=(180, 190), off=-30), n) for e, _, n in KINDS]
    doubles = [(render(e, True, 0, s=7.5, size=(330, 210), off=-34), n) for e, _, n in KINDS[:4]]
    doubles2 = [(render(e, True, 0, s=7.5, size=(330, 210), off=-34), n) for e, _, n in KINDS[4:]]
    print(card([singles, doubles, doubles2], 'Robot Sandıkları · tek ve çift', 'onizleme/43_sandik_turleri.png'))
