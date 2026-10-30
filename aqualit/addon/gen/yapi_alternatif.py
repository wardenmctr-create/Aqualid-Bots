"""Mimar malzeme listesi: hayatta kalmada bulunmayan / zor bulunan bloklar ve her blok için en iyi alternatifler.

Alternatif = aynı biçim (basamak, yarım blok, duvar, çit, kapı...) + renge en yakın + kolay bulunan blok.
Çıktı yapi_data.js'e girer: BLOK_DURUM {blok: 'yok'|'zor'}, ALTERNATIF {blok: [blok...]}, BLOK_ESYA {blok: [eşya, adet]}.
"""
import json
import os
import re

import yapi_paket as P

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.environ.get('AQUALIT_REF', os.path.join(HERE, '..', '..', 'ref'))

YOK = re.compile(r'^(allow|deny|barrier|bedrock|border_block|budding_amethyst|camera|.*command_block|chemical_heat|'
                 r'colored_torch_.*|compound_creator|element_.*|end_portal|end_portal_frame|end_gateway|frosted_ice|hard_.*|'
                 r'infested_.*|jigsaw|lab_table|light_block.*|material_reducer|mob_spawner|petrified_oak.*|portal|'
                 r'reinforced_deepslate|structure_.*|suspicious_.*|trial_spawner|vault|underwater_.*|unknown|moving_block|'
                 r'.*piston_arm_collision|fire|soul_fire|info_update.*|reserved6|netherreactor|glowingobsidian|'
                 r'invisible_bedrock|dragon_egg|spawner)$')
ZOR = re.compile(r'^(diamond_block|emerald_block|netherite_block|gold_block|beacon|conduit|dragon_head|.*skull|'
                 r'ancient_debris|crying_obsidian|respawn_anchor|lodestone|sea_lantern|.*prismarine.*|purpur.*|end_stone.*|'
                 r'end_rod|chorus_.*|.*shulker_box|sponge|wet_sponge|heavy_core|sculk.*|calibrated_sculk_sensor|'
                 r'.*froglight|blue_ice|packed_ice|ice|brown_mushroom_block|red_mushroom_block|mushroom_stem|mycelium|podzol|'
                 r'.*coral.*|.*amethyst.*|web|.*quartz.*|glowstone|nether_.*|red_nether.*|.*blackstone.*|.*basalt|soul_.*|'
                 r'crimson_.*|warped_.*|shroomlight|magma|gilded_blackstone|ancient_.*|.*oxidized_.*|.*weathered_.*|'
                 r'.*exposed_.*|enchanting_table|ender_chest|end_crystal|spore_blossom|sniffer_egg|turtle_egg|'
                 r'.*_head|bee_nest|honeycomb_block|.*resin.*|creaking_heart|.*pale_oak.*|cherry_.*|mangrove_.*|'
                 r'.*bamboo.*|.*mud_brick.*|tuff_.*|polished_tuff.*|chiseled_tuff.*|copper_bulb.*|.*copper_grate.*)$')

# renkli tam bloklar (beton, yün, pişmiş kil, vitray) biçim sayılmaz: beyaz betona beyaz yün de olur
SHAPES = ['_double_slab', '_slab', '_stairs', '_wall', '_fence_gate', '_fence', '_trapdoor', '_door', '_pressure_plate',
          '_button', '_pane', '_carpet', '_wall_sign', '_standing_sign', '_hanging_sign', '_log', '_wood', '_leaves',
          '_concrete_powder', '_candle']
OZEL = {   # biçimi olmayan özel bloklar: elle seçilmiş yakın aileler
    'ISIK': ['torch', 'lantern', 'soul_lantern', 'soul_torch', 'glowstone', 'sea_lantern', 'shroomlight', 'redstone_lamp',
             'lit_pumpkin', 'end_rod', 'ochre_froglight'],
    'CICEK': ['poppy', 'dandelion', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip',
              'pink_tulip', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley'],
    'CAM': ['glass', 'tinted_glass', 'white_stained_glass', 'light_gray_stained_glass'],
}
# yapı malzemesi olmayan tam bloklar (cevher, makine, kap, tarım...)
DEGIL = re.compile(r'(ore|comparator|repeater|chest|shelf|scaffolding|honey|powder_snow|stonecutter|table|furnace|smoker|'
                   r'barrel|dispenser|dropper|observer|piston|tnt|lamp|jukebox|noteblock|beehive|bee_nest|composter|lectern|'
                   r'loom|anvil|cauldron|hopper|bell|grindstone|crafter|target|redstone|daylight|sculk|slime|hay|melon|'
                   r'pumpkin|cake|bed$|sponge|^snow$|dirt|^sand$|red_sand|gravel|^clay$|farmland|^mud$|soul_sand|frame|'
                   r'command|spawner|vault|_block_slab|beacon|conduit|lodestone|anchor|cactus|kelp|nylium|mycelium|podzol|'
                   r'grass|moss|leaves|^ice|blue_ice|packed_ice|frosted|magma|obsidian|bookshelf|cobweb|^web$|structure|'
                   r'jigsaw|border|barrier|camera|element|compound|^light|glow|lit_|powered|unpowered|deepslate_.*_ore|raw_|spike|roots|shulker|'
                   r'^copper_block$|^iron_block$|^gold_block$|^diamond_block$|^emerald_block$|^netherite_block$|coal_block|'
                   r'lapis_block|redstone_block|amethyst|calcite|dripstone|bone_block|dried_kelp|^tuff$|resin|creaking)')
AGAC = ('oak', 'spruce', 'birch', 'jungle', 'acacia', 'mangrove', 'cherry', 'bamboo', 'crimson', 'warped', 'poplar',
        'planks', 'wooden', '_log', '_wood')
TAS = ('stone', 'cobble', 'brick', 'andesite', 'diorite', 'granite', 'deepslate', 'tuff', 'blackstone', 'sandstone',
       'quartz', 'prismarine', 'purpur', 'end_stone', 'basalt')
RENKLER = ('white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple',
           'blue', 'brown', 'green', 'red', 'black')


def sinif(name):
    if any(k in name for k in AGAC):
        return 'agac'
    if any(k in name for k in TAS):
        return 'tas'
    for r in sorted(RENKLER, key=len, reverse=True):
        if name.startswith(r + '_'):
            return 'renk'
    return ''


def renk_adi(name):
    for r in sorted(RENKLER, key=len, reverse=True):
        if name.startswith(r + '_'):
            return r
    return None


KOLAY = ('oak', 'spruce', 'birch', 'cobblestone', 'stone', 'brick', 'andesite', 'diorite', 'granite', 'sandstone',
         'deepslate', 'terracotta', 'concrete', 'wool', 'glass', 'planks', 'log')


def shape(name):
    for s in SHAPES:
        if name.endswith(s):
            return s
    return ''


def durum(name):
    if YOK.match(name):
        return 'yok'
    if ZOR.match(name):
        return 'zor'
    return ''


_V = {}


def vanilla():
    if not _V:
        d = json.load(open(os.path.join(REF, 'vanilladata_modules', 'mojang-blocks.json')))
        _V['blocks'] = {b['name'].split(':', 1)[1]: {p['name'] for p in b.get('properties', [])} for b in d['data_items']}
    return _V['blocks']


def _renk(name):
    top, side, a = P.renk(name)
    return side, a


def _dist(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def _tam_kup(name):
    if shape(name) or any(k in name for k in P.SEYREK) or 'glass' in name or 'leaves' in name:
        return False
    c = P._R.get(name) if P._R else None
    return True


def alternatifler(name, n=6):
    """En iyi n alternatif (en iyi önce)."""
    blocks = vanilla()
    if name not in blocks:
        return []
    for fam in OZEL.values():
        if name in fam:
            return [b for b in fam if b != name and b in blocks and not durum(b)][:n]
    sh = shape(name)
    me, _ = _renk(name)
    cands = []
    for b, props in blocks.items():
        if b == name or durum(b) == 'yok' or b.startswith('waxed_') or 'double_slab' in b and sh != '_double_slab':
            continue
        if shape(b) != sh:
            continue
        cam = 'glass' in name
        if cam != ('glass' in b and 'tinted' not in b and not b.startswith('hard_')):
            continue                            # cam ancak camla değişir
        if not sh and not cam and not (_tam_kup(b) and _tam_kup(name)):
            continue
        if DEGIL.search(b) and not cam:
            continue
        if b not in P._R:
            continue
        if sh and blocks[b] != blocks[name]:
            continue                            # durumlar farklı: dönüş/yarım bilgisi kaybolur
        c, a = _renk(b)
        if a < 0.6 and not cam:
            continue
        score = _dist(me, c)
        if durum(b) == 'zor':
            score += 90
        if sinif(b) and sinif(b) == sinif(name):
            score -= 40
        if renk_adi(name) and renk_adi(b) == renk_adi(name):
            score -= 60
        if any(k in b for k in KOLAY):
            score -= 18
        if 'glazed' in b:
            score += 25                         # desenli: düz duvarda göze batar
        cands.append((score, b))
    cands.sort()
    return [b for _, b in cands[:n]]


def esya(name):
    """Bloğu koymak için eşya [ad, adet] (alt yarı gibi tam blok kabul edilir)."""
    r = P.esya(name, {})
    if not r:
        return None
    it, k = r
    return None if it.startswith('?') else [it, k]


def tablo(yapi_bloklari):
    """Kütüphanedeki bütün bloklar için durum, alternatif ve eşya tabloları."""
    if not P._R:
        P.renk('stone')
    bloklar = set(yapi_bloklari)
    durumlar, alt = {}, {}
    for b in sorted(bloklar):
        d = durum(b)
        if d:
            durumlar[b] = d
        a = alternatifler(b)
        if a:
            alt[b] = a
    hepsi = bloklar | {x for v in alt.values() for x in v}
    es = {}
    for b in sorted(hepsi):
        e = esya(b)
        if e:
            es[b] = e
    return durumlar, alt, es


if __name__ == '__main__':
    for b in ['diamond_block', 'oak_stairs', 'quartz_block', 'sea_lantern', 'spruce_planks', 'prismarine_bricks',
              'white_concrete', 'stone_brick_slab', 'gold_block', 'torch', 'purpur_block', 'dark_oak_fence']:
        print(b, durum(b) or '-', alternatifler(b))
