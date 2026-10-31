"""Mini Keşif dronu (v0.3.5): Keşif'in çevreyi taramak için çıkardığı küçük uçan robotlar.

Turkuaz gövde, önde ışıklı mercek, tepede minik radar; iki yanında çember, çemberlerin içinde dönen pervane.
Keşif yerinde durur, dronlar dört yöne açılıp geniş alanı tarar (kesif_dron.js).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.normpath(os.path.join(HERE, '..', '..'))
for p in (HERE, ART):
    if p not in sys.path:
        sys.path.insert(0, p)
import kesif as K  # noqa: E402
from kesif import Form, fill, panel, rows, over, hline, vline, dots  # noqa: E402
from kesif_araclar import add_box, auto  # noqa: E402

ID = 'aqualit:kesif_dron'
GEO = 'geometry.aqualit.kesif_dron'


def model():
    f = Form('kdron', 'Keşif dronu')
    f.bone('root', None, (0, 4.5, 0.5))
    f.bone('govde', 'root', (0, 4.5, 0.5))
    # gövde: 5x5x5 küp; önde ekran, ekranda iki dikey göz (1x2 piksel, ışıklı)
    ekran = rows('HHHHH', 'HWkWH', 'HWkWH', 'HkkkH', 'DDDDD')
    yan = panel(5, 5, 'M')
    hline(yan, 2, 'y', 0, 5)
    add_box(f, 'govde', 'g_govde', (-2.5, 3, -2), (2.5, 8, 3), base='M', glow='W',
            **auto((-2.5, 3, -2), (2.5, 8, 3), base='M', front=ekran, side=yan, top=panel(5, 5, 'L', t='H', b='M', l='H', r='M')))
    add_box(f, 'govde', 'g_alt', (-1, 2, -0.5), (1, 3, 1.5), base='y', **auto((-1, 2, -0.5), (1, 3, 1.5), base='y'))
    add_box(f, 'govde', 'g_anten', (-0.5, 8, 0), (0.5, 10, 1), base='&', **auto((-0.5, 8, 0), (0.5, 10, 1), base='&', top=rows('R')))
    # iki yanda yatay, tam kare çember (7x7) ve içinde yatay dönen pervane (Mimar dronundaki gibi)
    for t, x0 in (('l', -10), ('r', 3)):
        kol = (-3, 5, 0, -2) if t == 'l' else (2, 5, 0, 3)   # çember iç kenarından küpe
        a, b = (kol[0], kol[1], kol[2]), (kol[3], kol[1] + 1, kol[2] + 1)
        add_box(f, 'govde', f'kol_{t}', a, b, base='&', **auto(a, b, base='&'))
        for nm, aa, bb in ((f'c{t}_on', (x0, 5, 3), (x0 + 7, 6, 4)), (f'c{t}_arka', (x0, 5, -3), (x0 + 7, 6, -2)),
                           (f'c{t}_sol', (x0, 5, -2), (x0 + 1, 6, 3)), (f'c{t}_sag', (x0 + 6, 5, -2), (x0 + 7, 6, 3))):
            w_, d_ = int(bb[0] - aa[0]), int(bb[2] - aa[2])
            add_box(f, 'govde', nm, aa, bb, base='y', **auto(aa, bb, base='y', top=fill(w_, d_, 'Y')))
        cx = x0 + 3.5
        f.bone(f'p_{t}', 'govde', (cx, 5.5, 0.5))
        add_box(f, f'p_{t}', f'p{t}1', (x0 + 1, 5, 0), (x0 + 6, 6, 1), base='D',
                **auto((x0 + 1, 5, 0), (x0 + 6, 6, 1), base='D', top=rows('kLHLk'), front=rows('kLHLk'), back=rows('kLHLk')))
        add_box(f, f'p_{t}', f'p{t}2', (x0 + 3, 5, -2), (x0 + 4, 6, 3), base='D',
                **auto((x0 + 3, 5, -2), (x0 + 4, 6, 3), base='D', top=rows('k', 'L', 'H', 'L', 'k'), side=rows('kLHLk')))
    return f


def build(RP, BP, wj):
    fm = model()
    geo, tex, glow = K.build(forms=[fm], W=64, ident=GEO)
    d = f'{RP}/textures/entity/aqualit_kesif_dron'
    os.makedirs(d, exist_ok=True)
    tex.save(f'{d}/kesif_dron.png')
    glow.save(f'{d}/kesif_dron_glow.png')
    wj(f'{RP}/models/entity/aqualit_kesif_dron.geo.json', geo)
    wj(f'{BP}/entities/kesif_dron.json', bp())
    wj(f'{RP}/entity/aqualit_kesif_dron.entity.json', rp())
    wj(f'{RP}/animations/aqualit_kesif_dron.animation.json', animations())
    wj(f'{RP}/render_controllers/aqualit_kesif_dron.render_controllers.json', render_ctrl())
    return geo, tex, glow


def bp():
    return {'format_version': '1.26.0', 'minecraft:entity': {
        'description': {'identifier': ID, 'is_spawnable': False, 'is_summonable': True},
        'components': {
            'minecraft:type_family': {'family': ['aqualit_kesif_dron', 'inanimate']},
            'minecraft:collision_box': {'width': 0.4, 'height': 0.4},
            'minecraft:health': {'value': 10, 'max': 10},
            'minecraft:damage_sensor': {'triggers': [{'cause': 'all', 'deals_damage': 'no'}]},
            'minecraft:physics': {'has_gravity': False, 'has_collision': False},
            'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
            'minecraft:knockback_resistance': {'value': 1.0},
            'minecraft:fire_immune': {},
            'minecraft:breathable': {'breathes_water': True, 'breathes_air': True, 'suffocate_time': 0},
            'minecraft:loot': {'table': 'loot_tables/empty.json'},
        }}}


def animations():
    A = {'uc': {'loop': True, 'animation_length': 1.0, 'bones': {
        'p_l': {'rotation': [0, 'q.anim_time * 1440', 0]},
        'p_r': {'rotation': [0, '-q.anim_time * 1440', 0]},
        'govde': {'position': [0, 'math.sin(q.anim_time * 360) * 0.5', 0],
                  'rotation': ['math.sin(q.anim_time * 360) * 5', 0, 'math.cos(q.anim_time * 360) * 4']},
    }}}
    return {'format_version': '1.8.0', 'animations': {f'animation.aqualit.kesif_dron.{k}': v for k, v in A.items()}}


def rp():
    return {'format_version': '1.10.0', 'minecraft:client_entity': {'description': {
        'identifier': ID,
        'materials': {'default': 'entity_alphatest', 'glow': 'copper_golem_eyes'},
        'textures': {'default': 'textures/entity/aqualit_kesif_dron/kesif_dron',
                     'glow': 'textures/entity/aqualit_kesif_dron/kesif_dron_glow'},
        'geometry': {'default': GEO},
        'animations': {'uc': 'animation.aqualit.kesif_dron.uc'},
        'scripts': {'animate': ['uc'], 'scale': '1.2'},
        'render_controllers': ['controller.render.aqualit.kesif_dron', 'controller.render.aqualit.kesif_dron_glow'],
    }}}


def render_ctrl():
    return {'format_version': '1.10.0', 'render_controllers': {
        'controller.render.aqualit.kesif_dron': {'geometry': 'Geometry.default', 'materials': [{'*': 'Material.default'}],
                                                 'textures': ['Texture.default']},
        'controller.render.aqualit.kesif_dron_glow': {'geometry': 'Geometry.default', 'materials': [{'*': 'Material.glow'}],
                                                      'textures': ['Texture.glow'], 'ignore_lighting': True},
    }}


def onizleme(out_gif):
    """Dönen pervaneli 3B önizleme GIF."""
    sys.path.insert(0, os.path.join(HERE, '..', 'test'))
    import render_z as Z
    fm = model()
    geo, tex, glow = K.build(forms=[fm], W=64, ident=GEO)
    frames = []
    for i in range(36):
        t = i / 36
        pose = {'p_l': [0, t * 720, 0], 'p_r': [0, -t * 720, 0], 'govde': {'p': [0, 0.5 * __import__('math').sin(t * 6.283), 0]}}
        cam = Z.Cam(yaw=30 + i * 10, elev=28, scale=16, size=(320, 300), center=(0, 4.5, 0.5))
        frames.append(Z.render(geo, tex, pose, cam=cam, glow=glow, ground={'y': -4, 'color': (58, 66, 74)}))
    return Z.gif(frames, out_gif, ms=50)


if __name__ == '__main__':
    print(onizleme(os.path.join(ART, 'onizleme', '71_kesif_dron.gif')))
