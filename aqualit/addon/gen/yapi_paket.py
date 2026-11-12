"""Mimar yapıları için paket çıktıları: .mcstructure dosyası ve menü resmi (izometrik çizim).

Hücre sözlüğü: {(x, y, z): (ad, durumlar)}; x doğu, y yukarı, z güney; ad 'minecraft:' öneki olmadan.
"""
import json
import os

import nbtlib
from nbtlib import Byte, Compound, Int, List, String
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.environ.get('AQUALIT_REF', os.path.join(HERE, '..', '..', 'ref'))
BLOK_SURUM = 18168865          # 1.21.60.33: Mojang blok durumu sürümünü o günden beri artırmadı

# ------------------------------------------------------------------ .mcstructure
def _tag(v):
    if isinstance(v, bool):
        return Byte(int(v))
    if isinstance(v, int):
        return Int(v)
    return String(str(v))


def mcstructure(path, W, H, D, cells):
    """Bedrock yapı dosyası (küçük-sonlu NBT). Hücre yoksa yapı boşluğu (-1): mevcut blok kalır."""
    pal, pidx, idx = [], {}, []
    for x in range(W):
        for y in range(H):
            for z in range(D):
                v = cells.get((x, y, z))
                if v is None:
                    idx.append(-1)
                    continue
                key = (v[0], json.dumps(v[1], sort_keys=True))
                if key not in pidx:
                    pidx[key] = len(pal)
                    pal.append(Compound({'name': String('minecraft:' + v[0]),
                                         'states': Compound({k: _tag(s) for k, s in v[1].items()}),
                                         'version': Int(BLOK_SURUM)}))
                idx.append(pidx[key])
    root = Compound({
        'format_version': Int(1),
        'size': List[Int]([Int(W), Int(H), Int(D)]),
        'structure': Compound({
            'block_indices': List[List[Int]]([List[Int]([Int(i) for i in idx]), List[Int]([Int(-1)] * len(idx))]),
            'entities': List[Compound]([]),
            'palette': Compound({'default': Compound({'block_palette': List[Compound](pal),
                                                       'block_position_data': Compound({})})}),
        }),
        'structure_world_origin': List[Int]([Int(0), Int(0), Int(0)]),
    })
    os.makedirs(os.path.dirname(path), exist_ok=True)
    nbtlib.File(root, root_name='').save(path, gzipped=False, byteorder='little')


# ------------------------------------------------------------------ renkler
_R = {}
TINT = {'grass_block': (110, 170, 70), 'leaves': (70, 140, 50), 'vine': (70, 140, 50), 'water': (60, 100, 220),
        'short_grass': (110, 170, 70), 'tall_grass': (110, 170, 70), 'fern': (100, 160, 70), 'lily_pad': (60, 130, 50)}
SEYREK = ('torch', 'lantern', 'flower', 'grass', 'fern', 'sapling', 'button', 'lever', 'rail', 'redstone_wire',
          'carpet', 'pressure_plate', 'sign', 'banner', 'tripwire', 'ladder', 'vine', 'bars', 'pane', 'fence', 'wall',
          'door', 'trapdoor', 'slab', 'stairs', 'chain', 'rod', 'candle', 'pot', 'head', 'skull', 'bush', 'dandelion',
          'poppy', 'tulip', 'orchid', 'allium', 'bluet', 'daisy', 'cornflower', 'lily', 'wheat', 'carrots', 'potatoes',
          'beetroot', 'reeds', 'cocoa', 'web', 'snow_layer', 'twisting_vines', 'cave_vines', 'pointed_dripstone',
          'propagule', 'turtle_egg')


def renk(name):
    if not _R:
        _R.update(json.load(open(os.path.join(REF, 'yapi_cevir', 'renkler.json'))))
    c = _R.get(name) or _R.get(name.replace('_double_slab', '_slab'))
    if not c:
        return (150, 150, 150), (150, 150, 150), 1.0
    u, s = c['u'], c['s']
    for k, t in TINT.items():
        if k in name and name not in ('grass_path', 'dirt_with_roots'):
            m = lambda col: tuple(round(col[i] * t[i] / 255 * 1.6) for i in range(3))  # noqa: E731
            if k == 'grass_block':
                return tuple(min(255, v) for v in m(u)), tuple(s[:3]), 1.0
            u = s = list(min(255, v) for v in m(u)) + [u[3]]
    return tuple(u[:3]), tuple(s[:3]), u[3]


def _shade(c, f):
    return tuple(max(0, min(255, round(v * f))) for v in c)


# ------------------------------------------------------------------ izometrik çizim
def _yuz_karo(tex, O, eu, ev, parlak):
    """16x16 dokuyu paralelkenara (O köşe, eu: dokunun x yönü, ev: y yönü; piksel vektörleri) çevirir.
    Döner: (karo, sol üst köşe). Kenar boşluğu kalmasın diye yüz yarım piksel büyütülür."""
    import math
    pts = [O, (O[0] + eu[0], O[1] + eu[1]), (O[0] + eu[0] + ev[0], O[1] + eu[1] + ev[1]), (O[0] + ev[0], O[1] + ev[1])]
    x0 = math.floor(min(p[0] for p in pts)) - 1
    y0 = math.floor(min(p[1] for p in pts)) - 1
    x1 = math.ceil(max(p[0] for p in pts)) + 1
    y1 = math.ceil(max(p[1] for p in pts)) + 1
    a, c = eu[0] / 16, ev[0] / 16
    b, d = eu[1] / 16, ev[1] / 16
    det = a * d - b * c
    if abs(det) < 1e-9:
        return None, (0, 0)
    ia, ib, ic, id_ = d / det, -c / det, -b / det, a / det
    ox, oy = O[0] - x0, O[1] - y0
    # çıktı (X, Y) -> doku (u, v)
    data = (ia, ib, -(ia * ox + ib * oy), ic, id_, -(ic * ox + id_ * oy))
    t = tex
    if parlak != 1.0:
        r, g, bb, al = t.split()
        t = Image.merge('RGBA', [ch.point(lambda v: min(255, round(v * parlak))) for ch in (r, g, bb)] + [al])
    t = t.resize((64, 64), Image.NEAREST)      # kenarda taşma olmasın
    data = tuple(v * 4 for v in data)
    karo = t.transform((x1 - x0, y1 - y0), Image.AFFINE, data, resample=Image.NEAREST)
    # dışarıda kalan pikselleri sil (paralelkenar maskesi, yarım piksel geniş)
    m = Image.new('L', karo.size, 0)
    cx = sum(p[0] for p in pts) / 4
    cy = sum(p[1] for p in pts) / 4
    big = [(p[0] + (0.6 if p[0] > cx else -0.6) - x0, p[1] + (0.6 if p[1] > cy else -0.6) - y0) for p in pts]
    ImageDraw.Draw(m).polygon(big, fill=255)
    al = karo.getchannel('A')
    from PIL import ImageChops
    karo.putalpha(ImageChops.multiply(al, m))
    return karo, (x0, y0)


def _yapistir(img, karo, X, Y):
    if X < 0 or Y < 0:
        karo = karo.crop((max(0, -X), max(0, -Y), karo.size[0], karo.size[1]))
        X, Y = max(0, X), max(0, Y)
    if X >= img.size[0] or Y >= img.size[1] or karo.size[0] <= 0 or karo.size[1] <= 0:
        return
    karo = karo.crop((0, 0, min(karo.size[0], img.size[0] - X), min(karo.size[1], img.size[1] - Y)))
    img.alpha_composite(karo, (X, Y))


def render(W, H, D, cells, size=256, bg=(24, 28, 32, 0), yon=0):
    """Önden-sağdan izometrik resim, gerçek blok dokularıyla (blok_doku.py). yon: 0..3, 90° adımlarla döndürür.
    İki kat büyük çizilip küçültülür (yumuşak kenar)."""
    import blok_doku as BD
    son = size
    size = size * 2
    W2, D2 = (W, D) if yon % 2 == 0 else (D, W)
    rc = {}
    for (x, y, z), v in cells.items():
        if v[0] in ('air', 'structure_void', 'barrier', 'light_block'):
            continue
        xx, zz = x, z
        w, d = W, D
        for _ in range(yon % 4):
            xx, zz = d - 1 - zz, xx
            w, d = d, w
        rc[(xx, y, zz)] = v
    span = W2 + D2
    s = (size * 0.92) / max(span * 0.866, span * 0.5 + H)
    img = Image.new('RGBA', (size, size), bg[:3] + (0,) if bg[3] == 0 else bg)
    dr = ImageDraw.Draw(img)
    hx, hy = s * 0.866, s * 0.5
    tot_h = (W2 + D2) * hy + H * s
    ox = size / 2 + (D2 - W2) * hx / 2
    oy = (size - tot_h) / 2 + H * s

    def P(x, y, z):
        return (ox + (x - z) * hx, oy + (x + z) * hy - y * s)

    def opak(p):
        v = rc.get(p)
        return v is not None and not any(k in v[0] for k in SEYREK) and 'glass' not in v[0] and 'leaves' not in v[0]

    karolar = {}

    def yuz(name, tex, f, x0, x1, y0, y1, z0, z1, parlak):
        # karo şekli yalnız boyutlara bağlı: önbellekten al, konumu kaydır
        k = (name, f, round(x1 - x0, 3), round(y1 - y0, 3), round(z1 - z0, 3))
        if f == 'u':
            O, eu, ev = P(x0, y1, z0), (hx * (x1 - x0), hy * (x1 - x0)), (-hx * (z1 - z0), hy * (z1 - z0))
        elif f == 's':
            O, eu, ev = P(x0, y1, z1), (hx * (x1 - x0), hy * (x1 - x0)), (0, s * (y1 - y0))
        else:
            O, eu, ev = P(x1, y1, z1), (hx * (z1 - z0), -hy * (z1 - z0)), (0, s * (y1 - y0))
        if k not in karolar:
            karolar[k] = _yuz_karo(tex, (O[0] - int(O[0]) + 2, O[1] - int(O[1]) + 2), eu, ev, parlak)
        karo, (kx, ky) = karolar[k]
        if karo is not None:
            _yapistir(img, karo, int(O[0]) - 2 + kx, int(O[1]) - 2 + ky)

    order = sorted(rc, key=lambda p: (p[0] + p[2], p[1]))
    for (x, y, z) in order:
        name = rc[(x, y, z)][0]
        dk = BD.doku(name)
        top, side, a = renk(name)
        h = 1.0
        if 'slab' in name and 'double' not in name:
            h = 0.5
            if rc[(x, y, z)][1].get('minecraft:vertical_half') == 'top':
                y += 0.5
        elif any(k in name for k in ('carpet', 'snow_layer', 'pressure_plate', 'rail', 'redstone_wire', 'lily_pad')):
            h = 0.12
        bitki = any(k in name for k in ('torch', 'flower', 'sapling', 'fern', 'short_grass', 'tall_grass', 'poppy', 'dandelion',
                                        'tulip', 'wheat', 'carrots', 'potatoes', 'beetroot', 'orchid', 'allium', 'bluet',
                                        'daisy', 'cornflower', 'lily_of', 'reeds', 'bush', 'rose', 'mushroom', 'web',
                                        'twisting_vines', 'cave_vines', 'pointed_dripstone', 'propagule'))
        if bitki and dk and name not in ('grass_block',):
            # bitki/meşale: dokunun kendisi, bloğun ortasında dik duran resim
            t = dk[1]
            n = max(2, round(s))
            cx, cy = P(x + 0.5, y, z + 0.5)
            _yapistir(img, t.resize((n, n), Image.NEAREST), int(cx - n / 2), int(cy - n))
            continue
        thin = any(k in name for k in ('pane', 'bars', 'fence', 'rod', 'chain', 'lantern', 'wall')) and not name.endswith('_wall_sign')
        m = 0.35 if thin and 'wall' not in name else (0.25 if thin else 0.0)
        x0, x1, z0, z1 = x + m, x + 1 - m, z + m, z + 1 - m
        y0, y1 = y, y + h
        if dk:
            if not opak((x, int(y) + 1, z)) or h < 1:
                yuz(name, dk[0], 'u', x0, x1, y0, y1, z0, z1, 1.0)
            if not opak((x, int(y), z + 1)) or m:
                yuz(name, dk[1], 's', x0, x1, y0, y1, z0, z1, 0.82)
            if not opak((x + 1, int(y), z)) or m:
                yuz(name, dk[1], 'e', x0, x1, y0, y1, z0, z1, 0.64)
            continue
        alpha = 255 if a > 0.6 and 'glass' not in name else 150
        if not opak((x, int(y) + 1, z)) or h < 1:
            dr.polygon([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], fill=top + (alpha,))
        if not opak((x, int(y), z + 1)) or m:
            dr.polygon([P(x0, y1, z1), P(x1, y1, z1), P(x1, y0, z1), P(x0, y0, z1)], fill=_shade(side, 0.82) + (alpha,))
        if not opak((x + 1, int(y), z)) or m:
            dr.polygon([P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1), P(x1, y0, z0)], fill=_shade(side, 0.64) + (alpha,))
    return img.resize((son, son), Image.LANCZOS)


def gif(W, H, D, cells, path, size=256, kare=4, ms=700):
    """4 yönden dönen önizleme (GIF)."""
    frames = [render(W, H, D, cells, size, bg=(24, 28, 32, 255), yon=i).convert('RGB') for i in range(kare)]
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=ms, loop=0)


# ------------------------------------------------------------------ malzeme listesi
_ITEMS = set()
BLOK_ESYA = {
    'farmland': 'dirt', 'grass_path': 'dirt', 'wheat': 'wheat_seeds', 'carrots': 'carrot', 'potatoes': 'potato',
    'beetroot': 'beetroot_seeds', 'reeds': 'sugar_cane', 'redstone_wire': 'redstone', 'tripwire': 'string',
    'cocoa': 'cocoa_beans', 'unpowered_repeater': 'repeater', 'powered_repeater': 'repeater',
    'unpowered_comparator': 'comparator', 'powered_comparator': 'comparator', 'standing_sign': 'oak_sign',
    'wall_sign': 'oak_sign', 'standing_banner': 'banner', 'wall_banner': 'banner', 'lit_redstone_lamp': 'redstone_lamp',
    'lit_furnace': 'furnace', 'lit_blast_furnace': 'blast_furnace', 'lit_smoker': 'smoker', 'lit_pumpkin': 'lit_pumpkin',
    'lit_redstone_ore': 'redstone_ore', 'unlit_redstone_torch': 'redstone_torch', 'daylight_detector_inverted':
    'daylight_detector', 'chain': 'iron_chain', 'pumpkin_stem': 'pumpkin_seeds', 'melon_stem': 'melon_seeds',
    'sweet_berry_bush': 'sweet_berries', 'cave_vines': 'glow_berries', 'cave_vines_body_with_berries': 'glow_berries',
    'cave_vines_head_with_berries': 'glow_berries', 'bamboo_sapling': 'bamboo', 'skull': 'skeleton_skull',
    'powder_snow': 'powder_snow_bucket', 'nether_wart': 'nether_wart', 'grass_block': 'dirt', 'mycelium': 'dirt',
    'podzol': 'dirt', 'frosted_ice': 'ice', 'monster_egg': 'stone', 'flowing_water': None, 'water': None,
    'flowing_lava': None, 'lava': None, 'bubble_column': None, 'snow_layer': 'snow_layer', 'trip_wire': 'string',
    'darkoak_standing_sign': 'dark_oak_sign', 'darkoak_wall_sign': 'dark_oak_sign',
}


def esya(name, st):
    """Bloğu koymak için gereken eşya (ad, adet) ya da None (bedava / sayılmaz)."""
    if not _ITEMS:
        d = json.load(open(os.path.join(REF, 'vanilladata_modules', 'mojang-items.json')))
        _ITEMS.update(i['name'].split(':', 1)[1] for i in d['data_items'])
    if st.get('upper_block_bit') or st.get('head_piece_bit'):
        return None
    if name in BLOK_ESYA:
        it = BLOK_ESYA[name]
        return (it, 1) if it else None
    n = 1
    if name.endswith('_double_slab'):
        name, n = name.replace('_double_slab', '_slab'), 2
    for suf in ('_wall_sign', '_standing_sign'):
        if name.endswith(suf):
            name = name[:-len(suf)] + '_sign'
    if name.endswith('_wall_banner') or name.endswith('_standing_banner'):
        name = 'banner'
    if name.startswith('wall_') and name[5:] in _ITEMS:
        name = name[5:]
    if name.endswith('_wall_fan') and name.replace('_wall_fan', '_fan') in _ITEMS:
        name = name.replace('_wall_fan', '_fan')
    if name in _ITEMS:
        return name, n
    return ('?' + name, n)


def malzeme(cells):
    """{eşya: adet} (bulunamayanlar '?ad' anahtarıyla)."""
    out = {}
    for name, st in cells.values():
        r = esya(name, st)
        if r:
            out[r[0]] = out.get(r[0], 0) + r[1]
    return dict(sorted(out.items(), key=lambda kv: -kv[1]))


def oku(path):
    """.mcstructure (ya da .mcstructure.gz) → (W, H, D, hücreler)."""
    import gzip
    raw = open(path, 'rb').read()
    if path.endswith('.gz'):
        raw = gzip.decompress(raw)
    import io
    root = nbtlib.File.parse(io.BytesIO(raw), byteorder='little')
    W, H, D = (int(v) for v in root['size'])
    pal = root['structure']['palette']['default']['block_palette']
    names = []
    for p in pal:
        names.append((str(p['name']).split(':', 1)[1],
                      {k: (bool(v) if isinstance(v, Byte) else int(v) if isinstance(v, Int) else str(v))
                       for k, v in p['states'].items()}))
    idx = root['structure']['block_indices'][0]
    cells = {}
    i = 0
    for x in range(W):
        for y in range(H):
            for z in range(D):
                v = int(idx[i])
                i += 1
                if v >= 0:
                    cells[(x, y, z)] = names[v]
    return W, H, D, cells


def yaz_gz(path, W, H, D, cells):
    import gzip
    tmp = path + '.tmp'
    mcstructure(tmp, W, H, D, cells)
    with open(tmp, 'rb') as f, gzip.open(path, 'wb', compresslevel=9) as g:
        g.write(f.read())
    os.remove(tmp)
