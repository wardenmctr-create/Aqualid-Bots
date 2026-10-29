"""İnşaatçı robotun yapı kütüphanesi: küçük yapılardan End of Light mega çiftliğine.

Koordinatlar: x doğu, y yukarı, z güney. Yapının önü (girişi) +Z (güney) yüzünde.
Hücre: None = dokunma (mevcut blok kalır), 'air' = temizle, başka = blok.
Çıktı: src/scripts/yapi_data.js (palet + katman başına RLE) ve malzeme listeleri.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
VD = os.path.join(os.environ.get('AQUALIT_REF', os.path.join(HERE, '..', '..', 'ref')), 'vanilladata_modules') + '/'

_BLOCKS = None
_PROPS = None


def vanilla():
    global _BLOCKS, _PROPS
    if _BLOCKS is None:
        d = json.load(open(VD + 'mojang-blocks.json'))
        _BLOCKS = {b['name']: [p['name'] for p in b.get('properties', [])] for b in d['data_items']}
        _PROPS = {p['name']: [v['value'] for v in p.get('values', [])] for p in d['block_properties']}
    return _BLOCKS, _PROPS


# yönler: güney +Z, kuzey -Z, doğu +X, batı -X
STAIR = {'east': 0, 'west': 1, 'south': 2, 'north': 3}      # basamağın yükseldiği yön
TRAP = {'east': 0, 'west': 1, 'south': 2, 'north': 3}
FACING = {'down': 0, 'up': 1, 'north': 2, 'south': 3, 'west': 4, 'east': 5}
BEDDIR = {'south': 0, 'west': 1, 'north': 2, 'east': 3}
OPP = {'north': 'south', 'south': 'north', 'east': 'west', 'west': 'east'}
DV = {'north': (0, 0, -1), 'south': (0, 0, 1), 'east': (1, 0, 0), 'west': (-1, 0, 0)}

CONNECT = ('glass_pane', 'iron_bars', '_fence', 'stained_glass_pane')
NONFULL = ('air', 'torch', 'lantern', 'pane', 'fence', 'slab', 'stairs', 'door', 'trapdoor', 'carpet', 'flower', 'poppy',
           'dandelion', 'grass', 'ladder', 'bars', 'wall', 'sign', 'bed', 'button', 'plate', 'rail', 'wheat', 'carrots',
           'potatoes', 'beetroot', 'reeds', 'water', 'lava', 'chain', 'end_rod', 'campfire', 'sapling', 'vine', 'bell',
           'flower_pot', 'cauldron', 'anvil', 'lectern', 'hopper', 'composter', 'grindstone', 'bush', 'cornflower',
           'tulip', 'allium', 'orchid', 'daisy', 'bluet', 'lilac', 'peony', 'sunflower', 'rose_bush', 'redstone_wire')


def full(name):
    return name is not None and not any(k in name for k in NONFULL)


class S:
    def __init__(self, key, ad, kat, W, H, D, aciklama=''):
        self.key, self.ad, self.kat, self.W, self.H, self.D, self.aciklama = key, ad, kat, W, H, D, aciklama
        self.g = {}

    # ---------------- temel
    def put(self, x, y, z, name, **st):
        if 0 <= x < self.W and 0 <= y < self.H and 0 <= z < self.D:
            self.g[(x, y, z)] = (name, st)

    def get(self, x, y, z):
        v = self.g.get((x, y, z))
        return v[0] if v else None

    def box(self, x0, y0, z0, x1, y1, z1, name, **st):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            for y in range(min(y0, y1), max(y0, y1) + 1):
                for z in range(min(z0, z1), max(z0, z1) + 1):
                    self.put(x, y, z, name, **st)

    def air(self, x0, y0, z0, x1, y1, z1):
        self.box(x0, y0, z0, x1, y1, z1, 'air')

    def walls(self, x0, y0, z0, x1, y1, z1, name, **st):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(x, y, z0, name, **st)
                self.put(x, y, z1, name, **st)
            for z in range(z0, z1 + 1):
                self.put(x0, y, z, name, **st)
                self.put(x1, y, z, name, **st)

    def room(self, x0, y0, z0, x1, y1, z1, wall, floor=None, corner=None):
        """Duvarlar + taban, içi temiz hava."""
        self.air(x0 + 1, y0 + 1, z0 + 1, x1 - 1, y1, z1 - 1)
        self.walls(x0, y0 + 1, z0, x1, y1, z1, wall)
        if floor:
            self.box(x0, y0, z0, x1, y0, z1, floor)
        if corner:
            for (x, z) in ((x0, z0), (x0, z1), (x1, z0), (x1, z1)):
                self.box(x, y0 + 1, z, x, y1, z, corner, pillar_axis='y')

    # ---------------- parçalar
    def stairs(self, x, y, z, up, name, upside=False):
        self.put(x, y, z, name, weirdo_direction=STAIR[up], upside_down_bit=upside)

    def slab(self, x, y, z, name, top=False):
        self.put(x, y, z, name, **{'minecraft:vertical_half': 'top' if top else 'bottom'})

    def log(self, x, y, z, name, axis='y'):
        self.put(x, y, z, name, pillar_axis=axis)

    def door(self, x, y, z, face, name='spruce_door'):
        """face: kapının baktığı dış yön."""
        self.put(x, y, z, name, **{'minecraft:cardinal_direction': face, 'upper_block_bit': False})
        self.put(x, y + 1, z, name, **{'minecraft:cardinal_direction': face, 'upper_block_bit': True})

    def torch(self, x, y, z, face='top'):
        """face: meşalenin yaslandığı duvardan dışarı baktığı yön ya da 'top'."""
        self.put(x, y, z, 'torch', torch_facing_direction=face)

    def lantern(self, x, y, z, hanging=False, name='lantern'):
        self.put(x, y, z, name, hanging=hanging)

    def bed(self, x, y, z, toward='north'):
        """Ayak (x,y,z), baş yönü 'toward'."""
        dx, _, dz = DV[toward]
        self.put(x, y, z, 'bed', direction=BEDDIR[toward], head_piece_bit=False)
        self.put(x + dx, y, z + dz, 'bed', direction=BEDDIR[toward], head_piece_bit=True)

    def ladder(self, x, y0, y1, z, face):
        for y in range(y0, y1 + 1):
            self.put(x, y, z, 'ladder', facing_direction=FACING[face])

    def gable(self, x0, x1, z0, z1, y, stair, axis='x', fill=None, ridge=None, over=1):
        """Beşik çatı. axis='x': mahya X boyunca (eğimler güney/kuzey)."""
        if axis == 'x':
            depth = z1 - z0 + 1
            for i in range((depth + 1) // 2 + 0):
                zs, zn = z1 - i + over, z0 + i - over
                if zs < zn:
                    break
                yy = y + i
                for x in range(x0 - over, x1 + over + 1):
                    if zs == zn:
                        self.put(x, yy, zs, ridge or fill or stair.replace('_stairs', '_planks'))
                    else:
                        self.stairs(x, yy, zs, 'north', stair)
                        self.stairs(x, yy, zn, 'south', stair)
                # alın duvarları
                if fill:
                    for z in range(zn + 1, zs):
                        self.put(x0, yy, z, fill)
                        self.put(x1, yy, z, fill)
                    for x in range(x0 + 1, x1):
                        for z in range(zn + 1, zs):
                            if self.get(x, yy, z) is None:
                                self.put(x, yy, z, 'air')
        else:
            width = x1 - x0 + 1
            for i in range((width + 1) // 2 + 0):
                xe, xw = x1 - i + over, x0 + i - over
                if xe < xw:
                    break
                yy = y + i
                for z in range(z0 - over, z1 + over + 1):
                    if xe == xw:
                        self.put(xe, yy, z, ridge or fill or stair.replace('_stairs', '_planks'))
                    else:
                        self.stairs(xe, yy, z, 'west', stair)
                        self.stairs(xw, yy, z, 'east', stair)
                if fill:
                    for x in range(xw + 1, xe):
                        self.put(x, yy, z0, fill)
                        self.put(x, yy, z1, fill)
                    for z in range(z0 + 1, z1):
                        for x in range(xw + 1, xe):
                            if self.get(x, yy, z) is None:
                                self.put(x, yy, z, 'air')

    def pyramid(self, x0, x1, z0, z1, y, stair, top=None):
        i = 0
        while x0 + i <= x1 - i and z0 + i <= z1 - i:
            a, b, c, d = x0 + i, x1 - i, z0 + i, z1 - i
            yy = y + i
            if a == b or c == d:
                self.box(a, yy, c, b, yy, d, top or stair.replace('_stairs', '_planks'))
                break
            for x in range(a, b + 1):
                self.stairs(x, yy, d, 'north', stair)
                self.stairs(x, yy, c, 'south', stair)
            for z in range(c + 1, d):
                self.stairs(b, yy, z, 'west', stair)
                self.stairs(a, yy, z, 'east', stair)
            i += 1

    def window(self, x, y, z, name='glass_pane'):
        self.put(x, y, z, name)

    def finish(self):
        """Cam/çit/demir parmaklık bağlantıları ve duvar direkleri."""
        for (x, y, z), (name, st) in list(self.g.items()):
            if any(k in name for k in CONNECT):
                for d, (dx, _, dz) in DV.items():
                    n = self.get(x + dx, y, z + dz)
                    ok = n is not None and (full(n) or any(k in n for k in CONNECT) or 'fence_gate' in n)
                    if any(k in name for k in ('_fence',)) and n and 'pane' in n:
                        ok = False
                    st[f'minecraft:connection_{d}'] = bool(ok)
            elif name.endswith('_wall'):
                cons = {}
                for d, (dx, _, dz) in DV.items():
                    n = self.get(x + dx, y, z + dz)
                    cons[d] = n is not None and (full(n) or n.endswith('_wall'))
                    st[f'wall_connection_type_{d}'] = 'short' if cons[d] else 'none'
                straight = (cons['north'] and cons['south'] and not cons['east'] and not cons['west']) or \
                           (cons['east'] and cons['west'] and not cons['north'] and not cons['south'])
                above = self.get(x, y + 1, z)
                st['wall_post_bit'] = (not straight) or (above is not None and above != 'air')
        return self


# ====================================================================== yapılar
def minik_kulube():
    s = S('minik_kulube', 'Minik Kulübe', 'kucuk', 7, 7, 7, 'Tek odalı, yatağı ve meşalesi olan sıcak bir kulübe.')
    s.box(0, 0, 0, 6, 0, 6, 'cobblestone')
    s.room(1, 0, 1, 5, 3, 5, 'oak_planks', 'oak_planks', corner='oak_log')
    s.door(3, 1, 5, 'south')
    s.window(1, 2, 3); s.window(5, 2, 3); s.window(3, 2, 1)
    s.gable(1, 5, 1, 5, 4, 'spruce_stairs', axis='x', fill='oak_planks', over=0)
    s.bed(2, 1, 3, 'north')
    s.put(4, 1, 2, 'crafting_table')
    s.torch(4, 2, 4, 'top') if False else s.torch(4, 3, 2, 'south')
    s.put(4, 1, 4, 'chest', **{'minecraft:cardinal_direction': 'west'})
    s.torch(3, 3, 6, 'south') if False else s.torch(4, 2, 6, 'south')
    return s.finish()


def kamp_alani():
    s = S('kamp_alani', 'Kamp Ateşi Alanı', 'kucuk', 7, 3, 7, 'Kamp ateşi, kütük banklar ve fenerler.')
    s.box(0, 0, 0, 6, 0, 6, 'grass_path')
    s.put(3, 1, 3, 'campfire', **{'minecraft:cardinal_direction': 'south'})
    for x in (1, 2, 4, 5):
        pass
    s.log(1, 1, 2, 'stripped_oak_log', 'z'); s.log(1, 1, 3, 'stripped_oak_log', 'z'); s.log(1, 1, 4, 'stripped_oak_log', 'z')
    s.log(5, 1, 2, 'stripped_oak_log', 'z'); s.log(5, 1, 3, 'stripped_oak_log', 'z'); s.log(5, 1, 4, 'stripped_oak_log', 'z')
    s.log(2, 1, 5, 'stripped_oak_log', 'x'); s.log(3, 1, 5, 'stripped_oak_log', 'x'); s.log(4, 1, 5, 'stripped_oak_log', 'x')
    for (x, z) in ((0, 0), (6, 0), (0, 6), (6, 6)):
        s.put(x, 1, z, 'oak_fence')
        s.lantern(x, 2, z)
    return s.finish()


def koy_kuyusu():
    s = S('koy_kuyusu', 'Köy Kuyusu', 'kucuk', 6, 6, 6, 'Köylerdeki gibi taş kuyu, içinde su.')
    s.box(0, 0, 0, 5, 0, 5, 'cobblestone')
    s.walls(1, 1, 1, 4, 1, 4, 'cobblestone')
    s.box(2, 0, 2, 3, 0, 3, 'water')
    s.box(2, 1, 2, 3, 1, 3, 'water')
    for (x, z) in ((1, 1), (4, 1), (1, 4), (4, 4)):
        s.box(x, 2, z, x, 3, z, 'oak_fence')
    s.box(1, 4, 1, 4, 4, 4, 'cobblestone_slab')
    s.lantern(2, 3, 2, hanging=True)
    return s.finish()


def lamba_diregi():
    s = S('lamba_diregi', 'Fener Direği', 'kucuk', 3, 5, 1, 'Yol kenarı için demir fenerli direk.')
    s.put(1, 0, 0, 'stone_bricks')
    s.box(1, 1, 0, 1, 3, 0, 'dark_oak_fence')
    s.put(0, 3, 0, 'dark_oak_fence'); s.put(2, 3, 0, 'dark_oak_fence')
    s.lantern(0, 2, 0, hanging=True); s.lantern(2, 2, 0, hanging=True)
    s.put(1, 4, 0, 'dark_oak_slab', **{'minecraft:vertical_half': 'bottom'})
    return s.finish()


def cicek_bahcesi():
    s = S('cicek_bahcesi', 'Çiçek Bahçesi', 'kucuk', 9, 2, 9, 'Çitle çevrili, taş yollu renkli bahçe.')
    s.box(0, 0, 0, 8, 0, 8, 'grass_block')
    s.box(4, 0, 0, 4, 0, 8, 'grass_path'); s.box(0, 0, 4, 8, 0, 4, 'grass_path')
    s.walls(0, 1, 0, 8, 1, 8, 'oak_fence')
    s.put(4, 1, 8, 'oak_fence_gate', **{'minecraft:cardinal_direction': 'south'})
    s.put(4, 1, 0, 'air')
    flowers = ['poppy', 'dandelion', 'cornflower', 'allium', 'azure_bluet', 'oxeye_daisy', 'pink_tulip', 'red_tulip']
    i = 0
    for x in range(1, 8):
        for z in range(1, 8):
            if x != 4 and z != 4:
                s.put(x, 1, z, flowers[i % len(flowers)])
                i += 1
    return s.finish()


def cesme():
    s = S('cesme', 'Çeşme', 'kucuk', 9, 5, 9, 'Ortası su dolu, fenerli taş çeşme.')
    s.box(0, 0, 0, 8, 0, 8, 'stone_bricks')
    s.walls(1, 1, 1, 7, 1, 7, 'stone_brick_slab', **{'minecraft:vertical_half': 'bottom'})
    s.box(2, 1, 2, 6, 1, 6, 'water')
    s.box(4, 1, 4, 4, 2, 4, 'stone_bricks')
    s.put(4, 3, 4, 'water')
    s.put(4, 4, 4, 'air')
    for (x, z) in ((0, 0), (8, 0), (0, 8), (8, 8)):
        s.put(x, 1, z, 'stone_brick_wall')
        s.lantern(x, 2, z)
    return s.finish()


def ahsap_ev():
    s = S('ahsap_ev', 'Ahşap Ev', 'ev', 9, 9, 9, 'Bacalı, iki pencereli klasik ahşap ev.')
    s.box(0, 0, 0, 8, 0, 8, 'cobblestone')
    s.room(1, 0, 1, 7, 4, 7, 'oak_planks', 'spruce_planks', corner='oak_log')
    s.door(4, 1, 7, 'south')
    for x in (2, 6):
        s.window(x, 2, 7); s.window(x, 2, 1)
    s.window(1, 2, 4); s.window(7, 2, 4)
    s.gable(1, 7, 1, 7, 5, 'dark_oak_stairs', axis='x', fill='oak_planks', over=1)
    s.box(6, 5, 2, 6, 8, 2, 'brick_block')
    s.bed(2, 1, 3, 'north'); s.put(6, 1, 2, 'crafting_table'); s.put(6, 1, 3, 'furnace', **{'minecraft:cardinal_direction': 'west'})
    s.put(2, 1, 6, 'chest', **{'minecraft:cardinal_direction': 'east'})
    s.torch(4, 3, 2, 'south'); s.torch(3, 2, 8, 'south'); s.torch(5, 2, 8, 'south')
    s.put(4, 0, 8, 'oak_stairs', weirdo_direction=STAIR['north'])
    return s.finish()


def iki_katli_ev():
    s = S('iki_katli_ev', 'İki Katlı Ev', 'ev', 11, 13, 11, 'Taş temelli, balkonlu iki katlı ev.')
    s.box(0, 0, 0, 10, 0, 10, 'stone_bricks')
    s.room(1, 0, 1, 9, 4, 9, 'cobblestone', 'oak_planks', corner='spruce_log')
    s.box(1, 5, 1, 9, 5, 9, 'spruce_planks')
    s.room(1, 5, 1, 9, 9, 9, 'oak_planks', None, corner='spruce_log')
    s.door(5, 1, 9, 'south')
    for y in (2, 7):
        for x in (3, 7):
            s.window(x, y, 9); s.window(x, y, 1)
        s.window(1, y, 5); s.window(9, y, 5)
    s.gable(1, 9, 1, 9, 10, 'spruce_stairs', axis='x', fill='oak_planks', over=1)
    # balkon
    s.box(3, 5, 10, 7, 5, 10, 'spruce_planks')
    s.box(3, 6, 10, 7, 6, 10, 'spruce_fence')
    s.door(5, 6, 9, 'south')
    s.ladder(2, 1, 5, 2, 'south')
    s.put(2, 5, 2, 'air')
    s.bed(7, 6, 3, 'north'); s.bed(6, 6, 3, 'north')
    s.put(8, 1, 2, 'crafting_table'); s.put(8, 1, 3, 'furnace', **{'minecraft:cardinal_direction': 'west'})
    s.put(8, 1, 4, 'chest', **{'minecraft:cardinal_direction': 'west'})
    s.put(2, 6, 8, 'bookshelf'); s.put(3, 6, 8, 'bookshelf')
    s.torch(5, 3, 2, 'south'); s.torch(5, 8, 2, 'south'); s.torch(4, 2, 10, 'south'); s.torch(6, 2, 10, 'south')
    return s.finish()


def tas_ev():
    s = S('tas_ev', 'Taş Ev', 'ev', 9, 8, 11, 'Sağlam taş tuğla duvarlı, ahşap çatılı ev.')
    s.box(0, 0, 0, 8, 0, 10, 'cobblestone')
    s.room(1, 0, 1, 7, 4, 9, 'stone_bricks', 'spruce_planks', corner='polished_andesite')
    s.door(4, 1, 9, 'south', 'dark_oak_door')
    for z in (3, 6):
        s.window(1, 2, z); s.window(7, 2, z)
    s.window(2, 2, 9); s.window(6, 2, 9)
    s.gable(1, 7, 1, 9, 5, 'dark_oak_stairs', axis='z', fill='stone_bricks', over=1)
    s.put(2, 1, 2, 'crafting_table'); s.put(3, 1, 2, 'furnace', **{'minecraft:cardinal_direction': 'south'})
    s.bed(6, 1, 3, 'north')
    s.torch(4, 3, 2, 'south'); s.torch(3, 2, 10, 'south'); s.torch(5, 2, 10, 'south')
    return s.finish()


def col_evi():
    s = S('col_evi', 'Çöl Evi', 'ev', 9, 6, 9, 'Düz damlı kumtaşı ev, çatıda oturma yeri.')
    s.box(0, 0, 0, 8, 0, 8, 'sandstone')
    s.room(1, 0, 1, 7, 3, 7, 'sandstone', 'smooth_sandstone', corner='cut_sandstone')
    s.box(1, 4, 1, 7, 4, 7, 'smooth_sandstone')
    s.walls(1, 5, 1, 7, 5, 7, 'sandstone_slab', **{'minecraft:vertical_half': 'bottom'})
    s.door(4, 1, 7, 'south', 'jungle_door')
    s.window(2, 2, 7); s.window(6, 2, 7); s.window(1, 2, 4); s.window(7, 2, 4)
    s.ladder(2, 1, 4, 2, 'south')
    s.put(2, 4, 2, 'air')
    s.bed(5, 1, 3, 'north'); s.put(6, 1, 6, 'barrel', facing_direction=FACING['up'])
    s.torch(4, 3, 6, 'north')
    return s.finish()


def iglo():
    s = S('iglo', 'İglo', 'ev', 9, 6, 11, 'Kar bloklarından kubbe, buz pencereli.')
    import math
    cx, cz = 4, 4
    for x in range(9):
        for z in range(9):
            for y in range(6):
                r = math.sqrt((x - cx) ** 2 + (z - cz) ** 2 + (y * 1.15) ** 2)
                if 3.3 <= r <= 4.4:
                    s.put(x, y, z, 'snow')
                elif r < 3.3:
                    s.put(x, y, z, 'air')
    s.box(0, 0, 0, 8, 0, 8, 'snow')
    s.box(3, 0, 8, 5, 2, 10, 'snow')
    s.air(4, 1, 8, 4, 2, 10)
    s.put(4, 1, 7, 'air'); s.put(4, 2, 7, 'air')
    s.put(1, 2, 4, 'ice'); s.put(7, 2, 4, 'ice')
    s.box(2, 0, 2, 6, 0, 6, 'white_carpet') if False else None
    s.bed(3, 1, 3, 'north'); s.put(5, 1, 2, 'furnace', **{'minecraft:cardinal_direction': 'south'})
    s.torch(5, 2, 5, 'top') if False else s.lantern(5, 1, 5)
    return s.finish()


def cadi_kulubesi():
    s = S('cadi_kulubesi', 'Cadı Kulübesi', 'ev', 7, 9, 9, 'Bataklık tarzı, direkler üstünde ladin kulübe.')
    for (x, z) in ((0, 1), (6, 1), (0, 7), (6, 7)):
        s.box(x, 0, z, x, 2, z, 'oak_log', pillar_axis='y')
    s.box(0, 3, 0, 6, 3, 8, 'spruce_planks')
    s.room(0, 3, 1, 6, 6, 7, 'spruce_planks', None, corner='oak_log')
    s.air(1, 4, 2, 5, 6, 6)
    s.door(3, 4, 7, 'south')
    s.window(0, 5, 4); s.window(6, 5, 4); s.window(3, 5, 1)
    s.gable(0, 6, 1, 7, 7, 'spruce_stairs', axis='z', fill='spruce_planks', over=0)
    s.put(2, 4, 2, 'cauldron'); s.put(4, 4, 2, 'crafting_table'); s.put(5, 4, 5, 'flower_pot')
    s.box(2, 0, 8, 4, 0, 8, 'air')
    for y in range(0, 3):
        s.put(3, y, 8, 'ladder', facing_direction=FACING['south']) if False else None
    s.ladder(3, 0, 2, 8, 'south') if False else None
    return s.finish()


def demirci():
    s = S('demirci', 'Demirci', 'koy', 11, 8, 9, 'Örs, yüksek fırın ve demirci masasıyla köy demircisi.')
    s.box(0, 0, 0, 10, 0, 8, 'cobblestone')
    s.room(0, 0, 0, 6, 4, 8, 'cobblestone', 'cobblestone', corner='oak_log')
    s.door(3, 1, 8, 'south')
    s.window(0, 2, 4); s.window(6, 2, 2); s.window(6, 2, 6)
    s.gable(0, 6, 0, 8, 5, 'stone_brick_stairs', axis='z', fill='cobblestone', over=0)
    # açık atölye
    for (x, z) in ((10, 0), (10, 8)):
        s.box(x, 1, z, x, 3, z, 'oak_log', pillar_axis='y')
    s.box(7, 4, 0, 10, 4, 8, 'oak_slab', **{'minecraft:vertical_half': 'bottom'})
    s.put(8, 1, 2, 'anvil', **{'minecraft:cardinal_direction': 'north'})
    s.put(8, 1, 4, 'blast_furnace', **{'minecraft:cardinal_direction': 'east'})
    s.put(8, 1, 6, 'smithing_table'); s.put(9, 1, 6, 'grindstone', attachment='standing', direction=0)
    s.put(2, 1, 2, 'chest', **{'minecraft:cardinal_direction': 'south'}); s.put(4, 1, 2, 'furnace', **{'minecraft:cardinal_direction': 'south'})
    s.lantern(8, 3, 4, hanging=True) if False else s.torch(3, 3, 1, 'south')
    return s.finish()


def kutuphane():
    s = S('kutuphane', 'Kütüphane', 'koy', 11, 9, 13, 'Kitaplıklarla dolu, büyü masası köşeli kütüphane.')
    s.box(0, 0, 0, 10, 0, 12, 'cobblestone')
    s.room(1, 0, 1, 9, 5, 11, 'oak_planks', 'spruce_planks', corner='stripped_oak_log')
    s.door(5, 1, 11, 'south')
    for z in (3, 6, 9):
        s.window(1, 3, z); s.window(9, 3, z)
    s.window(3, 3, 11); s.window(7, 3, 11)
    for x in range(2, 9):
        for y in (1, 2):
            s.put(x, y, 2, 'bookshelf')
    for z in range(4, 10, 2):
        for x in (3, 4, 6, 7):
            s.put(x, 1, z, 'bookshelf')
    s.put(5, 1, 7, 'lectern', **{'minecraft:cardinal_direction': 'south'})
    s.gable(1, 9, 1, 11, 6, 'spruce_stairs', axis='z', fill='oak_planks', over=1)
    s.torch(5, 4, 2, 'south'); s.torch(2, 4, 6, 'east'); s.torch(8, 4, 6, 'west')
    return s.finish()


def ambar():
    s = S('ambar', 'Ambar', 'koy', 11, 10, 15, 'Saman balyalı büyük çiftlik ambarı.')
    s.box(0, 0, 0, 10, 0, 14, 'cobblestone')
    s.room(1, 0, 1, 9, 5, 13, 'spruce_planks', 'oak_planks', corner='spruce_log')
    s.air(4, 1, 13, 6, 3, 13)
    s.box(4, 4, 13, 6, 4, 13, 'spruce_planks')
    s.gable(1, 9, 1, 13, 6, 'dark_oak_stairs', axis='z', fill='spruce_planks', over=1)
    for x in (2, 3, 7, 8):
        for z in range(2, 6):
            s.put(x, 1, z, 'hay_block', pillar_axis='y')
    s.box(2, 2, 2, 3, 2, 5, 'hay_block', pillar_axis='y')
    s.window(1, 3, 7); s.window(9, 3, 7); s.window(1, 3, 10); s.window(9, 3, 10)
    s.put(8, 1, 11, 'composter'); s.put(2, 1, 11, 'barrel', facing_direction=FACING['up'])
    s.torch(5, 4, 2, 'south')
    return s.finish()


def yel_degirmeni():
    s = S('yel_degirmeni', 'Yel Değirmeni', 'koy', 9, 17, 10, 'Yünden kanatlı, taş gövdeli yel değirmeni.')
    s.box(1, 0, 1, 7, 0, 7, 'cobblestone')
    s.room(1, 0, 1, 7, 6, 7, 'cobblestone', 'cobblestone')
    s.room(2, 6, 2, 6, 10, 6, 'spruce_planks', 'spruce_planks', corner='spruce_log')
    s.door(4, 1, 7, 'south')
    s.pyramid(2, 6, 2, 6, 11, 'dark_oak_stairs')
    s.ladder(2, 1, 9, 2, 'south')
    s.put(2, 6, 2, 'air')
    # kanatlar (önde, z=7..8): göbek + 4 kol
    hub = (4, 9, 8)
    s.put(4, 9, 7, 'oak_log', pillar_axis='z'); s.put(*hub, 'oak_log', pillar_axis='z')
    for i in range(1, 6):
        s.put(4, 9 + i, 9 - 1 + 1, 'white_wool') if False else None
        s.put(4, 9 + i, 8, 'white_wool'); s.put(4, 9 - i, 8, 'white_wool') if 9 - i >= 1 else None
        s.put(4 + i, 9, 8, 'white_wool') if 4 + i < 9 else None
        s.put(4 - i, 9, 8, 'white_wool') if 4 - i >= 0 else None
    s.window(4, 3, 7) if False else s.window(1, 3, 4)
    s.window(7, 3, 4)
    return s.finish()


def gozetleme_kulesi():
    s = S('gozetleme_kulesi', 'Gözetleme Kulesi', 'kule', 7, 17, 7, 'Merdivenli, tepesi çitli ahşap kule.')
    for (x, z) in ((1, 1), (5, 1), (1, 5), (5, 5)):
        s.box(x, 0, z, x, 12, z, 'spruce_log', pillar_axis='y')
    s.box(0, 12, 0, 6, 12, 6, 'spruce_planks')
    s.walls(0, 13, 0, 6, 13, 6, 'spruce_fence')
    s.put(3, 12, 1, 'air')
    s.ladder(3, 0, 12, 2, 'south') if False else None
    s.box(3, 0, 1, 3, 11, 1, 'spruce_planks')
    s.ladder(3, 1, 13, 2, 'south')
    s.put(3, 12, 2, 'ladder', facing_direction=FACING['south'])
    for (x, z) in ((0, 0), (6, 0), (0, 6), (6, 6)):
        s.box(x, 14, z, x, 14, z, 'spruce_fence')
        s.put(x, 15, z, 'torch', torch_facing_direction='top')
    s.pyramid(0, 6, 0, 6, 15, 'spruce_stairs') if False else s.box(1, 15, 1, 5, 15, 5, 'spruce_slab', **{'minecraft:vertical_half': 'bottom'})
    return s.finish()


def deniz_feneri():
    s = S('deniz_feneri', 'Deniz Feneri', 'kule', 9, 25, 9, 'Kırmızı-beyaz çizgili, tepesinde parlayan ışık.')
    import math
    cx = cz = 4
    for y in range(0, 20):
        r = 3.6 - y * 0.06
        for x in range(9):
            for z in range(9):
                d = math.hypot(x - cx, z - cz)
                if r - 1 <= d <= r:
                    s.put(x, y, z, 'red_concrete' if (y // 3) % 2 else 'white_concrete')
                elif d < r - 1:
                    s.put(x, y, z, 'air')
    s.box(1, 0, 1, 7, 0, 7, 'stone_bricks')
    s.door(4, 1, 8, 'south', 'iron_door') if False else s.door(4, 1, 7, 'south', 'spruce_door')
    s.put(4, 1, 8, 'air'); s.put(4, 2, 8, 'air')
    s.ladder(4, 1, 19, 2, 'south')
    s.box(1, 20, 1, 7, 20, 7, 'smooth_stone')
    s.walls(1, 21, 1, 7, 21, 7, 'iron_bars')
    s.box(3, 21, 3, 5, 22, 5, 'glass')
    s.put(4, 21, 4, 'glowstone'); s.put(4, 22, 4, 'sea_lantern')
    s.pyramid(2, 6, 2, 6, 23, 'stone_brick_stairs', 'smooth_stone')
    s.put(4, 20, 2, 'air')
    return s.finish()


def yagmaci_kulesi():
    s = S('yagmaci_kulesi', 'Yağmacı Kulesi', 'kule', 11, 24, 11, 'Karakol tarzı koyu meşe gözetleme kulesi.')
    s.box(0, 0, 0, 10, 0, 10, 'cobblestone')
    for y0 in (0, 6, 12):
        s.room(1, y0, 1, 9, y0 + 5, 9, 'dark_oak_planks', 'dark_oak_planks' if y0 else 'cobblestone', corner='dark_oak_log')
    s.door(5, 1, 9, 'south', 'dark_oak_door')
    for y in (3, 9, 15):
        s.window(1, y, 5, 'dark_oak_fence'); s.window(9, y, 5, 'dark_oak_fence'); s.window(5, y, 1, 'dark_oak_fence')
    s.ladder(2, 1, 17, 2, 'south')
    s.put(2, 6, 2, 'air'); s.put(2, 12, 2, 'air'); s.put(2, 18, 2, 'air')
    s.box(0, 18, 0, 10, 18, 10, 'dark_oak_planks')
    s.walls(0, 19, 0, 10, 19, 10, 'dark_oak_fence')
    s.put(2, 18, 2, 'air')
    s.pyramid(0, 10, 0, 10, 20, 'dark_oak_stairs')
    s.torch(5, 4, 2, 'south'); s.torch(5, 10, 2, 'south'); s.torch(5, 16, 2, 'south')
    return s.finish()


def kucuk_kale():
    s = S('kucuk_kale', 'Küçük Kale', 'kule', 23, 14, 23, 'Dört kuleli, mazgallı surları ve kapısı olan taş kale.')
    W = 23
    s.box(0, 0, 0, W - 1, 0, W - 1, 'stone_bricks')
    s.walls(2, 1, 2, W - 3, 7, W - 3, 'stone_bricks')
    s.walls(2, 8, 2, W - 3, 8, W - 3, 'stone_brick_wall')
    s.box(3, 7, 3, W - 4, 7, W - 4, 'air')
    for x in range(3, W - 3):
        for z in (3, W - 4):
            s.put(x, 7, z, 'stone_brick_slab', **{'minecraft:vertical_half': 'bottom'})
    for z in range(3, W - 3):
        for x in (3, W - 4):
            s.put(x, 7, z, 'stone_brick_slab', **{'minecraft:vertical_half': 'bottom'})
    for (x0, z0) in ((0, 0), (W - 6, 0), (0, W - 6), (W - 6, W - 6)):
        s.room(x0, 0, z0, x0 + 5, 10, z0 + 5, 'cobblestone', 'cobblestone')
        s.walls(x0, 11, z0, x0 + 5, 11, z0 + 5, 'cobblestone_wall')
        s.box(x0 + 1, 10, z0 + 1, x0 + 4, 10, z0 + 4, 'spruce_planks')
        s.ladder(x0 + 2, 1, 10, z0 + 1, 'south')
        s.put(x0 + 2, 10, z0 + 1, 'ladder', facing_direction=FACING['south'])
        s.torch(x0 + 3, 4, z0 + 1, 'south')
    # kapı
    c = W // 2
    s.air(c - 1, 1, W - 3, c + 1, 4, W - 3)
    s.box(c - 1, 1, W - 2, c + 1, 1, W - 1, 'grass_path') if False else None
    for x in (c - 2, c + 2):
        s.box(x, 1, W - 2, x, 6, W - 2, 'stone_bricks')
    s.box(c - 2, 5, W - 2, c + 2, 6, W - 2, 'stone_bricks')
    s.torch(c - 2, 3, W - 1, 'south'); s.torch(c + 2, 3, W - 1, 'south')
    # avluda kuyu ve ağaç yerine fener
    s.walls(c - 1, 1, c - 1, c + 1, 1, c + 1, 'cobblestone')
    s.put(c, 1, c, 'water')
    return s.finish()


def end_kulesi():
    s = S('end_kulesi', 'End Şehri Kulesi', 'kule', 11, 32, 11, 'Purpur bloklu, end çubuklu End şehri tarzı kule.')
    s.box(1, 0, 1, 9, 0, 9, 'end_bricks')
    for seg, (y0, half) in enumerate(((0, 4), (9, 3), (17, 4), (24, 3))):
        a, b = 5 - half, 5 + half
        s.room(a, y0, a, b, y0 + 7, b, 'purpur_block', 'purpur_block', corner='purpur_pillar')
        s.box(a, y0 + 8, a, b, y0 + 8, b, 'purpur_block') if seg < 3 else None
        for (x, z) in ((a, a), (b, a), (a, b), (b, b)):
            s.put(x, y0 + 8, z, 'purpur_stairs', weirdo_direction=0) if False else None
        s.window(5, y0 + 3, b, 'magenta_stained_glass') if False else s.put(5, y0 + 3, b, 'magenta_stained_glass')
        s.put(a, y0 + 3, 5, 'magenta_stained_glass'); s.put(b, y0 + 3, 5, 'magenta_stained_glass')
        s.put(5, y0 + 6, 5, 'end_rod', facing_direction=FACING['down'])
    s.door(5, 1, 9, 'south', 'iron_door') if False else s.put(5, 1, 9, 'air')
    s.put(5, 2, 9, 'air')
    s.ladder(5, 1, 31, 6, 'south') if False else None
    for y in range(1, 31):
        if s.get(5, y, 7) in (None, 'air'):
            s.put(5, y, 7, 'ladder', facing_direction=FACING['north'])
        if s.get(5, y, 8) in (None, 'air', 'ladder'):
            s.put(5, y, 8, 'purpur_block')
    s.pyramid(2, 8, 2, 8, 31, 'purpur_stairs', 'purpur_block') if False else s.box(3, 31, 3, 7, 31, 7, 'purpur_slab', **{'minecraft:vertical_half': 'bottom'})
    for (x, z) in ((2, 2), (8, 2), (2, 8), (8, 8)):
        s.put(x, 25, z, 'end_rod', facing_direction=FACING['up'])
    return s.finish()


def bugday_tarlasi():
    s = S('bugday_tarlasi', 'Buğday Tarlası', 'ciftlik', 11, 3, 11, 'Ortada su, çevresi çitli 9x9 buğday tarlası.')
    s.box(0, 0, 0, 10, 0, 10, 'oak_log', pillar_axis='x')
    s.box(1, 0, 1, 9, 0, 9, 'farmland', moisturized_amount=7)
    s.put(5, 0, 5, 'water')
    s.box(1, 1, 1, 9, 1, 9, 'wheat', growth=0)
    s.put(5, 1, 5, 'oak_slab', **{'minecraft:vertical_half': 'bottom'}) if False else s.put(5, 1, 5, 'air')
    s.walls(0, 1, 0, 10, 1, 10, 'oak_fence')
    s.put(5, 1, 10, 'oak_fence_gate', **{'minecraft:cardinal_direction': 'south'})
    for (x, z) in ((0, 0), (10, 0), (0, 10), (10, 10)):
        s.put(x, 2, z, 'torch', torch_facing_direction='top')
    return s.finish()


def hayvan_agili():
    s = S('hayvan_agili', 'Hayvan Ağılı', 'ciftlik', 13, 6, 13, 'Çitli ağıl, saman yığını, yemlik ve küçük çatı.')
    s.box(0, 0, 0, 12, 0, 12, 'grass_block')
    s.walls(0, 1, 0, 12, 1, 12, 'spruce_fence')
    s.put(6, 1, 12, 'spruce_fence_gate', **{'minecraft:cardinal_direction': 'south'})
    for (x, z) in ((1, 1), (5, 1), (1, 4), (5, 4)):
        s.box(x, 1, z, x, 3, z, 'spruce_fence')
    s.box(1, 4, 1, 5, 4, 4, 'spruce_slab', **{'minecraft:vertical_half': 'bottom'})
    s.box(2, 1, 2, 4, 1, 3, 'hay_block', pillar_axis='y')
    s.box(8, 1, 2, 10, 1, 2, 'composter')
    s.box(8, 0, 9, 10, 0, 10, 'water')
    for (x, z) in ((0, 0), (12, 0), (0, 12), (12, 12)):
        s.put(x, 2, z, 'torch', torch_facing_direction='top')
    return s.finish()


def seker_kamisi():
    s = S('seker_kamisi', 'Şeker Kamışı Çiftliği', 'ciftlik', 11, 5, 4,
          'Gözlemci ve pistonlu otomatik şeker kamışı çiftliği; hasat huniyle sandığa akar.')
    # zemin: kum sırası, arkasında su kanalı, önde huni hattı
    s.box(0, 0, 0, 10, 0, 3, 'stone_bricks')
    s.box(0, 1, 0, 10, 1, 0, 'stone_bricks')
    s.box(0, 1, 1, 10, 1, 1, 'water')
    s.box(0, 1, 2, 10, 1, 2, 'sand')
    s.box(0, 2, 2, 10, 2, 2, 'reeds', age=0)
    s.box(0, 1, 3, 10, 1, 3, 'hopper', facing_direction=FACING['east'])
    s.put(10, 1, 3, 'hopper', facing_direction=FACING['down'])
    s.put(10, 0, 3, 'chest', **{'minecraft:cardinal_direction': 'south'})
    # pistonlar 3. sırada kamışa bakar, gözlemciler üstte
    s.box(0, 3, 1, 10, 3, 1, 'piston', facing_direction=FACING['south'])
    s.box(0, 4, 1, 10, 4, 1, 'observer', **{'minecraft:facing_direction': 'down'})
    s.box(0, 3, 0, 10, 4, 0, 'stone_bricks')
    s.box(0, 2, 0, 10, 2, 0, 'stone_bricks')
    s.box(0, 2, 1, 10, 2, 1, 'glass')
    s.box(0, 3, 3, 10, 4, 3, 'glass')
    return s.finish()


def isigin_sonu():
    """End of Light tarzı mega yaratık çiftliği (Bedrock'a uyarlı): dört kollu, dört katlı karanlık doğma alanı,
    sudan akıntılar merkezdeki kuyuya taşır, 22 blok düşüş, huni ve sandıklı toplama odası, tepede bekleme odası."""
    N = 65
    c = N // 2
    H = 44
    s = S('isigin_sonu', 'End of Light Mega Çiftlik', 'dev', N, H, N,
          'Java\'daki ünlü End of Light çiftliğinin Bedrock\'a uyarlanmış dev hali. Tepedeki odada bekle; '
          'yaratıklar karanlık katlarda doğar, akıntıyla kuyuya düşer.')
    # toplama odası (zemin)
    s.room(c - 5, 0, c - 5, c + 5, 4, c + 5, 'obsidian', 'obsidian')
    s.box(c - 1, 1, c - 1, c, 1, c, 'hopper', facing_direction=FACING['down'])
    s.box(c - 1, 0, c - 1, c, 0, c, 'chest', **{'minecraft:cardinal_direction': 'south'})
    s.put(c - 1, 0, c - 1, 'chest', **{'minecraft:cardinal_direction': 'south'})
    s.box(c - 2, 2, c - 2, c + 1, 2, c + 1, 'glass')
    s.air(c - 1, 2, c - 1, c, 2, c)
    s.door(c, 1, c + 5, 'south', 'iron_door') if False else s.air(c, 1, c + 5, c, 2, c + 5)
    s.torch(c - 3, 3, c + 4, 'north')
    # düşme kuyusu
    for y in range(3, 26):
        s.walls(c - 2, y, c - 2, c + 1, y, c + 1, 'obsidian')
        s.air(c - 1, y, c - 1, c, y, c)
    floors = [26, 30, 34, 38]
    for fi, fy in enumerate(floors):
        # taban (karanlık doğma alanı) + kollar
        for arm in range(4):
            for i in range(3, c - 1):
                for w in range(-4, 4):
                    if arm == 0:
                        x, z = c + w, c + i      # güney kolu
                    elif arm == 1:
                        x, z = c + w, c - 1 - i  # kuzey kolu
                    elif arm == 2:
                        x, z = c + i, c + w      # doğu kolu
                    else:
                        x, z = c - 1 - i, c + w  # batı kolu
                    s.put(x, fy, z, 'cobbled_deepslate')
                    s.put(x, fy + 1, z, 'air'); s.put(x, fy + 2, z, 'air')
            # dış uçta su kaynakları (akıntı merkeze doğru)
            for w in range(-4, 4):
                for step in (c - 2, c - 10, c - 18, c - 26):
                    if arm == 0:
                        s.put(c + w, fy + 1, c + step, 'water')
                    elif arm == 1:
                        s.put(c + w, fy + 1, c - 1 - step, 'water')
                    elif arm == 2:
                        s.put(c + step, fy + 1, c + w, 'water')
                    else:
                        s.put(c - 1 - step, fy + 1, c + w, 'water')
        # merkez: kuyu ağzı
        s.box(c - 3, fy, c - 3, c + 2, fy, c + 2, 'cobbled_deepslate')
        s.air(c - 1, fy, c - 1, c, fy, c)
        for y in range(fy + 1, fy + 3):
            s.air(c - 3, y, c - 3, c + 2, y, c + 2)
        # tavan (bir üst katın tabanı ya da çatı)
        if fi == len(floors) - 1:
            for arm in range(4):
                for i in range(3, c - 1):
                    for w in range(-4, 4):
                        if arm == 0:
                            s.put(c + w, fy + 3, c + i, 'cobbled_deepslate')
                        elif arm == 1:
                            s.put(c + w, fy + 3, c - 1 - i, 'cobbled_deepslate')
                        elif arm == 2:
                            s.put(c + i, fy + 3, c + w, 'cobbled_deepslate')
                        else:
                            s.put(c - 1 - i, fy + 3, c + w, 'cobbled_deepslate')
    # kolların yan duvarları (yaratık kaçmasın, karanlık kalsın)
    for fy in floors:
        for i in range(3, c - 1):
            for arm in range(4):
                for side in (-5, 4):
                    for y in (fy + 1, fy + 2):
                        if arm == 0:
                            s.put(c + side, y, c + i, 'cobbled_deepslate')
                        elif arm == 1:
                            s.put(c + side, y, c - 1 - i, 'cobbled_deepslate')
                        elif arm == 2:
                            s.put(c + i, y, c + side, 'cobbled_deepslate')
                        else:
                            s.put(c - 1 - i, y, c + side, 'cobbled_deepslate')
    # tepedeki bekleme odası (AFK)
    top = floors[-1] + 4
    s.room(c - 3, top, c - 3, c + 2, top + 3, c + 2, 'glass', 'smooth_stone')
    s.box(c - 3, top + 4, c - 3, c + 2, top + 4, c + 2, 'smooth_stone')
    s.put(c - 1, top + 1, c - 1, 'bed', direction=0, head_piece_bit=False) if False else None
    s.put(c, top + 1, c - 2, 'chest', **{'minecraft:cardinal_direction': 'south'})
    s.lantern(c - 1, top + 1, c + 1)
    # bekleme odasına çıkan merdiven kulesi (dışarıdan)
    lx, lz = c + 3, c - 1
    for y in range(1, top + 1):
        s.put(lx, y, lz, 'ladder', facing_direction=FACING['east'])
        s.put(lx - 1, y, lz, s.get(lx - 1, y, lz) or 'obsidian') if s.get(lx - 1, y, lz) in (None, 'air') else None
    s.put(lx, top + 1, lz, 'air'); s.put(lx - 1, top + 1, lz, 'air')
    return s.finish()


ALL = [minik_kulube, kamp_alani, koy_kuyusu, lamba_diregi, cicek_bahcesi, cesme,
       ahsap_ev, iki_katli_ev, tas_ev, col_evi, iglo, cadi_kulubesi,
       demirci, kutuphane, ambar, yel_degirmeni,
       gozetleme_kulesi, deniz_feneri, yagmaci_kulesi, kucuk_kale, end_kulesi,
       bugday_tarlasi, hayvan_agili, seker_kamisi, isigin_sonu]
KATEGORI = {'kucuk': 'Küçük yapılar', 'ev': 'Evler', 'koy': 'Köy yapıları', 'kule': 'Kuleler ve kaleler',
            'ciftlik': 'Çiftlikler', 'dev': 'Dev yapılar'}

# blok -> malzeme (eşya); None = bedava (su), 'skip' = sayılmaz
ITEM_OF = {
    'farmland': 'dirt', 'grass_path': 'dirt', 'wheat': 'wheat_seeds', 'carrots': 'carrot', 'potatoes': 'potato',
    'beetroot': 'beetroot_seeds', 'reeds': 'sugar_cane', 'water': None, 'air': None, 'bed': 'bed',
    'redstone_wire': 'redstone', 'grass_block': 'dirt',
}


def item_for(name, st):
    if st.get('upper_block_bit') or st.get('head_piece_bit'):
        return None
    if name in ITEM_OF:
        return ITEM_OF[name]
    if name.endswith('_door') or name == 'wooden_door':
        return name if name != 'wooden_door' else 'wooden_door'
    return name


def materials(s):
    out = {}
    for (name, st) in s.g.values():
        it = item_for(name, st)
        if it:
            out[it] = out.get(it, 0) + 1
    return dict(sorted(out.items(), key=lambda kv: -kv[1]))


def validate(s):
    blocks, props = vanilla()
    errs = []
    for (pos, (name, st)) in s.g.items():
        if name == 'air':
            continue
        full_name = 'minecraft:' + name
        if full_name not in blocks:
            errs.append(f'{s.key}: bilinmeyen blok {name}')
            continue
        for k, v in st.items():
            if k not in blocks[full_name]:
                errs.append(f'{s.key}: {name} bloğunda {k} durumu yok')
            elif props.get(k) and v not in props[k]:
                errs.append(f'{s.key}: {name}.{k}={v} geçersiz')
    return sorted(set(errs))


def encode(s):
    palette = [None, 'air']
    pidx = {}
    layers = []
    for y in range(s.H):
        cells = []
        for z in range(s.D):
            for x in range(s.W):
                v = s.g.get((x, y, z))
                if v is None:
                    cells.append(0)
                elif v[0] == 'air':
                    cells.append(1)
                else:
                    key = (v[0], json.dumps(v[1], sort_keys=True))
                    if key not in pidx:
                        pidx[key] = len(palette)
                        palette.append([v[0], v[1]] if v[1] else [v[0]])
                    cells.append(pidx[key])
        # RLE: "i" ya da "i*n"
        out, i = [], 0
        while i < len(cells):
            j = i
            while j < len(cells) and cells[j] == cells[i]:
                j += 1
            n = j - i
            out.append(f'{cells[i]:x}' if n == 1 else f'{cells[i]:x}*{n:x}')
            i = j
        layers.append(','.join(out))
    return palette[2:], layers


def build_js(path):
    data = []
    problems = []
    for fn in ALL:
        s = fn()
        problems += validate(s)
        pal, layers = encode(s)
        count = sum(1 for v in s.g.values() if v[0] != 'air')
        data.append({'id': s.key, 'ad': s.ad, 'kat': s.kat, 'aciklama': s.aciklama, 'boyut': [s.W, s.H, s.D],
                     'blok': count, 'malzeme': materials(s), 'palet': pal, 'katman': layers})
    with open(path, 'w', encoding='utf-8') as f:
        f.write('// build.py üretir (gen/yapilar.py). Elle düzenleme.\n')
        f.write(f'export const KATEGORI = {json.dumps(KATEGORI, ensure_ascii=False)};\n')
        f.write(f'export const YAPILAR = {json.dumps(data, ensure_ascii=False, separators=(",", ":"))};\n')
    return data, problems


if __name__ == '__main__':
    d, p = build_js('/tmp/yapi_data.js')
    for e in p:
        print('HATA', e)
    for x in d:
        print(x['id'], x['boyut'], x['blok'], list(x['malzeme'].items())[:4])
    print(os.path.getsize('/tmp/yapi_data.js'), 'bayt')
