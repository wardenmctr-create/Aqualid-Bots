"""Mimar farm kütüphanesi, 2. bölüm (v0.5.1): 27 yeni Bedrock farmı (yapilar.S ile). **Oyunda denenmedi.**

Bitki/ağaç farmlarını iş robotları (Çiftçi, Oduncu) hasat eder; hayvan gerekenlerde canlılar yapıya dahil değildir
(Mimar bitirince söyler). Kızıltaşlı olanlar Bedrock kurallarına göre çizildi (gözlemci + piston, dağıtıcı + kemik tozu).
"""
import yapilar as Y

F = Y.FACING
OBS = lambda d: {'minecraft:facing_direction': d}
CARD = lambda d: {'minecraft:cardinal_direction': d}


def _sandik(s, x, y, z):
    s.put(x, y, z, 'chest', **CARD('south'))


# ------------------------------------------------------------------ kızıltaşlı bitki farmları
def otomatik_seker_kamisi():
    s = Y.S('otomatik_seker_kamisi', 'Otomatik Şeker Kamışı Farmı', 'ciftlik', 13, 6, 6,
            'Kamış 2. boyuna gelince gözlemci görür, piston keser; kamış su kanalıyla huniye, sandığa akar. Kâğıt ve kitap için.')
    s.box(0, 0, 0, 12, 0, 5, 'stone_bricks')
    s.box(0, 1, 2, 11, 1, 2, 'sand')
    s.box(0, 1, 3, 11, 1, 3, 'water')
    s.box(0, 2, 2, 11, 2, 2, 'reeds', age=0)
    s.box(0, 1, 1, 11, 2, 1, 'stone_bricks')
    s.box(0, 3, 1, 11, 3, 1, 'piston', facing_direction=F['south'])
    s.box(0, 4, 1, 11, 4, 1, 'observer', **OBS('south'))
    s.box(0, 1, 4, 11, 1, 4, 'hopper', facing_direction=F['east'])
    _sandik(s, 12, 1, 4)
    s.box(0, 2, 4, 11, 4, 4, 'glass')
    s.box(0, 5, 1, 11, 5, 3, 'glass')
    return s.finish()


def _cicek_cim(key, ad, aciklama, zemin):
    s = Y.S(key, ad, 'ciftlik', 8, 3, 5, aciklama)
    s.box(0, 0, 0, 7, 0, 4, 'stone_bricks')
    s.box(1, 0, 1, 6, 0, 3, zemin)
    # yan duvardaki dağıtıcı ortadaki çim bloğuna kemik tozu atar; üstündeki düğmeye bas
    s.put(0, 1, 2, 'dispenser', facing_direction=F['east'], triggered_bit=False)
    s.put(1, 1, 2, zemin)
    s.put(0, 2, 2, 'stone_button', facing_direction=F['up'], button_pressed_bit=False)
    s.walls(0, 1, 0, 7, 1, 4, 'oak_fence')
    s.put(0, 1, 2, 'dispenser', facing_direction=F['east'], triggered_bit=False)
    s.put(7, 1, 2, 'fence_gate', **CARD('east'))
    return s.finish()


def cicek_farmi():
    return _cicek_cim('cicek_farmi', 'Çiçek Farmı (Kemik Tozu)',
                      'Dağıtıcıya kemik tozu koy, düğmeye bas: çimende çiçek biter; Çiftçi ya da sen toplarsın. Boya için.',
                      'grass_block')


def cimen_tohum_farmi():
    return _cicek_cim('cimen_tohum_farmi', 'Çimen ve Tohum Farmı',
                      'Kemik tozuyla çimen biter; kırınca buğday tohumu düşer (tavuk ve kompost için).', 'grass_block')


def yosun_blogu_farmi():
    s = Y.S('yosun_blogu_farmi', 'Yosun Bloğu Farmı', 'ciftlik', 7, 4, 5,
            'Ortadaki yosun bloğuna dağıtıcı kemik tozu atar, çevredeki taşlar yosuna döner; piston iter, Kürekçi toplar. Kompost için çok iyi.')
    s.box(0, 0, 0, 6, 0, 4, 'stone_bricks')
    s.put(3, 1, 2, 'moss_block')
    s.box(1, 1, 1, 5, 1, 3, 'stone'); s.put(3, 1, 2, 'moss_block')
    s.put(3, 2, 2, 'dispenser', facing_direction=F['down'], triggered_bit=False)
    s.put(3, 3, 2, 'stone_button', facing_direction=F['up'], button_pressed_bit=False)
    s.walls(0, 1, 0, 6, 1, 4, 'glass')
    return s.finish()


def lav_farmi():
    s = Y.S('lav_farmi', 'Lav Farmı (Damlataş)', 'ciftlik', 9, 6, 3,
            'Lavın altında damlataş bloğu ve sivri damlataş; damlayan lav alttaki kazanları doldurur. Kovayla al: sonsuz yakıt.')
    s.box(0, 0, 0, 8, 0, 2, 'stone_bricks')
    for x in (1, 3, 5, 7):
        s.put(x, 1, 1, 'cauldron', fill_level=0, cauldron_liquid='water')
        s.put(x, 3, 1, 'pointed_dripstone', hanging=True, dripstone_thickness='tip')
        s.put(x, 4, 1, 'dripstone_block')
        s.put(x, 5, 1, 'lava')
    s.box(0, 4, 0, 8, 4, 0, 'stone_bricks'); s.box(0, 4, 2, 8, 4, 2, 'stone_bricks')
    s.box(0, 5, 0, 8, 5, 0, 'stone_bricks'); s.box(0, 5, 2, 8, 5, 2, 'stone_bricks')
    for x in (0, 2, 4, 6, 8):
        s.put(x, 4, 1, 'stone_bricks'); s.put(x, 5, 1, 'stone_bricks')
        s.box(x, 1, 1, x, 3, 1, 'glass')
    return s.finish()


def sivri_damlatas_farmi():
    s = Y.S('sivri_damlatas_farmi', 'Sivri Damlataş Farmı', 'ciftlik', 7, 6, 3,
            'Suyun altındaki damlataş bloğundan sivri damlataş uzar; uç gelince Madenci kırar. Ok ve tuzak için.')
    s.box(0, 0, 0, 6, 0, 2, 'stone_bricks')
    for x in (1, 3, 5):
        s.put(x, 3, 1, 'pointed_dripstone', hanging=True, dripstone_thickness='tip')
        s.put(x, 4, 1, 'dripstone_block')
        s.put(x, 5, 1, 'water')
    s.box(0, 4, 0, 6, 5, 0, 'stone_bricks'); s.box(0, 4, 2, 6, 5, 2, 'stone_bricks')
    for x in (0, 2, 4, 6):
        s.box(x, 4, 1, x, 5, 1, 'stone_bricks')
    return s.finish()


def sonsuz_su():
    s = Y.S('sonsuz_su', 'Sonsuz Su Kaynağı', 'ciftlik', 4, 2, 4, '2x2 su havuzu: kovayla aldıkça yeniden dolar.')
    s.box(0, 0, 0, 3, 0, 3, 'stone_bricks')
    s.box(1, 0, 1, 2, 0, 2, 'water')
    return s.finish()


def duz_tas_uretici():
    s = Y.S('duz_tas_uretici', 'Taş Üretici (Düz Taş)', 'ciftlik', 5, 5, 3,
            'Su alttaki oluktan akar, lav yukarıdan üstüne düşer: düşen lav suyla buluşunca düz taş olur. Madenci kazar.')
    s.box(0, 0, 0, 4, 0, 2, 'stone_bricks')
    s.put(0, 1, 1, 'water')
    s.box(1, 1, 1, 3, 1, 1, 'air')
    s.box(0, 1, 0, 4, 1, 0, 'stone_bricks'); s.box(0, 1, 2, 4, 1, 2, 'stone_bricks'); s.put(4, 1, 1, 'stone_bricks')
    s.put(2, 2, 1, 'air')
    s.put(2, 3, 1, 'lava')
    s.box(1, 3, 0, 3, 4, 0, 'stone_bricks'); s.box(1, 3, 2, 3, 4, 2, 'stone_bricks')
    s.put(1, 3, 1, 'stone_bricks'); s.put(3, 3, 1, 'stone_bricks'); s.put(2, 4, 1, 'stone_bricks')
    return s.finish()


# ------------------------------------------------------------------ ekin tarlaları
def _tarla(key, ad, ekin, aciklama):
    s = Y.S(key, ad, 'ciftlik', 9, 2, 9, aciklama)
    s.box(0, 0, 0, 8, 0, 8, 'farmland', moisturized_amount=7)
    s.put(4, 0, 4, 'water')
    s.box(0, 1, 0, 8, 1, 8, ekin, growth=0)
    s.put(4, 1, 4, 'oak_slab' if False else 'air')
    for (x, z) in ((0, 0), (8, 0), (0, 8), (8, 8)):
        s.put(x, 1, z, 'torch', torch_facing_direction='top')
    return s.finish()


def havuc_tarlasi():
    return _tarla('havuc_tarlasi', 'Havuç Tarlası', 'carrots', '9x9 havuç; Çiftçi biçer, yeniden eker. Domuz ve tavşan yemi.')


def patates_tarlasi():
    return _tarla('patates_tarlasi', 'Patates Tarlası', 'potatoes', '9x9 patates; fırında pişirilince iyi yemek.')


def pancar_tarlasi():
    return _tarla('pancar_tarlasi', 'Pancar Tarlası', 'beetroot', '9x9 pancar; kırmızı boya ve pancar çorbası.')


def bal_farmi():
    s = Y.S('bal_farmi', 'Bal Farmı (Arı Kovanı)', 'ciftlik', 9, 4, 7,
            'Kovanların altında kamp ateşi (duman arıları sakinleştirir), çevrede çiçek. Arıları getir; dolunca şişeyle bal, makasla petek.')
    s.box(0, 0, 0, 8, 0, 6, 'grass_block')
    for x in (2, 4, 6):
        s.put(x, 1, 3, 'campfire', extinguished=False, **CARD('south'))
        s.put(x, 2, 3, 'hay_block', pillar_axis='y')
        s.put(x, 3, 3, 'beehive', direction=0, honey_level=0)
    for x in range(1, 8):
        s.put(x, 1, 1, 'poppy' if x % 2 else 'dandelion')
        s.put(x, 1, 5, 'dandelion' if x % 2 else 'poppy')
    s.walls(0, 1, 0, 8, 1, 6, 'oak_fence')
    s.put(4, 1, 6, 'fence_gate', **CARD('south'))
    return s.finish()


def parlak_cilek_farmi():
    s = Y.S('parlak_cilek_farmi', 'Parlak Meyve Farmı', 'ciftlik', 7, 5, 7,
            'Yosun tavandan sarkan mağara sarmaşıkları; parlak meyveler hem ışık verir hem yenir. Çiftçi toplar.')
    s.box(0, 0, 0, 6, 0, 6, 'moss_block')
    s.box(0, 4, 0, 6, 4, 6, 'moss_block')
    for x in range(1, 6, 2):
        for z in range(1, 6, 2):
            s.box(x, 2, z, x, 3, z, 'cave_vines', growing_plant_age=0)
    s.walls(0, 1, 0, 6, 3, 6, 'glass')
    s.put(3, 1, 0, 'air'); s.put(3, 2, 0, 'air')
    return s.finish()


def sarmasik_farmi():
    s = Y.S('sarmasik_farmi', 'Kıvrık Sarmaşık Farmı', 'ciftlik', 7, 8, 3,
            'Çarpık nilyum üstünde kıvrık sarmaşıklar yukarı uzar; Oduncu alttan kırar. Merdiven gibi tırmanılır.')
    s.box(0, 0, 0, 6, 0, 2, 'warped_nylium')
    for x in (1, 3, 5):
        s.put(x, 1, 1, 'twisting_vines', twisting_vines_age=0)
    s.walls(0, 1, 0, 6, 7, 2, 'glass')
    return s.finish()


def kaplumbaga_farmi():
    s = Y.S('kaplumbaga_farmi', 'Kaplumbağa Farmı', 'ciftlik', 11, 3, 9,
            'Kumsal ve sığ havuz; kaplumbağalara deniz otu ver, yumurtlarlar. Yavrular büyürken pul düşürür (kaplumbağa kabuğu).')
    s.box(0, 0, 0, 10, 0, 8, 'sand')
    s.box(1, 0, 5, 9, 0, 7, 'water')
    for x in (3, 5, 7):
        s.put(x, 1, 2, 'turtle_egg', turtle_egg_count='one_egg', cracked_state='no_cracks')
    s.walls(0, 1, 0, 10, 1, 8, 'glass')
    return s.finish()


def buz_farmi():
    s = Y.S('buz_farmi', 'Buz Farmı', 'ciftlik', 11, 2, 11,
            'Soğuk biyomda (karlı tundra, buz dikenleri) kur: geceleri su donar, buz kırılınca yeniden su olur. Gemi yolu için.')
    s.box(0, 0, 0, 10, 0, 10, 'stone_bricks')
    for x in range(1, 10):
        for z in range(1, 10):
            s.put(x, 0, z, 'water' if (x + z) % 2 else 'ice')
    s.walls(0, 1, 0, 10, 1, 10, 'stone_bricks')
    return s.finish()


def kar_farmi():
    s = Y.S('kar_farmi', 'Kar Farmı (Kar Golemi)', 'ciftlik', 5, 4, 5,
            'Ortadaki 2 kar bloğunun üstüne oyma balkabağı tak: kar golemi olur. Bıraktığı karı Kürekçi kürekle toplar: kar topu.')
    s.box(0, 0, 0, 4, 0, 4, 'stone_bricks')
    s.walls(0, 1, 0, 4, 3, 4, 'glass')
    s.put(2, 1, 2, 'snow')
    s.put(2, 2, 2, 'snow')
    return s.finish()


def balik_tutma():
    s = Y.S('balik_tutma', 'Balık Tutma Yeri (AFK)', 'ciftlik', 5, 3, 5,
            'Açık gökyüzü altında 3x3 su; kenardaki kapak ve huni oltayla çıkan balıkları toplar. Oltayla kancayı suya at, bekle.')
    s.box(0, 0, 0, 4, 0, 4, 'stone_bricks')
    s.box(1, 0, 1, 3, 0, 3, 'water')
    s.put(2, 1, 4, 'hopper', facing_direction=F['down'])
    _sandik(s, 2, 0, 4)
    s.box(1, 1, 0, 3, 1, 0, 'trapdoor', direction=0, open_bit=True, upside_down_bit=False)
    return s.finish()


# ------------------------------------------------------------------ ağaç farmları
def _agac(key, ad, fidan, aciklama, dev=False, zemin='grass_block'):
    W = 17
    s = Y.S(key, ad, 'ciftlik', W, 2, W, aciklama)
    s.box(0, 0, 0, W - 1, 0, W - 1, zemin)
    for x in (3, 8, 13):
        for z in (3, 8, 13):
            if dev:
                for dx in (0, 1):
                    for dz in (0, 1):
                        s.put(x - 1 + dx, 1, z - 1 + dz, fidan, age_bit=False)
            elif fidan == 'mangrove_propagule':
                s.put(x, 1, z, fidan, hanging=False, propagule_stage=0)
            else:
                s.put(x, 1, z, fidan, age_bit=False)
    for (x, z) in ((0, 0), (W - 1, 0), (0, W - 1), (W - 1, W - 1), (8, 0), (0, 8), (W - 1, 8), (8, W - 1)):
        s.put(x, 1, z, 'torch', torch_facing_direction='top')
    return s.finish()


def hus_farmi():
    return _agac('hus_farmi', 'Huş Ağacı Farmı', 'birch_sapling', '9 huş fidanı; Oduncu keser, yeniden diker. Huş düz büyür, kesmesi kolay.')


def ladin_farmi():
    return _agac('ladin_farmi', 'Dev Ladin Farmı (2x2)', 'spruce_sapling', '2x2 ladin fidanları dev ladin olur: çok odun.', dev=True)


def orman_agaci_farmi():
    return _agac('orman_agaci_farmi', 'Dev Orman Ağacı Farmı (2x2)', 'jungle_sapling', '2x2 orman fidanı dev ağaç olur; kakao için de kütük.', dev=True)


def kara_mese_farmi():
    return _agac('kara_mese_farmi', 'Kara Meşe Farmı (2x2)', 'dark_oak_sapling', '2x2 kara meşe fidanları; koyu tahta.', dev=True)


def kiraz_farmi():
    return _agac('kiraz_farmi', 'Kiraz Ağacı Farmı', 'cherry_sapling', '9 kiraz fidanı; pembe tahta ve yapraklar.')


def akasya_farmi():
    return _agac('akasya_farmi', 'Akasya Farmı', 'acacia_sapling', '9 akasya fidanı; turuncu tahta.')


def mangrov_farmi():
    return _agac('mangrov_farmi', 'Mangrov Farmı', 'mangrove_propagule', 'Çamurda mangrov filizleri; kökler ve tahta.', zemin='mud')


# ------------------------------------------------------------------ hayvan ve üretim
def domuz_agili():
    s = Y.S('domuz_agili', 'Domuz Ağılı', 'ciftlik', 9, 3, 9, 'Çitli ağıl ve havuç bahçesi; domuzları havuçla getir, çoğalt.')
    s.box(0, 0, 0, 8, 0, 8, 'grass_block')
    s.walls(0, 1, 0, 8, 1, 8, 'oak_fence')
    s.put(4, 1, 8, 'fence_gate', **CARD('south'))
    s.box(1, 0, 1, 3, 0, 1, 'farmland', moisturized_amount=7)
    s.box(1, 1, 1, 3, 1, 1, 'carrots', growth=0)
    s.put(2, 0, 2, 'water')
    return s.finish()


def super_firin():
    s = Y.S('super_firin', 'Süper Fırın (8 fırın)', 'ciftlik', 10, 4, 5,
            'Üstteki 8 huniye eriyecek eşya, arkadaki 8 huniye yakıt koy; 8 fırın birlikte pişirir, alttaki huni hattı sandığa taşır.')
    s.box(0, 0, 0, 9, 0, 4, 'stone_bricks')
    s.box(1, 1, 2, 8, 1, 2, 'hopper', facing_direction=F['east'])
    _sandik(s, 9, 1, 2)
    s.box(1, 2, 2, 8, 2, 2, 'furnace', **CARD('north'))
    s.box(1, 3, 2, 8, 3, 2, 'hopper', facing_direction=F['down'])
    s.box(1, 2, 3, 8, 2, 3, 'hopper', facing_direction=F['north'])
    return s.finish()


FARMLAR = [otomatik_seker_kamisi, cicek_farmi, cimen_tohum_farmi, yosun_blogu_farmi, lav_farmi, sivri_damlatas_farmi,
           sonsuz_su, duz_tas_uretici, havuc_tarlasi, patates_tarlasi, pancar_tarlasi, bal_farmi, parlak_cilek_farmi,
           sarmasik_farmi, kaplumbaga_farmi, buz_farmi, kar_farmi, balik_tutma, hus_farmi, ladin_farmi, orman_agaci_farmi,
           kara_mese_farmi, kiraz_farmi, akasya_farmi, mangrov_farmi, domuz_agili, super_firin]
