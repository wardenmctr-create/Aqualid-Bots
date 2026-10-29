"""Mini dron mimar: Mimar'ın baretinden çıkan, inşaya yardım eden küçük uçan robot.

Gövde baş+göğüs tek kutu (gözler ışıklı), sarı mini baret, tepesinde dönen pervane, altında turkuaz itici.
Çıktılar: geometri, doku (+ ışık dokusu), BP/RP varlıkları, animasyonlar.
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.normpath(os.path.join(HERE, '..', '..'))
for p in (HERE, ART):
    if p not in sys.path:
        sys.path.insert(0, p)
import robot as R           # noqa: E402
from robot import G, plate, put, box, RP   # noqa: E402
import robotgeo as RG       # noqa: E402

ID = 'aqualit:dron'
TEX_W, TEX_H = 64, 32
ACTS = ['none', 'place', 'out', 'in']   # out: baretten çıkış, in: barete dönüş

PIVOT = {'root': [0, 0, 0], 'body': [0, 2, 0], 'hat': [0, 7, 0], 'prop': [0, 12, 0],
         'right_arm': [-3, 5, 0], 'left_arm': [3, 5, 0], 'jet': [0, 2, 0]}
PARENT = {'root': None, 'body': 'root', 'hat': 'body', 'prop': 'hat', 'right_arm': 'body', 'left_arm': 'body',
          'jet': 'body'}
ORDER = ['root', 'body', 'hat', 'prop', 'right_arm', 'left_arm', 'jet']
BONE = {'govde': 'body', 'baret_kenar': 'hat', 'baret_tepe': 'hat', 'direk': 'hat', 'pervane1': 'prop',
        'pervane2': 'prop', 'kol_sag': 'right_arm', 'kol_sol': 'left_arm', 'itici': 'jet'}


def parts():
    face = plate(6, 5, 'M', top='H', bottom='D', left='H', right='D')
    put(face, ['WkkW', 'WkkW'], 1, 1)   # iki göz, arası koyu vizör
    face[3][2] = 'k'                    # gülen ağız
    face[3][3] = 'k'
    face[3][1] = 'R'                    # yanaklar
    face[3][4] = 'R'
    side = plate(6, 5, 'M', top='H', bottom='D', left='L', right='D')
    side[2][2] = 'L'
    side[2][3] = 'L'
    back = plate(6, 5, 'M')
    put(back, ['DD', 'DD'], 2, 1)
    top = plate(6, 6, 'L', top='H', bottom='M', left='H', right='M')
    out = [
        box('govde', (-3, 2, -3), (3, 7, 3), front=face, back=back, left=side, right=side, top=top,
            bottom=G(6, 6, 'D')),
        box('baret_kenar', (-4, 7, -4), (4, 8, 4), front=[['A'] * 8], back=[['C'] * 8], left=[['C'] * 8],
            right=[['A'] * 8], top=plate(8, 8, 'G', top='A', bottom='A', left='A', right='A'), bottom=G(8, 8, 'C')),
        box('baret_tepe', (-3, 8, -3), (3, 10, 3), front=[list('GGGGGG'), list('AAAAAA')],
            back=[list('AAAAAA'), list('CCCCCC')], left=[list('GGGGGG'), list('AAAAAA')],
            right=[list('AAAAAA'), list('CCCCCC')], top=plate(6, 6, 'G', top='W', bottom='A', left='W', right='A'),
            bottom=G(6, 6, 'C')),
        box('direk', (-0.5, 10, -0.5), (0.5, 12, 0.5), front=[['L'], ['D']], back=[['L'], ['D']],
            left=[['L'], ['D']], right=[['L'], ['D']], top=[['H']], bottom=[['D']]),
        box('pervane1', (-5, 12, -0.5), (5, 13, 0.5), front=[list('kDDDLLDDDk')], back=[list('kDDDLLDDDk')],
            left=[['k']], right=[['k']], top=[list('kLLLHHLLLk')], bottom=[list('kDDDDDDDDk')]),
        box('pervane2', (-0.5, 12.0, -5), (0.5, 13.0, 5), front=[['k']], back=[['k']],
            left=[list('kDDDLLDDDk')], right=[list('kDDDLLDDDk')], top=[[c] for c in 'kLLLHHLLLk'],
            bottom=[[c] for c in 'kDDDDDDDDk']),
        box('kol_sag', (-4, 3, -1), (-3, 5, 1), front=[['L'], ['D']], back=[['D'], ['D']], left=[['L', 'L'], ['D', 'D']],
            right=[['M', 'M'], ['D', 'D']], top=[['H'], ['H']], bottom=[['D'], ['D']]),
        box('kol_sol', (3, 3, -1), (4, 5, 1), front=[['L'], ['D']], back=[['D'], ['D']], left=[['M', 'M'], ['D', 'D']],
            right=[['L', 'L'], ['D', 'D']], top=[['H'], ['H']], bottom=[['D'], ['D']]),
        box('itici', (-2, 1, -2), (2, 2, 2), front=[list('DWWD')], back=[list('DWWD')], left=[list('DWWD')],
            right=[list('DWWD')], top=G(4, 4, 'D'), bottom=plate(4, 4, 'W', top='L', bottom='L', left='L', right='L')),
    ]
    return out


def glow(p, face, g):
    m = [[False] * len(g[0]) for _ in g]
    if p.name == 'govde' and face == 'front':
        for y in range(1, 3):
            for x in range(1, 5):
                m[y][x] = g[y][x] in ('W', 'L')
    if p.name == 'itici' and face in ('bottom', 'front', 'back', 'left', 'right'):
        for y in range(len(g)):
            for x in range(len(g[0])):
                m[y][x] = g[y][x] == 'W'
    return m


def build(tex_dir, geo_path=None):
    """Geometri sözlüğü döndürür; dokuları tex_dir'e yazar (dron.png, dron_glow.png)."""
    import json
    ps = parts()
    cubes, items = {}, []
    for p in ps:
        origin, _ = RG.to_file(p.a, p.b)
        size = RG.size_int(p)
        cubes[p.name] = {'origin': origin, 'size': size}
        w, h, d = size
        items.append((p.name, 2 * (w + d), d + h))
    items.sort(key=lambda t: (-t[2], -t[1], t[0]))
    x = y = shelf = 0
    uv = {}
    for name, nw, nh in items:
        if x + nw > TEX_W:
            x, y, shelf = 0, y + shelf, 0
        uv[name] = [x, y]
        x += nw
        shelf = max(shelf, nh)
    assert y + shelf <= TEX_H, 'dron atlası taştı'
    sheet = Image.new('RGBA', (TEX_W, TEX_H), (0, 0, 0, 0))
    gl = Image.new('RGBA', (TEX_W, TEX_H), (0, 0, 0, 0))
    for p in ps:
        w, h, d = cubes[p.name]['size']
        u, v = uv[p.name]
        regions = [('top', u + d, v), ('bottom', u + d + w, v), ('left', u, v + d), ('front', u + d, v + d),
                   ('right', u + d + w, v + d), ('back', u + 2 * d + w, v + d)]
        exp = {'top': (w, d), 'bottom': (w, d), 'left': (d, h), 'right': (d, h), 'front': (w, h), 'back': (w, h)}
        for face, fx, fy in regions:
            g = p.f[face]
            assert (len(g[0]), len(g)) == exp[face], (p.name, face, (len(g[0]), len(g)), exp[face])
            im = RG.grid_img(g, RP)
            sheet.alpha_composite(im, (fx, fy))
            m = glow(p, face, g)
            for yy in range(len(g)):
                for xx in range(len(g[0])):
                    if m[yy][xx]:
                        gl.putpixel((fx + xx, fy + yy), im.getpixel((xx, yy)))
    os.makedirs(tex_dir, exist_ok=True)
    sheet.save(os.path.join(tex_dir, 'dron.png'))
    gl.save(os.path.join(tex_dir, 'dron_glow.png'))
    bones = []
    for n in ORDER:
        b = {'name': n, 'pivot': PIVOT[n]}
        if PARENT[n]:
            b['parent'] = PARENT[n]
        cs = [{'origin': cubes[k]['origin'], 'size': cubes[k]['size'], 'uv': uv[k]} for k in cubes if BONE[k] == n]
        if cs:
            b['cubes'] = cs
        bones.append(b)
    geo = {'format_version': '1.12.0', 'minecraft:geometry': [{
        'description': {'identifier': 'geometry.aqualit.dron', 'texture_width': TEX_W, 'texture_height': TEX_H,
                        'visible_bounds_width': 1.5, 'visible_bounds_height': 1.5, 'visible_bounds_offset': [0, 0.5, 0]},
        'bones': bones}]}
    if geo_path:
        with open(geo_path, 'w') as fh:
            json.dump(geo, fh, indent=1)
    return geo


# ------------------------------------------------------------------ varlıklar
def bp():
    return {'format_version': '1.26.0', 'minecraft:entity': {
        'description': {'identifier': ID, 'is_spawnable': False, 'is_summonable': True,
                        'properties': {'aqualit:dact': {'type': 'enum', 'values': ACTS, 'default': 'none',
                                                        'client_sync': True}}},
        'components': {
            'minecraft:type_family': {'family': ['aqualit_dron', 'inanimate']},
            'minecraft:collision_box': {'width': 0.3, 'height': 0.4},
            'minecraft:health': {'value': 10, 'max': 10},
            'minecraft:damage_sensor': {'triggers': [{'cause': 'all', 'deals_damage': 'no'}]},
            'minecraft:physics': {'has_gravity': False, 'has_collision': False},
            'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
            'minecraft:knockback_resistance': {'value': 1.0},
            'minecraft:fire_immune': {},
            'minecraft:breathable': {'breathes_water': True, 'breathes_air': True, 'suffocate_time': 0},
            'minecraft:conditional_bandwidth_optimization': {},
            'minecraft:loot': {'table': 'loot_tables/empty.json'},
        },
        'events': {}}}


def kf(*pairs):
    return {str(t): v for t, v in pairs}


def animations():
    A = {
        'fly': {'loop': True, 'animation_length': 1.0, 'bones': {
            'prop': {'rotation': [0, 'q.anim_time * 1440', 0]},
            'body': {'position': [0, 'math.sin(q.anim_time * 360) * 0.6', 0],
                     'rotation': ['math.sin(q.anim_time * 360) * 4', 0, 'math.cos(q.anim_time * 360) * 3']},
            'right_arm': {'rotation': [0, 0, 'math.sin(q.anim_time * 720) * 6']},
            'left_arm': {'rotation': [0, 0, '-math.sin(q.anim_time * 720) * 6']},
        }},
        'place': {'loop': True, 'animation_length': 0.4, 'bones': {
            'right_arm': {'rotation': kf((0.0, [0, 0, 0]), (0.15, [-110, 0, 0]), (0.4, [0, 0, 0]))},
            'left_arm': {'rotation': kf((0.0, [0, 0, 0]), (0.15, [-110, 0, 0]), (0.4, [0, 0, 0]))},
            'body': {'rotation': kf((0.0, [0, 0, 0]), (0.15, [15, 0, 0]), (0.4, [0, 0, 0]))},
        }},
        'out': {'loop': 'hold_on_last_frame', 'animation_length': 0.5, 'bones': {
            'root': {'scale': kf((0.0, [0.2, 0.2, 0.2]), (0.35, [1.15, 1.15, 1.15]), (0.5, [1, 1, 1])),
                     'rotation': kf((0.0, [0, 0, 0]), (0.5, [0, 360, 0]))},
        }},
        'in': {'loop': 'hold_on_last_frame', 'animation_length': 0.5, 'bones': {
            'root': {'scale': kf((0.0, [1, 1, 1]), (0.15, [1.15, 1.15, 1.15]), (0.5, [0.1, 0.1, 0.1])),
                     'rotation': kf((0.0, [0, 0, 0]), (0.5, [0, -360, 0]))},
        }},
    }
    return {'format_version': '1.8.0', 'animations': {f'animation.aqualit.dron.{k}': v for k, v in A.items()}}


def controller():
    p = "q.property('aqualit:dact')"
    states = {'default': {'transitions': [{a: f"{p} == '{a}'"} for a in ACTS if a != 'none'], 'blend_transition': 0.1}}
    for a in ACTS:
        if a != 'none':
            states[a] = {'animations': [a], 'transitions': [{'default': f"{p} != '{a}'"}], 'blend_transition': 0.1}
    return {'format_version': '1.10.0', 'animation_controllers': {
        'controller.animation.aqualit.dron.act': {'initial_state': 'default', 'states': states}}}


def rp():
    anims = {'act_ctrl': 'controller.animation.aqualit.dron.act'}
    for a in ['fly'] + [a for a in ACTS if a != 'none']:
        anims[a] = f'animation.aqualit.dron.{a}'
    return {'format_version': '1.10.0', 'minecraft:client_entity': {'description': {
        'identifier': ID,
        'materials': {'default': 'entity_alphatest', 'glow': 'copper_golem_eyes'},
        'textures': {'default': 'textures/entity/aqualit_dron/dron', 'glow': 'textures/entity/aqualit_dron/dron_glow'},
        'geometry': {'default': 'geometry.aqualit.dron'},
        'animations': anims,
        'scripts': {'animate': ['fly', 'act_ctrl']},
        'render_controllers': ['controller.render.aqualit.dron', 'controller.render.aqualit.dron_glow'],
    }}}


def render_ctrl():
    return {'format_version': '1.10.0', 'render_controllers': {
        'controller.render.aqualit.dron': {'geometry': 'Geometry.default', 'materials': [{'*': 'Material.default'}],
                                           'textures': ['Texture.default']},
        'controller.render.aqualit.dron_glow': {'geometry': 'Geometry.default', 'materials': [{'*': 'Material.glow'}],
                                                'textures': ['Texture.glow'], 'ignore_lighting': True},
    }}
