"""Robot ve sandik varliklari icin Bedrock geometri + doku atlasi ureticisi.

robot.py'deki kutu modelini (on yuz +Z) Bedrock'a cevirir: Y ekseni etrafinda 180 derece
(on yuz -Z / kuzey). Tum turlerin parcalari tek geometride, her tur/model icin ayri doku.
Kutu UV agi (box UV) kullanilir: ust (u+d,v), alt (u+d+w,v), sol yan (u,v+d),
on (u+d,v+d), sag yan (u+d+w,v+d), arka (u+2d+w,v+d).
"""
import os, sys, json, copy
from PIL import Image

ART = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
if ART not in sys.path:
    sys.path.insert(0, ART)
import robot as R           # noqa: E402
from robot import RP, G, plate, put   # noqa: E402

KINDS = ['madenci', 'kurekci', 'ciftci', 'oduncu', 'kilicli', 'insaatci', 'toplayici']
ANT = {'madenci': 'ball20', 'kurekci': 'ball19', 'ciftci': 'sprout23', 'oduncu': 'leaf19', 'kilicli': 'ball19',
       'insaatci': 'ball24', 'toplayici': 'ball24'}
TEX_W, TEX_H = 128, 128

# Kilicli model renkleri: pelerin (acik, orta, koyu), omuzluk, kalp, goz (parlak, orta), anten ucu
RP.update({
    'j': (120, 220, 80), 'i': (70, 170, 50), 'h': (40, 110, 30), 'l': (175, 255, 140),      # yesil
    'P': (196, 110, 255), 'p': (138, 64, 206), 'z': (86, 34, 140), 'Z': (226, 184, 255),    # mor
    'F': (255, 242, 160),                                                                   # sari goz
    'U': (110, 170, 255), 'V': (50, 110, 230), 'T': (25, 60, 150), 'S': (176, 218, 255),    # mavi
})
MODELS = {
    1: dict(cape=('R', 'r', 'q'), shoulder=None, heart=('R', 'r'), eye=None, tip=('R', 'r')),
    2: dict(cape=('j', 'i', 'h'), shoulder=('j', 'i', 'h'), heart=('l', 'j'), eye=('l', 'j'), tip=('l', 'j')),
    3: dict(cape=('P', 'p', 'z'), shoulder=('P', 'p', 'z'), heart=('Z', 'P'), eye=('Z', 'P'), tip=('Z', 'P')),
    4: dict(cape=('Y', 'y', 'Q'), shoulder=('Y', 'y', 'Q'), heart=('F', 'Y'), eye=('F', 'Y'), tip=('F', 'Y')),
    5: dict(cape=('U', 'V', 'T'), shoulder=('U', 'V', 'T'), heart=('S', 'U'), eye=('S', 'U'), tip=('S', 'U')),
}
MODEL_NAMES = {1: 'Kırmızı', 2: 'Yeşil', 3: 'Mor', 4: 'Sarı', 5: 'Mavi'}

BONE_OF = {
    'leg_l': 'left_leg', 'leg_r': 'right_leg', 'arm_l': 'left_arm', 'arm_r': 'right_arm',
    'body': 'body', 'head': 'head', 'helmet': 'helmet', 'lamp': 'helmet',
    'scarf': 'scarf', 'scarf_tail': 'scarf', 'hat_brim': 'hat', 'hat_crown': 'hat',
    'sand_bag': 'sand_bag', 'cape': 'cape', 'shoulder_l': 'left_shoulder', 'shoulder_r': 'right_shoulder',
    'hat_rim': 'hardhat', 'hat_visor': 'hardhat', 'hat_dome1': 'hardhat', 'hat_dome2': 'hardhat', 'hat_dome3': 'hardhat', 'hat_dome4': 'hardhat', 'cap_top': 'cap',
    'toolbelt': 'toolbelt', 'blueprint': 'blueprint', 'backpack': 'backpack', 'cap': 'cap', 'cap_brim': 'cap',
    'visor': 'visor', 'earpad_l': 'headset', 'earpad_r': 'headset', 'headband': 'headset', 'band_l': 'headset',
    'band_r': 'headset', 'mic': 'headset',
    # çiftçinin 3D Aqualit kovası (yalnızca su numarasında görünür)
    'kova_alt': 'kova', 'kova_govde': 'kova', 'kova_agiz_on': 'kova', 'kova_agiz_arka': 'kova', 'kova_agiz_sol': 'kova',
    'kova_agiz_sag': 'kova', 'kova_su': 'kova', 'kova_sap_sol': 'kova', 'kova_sap_sag': 'kova', 'kova_sap_ust': 'kova',
}

PARENT = {
    'root': None, 'body': 'root', 'head': 'body', 'right_arm': 'body', 'left_arm': 'body',
    'right_leg': 'root', 'left_leg': 'root', 'rightItem': 'right_arm',
    'helmet': 'head', 'hat': 'head', 'scarf': 'body', 'sand_bag': 'body', 'cape': 'body',
    'right_shoulder': 'right_arm', 'left_shoulder': 'left_arm',
    'antenna_ball19': 'head', 'antenna_ball20': 'head', 'antenna_leaf19': 'head', 'antenna_sprout23': 'head',
    'hardhat': 'head', 'headset': 'head', 'cap': 'head', 'visor': 'head', 'toolbelt': 'body', 'blueprint': 'body',
    'backpack': 'body', 'antenna_ball24': 'head', 'kova': 'right_arm',
}
PIVOT = {
    'root': [0, 0, 0], 'body': [0, 3, 0], 'head': [0, 10, 0],
    'right_arm': [-5, 9.5, 0], 'left_arm': [5, 9.5, 0],
    'right_leg': [-2, 3, 0], 'left_leg': [2, 3, 0], 'rightItem': [-5, 5.5, 0.5],
    'helmet': [0, 10, 0], 'hat': [0, 19, 0], 'scarf': [0, 9, 0], 'sand_bag': [0, 9.5, 3.5],
    'cape': [0, 10, 3], 'right_shoulder': [-5, 9.5, 0], 'left_shoulder': [5, 9.5, 0],
    'antenna_ball19': [0, 19, 0], 'antenna_ball20': [0, 20, 0], 'antenna_leaf19': [0, 19, 0],
    'antenna_sprout23': [0, 23, 0],
    'hardhat': [0, 10, 0], 'headset': [0, 10, 0], 'cap': [0, 19, 0], 'visor': [0, 10, 0],
    'antenna_ball24': [0, 24, 0], 'toolbelt': [0, 4, 0], 'blueprint': [0, 8, 3], 'backpack': [0, 9.5, 4],
    'kova': [-5, 4.5, 0],
}
ORDER = ['root', 'body', 'head', 'helmet', 'hat', 'hardhat', 'cap', 'visor', 'headset', 'antenna_ball19',
         'antenna_ball20', 'antenna_ball24', 'antenna_leaf19', 'antenna_sprout23', 'scarf', 'sand_bag', 'cape', 'toolbelt', 'blueprint', 'backpack',
         'right_arm', 'right_shoulder', 'rightItem', 'kova',
         'left_arm', 'left_shoulder', 'right_leg', 'left_leg']


def bone_for(kind, pname):
    if pname in ('antenna', 'antenna_tip'):
        return 'antenna_' + ANT[kind]
    return BONE_OF[pname]


def shoulders():
    def face(w, h):
        return plate(w, h, 'M', top='H', bottom='D', left='L', right='D')
    out = []
    for name, a, b in [('shoulder_r', (3.5, 8, -1.5), (6.5, 10, 1.5)),
                       ('shoulder_l', (-6.5, 8, -1.5), (-3.5, 10, 1.5))]:
        top = plate(3, 3, 'L', top='H', bottom='M', left='H', right='M')
        out.append(R.Box(name, a, b, {'front': face(3, 2), 'back': face(3, 2), 'left': face(3, 2),
                                      'right': face(3, 2), 'top': top, 'bottom': G(3, 3, 'D')}))
    return out


RP.update({'5': (40, 96, 206), '6': (72, 136, 236), '7': (140, 192, 252), '8': (214, 238, 255)})  # su


def kova_parts():
    """Aqualit kova: dibi elde, ağzı kolun uzandığı yönde (kol kalkınca ağız yukarı bakar)."""
    from robot import box
    def metal(w, h, fill='M'):
        return plate(w, h, fill, top='H', bottom='D', left='L', right='D')
    def gem_front(w, h):
        g = metal(w, h)
        cx, cy = w // 2 - 1, h // 2 - 1
        put(g, ['HW', 'LH'], cx, cy)
        return g
    def water(w, d):
        g = G(w, d, '6')
        for (x, y) in [(1, 1), (2, 1), (3, 3)]:
            if x < w and y < d:
                g[y][x] = '7'
        if w > 1 and d > 2:
            g[2][1] = '8'
        return g
    out = []
    out.append(box('kova_alt', (2.5, 1.5, -2.5), (7.5, 4.5, 2.5), front=metal(5, 3, 'D'), back=metal(5, 3, 'D'),
                   left=metal(5, 3, 'D'), right=metal(5, 3, 'D'), top=G(5, 5, 'D'), bottom=G(5, 5, 'M')))
    out.append(box('kova_govde', (2, -2.5, -3), (8, 1.5, 3), front=gem_front(6, 4), back=metal(6, 4), left=metal(6, 4),
                   right=metal(6, 4), top=G(6, 6, 'D'), bottom=G(6, 6, 'D')))
    rim = lambda w, h: G(w, h, 'H')
    out.append(box('kova_agiz_on', (1.5, -3.5, 2.5), (8.5, -2.5, 3.5), front=rim(7, 1), back=rim(7, 1), left=rim(1, 1),
                   right=rim(1, 1), top=G(7, 1, 'L'), bottom=G(7, 1, 'W')))
    out.append(box('kova_agiz_arka', (1.5, -3.5, -3.5), (8.5, -2.5, -2.5), front=rim(7, 1), back=rim(7, 1), left=rim(1, 1),
                   right=rim(1, 1), top=G(7, 1, 'L'), bottom=G(7, 1, 'W')))
    out.append(box('kova_agiz_sol', (1.5, -3.5, -2.5), (2.5, -2.5, 2.5), front=rim(1, 1), back=rim(1, 1), left=rim(5, 1),
                   right=rim(5, 1), top=G(1, 5, 'L'), bottom=G(1, 5, 'W')))
    out.append(box('kova_agiz_sag', (7.5, -3.5, -2.5), (8.5, -2.5, 2.5), front=rim(1, 1), back=rim(1, 1), left=rim(5, 1),
                   right=rim(5, 1), top=G(1, 5, 'L'), bottom=G(1, 5, 'W')))
    out.append(box('kova_su', (2.5, -3.0, -2.5), (7.5, -2.0, 2.5), front=G(5, 1, '5'), back=G(5, 1, '5'), left=G(5, 1, '5'),
                   right=G(5, 1, '5'), top=G(5, 5, '5'), bottom=water(5, 5)))
    sap = lambda w, h: G(w, h, 'L')
    out.append(box('kova_sap_sol', (1, -6.5, -0.5), (2, -3.5, 0.5), front=sap(1, 3), back=sap(1, 3), left=sap(1, 3),
                   right=sap(1, 3), top=G(1, 1, 'H'), bottom=G(1, 1, 'D')))
    out.append(box('kova_sap_sag', (8, -6.5, -0.5), (9, -3.5, 0.5), front=sap(1, 3), back=sap(1, 3), left=sap(1, 3),
                   right=sap(1, 3), top=G(1, 1, 'H'), bottom=G(1, 1, 'D')))
    out.append(box('kova_sap_ust', (1, -7.5, -0.5), (9, -6.5, 0.5), front=G(8, 1, 'H'), back=G(8, 1, 'L'), left=sap(1, 1),
                   right=sap(1, 1), top=G(8, 1, 'H'), bottom=G(8, 1, 'D')))
    return out


def parts_for(kind):
    parts = R.robot(kind)
    for p in parts:
        if p.name == 'cape':          # 0.5 kalinlik -> 1 (kutu UV tam sayi ister), sirta yasli
            p.a = (-4, 2, -3.5)
            p.b = (4, 10, -2.5)
    if kind == 'kilicli':
        parts += shoulders()
    if kind == 'ciftci':
        parts += kova_parts()
    return parts


def to_file(a, b):
    """robot.py koordinati -> Bedrock dosya koordinati (Y etrafinda 180 derece)."""
    (x0, y0, z0), (x1, y1, z1) = a, b
    return [-x1, y0, -z1], [x1 - x0, y1 - y0, z1 - z0]


def size_int(p):
    s = [p.b[i] - p.a[i] for i in range(3)]
    for v in s:
        assert abs(v - round(v)) < 1e-6 and round(v) >= 1, (p.name, s)
    return [int(round(v)) for v in s]


def collect():
    """Tum turlerin kuplerini (bone, parca) anahtarina gore topla, ayni anahtar ayni yerde olmali."""
    cubes = {}
    for kind in KINDS:
        for p in parts_for(kind):
            key = (bone_for(kind, p.name), p.name)
            origin, size = to_file(p.a, p.b)
            if key in cubes:
                assert cubes[key]['origin'] == origin and cubes[key]['size'] == size, (key, kind)
            else:
                cubes[key] = {'origin': origin, 'size': size_int(p)}
    return cubes


def pack(cubes):
    """Basit raf yerlestirme: yuksekten alcaga."""
    items = []
    for key, c in cubes.items():
        w, h, d = c['size']
        items.append((key, 2 * (w + d), d + h))
    items.sort(key=lambda t: (-t[2], -t[1], str(t[0])))
    x = y = shelf_h = 0
    uv = {}
    for key, nw, nh in items:
        if x + nw > TEX_W:
            x = 0; y += shelf_h; shelf_h = 0
        uv[key] = [x, y]
        x += nw; shelf_h = max(shelf_h, nh)
    assert y + shelf_h <= TEX_H, ('atlas tasti', y + shelf_h)
    return uv


def grid_img(g, pal):
    h, w = len(g), len(g[0])
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for yy in range(h):
        for xx in range(w):
            ch = g[yy][xx]
            c = pal.get(ch) if ch not in ('.', ' ') else None
            if c is not None:
                im.putpixel((xx, yy), tuple(c) + (255,))
    return im


def swap(g, m):
    return [[m.get(ch, ch) for ch in row] for row in g]


def styled_faces(kind, model, p):
    """Model renk degisimleri uygulanmis yuz izgaralari. Yanaklar (R) hep kirmizi kalir."""
    f = {k: [list(r) for r in v] for k, v in p.f.items()}
    if kind == 'kilicli':
        M = MODELS[model]
        cl, cm, cd = M['cape']
        if p.name == 'cape':
            f = {k: swap(v, {'R': cl, 'r': cm, 'q': cd}) for k, v in f.items()}
        if p.name.startswith('shoulder') and M['shoulder']:
            a, b, c = M['shoulder']
            f = {k: swap(v, {'H': a, 'L': a, 'M': b, 'D': c}) for k, v in f.items()}
        if p.name == 'antenna_tip' and M['tip']:
            t0, t1 = M['tip']
            f = {k: swap(v, {'W': t0, 'H': t0, 'L': t1, 'M': t1}) for k, v in f.items()}
        if p.name == 'body':
            hw, hh = M['heart']
            fr = f['front']
            for yy in range(2, 6):
                for xx in range(1, 7):
                    if fr[yy][xx] == 'W': fr[yy][xx] = hw
                    elif fr[yy][xx] == 'H': fr[yy][xx] = hh
        if p.name == 'head' and M['eye']:
            e0, e1 = M['eye']
            fr = f['front']
            for yy in range(2, 6):
                for xx in list(range(2, 5)) + list(range(7, 10)):
                    if fr[yy][xx] == 'W': fr[yy][xx] = e0
                    elif fr[yy][xx] == 'L': fr[yy][xx] = e1
    return f


def glow_mask(kind, p, face, g):
    """Isiyan pikseller: gozler (+ madenci lambasi)."""
    m = [[False] * len(g[0]) for _ in g]
    if p.name == 'head' and face == 'front':
        for yy in range(2, 6):
            for xx in list(range(2, 5)) + list(range(7, 10)):
                if g[yy][xx] not in ('k', 'R', 'M', 'H', 'D'):
                    m[yy][xx] = True
    if p.name in ('visor', 'cap_brim') and face in ('front', 'top', 'left', 'right', 'bottom'):
        for yy in range(len(g)):
            for xx in range(len(g[0])):
                if g[yy][xx] in ('P', 'Z'):
                    m[yy][xx] = True
    if p.name == 'lamp' and face == 'front':
        for yy in range(len(g)):
            for xx in range(len(g[0])):
                if g[yy][xx] in ('Y', 'W'):
                    m[yy][xx] = True
    return m


def draw_net(sheet, glow, u, v, size, f, kind, p):
    w, h, d = size
    regions = [('top', u + d, v), ('bottom', u + d + w, v), ('left', u, v + d),
               ('front', u + d, v + d), ('right', u + d + w, v + d), ('back', u + 2 * d + w, v + d)]
    exp = {'top': (w, d), 'bottom': (w, d), 'left': (d, h), 'right': (d, h), 'front': (w, h), 'back': (w, h)}
    for face, x, y in regions:
        g = f[face]
        ew, eh = exp[face]
        assert len(g) == eh and len(g[0]) == ew, (kind, p.name, face, (len(g[0]), len(g)), (ew, eh))
        im = grid_img(g, RP)
        sheet.alpha_composite(im, (x, y))
        gm = glow_mask(kind, p, face, g)
        for yy in range(eh):
            for xx in range(ew):
                if gm[yy][xx]:
                    glow.putpixel((x + xx, y + yy), im.getpixel((xx, yy)))


def build(out_tex_dir, out_geo_path):
    cubes = collect()
    uv = pack(cubes)
    # --- geometri ---
    bones = {name: {'name': name, 'pivot': PIVOT[name]} for name in ORDER}
    for name in ORDER:
        if PARENT[name]:
            bones[name]['parent'] = PARENT[name]
    order_keys = sorted(cubes.keys(), key=lambda k: (ORDER.index(k[0]), k[1]))
    for key in order_keys:
        c = cubes[key]
        bones[key[0]].setdefault('cubes', []).append({'origin': c['origin'], 'size': c['size'], 'uv': uv[key]})
    bones['body']['locators'] = {'lead': [0, 9, 0]}
    bones['head']['locators'] = {'top': [0, 20, 0]}
    geo = {
        'format_version': '1.12.0',
        'minecraft:geometry': [{
            'description': {'identifier': 'geometry.aqualit.robot', 'texture_width': TEX_W, 'texture_height': TEX_H,
                            'visible_bounds_width': 2.5, 'visible_bounds_height': 3, 'visible_bounds_offset': [0, 1.25, 0]},
            'bones': [bones[n] for n in ORDER],
        }]
    }
    with open(out_geo_path, 'w') as fh:
        json.dump(geo, fh, indent=1)
    # --- dokular ---
    names = []
    variants = [(k, 1) for k in ('madenci', 'kurekci', 'ciftci', 'oduncu')] + [('kilicli', m) for m in range(1, 6)] + \
        [('insaatci', 1), ('toplayici', 1)]
    for kind, model in variants:
        sheet = Image.new('RGBA', (TEX_W, TEX_H), (0, 0, 0, 0))
        glow = Image.new('RGBA', (TEX_W, TEX_H), (0, 0, 0, 0))
        for p in parts_for(kind):
            if kind == 'kilicli' and p.name.startswith('shoulder') and MODELS[model]['shoulder'] is None:
                continue
            key = (bone_for(kind, p.name), p.name)
            f = styled_faces(kind, model, p)
            draw_net(sheet, glow, uv[key][0], uv[key][1], cubes[key]['size'], f, kind, p)
        nm = kind if kind != 'kilicli' else f'kilicli_{model}'
        sheet.save(f'{out_tex_dir}/{nm}.png')
        glow.save(f'{out_tex_dir}/{nm}_glow.png')
        names.append(nm)
    return names, geo


# ---------------- sandik ----------------
def build_chest(out_tex_dir, out_geo_path):
    import sandik_model as S
    from sandiklar import CHESTS
    names = []
    for key, fn, label in CHESTS:
        sh, _ = S.sheet(key)
        sh.save(f'{out_tex_dir}/{fn}.png')
        names.append(fn)
    geo = {
        'format_version': '1.12.0',
        'minecraft:geometry': [{
            'description': {'identifier': 'geometry.aqualit.robot_chest', 'texture_width': 64, 'texture_height': 64,
                            'visible_bounds_width': 1.5, 'visible_bounds_height': 1.5, 'visible_bounds_offset': [0, 0.5, 0]},
            'bones': [
                {'name': 'root', 'pivot': [0, 0, 0]},
                {'name': 'body', 'parent': 'root', 'pivot': [0, 0, 0],
                 'cubes': [{'origin': [-7, 0, -7], 'size': [14, 10, 14], 'uv': [0, 19]}]},
                {'name': 'lid', 'parent': 'root', 'pivot': [0, 10, 7],
                 'cubes': [{'origin': [-7, 10, -7], 'size': [14, 5, 14], 'uv': [0, 0]},
                           {'origin': [-1, 7, -8], 'size': [2, 4, 1], 'uv': [0, 0]}]},
            ],
        }]
    }
    with open(out_geo_path, 'w') as fh:
        json.dump(geo, fh, indent=1)
    return names


if __name__ == '__main__':
    import os
    os.makedirs('/tmp/rg', exist_ok=True)
    n, g = build('/tmp/rg', '/tmp/rg/robot.geo.json')
    print(n)
    print(json.dumps(g)[:600])
