"""X-ray (v0.4.1): taş türlerinin "hayalet" kopyaları.

X-ray eşyasıyla "yarı saydam" ya da "tam saydam" seçilince yüklü yığınlardaki taş, derin kayrak, toprak, Nether taşı,
End taşı vb. bu bloklarla değiştirilir (xray.js); "kapalı" seçilince asıllarına döner. Cevherlere dokunulmaz, onlar tam
görünür. Hayalet bloklar asıl bloğun eşyasını düşürür ve aynı aletle aynı hızda kazılır. Işığı geçirir: cevherler
karanlıkta kalmaz. Yan yana aynı hayalet bloklar arasındaki yüzler çizilmez (telefon yorulmasın).
"""
import json
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
VAN = os.path.normpath(os.path.join(HERE, '..', '..', 'vanilla', 'xray'))

# anahtar, asıl blok, doku, düşen eşya, kazma süresi (sn, elle), alet etiketi
TASLAR = [
    ('stone', 'minecraft:stone', 'stone', 'minecraft:cobblestone', 1.5, 'minecraft:is_pickaxe'),
    ('deepslate', 'minecraft:deepslate', 'deepslate', 'minecraft:cobbled_deepslate', 3.0, 'minecraft:is_pickaxe'),
    ('granite', 'minecraft:granite', 'stone_granite', 'minecraft:granite', 1.5, 'minecraft:is_pickaxe'),
    ('diorite', 'minecraft:diorite', 'stone_diorite', 'minecraft:diorite', 1.5, 'minecraft:is_pickaxe'),
    ('andesite', 'minecraft:andesite', 'stone_andesite', 'minecraft:andesite', 1.5, 'minecraft:is_pickaxe'),
    ('tuff', 'minecraft:tuff', 'tuff', 'minecraft:tuff', 1.5, 'minecraft:is_pickaxe'),
    ('calcite', 'minecraft:calcite', 'calcite', 'minecraft:calcite', 0.75, 'minecraft:is_pickaxe'),
    ('dirt', 'minecraft:dirt', 'dirt', 'minecraft:dirt', 0.5, 'minecraft:is_shovel'),
    ('netherrack', 'minecraft:netherrack', 'netherrack', 'minecraft:netherrack', 0.4, 'minecraft:is_pickaxe'),
    ('blackstone', 'minecraft:blackstone', 'blackstone', 'minecraft:blackstone', 1.5, 'minecraft:is_pickaxe'),
    ('basalt', 'minecraft:basalt', 'basalt_side', 'minecraft:basalt', 1.25, 'minecraft:is_pickaxe'),
    ('end_stone', 'minecraft:end_stone', 'end_stone', 'minecraft:end_stone', 3.0, 'minecraft:is_pickaxe'),
]
KIPLER = {'y': ('Yarı saydam', 105), 't': ('Tam saydam', 0)}
GEO = 'geometry.aqualit.xray_kup'
CULL = 'aqualit:xray_kup'


def hayalet_id(k, kip):
    return f'aqualit:xr_{k}_{kip}'


def geo():
    return {'format_version': '1.21.0', 'minecraft:geometry': [{
        'description': {'identifier': GEO, 'texture_width': 16, 'texture_height': 16},
        'bones': [{'name': 'kup', 'pivot': [0, 0, 0], 'cubes': [{'origin': [-8, 0, -8], 'size': [16, 16, 16], 'uv': {
            f: {'uv': [0, 0], 'uv_size': [16, 16]} for f in ('north', 'south', 'east', 'west', 'up', 'down')}}]}]}]}


def culling():
    kural = []
    for f in ('north', 'south', 'east', 'west', 'up', 'down'):
        kural.append({'geometry_part': {'bone': 'kup', 'cube': 0, 'face': f}, 'direction': f, 'condition': 'same_block'})
    return {'format_version': '1.21.80', 'minecraft:block_culling_rules': {'description': {'identifier': CULL}, 'rules': kural}}


def build(RP, BP, wj, td, sounds, lang):
    os.makedirs(f'{RP}/textures/blocks/xray', exist_ok=True)
    os.makedirs(f'{RP}/models/blocks', exist_ok=True)
    os.makedirs(f'{BP}/loot_tables/xray', exist_ok=True)
    wj(f'{RP}/models/blocks/aqualit_xray_kup.geo.json', geo())
    wj(f'{RP}/block_culling/aqualit_xray_kup.json', culling())
    for k, asil, doku, dusen, sure, alet in TASLAR:
        src = Image.open(os.path.join(VAN, doku + '.png')).convert('RGBA').crop((0, 0, 16, 16))
        wj(f'{BP}/loot_tables/xray/{k}.json', {'pools': [{'rolls': 1, 'entries': [{'type': 'item', 'name': dusen, 'weight': 1}]}]})
        for kip, (ad, alfa) in KIPLER.items():
            t = src.copy()
            t.putalpha(alfa)
            tn = f'xr_{k}_{kip}'
            t.save(f'{RP}/textures/blocks/xray/{tn}.png')
            td[tn] = {'textures': f'textures/blocks/xray/{tn}'}
            bid = hayalet_id(k, kip)
            wj(f'{BP}/blocks/xr_{k}_{kip}.json', {'format_version': '1.26.20', 'minecraft:block': {
                'description': {'identifier': bid, 'menu_category': {'category': 'none', 'is_hidden_in_commands': True}},
                'components': {
                    'minecraft:display_name': f'tile.{bid}.name',
                    'minecraft:geometry': {'identifier': GEO, 'culling': CULL},
                    'minecraft:material_instances': {'*': {'texture': tn, 'render_method': 'blend' if alfa else 'alpha_test'}},
                    'minecraft:destructible_by_mining': {'seconds_to_destroy': sure * 5, 'item_specific_speeds': [
                        {'item': {'tags': f"q.any_tag('{alet}')"}, 'destroy_speed': sure}]},
                    'minecraft:destructible_by_explosion': {'explosion_resistance': 6},
                    'minecraft:loot': f'loot_tables/xray/{k}.json',
                    'minecraft:light_dampening': 0,
                    'minecraft:map_color': '#7f7f7f',
                    'minecraft:tags': ['stone', 'aqualit:xray'] + (['dirt'] if k == 'dirt' else []),
                }}})
            sounds[bid] = {'sound': 'gravel' if k == 'dirt' else 'stone'}
            lang[f'tile.{bid}.name'] = f'{asil.split(":")[1].replace("_", " ").title()} (x-ray)'
    return TASLAR


def simge(GEN):
    """X-ray eşyası simgesi: matkap ucu önünde mavi mercek, içinde parlayan elmas cevheri."""
    from PIL import ImageDraw
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((4, 4, 27, 27), fill=(20, 40, 70, 255), outline=(10, 14, 20, 255), width=2)
    d.ellipse((7, 7, 24, 24), fill=(90, 170, 230, 150))
    d.rectangle((12, 12, 19, 19), fill=(60, 60, 60, 120))
    for x, y in ((13, 13), (17, 14), (14, 17), (18, 18)):
        d.rectangle((x, y, x + 1, y + 1), fill=(90, 240, 230, 255))
    d.line((9, 10, 13, 8), fill=(220, 245, 255, 255), width=2)
    d.polygon([(22, 24), (29, 31), (31, 29), (24, 22)], fill=(64, 200, 190, 255), outline=(10, 14, 20, 255))
    im.save(os.path.join(GEN, 'kesif_xray.png'))


def modul_simgeleri(GEN):
    """Kılıçlı yükseltme modülü simgeleri: devre kartı, ortada seviye renginde çip."""
    from PIL import ImageDraw
    renk = {2: (60, 220, 90), 3: (170, 80, 255), 4: (255, 210, 50), 5: (60, 150, 255)}
    for n, c in renk.items():
        im = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((3, 6, 28, 26), radius=3, fill=(30, 60, 55, 255), outline=(10, 14, 20, 255), width=2)
        for x in (7, 12, 17, 22):
            d.line((x, 4, x, 7), fill=(200, 200, 200, 255), width=1); d.line((x, 25, x, 28), fill=(200, 200, 200, 255), width=1)
        d.rectangle((10, 11, 21, 21), fill=c + (255,), outline=(255, 255, 255, 255))
        for i in range(n - 1):
            d.rectangle((12 + i * 3, 14, 13 + i * 3, 18), fill=(255, 255, 255, 255))
        d.line((5, 9, 10, 9), fill=(80, 230, 210, 255)); d.line((21, 23, 26, 23), fill=(80, 230, 210, 255))
        im.save(os.path.join(GEN, f'kilicli_modul_{n}.png'))


def kostum_simgeleri(GEN):
    from PIL import ImageDraw
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.polygon([(16, 2), (24, 16), (18, 16), (22, 30), (8, 14), (14, 14), (10, 2)], fill=(255, 220, 60, 255), outline=(40, 30, 10, 255))
    im.save(os.path.join(GEN, 'kostum_guc.png'))
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((6, 4, 26, 28), radius=3, fill=(60, 70, 80, 255), outline=(20, 20, 20, 255), width=2)
    d.polygon([(4, 16), (14, 9), (14, 13), (22, 13), (22, 19), (14, 19), (14, 23)], fill=(230, 60, 60, 255))
    im.save(os.path.join(GEN, 'kostum_cik.png'))
