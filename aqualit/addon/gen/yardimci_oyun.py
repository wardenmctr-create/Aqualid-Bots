"""Organizatör Yardımcısı (v0.4.0): öteki dronlardan büyük dron (tasarim/yardimci.py). Organizatör sandıklara kendisi
yürümez: Yardımcı uçup gider, eşyaları turkuaz ışınla ışınlar, geri gelir (organizator.js / yardimci.js)."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.normpath(os.path.join(HERE, '..', '..'))
for p in (HERE, ART, os.path.join(ART, 'tasarim'), os.path.join(ART, 'addon', 'test')):
    if p not in sys.path:
        sys.path.insert(0, p)
import kesif as K  # noqa: E402

ID = 'aqualit:org_yardimci'


def bp():
    return {'format_version': '1.21.0', 'minecraft:entity': {
        'description': {'identifier': ID, 'is_spawnable': False, 'is_summonable': True},
        'components': {
            'minecraft:type_family': {'family': ['aqualit_yardimci', 'inanimate']},
            'minecraft:collision_box': {'width': 0.9, 'height': 0.7},
            'minecraft:health': {'value': 20, 'max': 20},
            'minecraft:damage_sensor': {'triggers': [{'cause': 'all', 'deals_damage': 'no'}]},
            'minecraft:physics': {'has_gravity': False, 'has_collision': False},
            'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
            'minecraft:knockback_resistance': {'value': 1.0},
            'minecraft:fire_immune': {},
            'minecraft:loot': {'table': 'loot_tables/empty.json'},
        }}}


def rp():
    return {'format_version': '1.10.0', 'minecraft:client_entity': {'description': {
        'identifier': ID,
        'materials': {'default': 'entity_alphablend', 'glow': 'copper_golem_eyes'},
        'textures': {'default': 'textures/entity/aqualit_yardimci/yardimci', 'glow': 'textures/entity/aqualit_yardimci/yardimci_glow'},
        'geometry': {'default': 'geometry.aqualit.org_yardimci'},
        'animations': {'uc': 'animation.aqualit.org_yardimci.uc'},
        'scripts': {'animate': ['uc'], 'scale': '0.85'},
        'render_controllers': ['controller.render.aqualit.org_yardimci', 'controller.render.aqualit.org_yardimci_glow'],
    }}}


def build(RP, BP, wj):
    import yardimci as Y
    import evcil_oyun as EO
    geo, tex, glow = K.build(forms=[Y.yardimci(True)], W=256, ident='geometry.aqualit.org_yardimci')
    EO._cam_saydam(tex)
    d = f'{RP}/textures/entity/aqualit_yardimci'
    os.makedirs(d, exist_ok=True)
    tex.save(f'{d}/yardimci.png')
    glow.save(f'{d}/yardimci_glow.png')
    wj(f'{RP}/models/entity/aqualit_org_yardimci.geo.json', geo)
    per = {f'per_{a}': {'rotation': [0, f"{'' if a in ('fl', 'br') else '-'}q.life_time * 900", 0]} for a in ('fl', 'fr', 'bl', 'br')}
    per['govde'] = {'position': [0, 'math.sin(q.life_time * 120) * 0.8', 0], 'rotation': ['math.sin(q.life_time * 120) * 3', 0, 0]}
    wj(f'{RP}/animations/aqualit_org_yardimci.animation.json', {'format_version': '1.8.0', 'animations': {
        'animation.aqualit.org_yardimci.uc': {'loop': True, 'bones': per}}})
    wj(f'{BP}/entities/org_yardimci.json', bp())
    wj(f'{RP}/entity/aqualit_org_yardimci.entity.json', rp())
    wj(f'{RP}/render_controllers/aqualit_org_yardimci.render_controllers.json', {'format_version': '1.10.0', 'render_controllers': {
        'controller.render.aqualit.org_yardimci': {'geometry': 'Geometry.default', 'materials': [{'*': 'Material.default'}],
                                                   'textures': ['Texture.default']},
        'controller.render.aqualit.org_yardimci_glow': {'geometry': 'Geometry.default', 'materials': [{'*': 'Material.glow'}],
                                                        'textures': ['Texture.glow'], 'ignore_lighting': True}}})
