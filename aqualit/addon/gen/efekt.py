"""Kılıçlı güç efektleri: efekt varlığı (enerji kubbesi, gölge hayaleti) ve parçacıklar.

Parçacık dokusu: textures/particle/aqualit_fx (64x64 atlas, efekt_doku.py)
  (0,0)-(32,32)   şimşek parçası, 4 kare (32x8)      -> aqualit:simsek
  (48,0)-(64,16)  parlama                           -> aqualit:parlama, aqualit:kivilcim (uzatılmış)
  (32,16)-(48,32) duman                             -> aqualit:golge_duman
  (0,32)-(32,64)  şok dalgası halkası               -> aqualit:sok_dalgasi
  (32,32)-(40,40) altıgen pırıltı                   -> aqualit:kubbe_parilti
  (40,32)-(56,48) enerji halkası                    -> aqualit:enerji_halka
  (32,48)-(64,64) elektrikli zincir, 2 kare (32x8)  -> aqualit:zincir

Yönlü parçacıklar (şimşek, zincir, kıvılcım) vanilla vibration_signal / ominous_spawning gibi
"lookat_direction" + "derive_from_velocity" kullanır: betik yönü variable.yon ile verir, parçacık
o yönde çok yavaş hareket eder, böylece uzun ekseni (doku x ekseni) o yöne döner.
"""
import math

FX_ID = 'aqualit:fx'
FX_KINDS = ['kubbe', 'hayalet']
R_KUBBE = 80.0  # piksel (5 blok)
GHOST_FRAMES = 3


# ------------------------------------------------------------------ davranış (BP)
def fx_bp():
    events = {f'aqualit:as_{k}': {'set_property': {'aqualit:fx': k}} for k in FX_KINDS}
    events['aqualit:yok_ol'] = {'add': {'component_groups': ['aqualit:yok_ol']}}
    return {'format_version': '1.21.0', 'minecraft:entity': {
        'description': {'identifier': FX_ID, 'is_spawnable': False, 'is_summonable': True,
                        'properties': {
                            'aqualit:fx': {'type': 'enum', 'values': FX_KINDS, 'default': 'kubbe', 'client_sync': True},
                            'aqualit:boy': {'type': 'float', 'range': [0, 4], 'default': 1, 'client_sync': True},
                        }},
        'component_groups': {
            'aqualit:yok_ol': {'minecraft:instant_despawn': {}},
        },
        'components': {
            'minecraft:type_family': {'family': ['aqualit_fx', 'inanimate']},
            'minecraft:collision_box': {'width': 0.01, 'height': 0.01},
            'minecraft:physics': {'has_gravity': False, 'has_collision': False},
            'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
            'minecraft:damage_sensor': {'triggers': [{'cause': 'all', 'deals_damage': 'no'}]},
            'minecraft:health': {'value': 1, 'max': 1},
            'minecraft:knockback_resistance': {'value': 1},
            'minecraft:fire_immune': {},
            # güvenlik: betik kaldırmayı unutursa (dünya kapanırsa) 20 sn sonra kendiliğinden kaybolur
            'minecraft:timer': {'looping': False, 'time': 20, 'time_down_event': {'event': 'aqualit:yok_ol'}},
        },
        'events': events,
    }}


# ------------------------------------------------------------------ geometri
def kubbe_geo():
    """16 boylam sütunu (her biri Y etrafında döndürülmüş kemik), 6 enlem bandı paneli + tepe."""
    def faces(u, v, w, h):
        big = {'uv': [u, v], 'uv_size': [w, h]}
        thin = {'uv': [u, v], 'uv_size': [1, 1]}
        return {'north': big, 'south': big, 'east': thin, 'west': thin, 'up': thin, 'down': thin}
    bones = [{'name': 'kubbe', 'pivot': [0, 0, 0]}]
    R = R_KUBBE
    cols, bands = 16, 6
    for c in range(cols):
        th = 360.0 * c / cols
        cubes = []
        for k in range(bands):
            phi = (k + 0.5) * 90.0 / bands
            pr = math.radians(phi)
            h = R * math.radians(90.0 / bands) * 1.06
            w = 2 * math.pi * R * math.cos(pr) / cols * 1.08
            cy, cz = R * math.sin(pr), R * math.cos(pr)
            cubes.append({'origin': [round(-w / 2, 3), round(cy - h / 2, 3), round(cz - 0.25, 3)],
                          'size': [round(w, 3), round(h, 3), 0.5],
                          'pivot': [0, round(cy, 3), round(cz, 3)], 'rotation': [round(-phi, 3), 0, 0],
                          'uv': faces(0, 0, 64, 64)})
        bones.append({'name': f'kubbe_{c}', 'parent': 'kubbe', 'pivot': [0, 0, 0], 'rotation': [0, th, 0], 'cubes': cubes})
    cap = 2 * R * math.sin(math.radians(90.0 / bands / 2)) * 1.4
    top = {'uv': [0, 0], 'uv_size': [64, 64]}
    edge = {'uv': [0, 0], 'uv_size': [1, 1]}
    bones.append({'name': 'kubbe_tepe', 'parent': 'kubbe', 'pivot': [0, R, 0], 'cubes': [
        {'origin': [round(-cap / 2, 3), R - 0.25, round(-cap / 2, 3)], 'size': [round(cap, 3), 0.5, round(cap, 3)],
         'uv': {'up': top, 'down': top, 'north': edge, 'south': edge, 'east': edge, 'west': edge}}]})
    return {'format_version': '1.12.0', 'minecraft:geometry': [{
        'description': {'identifier': 'geometry.aqualit.fx_kubbe', 'texture_width': 64, 'texture_height': 64,
                        'visible_bounds_width': 12, 'visible_bounds_height': 7, 'visible_bounds_offset': [0, 2.5, 0]},
        'bones': bones}]}


# ------------------------------------------------------------------ istemci (RP)
def P(n):
    return f"q.property('aqualit:{n}')"


def fx_rp():
    tex = {'kubbe': 'textures/entity/aqualit_fx/fx_kubbe'}
    for i in range(GHOST_FRAMES):
        tex[f'hayalet{i + 1}'] = f'textures/entity/aqualit_fx/fx_hayalet{i + 1}'
    return {'format_version': '1.10.0', 'minecraft:client_entity': {'description': {
        'identifier': FX_ID,
        'materials': {'default': 'entity_alphablend'},
        'textures': tex,
        'geometry': {'kubbe': 'geometry.aqualit.fx_kubbe', 'hayalet': 'geometry.aqualit.robot'},
        'animations': {'kubbe': 'animation.aqualit.fx.kubbe', 'hayalet': 'animation.aqualit.fx.hayalet',
                       'hayalet_poz': 'animation.aqualit.robot.p_dash'},
        'scripts': {'animate': [{'kubbe': f"{P('fx')} == 'kubbe'"}, {'hayalet': f"{P('fx')} == 'hayalet'"},
                                {'hayalet_poz': f"{P('fx')} == 'hayalet'"}]},
        'render_controllers': [{'controller.render.aqualit.fx_kubbe': f"{P('fx')} == 'kubbe'"},
                               {'controller.render.aqualit.fx_hayalet': f"{P('fx')} == 'hayalet'"}],
    }}}


# hayalet Kılıçlı'nın siluetidir: diğer robotların aksesuarları gizli
HIDE_ON_GHOST = ['helmet', 'hat', 'hardhat', 'cap', 'visor', 'headset', 'antenna_ball20', 'antenna_ball24',
                 'antenna_leaf19', 'antenna_sprout23', 'scarf', 'sand_bag', 'toolbelt', 'blueprint', 'backpack', 'kova']


def fx_render():
    return {'format_version': '1.8.0', 'render_controllers': {
        'controller.render.aqualit.fx_kubbe': {
            'geometry': 'Geometry.kubbe', 'materials': [{'*': 'Material.default'}], 'textures': ['Texture.kubbe'],
            'uv_anim': {'offset': ['0.0', 'q.life_time * 0.12'], 'scale': [1.0, 1.0]}, 'ignore_lighting': True},
        'controller.render.aqualit.fx_hayalet': {
            'arrays': {'textures': {'Array.ghost': [f'Texture.hayalet{i + 1}' for i in range(GHOST_FRAMES)]}},
            'geometry': 'Geometry.hayalet', 'materials': [{'*': 'Material.default'}],
            'textures': [f'Array.ghost[math.min({GHOST_FRAMES - 1}, math.floor(q.life_time * 3.5))]'],
            'ignore_lighting': True, 'part_visibility': [{'*': True}] + [{b: False} for b in HIDE_ON_GHOST]},
    }}


def fx_animations():
    grow = f"math.min(1.0, q.life_time * 3.5) * {P('boy')} * (1.0 + math.sin(q.life_time * 400) * 0.012)"
    shrink = '0.8 * (1.0 - math.min(0.3, q.life_time * 0.45))'
    A = {
        'animation.aqualit.fx.kubbe': {'loop': True, 'bones': {
            'kubbe': {'scale': [grow, grow, grow], 'rotation': [0, 'q.life_time * 14', 0]}}},
        'animation.aqualit.fx.hayalet': {'loop': True, 'bones': {
            'root': {'scale': [shrink, shrink, shrink], 'position': ['math.sin(q.life_time * 2400) * 0.25', 0, 0]}}},
    }
    return {'format_version': '1.8.0', 'animations': A}


# ------------------------------------------------------------------ parçacıklar
def particles():
    base = {'material': 'particles_blend', 'texture': 'textures/particle/aqualit_fx'}
    fade = {'color': [1, 1, 1, '1 - variable.particle_age / variable.particle_lifetime']}
    tex = {'texture_width': 64, 'texture_height': 64}
    once = {'minecraft:emitter_rate_instant': {'num_particles': 1},
            'minecraft:emitter_lifetime_once': {'active_time': 0.05}}
    yon = ['variable.yon.x', 'variable.yon.y', 'variable.yon.z']
    along = {'mode': 'derive_from_velocity', 'min_speed_threshold': 0.001}
    P = {}
    # şimşek parçası: yön (yon), uzunluk (uzun), yarı kalınlık (kalin), ömür (omur) betikten gelir
    P['simsek'] = {**once,
        'minecraft:emitter_shape_point': {'offset': [0, 0, 0], 'direction': yon},
        'minecraft:particle_initial_speed': 0.05,
        'minecraft:particle_motion_dynamic': {},
        'minecraft:particle_lifetime_expression': {'max_lifetime': 'variable.omur'},
        'minecraft:particle_appearance_billboard': {
            'size': ['variable.uzun * 0.55', 'variable.kalin * (0.8 + variable.particle_random_2 * 0.4)'],
            'facing_camera_mode': 'lookat_direction', 'direction': along,
            'uv': {**tex, 'uv': [0, 'math.floor(variable.particle_random_1 * 3.99) * 8'], 'uv_size': [32, 8]}},
        'minecraft:particle_appearance_tinting': fade,
    }
    # elektrikli zincir parçası (kanca)
    P['zincir'] = {**once,
        'minecraft:emitter_shape_point': {'offset': [0, 0, 0], 'direction': yon},
        'minecraft:particle_initial_speed': 0.05,
        'minecraft:particle_motion_dynamic': {},
        'minecraft:particle_lifetime_expression': {'max_lifetime': 'variable.omur'},
        'minecraft:particle_appearance_billboard': {
            'size': ['variable.uzun * 0.52', 0.11],
            'facing_camera_mode': 'lookat_direction', 'direction': along,
            'uv': {**tex, 'uv': [32, '48 + math.floor(variable.particle_random_1 * 1.99) * 8'], 'uv_size': [32, 8]}},
        'minecraft:particle_appearance_tinting': fade,
    }
    # kıvılcım: hızla saçılan, yerçekimiyle düşen ışık çizgileri
    P['kivilcim'] = {
        'minecraft:emitter_rate_instant': {'num_particles': 16},
        'minecraft:emitter_lifetime_once': {'active_time': 0.05},
        'minecraft:emitter_shape_sphere': {'radius': 0.12, 'surface_only': True, 'direction': 'outwards'},
        'minecraft:particle_initial_speed': '4 + variable.particle_random_2 * 5',
        'minecraft:particle_motion_dynamic': {'linear_acceleration': [0, -12, 0], 'linear_drag_coefficient': 3},
        'minecraft:particle_lifetime_expression': {'max_lifetime': '0.22 + variable.particle_random_3 * 0.3'},
        'minecraft:particle_appearance_billboard': {
            'size': ['0.14 + variable.particle_random_1 * 0.1', 0.025],
            'facing_camera_mode': 'lookat_direction', 'direction': {'mode': 'derive_from_velocity', 'min_speed_threshold': 0.05},
            'uv': {**tex, 'uv': [48, 0], 'uv_size': [16, 16]}},
        'minecraft:particle_appearance_tinting': fade,
    }
    # yere yayılan şok dalgası halkası (boy: son yarıçap)
    P['sok_dalgasi'] = {**once,
        'minecraft:emitter_shape_point': {'offset': [0, 0.06, 0]},
        'minecraft:particle_lifetime_expression': {'max_lifetime': 0.55},
        'minecraft:particle_appearance_billboard': {
            'size': ['0.3 + variable.boy * math.pow(variable.particle_age / variable.particle_lifetime, 0.6)'] * 2,
            'facing_camera_mode': 'emitter_transform_xz', 'uv': {**tex, 'uv': [0, 32], 'uv_size': [32, 32]}},
        'minecraft:particle_appearance_tinting': fade,
    }
    # robotun etrafında yükselen enerji halkası
    P['enerji_halka'] = {**once,
        'minecraft:emitter_shape_point': {'offset': [0, 0.05, 0], 'direction': [0, 1, 0]},
        'minecraft:particle_initial_speed': 2.2,
        'minecraft:particle_motion_dynamic': {'linear_drag_coefficient': 1.6},
        'minecraft:particle_lifetime_expression': {'max_lifetime': 0.8},
        'minecraft:particle_appearance_billboard': {
            'size': ['variable.boy * (1.0 - variable.particle_age * 0.7)'] * 2,
            'facing_camera_mode': 'emitter_transform_xz', 'uv': {**tex, 'uv': [40, 32], 'uv_size': [16, 16]}},
        'minecraft:particle_appearance_tinting': fade,
    }
    P['kubbe_parilti'] = {**once,
        'minecraft:emitter_shape_point': {'offset': [0, 0, 0]},
        'minecraft:particle_lifetime_expression': {'max_lifetime': 0.5},
        'minecraft:particle_appearance_billboard': {
            'size': ['(0.16 + variable.particle_random_1 * 0.14) * (1 + variable.particle_age * 2)'] * 2,
            'facing_camera_mode': 'rotate_xyz', 'uv': {**tex, 'uv': [32, 32], 'uv_size': [8, 8]}},
        'minecraft:particle_appearance_tinting': fade,
    }
    P['golge_duman'] = {
        'minecraft:emitter_rate_instant': {'num_particles': 12},
        'minecraft:emitter_lifetime_once': {'active_time': 0.05},
        'minecraft:emitter_shape_box': {'offset': [0, 0.5, 0], 'half_dimensions': [0.3, 0.5, 0.3], 'direction': 'outwards'},
        'minecraft:particle_initial_speed': '0.5 + variable.particle_random_2 * 0.8',
        'minecraft:particle_motion_dynamic': {'linear_acceleration': [0, 0.9, 0], 'linear_drag_coefficient': 1.8},
        'minecraft:particle_lifetime_expression': {'max_lifetime': '0.6 + variable.particle_random_3 * 0.5'},
        'minecraft:particle_appearance_billboard': {
            'size': ['0.22 + variable.particle_age * 0.55'] * 2,
            'facing_camera_mode': 'rotate_xyz', 'uv': {**tex, 'uv': [32, 16], 'uv_size': [16, 16]}},
        'minecraft:particle_appearance_tinting': fade,
    }
    # ışık patlaması (boy: büyüklük)
    P['parlama'] = {**once,
        'minecraft:emitter_shape_point': {'offset': [0, 0, 0]},
        'minecraft:particle_lifetime_expression': {'max_lifetime': 0.28},
        'minecraft:particle_appearance_billboard': {
            'size': ['variable.boy * (0.55 + variable.particle_age * 2.4)'] * 2,
            'facing_camera_mode': 'rotate_xyz', 'uv': {**tex, 'uv': [48, 0], 'uv_size': [16, 16]}},
        'minecraft:particle_appearance_tinting': fade,
    }
    out = {}
    for k, comps in P.items():
        out[k] = {'format_version': '1.10.0', 'particle_effect': {
            'description': {'identifier': f'aqualit:{k}', 'basic_render_parameters': base}, 'components': comps}}
    return out


# betiğin parçacıklara geçmesi gereken değişkenler (test/validate için)
PARTICLE_VARS = {
    'simsek': ['yon', 'uzun', 'kalin', 'omur'],
    'zincir': ['yon', 'uzun', 'omur'],
    'sok_dalgasi': ['boy'],
    'enerji_halka': ['boy'],
    'parlama': ['boy'],
    'kivilcim': [], 'kubbe_parilti': [], 'golge_duman': [],
}
