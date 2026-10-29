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
          'beetroot', 'reeds', 'cocoa', 'web', 'snow_layer')


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
def render(W, H, D, cells, size=256, bg=(24, 28, 32, 0), yon=0):
    """Önden-sağdan izometrik resim. yon: 0..3, 90° adımlarla döndürür (dönen önizleme kareleri için)."""
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
    img = Image.new('RGBA', (size, size), bg)
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
    order = sorted(rc, key=lambda p: (p[0] + p[2], p[1]))
    for (x, y, z) in order:
        name = rc[(x, y, z)][0]
        top, side, a = renk(name)
        h = 1.0
        if 'slab' in name and 'double' not in name:
            h = 0.5
            if rc[(x, y, z)][1].get('minecraft:vertical_half') == 'top':
                y += 0.5
        elif any(k in name for k in ('carpet', 'snow_layer', 'pressure_plate', 'rail', 'redstone_wire', 'lily_pad')):
            h = 0.12
        thin = any(k in name for k in ('torch', 'flower', 'sapling', 'fern', 'grass', 'pane', 'bars', 'fence', 'rod',
                                       'chain', 'lantern', 'poppy', 'dandelion', 'tulip', 'wheat', 'carrots', 'potatoes'))
        if thin and name not in ('grass_block', 'tall_grass', 'short_grass'):
            m = 0.35
        else:
            m = 0.0
        x0, x1, z0, z1 = x + m, x + 1 - m, z + m, z + 1 - m
        y0, y1 = y, y + h
        alpha = 255 if a > 0.6 and 'glass' not in name else 150
        if not opak((x, int(y) + 1, z)) or h < 1:
            dr.polygon([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], fill=top + (alpha,))
        if not opak((x, int(y), z + 1)) or m:
            dr.polygon([P(x0, y1, z1), P(x1, y1, z1), P(x1, y0, z1), P(x0, y0, z1)], fill=_shade(side, 0.82) + (alpha,))
        if not opak((x + 1, int(y), z)) or m:
            dr.polygon([P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1), P(x1, y0, z0)], fill=_shade(side, 0.64) + (alpha,))
    return img


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
