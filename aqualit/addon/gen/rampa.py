"""Rampa (v0.5.0): sarı-siyah ok desenli, çok bloklu rampa.

Rampa eşyası yere konunca baktığın yöne doğru (varsayılan) 2 blok genişliğinde, 10 blok uzunluğunda, 6 blok yükselen bir
rampa kurulur (rampa.js). Rampa Ayarlayıcı basılı tutulunca kalınlık (genişlik), uzunluk ve yükseklik seçilir; bir rampaya
dokununca o rampayı kaldırır. Eğim blok başına e/8 (e = 1..8): her eğim ayrı blok (aqualit:rampa_e<e>), blokta
aqualit:kayma (k0..k14: eğimin bloğa göre başlangıç yüksekliği, piksel) ve yön (minecraft:cardinal_direction).
Yüzey 2 piksellik basamaklarla yumuşak; geometri kuzeye (-z) doğru yükselir, yön dönüşümüyle çevrilir.
Rampa yarım blok kalınlığında eğik bir plakadır: altı dolu değildir, altı da eğiktir (yandan eğik duvar gibi);
plakanın alttaki bloğa taşan kısmı aynı bloğun 'alt' parçasıdır (aqualit:parca)."""
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


KALINLIK = 8          # rampa plakasının kalınlığı (piksel): altı da eğik, yandan eğik bir duvar gibi görünür
PARCA = ['ust', 'alt']


def doku():
    """32x16: sol yarı üst yüz (ok deseni), sağ yarı yan yüzler (uyarı şeridi)."""
    im = Image.new('RGBA', (32, 16), (0, 0, 0, 0))
    im.paste(desen(), (0, 0))
    im.paste(govde_dokusu(), (16, 0))
    return im


def _dilimler(e, k, parca):
    """Eğim e, kayma k için 8 dilim: (z0, y0, y1) blok içinde. ust: yüzeyin bulunduğu blok; alt: plakanın alttaki bloğa
    taşan kısmı."""
    out = []
    for j in range(8):
        top = k + 2 * e * (j + 0.5) / 8
        bot = top - KALINLIK
        if parca == 'ust':
            y0, y1 = max(0, bot), min(30, top)
        else:
            y0, y1 = 16 + bot, 16
            if bot >= 0:
                continue
        y0, y1 = round(y0), round(y1)
        if y1 - y0 < 1:
            if parca == 'alt':
                continue
            y1 = y0 + 1
        out.append((8 - 2 * (j + 1), y0, y1, j))
    return out


def geometri(e):
    """Eğim e/8: her kayma ve parça (üst/alt) için bir kemik; kemikte 2 piksel derin dilimler (yumuşak eğik plaka)."""
    bones = [{'name': 'root', 'pivot': [0, 0, 0]}]
    for parca in PARCA:
        for k in range(0, 16, 2):
            cubes = []
            for z0, y0, y1, j in _dilimler(e, k, parca):
                h = y1 - y0
                hs = min(16, h)
                uv = {'up': {'uv': [0, 14 - 2 * j], 'uv_size': [16, 2]},
                      'down': {'uv': [16, 14 - 2 * j], 'uv_size': [16, 2]},
                      'north': {'uv': [16, 16 - hs], 'uv_size': [16, hs]},
                      'south': {'uv': [16, 16 - hs], 'uv_size': [16, hs]},
                      'east': {'uv': [16 + 14 - 2 * j, 16 - hs], 'uv_size': [2, hs]},
                      'west': {'uv': [16 + 14 - 2 * j, 16 - hs], 'uv_size': [2, hs]}}
                cubes.append({'origin': [-8, y0, z0], 'size': [16, h, 2], 'uv': uv})
            bones.append({'name': f'{parca}_k{k}', 'parent': 'root', 'pivot': [0, 0, 0], 'cubes': cubes})
    return {'format_version': '1.12.0', 'minecraft:geometry': [{
        'description': {'identifier': f'geometry.aqualit.rampa_e{e}', 'texture_width': 32, 'texture_height': 16,
                        'visible_bounds_width': 2, 'visible_bounds_height': 3, 'visible_bounds_offset': [0, 1, 0]},
        'bones': bones}]}


def _yon_perms():
    D = "q.block_state('minecraft:cardinal_direction')"
    return [{'condition': f"{D} == '{d}'", 'components': {'minecraft:transformation': {'rotation': [0, r, 0]}}} for d, r in YON_DONUS]


def build(RP, BP, wj, td, sounds, lang):
    os.makedirs(f'{RP}/textures/blocks', exist_ok=True)
    os.makedirs(f'{RP}/models/blocks', exist_ok=True)
    doku().save(f'{RP}/textures/blocks/aqualit_rampa.png')
    td['aqualit_rampa'] = {'textures': 'textures/blocks/aqualit_rampa'}
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
        vis = {f'{pa}_k{k}': f"q.block_state('aqualit:parca') == '{pa}' && q.block_state('aqualit:kayma') == 'k{k}'"
               for pa in PARCA for k in range(0, 16, 2)}
        perms = _yon_perms()
        for k in range(0, 16, 2):
            ust = max(1, min(16, round(k + e)))           # çarpışma: eğimin ortası (araçlar basamak çıkar)
            alt = max(0, min(15, round(k + e - KALINLIK)))
            perms.append({'condition': f"q.block_state('aqualit:parca') == 'ust' && q.block_state('aqualit:kayma') == 'k{k}'",
                          'components': {'minecraft:collision_box': {'origin': [-8, alt, -8], 'size': [16, max(1, ust - alt), 16]}}})
        perms.append({'condition': "q.block_state('aqualit:parca') == 'alt'", 'components': {'minecraft:collision_box': False}})
        comps = dict(ortak)
        comps.update({
            'minecraft:display_name': f'tile.aqualit:{bid}.name',
            'minecraft:geometry': {'identifier': f'geometry.aqualit.rampa_e{e}', 'bone_visibility': vis},
            'minecraft:material_instances': {'*': {'texture': 'aqualit_rampa', 'render_method': 'alpha_test'}},
            'minecraft:selection_box': {'origin': [-8, 0, -8], 'size': [16, 16, 16]},
        })
        wj(f'{BP}/blocks/{bid}.json', {'format_version': '1.26.20', 'minecraft:block': {
            'description': {'identifier': f'aqualit:{bid}', 'menu_category': {'category': 'none', 'is_hidden_in_commands': True},
                            'states': {'aqualit:kayma': KAYMA, 'aqualit:parca': PARCA}, 'traits': traits},
            'components': comps, 'permutations': perms}})
        sounds[f'aqualit:{bid}'] = {'sound': 'metal'}
        lang[f'tile.aqualit:{bid}.name'] = 'Rampa'


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
