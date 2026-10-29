"""Kabuk ve taş zırhları: eşya simgeleri, zırh modeli (giyilebilir geometri) ve dokuları.

Kurallar: koyu dış çizgi yok; kenarlar kendi renginin koyusuyla gölgelenir.
"""
import json
import math
import os
import random
import shutil
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
VAN = os.path.join(HERE, '..', '..', 'vanilla')

# anahtar, Türkçe ad, kabuk dokusu, soyulmuş doku, kütük blokları, yaprak rengi
TREES = [
    ('mese', 'Meşe', 'log_oak', 'stripped_oak_log', ['oak_log', 'oak_wood'], (78, 134, 44)),
    ('hus', 'Huş', 'log_birch', 'stripped_birch_log', ['birch_log', 'birch_wood'], (118, 160, 62)),
    ('ladin', 'Ladin', 'log_spruce', 'stripped_spruce_log', ['spruce_log', 'spruce_wood'], (52, 98, 58)),
    ('kiraz', 'Kiraz', 'cherry_log_side', 'stripped_cherry_log_side', ['cherry_log', 'cherry_wood'], (246, 172, 206)),
    ('akasya', 'Akasya', 'log_acacia', 'stripped_acacia_log', ['acacia_log', 'acacia_wood'], (112, 146, 34)),
    ('orman', 'Orman', 'log_jungle', 'stripped_jungle_log', ['jungle_log', 'jungle_wood'], (64, 146, 32)),
    ('koyu_mese', 'Koyu Meşe', 'log_big_oak', 'stripped_dark_oak_log', ['dark_oak_log', 'dark_oak_wood'], (58, 108, 32)),
    ('mangrov', 'Mangrov', 'mangrove_log_side', 'stripped_mangrove_log_side', ['mangrove_log', 'mangrove_wood'],
     (74, 130, 48)),
    ('soluk_mese', 'Soluk Meşe', 'pale_oak_log_side', 'stripped_pale_oak_log_side', ['pale_oak_log', 'pale_oak_wood'],
     (176, 184, 168)),
    ('kavak', 'Kavak', 'poplar_log_side', 'stripped_poplar_log_side', ['poplar_log', 'poplar_wood'], (238, 178, 62)),
    # Nether kabukları (Kabuk Zırhları v1.2.1): dokular hazır PNG'lerden aynen alınır (dokular/kabuk_hazir)
    ('kizil_nether', 'Kızıl Nether', None, None, ['crimson_stem', 'crimson_hyphae'], (150, 30, 44)),
    ('carpik_nether', 'Çarpık Nether', None, None, ['warped_stem', 'warped_hyphae'], (22, 140, 132)),
]
# ateşe dayanıklı (yanmaz) kabuklar
NETHER = ['kizil_nether', 'carpik_nether']
HAZIR = os.path.join(HERE, '..', '..', 'dokular', 'kabuk_hazir')
# kabuk zırhı parçalarının gerçek dayanıklılığı ve etki payları (Kabuk Zırhları v1.2.1)
BARK_MAX = {'helmet': 40, 'chest': 60, 'legs': 55, 'boots': 45}
BARK_SHARE = {'helmet': 0.25, 'chest': 0.75, 'legs': 0.5, 'boots': 0.25}

STONES = [
    # anahtar, ad, ana doku, levha dokusu, kemer dokusu, göğüs işareti sayısı (yalnız görünüş)
    ('tas', 'Taş', 'stone', 'stone', 'cobblestone', 1),
    ('derin_kayrak', 'Derin Kayrak', 'deepslate_tiles', 'polished_deepslate', 'cobbled_deepslate', 2),
]
# Taş zırh: özel özelliği yok, deri zırhla aynı değerler. Derin kayrak: deriden biraz güçlü, bakırın altında.
#   deri/taş       1/3/2/1 = 7  dayanıklılık 55/80/75/65    (çarpan 5)
#   derin kayrak   2/3/2/1 = 8  dayanıklılık 88/128/120/104 (çarpan 8)
#   (bakır         2/4/3/1 = 10 dayanıklılık 121/176/165/143, çarpan 11)
ARMOR_BASE = {'helmet': 11, 'chest': 16, 'legs': 15, 'boots': 13}   # oyunun dayanıklılık tabanı
STONE_STATS = {
    'tas': {'prot': {'helmet': 1, 'chest': 3, 'legs': 2, 'boots': 1}, 'mult': 5, 'ench': 15,
            'repair': 'minecraft:stone'},
    'derin_kayrak': {'prot': {'helmet': 2, 'chest': 3, 'legs': 2, 'boots': 1}, 'mult': 8, 'ench': 12,
                     'repair': 'minecraft:cobbled_deepslate'},
}

# büyüler: anahtar, ad, zırh türü, azami seviye, sembol, kapak rengi, sembol rengi
ENCHANTS = [
    ('esnek_lifler', 'Esnek Lifler', 'kabuk', 3, 'wave', (74, 120, 52), (236, 214, 140)),
    ('hafif_adimlar', 'Hafif Adımlar', 'kabuk', 3, 'feather', (70, 128, 86), (240, 244, 236)),
    ('orman_golgesi', 'Orman Gölgesi', 'kabuk', 3, 'leaf', (42, 72, 46), (120, 196, 96)),
    ('recine_korumasi', 'Reçine Koruması', 'kabuk', 3, 'drop', (110, 82, 44), (250, 152, 46)),
    ('son_kabuk', 'Son Kabuk', 'kabuk', 1, 'shield', (96, 70, 40), (210, 236, 120)),
    ('dusus_asinmasi', 'Düşüş Aşınması', 'kabuk', 3, 'down', (66, 104, 112), (226, 240, 246)),
]
INCOMPATIBLE = [('orman_golgesi', 'hafif_adimlar')]


def tex(path):
    for sub in ('agac', 'tas', ''):
        p = os.path.join(VAN, sub, path + '.png')
        if os.path.exists(p):
            return Image.open(p).convert('RGBA')
    raise FileNotFoundError(path)


def mul(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c[:3])


def mix(a, b, t):
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))


def avg(img, box=None):
    im = img.crop(box) if box else img
    px = [p for p in im.getdata() if p[3] > 0]
    return tuple(sum(p[i] for p in px) // len(px) for i in range(3))


# ====================================================================== simgeler (16x16)
CHEST = [
    '................',
    '.SSSS......SSSS.',
    'SAAAAS....SAAAAS',
    'SAAAAATTTTAAAAAS',
    '.SAAAAAAAAAAAAS.',
    '..SAAAAAAAAAAS..',
    '...AAAAAAAAAA...',
    '...AAAAAAAAAA...',
    '...AAAAAAAAAA...',
    '...AAAAAAAAAA...',
    '...BBBBBBBBBB...',
    '...AAAAAAAAAA...',
    '...AAAAAAAAAA...',
    '...AAAAAAAAAA...',
    '....AAAAAAAA....',
    '................',
]


def put(img, x, y, c, a=255):
    if 0 <= x < 16 and 0 <= y < 16:
        img.putpixel((x, y), tuple(c[:3]) + (a,))


def chest_mask():
    m = {}
    for y, row in enumerate(CHEST):
        for x, ch in enumerate(row):
            if ch != '.':
                m[(x, y)] = ch
    return m


def edge_shade(img, base_k=0.72):
    """Saydam komşusu olan pikselleri kendi renginin koyusuyla gölgele (siyah çizgi yok)."""
    out = img.copy()
    W, H = img.size
    for y in range(H):
        for x in range(W):
            p = img.getpixel((x, y))
            if p[3] == 0:
                continue
            n_empty = 0
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if not (0 <= xx < W and 0 <= yy < H) or img.getpixel((xx, yy))[3] == 0:
                    n_empty += 1
            if n_empty:
                # sağ ve alt kenar daha koyu, sol ve üst biraz açık
                right = (x + 1 >= W or img.getpixel((x + 1, y))[3] == 0)
                below = (y + 1 >= H or img.getpixel((x, y + 1))[3] == 0)
                k = base_k if (right or below) else 1.08
                out.putpixel((x, y), mul(p, k) + (255,))
    return out


BARK_GRID = [
    '................',
    '....BB.BBB......',
    '...BBBBBBBBi....',
    '...BBBBBBBBbi...',
    '..BBBBBBBBBbi...',
    '..BBBBBBBBBbi...',
    '..BBBBBBBBBbi...',
    '..BBBBBBBBBbi...',
    '..BBBBBBBBBbi...',
    '..BBBBBBBBBbi...',
    '...BBBBBBBBbi...',
    '...BBBBBBBBbi...',
    '...BBBBBBBBi....',
    '....BB.BBB......',
    '................',
    '................',
]


def tones(img, qs):
    px = sorted((p[:3] for p in img.getdata() if p[3] > 0), key=lum3)
    return [px[min(len(px) - 1, int(q * len(px)))] for q in qs]


def bark_icon(tree):
    """Kabuk levhası: o ağacın gerçek kabuk deseni, sağda kıvrılan iç ahşap kalınlığı."""
    key, _, bark_t, strip_t, _, _ = tree
    bark, inner = tex(bark_t), tex(strip_t)
    i1, i2 = tones(inner, (0.3, 0.8))
    img = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(BARK_GRID):
        for x, ch in enumerate(row):
            if ch == '.':
                continue
            if ch == 'B':
                c = bark.getpixel(((x + 2) % 16, (y + 1) % 16))[:3]
                k = 1.14 if x <= 3 else (1.0 if x <= 7 else 0.9)   # kıvrık levha: sol açık, sağ koyu
                put(img, x, y, mul(c, k))
            elif ch == 'b':
                put(img, x, y, mul(bark.getpixel(((x + 2) % 16, (y + 1) % 16))[:3], 0.72))
            elif ch == 'i':
                put(img, x, y, mul(i2, 1.05) if y % 3 else i1)
    return edge_shade(img, 0.8)


def contrast(c, mean, f):
    return tuple(max(0, min(255, int(mean[i] + (c[i] - mean[i]) * f))) for i in range(3))


def lum3(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def bark_armor_icon(tree):
    key, _, bark_t, strip_t, _, leaf = tree
    bark, inner = tex(bark_t), tex(strip_t)
    m = chest_mask()
    img = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    vine = (60, 98, 40)
    for (x, y), ch in m.items():
        c = bark.getpixel(((x + 3) % 16, (y * 1) % 16))[:3]
        k = 1.10 if x < 8 else 0.94
        if ch == 'S':      # omuz levhası: kenar iç ahşap
            c = mix(c, inner.getpixel((x % 16, y % 16))[:3], 0.35)
            k = 1.12 if x < 8 else 0.98
        if ch == 'T':      # yaka: soyulmuş ahşap
            c = inner.getpixel((x % 16, 2))[:3]
            k = 1.02
        if ch == 'B':      # kemer: sarmaşık
            c = vine if (x + y) % 3 else mul(vine, 1.25)
            k = 1.0
        put(img, x, y, mul(c, k))
    # orta dikiş: soyulmuş ahşap şeridi (ön kapama)
    for y in range(4, 14):
        if (7, y) in m and m[(7, y)] == 'A':
            put(img, 7, y, mul(inner.getpixel((7, y))[:3], 0.9))
    # kemer tokası: yaprak
    put(img, 7, 10, leaf)
    put(img, 8, 10, mul(leaf, 1.15))
    put(img, 8, 9, mul(leaf, 0.9))
    # omuzlarda yosun / yaprak
    for (x, y) in [(2, 2), (3, 1), (12, 1), (13, 2)]:
        put(img, x, y, mix(leaf, (90, 150, 60), 0.3))
    put(img, 1, 2, mul(leaf, 1.12))
    return edge_shade(img)


STONE_GRID = [
    '................',
    'PPPP........PPPP',
    'PPPPP......PPPPP',
    'PPPPPATTTTAPPPPP',
    'PPPPPAAAAAAPPPPP',
    '.PPPAcccccAAPPP.',
    '..AAAcccccAAAA..',
    '...AAcccccAAA...',
    '...AAcccccAAA...',
    '...AAAAAAAAAA...',
    '...BBBBBBBBBB...',
    '...AAAAAAAAAA...',
    '...AAAAAAAAAA...',
    '....AAAAAAAA....',
    '................',
    '................',
]


def stone_armor_icon(st):
    key, _, base_t, plate_t, belt_t, charges = st
    base, plate, belt = tex(base_t), tex(plate_t), tex(belt_t)
    img = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    bc, pc, kc = avg(base), avg(plate), avg(belt)
    rnd = random.Random(key)
    for y, row in enumerate(STONE_GRID):
        for x, ch in enumerate(row):
            if ch == '.':
                continue
            n = 1 + (rnd.random() - 0.5) * 0.12      # hafif taş benekleri
            if ch == 'P':
                left = x < 8
                x0, x1 = (0, 4) if left else (11, 15)
                top, bottom = 1, 4 if not (x in (0, 15)) else 4
                c = mix(kc, bc, 0.5)
                if y == 1 or x == x0:
                    k = 1.32
                elif y == 4 or x == x1 or (y == 5 and x in (1, 14)):
                    k = 0.7
                else:
                    k = 1.08 if left else 0.96
            elif ch == 'c':
                c = mix(pc, (255, 255, 255), 0.06)
                k = 1.26 if (y == 5 or x == 5) else (0.76 if (y == 8 or x == 9) else 1.08)
            elif ch == 'B':
                c = kc
                k = 0.78 if (x % 3 == 0) else 0.94
            elif ch == 'T':
                c = pc
                k = 1.12
            else:
                c = bc
                k = (1.04 if x < 8 else 0.9)
            put(img, x, y, mul(c, k * n))
    if key == 'derin_kayrak':
        # derin kayrak: karo çizgileri
        for y in (7, 12):
            for x in range(4, 12):
                if img.getpixel((x, y))[3]:
                    put(img, x, y, mul(img.getpixel((x, y)), 0.8))
    for i in range(charges):
        put(img, 6 + i, 7, mul(pc, 0.5))
    for (x, y) in [(4, 11), (5, 12), (11, 6), (12, 7)]:
        put(img, x, y, mul(bc, 0.68))
    return edge_shade(img, 0.66)


SYMBOLS = {
    'wave': ['.....', 'x.x.x', '.x.x.', '.....', 'x.x.x', '.x.x.'],
    'feather': ['...xx', '..xxx', '.xxx.', '.xx..', 'x....', '.....'],
    'leaf': ['..x..', '.xxx.', 'xxxxx', '.xxx.', '..x..', '..x..'],
    'drop': ['..x..', '..x..', '.xxx.', 'xxxxx', 'xxxxx', '.xxx.'],
    'shield': ['xxxxx', 'xxxxx', 'xxxxx', '.xxx.', '..x..', '.....'],
    'down': ['..x..', '..x..', 'xxxxx', '.xxx.', '..x..', 'xxxxx'],
    'mountain': ['.....', '..x..', '.xxx.', '.xxx.', 'xxxxx', 'xxxxx'],
    'arcs': ['x....', '.x.x.', '.x..x', '.x..x', '.x.x.', 'x....'],
    'plus': ['.....', '..x..', '.xxx.', '..x..', '.....', 'xxxxx'],
    'bolt': ['...x.', '..x..', '.xxx.', '..x..', '.x...', '.....'],
    'burst': ['x...x', '.x.x.', '..x..', '.x.x.', 'x...x', '.....'],
}


def book_icon(ench):
    key, _, kind, _, sym, cover, symc = ench
    img = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    page = (238, 230, 206)
    spine = mul(cover, 0.7)
    for y in range(1, 15):
        for x in range(3, 14):
            if x == 3 or (y == 1 and x < 13) or (y == 14 and x < 13):
                c = spine if x == 3 else mul(cover, 0.85)
            elif x >= 12 and y >= 2:
                c = page if (y % 2 == 0) else mul(page, 0.92)
            elif y == 14:
                c = page
            else:
                c = cover
                if kind == 'kabuk' and (x * 7 + y * 3) % 11 == 0:
                    c = mul(cover, 0.88)      # deri dokusu
                if kind == 'tas' and (x * 5 + y * 9) % 13 == 0:
                    c = mul(cover, 1.12)      # taş benekleri
            put(img, x, y, c)
    # köşe süsleri
    corner = (214, 178, 84) if kind == 'kabuk' else (186, 190, 198)
    for (x, y) in [(4, 2), (11, 2), (4, 12), (11, 12)]:
        put(img, x, y, corner)
    # sembol
    rows = SYMBOLS[sym]
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == 'x':
                put(img, 5 + i, 4 + j, symc)
    # parıltı (büyülü)
    put(img, 10, 3, (255, 255, 255))
    put(img, 5, 11, mul(symc, 1.1))
    return edge_shade(img, 0.75)


def build_icons(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    names = {}
    for t in TREES:
        if t[2] is None:   # hazır doku
            for n in [f'kabuk_{t[0]}'] + [bark_id(t[0], p[0]) for p in PIECES]:
                shutil.copyfile(os.path.join(HAZIR, 'items', n + '.png'), os.path.join(out_dir, n + '.png'))
            continue
        bark_icon(t).save(os.path.join(out_dir, f'kabuk_{t[0]}.png'))
        for p in PIECES:
            bark_piece_icon(t, p[0]).save(os.path.join(out_dir, bark_id(t[0], p[0]) + '.png'))
    for st in STONES:
        for p in PIECES:
            stone_piece_icon(st, p[0]).save(os.path.join(out_dir, stone_id(st[0], p[0]) + '.png'))
    for e in ENCHANTS:
        book_icon(e).save(os.path.join(out_dir, f'buyu_{e[0]}.png'))
    return names


# ====================================================================== zırh modeli
# (kemik, köken, boyut, şişirme, malzeme)
BARK_CUBES = [
    ('body', [-4, 12, -2], [8, 12, 4], 0.55, 'bark'),
    ('body', [-4, 13, -2], [8, 1, 4], 0.85, 'vine'),
    ('body', [-4, 23, -2], [8, 1, 4], 0.9, 'inner'),
    ('body', [-1, 13, -2], [2, 9, 1], 0.62, 'inner_strip'),
    ('rightArm', [-9, 21, -3], [5, 3, 6], 0.15, 'pad'),
    ('rightArm', [-8, 16, -2], [4, 5, 4], 0.45, 'bark'),
    ('leftArm', [4, 21, -3], [5, 3, 6], 0.15, 'pad'),
    ('leftArm', [4, 16, -2], [4, 5, 4], 0.45, 'bark'),
    ('leftArm', [5, 24, -1], [3, 2, 2], 0.0, 'leaf'),
    ('leftArm', [7, 25, 0], [2, 1, 1], 0.0, 'leaf2'),
]
STONE_CUBES = [
    ('body', [-4, 12, -2], [8, 12, 4], 0.7, 'base'),
    ('body', [-3, 15, -3], [6, 7, 1], 0.25, 'plate'),
    ('body', [-3, 15, 2], [6, 7, 1], 0.25, 'plate'),
    ('body', [-4, 12, -2], [8, 2, 4], 1.0, 'belt'),
    ('rightArm', [-10, 20, -3], [6, 5, 6], 0.0, 'pauldron'),
    ('rightArm', [-9, 25, -2], [4, 1, 4], 0.0, 'belt'),
    ('rightArm', [-8, 12, -2], [4, 4, 4], 0.55, 'belt'),
    ('leftArm', [4, 20, -3], [6, 5, 6], 0.0, 'pauldron'),
    ('leftArm', [5, 25, -2], [4, 1, 4], 0.0, 'belt'),
    ('leftArm', [4, 12, -2], [4, 4, 4], 0.55, 'belt'),
]
PIVOTS = {'body': [0, 24, 0], 'rightArm': [-5, 22, 0], 'leftArm': [5, 22, 0], 'head': [0, 24, 0],
          'rightLeg': [-1.9, 12, 0], 'leftLeg': [1.9, 12, 0]}
PARENTS = {'body': 'waist', 'rightArm': 'body', 'leftArm': 'body', 'head': 'body', 'rightLeg': 'body', 'leftLeg': 'body'}

BARK_PIECES = {
    'chest': BARK_CUBES,
    'helmet': [
        ('head', [-4, 24, -4], [8, 8, 8], 1.0, 'helm'),
        ('head', [-4, 24, -4], [8, 1, 8], 1.2, 'inner'),
        ('head', [-1, 33, -2], [3, 1, 2], 0.0, 'leaf'),
        ('head', [0, 34, -1], [1, 1, 1], 0.0, 'leaf2'),
    ],
    'legs': [
        ('body', [-4, 12, -2], [8, 2, 4], 0.6, 'vine'),
        ('rightLeg', [-3.9, 4, -2], [4, 8, 4], 0.45, 'bark'),
        ('leftLeg', [-0.1, 4, -2], [4, 8, 4], 0.45, 'bark'),
        ('rightLeg', [-3.9, 6, -3], [4, 2, 1], 0.1, 'inner'),
        ('leftLeg', [-0.1, 6, -3], [4, 2, 1], 0.1, 'inner'),
    ],
    'boots': [
        ('rightLeg', [-3.9, 0, -2], [4, 4, 4], 0.6, 'bark'),
        ('leftLeg', [-0.1, 0, -2], [4, 4, 4], 0.6, 'bark'),
        ('rightLeg', [-3.9, 3, -2], [4, 1, 4], 0.78, 'inner'),
        ('leftLeg', [-0.1, 3, -2], [4, 1, 4], 0.78, 'inner'),
    ],
}
STONE_PIECES = {
    'chest': STONE_CUBES,
    'helmet': [
        ('head', [-4, 24, -4], [8, 8, 8], 1.0, 'helm'),
        ('head', [-3, 33, -3], [6, 1, 6], 0.0, 'belt'),
        ('head', [-4, 24, -4], [8, 1, 8], 1.25, 'belt'),
    ],
    'legs': [
        ('body', [-4, 12, -2], [8, 2, 4], 1.0, 'belt'),
        ('rightLeg', [-3.9, 3, -2], [4, 9, 4], 0.6, 'base'),
        ('leftLeg', [-0.1, 3, -2], [4, 9, 4], 0.6, 'base'),
        ('rightLeg', [-3.9, 6, -3], [4, 4, 1], 0.15, 'plate'),
        ('leftLeg', [-0.1, 6, -3], [4, 4, 1], 0.15, 'plate'),
    ],
    'boots': [
        ('rightLeg', [-3.9, 0, -3], [4, 3, 5], 0.5, 'pauldron'),
        ('leftLeg', [-0.1, 0, -3], [4, 3, 5], 0.5, 'pauldron'),
    ],
}
# parça: anahtar, kabuk kimlik eki, kabuk ad eki, taş kimlik eki, taş ad eki, yuva, koruma (kabuk), tarif, katman değişkeni, vanilla simge
PIECES = [
    ('helmet', 'migferi', 'Kabuk Miğferi', 'migfer', 'Miğfer', 'slot.armor.head', 1, ['KKK', 'K K'],
     'helmet_layer_visible', 'diamond_helmet'),
    ('chest', 'zirhi', 'Kabuk Göğüslüğü', 'zirh', 'Göğüslük', 'slot.armor.chest', 2, ['K K', 'KKK', 'KKK'],
     'chest_layer_visible', None),
    ('legs', 'pantolonu', 'Kabuk Pantolonu', 'pantolon', 'Pantolon', 'slot.armor.legs', 1, ['KKK', 'K K', 'K K'],
     'leg_layer_visible', 'diamond_leggings'),
    ('boots', 'botu', 'Kabuk Botu', 'bot', 'Bot', 'slot.armor.feet', 1, ['K K', 'K K'], 'boot_layer_visible',
     'diamond_boots'),
]


def bark_id(tree_key, piece):
    p = next(x for x in PIECES if x[0] == piece)
    return f'kabuk_{p[1]}_{tree_key}'


def stone_id(st_key, piece):
    p = next(x for x in PIECES if x[0] == piece)
    return f'{st_key}_{p[3]}'


def stone_name(st, piece):
    p = next(x for x in PIECES if x[0] == piece)
    base = st[1]
    if st[0] == 'tas':
        return f'Taş {p[4]}'
    suffix = {'Miğfer': 'Miğferi', 'Göğüslük': 'Göğüslüğü', 'Pantolon': 'Pantolonu', 'Bot': 'Botu'}[p[4]]
    return f'{base} {suffix}'
TEX_W, TEX_H = 64, 64


def pack(cubes):
    """Kutu UV için basit raf yerleşimi; her küpün (u, v) değerini döndürür."""
    out, x, y, row_h = [], 0, 0, 0
    for (_, _, (w, h, d), _, _) in cubes:
        bw, bh = 2 * (d + w), d + h
        if x + bw > TEX_W:
            x, y, row_h = 0, y + row_h, 0
        out.append((x, y))
        x += bw
        row_h = max(row_h, bh)
    assert y + row_h <= TEX_H, 'doku alanı yetmedi'
    return out


def geometry(ident, cubes):
    uvs = pack(cubes)
    bones = {'waist': {'name': 'waist', 'pivot': [0, 12, 0]},
             'body': {'name': 'body', 'parent': 'waist', 'pivot': [0, 24, 0], 'cubes': []}}
    for (bone, origin, size, inflate, _), uv in zip(cubes, uvs):
        b = bones.setdefault(bone, {'name': bone, 'parent': PARENTS[bone], 'pivot': PIVOTS[bone], 'cubes': []})
        c = {'origin': origin, 'size': size, 'uv': list(uv)}
        if inflate:
            c['inflate'] = inflate
        b['cubes'].append(c)
    return {'format_version': '1.12.0', 'minecraft:geometry': [{
        'description': {'identifier': ident, 'texture_width': TEX_W, 'texture_height': TEX_H,
                        'visible_bounds_width': 3, 'visible_bounds_height': 3.5, 'visible_bounds_offset': [0, 1.25, 0]},
        'bones': list(bones.values()),
    }]}


def faces(u, v, w, h, d):
    return {
        'up': (u + d, v, w, d), 'down': (u + d + w, v, w, d),
        'east': (u, v + d, d, h), 'north': (u + d, v + d, w, h),
        'west': (u + d + w, v + d, d, h), 'south': (u + 2 * d + w, v + d, w, h),
    }


FACE_K = {'up': 1.14, 'down': 0.7, 'north': 1.0, 'south': 0.9, 'east': 0.86, 'west': 0.92}


def helm_open(face, i, j):
    """Miğferin yüz açıklığı ve alt yüzü saydam."""
    return face == 'down' or (face == 'north' and 3 <= j <= 7 and 1 <= i <= 6)


def paint(img, cubes, material_fn):
    uvs = pack(cubes)
    for (bone, origin, (w, h, d), _, mat), (u, v) in zip(cubes, uvs):
        for face, (fu, fv, fw, fh) in faces(u, v, w, h, d).items():
            for j in range(fh):
                for i in range(fw):
                    if mat == 'helm' and helm_open(face, i, j):
                        continue
                    c = material_fn('bark' if mat == 'helm' and material_fn.__name__ == 'mat_b' else mat, face, i, j, fw, fh, bone)
                    if c is None:
                        continue
                    k = FACE_K[face]
                    # kabartma: üst kenar açık, alt kenar koyu (dış çizgi değil, hacim)
                    if face not in ('up', 'down'):
                        if j == 0:
                            k *= 1.12
                        elif j == fh - 1:
                            k *= 0.84
                    img.putpixel((fu + i, fv + j), mul(c, k) + (255,))


def bark_texture(tree, cubes=None):
    cubes = cubes or BARK_CUBES
    key, _, bark_t, strip_t, _, leaf = tree
    bark, inner = tex(bark_t), tex(strip_t)
    vine = (60, 98, 40)
    rnd = random.Random(key)
    moss = [(rnd.randrange(16), rnd.randrange(16)) for _ in range(7)]

    def mat_b(m, face, i, j, fw, fh, bone):
        sx = (i + (3 if bone in ('rightArm', 'rightLeg') else 9 if bone in ('leftArm', 'leftLeg') else 0)) % 16
        sy = (j + (5 if face in ('east', 'west') else 0)) % 16
        if m == 'bark':
            c = bark.getpixel((sx, sy))[:3]
            if face == 'up' and (i, j) in [(p[0] % max(1, fw), p[1] % max(1, fh)) for p in moss[:3]]:
                c = mix(c, (88, 140, 52), 0.7)
            return c
        if m == 'pad':
            c = bark.getpixel(((sx * 2) % 16, sy))[:3]
            if face == 'up' and (i + j * 3) % 4 == 0:
                c = mix(c, (92, 146, 56), 0.75)       # yosun
            if face in ('north', 'south', 'east', 'west') and j == fh - 1:
                c = inner.getpixel((sx, 3))[:3]       # alt kenar: iç ahşap
            return c
        if m == 'inner':
            return mul(inner.getpixel((sx, sy))[:3], 1.04)
        if m == 'inner_strip':
            c = inner.getpixel((sx, sy))[:3]
            if face == 'north' and j in (2, 5, 8) and i == 0:
                c = mul(c, 0.7)                        # düğme izi
            return c
        if m == 'vine':
            c = vine if (i + j) % 3 else mul(vine, 1.3)
            if face == 'north' and i in (3, 4) and j in (0, 1):
                c = leaf if i == 3 else mul(leaf, 1.15)   # toka: yaprak
            return c
        if m == 'leaf':
            return leaf if (i + j) % 2 else mul(leaf, 1.18)
        if m == 'leaf2':
            return mul(leaf, 0.92)
        return None
    img = Image.new('RGBA', (TEX_W, TEX_H), (0, 0, 0, 0))
    paint(img, cubes, mat_b)
    return img


def stone_texture(st, cubes=None):
    cubes = cubes or STONE_CUBES
    key, _, base_t, plate_t, belt_t, charges = st
    base, plate, belt = tex(base_t), tex(plate_t), tex(belt_t)
    pc = avg(plate)

    def mat(m, face, i, j, fw, fh, bone):
        sx, sy = i % 16, (j + (4 if face in ('east', 'west') else 0)) % 16
        if m in ('base', 'helm'):
            return base.getpixel((sx, sy))[:3]
        if m == 'plate':
            c = mix(plate.getpixel((sx, sy))[:3], mix(pc, (255, 255, 255), 0.08), 0.72)
            if face in ('north', 'south') and (i == 0 or j == 0):
                c = mul(c, 1.18)
            if face in ('north', 'south') and (i == fw - 1 or j == fh - 1):
                c = mul(c, 0.8)
            if face == 'north' and j == 3 and i in range(1, 1 + charges * 2, 2):
                c = mul(c, 0.6)                        # hak çentikleri
            if face == 'north' and (i, j) in [(4, 5), (5, 6), (4, 6)]:
                c = mul(c, 0.72)                       # çatlak
            return c
        if m == 'belt':
            return belt.getpixel(((sx * 2) % 16, (sy * 2) % 16))[:3]
        if m == 'pauldron':
            c = belt.getpixel(((sx + 7) % 16, (sy + 3) % 16))[:3]
            if face == 'up':
                c = mix(c, base.getpixel((sx, sy))[:3], 0.5)
            return c
        return None
    img = Image.new('RGBA', (TEX_W, TEX_H), (0, 0, 0, 0))
    paint(img, cubes, mat)
    return img


def attachable(item_id, tex_path, geo_id, layer_var='chest_layer_visible'):
    return {'format_version': '1.10.0', 'minecraft:attachable': {'description': {
        'identifier': item_id,
        'materials': {'default': 'armor', 'enchanted': 'armor_enchanted'},
        'textures': {'default': tex_path, 'enchanted': 'textures/misc/enchanted_actor_glint'},
        'geometry': {'default': geo_id},
        'scripts': {'parent_setup': f'variable.{layer_var} = 0.0;'},
        'render_controllers': ['controller.render.armor'],
    }}}


def build_rp(rp):
    """RP: zırh geometrileri, dokular, giyilebilirler (4 parça)."""
    os.makedirs(f'{rp}/models/entity', exist_ok=True)
    os.makedirs(f'{rp}/textures/models/armor', exist_ok=True)
    os.makedirs(f'{rp}/attachables', exist_ok=True)
    w = lambda p, d: json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for p in PIECES:
        key, layer = p[0], p[8]
        w(f'{rp}/models/entity/aqualit_kabuk_{key}.geo.json', geometry(f'geometry.aqualit.kabuk_{key}', BARK_PIECES[key]))
        w(f'{rp}/models/entity/aqualit_tas_{key}.geo.json', geometry(f'geometry.aqualit.tas_{key}', STONE_PIECES[key]))
        for t in TREES:
            iid = bark_id(t[0], key)
            if t[2] is None:
                shutil.copyfile(os.path.join(HAZIR, 'armor', iid + '.png'), f'{rp}/textures/models/armor/aqualit_{iid}.png')
            else:
                bark_texture(t, BARK_PIECES[key]).save(f'{rp}/textures/models/armor/aqualit_{iid}.png')
            w(f'{rp}/attachables/{iid}.json', attachable(f'aqualit:{iid}', f'textures/models/armor/aqualit_{iid}',
                                                          f'geometry.aqualit.kabuk_{key}', layer))
        for st in STONES:
            iid = stone_id(st[0], key)
            stone_texture(st, STONE_PIECES[key]).save(f'{rp}/textures/models/armor/aqualit_{iid}.png')
            w(f'{rp}/attachables/{iid}.json', attachable(f'aqualit:{iid}', f'textures/models/armor/aqualit_{iid}',
                                                          f'geometry.aqualit.tas_{key}', layer))


# ====================================================================== parça simgeleri (vanilla elmas şekli + malzeme)
VAN_ELMAS = os.path.join(VAN, 'elmas')


def piece_icon(van, material, inner=None, accent=None, kind='bark'):
    """Vanilla şeklini ve ışığını korur, malzemeyi kabuk/taş dokusuyla doldurur."""
    shape = Image.open(os.path.join(VAN_ELMAS, van + '.png')).convert('RGBA')
    px = [lum3(p) for p in shape.getdata() if p[3] > 0]
    mid = sorted(px)[len(px) // 2]
    img = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    top = min(y for y in range(16) for x in range(16) if shape.getpixel((x, y))[3] > 0)
    for y in range(16):
        for x in range(16):
            p = shape.getpixel((x, y))
            if p[3] == 0:
                continue
            k = max(0.55, min(1.35, (lum3(p) / mid) ** 0.6))
            c = material.getpixel(((x * (1 if kind == 'bark' else 2)) % 16, (y + 2) % 16))[:3]
            if inner is not None and y == top:
                c = inner                       # üst kenar: iç ahşap / kemer
            put(img, x, y, mul(c, k))
    if accent:
        for (x, y), c in accent:
            if img.getpixel((x, y))[3] > 0:
                put(img, x, y, c)
    return edge_shade(img, 0.72)


def bark_piece_icon(tree, piece):
    key, _, bark_t, strip_t, _, leaf = tree
    if piece == 'chest':
        return bark_armor_icon(tree)
    bark, inner = tex(bark_t), tex(strip_t)
    i2 = tones(inner, (0.7,))[0]
    van = next(p for p in PIECES if p[0] == piece)[9]
    acc = {'helmet': [((7, 3), leaf), ((8, 3), mul(leaf, 1.15))],
           'legs': [((7, 4), leaf)],
           'boots': [((3, 9), leaf), ((12, 9), leaf)]}[piece]
    vine = (60, 98, 40)
    return piece_icon(van, bark, vine if piece == 'legs' else i2, acc)


def stone_piece_icon(st, piece):
    if piece == 'chest':
        return stone_armor_icon(st)
    key, _, base_t, plate_t, belt_t, charges = st
    base, belt = tex(base_t), tex(belt_t)
    van = next(p for p in PIECES if p[0] == piece)[9]
    return piece_icon(van, base, avg(belt), None, kind='stone')
