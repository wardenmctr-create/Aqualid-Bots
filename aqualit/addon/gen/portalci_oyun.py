"""Portalcı robot (v0.4.0) ve kendi portalı.

aqualit:portalci — robot kafası boyunda dron (tasarim/portalci.py, 3. tasarım): 4 halkalı pervane, arkada dönen portal
merceği, kızaklar, yarı saydam cam ekran. Boşken küçülüp omuzda süzülür ('aqualit:kucuk'). Oyuncuyu ya da robotu
omuzlarından tutup taşır (binici aşağıda sarkar).
aqualit:portal — Minecraft portalı değil: ince teknolojik çerçeve, içinde dönen mor-turkuaz girdap; 1x1 ve 2x1.
Girdap 8 karelik doku şeridiyle döner (uv_anim)."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.normpath(os.path.join(HERE, '..', '..'))
TAS = os.path.join(ART, 'tasarim')
for p in (HERE, ART, TAS, os.path.join(ART, 'addon', 'test')):
    if p not in sys.path:
        sys.path.insert(0, p)
import kesif as K  # noqa: E402
from PIL import Image  # noqa: E402

PID = 'aqualit:portalci'
POID = 'aqualit:portal'
KARE = 8


def _serit(frames):
    """Aynı yerleşimli kareleri alt alta dizer (uv_anim için)."""
    w, h = frames[0].size
    out = Image.new('RGBA', (w, h * len(frames)), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        out.paste(f, (0, i * h))
    return out


def _cam_saydam(tex, alfa=128):
    px = tex.load()
    if 'cam' not in K.SON_UV:
        return
    _, u, v, w, h = K.SON_UV['cam']
    for x in range(u, u + w):
        for y in range(v, v + h):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (r, g, b, alfa)


def uv_anim(n=KARE, hiz=8):
    return {'offset': [0, f'math.mod(math.floor(q.life_time * {hiz}), {n}) / {n}'], 'scale': [1, f'1 / {n}']}


def portalci_bp():
    return {'format_version': '1.21.0', 'minecraft:entity': {
        'description': {'identifier': PID, 'is_spawnable': False, 'is_summonable': True,
                        'properties': {'aqualit:kucuk': {'type': 'bool', 'default': False, 'client_sync': True}}},
        'components': {
            'minecraft:type_family': {'family': ['aqualit_portalci', 'aqualit_robot_dost', 'inanimate']},
            'minecraft:collision_box': {'width': 0.8, 'height': 0.7},
            'minecraft:health': {'value': 40, 'max': 40},
            'minecraft:damage_sensor': {'triggers': [{'cause': 'all', 'deals_damage': 'no'}]},
            'minecraft:physics': {'has_gravity': False, 'has_collision': False},
            'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
            'minecraft:knockback_resistance': {'value': 1.0},
            'minecraft:fire_immune': {},
            'minecraft:breathable': {'breathes_water': True, 'breathes_air': True, 'suffocate_time': 0},
            'minecraft:loot': {'table': 'loot_tables/empty.json'},
            'minecraft:persistent': {},
            'minecraft:nameable': {'always_show': False, 'allow_name_tag_renaming': True},
            # omuzlarından tutup taşır: binici gövdenin altında sarkar
            'minecraft:rideable': {'seat_count': 1, 'crouching_skip_interact': True, 'interact_text': 'action.interact.ride.horse',
                                   'family_types': ['player', 'aqualit_robot'], 'pull_in_entities': False,
                                   'seats': [{'position': [0, -1.55, 0], 'lock_rider_rotation': 181}]},
            'minecraft:tick_world': {'radius': 2, 'never_despawn': True},
        }}}


def portal_bp():
    return {'format_version': '1.21.0', 'minecraft:entity': {
        'description': {'identifier': POID, 'is_spawnable': False, 'is_summonable': True,
                        'properties': {'aqualit:buyuk': {'type': 'bool', 'default': True, 'client_sync': True}}},
        'components': {
            'minecraft:type_family': {'family': ['aqualit_portal', 'inanimate']},
            'minecraft:collision_box': {'width': 0.1, 'height': 0.1},
            'minecraft:health': {'value': 10, 'max': 10},
            'minecraft:damage_sensor': {'triggers': [{'cause': 'all', 'deals_damage': 'no'}]},
            'minecraft:physics': {'has_gravity': False, 'has_collision': False},
            'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
            'minecraft:knockback_resistance': {'value': 1.0},
            'minecraft:fire_immune': {},
            'minecraft:loot': {'table': 'loot_tables/empty.json'},
        }}}


def portalci_rp():
    return {'format_version': '1.10.0', 'minecraft:client_entity': {'description': {
        'identifier': PID,
        # cam yarı saydam (evcil çırak dronla aynı malzeme)
        'materials': {'default': 'entity_alphablend', 'glow': 'copper_golem_eyes'},
        'textures': {'default': 'textures/entity/aqualit_portalci/portalci',
                     'glow': 'textures/entity/aqualit_portalci/portalci_glow'},
        'geometry': {'default': 'geometry.aqualit.portalci'},
        'animations': {'uc': 'animation.aqualit.portalci.uc'},
        'scripts': {'animate': ['uc'], 'scale': "q.property('aqualit:kucuk') ? 0.32 : 0.9"},
        'render_controllers': ['controller.render.aqualit.portalci', 'controller.render.aqualit.portalci_glow'],
    }}}


def portal_rp():
    return {'format_version': '1.10.0', 'minecraft:client_entity': {'description': {
        'identifier': POID,
        'materials': {'default': 'entity_alphatest', 'glow': 'copper_golem_eyes'},
        'textures': {'k': 'textures/entity/aqualit_portal/portal11', 'k_glow': 'textures/entity/aqualit_portal/portal11_glow',
                     'b': 'textures/entity/aqualit_portal/portal12', 'b_glow': 'textures/entity/aqualit_portal/portal12_glow'},
        'geometry': {'k': 'geometry.aqualit.portal11', 'b': 'geometry.aqualit.portal12'},
        'animations': {'ac': 'animation.aqualit.portal.ac'},
        'scripts': {'animate': ['ac']},
        'render_controllers': ['controller.render.aqualit.portal', 'controller.render.aqualit.portal_glow'],
    }}}


def render_ctrl():
    P = "q.property('aqualit:buyuk')"
    return {'format_version': '1.10.0', 'render_controllers': {
        # v0.4.6: tek kare doku (uv_anim'li 8 karelik şerit oyunda bozuk görünüyordu); girdaplar kemikle döner
        'controller.render.aqualit.portalci': {'geometry': 'Geometry.default', 'materials': [{'*': 'Material.default'}],
                                               'textures': ['Texture.default']},
        'controller.render.aqualit.portalci_glow': {'geometry': 'Geometry.default', 'materials': [{'*': 'Material.glow'}],
                                                    'textures': ['Texture.glow'], 'ignore_lighting': True},
        'controller.render.aqualit.portal': {
            'arrays': {'geometries': {'Array.g': ['Geometry.k', 'Geometry.b']}, 'textures': {'Array.t': ['Texture.k', 'Texture.b']}},
            'geometry': f'Array.g[{P} ? 1 : 0]', 'materials': [{'*': 'Material.default'}], 'textures': [f'Array.t[{P} ? 1 : 0]'],
            'uv_anim': uv_anim(hiz=10)},
        'controller.render.aqualit.portal_glow': {
            'arrays': {'geometries': {'Array.g': ['Geometry.k', 'Geometry.b']},
                       'textures': {'Array.t': ['Texture.k_glow', 'Texture.b_glow']}},
            'geometry': f'Array.g[{P} ? 1 : 0]', 'materials': [{'*': 'Material.glow'}], 'textures': [f'Array.t[{P} ? 1 : 0]'],
            'ignore_lighting': True, 'uv_anim': uv_anim(hiz=10)},
    }}


def animations():
    per = {f'per_{a}': {'rotation': [0, f"{'' if a in ('fl', 'br') else '-'}q.life_time * 900", 0]} for a in ('fl', 'fr', 'bl', 'br')}
    per['girdap'] = {'rotation': [0, 0, 'q.life_time * -200']}       # v0.4.8: girdap diski döner (renkler sabit)
    per['kure_b'] = {'rotation': [0, 'q.life_time * 140', 0]}
    per['govde'] = {'position': [0, 'math.sin(q.life_time * 120) * 0.8', 0],
                    'rotation': ['math.sin(q.life_time * 120) * 3 + (q.has_rider ? 8 : 0)', 0, 0]}
    return {'format_version': '1.8.0', 'animations': {
        'animation.aqualit.portalci.uc': {'loop': True, 'bones': per},
        # açılırken halkadan büyür
        'animation.aqualit.portal.ac': {'loop': 'hold_on_last_frame', 'bones': {
            'root': {'scale': 'math.min(1, q.life_time * 2.5)'}}},
    }}


def build(RP, BP, wj, GEN):
    import portalci as PC
    import portal as PO
    os.makedirs(f'{RP}/textures/entity/aqualit_portalci', exist_ok=True)
    os.makedirs(f'{RP}/textures/entity/aqualit_portal', exist_ok=True)
    os.makedirs(f'{RP}/models/entity', exist_ok=True)
    g, t, gl = K.build(forms=[PC.model_portalci(True, 0.0, donen=True)], W=256, ident='geometry.aqualit.portalci')
    _cam_saydam(t)
    geo, texs, glows = g, [t], [gl]
    t.save(f'{RP}/textures/entity/aqualit_portalci/portalci.png')
    gl.save(f'{RP}/textures/entity/aqualit_portalci/portalci_glow.png')
    wj(f'{RP}/models/entity/aqualit_portalci.geo.json', geo)
    # eşya simgesi
    import evcil_oyun as EO
    EO.simge(geo, texs[0], glows[0], os.path.join(GEN, 'robot_portalci.png'), yard=True)
    for ad, (wb, hb) in (('portal11', (1, 1)), ('portal12', (1, 2))):
        texs, glows, g0 = [], [], None
        for i in range(KARE):
            g, t, gl = K.build(forms=[PO.portal(i / KARE, wb, hb)], W=64, ident=f'geometry.aqualit.{ad}')
            g0 = g0 or g
            texs.append(t)
            glows.append(gl)
        _serit(texs).save(f'{RP}/textures/entity/aqualit_portal/{ad}.png')
        _serit(glows).save(f'{RP}/textures/entity/aqualit_portal/{ad}_glow.png')
        wj(f'{RP}/models/entity/aqualit_{ad}.geo.json', g0)
    wj(f'{BP}/entities/portalci.json', portalci_bp())
    wj(f'{BP}/entities/portal.json', portal_bp())
    wj(f'{RP}/entity/aqualit_portalci.entity.json', portalci_rp())
    wj(f'{RP}/entity/aqualit_portal.entity.json', portal_rp())
    wj(f'{RP}/render_controllers/aqualit_portalci.render_controllers.json', render_ctrl())
    wj(f'{RP}/animations/aqualit_portalci.animation.json', animations())
