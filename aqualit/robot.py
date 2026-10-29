# Sevimli Aqualit robotlari: kutu modeli + yuz dokulari + onizleme
import math
from PIL import Image, ImageDraw
from pix import PAL
from iso import C30, S30, shade

RP = dict(PAL)
RP.update({
    'e': (88, 168, 56), 'E': (52, 116, 36), 'f': (150, 214, 92),          # yaprak
    'n': (222, 198, 140), 'N': (186, 158, 102), 'B': (140, 112, 66),      # kum
    'w': (236, 206, 120), 'x': (204, 168, 84), 'X': (156, 120, 54),       # hasir
    'Q': (176, 132, 32),                                                  # koyu sari
    'G': (252, 196, 92), 'A': (236, 142, 38), 'C': (182, 96, 22),        # baret turuncusu
    'I': (54, 104, 186), 'J': (176, 206, 244),                            # plan (mavi kağıt)
    'm': (122, 80, 42), 'o': (166, 114, 62),                              # deri
    'P': (196, 110, 255), 'p': (138, 64, 206), 'Z': (226, 184, 255),      # mor ışık (vizör)
    '1': (46, 56, 86), '2': (30, 36, 58), '3': (76, 90, 132),             # lacivert şapka
    ' ': None,
})

def G(w, h, ch):
    return [[ch] * w for _ in range(h)]

def plate(w, h, fill='M', top='H', bottom='D', left='L', right='D'):
    g = G(w, h, fill)
    if w >= 3 and h >= 3:
        for y in range(h):
            g[y][0] = left; g[y][w - 1] = right
        for x in range(w):
            g[0][x] = top; g[h - 1][x] = bottom
        g[h - 1][0] = fill; g[0][w - 1] = fill
    elif h >= 2:
        for x in range(w):
            g[0][x] = top; g[h - 1][x] = bottom
    return g

def put(g, rows, ox, oy):
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != ' ':
                g[oy + y][ox + x] = ch

class Box:
    def __init__(self, name, a, b, faces):
        self.name = name
        self.a, self.b = a, b          # (x0,y0,z0), (x1,y1,z1)
        self.f = faces                 # front back left right top bottom -> grid
    def size(self):
        return tuple(self.b[i] - self.a[i] for i in range(3))

def box(name, a, b, front=None, back=None, left=None, right=None, top=None, bottom=None, base='M'):
    w, h, d = (round(b[0] - a[0]), round(b[1] - a[1]), round(b[2] - a[2]))
    w, h, d = max(w, 1), max(h, 1), max(d, 1)
    f = {
        'front': front or plate(w, h, base),
        'back': back or plate(w, h, base),
        'left': left or plate(d, h, base),
        'right': right or plate(d, h, base),
        'top': top or plate(w, d, base, top='H', bottom='L', left='H', right='L'),
        'bottom': bottom or G(w, d, 'D'),
    }
    return Box(name, a, b, f)

def to_img(g):
    h, w = len(g), len(g[0])
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for y in range(h):
        for x in range(w):
            c = RP[g[y][x]]
            if c is not None:
                im.putpixel((x, y), c + (255,))
    return im

# ---------------- ortak parcalar ----------------
EYE = ["LWL", "WWW", "WWW", "LWL"]
EYE_L_SERT = ["Lkk", "WWL", "WWW", "LWL"]
EYE_R_SERT = ["kkL", "LWW", "WWW", "LWL"]

def head_front(sert=False):
    g = plate(12, 9, 'M', top='H', bottom='D', left='H', right='D')
    g[0][0] = 'W'
    for y in range(1, 7):
        for x in range(1, 11):
            g[y][x] = 'k'
    for x in range(1, 11): g[7][x] = 'M'
    if sert:
        put(g, EYE_L_SERT, 2, 2); put(g, EYE_R_SERT, 7, 2)
        g[5][1] = 'R'; g[6][1] = 'R'; g[5][10] = 'R'; g[6][10] = 'R'
    else:
        put(g, EYE, 2, 2); put(g, EYE, 7, 2)
    return g

def head_side():
    g = plate(10, 9)
    put(g, ["LHHL", "HWWH", "LHHL"], 3, 3)
    return g

def head_back():
    g = plate(12, 9)
    for y in range(2, 7):
        for x in range(3, 9):
            g[y][x] = 'L'
    for x in range(3, 9): g[2][x] = 'H'
    for (x, y) in [(4, 4), (7, 4)]: g[y][x] = 'H'
    return g

def head_top():
    g = plate(12, 10, 'L', top='H', bottom='M', left='H', right='M')
    put(g, ["HH", "HM"], 5, 4)
    return g

def body_front():
    g = plate(8, 7)
    put(g, ["kHkkHk", "HWHHWH", "kHWWHk", "kkHHkk"], 1, 2)
    return g

def body_back():
    g = plate(8, 7)
    for y in range(2, 6):
        for x in range(2, 6):
            g[y][x] = 'L'
    g[2][2] = g[2][5] = g[5][2] = g[5][5] = 'H'
    return g

def limb(w, h, boots=False):
    g = G(w, h, 'M')
    for y in range(h):
        g[y][0] = 'L'
    g[0] = ['H'] * w
    g[h - 1] = ['D'] * w
    if boots:
        for y in range(h - 2, h):
            g[y] = ['n'] + ['N'] * (w - 1)
        g[h - 1] = ['B'] * w
    return g

def base_robot(kind):
    sert = kind == 'kilicli'
    boots = kind == 'kurekci'
    parts = []
    L = lambda: limb(3, 3, boots)
    parts.append(box('leg_l', (-3.5, 0, -1.5), (-0.5, 3, 1.5), front=L(), back=L(), left=L(), right=L()))
    parts.append(box('leg_r', (0.5, 0, -1.5), (3.5, 3, 1.5), front=L(), back=L(), left=L(), right=L()))
    A = lambda: limb(2, 5)
    parts.append(box('arm_l', (-6, 4.5, -1), (-4, 9.5, 1), front=A(), back=A(), left=A(), right=A()))
    parts.append(box('arm_r', (4, 4.5, -1), (6, 9.5, 1), front=A(), back=A(), left=A(), right=A()))
    parts.append(box('body', (-4, 3, -2.5), (4, 10, 2.5), front=body_front(), back=body_back()))
    parts.append(box('head', (-6, 10, -5), (6, 19, 5), front=head_front(sert), back=head_back(),
                     left=head_side(), right=head_side(), top=head_top()))
    return parts

def antenna(y0, tip='ball'):
    p = [box('antenna', (-0.5, y0, -0.5), (0.5, y0 + 3, 0.5),
             front=[['L'], ['M'], ['D']], back=[['M'], ['D'], ['D']], left=[['L'], ['M'], ['D']],
             right=[['M'], ['D'], ['D']], top=[['L']])]
    t = y0 + 3
    if tip == 'ball':
        p.append(box('antenna_tip', (-1, t, -1), (1, t + 2, 1),
                     front=[list('WH'), list('HL')], back=[list('HL'), list('LM')],
                     left=[list('WH'), list('HL')], right=[list('HL'), list('LM')], top=[list('WW'), list('WH')]))
    elif tip == 'leaf':
        leaf = [list(' f '), list('efe'), list('eEe'), list(' E ')]
        p.append(box('antenna_tip', (-1.5, t, -0.5), (1.5, t + 4, 0.5),
                     front=leaf, back=[r[::-1] for r in leaf],
                     left=[list(' '), list('e'), list('E'), list(' ')], right=[list(' '), list('e'), list('E'), list(' ')],
                     top=[list(' f ')]))
    elif tip == 'sprout':
        sp = [list('f f'), list('eEe'), list(' E ')]
        p.append(box('antenna_tip', (-1.5, t, -0.5), (1.5, t + 3, 0.5),
                     front=sp, back=[r[::-1] for r in sp],
                     left=[list('f'), list('E'), list('E')], right=[list('f'), list('E'), list('E')],
                     top=[list('f f')]))
    return p

def straw(w, h, band_row=None):
    g = G(w, h, 'x')
    for y in range(h):
        for x in range(w):
            if (x + y) % 3 == 0: g[y][x] = 'w'
    g[0] = ['w'] * w
    if band_row is not None:
        g[band_row] = ['r'] * w
    return g

def robot(kind):
    parts = base_robot(kind)
    if kind == 'madenci':
        hf = G(13, 3, 'y'); hf[0] = ['Y'] * 13; hf[2] = ['Q'] * 13
        hs = G(11, 3, 'y'); hs[0] = ['Y'] * 11; hs[2] = ['Q'] * 11
        ht = G(13, 11, 'y')
        for x in range(13): ht[0][x] = 'Y'
        for y in range(11): ht[y][0] = 'Y'
        for y in range(3, 8):
            for x in range(5, 8): ht[y][x] = 'Y'
        parts.append(box('helmet', (-6.5, 17, -5.5), (6.5, 20, 5.5), front=hf, back=hs and [r[:] for r in hf],
                         left=hs, right=[r[:] for r in hs], top=ht))
        parts.append(box('lamp', (-1.5, 17.5, 5.5), (1.5, 19.5, 6.5),
                         front=[list('YWY'), list('QYQ')], left=[list('Q'), list('Q')], right=[list('Q'), list('Q')],
                         top=[list('YYY')]))
        parts += antenna(20)
    elif kind == 'oduncu':
        sf = G(9, 2, 'e'); sf[0] = ['f'] * 9; sf[1] = ['e', 'E'] * 4 + ['e']
        ss = G(6, 2, 'e'); ss[0] = ['f'] * 6; ss[1] = ['e', 'E'] * 3
        parts.insert(5, box('scarf', (-4.5, 8, -3), (4.5, 10, 3), front=sf, back=[r[:] for r in sf],
                            left=ss, right=[r[:] for r in ss], top=G(9, 6, 'f')))
        tail = [list('fe'), list('ee'), list('eE'), list('ff')]
        parts.insert(0, box('scarf_tail', (1.5, 4, -4), (3.5, 8, -3), front=tail, back=tail,
                            left=[list('e')] * 4, right=[list('E')] * 4, top=[list('ff')]))
        parts += antenna(19, 'leaf')
    elif kind == 'ciftci':
        bt = G(16, 14, 'x')
        for y in range(14):
            for x in range(16):
                if (x + y) % 3 == 0: bt[y][x] = 'w'
                if x in (0, 15) or y in (0, 13): bt[y][x] = 'X'
        parts.append(box('hat_brim', (-8, 19, -7), (8, 20, 7), front=[['w'] * 16], back=[['w'] * 16],
                         left=[['x'] * 14], right=[['x'] * 14], top=bt))
        parts.append(box('hat_crown', (-4, 20, -4), (4, 23, 4), front=straw(8, 3, 2), back=straw(8, 3, 2),
                         left=straw(8, 3, 2), right=straw(8, 3, 2), top=straw(8, 8)))
        parts += antenna(23, 'sprout')
    elif kind == 'kurekci':
        bf = G(6, 5, 'N')
        for x in range(6): bf[0][x] = 'n'; bf[1][x] = 'n'; bf[4][x] = 'B'
        bf[2][2] = bf[2][3] = 'B'
        bs = G(2, 5, 'N'); bs[0] = ['n', 'n']; bs[4] = ['B', 'B']
        parts.insert(0, box('sand_bag', (-3, 4.5, -4.5), (3, 9.5, -2.5), front=G(6, 5, 'N'), back=bf,
                            left=bs, right=[r[:] for r in bs], top=G(6, 2, 'n')))
        parts += antenna(19)
    elif kind == 'insaatci':
        # yuvarlak inşaat bareti (turuncu): kenar siperliği, kat kat kubbe, ortada sırt çizgisi
        def hat_side(w, h, top_c='G', mid='A', low='C'):
            g = G(w, h, mid)
            g[0] = [top_c] * w
            if h > 1:
                g[h - 1] = [low] * w
            return g
        def hat_top(w, d, ridge=True):
            g = G(w, d, 'A')
            for x in range(w): g[0][x] = 'G'
            for y in range(d): g[y][0] = 'G'; g[y][w - 1] = 'C'
            if ridge:
                c = w // 2
                for y in range(d): g[y][c - 1] = 'G'; g[y][c] = 'W' if y % 3 == 0 else 'G'
            return g
        parts.append(box('hat_rim', (-7, 17, -6), (7, 18, 6), front=[['A'] * 14], back=[['C'] * 14],
                         left=[['A'] * 12], right=[['C'] * 12], top=hat_top(14, 12, ridge=False)))
        parts.append(box('hat_visor', (-6, 17, 6), (6, 18, 8), front=[['G'] * 12], back=[['C'] * 12],
                         left=[['A', 'A']], right=[['C', 'C']], top=[['G'] * 12, ['A'] * 12]))
        parts.append(box('hat_dome1', (-6.5, 18, -5.5), (6.5, 20, 5.5), front=hat_side(13, 2),
                         back=hat_side(13, 2, 'A', 'C', 'C'), left=hat_side(11, 2), right=hat_side(11, 2, 'A', 'C', 'C'),
                         top=hat_top(13, 11)))
        parts.append(box('hat_dome2', (-5.5, 20, -4.5), (5.5, 22, 4.5), front=hat_side(11, 2, 'G', 'A', 'A'),
                         back=hat_side(11, 2, 'A', 'C', 'C'), left=hat_side(9, 2, 'G', 'A', 'A'),
                         right=hat_side(9, 2, 'A', 'C', 'C'), top=hat_top(11, 9)))
        parts.append(box('hat_dome3', (-4, 22, -3), (4, 23, 3), front=[['G'] * 8], back=[['C'] * 8],
                         left=[['G'] * 6], right=[['C'] * 6], top=hat_top(8, 6)))
        parts.append(box('hat_dome4', (-2, 23, -1.5), (2, 24, 1.5), front=[['G'] * 4], back=[['A'] * 4],
                         left=[['G'] * 3], right=[['A'] * 3], top=[['W', 'G', 'G', 'A'], ['G', 'G', 'A', 'A'], ['G', 'A', 'A', 'C']]))
        # alet kemeri: deri, ortada toka, solda çekiç, sağda metre
        bf = G(9, 2, 'm'); bf[0] = ['o'] * 9
        bf[0][4] = 'Y'; bf[1][4] = 'Q'
        bf[0][1] = 'c'; bf[1][1] = 'a'; bf[0][2] = 'c'
        bf[0][7] = 'y'; bf[1][7] = 'y'
        bs = G(6, 2, 'm'); bs[0] = ['o'] * 6
        parts.insert(5, box('toolbelt', (-4.5, 3, -3), (4.5, 5, 3), front=bf, back=G(9, 2, 'm'),
                            left=bs, right=[r[:] for r in bs], top=G(9, 6, 'o')))
        # sırtta plan rulosu (mavi kağıt)
        rf = G(8, 2, 'I'); rf[0] = ['J'] * 8; rf[1][0] = 'J'; rf[1][7] = 'J'
        parts.insert(0, box('blueprint', (-4, 7, -4), (4, 9, -2),
                            front=rf, back=[r[:] for r in rf], left=[['J', 'I'], ['I', 'J']], right=[['J', 'I'], ['I', 'J']],
                            top=G(8, 2, 'J')))
        parts += antenna(24)
    elif kind == 'toplayici':
        # sırt çantası: deri, kapaklı, önünde cep ve turkuaz toka
        pf = G(7, 6, 'u')
        pf[0] = ['v'] * 7; pf[1] = ['v'] * 7
        for y in range(2, 6): pf[y][0] = 'v'; pf[y][6] = 't'
        pf[5] = ['t'] * 7
        pf[1][3] = 'L'; pf[2][3] = 'H'
        for y in (3, 4):
            for x in (2, 3, 4): pf[y][x] = 'v' if y == 3 else 'u'
        ps = G(3, 6, 'u'); ps[0] = ['v'] * 3; ps[5] = ['t'] * 3
        parts.insert(0, box('backpack', (-3.5, 3.5, -5.5), (3.5, 9.5, -2.5), front=G(7, 6, 't'), back=pf,
                            left=ps, right=[r[:] for r in ps], top=G(7, 3, 'v')))
        # şık, modern şapka: düz siperlikli koyu şapka, önünde Aqualit taşı
        cf = G(10, 3, '1'); cf[0] = ['3'] * 10; cf[2] = ['2'] * 10
        cf[1][4] = 'H'; cf[1][5] = 'W'; cf[2][4] = 'L'; cf[2][5] = 'H'
        cs = G(9, 3, '1'); cs[0] = ['3'] * 9; cs[2] = ['2'] * 9
        ct = G(10, 9, '1')
        for x in range(10): ct[0][x] = '3'
        parts.append(box('cap', (-5, 19, -4.5), (5, 22, 4.5), front=cf, back=G(10, 3, '2'),
                         left=cs, right=[r[:] for r in cs], top=ct))
        tt = G(8, 7, '3')
        tt[3][3] = tt[3][4] = 'P'
        parts.append(box('cap_top', (-4, 22, -3.5), (4, 23, 3.5), front=[['3'] * 8], back=[['2'] * 8],
                         left=[['3'] * 7], right=[['2'] * 7], top=tt))
        bt = G(10, 4, '2'); bt[0] = ['1'] * 10; bt[3] = ['P'] * 10
        parts.append(box('cap_brim', (-5, 19, 4.5), (5, 20, 8.5), front=[['P'] * 10], back=[['k'] * 10],
                         left=[['k'] * 4], right=[['k'] * 4], top=bt))
        # vizör: gözlerin önünde çerçeve (ortası saydam, gözler görünür), mor ışıklı
        vf = [[' '] * 13 for _ in range(4)]
        vf[0] = ['P'] * 13; vf[3] = ['p'] * 13
        for y in range(4): vf[y][0] = 'P'; vf[y][12] = 'p'
        vf[1][6] = 'Z'
        parts.append(box('visor', (-6.5, 13, 5), (6.5, 17, 6), front=vf, back=[[' '] * 13 for _ in range(4)],
                         left=[['P']] * 4, right=[['p']] * 4, top=[['Z'] * 13], bottom=[['p'] * 13]))
        # kafa üstü kulaklık: şapkanın üstünden geçen bant, yanlarda iniş ve kulak pedleri
        parts.append(box('headband', (-7, 23, -1), (7, 24, 1),
                         front=[['b'] * 14], back=[['b'] * 14], left=[['b', 'b']], right=[['b', 'b']], top=G(14, 2, 'c')))
        for nm, x0 in (('band_l', -7), ('band_r', 6)):
            parts.append(box(nm, (x0, 16, -0.5), (x0 + 1, 23, 0.5), front=[['b']] * 7, back=[['b']] * 7,
                             left=[['b']] * 7, right=[['b']] * 7, top=[['c']]))
        pad = [['g', 'g', 'g'], ['g', 'L', 'g'], ['g', 'L', 'g'], ['g', 'g', 'g']]
        for nm, x0 in (('earpad_l', -8), ('earpad_r', 6)):
            parts.append(box(nm, (x0, 12, -1.5), (x0 + 2, 16, 1.5), front=G(2, 4, 'g'), back=G(2, 4, 'g'),
                             left=pad, right=[r[:] for r in pad], top=G(2, 3, 'g')))
        parts.append(box('mic', (5, 11, 1.5), (6, 12, 6.5), front=[['L']], back=[['g']], left=[['g'] * 5],
                         right=[['g'] * 5], top=[['g']] * 5))
        parts += antenna(24)
    elif kind == 'kilicli':
        cb = G(8, 8, 'r')
        for x in range(8): cb[0][x] = 'R'; cb[7][x] = 'q'
        for y in range(8): cb[y][0] = 'R'
        parts.insert(0, box('cape', (-4, 2, -3), (4, 10, -2.5), front=G(8, 8, 'q'), back=cb,
                            left=[['R']] * 8, right=[['q']] * 8, top=[['R'] * 8]))
        parts += antenna(19)
    return parts

# ---------------- cizim ----------------
def transform(parts, rot):
    """rot=0: on taraf +Z; rot=180: arkadan bakis"""
    out = []
    for p in parts:
        (x0, y0, z0), (x1, y1, z1) = p.a, p.b
        if rot == 0:
            out.append((p, (x0, y0, z0, x1, y1, z1), p.f['top'], p.f['front'], p.f['right']))
        else:
            top = [r[::-1] for r in p.f['top'][::-1]]
            out.append((p, (-x1, y0, -z1, -x0, y1, -z0), top, p.f['back'], p.f['left']))
    return out

def order(items):
    n = len(items)
    before = {i: set() for i in range(n)}
    for i in range(n):
        for j in range(n):
            if i == j: continue
            A, B = items[i][1], items[j][1]
            a_behind = A[3] <= B[0] or A[4] <= B[1] or A[5] <= B[2]
            b_behind = B[3] <= A[0] or B[4] <= A[1] or B[5] <= A[2]
            if a_behind and not b_behind: before[j].add(i)
            elif not a_behind and not b_behind and i < j: before[j].add(i)
    done, res = set(), []
    while len(res) < n:
        ready = [i for i in range(n) if i not in done and before[i] <= done]
        i = min(ready) if ready else min(i for i in range(n) if i not in done)
        done.add(i); res.append(items[i])
    return res

def render_iso(parts, rot=0, s=10, pad=24, bg=(24, 28, 32), k=0.3):
    items = order(transform(parts, rot))
    pts = []
    for _, (x0, y0, z0, x1, y1, z1), *_ in items:
        for x in (x0, x1):
            for y in (y0, y1):
                for z in (z0, z1):
                    pts.append(((x - z) * s * C30, (x + z) * s * k - y * s))
    mnx = min(p[0] for p in pts); mxx = max(p[0] for p in pts)
    mny = min(p[1] for p in pts); mxy = max(p[1] for p in pts)
    W, H = int(mxx - mnx) + 2 * pad, int(mxy - mny) + 2 * pad
    img = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(img)
    ox, oy = pad - mnx, pad - mny
    P = lambda x, y, z: (ox + (x - z) * s * C30, oy + (x + z) * s * k - y * s)
    def quad(q, c): d.polygon([P(*p) for p in q], fill=c, outline=c)
    for _, (x0, y0, z0, x1, y1, z1), top, front, right in items:
        fr = to_img(front); w, h = fr.size
        for j in range(h):
            for i in range(w):
                c = fr.getpixel((i, j))
                if c[3] == 0: continue
                xa, xb = x0 + i * (x1 - x0) / w, x0 + (i + 1) * (x1 - x0) / w
                ya, yb = y1 - (j + 1) * (y1 - y0) / h, y1 - j * (y1 - y0) / h
                quad([(xa, yb, z1), (xb, yb, z1), (xb, ya, z1), (xa, ya, z1)], shade(c, 0.88))
        rt = to_img(right); w, h = rt.size
        for j in range(h):
            for i in range(w):
                c = rt.getpixel((i, j))
                if c[3] == 0: continue
                za, zb = z1 - i * (z1 - z0) / w, z1 - (i + 1) * (z1 - z0) / w
                ya, yb = y1 - (j + 1) * (y1 - y0) / h, y1 - j * (y1 - y0) / h
                quad([(x1, yb, za), (x1, yb, zb), (x1, ya, zb), (x1, ya, za)], shade(c, 0.7))
        tp = to_img(top); w, dd = tp.size
        for j in range(dd):
            for i in range(w):
                c = tp.getpixel((i, j))
                if c[3] == 0: continue
                xa, xb = x0 + i * (x1 - x0) / w, x0 + (i + 1) * (x1 - x0) / w
                za, zb = z0 + j * (z1 - z0) / dd, z0 + (j + 1) * (z1 - z0) / dd
                quad([(xa, y1, za), (xb, y1, za), (xb, y1, zb), (xa, y1, zb)], shade(c, 1.0))
    return img

def render_front(parts, s=12, pad=24, bg=(24, 28, 32)):
    xs = [p.a[0] for p in parts] + [p.b[0] for p in parts]
    ys = [p.a[1] for p in parts] + [p.b[1] for p in parts]
    W = int((max(xs) - min(xs)) * s) + 2 * pad
    H = int((max(ys) - min(ys)) * s) + 2 * pad
    img = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(img)
    X = lambda x: pad + (x - min(xs)) * s
    Y = lambda y: pad + (max(ys) - y) * s
    for p in sorted(parts, key=lambda p: p.b[2]):
        fr = to_img(p.f['front']); w, h = fr.size
        (x0, y0, z0), (x1, y1, z1) = p.a, p.b
        for j in range(h):
            for i in range(w):
                c = fr.getpixel((i, j))
                if c[3] == 0: continue
                xa, xb = x0 + i * (x1 - x0) / w, x0 + (i + 1) * (x1 - x0) / w
                yb, ya = y1 - j * (y1 - y0) / h, y1 - (j + 1) * (y1 - y0) / h
                d.rectangle([X(xa), Y(yb), X(xb) - 1, Y(ya) - 1], fill=c[:3])
    return img

NAMES = {'madenci': 'Madenci Robot', 'kurekci': 'Kürekçi Robot', 'ciftci': 'Çiftçi Robot',
         'oduncu': 'Oduncu Robot', 'kilicli': 'Kılıçlı Robot'}
DETAY = {'madenci': 'Kask ve kafa lambası', 'kurekci': 'Kum rengi botlar, sırtta kum torbası',
         'ciftci': 'Hasır şapka, antenin ucu filiz', 'oduncu': 'Yeşil atkı, antenin ucu yaprak',
         'kilicli': 'Kırmızı pelerin, yanak işaretleri, kararlı bakış'}

if __name__ == '__main__':
    import sys
    from kompoz import compose
    kinds = sys.argv[1:] or list(NAMES)
    for k in kinds:
        parts = robot(k)
        a = render_iso(parts, 0); b = render_front(parts); c = render_iso(parts, 180)
        compose(NAMES[k], [(a, '3/4 önden'), (b, 'Önden'), (c, '3/4 arkadan')],
                f'onizleme/robot_{k}.png', note=DETAY[k])
        print('ok', k)
