"""Mimar farm kütüphanesi (v0.4.2): Bedrock kurallarına göre çizilmiş çiftlikler (yapilar.S ile).

Hepsi Bedrock'ta çalışacak biçimde düşünüldü ama **oyunda denenmedi**. Köylü/hayvan gerekenlerde canlıları yapı içermez:
Mimar bitirince söyler; köylüler Keşif'le getirilebilir (Keşif menüsü → Köylü getir, ya da Mimar → Organizatör → Keşif).
"""
import yapilar as Y

F = Y.FACING           # piston/huni/dağıtıcı yönü (sayı)
OBS = lambda d: {'minecraft:facing_direction': d}    # gözlemci yönü (yazı)
CARD = lambda d: {'minecraft:cardinal_direction': d}


def _toplama(s, x0, x1, z, y=0, sandik_x=None, yon='east'):
    """x0..x1 boyunca huni hattı ve uçta sandık."""
    s.box(x0, y, z, x1, y, z, 'hopper', facing_direction=F[yon])
    sx = (x1 + 1) if sandik_x is None else sandik_x
    s.put(sx, y, z, 'chest', **CARD('south'))


def bambu_farmi():
    s = Y.S('bambu_farmi', 'Otomatik Bambu Farmı', 'ciftlik', 12, 7, 5,
            'Gözlemci ve pistonlu bambu farmı; kesilen bambu su kanalından huniye, oradan sandığa akar.')
    s.box(0, 0, 0, 11, 0, 4, 'stone_bricks')
    s.box(0, 1, 2, 10, 1, 2, 'dirt')
    s.box(0, 2, 2, 10, 2, 2, 'bamboo', age_bit=False)
    s.box(0, 1, 3, 10, 1, 3, 'water')
    _toplama(s, 0, 10, 4, y=1)
    s.box(0, 1, 1, 10, 1, 1, 'stone_bricks')
    s.box(0, 4, 1, 10, 4, 1, 'piston', facing_direction=F['south'])
    s.box(0, 5, 1, 10, 5, 1, 'observer', **OBS('south'))
    s.box(0, 5, 2, 10, 5, 2, 'glass')
    s.box(0, 2, 1, 10, 3, 1, 'stone_bricks')
    s.box(0, 2, 4, 10, 5, 4, 'glass')
    return s.finish()


def _kavun(key, ad, sap, meyve):
    s = Y.S(key, ad, 'ciftlik', 13, 4, 6,
            f'{ad}: her sapın yanındaki boş toprakta {meyve} çıkınca gözlemci görür, piston kırar; huniler toplar.')
    s.box(0, 0, 0, 12, 0, 5, 'stone_bricks')
    s.box(0, 0, 2, 12, 0, 2, 'water')
    s.box(0, 1, 1, 12, 1, 1, 'farmland', moisturized_amount=7)
    s.box(0, 2, 1, 12, 2, 1, sap, growth=0)
    s.box(0, 1, 2, 12, 1, 2, 'dirt')
    s.box(0, 3, 2, 12, 3, 2, 'observer', **OBS('down'))
    s.box(0, 2, 3, 12, 2, 3, 'piston', facing_direction=F['north'])
    s.box(0, 1, 3, 12, 1, 3, 'stone_bricks')
    s.box(0, 1, 0, 12, 1, 0, 'hopper', facing_direction=F['east'])
    s.put(12, 1, 0, 'hopper', facing_direction=F['down'])
    s.put(12, 0, 0, 'chest', **CARD('south'))
    s.box(0, 2, 0, 12, 3, 0, 'glass')
    s.box(0, 3, 1, 12, 3, 1, 'glass')
    return s.finish()


def kavun_farmi():
    return _kavun('kavun_farmi', 'Otomatik Kavun Farmı', 'melon_stem', 'kavun')


def balkabagi_farmi():
    return _kavun('balkabagi_farmi', 'Otomatik Balkabağı Farmı', 'pumpkin_stem', 'balkabağı')


def kaktus_farmi():
    s = Y.S('kaktus_farmi', 'Kaktüs Farmı', 'ciftlik', 9, 6, 9,
            'Kumda dama düzeninde kaktüsler; büyüyünce yanındaki çite değip kırılır, düşen kaktüs su ile huniye akar.')
    s.box(0, 0, 0, 8, 0, 8, 'stone_bricks')
    s.box(1, 1, 1, 7, 1, 7, 'water')
    for x in range(1, 8, 2):
        for z in range(1, 8, 2):
            s.put(x, 1, z, 'sand')
            s.put(x, 2, z, 'cactus', age=0)
            s.put(x, 3, z + 1 if z < 7 else z - 1, 'oak_fence')
    s.walls(0, 1, 0, 8, 2, 8, 'glass')
    s.put(4, 0, 8, 'hopper', facing_direction=F['south'])
    s.put(4, 0, 9 - 1, 'hopper', facing_direction=F['down']) if False else None
    s.put(4, 1, 8, 'air')
    return s.finish()


def yosun_farmi():
    s = Y.S('yosun_farmi', 'Otomatik Yosun (Kelp) Farmı', 'ciftlik', 12, 7, 5,
            'Su altında yosun sırası; gözlemci büyümeyi görür, piston keser, yosun suyla huniye akar. Kurutulunca yakıt olur.')
    s.box(0, 0, 0, 11, 0, 4, 'stone_bricks')
    s.box(0, 1, 2, 10, 1, 2, 'dirt')
    s.box(0, 2, 2, 10, 5, 2, 'water')
    s.box(0, 2, 2, 10, 2, 2, 'kelp', kelp_age=0)
    s.box(0, 1, 3, 10, 1, 3, 'water')
    _toplama(s, 0, 10, 4, y=1)
    s.box(0, 1, 1, 10, 2, 1, 'stone_bricks')
    s.box(0, 3, 1, 10, 3, 1, 'piston', facing_direction=F['south'])
    s.box(0, 4, 1, 10, 4, 1, 'observer', **OBS('south'))
    s.box(0, 2, 3, 10, 6, 3, 'glass')
    s.box(0, 6, 1, 10, 6, 2, 'glass')
    return s.finish()


def tatli_meyve_bahcesi():
    s = Y.S('tatli_meyve_bahcesi', 'Tatlı Meyve Bahçesi', 'ciftlik', 9, 3, 9, 'Çitli tatlı meyve bahçesi; robot ya da sen toplarsın.')
    s.box(0, 0, 0, 8, 0, 8, 'grass_block')
    for x in range(1, 8, 2):
        for z in range(1, 8, 2):
            s.put(x, 1, z, 'sweet_berry_bush', growth=0)
    s.walls(0, 1, 0, 8, 1, 8, 'spruce_fence')
    s.put(4, 1, 8, 'spruce_fence_gate', **CARD('south'))
    return s.finish()


def kakao_farmi():
    s = Y.S('kakao_farmi', 'Kakao Farmı', 'ciftlik', 9, 6, 5, 'Orman kütüğü direkler ve çevresinde kakao çekirdekleri.')
    s.box(0, 0, 0, 8, 0, 4, 'grass_block')
    for x in (1, 4, 7):
        s.box(x, 1, 2, x, 5, 2, 'jungle_log', pillar_axis='y')
        for y in (2, 4):
            s.put(x, y, 1, 'cocoa', age=0, direction=0)
            s.put(x, y, 3, 'cocoa', age=0, direction=2)
    return s.finish()


def nether_sigili_farmi():
    s = Y.S('nether_sigili_farmi', 'Nether Siğili Farmı', 'ciftlik', 9, 3, 7, 'Ruh kumunda siğil sıraları (Nether’den getirilen siğille ekilir).')
    s.box(0, 0, 0, 8, 0, 6, 'nether_brick')
    s.box(1, 0, 1, 7, 0, 5, 'soul_sand')
    s.box(1, 1, 1, 7, 1, 5, 'nether_wart', age=0)
    s.box(1, 1, 3, 7, 1, 3, 'air')
    s.walls(0, 1, 0, 8, 1, 6, 'nether_brick_fence')
    return s.finish()


def mantar_farmi():
    s = Y.S('mantar_farmi', 'Mantar Farmı', 'ciftlik', 9, 4, 9, 'Karanlık oda, podzol zemin; kırmızı ve kahverengi mantar.')
    s.box(0, 0, 0, 8, 0, 8, 'stone_bricks')
    s.box(1, 0, 1, 7, 0, 7, 'podzol')
    for x in range(1, 8, 2):
        for z in range(1, 8, 2):
            s.put(x, 1, z, 'red_mushroom' if (x + z) % 4 == 2 else 'brown_mushroom')
    s.walls(0, 1, 0, 8, 2, 8, 'stone_bricks')
    s.box(0, 3, 0, 8, 3, 8, 'stone_bricks')
    s.put(4, 1, 0, 'air'); s.put(4, 2, 0, 'air')
    return s.finish()


def agac_farmi():
    s = Y.S('agac_farmi', 'Ağaç Farmı', 'ciftlik', 15, 2, 15, 'Aralıklı 9 meşe fidanı; Oduncu robot keser, yeniden diker.')
    s.box(0, 0, 0, 14, 0, 14, 'grass_block')
    for x in (2, 7, 12):
        for z in (2, 7, 12):
            s.put(x, 1, z, 'oak_sapling', age_bit=False)
    for (x, z) in ((0, 0), (14, 0), (0, 14), (14, 14)):
        s.put(x, 1, z, 'torch', torch_facing_direction='top')
    return s.finish()


def tas_uretici():
    s = Y.S('tas_uretici', 'Taş Üretici (Kırıktaş)', 'ciftlik', 7, 3, 3, 'Lav ve su buluşunca sürekli kırıktaş oluşur; Madenci kazar.')
    s.box(0, 0, 0, 6, 0, 2, 'stone_bricks')
    s.box(0, 1, 0, 6, 1, 0, 'stone_bricks'); s.box(0, 1, 2, 6, 1, 2, 'stone_bricks')
    s.put(0, 1, 1, 'lava'); s.put(1, 1, 1, 'air'); s.put(2, 1, 1, 'air'); s.put(3, 1, 1, 'air')
    s.put(5, 1, 1, 'water'); s.put(4, 1, 1, 'air'); s.put(6, 1, 1, 'stone_bricks')
    s.box(0, 2, 0, 6, 2, 2, 'glass'); s.put(3, 2, 1, 'air')
    return s.finish()


def bazalt_uretici():
    s = Y.S('bazalt_uretici', 'Bazalt Üretici', 'ciftlik', 5, 3, 3, 'Ruh toprağı üstünde lav mavi buza değince bazalt oluşur.')
    s.box(0, 0, 0, 4, 0, 2, 'stone_bricks')
    s.put(2, 0, 1, 'soul_soil')
    s.put(0, 1, 1, 'lava'); s.put(1, 1, 1, 'air'); s.put(2, 1, 1, 'air'); s.put(3, 1, 1, 'blue_ice')
    s.box(0, 1, 0, 4, 1, 0, 'stone_bricks'); s.box(0, 1, 2, 4, 1, 2, 'stone_bricks'); s.put(4, 1, 1, 'stone_bricks')
    s.box(0, 2, 0, 4, 2, 2, 'glass'); s.put(2, 2, 1, 'air')
    return s.finish()


def kemik_tozu_farmi():
    s = Y.S('kemik_tozu_farmi', 'Kemik Tozu Farmı (Kompost)', 'ciftlik', 7, 3, 4, 'Kompost kapları; üstteki huniye bitki koy, alttan kemik tozu sandığa akar.')
    s.box(0, 0, 0, 6, 0, 3, 'stone_bricks')
    s.put(0, 2, 1, 'chest', **CARD('south'))
    s.box(1, 2, 1, 5, 2, 1, 'hopper', facing_direction=F['down'])
    s.box(1, 1, 1, 5, 1, 1, 'composter', composter_fill_level=0)
    s.box(1, 0, 1, 5, 0, 1, 'hopper', facing_direction=F['east'])
    s.put(6, 0, 1, 'chest', **CARD('south'))
    return s.finish()


def tavuk_farmi():
    s = Y.S('tavuk_farmi', 'Tavuk ve Yumurta Farmı', 'ciftlik', 9, 3, 5,
            'Hunilerin üstündeki bölmelerde tavuklar yumurtlar; yumurtalar sandığa akar. Tavukları içine sen koy.')
    s.box(0, 0, 0, 8, 0, 4, 'stone_bricks')
    s.box(1, 1, 2, 7, 1, 2, 'hopper', facing_direction=F['east'])
    s.put(8, 1, 2, 'chest', **CARD('south'))
    s.walls(0, 1, 1, 8, 2, 3, 'glass')
    s.box(1, 2, 2, 7, 2, 2, 'air')
    s.put(8, 1, 2, 'chest', **CARD('south'))
    return s.finish()


def koyun_yun_farmi():
    s = Y.S('koyun_yun_farmi', 'Otomatik Yün Farmı', 'ciftlik', 7, 4, 7,
            'Koyun çimeni yiyince gözlemci görür, makaslı dağıtıcı kırpar; yün huniyle sandığa. Koyunu sen koy, dağıtıcıya makas koy.')
    s.box(0, 0, 0, 6, 0, 6, 'stone_bricks')
    s.put(3, 0, 3, 'grass_block')
    s.put(3, -0, 2, 'grass_block') if False else None
    s.put(2, 1, 3, 'dispenser', facing_direction=F['east'], triggered_bit=False)
    s.put(3, 2, 2, 'observer', **OBS('south')) if False else None
    s.put(3, -0, 4, 'grass_block') if False else None
    s.walls(1, 1, 1, 5, 2, 5, 'glass')
    s.put(2, 1, 3, 'dispenser', facing_direction=F['east'], triggered_bit=False)
    s.put(4, 0, 3, 'hopper', facing_direction=F['east'])
    s.put(5, 0, 3, 'chest', **CARD('south'))
    s.put(3, 0, 4, 'observer', **OBS('north'))
    return s.finish()


def inek_agili():
    s = Y.S('inek_agili', 'İnek ve Koyun Ağılı', 'ciftlik', 11, 3, 11, 'Çitli otlak, su yalağı ve saman; hayvanları sen getir.')
    s.box(0, 0, 0, 10, 0, 10, 'grass_block')
    s.walls(0, 1, 0, 10, 1, 10, 'oak_fence')
    s.put(5, 1, 10, 'fence_gate', **CARD('south'))
    s.box(1, 0, 1, 3, 0, 1, 'water')
    s.box(7, 1, 7, 8, 1, 8, 'hay_block', pillar_axis='y')
    return s.finish()


def demir_farmi():
    s = Y.S('demir_farmi', 'Demir Farmı (Bedrock, 3 köylü)', 'ciftlik', 11, 9, 11,
            'Üç köylü yatak ve iş bloklarıyla bölmede durur; golem ortadaki platformda doğar, lavla ölür, demir huniyle sandığa. '
            '3 köylü gerekir: Mimar bitirince Organizatör, Keşif’i köyden getirmeye gönderir.')
    s.box(0, 0, 0, 10, 0, 10, 'stone_bricks')
    # toplama: ortada huni + sandık
    s.put(5, 1, 5, 'hopper', facing_direction=F['down'])
    s.put(5, 0, 5, 'chest', **CARD('south'))
    # doğma platformu (golem): 5x5, çevresi su ile ortaya akar
    s.box(3, 1, 3, 7, 1, 7, 'stone_bricks'); s.put(5, 1, 5, 'hopper', facing_direction=F['down'])
    s.box(3, 2, 3, 7, 2, 7, 'water'); s.box(4, 2, 4, 6, 2, 6, 'air')
    s.walls(2, 1, 2, 8, 4, 8, 'glass')
    s.put(5, 4, 5, 'lava'); s.put(5, 3, 5, 'oak_sign') if False else s.put(5, 3, 5, 'air')
    # köylü bölmesi (üstte): 3 yatak + 3 besteci bloğu
    s.box(0, 6, 0, 10, 6, 10, 'stone_bricks')
    for i, x in enumerate((2, 5, 8)):
        s.put(x, 7, 2, 'bed', direction=Y.BEDDIR['south'], head_piece_bit=False)
        s.put(x, 7, 3, 'bed', direction=Y.BEDDIR['south'], head_piece_bit=True)
        s.put(x, 7, 6, 'composter', composter_fill_level=0)
    s.walls(0, 7, 0, 10, 8, 10, 'glass')
    return s.finish()


def ticaret_salonu():
    s = Y.S('ticaret_salonu', 'Ticaret Salonu (5 bölme)', 'ciftlik', 13, 4, 5,
            'Her bölmede bir iş bloğu; köylüleri bölmelere koyunca meslek alırlar. Köylüleri Keşif getirir.')
    s.box(0, 0, 0, 12, 0, 4, 'oak_planks')
    s.walls(0, 1, 0, 12, 3, 4, 'oak_planks')
    s.box(0, 3, 0, 12, 3, 4, 'oak_planks')
    istas = ['lectern', 'smithing_table', 'fletching_table', 'cartography_table', 'brewing_stand']
    for i, x in enumerate((2, 4, 6, 8, 10)):
        s.put(x, 1, 1, istas[i])
        s.box(x + 1, 1, 1, x + 1, 2, 2, 'glass')
        s.put(x, 2, 3, 'air'); s.put(x, 1, 3, 'air')
    s.box(1, 1, 3, 11, 2, 3, 'air')
    s.put(6, 1, 4, 'air'); s.put(6, 2, 4, 'air')
    return s.finish()


def koylu_uretme():
    s = Y.S('koylu_uretme', 'Köylü Üretme Farmı', 'ciftlik', 9, 5, 9,
            '2 köylü + yataklar + havuç tarlası (çiftçi köylü yiyecek atar); yavrular dışarıdaki kanala düşer. 2 köylü gerekir.')
    s.box(0, 0, 0, 8, 0, 8, 'stone_bricks')
    s.box(1, 1, 1, 7, 1, 7, 'farmland', moisturized_amount=7)
    s.put(4, 1, 4, 'water')
    s.box(1, 2, 1, 7, 2, 7, 'carrots', growth=0); s.put(4, 2, 4, 'composter', composter_fill_level=0)
    for x in (2, 4, 6):
        s.put(x, 3, 8, 'bed', direction=Y.BEDDIR['south'], head_piece_bit=False) if False else None
    s.walls(0, 1, 0, 8, 3, 8, 'glass')
    s.box(1, 3, 1, 7, 3, 1, 'oak_planks')
    s.put(2, 4, 1, 'bed', direction=Y.BEDDIR['east'], head_piece_bit=False)
    s.put(3, 4, 1, 'bed', direction=Y.BEDDIR['east'], head_piece_bit=True)
    s.put(5, 4, 1, 'bed', direction=Y.BEDDIR['east'], head_piece_bit=False)
    s.put(6, 4, 1, 'bed', direction=Y.BEDDIR['east'], head_piece_bit=True)
    return s.finish()


def otomatik_ekin():
    s = Y.S('otomatik_ekin', 'Otomatik Ekin Farmı (çiftçi köylü)', 'ciftlik', 11, 4, 11,
            'Çiftçi köylü ekinleri biçer, tekrar eker; fazlasını taşıyan köylünün altındaki huniler toplar. 2 köylü gerekir.')
    s.box(0, 0, 0, 10, 0, 10, 'stone_bricks')
    s.box(1, 1, 1, 9, 1, 9, 'farmland', moisturized_amount=7)
    s.put(5, 1, 5, 'water')
    s.box(1, 2, 1, 9, 2, 9, 'wheat', growth=0)
    s.put(5, 2, 5, 'composter', composter_fill_level=0)
    s.box(4, 1, 0, 6, 1, 0, 'hopper', facing_direction=F['east'])
    s.put(7, 1, 0, 'chest', **CARD('south'))
    s.walls(0, 2, 0, 10, 3, 10, 'glass')
    s.put(2, 2, 2, 'bed', direction=Y.BEDDIR['east'], head_piece_bit=False)
    s.put(3, 2, 2, 'bed', direction=Y.BEDDIR['east'], head_piece_bit=True)
    return s.finish()


def karanlik_oda():
    s = Y.S('karanlik_oda', 'Karanlık Oda Yaratık Farmı', 'ciftlik', 17, 26, 17,
            'Karanlık doğma alanı, su akıntıları ortadaki kuyuya taşır; 22 blok düşüşten sonra canı azalan yaratıklar tek vuruşla '
            'ölür (deneyim). Eşyalar huniyle sandığa.')
    c = 8
    s.box(0, 0, 0, 16, 0, 16, 'stone_bricks')
    # toplama odası
    s.put(c, 1, c, 'hopper', facing_direction=F['east']); s.put(c + 1, 1, c, 'chest', **CARD('south'))
    s.walls(c - 2, 1, c - 2, c + 2, 3, c + 2, 'glass'); s.put(c, 2, c - 2, 'air'); s.put(c, 3, c - 2, 'air')
    # düşüş kuyusu
    s.walls(c - 1, 4, c - 1, c + 1, 22, c + 1, 'stone_bricks')
    # doğma katı
    s.box(0, 23, 0, 16, 23, 16, 'stone_bricks')
    s.put(c, 23, c, 'air')
    for (x0, z0, x1, z1) in ((1, c, c - 1, c), (c + 1, c, 15, c), (c, 1, c, c - 1), (c, c + 1, c, 15)):
        s.box(x0, 24, z0, x1, 24, z1, 'air')
    for x in (1, 15):
        s.box(x, 24, 1, x, 24, 15, 'water') if False else None
    s.put(1, 24, c, 'water'); s.put(15, 24, c, 'water'); s.put(c, 24, 1, 'water'); s.put(c, 24, 15, 'water')
    s.walls(0, 24, 0, 16, 25, 16, 'stone_bricks')
    s.box(0, 25, 0, 16, 25, 16, 'stone_bricks')
    return s.finish()


FARMLAR = [bambu_farmi, kavun_farmi, balkabagi_farmi, kaktus_farmi, yosun_farmi, tatli_meyve_bahcesi, kakao_farmi,
           nether_sigili_farmi, mantar_farmi, agac_farmi, tas_uretici, bazalt_uretici, kemik_tozu_farmi, tavuk_farmi,
           koyun_yun_farmi, inek_agili, demir_farmi, ticaret_salonu, koylu_uretme, otomatik_ekin, karanlik_oda]
