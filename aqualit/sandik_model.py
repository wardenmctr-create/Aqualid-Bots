# Robot sandigi 3D model dokusu (64x64, kutu UV) + izometrik onizleme
from PIL import Image
from pix import PAL
from sandiklar import EMB, CHESTS
from iso import Iso

def G(w, h, ch='.'):
    return [[ch] * w for _ in range(h)]

def plate(w, h, fill='M', top='H', bottom='D', left='L', right='D'):
    g = G(w, h, fill)
    for y in range(h):
        g[y][0] = left; g[y][w - 1] = right
    for x in range(w):
        g[0][x] = top; g[h - 1][x] = bottom
    g[h - 1][0] = 'M'; g[0][w - 1] = 'L'
    return g

def stamp(g, emb, ox, oy, head='W', handle='H', shadow='D', remap=None):
    pts = []
    for y, row in enumerate(emb):
        for x, ch in enumerate(row):
            if ch == '.': continue
            c = {'W': head, 'H': handle}.get(ch, ch)
            if remap: c = remap.get(c, c)
            pts.append((ox + x, oy + y, c))
    occ = {(x, y) for x, y, _ in pts}
    for x, y, _ in pts:
        X, Y = x + 1, y + 1
        if (X, Y) not in occ and 0 < Y < len(g) - 1 and 1 < X < len(g[0]) - 2:
            g[Y][X] = shadow
    for x, y, c in pts:
        g[y][x] = c

def faces(emb_key):
    e = EMB[emb_key]
    f = {}
    # GOVDE
    bf = plate(14, 10)
    for x, y in [(2, 1), (11, 1), (2, 8), (11, 8)]: bf[y][x] = 'H'
    stamp(bf, e, 4, 3, shadow='M')
    f['body_front'] = bf
    bs = plate(14, 10)
    for x, y in [(2, 1), (11, 1), (2, 8), (11, 8)]: bs[y][x] = 'H'
    f['body_side'] = bs
    f['body_back'] = [r[:] for r in bs]
    bt = G(14, 14, 'O')                       # ic (kapak acilinca)
    for i in range(14):
        bt[0][i] = bt[13][i] = 'M'; bt[i][0] = bt[i][13] = 'M'
    for i in range(1, 13): bt[1][i] = 'k'
    f['body_top'] = bt
    bb = G(14, 14, 'D')
    for i in range(14): bb[0][i] = bb[13][i] = 'O'; bb[i][0] = bb[i][13] = 'O'
    f['body_bottom'] = bb
    # KAPAK
    lf = G(14, 5, 'L')
    for x in range(14): lf[0][x] = 'W'; lf[1][x] = 'H'; lf[4][x] = 'M'
    for y in range(1, 5): lf[y][0] = 'H'; lf[y][13] = 'M'
    f['lid_front'] = lf
    f['lid_side'] = [r[:] for r in lf]
    f['lid_back'] = [r[:] for r in lf]
    lt = G(14, 14, 'L')
    for i in range(14): lt[0][i] = 'W'; lt[i][0] = 'H'; lt[13][i] = 'M'; lt[i][13] = 'M'
    for i in range(1, 13): lt[1][i] = 'H'; lt[i][1] = 'H'
    lt[1][1] = 'W'
    for x, y in [(2, 2), (11, 2), (2, 11), (11, 11)]: lt[y][x] = 'W'
    thick = [list(r) for r in e]
    for y, row in enumerate(e):
        for x, ch in enumerate(row):
            if ch == 'H' and x + 1 < len(row) and e[y][x + 1] == '.':
                thick[y][x + 1] = 'H'
    stamp(lt, [''.join(r) for r in thick], 4, 4, head='W', handle='M', shadow='L')
    f['lid_top'] = lt
    lb = G(14, 14, 'O')
    f['lid_bottom'] = lb
    # KILIT
    f['latch_front'] = [list('WH'), list('HL'), list('LM'), list('MD')]
    f['latch_side'] = [list('M'), list('D'), list('D'), list('O')]
    f['latch_top'] = [list('HH')]
    f['latch_bottom'] = [list('DD')]
    f['latch_back'] = [list('DD')] * 4
    return f

def to_img(g):
    h, w = len(g), len(g[0])
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for y in range(h):
        for x in range(w):
            c = PAL[g[y][x]]
            if c is not None: im.putpixel((x, y), c + (255,))
    return im

def box_uv(sheet, u, v, w, h, d, up, down, west, north, east, south):
    for img, (x, y) in [(up, (u + d, v)), (down, (u + d + w, v)), (west, (u, v + d)),
                        (north, (u + d, v + d)), (east, (u + d + w, v + d)), (south, (u + 2 * d + w, v + d))]:
        sheet.alpha_composite(to_img(img), (x, y))

def sheet(emb_key):
    f = faces(emb_key)
    s = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    box_uv(s, 0, 0, 14, 5, 14, f['lid_top'], f['lid_bottom'], f['lid_side'], f['lid_front'], f['lid_side'], f['lid_back'])
    box_uv(s, 0, 19, 14, 10, 14, f['body_top'], f['body_bottom'], f['body_side'], f['body_front'], f['body_side'], f['body_back'])
    box_uv(s, 0, 0, 2, 4, 1, f['latch_top'], f['latch_bottom'], f['latch_side'], f['latch_front'], f['latch_side'], f['latch_back'])
    return s, f

def render3d(f, s=9):
    W, H = 250, 300
    iso = Iso(W, H, 125, 150, s)
    T = lambda k: to_img(f[k])
    iso.box(1, 0, 1, 15, 10, 15, front=T('body_front'), right=T('body_side'))
    iso.box(1, 10, 1, 15, 15, 15, top=T('lid_top'), front=T('lid_front'), right=T('lid_side'))
    iso.box(7, 7, 15, 9, 11, 16, top=T('latch_top'), front=T('latch_front'), right=T('latch_side'))
    return iso.img

if __name__ == '__main__':
    import os
    from kompoz import compose, flat
    renders = []
    for key, fn, label in CHESTS:
        sh, f = sheet(key)
        sh.save(f'dokular/{fn}_model.png')
        r = render3d(f); r.save(f'onizleme/3d_{fn}.png')
        renders.append((r, label))
    compose('Robot Sandıkları · 3D', renders, 'onizleme/12_sandiklar_3d.png')
    sh = Image.open('dokular/chest_miner_model.png')
    compose('Sandık model dokusu (tüm yüzler)', [(flat(sh, 384), 'Madenci sandığı doku haritası'),
            (Image.open('onizleme/3d_chest_miner.png'), '3D hali')], 'onizleme/13_sandik_doku_haritasi.png',
            note='Kapak, gövde ve kilit: üst, alt, ön, arka, iki yan yüz.')
    print('ok')
