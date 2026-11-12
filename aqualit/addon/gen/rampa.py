"""Rampa (v0.5.0): sarı-siyah ok desenli, çok bloklu rampa.

Rampa eşyası yere konunca baktığın yöne doğru (varsayılan) 2 blok genişliğinde, 10 blok uzunluğunda, 6 blok yükselen bir
rampa kurulur (rampa.js). Rampa Ayarlayıcı basılı tutulunca kalınlık (genişlik), uzunluk ve yükseklik seçilir; bir rampaya
dokununca o rampayı kaldırır. Eğim blok başına e/8 (e = 1..8): her eğim ayrı blok (aqualit:rampa_e<e>), blokta
aqualit:kayma (k0..k14: eğimin bloğa göre başlangıç yüksekliği, piksel) ve yön (minecraft:cardinal_direction).
Yüzey 2 piksellik basamaklarla yumuşak; geometri kuzeye (-z) doğru yükselir, yön dönüşümüyle çevrilir.
Rampanın altı aqualit:rampa_govde (tam blok) ile doldurulur."""
import os

from PIL import Image, ImageDraw

SARI = (255, 205, 30, 255)
SIYAH = (28, 28, 30, 255)
KAYMA = [f'k{k}' for k in range(0, 16, 2)]
YON_DONUS = [('north', 0), ('west', 90), ('south', 180), ('east', -90)]


def desen():
    """16x16: sarı zemin üstünde siyah ok başları (yukarı = rampanın çıktığı yön), kenarda siyah şerit."""
    im = Image.new('RGBA', (16, 16), SARI)
    d = ImageDraw.Draw(im)
    for oy in (1, 9):
        d.line([(3, oy + 5), (8, oy), (12, oy + 5)], fill=SIYAH, width=2)
    for y in range(16):
        im.putpixel((0, y), SIYAH)
        im.putpixel((15, y), SIYAH)
    return im


def govde_dokusu():
    """Yan yüzler: sarı-siyah çapraz uyarı şeridi."""
    im = Image.new('RGBA', (16, 16), SARI)
    px = im.load()
    for y in range(16):
        for x in range(16):
            if ((x + y) // 4) % 2:
                px[x, y] = SIYAH
    return im


def geometri(e):
    """Eğim e/8: her kayma için bir kemik, kemikte 8 dilim (2 piksel derin) — yüzey 2 piksellik basamaklarla yükselir."""
    bones = [{'name': 'root', 'pivot': [0, 0, 0]}]
    for k in range(0, 16, 2):
        cubes = []
        for j in range(8):
            h = max(1, min(30, round(k + 2 * e * (j + 0.5) / 8)))
            z0 = 8 - 2 * (j + 1)            # kuzeye (-z) doğru ilerler
            uv = {'up': {'uv': [0, 14 - 2 * j], 'uv_size': [16, 2]},
                  'down': {'uv': [0, 14 - 2 * j], 'uv_size': [16, 2]},
                  'north': {'uv': [0, 16 - min(16, h)], 'uv_size': [16, min(16, h)]},
                  'south': {'uv': [0, 16 - min(16, h)], 'uv_size': [16, min(16, h)]},
                  'east': {'uv': [14 - 2 * j, 16 - min(16, h)], 'uv_size': [2, min(16, h)]},
                  'west': {'uv': [14 - 2 * j, 16 - min(16, h)], 'uv_size': [2, min(16, h)]}}
            cubes.append({'origin': [-8, 0, z0], 'size': [16, h, 2], 'uv': uv})
        bones.append({'name': f'k{k}', 'parent': 'root', 'pivot': [0, 0, 0], 'cubes': cubes})
    return {'format_version': '1.12.0', 'minecraft:geometry': [{
        'description': {'identifier': f'geometry.aqualit.rampa_e{e}', 'texture_width': 16, 'texture_height': 16,
                        'visible_bounds_width': 2, 'visible_bounds_height': 3, 'visible_bounds_offset': [0, 1, 0]},
        'bones': bones}]}


def _yon_perms():
    D = "q.block_state('minecraft:cardinal_direction')"
    return [{'condition': f"{D} == '{d}'", 'components': {'minecraft:transformation': {'rotation': [0, r, 0]}}} for d, r in YON_DONUS]


def build(RP, BP, wj, td, sounds, lang):
    os.makedirs(f'{RP}/textures/blocks', exist_ok=True)
    os.makedirs(f'{RP}/models/blocks', exist_ok=True)
    desen().save(f'{RP}/textures/blocks/aqualit_rampa.png')
    govde_dokusu().save(f'{RP}/textures/blocks/aqualit_rampa_yan.png')
    td['aqualit_rampa'] = {'textures': 'textures/blocks/aqualit_rampa'}
    td['aqualit_rampa_yan'] = {'textures': 'textures/blocks/aqualit_rampa_yan'}
    ortak = {
        'minecraft:destructible_by_mining': {'seconds_to_destroy': 1.0},
        'minecraft:destructible_by_explosion': {'explosion_resistance': 6},
        'minecraft:loot': 'loot_tables/empty.json',
        'minecraft:map_color': '#ffcd1e',
        'minecraft:light_dampening': 0,
        'minecraft:tags': ['aqualit:rampa', 'metal'],
    }
    traits = {'minecraft:placement_direction': {'enabled_states': ['minecraft:cardinal_direction'], 'y_rotation_offset': 180}}
    for e in range(1, 9):
        bid = f'rampa_e{e}'
        wj(f'{RP}/models/blocks/aqualit_{bid}.geo.json', geometri(e))
        vis = {f'k{k}': f"q.block_state('aqualit:kayma') == 'k{k}'" for k in range(0, 16, 2)}
        perms = _yon_perms()
        for k in range(0, 16, 2):
            boy = max(1, min(16, round(k + e)))           # çarpışma: eğimin ortası (araçlar basamak çıkar)
            perms.append({'condition': f"q.block_state('aqualit:kayma') == 'k{k}'", 'components': {
                'minecraft:collision_box': {'origin': [-8, 0, -8], 'size': [16, boy, 16]}}})
        comps = dict(ortak)
        comps.update({
            'minecraft:display_name': f'tile.aqualit:{bid}.name',
            'minecraft:geometry': {'identifier': f'geometry.aqualit.rampa_e{e}', 'bone_visibility': vis},
            'minecraft:material_instances': {'*': {'texture': 'aqualit_rampa', 'render_method': 'alpha_test'}},
            'minecraft:selection_box': {'origin': [-8, 0, -8], 'size': [16, 16, 16]},
        })
        wj(f'{BP}/blocks/{bid}.json', {'format_version': '1.26.20', 'minecraft:block': {
            'description': {'identifier': f'aqualit:{bid}', 'menu_category': {'category': 'none', 'is_hidden_in_commands': True},
                            'states': {'aqualit:kayma': KAYMA}, 'traits': traits},
            'components': comps, 'permutations': perms}})
        sounds[f'aqualit:{bid}'] = {'sound': 'metal'}
        lang[f'tile.aqualit:{bid}.name'] = 'Rampa'
    comps = dict(ortak)
    comps.update({
        'minecraft:display_name': 'tile.aqualit:rampa_govde.name',
        'minecraft:material_instances': {'*': {'texture': 'aqualit_rampa_yan', 'render_method': 'opaque'},
                                         'up': {'texture': 'aqualit_rampa', 'render_method': 'opaque'}},
    })
    wj(f'{BP}/blocks/rampa_govde.json', {'format_version': '1.26.20', 'minecraft:block': {
        'description': {'identifier': 'aqualit:rampa_govde', 'menu_category': {'category': 'none', 'is_hidden_in_commands': True},
                        'traits': traits},
        'components': comps, 'permutations': _yon_perms()}})
    sounds['aqualit:rampa_govde'] = {'sound': 'metal'}
    lang['tile.aqualit:rampa_govde.name'] = 'Rampa gövdesi'


def simgeler(GEN):
    """Eşya simgeleri: rampa (sarı-siyah kama) ve Rampa Ayarlayıcı (anahtar + ok)."""
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(2, 28), (30, 28), (30, 6)], fill=SARI, outline=SIYAH)
    for i in range(3):
        x = 14 + i * 5
        d.line([(x - 3, 25), (x, 22 - i * 3), (x + 3, 25)], fill=SIYAH, width=2)
    d.rectangle((2, 28, 30, 30), fill=SIYAH)
    im.save(os.path.join(GEN, 'rampa.png'))
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.line([(6, 26), (22, 10)], fill=(150, 160, 170, 255), width=4)
    d.ellipse((18, 3, 30, 15), outline=(150, 160, 170, 255), width=3)
    d.rectangle((23, 2, 27, 7), fill=(0, 0, 0, 0))
    d.polygon([(2, 20), (12, 20), (12, 30), (2, 30)], fill=SARI, outline=SIYAH)
    d.line([(4, 27), (7, 23), (10, 27)], fill=SIYAH, width=2)
    im.save(os.path.join(GEN, 'rampa_ayar.png'))
