"""Kapalı robot (heykel) bloğu: kararmış dokular + 0.8 ölçekli blok geometrisi (yüz başına UV)."""
import json
from PIL import Image
import robotgeo as G
from robotgeo import RP, KINDS, MODELS

BLOCK_TEX = 128  # blok dokuları kare olsun
SCALE = 0.8


def off_faces(kind, model, p):
    f = G.styled_faces(kind, model, p)
    if p.name == 'head':
        fr = f['front']
        for yy in range(1, 7):
            for xx in range(1, 11):
                if fr[yy][xx] not in ('R',):
                    fr[yy][xx] = 'k' if (xx + yy) % 5 else 'K'
    if p.name == 'body':
        fr = f['front']
        for yy in range(2, 6):
            for xx in range(1, 7):
                fr[yy][xx] = 'k' if (xx + yy) % 4 else 'K'
    if p.name == 'lamp':
        f = {k: [[('Q' if ch in ('Y', 'W') else ch) for ch in row] for row in v] for k, v in f.items()}
    if p.name == 'antenna_tip':
        f = {k: [[({'W': 'L', 'H': 'M', 'L': 'D', 'Y': 'y', 'S': 'V', 'Z': 'p', 'F': 'y', 'l': 'i', 'R': 'r'}.get(ch, ch))
                  for ch in row] for row in v] for k, v in f.items()}
    return f


def statue_tint(im):
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            gray = (r * 30 + g * 59 + b * 11) / 100
            k = 0.45  # renk doygunluğu düşür
            r2 = (r * (1 - k) + gray * k) * 0.82
            g2 = (g * (1 - k) + gray * k) * 0.82
            b2 = (b * (1 - k) + gray * k) * 0.86
            px[x, y] = (int(r2), int(g2), int(b2), a)
    return im


def variants():
    return [(k, 1) for k in KINDS if k != 'kilicli'] + [('kilicli', m) for m in range(1, 6)]


def vname(kind, model):
    return kind if kind != 'kilicli' else f'kilicli_{model}'


def build_textures(out_dir):
    cubes = G.collect()
    uv = G.pack(cubes)
    names = []
    for kind, model in variants():
        sheet = Image.new('RGBA', (BLOCK_TEX, BLOCK_TEX), (0, 0, 0, 0))
        glow = Image.new('RGBA', (BLOCK_TEX, BLOCK_TEX), (0, 0, 0, 0))
        for p in G.parts_for(kind):
            if kind == 'kilicli' and p.name.startswith('shoulder') and MODELS[model]['shoulder'] is None:
                continue
            key = (G.bone_for(kind, p.name), p.name)
            f = off_faces(kind, model, p)
            G.draw_net(sheet, glow, uv[key][0], uv[key][1], cubes[key]['size'], f, kind, p)
        statue_tint(sheet)
        nm = 'kapali_' + vname(kind, model)
        sheet.save(f'{out_dir}/{nm}.png')
        names.append(nm)
    return names, cubes, uv


def per_face_uv(u, v, size):
    w, h, d = size
    return {
        'north': {'uv': [u + d, v + d], 'uv_size': [w, h]},
        'south': {'uv': [u + 2 * d + w, v + d], 'uv_size': [w, h]},
        'east': {'uv': [u, v + d], 'uv_size': [d, h]},
        'west': {'uv': [u + d + w, v + d], 'uv_size': [d, h]},
        'up': {'uv': [u + d, v], 'uv_size': [w, d]},
        'down': {'uv': [u + d + w, v + d], 'uv_size': [w, -d]},
    }


def sc(vec):
    return [round(c * SCALE, 4) for c in vec]


def build_geometry(path, cubes, uv):
    bones = {}
    for name in G.ORDER:
        if name == 'rightItem':
            continue
        b = {'name': name, 'pivot': sc(G.PIVOT[name])}
        if G.PARENT.get(name) and G.PARENT[name] != 'rightItem':
            b['parent'] = G.PARENT[name]
        bones[name] = b
    for key in sorted(cubes, key=lambda k: (G.ORDER.index(k[0]), k[1])):
        c = cubes[key]
        bones[key[0]].setdefault('cubes', []).append({
            'origin': sc(c['origin']), 'size': sc(c['size']),
            'uv': per_face_uv(uv[key][0], uv[key][1], c['size']),
        })
    geo = {
        'format_version': '1.12.0',
        'minecraft:geometry': [{
            'description': {'identifier': 'geometry.aqualit.kapali_robot', 'texture_width': BLOCK_TEX,
                            'texture_height': BLOCK_TEX},
            'bones': [bones[n] for n in G.ORDER if n in bones],
        }]
    }
    with open(path, 'w') as fh:
        json.dump(geo, fh, indent=1)
    return geo


# hangi kemik hangi turde gorunur (blok durumuna gore)
def bone_visibility():
    T = "q.block_state('aqualit:tur')"
    def anyof(*vals):
        return ' || '.join(f"{T} == '{v}'" for v in vals)
    k_all = [f'kilicli_{m}' for m in range(1, 6)]
    k_sh = [f'kilicli_{m}' for m in range(2, 6)]
    return {
        'helmet': anyof('madenci'), 'antenna_ball20': anyof('madenci'),
        'sand_bag': anyof('kurekci'), 'antenna_ball19': anyof('kurekci', *k_all),
        'hat': anyof('ciftci'), 'antenna_sprout23': anyof('ciftci'),
        'scarf': anyof('oduncu'), 'antenna_leaf19': anyof('oduncu'),
        'cape': anyof(*k_all), 'right_shoulder': anyof(*k_sh), 'left_shoulder': anyof(*k_sh),
        'hardhat': anyof('insaatci'), 'toolbelt': anyof('insaatci'), 'blueprint': anyof('insaatci'),
        'antenna_ball24': anyof('insaatci'),
    }


# ---------------------------------------------------------------- ikonlar
def off_icon(img):
    """Robot ikonunun kapalı hali: ekran ve göğüs kararır, renk solar."""
    im = img.copy().convert('RGBA')
    px = im.load()
    W, H = im.size
    for y in range(5, 10):
        for x in range(3, 13):
            r, g, b, a = px[x, y]
            if a and (r + g + b) > 200 and not (r > 180 and g < 110):  # gözler (yanak hariç)
                px[x, y] = (34, 44, 48, 255)
    for y in (12, 13):
        for x in range(5, 11):
            r, g, b, a = px[x, y]
            if a and (r + g + b) > 330:
                px[x, y] = (30, 40, 44, 255)
    statue_tint(im)
    return im


def tamir_kiti():
    rows = [
        "................",
        "......dddd......",
        ".....d....d.....",
        ".....d....d.....",
        "..HHHHHHHHHHHH..",
        "..HLLLLLLLLLLM..",
        "..LMMMMbbMMMMD..",
        "..DDDDDccDDDDD..",
        "..LMMMMbbMMMMD..",
        "..LMMMMMMMMMMD..",
        "..LMMcMMMMMMMD..",
        "..LMcWcMMMRRMD..",
        "..LMMcMMMMRRMD..",
        "..LMMMMMMMMMMD..",
        "..MDDDDDDDDDDM..",
        "................",
    ]
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            c = RP.get(ch) if ch != '.' else None
            if c:
                im.putpixel((x, y), tuple(c) + (255,))
    return im


# ---------------------------------------------------------------- pozlar (bakır golem heykeli gibi)
ANT = ['antenna_ball19', 'antenna_ball20', 'antenna_leaf19', 'antenna_sprout23']
POSES = {
    'ayakta': {'_name': 'Ayakta', '_dy': 0},
    'oturuyor': {'_name': 'Oturuyor', '_dy': -3,
                 'right_leg': [-90, 10, 0], 'left_leg': [-90, -10, 0],
                 'right_arm': [-25, 0, 10], 'left_arm': [-25, 0, -10], 'head': [6, 0, 0]},
    'el_salliyor': {'_name': 'El sallıyor', '_dy': 0,
                    'left_arm': [-10, 0, -135], 'right_arm': [0, 0, 8], 'head': [0, 0, -8],
                    **{a: [0, 0, 14] for a in ANT}},
    'kosuyor': {'_name': 'Koşuyor', '_dy': 0.5,
                'right_leg': [40, 0, 0], 'left_leg': [-40, 0, 0], 'right_arm': [-45, 0, 6], 'left_arm': [40, 0, -6],
                'body': [10, 0, 0], 'head': [-10, 0, 0], 'cape': [35, 0, 0], **{a: [25, 0, 0] for a in ANT}},
    'zafer': {'_name': 'Zafer', '_dy': 0,
              'right_arm': [0, 0, 135], 'left_arm': [0, 0, -135], 'right_leg': [0, 0, 18], 'left_leg': [0, 0, -18],
              'head': [-10, 0, 0], **{a: [-15, 0, 0] for a in ANT}},
    'dusunuyor': {'_name': 'Düşünüyor', '_dy': 0,
                  'right_arm': [-95, 25, 0], 'head': [0, 0, 15], **{a: [0, 0, 22] for a in ANT}},
}
POSE_KEYS = list(POSES)


def pose_rot(pose):
    return {k: v for k, v in POSES[pose].items() if not k.startswith('_')}


def build_pose_geometries(base_path, cubes, uv):
    """Her poz için ayrı blok geometrisi: geometry.aqualit.kapali_robot.<poz>"""
    ids = {}
    out = {'format_version': '1.12.0', 'minecraft:geometry': []}
    for pose in POSE_KEYS:
        rot = pose_rot(pose)
        dy = POSES[pose]['_dy']
        bones = {}
        for name in G.ORDER:
            if name == 'rightItem':
                continue
            pv = list(G.PIVOT[name]); pv[1] += dy
            b = {'name': name, 'pivot': sc(pv)}
            if G.PARENT.get(name) and G.PARENT[name] != 'rightItem':
                b['parent'] = G.PARENT[name]
            if name in rot:
                b['rotation'] = rot[name]
            bones[name] = b
        for key in sorted(cubes, key=lambda k: (G.ORDER.index(k[0]), k[1])):
            c = cubes[key]
            o = list(c['origin']); o[1] += dy
            bones[key[0]].setdefault('cubes', []).append({
                'origin': sc(o), 'size': sc(c['size']),
                'uv': per_face_uv(uv[key][0], uv[key][1], c['size']),
            })
        gid = f'geometry.aqualit.kapali_robot.{pose}'
        ids[pose] = gid
        out['minecraft:geometry'].append({
            'description': {'identifier': gid, 'texture_width': BLOCK_TEX, 'texture_height': BLOCK_TEX},
            'bones': [bones[n] for n in G.ORDER if n in bones],
        })
    with open(base_path, 'w') as fh:
        json.dump(out, fh, indent=1)
    return ids, out
