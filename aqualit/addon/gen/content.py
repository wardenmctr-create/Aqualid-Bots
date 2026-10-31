"""Aqualit Robotlari: esya, blok, tarif ve dil tanimlari (tek kaynak)."""

NS = 'aqualit'
VERSION = [0, 3, 6]

# ---------------------------------------------------------------- esyalar
MATERIALS = [
    ('raw_aqualit', 'Ham Aqualit', 'raw_aqualit'),
    ('aqualit_ingot', 'Aqualit Külçesi', 'aqualit_ingot'),
]

TOOLS = [
    # id, ad, ikon, tur, hasar, grup
    ('aqualit_pickaxe', 'Aqualit Kazma', 'aqualit_pickaxe', 'pickaxe', 5, 'minecraft:itemGroup.name.pickaxe'),
    ('aqualit_shovel', 'Aqualit Kürek', 'aqualit_shovel', 'shovel', 4, 'minecraft:itemGroup.name.shovel'),
    ('aqualit_axe', 'Aqualit Balta', 'aqualit_axe', 'axe', 6, 'minecraft:itemGroup.name.axe'),
    ('aqualit_hoe', 'Aqualit Çapa', 'aqualit_hoe', 'hoe', 4, 'minecraft:itemGroup.name.hoe'),
    ('aqualit_sword', 'Aqualit Kılıç', 'aqualit_sword', 'sword', 7, 'minecraft:itemGroup.name.sword'),
]
TOOL_DURABILITY = 937   # elmasın (1561) 3/5'i
TOOL_SPEED = 10        # elmas 8

DIG_TAGS = {
    'pickaxe': "q.any_tag('minecraft:is_pickaxe_item_destructible', 'stone', 'metal', 'rock', 'minecraft:stone', 'aqualit:ore')",
    'shovel': "q.any_tag('minecraft:is_shovel_item_destructible', 'dirt', 'sand', 'gravel', 'grass', 'snow', 'minecraft:dirt', 'minecraft:sand')",
    'axe': "q.any_tag('minecraft:is_axe_item_destructible', 'wood', 'log', 'pumpkin', 'minecraft:log', 'minecraft:planks')",
    'hoe': "q.any_tag('minecraft:is_hoe_item_destructible', 'leaves', 'minecraft:leaves', 'minecraft:crop')",
}

CHESTS = [
    # id, ad, ikon(=dokular), tur
    ('aqualit_chest', 'Aqualit Sandık', 'aqualit_chest', 'genel'),
    ('chest_miner', 'Madenci Sandığı', 'chest_miner', 'madenci'),
    ('chest_digger', 'Kürekçi Sandığı', 'chest_digger', 'kurekci'),
    ('chest_farmer', 'Çiftçi Sandığı', 'chest_farmer', 'ciftci'),
    ('chest_lumber', 'Oduncu Sandığı', 'chest_lumber', 'oduncu'),
    ('chest_kilicli', 'Kılıçlı Sandığı', 'chest_kilicli', 'kilicli'),
    ('chest_builder', 'İnşaatçı Sandığı', 'chest_builder', 'insaatci'),
    ('chest_collector', 'Toplayıcı Sandığı', 'chest_collector', 'toplayici'),
]
# sandık açıkken görünen işaretler (sayfa okları, kilitli yuva); envantere düşmez, yaratıcı listesinde yok
SANDIK_MARKERS = [
    ('sayfa_ileri', 'Sonraki sayfa', 'sayfa_ileri'),
    ('sayfa_geri', 'Önceki sayfa', 'sayfa_geri'),
    ('kilitli_yuva', 'Kilitli yuva', 'locked_slot'),
]

ROBOTS = [
    # id, ad, ikon, tur, model, yaratici-sadece
    ('robot_madenci', 'Madenci Robot', 'robot_madenci', 'madenci', 1, False),
    ('robot_kurekci', 'Kürekçi Robot', 'robot_kurekci', 'kurekci', 1, False),
    ('robot_ciftci', 'Çiftçi Robot', 'robot_ciftci', 'ciftci', 1, False),
    ('robot_oduncu', 'Oduncu Robot', 'robot_oduncu', 'oduncu', 1, False),
    ('robot_kilicli_1', 'Kılıçlı Robot · Seviye 1 (Kırmızı)', 'robot_kilicli_1', 'kilicli', 1, False),
    ('robot_kilicli_2', 'Kılıçlı Robot · Seviye 2 (Yeşil)', 'robot_kilicli_2', 'kilicli', 2, True),
    ('robot_kilicli_3', 'Kılıçlı Robot · Seviye 3 (Mor)', 'robot_kilicli_3', 'kilicli', 3, True),
    ('robot_kilicli_4', 'Kılıçlı Robot · Seviye 4 (Sarı)', 'robot_kilicli_4', 'kilicli', 4, True),
    ('robot_kilicli_5', 'Kılıçlı Robot · Seviye 5 (Mavi)', 'robot_kilicli_5', 'kilicli', 5, True),
    ('robot_kesif', 'Keşif Robotu (araçlara dönüşür)', 'robot_kesif', 'kesif', 1, False),
    ('robot_insaatci', 'Mimar Robot (yapı kurar, uçar)', 'robot_insaatci', 'insaatci', 1, False),
    ('robot_toplayici', 'Organizatör Robot (sandıkları yönetir, konuşur, plan yapar)', 'robot_toplayici', 'toplayici', 1, False),
]

DEVICES = [
    # id, ad, ikon, tur, dokunmatik dugme yazisi
    ('task_remote', 'Görev Kumandası', 'task_remote', 'remote', 'Görev ver'),
    ('robot_radio', 'Robot Telsizi', 'robot_radio', 'radio', 'Telsiz'),
    ('robot_tracker', 'Takip Ekranı', 'robot_tracker', 'tracker', 'İzle'),
    ('command_rod', 'Komut Çubuğu', 'command_rod', 'rod', 'Komut ver'),
    ('zone_selector', 'Bölge Seçici', 'zone_selector', 'zone', 'Seç'),
    ('tuning_gear', 'Kılıçlı Ayar Dişlisi', 'tuning_gear', 'gear', 'Ayarla'),
    ('kesif_kiti', 'Keşif Dönüşüm Kiti (Keşif\'e basılı tut)', 'kesif_kiti', 'donusum', 'Dönüştür'),
    ('aqualit_telefon', 'Aqualit Telefon (Organizatör ile konuş)', 'aqualit_telefon', 'telefon', 'Konuş'),
]

# Keşif'e binince oyuncuya verilen eşyalar (inince geri alınır; yaratıcı menüde yok): id, ad, ikon, tür
KESIF_ESYA = [
    ('kesif_radar', 'Yer Bulucu Radar (basılı tut)', 'kesif_radar', 'radar'),
    ('kesif_hiz', 'Keşif Hız Sayacı', 'kesif_hiz', 'hiz'),
    ('kesif_otopilot_kapali', 'Otopilot: KAPALI (sen sürüyorsun)', 'kesif_otopilot_kapali', 'otopilot'),
    ('kesif_otopilot_acik', 'Otopilot: AÇIK (Keşif kendisi gidiyor)', 'kesif_otopilot_acik', 'otopilot'),
    # v0.3.6: yalnız arazi aracına binince gelir; basılı tutunca tekerleklere tutucular çıkar, düz duvara tırmanır
    ('kesif_tirman_kapali', 'Tırmanma Modu: KAPALI (basılı tut)', 'kesif_tirman_kapali', 'tirman'),
    ('kesif_tirman_acik', 'Tırmanma Modu: AÇIK (duvara sür)', 'kesif_tirman_acik', 'tirman'),
]

# Kapalı robot (heykel) eşyaları: tür + model -> blok durumu 'aqualit:tur'
# yeni türler sona eklenir (eski dünyalardaki blok durumları bozulmasın); en çok 16 değer
STATUE_VARIANTS = ['madenci', 'kurekci', 'ciftci', 'oduncu'] + [f'kilicli_{m}' for m in range(1, 6)] + ['insaatci', 'toplayici']
STATUE_NAMES = {'madenci': 'Kapalı Madenci Robot', 'kurekci': 'Kapalı Kürekçi Robot', 'ciftci': 'Kapalı Çiftçi Robot',
                'oduncu': 'Kapalı Oduncu Robot', 'insaatci': 'Kapalı Mimar Robot', 'toplayici': 'Kapalı Organizatör Robot', **{f'kilicli_{m}': f'Kapalı Kılıçlı Robot · Seviye {m}' for m in range(1, 6)}}
STATUE_ITEMS = [(f'kapali_{v}', STATUE_NAMES[v], f'kapali_{v}', v) for v in STATUE_VARIANTS]
REPAIR_KIT = ('tamir_kiti', 'Aqualit Tamir Kiti', 'tamir_kiti')

BLOCKS = [
    # id, ad, doku, sertlik, ses, harita rengi, etiketler
    ('aqualit_ore', 'Aqualit Cevheri', 'aqualit_ore', 3.0, 'stone', '#7f7f7f',
     ['minecraft:is_pickaxe_item_destructible', 'minecraft:iron_tier_destructible', 'aqualit:ore', 'stone']),
    ('deepslate_aqualit_ore', 'Derin Kayrak Aqualit Cevheri', 'deepslate_aqualit_ore', 4.5, 'deepslate', '#505055',
     ['minecraft:is_pickaxe_item_destructible', 'minecraft:iron_tier_destructible', 'aqualit:ore', 'stone']),
    ('aqualit_block', 'Aqualit Bloğu', 'aqualit_block', 5.0, 'metal', '#168770',
     ['minecraft:is_pickaxe_item_destructible', 'minecraft:stone_tier_destructible', 'metal', 'aqualit:metal']),
]

# ---------------------------------------------------------------- zırhlar (V2)
import zirh as _Z            # noqa: E402
import aqualit_set as _A     # noqa: E402

BARKS = [(f'kabuk_{t[0]}', f'{t[1]} Kabuğu', f'kabuk_{t[0]}', t[0]) for t in _Z.TREES]
# (kimlik, ad, simge, ağaç, parça, yuva, koruma)
BARK_ARMORS = [(_Z.bark_id(t[0], p[0]), f'{t[1]} {p[2]}', _Z.bark_id(t[0], p[0]), t[0], p[0], p[5], p[6])
               for t in _Z.TREES for p in _Z.PIECES]
STONE_ARMORS = [(_Z.stone_id(st[0], p[0]), _Z.stone_name(st, p[0]), _Z.stone_id(st[0], p[0]), st[0], p[0], p[5])
                for st in _Z.STONES for p in _Z.PIECES]
AQ_ARMORS = [(a[0], a[1], a[0], a[3], a[4], a[5], a[6]) for a in _A.ARMOR]
BOOKS = [(f'buyu_{e[0]}', f'Büyü Kitabı: {e[1]}', f'buyu_{e[0]}', e[0]) for e in _Z.ENCHANTS]

# ---------------------------------------------------------------- tarifler
def I(x):
    return {'item': x}

RECIPES = []

def shaped(rid, pattern, key, result, count=1, unlock=None):
    RECIPES.append(('shaped', rid, {'pattern': pattern, 'key': key, 'result': {'item': result, 'count': count},
                                    'unlock': unlock or [{'item': 'aqualit:aqualit_ingot'}]}))

def shapeless(rid, ingredients, result, count=1, unlock=None):
    RECIPES.append(('shapeless', rid, {'ingredients': ingredients, 'result': {'item': result, 'count': count},
                                       'unlock': unlock or [{'item': 'aqualit:aqualit_ingot'}]}))

def furnace(rid, inp, out, tags=('furnace', 'blast_furnace')):
    RECIPES.append(('furnace', rid, {'input': inp, 'output': out, 'tags': list(tags)}))

K = 'aqualit:aqualit_ingot'
furnace('smelt_raw_aqualit', 'aqualit:raw_aqualit', K)
furnace('smelt_aqualit_ore', 'aqualit:aqualit_ore', K)
furnace('smelt_deepslate_aqualit_ore', 'aqualit:deepslate_aqualit_ore', K)
shaped('aqualit_block', ['###', '###', '###'], {'#': I(K)}, 'aqualit:aqualit_block')
shaped('aqualit_ingot_from_block', ['#'], {'#': I('aqualit:aqualit_block')}, K, 9,
       unlock=[{'item': 'aqualit:aqualit_block'}])
shaped('aqualit_pickaxe', ['XXX', ' # ', ' # '], {'X': I(K), '#': I('minecraft:stick')}, 'aqualit:aqualit_pickaxe')
shaped('aqualit_shovel', ['X', '#', '#'], {'X': I(K), '#': I('minecraft:stick')}, 'aqualit:aqualit_shovel')
shaped('aqualit_axe', ['XX', 'X#', ' #'], {'X': I(K), '#': I('minecraft:stick')}, 'aqualit:aqualit_axe')
shaped('aqualit_hoe', ['XX', ' #', ' #'], {'X': I(K), '#': I('minecraft:stick')}, 'aqualit:aqualit_hoe')
shaped('aqualit_sword', ['X', 'X', '#'], {'X': I(K), '#': I('minecraft:stick')}, 'aqualit:aqualit_sword')
shaped('aqualit_chest', ['XXX', 'X#X', 'XXX'], {'X': I(K), '#': I('minecraft:chest')}, 'aqualit:aqualit_chest')
for rid, tool in [('robot_madenci', 'aqualit:aqualit_pickaxe'), ('robot_kurekci', 'aqualit:aqualit_shovel'),
                  ('robot_ciftci', 'aqualit:aqualit_hoe'), ('robot_oduncu', 'aqualit:aqualit_axe'),
                  ('robot_kilicli_1', 'aqualit:aqualit_sword'), ('robot_kesif', 'minecraft:compass'),
                  ('robot_insaatci', 'minecraft:brick_block'), ('robot_toplayici', 'minecraft:barrel')]:
    shaped(rid, [' B ', 'XSX', ' A '], {'B': I('aqualit:aqualit_block'), 'X': I(K), 'S': I('aqualit:aqualit_chest'),
                                       'A': I(tool)}, 'aqualit:' + rid, unlock=[{'item': 'aqualit:aqualit_chest'}])
for cid, wood in [('chest_miner', 'minecraft:wooden_pickaxe'), ('chest_digger', 'minecraft:wooden_shovel'),
                  ('chest_farmer', 'minecraft:wooden_hoe'), ('chest_lumber', 'minecraft:wooden_axe'),
                  ('chest_kilicli', 'minecraft:wooden_sword'), ('chest_builder', 'minecraft:brick_block'),
                  ('chest_collector', 'minecraft:barrel')]:
    shapeless(cid, [I('aqualit:aqualit_chest'), I(wood)], 'aqualit:' + cid, unlock=[{'item': 'aqualit:aqualit_chest'}])
shaped('robot_radio', [' X ', 'XRX', 'XXX'], {'X': I(K), 'R': I('minecraft:redstone')}, 'aqualit:robot_radio')
shaped('aqualit_telefon', [' X ', 'XGX', 'XRX'], {'X': I(K), 'G': I('minecraft:glass_pane'), 'R': I('minecraft:redstone')},
       'aqualit:aqualit_telefon')
shapeless('kesif_kiti', [I(K), I('minecraft:compass'), I('minecraft:redstone')], 'aqualit:kesif_kiti')
shaped('robot_tracker', ['XXX', 'XGX', 'XCX'], {'X': I(K), 'G': I('minecraft:glass_pane'), 'C': I('minecraft:compass')},
       'aqualit:robot_tracker')
shapeless('task_remote', [I(K), I('minecraft:redstone'), I('minecraft:stone_button')], 'aqualit:task_remote')
shaped('command_rod', [' R ', ' X ', ' X '], {'X': I(K), 'R': I('minecraft:redstone')}, 'aqualit:command_rod')
shapeless('tamir_kiti', [I(K), I('minecraft:iron_ingot'), I('minecraft:iron_ingot'), I('minecraft:redstone')],
          'aqualit:tamir_kiti')
shaped('zone_selector', [' XG', ' #X', '#  '], {'X': I(K), 'G': I('minecraft:gold_ingot'), '#': I('minecraft:stick')},
       'aqualit:zone_selector')

# zırh tarifleri
for _t in _Z.TREES:
    for _p in _Z.PIECES:
        shaped(_Z.bark_id(_t[0], _p[0]), _p[7], {'K': I(f'aqualit:kabuk_{_t[0]}')}, 'aqualit:' + _Z.bark_id(_t[0], _p[0]),
               unlock=[{'item': f'aqualit:kabuk_{_t[0]}'}])
for _st, _mat in (('tas', 'minecraft:stone'), ('derin_kayrak', 'minecraft:cobbled_deepslate')):
    for _p in _Z.PIECES:
        shaped(_Z.stone_id(_st, _p[0]), _p[7], {'K': I(_mat)}, 'aqualit:' + _Z.stone_id(_st, _p[0]), unlock=[{'item': _mat}])
for _a in _A.ARMOR:
    shaped(_a[0], _a[6], {'K': I(K)}, f'aqualit:{_a[0]}')
# Büyü kitaplarının tarifi YOK: kabuk kitapları yalnızca doğal sandıklardan çıkar (zirh.js).
# (Taş zırh kitapları v0.2.8'de taş zırhın özel özelliğiyle birlikte kaldırıldı.)

# ---------------------------------------------------------------- dil
LANG_EXTRA = {
    'entity.aqualit:robot.name': 'Aqualit Robot',
    'entity.aqualit:robot_chest.name': 'Robot Sandığı',
    'entity.aqualit:fx.name': 'Güç Efekti',
    'entity.aqualit:kesif.name': 'Keşif Robotu',
    'entity.aqualit:dron.name': 'Mini Dron Mimar',
    'action.interact.aqualit.remote': 'Görev ver',
    'action.interact.aqualit.radio': 'Telsiz',
    'action.interact.aqualit.tracker': 'İzle',
    'action.interact.aqualit.rod': 'Komut ver',
    'action.interact.aqualit.gear': 'Ayarla',
    'action.interact.aqualit.chest': 'Aç',
    'action.interact.aqualit.kit': 'Onar',
    'action.interact.aqualit.kesif': 'Menü',
    'tile.aqualit.kapali_robot.name': 'Kapalı Robot',
    'tile.aqualit:kapali_robot.name': 'Kapalı Robot',
}


def lang_lines():
    out = {}
    for iid, name, *_ in (MATERIALS + TOOLS + CHESTS + SANDIK_MARKERS + ROBOTS + DEVICES + KESIF_ESYA + STATUE_ITEMS + [REPAIR_KIT] + BARKS + BARK_ARMORS
                          + STONE_ARMORS + AQ_ARMORS + BOOKS):
        out[f'item.aqualit.{iid}.name'] = name
    for bid, name, *_ in BLOCKS:
        out[f'tile.aqualit.{bid}.name'] = name
        out[f'tile.aqualit:{bid}.name'] = name
    out.update(LANG_EXTRA)
    return out
