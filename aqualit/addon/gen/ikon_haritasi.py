"""Eşya kimliği -> menü simgesi (doku yolu) haritası.

Bedrock'ta betik bir eşyanın resmini bilemez; menülerde göstermek için doku yolunu biz eşleriz.
Kaynak: bedrock-samples resource_pack/textures/item_texture.json, terrain_texture.json, blocks.json
ve vanilladata mojang-items.json. Adı tutmayanlar için elle düzeltme tablosu var.
Çıktı: src/scripts/ikon_data.js  (export const ICONS = {...})
"""
import json
import os
import re

REF = os.environ.get('AQUALIT_REF', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'ref'))
BSX = os.path.join(REF, 'vanilla_rp')
ITEMS = os.path.join(REF, 'vanilladata_modules', 'mojang-items.json')


def load_jsonc(path):
    s = open(path, encoding='utf-8').read()
    s = re.sub(r'^\s*//.*$', '', s, flags=re.M)
    s = re.sub(r',(\s*[}\]])', r'\1', s)
    return json.loads(s)


def first_path(v):
    """atlas girdisinden ilk doku yolunu çıkar."""
    if isinstance(v, str):
        return v
    if isinstance(v, list):
        return first_path(v[0]) if v else None
    if isinstance(v, dict):
        if 'textures' in v:
            return first_path(v['textures'])
        if 'path' in v:
            return v['path']
    return None


# elle düzeltmeler: eşya adı -> item_texture anahtarı (ya da doğrudan doku yolu)
ALIAS = {
    'wheat_seeds': 'seeds_wheat', 'beetroot_seeds': 'seeds_beetroot', 'melon_seeds': 'seeds_melon',
    'pumpkin_seeds': 'seeds_pumpkin', 'baked_potato': 'potato_baked', 'poisonous_potato': 'potato_poisonous',
    'sugar_cane': 'reeds', 'redstone': 'redstone_dust', 'beef': 'beef_raw', 'cooked_beef': 'beef_cooked',
    'porkchop': 'porkchop_raw', 'cooked_porkchop': 'porkchop_cooked', 'chicken': 'chicken_raw',
    'cooked_chicken': 'chicken_cooked', 'mutton': 'mutton_raw', 'cooked_mutton': 'mutton_cooked',
    'rabbit': 'rabbit_raw', 'cooked_rabbit': 'rabbit_cooked', 'cod': 'fish_raw', 'cooked_cod': 'fish_cooked',
    'salmon': 'fish_salmon_raw', 'cooked_salmon': 'fish_salmon_cooked', 'tropical_fish': 'fish_clownfish_raw',
    'pufferfish': 'fish_pufferfish_raw', 'glowstone_dust': 'glowstone_dust', 'melon_slice': 'melon',
    'bone_meal': 'textures/items/dye_powder_white_new', 'ink_sac': 'textures/items/dye_powder_black',
    'lapis_lazuli': 'textures/items/dye_powder_blue', 'cocoa_beans': 'textures/items/dye_powder_brown',
    'clay_ball': 'clay_ball', 'nether_wart': 'nether_wart', 'gunpowder': 'gunpowder',
    'experience_bottle': 'experience_bottle', 'golden_apple': 'apple_golden', 'enchanted_golden_apple': 'apple_golden',
    'glistering_melon_slice': 'melon_speckled', 'golden_carrot': 'carrot_golden', 'spider_eye': 'spider_eye',
    'fermented_spider_eye': 'spider_eye_fermented', 'map': 'map_empty', 'filled_map': 'map_filled',
    'wooden_sword': 'wood_sword', 'wooden_pickaxe': 'wood_pickaxe', 'wooden_axe': 'wood_axe',
    'wooden_shovel': 'wood_shovel', 'wooden_hoe': 'wood_hoe', 'golden_sword': 'gold_sword',
    'golden_pickaxe': 'gold_pickaxe', 'golden_axe': 'gold_axe', 'golden_shovel': 'gold_shovel', 'golden_hoe': 'gold_hoe',
    'bucket': 'bucket', 'water_bucket': 'bucket_water', 'lava_bucket': 'bucket_lava', 'milk_bucket': 'bucket_milk',
    'snowball': 'snowball', 'book': 'book_normal', 'writable_book': 'book_writable', 'enchanted_book': 'book_enchanted',
    'trial_key': 'trial_key', 'ominous_trial_key': 'ominous_trial_key', 'apple': 'apple',
}

# bloklar için blocks.json'da bulunmayan/yanlış görünenler -> terrain anahtarı ya da yol
BLOCK_ALIAS = {
    'grass_block': 'textures/blocks/grass_side_carried', 'oak_log': 'textures/blocks/log_oak',
    'spruce_log': 'textures/blocks/log_spruce', 'birch_log': 'textures/blocks/log_birch',
    'jungle_log': 'textures/blocks/log_jungle', 'acacia_log': 'textures/blocks/log_acacia',
    'dark_oak_log': 'textures/blocks/log_big_oak', 'oak_planks': 'textures/blocks/planks_oak',
    'oak_leaves': 'textures/blocks/leaves_oak_carried', 'glass': 'textures/blocks/glass',
    'cobblestone': 'textures/blocks/cobblestone', 'stone': 'textures/blocks/stone', 'dirt': 'textures/blocks/dirt',
    'sand': 'textures/blocks/sand', 'gravel': 'textures/blocks/gravel', 'clay': 'textures/blocks/clay',
    'oak_sapling': 'textures/blocks/sapling_oak', 'spruce_sapling': 'textures/blocks/sapling_spruce',
    'birch_sapling': 'textures/blocks/sapling_birch', 'jungle_sapling': 'textures/blocks/sapling_jungle',
    'acacia_sapling': 'textures/blocks/sapling_acacia', 'dark_oak_sapling': 'textures/blocks/sapling_roofed_oak',
}

# Aqualit eşyaları: kendi dokularımız (RP textures/items/<ad>.png)
AQUALIT = ['aqualit_ingot', 'raw_aqualit', 'aqualit_sword', 'aqualit_pickaxe', 'aqualit_axe', 'aqualit_shovel',
           'aqualit_hoe', 'aqualit_chest', 'tamir_kiti', 'task_remote', 'robot_radio', 'robot_tracker',
           'command_rod', 'tuning_gear', 'zone_selector']


def build():
    it = load_jsonc(os.path.join(BSX, 'textures', 'item_texture.json'))['texture_data']
    tt = load_jsonc(os.path.join(BSX, 'textures', 'terrain_texture.json'))['texture_data']
    bj = load_jsonc(os.path.join(BSX, 'blocks.json'))
    items = json.load(open(ITEMS))['data_items']
    out = {}
    miss = []
    for row in items:
        iid = row['name']
        if not iid.startswith('minecraft:'):
            continue
        n = iid.split(':', 1)[1]
        path = None
        a = ALIAS.get(n) or BLOCK_ALIAS.get(n)
        if a:
            path = a if a.startswith('textures/') else first_path(it.get(a, {}))
        if not path and n in it:
            path = first_path(it[n])
        if not path and n in bj:
            tex = bj[n].get('textures')
            key = tex if isinstance(tex, str) else (tex.get('side') or tex.get('north') or tex.get('up')) if isinstance(tex, dict) else None
            if key and key in tt:
                path = first_path(tt[key])
        if not path and n in tt:
            path = first_path(tt[n])
        if not path and a and not a.startswith('textures/'):
            path = f'textures/items/{a}'
        if not path and re.match(r'^(wooden|stone|iron|golden|diamond|netherite|copper)_(sword|pickaxe|axe|shovel|hoe)$', n):
            path = f'textures/items/{n}'
        if not path and re.match(r'^(leather|chainmail|iron|golden|diamond|netherite|copper)_(helmet|chestplate|leggings|boots)$', n):
            path = f'textures/items/{n}'
        if not path:
            path = {'bow': 'textures/items/bow_standby', 'crossbow': 'textures/items/crossbow_standby',
                    'compass': 'textures/items/compass_item', 'clock': 'textures/items/clock_item'}.get(n)
        if path:
            out[iid] = path
        else:
            miss.append(iid)
    for n in AQUALIT:
        out[f'aqualit:{n}'] = f'textures/items/{n}'
    return out, miss


def write_js(path):
    icons, miss = build()
    with open(path, 'w', encoding='utf-8') as f:
        f.write('// Otomatik üretildi (gen/ikon_haritasi.py): eşya kimliği -> menü simgesi\n')
        f.write('export const ICONS = ' + json.dumps(icons, ensure_ascii=False, separators=(',', ':')) + ';\n')
    return len(icons), miss


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    n, miss = write_js(os.path.join(here, '..', 'src', 'scripts', 'ikon_data.js'))
    print('simge:', n, 'eksik:', len(miss))
    print(' '.join(m.split(':')[1] for m in miss[:80]))
