"""Organizatör üssü (v0.4.0): Aqualit Fırın, Aqualit Kablo, Uzaktan Aktarım Bloğu (bloklar) ve Organizatör Platformu
(9x9 blok tek parça mod yapısı, dokunmatik panelli varlık). Tasarımlar: tasarim/org_ussu.py.

Fırın elektriklidir: bir Aqualit Bloğu'na doğrudan ya da Aqualit Kablolarıyla bağlıysa çok hızlı eritir; yalnız
Organizatör kullanır. Uzaktan Aktarım Bloğu'nun yanındaki sandıklara Organizatör eşyayı ışınlar (Yardımcı uçmaz)."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.normpath(os.path.join(HERE, '..', '..'))
for p in (HERE, ART, os.path.join(ART, 'tasarim'), os.path.join(ART, 'addon', 'test')):
    if p not in sys.path:
        sys.path.insert(0, p)
import kesif as K  # noqa: E402

YONLER = ['n', 's', 'w', 'e', 'u', 'd']
PLATFORM = 'aqualit:org_platform'


def kablo_formu():
    """Tasarımdaki kablo; her kol ayrı kemikte (komşuya göre görünür)."""
    import org_ussu as OU
    from ortak import Form
    f = Form('kablo', 'Aqualit Kablo')
    f.bone('root', None, (0, 0, 0))
    tam = OU.kablo(YONLER)
    # kolları kendi kemiklerine taşı
    for y in YONLER:
        f.bone('kol_' + y, 'root', (0, 8, 0))
    for p in tam.parts:
        ad = p.box.name
        p.bone = ad if ad.startswith('kol_') else 'root'
        f.parts.append(p)
    return f


def _blok(wj, BP, bid, geo_id, tex, ad_anahtar, comps_ek=None, states=None, perms=None, traits=None, kutu=None):
    comps = {
        'minecraft:display_name': f'tile.aqualit.{bid}.name',
        'minecraft:geometry': geo_id if isinstance(geo_id, dict) else {'identifier': geo_id},
        'minecraft:material_instances': {'*': {'texture': tex, 'render_method': 'alpha_test'}},
        'minecraft:destructible_by_mining': {'seconds_to_destroy': 1.5},
        'minecraft:destructible_by_explosion': {'explosion_resistance': 6},
        'minecraft:tags': ['minecraft:is_pickaxe_item_destructible', 'metal', 'aqualit:us'],
        'minecraft:map_color': '#2e5a52',
        'minecraft:light_dampening': 0,
    }
    if kutu:
        comps['minecraft:collision_box'] = kutu
        comps['minecraft:selection_box'] = kutu
    comps.update(comps_ek or {})
    desc = {'identifier': f'aqualit:{bid}', 'menu_category': {'category': 'items'}}
    if states:
        desc['states'] = states
    if traits:
        desc['traits'] = traits
    doc = {'format_version': '1.26.20', 'minecraft:block': {'description': desc, 'components': comps}}
    if perms:
        doc['minecraft:block']['permutations'] = perms
    wj(f'{BP}/blocks/{bid}.json', doc)


def platform_bp():
    return {'format_version': '1.21.0', 'minecraft:entity': {
        'description': {'identifier': PLATFORM, 'is_spawnable': False, 'is_summonable': True},
        'components': {
            'minecraft:type_family': {'family': ['aqualit_platform', 'inanimate']},
            'minecraft:collision_box': {'width': 1.2, 'height': 1.3},
            'minecraft:health': {'value': 100, 'max': 100},
            'minecraft:damage_sensor': {'triggers': [{'cause': 'all', 'deals_damage': 'no'}]},
            'minecraft:physics': {'has_gravity': False, 'has_collision': False},
            'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
            'minecraft:knockback_resistance': {'value': 1.0},
            'minecraft:fire_immune': {},
            'minecraft:persistent': {},
            'minecraft:loot': {'table': 'loot_tables/empty.json'},
        }}}


def platform_rp():
    return {'format_version': '1.10.0', 'minecraft:client_entity': {'description': {
        'identifier': PLATFORM,
        'materials': {'default': 'entity_alphatest', 'glow': 'copper_golem_eyes'},
        'textures': {'default': 'textures/entity/aqualit_platform/platform', 'glow': 'textures/entity/aqualit_platform/platform_glow'},
        'geometry': {'default': 'geometry.aqualit.org_platform'},
        'render_controllers': ['controller.render.aqualit.org_platform', 'controller.render.aqualit.org_platform_glow'],
    }}}


def build(RP, BP, wj, td, sounds, GEN):
    import org_ussu as OU
    from PIL import Image
    os.makedirs(f'{RP}/models/blocks', exist_ok=True)
    os.makedirs(f'{RP}/textures/blocks', exist_ok=True)
    # ---- Aqualit Fırın (kapalı / yanık), yönlü
    for ad, yanik in (('aqualit_firin', False), ('aqualit_firin_yanik', True)):
        geo, tex, glow = K.build(forms=[OU.firin(yanik)], W=128, ident=f'geometry.aqualit.{ad}')
        if yanik:                                     # ateş yanınca parlasın (blokta parlama dokusu yok: rengi aç)
            tex = Image.alpha_composite(tex, glow)
        tex.save(f'{RP}/textures/blocks/{ad}.png')
        td[ad] = {'textures': f'textures/blocks/{ad}'}
        wj(f'{RP}/models/blocks/{ad}.geo.json', geo)
    D = "q.block_state('minecraft:cardinal_direction')"
    perms = [{'condition': "q.block_state('aqualit:yanik') == 'evet'", 'components': {
        'minecraft:geometry': {'identifier': 'geometry.aqualit.aqualit_firin_yanik'},
        'minecraft:material_instances': {'*': {'texture': 'aqualit_firin_yanik', 'render_method': 'alpha_test'}},
        'minecraft:light_emission': 13}}]
    for d, r in [('north', 0), ('west', 90), ('south', 180), ('east', -90)]:
        perms.append({'condition': f"{D} == '{d}'", 'components': {'minecraft:transformation': {'rotation': [0, r, 0]}}})
    _blok(wj, BP, 'aqualit_firin', 'geometry.aqualit.aqualit_firin', 'aqualit_firin', 'firin',
          comps_ek={}, states={'aqualit:yanik': ['hayir', 'evet']}, perms=perms,
          traits={'minecraft:placement_direction': {'enabled_states': ['minecraft:cardinal_direction'], 'y_rotation_offset': 180}})
    # ---- Aqualit Kablo: komşulara göre kollar görünür
    geo, tex, glow = K.build(forms=[kablo_formu()], W=64, ident='geometry.aqualit.aqualit_kablo')
    tex = Image.alpha_composite(tex, glow)
    tex.save(f'{RP}/textures/blocks/aqualit_kablo.png')
    td['aqualit_kablo'] = {'textures': 'textures/blocks/aqualit_kablo'}
    wj(f'{RP}/models/blocks/aqualit_kablo.geo.json', geo)
    vis = {f'kol_{y}': f"q.block_state('aqualit:{y}') == 'var'" for y in YONLER}
    _blok(wj, BP, 'aqualit_kablo', {'identifier': 'geometry.aqualit.aqualit_kablo', 'bone_visibility': vis}, 'aqualit_kablo',
          'kablo', comps_ek={'minecraft:light_emission': 4},
          states={f'aqualit:{y}': ['yok', 'var'] for y in YONLER},
          kutu={'origin': [-3, 5, -3], 'size': [6, 6, 6]})
    # ---- Uzaktan Aktarım Bloğu
    geo, tex, glow = K.build(forms=[OU.aktarim(0.0)], W=128, ident='geometry.aqualit.aqualit_aktarim')
    tex = Image.alpha_composite(tex, glow)
    tex.save(f'{RP}/textures/blocks/aqualit_aktarim.png')
    td['aqualit_aktarim'] = {'textures': 'textures/blocks/aqualit_aktarim'}
    wj(f'{RP}/models/blocks/aqualit_aktarim.geo.json', geo)
    _blok(wj, BP, 'aqualit_aktarim', 'geometry.aqualit.aqualit_aktarim', 'aqualit_aktarim', 'aktarim',
          comps_ek={'minecraft:light_emission': 7})
    for b in ('aqualit_firin', 'aqualit_kablo', 'aqualit_aktarim'):
        sounds[f'aqualit:{b}'] = {'sound': 'metal'}


def platform_build(RP, BP, wj, GEN):
    """Organizatör Platformu (varlık, 9x9) ve eşya simgesi (eşyalardan önce çağrılır)."""
    import org_ussu as OU
    from PIL import Image
    geo, tex, glow = K.build(forms=[OU.platform()], W=1024, ident='geometry.aqualit.org_platform')
    d = f'{RP}/textures/entity/aqualit_platform'
    os.makedirs(d, exist_ok=True)
    tex.save(f'{d}/platform.png')
    glow.save(f'{d}/platform_glow.png')
    geo['minecraft:geometry'][0]['description'].update({'visible_bounds_width': 10, 'visible_bounds_height': 3})
    wj(f'{RP}/models/entity/aqualit_org_platform.geo.json', geo)
    wj(f'{BP}/entities/org_platform.json', platform_bp())
    wj(f'{RP}/entity/aqualit_org_platform.entity.json', platform_rp())
    wj(f'{RP}/render_controllers/aqualit_org_platform.render_controllers.json', {'format_version': '1.10.0', 'render_controllers': {
        'controller.render.aqualit.org_platform': {'geometry': 'Geometry.default', 'materials': [{'*': 'Material.default'}],
                                                   'textures': ['Texture.default']},
        'controller.render.aqualit.org_platform_glow': {'geometry': 'Geometry.default', 'materials': [{'*': 'Material.glow'}],
                                                        'textures': ['Texture.glow'], 'ignore_lighting': True}}})
    # platform eşyasının simgesi
    import render_z as Z
    cam = Z.Cam(yaw=30, elev=35, scale=0.42, size=(96, 96), center=(0, 6, 0))
    im = Z.render(geo, tex, {}, (), cam, glow=glow, ground=None, bg=(255, 0, 255), shadow=False).convert('RGBA')
    px = im.load()
    for x in range(im.width):
        for y in range(im.height):
            r, g, b, a = px[x, y]
            if r > 200 and b > 200 and g < 60:
                px[x, y] = (0, 0, 0, 0)
    bb = im.getbbox()
    im = im.crop(bb) if bb else im
    s = 30 / max(im.size)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))))
    out = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    out.alpha_composite(im, ((32 - im.width) // 2, (32 - im.height) // 2))
    out.save(os.path.join(GEN, 'org_platform.png'))
