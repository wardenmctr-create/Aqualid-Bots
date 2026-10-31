"""Mini Keşif (yapay zekâsız): robot <-> binilebilir araçlar (uçak, gemi, denizaltı, arazi aracı, matkap).

Model ve doku: kesif.py (önizlemelerdeki modelin aynısı). Açılma animasyonları kesif_donusum.UNFOLD
zaman çizelgesinden 0,05 sn aralıkla pişirilir. Sürüş betikte (src/scripts/kesif.js).
"""
import math
import json
import os
import sys

ART = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ART)

KID = 'aqualit:kesif'
FORMS = ['robot', 'ucak', 'gemi', 'denizalti', 'arazi', 'matkap']
ROOT = {'robot': 'root', 'ucak': 'u_root', 'gemi': 'g_root', 'denizalti': 'd_root', 'arazi': 'a_root', 'matkap': 'm_root'}
VS = 1.4                                # araçların ölçeği (robot hali 0.8); v0.3.1'de büyütüldü
PXB = VS / 16                           # model pikseli → blok
# çarpışma kutusu (genişlik, yükseklik) blok
BOX = {'robot': (0.7, 1.4), 'ucak': (3.0, 1.6), 'gemi': (2.0, 1.4), 'denizalti': (1.6, 1.6), 'arazi': (2.4, 1.8),
       'matkap': (2.6, 2.4)}
# Oturma planı: (x, y, z, tür) model pikseli, +z ileri. Binen robot oturur (tutun: tekerleğe tutunur).
# Koltuklar sırayla dolar; ilk koltuk sürücünün. Yer kalmazsa kalanlar aracın içine girer (görünmez, kesif_ai.js).
SEATS = {
    'ucak': [(0, 18, -1, 'koltuk'), (0, 18, -14, 'koltuk'),
             (-14, 11, -1, 'kanat'), (14, 11, -1, 'kanat'), (-26, 11, -1, 'kanat'), (26, 11, -1, 'kanat'),
             (-10, 14, -35.5, 'arka_kanat'), (10, 14, -35.5, 'arka_kanat'),
             (-13, -3, -5, 'tutun'), (13, -3, -5, 'tutun')],
    'gemi': [(0, 12, 11, 'koltuk'), (-6, 12, 19, 'guverte'), (6, 12, 19.5, 'guverte'), (0, 12, 26, 'bas'),
             (-6, 12, -16.5, 'guverte'), (6, 12, -16.5, 'guverte'), (-5, 12, -22, 'kic'), (5, 12, -22, 'kic'),
             (-3.8, 24, 0, 'tavan'), (3.8, 24, 0, 'tavan')],
    # denizaltı: robotlar dışarıda boğulur, hepsi içeri girer; tek koltuk oyuncunun
    'denizalti': [(0, 16, 12, 'koltuk')],
    'arazi': [(5, 13, -3, 'koltuk'), (-5, 13, -3, 'koltuk'), (-5, 13, -11, 'koltuk'), (5, 13, -11, 'koltuk'),
              (0, 13, -15.5, 'koltuk'), (0, 15, 12, 'kaput'), (-13.5, 13, 14, 'camurluk'), (13.5, 13, 14, 'camurluk'),
              (-3.8, 24, -4, 'tavan'), (3.8, 24, -4, 'tavan')],
    # matkap: sürücü kabinin arkasında, 4 robot içeride (arka kapıdan girilir), 5 robot arka platformda
    'matkap': [(0, 20, -12.4, 'koltuk'), (-3.8, 5, -11, 'ic'), (3.8, 5, -11, 'ic'), (-3.8, 5, -3.5, 'ic'),
               (3.8, 5, -3.5, 'ic'), (-8, 5, -22.5, 'platform'), (8, 5, -22.5, 'platform'), (-9, 5, -30.5, 'platform'),
               (0, 5, -30.5, 'platform'), (9, 5, -30.5, 'platform')],
}
HIZ = {'ucak': 0.62, 'gemi': 0.32, 'denizalti': 0.26, 'arazi': 0.36, 'matkap': 0.1}   # oyuncu sürerken temel hız
UCAN = {'ucak', 'denizalti'}           # v0.3.6: uçan binek sistemiyle sürülenler
YALNIZ_OYUNCU = {'denizalti'}
# v0.3.6: sürüş modu grupları (ilk = varsayılan): arazi yerde / duvara tırmanırken, denizaltı suda / karada
MODLAR = {'arazi': ('k_arazi_yer', 'k_tirman'), 'denizalti': ('k_denizalti_su', 'k_denizalti_kara')}
HAREKET_BILESEN = {'physics', 'input_ground_controlled', 'input_air_controlled', 'movement', 'movement.basic',
                   'jump.static', 'variable_max_auto_step', 'flying_speed', 'can_fly'}           # bu araçlara robot binmez (içeri girer)
KAPI_ACI = -100                         # matkap kapısının açık hali (derece, Y ekseni)


def seat_pos(s):
    """Bedrock koltuğu (blok, varlık uzayı +z ileri)."""
    return [round(s[0] * PXB, 3), round(s[1] * PXB, 3), round(s[2] * PXB, 3)]


def koltuk_js(path):
    """Oyun içi kod için oturma planı (kesif_ai.js poz ve kapasite için okur)."""
    d = {f: [{'x': seat_pos(s)[0], 'y': seat_pos(s)[1], 'z': seat_pos(s)[2], 'tur': s[3]} for s in v] for f, v in SEATS.items()}
    with open(path, 'w') as fh:
        fh.write('// gen/kesif_oyun.py üretir — elle değiştirme.\n')
        fh.write('// Keşif araçlarının oturma planı: koltuk sırası, yeri (blok) ve türü (tutun = tekerleğe tutunur).\n')
        fh.write(f'export const KOLTUK = {json.dumps(d, ensure_ascii=False)};\n')
        fh.write(f'export const YALNIZ_OYUNCU = {json.dumps(sorted(YALNIZ_OYUNCU))};\n')


def P(n):
    return f"q.property('aqualit:{n}')"


# ------------------------------------------------------------------ davranış (BP)
def kesif_bp():
    groups = {}
    for f in FORMS:
        w, h = BOX[f]
        g = {'minecraft:collision_box': {'width': w, 'height': h},
             'minecraft:physics': {'has_gravity': f not in ('ucak', 'denizalti'), 'has_collision': True}}
        if f in UCAN:
            # v0.3.6: uçak ve denizaltı oyunun uçan binek sistemiyle (Mutlu Ghast gibi) sürülür: baktığın yöne gider,
            # yukarı bakıp ileri basınca yükselir, aşağı bakınca alçalır/dalar
            g['minecraft:input_air_controlled'] = {'strafe_speed_modifier': 0.6, 'backwards_movement_modifier': 0.5}
            g['minecraft:flying_speed'] = {'value': HIZ[f]}
            g['minecraft:movement'] = {'value': HIZ[f]}
            g['minecraft:can_fly'] = {}
        elif f != 'robot':
            # v0.3.5: oyuncu oyunun kendi sürüş sistemiyle sürer (betikle itki, oyuncu binince oyunda işlemiyordu)
            g['minecraft:input_ground_controlled'] = {}
            g['minecraft:movement'] = {'value': HIZ[f]}
            g['minecraft:movement.basic'] = {}
            g['minecraft:jump.static'] = {}
            # v0.3.6: bir blok yükseğe kendiliğinden çıkar
            g['minecraft:variable_max_auto_step'] = {'base_value': 1.0625, 'controlled_value': 1.0625,
                                                     'jump_prevented_value': 1.0625}
        else:
            # v0.3.6: robot hali öteki Aqualit robotları gibi etrafına ve oyuncuya bakar (yürümez; betik taşır)
            g['minecraft:movement'] = {'value': 0.25}
            g['minecraft:movement.basic'] = {}
            g['minecraft:jump.static'] = {}
            g['minecraft:navigation.walk'] = {'avoid_water': False}
            g['minecraft:behavior.look_at_player'] = {'priority': 8, 'look_distance': 8, 'probability': 0.04}
            g['minecraft:behavior.random_look_around'] = {'priority': 9}
        if f in SEATS:
            pos = SEATS[f]
            g['minecraft:rideable'] = {
                'seat_count': len(pos), 'family_types': ['player'] + ([] if f in YALNIZ_OYUNCU else ['aqualit_robot']),
                'interact_text': 'Bin', 'crouching_skip_interact': True, 'pull_in_entities': False,
                'seats': [{'position': seat_pos(sp), 'min_rider_count': 0, 'max_rider_count': len(pos)} for sp in pos]}
        if f == 'gemi':
            g['minecraft:buoyant'] = {'base_buoyancy': 1.0, 'apply_gravity': True, 'simulate_waves': True,
                                      'big_wave_probability': 0.03, 'big_wave_speed': 10.0,
                                      'liquid_blocks': ['minecraft:water', 'minecraft:flowing_water']}
        # dokununca menü: robotken her dokunuşta, araçken eğilip dokununca (dokunmak binmek)
        # (v0.3.0'a kadar etkileşim yoktu: robot haline dokunmak oyunda vuruş sayılıyor, menü hiç açılmıyordu)
        g['minecraft:interact'] = {'interactions': [{
            'on_interact': {'filters': {'all_of': [{'test': 'is_family', 'subject': 'other', 'value': 'player'}] + (
                [] if f == 'robot' else [{'test': 'is_sneaking', 'subject': 'other'}])},
                'event': 'aqualit:kesif_menu', 'target': 'self'},
            'interact_text': 'action.interact.aqualit.kesif', 'swing': True}]}
        g['minecraft:variant'] = {'value': FORMS.index(f)}     # istemci biçimi sayıyla bilir (q.variant)
        if f in MODLAR:
            # v0.3.6: sürüş bileşenleri ayrı gruba (arazi: yer/tırmanma, denizaltı: su/kara); mod değişince binenler inmez
            hareket = {k: g.pop(k) for k in list(g) if k.split(':')[1] in HAREKET_BILESEN}
            groups[MODLAR[f][0]] = hareket
        groups[f'k_{f}'] = g
    # uzaktayken (yapı ararken, harita çıkarırken) çevresindeki yığınları işletir
    groups['k_tick'] = {'minecraft:tick_world': {'radius': 2, 'never_despawn': True}}
    groups['k_gecis'] = {'minecraft:mark_variant': {'value': 1}}      # dönüşüm sürüyor (q.mark_variant)
    # v0.3.6: grubu kaldırmak işareti sıfırlamıyordu; araç dönüşüm animasyonunun son karesinde (0,22 boy, 180° dönük)
    # kalıyordu: "her hal küçük, araca tersten biniyorum". İşaret artık ayrı grupla açıkça 0'a çekilir.
    groups['k_gecis0'] = {'minecraft:mark_variant': {'value': 0}}
    # tutucular: istemci q.skin_id ile de bilir (özellik okunmazsa diye)
    groups['k_tutucu1'] = {'minecraft:skin_id': {'value': 1}}
    groups['k_tutucu0'] = {'minecraft:skin_id': {'value': 0}}
    # v0.3.6: arazi aracı tırmanma modu: duvara dayanınca yerçekimsiz, baktığı/sürdüğü yöne (yukarı) gider
    groups['k_tirman'] = {'minecraft:physics': {'has_gravity': False, 'has_collision': True},
                          'minecraft:input_air_controlled': {'strafe_speed_modifier': 0.3, 'backwards_movement_modifier': 0.6},
                          'minecraft:flying_speed': {'value': 0.16}, 'minecraft:movement': {'value': 0.16},
                          'minecraft:can_fly': {}}
    # denizaltı suyun dışında: düşer, karada çok yavaş sürünür
    groups['k_denizalti_kara'] = {'minecraft:physics': {'has_gravity': True, 'has_collision': True},
                                  'minecraft:input_ground_controlled': {}, 'minecraft:movement': {'value': 0.06},
                                  'minecraft:movement.basic': {}}
    events = {'minecraft:entity_spawned': {'add': {'component_groups': ['k_robot']}},
              'aqualit:kesif_menu': {},
              'aqualit:tick_on': {'add': {'component_groups': ['k_tick']}},
              'aqualit:tick_off': {'remove': {'component_groups': ['k_tick']}},
              'aqualit:gecis_on': {'remove': {'component_groups': ['k_gecis0']}, 'add': {'component_groups': ['k_gecis']}},
              'aqualit:gecis_off': {'remove': {'component_groups': ['k_gecis']}, 'add': {'component_groups': ['k_gecis0']}},
              'aqualit:tirman_on': {'remove': {'component_groups': ['k_arazi_yer']}, 'add': {'component_groups': ['k_tirman']}},
              'aqualit:tirman_off': {'remove': {'component_groups': ['k_tirman']}, 'add': {'component_groups': ['k_arazi_yer']}},
              'aqualit:tutucu_on': {'remove': {'component_groups': ['k_tutucu0']}, 'add': {'component_groups': ['k_tutucu1']},
                                    'set_property': {'aqualit:tutucu': True}},
              'aqualit:tutucu_off': {'remove': {'component_groups': ['k_tutucu1']}, 'add': {'component_groups': ['k_tutucu0']},
                                     'set_property': {'aqualit:tutucu': False}},
              'aqualit:dz_su': {'remove': {'component_groups': ['k_denizalti_kara']}, 'add': {'component_groups': ['k_denizalti_su']}},
              'aqualit:dz_kara': {'remove': {'component_groups': ['k_denizalti_su']}, 'add': {'component_groups': ['k_denizalti_kara']}}}
    for f in FORMS:
        events[f'aqualit:form_{f}'] = {
            'remove': {'component_groups': [f'k_{o}' for o in FORMS if o != f] +
                       [x for o, m in MODLAR.items() for x in m if o != f or x != m[0]]},
            'add': {'component_groups': [f'k_{f}'] + ([MODLAR[f][0]] if f in MODLAR else [])},
            'set_property': {'aqualit:form': f}}
    return {'format_version': '1.26.0', 'minecraft:entity': {
        'description': {'identifier': KID, 'is_spawnable': False, 'is_summonable': True,
                        'properties': {
                            'aqualit:form': {'type': 'enum', 'values': FORMS, 'default': 'robot', 'client_sync': True},
                            'aqualit:gecis': {'type': 'bool', 'default': False, 'client_sync': True},
                            'aqualit:egim': {'type': 'float', 'range': [-90, 90], 'default': 0, 'client_sync': True},
                            # v0.3.6: arazi aracının tırmanma tutucuları açık
                            'aqualit:tutucu': {'type': 'bool', 'default': False, 'client_sync': True},
                            'aqualit:kapi': {'type': 'bool', 'default': False, 'client_sync': True},  # matkap kapısı açık
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
            'minecraft:nameable': {'always_show': False, 'allow_name_tag_renaming': False},
            # v0.3.4: oyun betikle konan varlıkta başlangıç olayını çalıştırmazsa da dokunma ve robot hali olsun
            'minecraft:variant': {'value': 0},
            'minecraft:interact': {'interactions': [{
                'on_interact': {'filters': {'all_of': [{'test': 'is_family', 'subject': 'other', 'value': 'player'}]},
                                'event': 'aqualit:kesif_menu', 'target': 'self'},
                'interact_text': 'action.interact.aqualit.kesif', 'swing': True}]},
        },
        'events': events,
    }}


# ------------------------------------------------------------------ istemci (RP)
def kesif_rp():
    anims = {'ctrl': 'controller.animation.aqualit.kesif', 'kapi_ctrl': 'controller.animation.aqualit.kesif.kapi'}
    anims['look_at_target'] = 'animation.common.look_at_target'
    for n in ['gizle', 'tutucu', 'fold', 'robot_in', 'kapi_ac', 'kapi_kapa', 'idle_robot', 'walk_robot'] + [f'run_{f}' for f in FORMS] + [f'unfold_{f}' for f in FORMS if f != 'robot']:
        anims[n] = f'animation.aqualit.kesif.{n}'
    return {'format_version': '1.10.0', 'minecraft:client_entity': {'description': {
        'identifier': KID,
        'materials': {'default': 'entity_alphatest', 'glow': 'copper_golem_eyes'},
        'textures': {'default': 'textures/entity/aqualit_kesif/kesif', 'glow': 'textures/entity/aqualit_kesif/kesif_glow'},
        'geometry': {'default': 'geometry.aqualit.kesif'},
        'animations': anims,
        'scripts': {'scale': f"q.variant == 0 ? 0.8 : {VS}", 'animate': ['gizle', 'tutucu', 'ctrl', 'kapi_ctrl']},
        'render_controllers': ['controller.render.aqualit.kesif', 'controller.render.aqualit.kesif_glow'],
    }}}


def kesif_render():
    vis = [{'*': True}] + [{ROOT[f]: f"q.variant == {i}"} for i, f in enumerate(FORMS)]
    base = {'geometry': 'Geometry.default', 'part_visibility': vis}
    return {'format_version': '1.8.0', 'render_controllers': {
        'controller.render.aqualit.kesif': {**base, 'materials': [{'*': 'Material.default'}], 'textures': ['Texture.default']},
        'controller.render.aqualit.kesif_glow': {**base, 'materials': [{'*': 'Material.glow'}], 'textures': ['Texture.glow'],
                                                 'ignore_lighting': True},
    }}


def kesif_ctrl():
    G = f"q.mark_variant == 1 && {P('gecis')}"
    to = lambda skip=None: [{f: f"!({G}) && q.variant == {FORMS.index(f)}"} for f in FORMS if f != skip]
    states = {'default': {'transitions': [{'gecis': G}] + to()}}
    for f in FORMS:
        anims = ['robot_in', 'run_robot', 'idle_robot', 'look_at_target', {'walk_robot': 'q.ground_speed > 0.4'}] \
            if f == 'robot' else [f'unfold_{f}', f'run_{f}']
        states[f] = {'animations': anims, 'transitions': [{'gecis': G}] + to(f), 'blend_transition': 0.08}
    states['gecis'] = {'animations': ['fold'], 'transitions': to()}
    K = P('kapi')
    kapi = {'initial_state': 'kapali', 'states': {
        'kapali': {'animations': ['kapi_kapa'], 'transitions': [{'acik': K}]},
        'acik': {'animations': ['kapi_ac'], 'transitions': [{'kapali': f'!{K}'}]}}}
    return {'format_version': '1.10.0', 'animation_controllers': {
        'controller.animation.aqualit.kesif': {'initial_state': 'default', 'states': states},
        'controller.animation.aqualit.kesif.kapi': kapi}}


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
    # v0.3.5: aktif olmayan halleri sıfır boyuta indirir (oyunda render controller'ın parça gizlemesi uygulanmıyor,
    # bütün haller üst üste çiziliyordu; animasyonlar ise çalışıyor)
    A['gizle'] = {'loop': True, 'bones': {ROOT[f]: {'scale': f"q.variant == {i} ? 1 : 0"} for i, f in enumerate(FORMS)}}
    # v0.3.6: arazi aracının tırmanma tutucuları (Tırmanma Modu açıkken görünür)
    TUT = f"(q.skin_id == 1 || {P('tutucu')}) ? 1 : 0"
    A['tutucu'] = {'loop': True, 'bones': {f'a_tut_{w}': {'scale': TUT} for w in ('fl', 'fr', 'bl', 'br')}}
    # matkabın arka kapısı (0,4 sn): dışarı, platforma doğru açılır
    A['kapi_ac'] = {'loop': 'hold_on_last_frame', 'animation_length': 0.4, 'bones': {
        'm_door': {'rotation': {'0.0': [0, 0, 0], '0.4': [0, KAPI_ACI, 0]}}}}
    A['kapi_kapa'] = {'loop': 'hold_on_last_frame', 'animation_length': 0.4, 'bones': {
        'm_door': {'rotation': {'0.0': [0, KAPI_ACI, 0], '0.4': [0, 0, 0]}}}}
    spin = lambda k: [0, 0, f'q.life_time * {k}']
    wave = [0, 'math.sin(q.life_time * 400) * 12', 0]
    radar = [0, 'q.life_time * 220', 0]
    wheel = ['q.modified_distance_moved * -230', 0, 0]
    A['run_robot'] = {'loop': True, 'bones': {
        'root': {'position': [0, 'math.sin(q.life_time * 200) * 0.35', 0]}, 'k_radar': {'rotation': radar},
        'k_scarf_tail': {'rotation': ['math.sin(q.life_time * 300) * 8', 0, 'math.sin(q.life_time * 200) * 6']},
        'k_flame': {'scale': [1, 1, '0.8 + math.abs(math.sin(q.life_time * 900)) * 0.4']}}}
    # v0.3.6: robot hali öteki Aqualit robotları gibi nefes alır, kollarını sallar, yürürken bacaklarını oynatır
    A['idle_robot'] = {'loop': True, 'animation_length': 4.0, 'bones': {
        'body': {'position': [0, 'math.sin(q.anim_time * 90) * 0.2', 0]},
        'head': {'rotation': [0, 0, 'math.sin(q.anim_time * 90 + 30) * 2']},
        'right_arm': {'rotation': ['math.sin(q.anim_time * 90) * 3', 0, '3 + math.sin(q.anim_time * 90) * 2']},
        'left_arm': {'rotation': ['-math.sin(q.anim_time * 90) * 3', 0, '-3 - math.sin(q.anim_time * 90) * 2']},
        'k_scarf_tail': {'rotation': ['math.sin(q.anim_time * 180) * 6', 0, 0]}}}
    A['walk_robot'] = {'loop': True, 'animation_length': 0.6, 'bones': {
        'right_leg': {'rotation': ['math.cos(q.anim_time * 600) * 35', 0, 0]},
        'left_leg': {'rotation': ['-math.cos(q.anim_time * 600) * 35', 0, 0]},
        'right_arm': {'rotation': ['-math.cos(q.anim_time * 600) * 28', 0, 0]},
        'left_arm': {'rotation': ['math.cos(q.anim_time * 600) * 28', 0, 0]},
        'body': {'position': [0, 'math.abs(math.sin(q.anim_time * 600)) * 0.6', 0]}}}
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
        'a_root': {'rotation': [P('egim'), 0, 0]},
        **{f'a_wheel_{w}': {'rotation': wheel} for w in ('fl', 'fr', 'bl', 'br')},
        'a_radar': {'rotation': radar}, 'a_flag': {'rotation': wave}}}
    A['run_matkap'] = {'loop': True, 'bones': {
        'm_root': {'rotation': [P('egim'), 0, 0]},
        'm_drill': {'rotation': spin(1440)}, 'm_radar': {'rotation': radar},
        **{f'm_rw_{s}{i}': {'rotation': wheel} for s in 'lr' for i in range(3)}}}
    for f in FORMS:
        if f != 'robot':
            A[f'unfold_{f}'] = bake_unfold(f)
    return {'format_version': '1.8.0', 'animations': {f'animation.aqualit.kesif.{k}': v for k, v in A.items()}}


def kafa_simgeleri(geo, tex, glow, out_dir):
    """Konum çubuğu: Keşif'in kafası (pilot başlığı, gözlük) ve gönderdiği konum iğnesi."""
    import kafa_ikon as KI
    import render_z as Z
    from PIL import Image
    os.makedirs(out_dir, exist_ok=True)
    roots = {ROOT[f] for f in FORMS if f != 'robot'}
    size = 32
    cam = Z.Cam(yaw=24, elev=12, scale=1.25, size=(size, size), center=(0, 17.5, 0))
    img = Z.render(geo, tex, {}, roots, cam, glow=glow, bg=KI.KEY, ss=1, shadow=False, only={'head'}).convert('RGBA')
    px = img.load()
    for y in range(size):
        for x in range(size):
            r, g, b, _ = px[x, y]
            if abs(r - 255) < 40 and g < 60 and abs(b - 255) < 40:
                px[x, y] = (0, 0, 0, 0)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    a = img.split()[3]
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        out.paste(Image.new('RGBA', (size, size), (8, 30, 28, 255)), (dx, dy), a)
    out.alpha_composite(img)
    out.save(os.path.join(out_dir, 'bas_kesif.png'))
    KI.pin_icon(out).save(os.path.join(out_dir, 'pin_kesif.png'))


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
    kafa_simgeleri(geo, tex, glow, f'{RP}/textures/ui/aqualit_bas')
    koltuk_js(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'scripts', 'kesif_koltuk.js'))
    bones = {b['name'] for b in geo['minecraft:geometry'][0]['bones']}
    used = set()
    for a in kesif_anims()['animations'].values():
        used |= set(a['bones'])
    used.discard('look_at_target')
    missing = used - bones
    assert not missing, f'animasyonda olmayan kemikler: {missing}'
