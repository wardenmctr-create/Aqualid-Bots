"""Mini Keşif (yapay zekâsız): robot <-> binilebilir araçlar (uçak, gemi, denizaltı, arazi aracı, matkap).

Model ve doku: kesif.py (önizlemelerdeki modelin aynısı). Açılma animasyonları kesif_donusum.UNFOLD
zaman çizelgesinden 0,05 sn aralıkla pişirilir. Sürüş betikte (src/scripts/kesif.js).
"""
import math
import os
import sys

ART = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ART)

KID = 'aqualit:kesif'
FORMS = ['robot', 'ucak', 'gemi', 'denizalti', 'arazi', 'matkap']
ROOT = {'robot': 'root', 'ucak': 'u_root', 'gemi': 'g_root', 'denizalti': 'd_root', 'arazi': 'a_root', 'matkap': 'm_root'}
# çarpışma kutusu (genişlik, yükseklik) ve koltuklar (y, [(x, z)...]); +z ileri
BOX = {'robot': (0.7, 1.4), 'ucak': (2.2, 1.2), 'gemi': (1.3, 1.0), 'denizalti': (1.5, 1.5), 'arazi': (1.7, 1.3),
       'matkap': (1.7, 1.5)}
SEATS = {
    'ucak': (0.75, [(0, 0.6), (-1.1, 0.0), (1.1, 0.0), (0, -0.4), (0, -1.3)]),
    'gemi': (0.45, [(0, 1.0), (0, 0.3), (0, -0.4), (0, -1.1), (0, 1.6)]),
    'denizalti': (1.0, [(0, 0.6), (0, -0.2), (0, -1.0), (0, -1.7), (0, 1.3)]),
    'arazi': (0.7, [(0.35, 0.3), (-0.35, 0.3), (0.35, -0.5), (-0.35, -0.5), (0, -1.1)]),
    'matkap': (1.0, [(0, -0.3), (0.5, -0.9), (-0.5, -0.9)]),
}


def P(n):
    return f"q.property('aqualit:{n}')"


# ------------------------------------------------------------------ davranış (BP)
def kesif_bp():
    groups = {}
    for f in FORMS:
        w, h = BOX[f]
        g = {'minecraft:collision_box': {'width': w, 'height': h},
             'minecraft:physics': {'has_gravity': f not in ('ucak', 'denizalti'), 'has_collision': True}}
        if f in SEATS:
            y, pos = SEATS[f]
            g['minecraft:rideable'] = {
                'seat_count': len(pos), 'family_types': ['player'], 'interact_text': 'Bin',
                'crouching_skip_interact': True, 'pull_in_entities': False,
                'seats': [{'position': [x, y, z], 'min_rider_count': 0, 'max_rider_count': len(pos)} for x, z in pos]}
        if f == 'gemi':
            g['minecraft:buoyant'] = {'base_buoyancy': 1.0, 'apply_gravity': True, 'simulate_waves': True,
                                      'big_wave_probability': 0.03, 'big_wave_speed': 10.0,
                                      'liquid_blocks': ['minecraft:water', 'minecraft:flowing_water']}
        groups[f'k_{f}'] = g
    events = {'minecraft:entity_spawned': {'add': {'component_groups': ['k_robot']}}}
    for f in FORMS:
        events[f'aqualit:form_{f}'] = {
            'remove': {'component_groups': [f'k_{o}' for o in FORMS if o != f]},
            'add': {'component_groups': [f'k_{f}']},
            'set_property': {'aqualit:form': f}}
    return {'format_version': '1.21.0', 'minecraft:entity': {
        'description': {'identifier': KID, 'is_spawnable': False, 'is_summonable': True,
                        'properties': {
                            'aqualit:form': {'type': 'enum', 'values': FORMS, 'default': 'robot', 'client_sync': True},
                            'aqualit:gecis': {'type': 'bool', 'default': False, 'client_sync': True},
                            'aqualit:egim': {'type': 'float', 'range': [-60, 60], 'default': 0, 'client_sync': True},
                        }},
        'component_groups': groups,
        'components': {
            'minecraft:type_family': {'family': ['aqualit_kesif', 'inanimate']},
            'minecraft:health': {'value': 100, 'max': 100},
            'minecraft:damage_sensor': {'triggers': [{'cause': 'all', 'deals_damage': 'no'}]},
            'minecraft:knockback_resistance': {'value': 1},
            'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
            'minecraft:fire_immune': {},
            'minecraft:persistent': {},
            'minecraft:breathable': {'breathes_water': True, 'breathes_air': True},
            'minecraft:collision_box': {'width': 0.7, 'height': 1.4},
            'minecraft:physics': {'has_gravity': True, 'has_collision': True},
        },
        'events': events,
    }}


# ------------------------------------------------------------------ istemci (RP)
def kesif_rp():
    anims = {'ctrl': 'controller.animation.aqualit.kesif'}
    for n in ['fold', 'robot_in'] + [f'run_{f}' for f in FORMS] + [f'unfold_{f}' for f in FORMS if f != 'robot']:
        anims[n] = f'animation.aqualit.kesif.{n}'
    return {'format_version': '1.10.0', 'minecraft:client_entity': {'description': {
        'identifier': KID,
        'materials': {'default': 'entity_alphatest', 'glow': 'copper_golem_eyes'},
        'textures': {'default': 'textures/entity/aqualit_kesif/kesif', 'glow': 'textures/entity/aqualit_kesif/kesif_glow'},
        'geometry': {'default': 'geometry.aqualit.kesif'},
        'animations': anims,
        'scripts': {'scale': '0.8', 'animate': ['ctrl']},
        'render_controllers': ['controller.render.aqualit.kesif', 'controller.render.aqualit.kesif_glow'],
    }}}


def kesif_render():
    vis = [{'*': True}] + [{ROOT[f]: f"{P('form')} == '{f}'"} for f in FORMS]
    base = {'geometry': 'Geometry.default', 'part_visibility': vis}
    return {'format_version': '1.8.0', 'render_controllers': {
        'controller.render.aqualit.kesif': {**base, 'materials': [{'*': 'Material.default'}], 'textures': ['Texture.default']},
        'controller.render.aqualit.kesif_glow': {**base, 'materials': [{'*': 'Material.glow'}], 'textures': ['Texture.glow'],
                                                 'ignore_lighting': True},
    }}


def kesif_ctrl():
    G, F = P('gecis'), P('form')
    to = lambda skip=None: [{f: f"!{G} && {F} == '{f}'"} for f in FORMS if f != skip]
    states = {'default': {'transitions': [{'gecis': G}] + to()}}
    for f in FORMS:
        anims = ['robot_in', 'run_robot'] if f == 'robot' else [f'unfold_{f}', f'run_{f}']
        states[f] = {'animations': anims, 'transitions': [{'gecis': G}] + to(f), 'blend_transition': 0.08}
    states['gecis'] = {'animations': ['fold'], 'transitions': to()}
    return {'format_version': '1.10.0', 'animation_controllers': {
        'controller.animation.aqualit.kesif': {'initial_state': 'default', 'states': states}}}


def _r(v):
    return [round(float(x), 3) for x in v]


def bake_unfold(key):
    """kesif_donusum.UNFOLD -> Bedrock anahtar kareleri (araç çekirdekten açılır, 1,2 sn)."""
    import kesif_donusum as D
    u = D.UNFOLD[key]
    root = ROOT[key]
    bones = {}

    def put(bone, ch, t, v):
        bones.setdefault(bone, {}).setdefault(ch, {})[f'{t:.2f}'] = _r(v)
    for i in range(25):
        T = i * 0.05
        ts = T + 0.8
        g = D.seg(ts, 0.8, 1.6)
        vs = 0.3 + 0.7 * D.out_back(g, 0.9)
        yaw = -120 * (1 - D.inout_cubic(g))
        lock = D.seg(ts, 1.6, 2.0)
        bounce = 0.9 * math.sin(lock * math.pi * 3) * math.exp(-lock * 3.2) if ts > 1.6 else 0.0
        rise = 3.0 * (1 - D.out_cubic(g)) if ts < 1.6 else 0.0
        put(root, 'position', T, [0, rise + bounce, 0])
        put(root, 'rotation', T, [0, yaw, 0])
        put(root, 'scale', T, [vs] * 3)
        bn, s0, a, d = u['body_lag']
        k = D.out_back(D.seg(ts, a, a + d), 1.1)
        put(bn, 'scale', T, [s0[j] + (1 - s0[j]) * k for j in range(3)])
        for bone, a, d, spec in u['parts']:
            k = D.seg(ts, a, a + d)
            ek = D.out_back(k, 1.3)
            if 's' in spec:
                s0 = spec['s'] if isinstance(spec['s'], list) else [spec['s']] * 3
                put(bone, 'scale', T, [max(0.001, s0[j] + (1 - s0[j]) * ek) for j in range(3)])
            r = [0, 0, 0]
            if 'r' in spec:
                r = [v * (1 - D.out_cubic(k)) for v in spec['r']]
            if 'spin' in spec:
                r = [r[j] + spec['spin'][j] * (1 - D.out_cubic(k)) for j in range(3)]
            put(bone, 'rotation', T, r)
            if 'p' in spec:
                put(bone, 'position', T, [v * (1 - D.out_cubic(k)) for v in spec['p']])
    return {'loop': 'hold_on_last_frame', 'animation_length': 1.2, 'bones': bones}


def kesif_anims():
    A = {}
    roots = list(ROOT.values())
    # dönüşmeden önce: zıplayıp dönerek parlayan çekirdeğe küçülür (0,55 sn)
    A['fold'] = {'loop': 'hold_on_last_frame', 'animation_length': 0.55, 'bones': {r: {
        'scale': {'0.0': [1, 1, 1], '0.2': [1.08, 0.9, 1.08], '0.55': [0.22, 0.22, 0.22]},
        'rotation': {'0.0': [0, 0, 0], '0.55': [0, 540, 0]},
        'position': {'0.0': [0, 0, 0], '0.2': [0, 3, 0], '0.55': [0, 6, 0]}} for r in roots}}
    A['robot_in'] = {'loop': 'hold_on_last_frame', 'animation_length': 0.7, 'bones': {
        'root': {'scale': {'0.0': [0.22, 0.22, 0.22], '0.35': [1.1, 1.1, 1.1], '0.5': [0.95, 0.95, 0.95], '0.7': [1, 1, 1]},
                 'rotation': {'0.0': [0, -360, 0], '0.45': [0, 0, 0]},
                 'position': {'0.0': [0, 6, 0], '0.35': [0, 0, 0], '0.5': [0, 0.6, 0], '0.7': [0, 0, 0]}},
        'k_goggles': {'position': {'0.0': [0, -6, 0], '0.5': [0, -6, 0], '0.7': [0, 0, 0]}}}}
    spin = lambda k: [0, 0, f'q.life_time * {k}']
    wave = [0, 'math.sin(q.life_time * 400) * 12', 0]
    radar = [0, 'q.life_time * 220', 0]
    wheel = ['q.modified_distance_moved * -230', 0, 0]
    A['run_robot'] = {'loop': True, 'bones': {
        'root': {'position': [0, 'math.sin(q.life_time * 200) * 0.35', 0]}, 'k_radar': {'rotation': radar},
        'k_scarf_tail': {'rotation': ['math.sin(q.life_time * 300) * 8', 0, 'math.sin(q.life_time * 200) * 6']},
        'k_flame': {'scale': [1, 1, '0.8 + math.abs(math.sin(q.life_time * 900)) * 0.4']}}}
    A['run_ucak'] = {'loop': True, 'bones': {
        'u_root': {'rotation': [P('egim'), 0, 0]}, 'u_prop': {'rotation': spin(1440)},
        'u_flame': {'scale': [1, 1, '0.8 + math.abs(math.sin(q.life_time * 900)) * 0.5']},
        'u_scarf': {'rotation': ['math.sin(q.life_time * 500) * 10', 0, 0]}}}
    A['run_gemi'] = {'loop': True, 'bones': {
        'g_root': {'rotation': ['math.sin(q.life_time * 90) * 1.5', 0, 'math.sin(q.life_time * 70) * 2.5']},
        'g_screw': {'rotation': spin(1080)}, 'g_radar': {'rotation': radar}, 'g_flag': {'rotation': wave}}}
    A['run_denizalti'] = {'loop': True, 'bones': {
        'd_root': {'rotation': [P('egim'), 0, 0]}, 'd_prop': {'rotation': spin(900)}, 'd_radar': {'rotation': radar},
        'd_flag': {'rotation': wave}}}
    A['run_arazi'] = {'loop': True, 'bones': {
        **{f'a_wheel_{w}': {'rotation': wheel} for w in ('fl', 'fr', 'bl', 'br')},
        'a_radar': {'rotation': radar}, 'a_flag': {'rotation': wave}}}
    A['run_matkap'] = {'loop': True, 'bones': {
        'm_drill': {'rotation': spin(1440)}, 'm_radar': {'rotation': radar},
        **{f'm_rw_{s}{i}': {'rotation': wheel} for s in 'lr' for i in range(3)}}}
    for f in FORMS:
        if f != 'robot':
            A[f'unfold_{f}'] = bake_unfold(f)
    return {'format_version': '1.8.0', 'animations': {f'animation.aqualit.kesif.{k}': v for k, v in A.items()}}


def build(RP, BP, wj):
    import kesif as K
    geo, tex, glow = K.build(W=512)
    d = f'{RP}/textures/entity/aqualit_kesif'
    os.makedirs(d, exist_ok=True)
    tex.save(f'{d}/kesif.png')
    glow.save(f'{d}/kesif_glow.png')
    wj(f'{RP}/models/entity/aqualit_kesif.geo.json', geo)
    wj(f'{BP}/entities/kesif.json', kesif_bp())
    wj(f'{RP}/entity/aqualit_kesif.entity.json', kesif_rp())
    wj(f'{RP}/render_controllers/aqualit_kesif.render_controllers.json', kesif_render())
    wj(f'{RP}/animation_controllers/aqualit_kesif.animation_controllers.json', kesif_ctrl())
    wj(f'{RP}/animations/aqualit_kesif.animation.json', kesif_anims())
    bones = {b['name'] for b in geo['minecraft:geometry'][0]['bones']}
    used = set()
    for a in kesif_anims()['animations'].values():
        used |= set(a['bones'])
    missing = used - bones
    assert not missing, f'animasyonda olmayan kemikler: {missing}'
