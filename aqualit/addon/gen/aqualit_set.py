"""Aqualit aletleri ve Aqualit zırh seti: Minecraft biçiminde (elmas şekilleri), Aqualit renkleriyle."""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
VAN = os.path.join(HERE, '..', '..', 'vanilla', 'elmas')

# Renk A (Türk turkuazı): koyudan açığa (aletler)
PAL = [(7, 50, 45), (13, 94, 81), (22, 135, 112), (43, 176, 143), (122, 211, 183), (213, 242, 231), (244, 253, 249)]
# zırh: biraz daha turkuaz
PAL_Z = [(5, 40, 40), (9, 74, 72), (15, 112, 106), (24, 150, 140), (44, 188, 174), (120, 224, 210), (220, 250, 246)]
ANCH_Z = [(28, 0), (55, 1), (110, 2), (160, 3), (200, 4), (235, 5), (255, 6)]
# Aqualit bloğu ve sandığındaki yuvarlak taş (daire) deseni
GEM4 = ['.WH.', 'WHLM', 'HLMD', '.MD.']
GEM3 = ['.W.', 'WLM', '.MD']
GEM2 = ['WL', 'LD']
GEM_C = {'W': (236, 252, 248), 'H': (150, 236, 220), 'L': (72, 210, 192), 'M': (30, 162, 150), 'D': (12, 86, 82)}
# elmas tonlarının parlaklığı -> Aqualit tonu (parçalı doğrusal)
ANCH = [(28, 0), (50, 1), (88, 2), (138, 3), (188, 4), (228, 5), (255, 6)]

ARMOR = [
    # id, ad, vanilla simge, yuva, koruma, dayanıklılık, tarif şekli
    ('aqualit_helmet', 'Aqualit Miğfer', 'diamond_helmet', 'slot.armor.head', 3, 330, ['KKK', 'K K']),
    ('aqualit_chestplate', 'Aqualit Göğüslük', 'diamond_chestplate', 'slot.armor.chest', 8, 480, ['K K', 'KKK', 'KKK']),
    ('aqualit_leggings', 'Aqualit Pantolon', 'diamond_leggings', 'slot.armor.legs', 6, 450, ['KKK', 'K K', 'K K']),
    ('aqualit_boots', 'Aqualit Bot', 'diamond_boots', 'slot.armor.feet', 3, 390, ['K K', 'K K']),
]
ARMOR_GEO = {'slot.armor.head': ('geometry.humanoid.armor.helmet', 'aqualit_1', 'helmet_layer_visible'),
             'slot.armor.chest': ('geometry.humanoid.armor.chestplate', 'aqualit_1', 'chest_layer_visible'),
             'slot.armor.legs': ('geometry.humanoid.armor.leggings', 'aqualit_2', 'leg_layer_visible'),
             'slot.armor.feet': ('geometry.humanoid.armor.boots', 'aqualit_1', 'boot_layer_visible')}
ENCH_SLOT = {'slot.armor.head': 'armor_head', 'slot.armor.chest': 'armor_torso', 'slot.armor.legs': 'armor_legs',
             'slot.armor.feet': 'armor_feet'}
TOOL_ICONS = {'aqualit_pickaxe': 'diamond_pickaxe', 'aqualit_axe': 'diamond_axe', 'aqualit_shovel': 'diamond_shovel',
              'aqualit_hoe': 'diamond_hoe', 'aqualit_sword': 'diamond_sword'}


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def is_wood(c):
    r, g, b = c[:3]
    return r > g > b and r - b > 18 and r < 200


def gem_color(c, pal=PAL):
    x = lum(c)
    anch = ANCH_Z if pal is PAL_Z else ANCH
    for (a, ia), (b, ib) in zip(anch, anch[1:]):
        if x <= b:
            t = 0 if b == a else max(0.0, min(1.0, (x - a) / (b - a)))
            p, q = pal[ia], pal[ib]
            return tuple(int(p[i] + (q[i] - p[i]) * t) for i in range(3))
    return pal[-1]


def stamp(img, pattern, x0, y0, ring=True):
    """Yuvarlak Aqualit taşını yerleştir; altına ve sağına hafif gölge (dış çizgi değil)."""
    for j, row in enumerate(pattern):
        for i, ch in enumerate(row):
            if ch == '.':
                continue
            x, y = x0 + i, y0 + j
            if 0 <= x < img.width and 0 <= y < img.height and img.getpixel((x, y))[3] > 0:
                img.putpixel((x, y), GEM_C[ch] + (255,))
    if ring:
        h, w = len(pattern), len(pattern[0])
        for (x, y) in [(x0 + w, y0 + h // 2), (x0 + w // 2, y0 + h), (x0 + w - 1, y0 + h - 1)]:
            if 0 <= x < img.width and 0 <= y < img.height:
                p = img.getpixel((x, y))
                if p[3] > 0 and (x - x0 >= w or y - y0 >= h or pattern[y - y0][x - x0] == '.'):
                    img.putpixel((x, y), tuple(int(v * 0.7) for v in p[:3]) + (255,))
    return img


def recolor(img, keep_wood=True, pal=PAL):
    img = img.convert('RGBA')
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    for y in range(img.height):
        for x in range(img.width):
            p = img.getpixel((x, y))
            if p[3] == 0:
                continue
            if keep_wood and is_wood(p):
                out.putpixel((x, y), p)
            else:
                out.putpixel((x, y), gem_color(p, pal) + (p[3],))
    return out


def sparkle(img, pts):
    """Aqualit'e özgü küçük parıltı (elmastan ayırt etmek için)."""
    for (x, y) in pts:
        if img.getpixel((x, y))[3] > 0:
            img.putpixel((x, y), PAL[6] + (255,))
    return img


SPARKS = {'aqualit_pickaxe': [(5, 2)], 'aqualit_axe': [(7, 3)], 'aqualit_shovel': [(11, 3)], 'aqualit_hoe': [(6, 2)],
          'aqualit_sword': [(12, 3)], 'aqualit_helmet': [(4, 4)], 'aqualit_chestplate': [(5, 5)],
          'aqualit_leggings': [(5, 3)], 'aqualit_boots': [(3, 9)]}


def tool_icon(tid):
    img = recolor(Image.open(os.path.join(VAN, TOOL_ICONS[tid] + '.png')))
    return sparkle(img, SPARKS.get(tid, []))


ICON_GEMS = {'aqualit_helmet': [(GEM2, 7, 3)], 'aqualit_chestplate': [(GEM3, 6, 5)],
             'aqualit_leggings': [(GEM2, 3, 7), (GEM2, 11, 7)], 'aqualit_boots': []}


def armor_icon(aid, van):
    img = recolor(Image.open(os.path.join(VAN, van + '.png')), keep_wood=False, pal=PAL_Z)
    for pat, x, y in ICON_GEMS.get(aid, []):
        stamp(img, pat, x, y, ring=False)
    return img


def armor_layers():
    l1 = recolor(Image.open(os.path.join(VAN, 'diamond_1.png')), keep_wood=False, pal=PAL_Z)
    l2 = recolor(Image.open(os.path.join(VAN, 'diamond_2.png')), keep_wood=False, pal=PAL_Z)
    stamp(l1, GEM3, 11, 8)      # miğfer: alın
    stamp(l1, GEM4, 22, 22)     # göğüs
    stamp(l1, GEM4, 34, 22)     # sırt
    stamp(l2, GEM2, 5, 25)      # dizler (iki bacak aynı dokuyu kullanır)
    return l1, l2


def attachable(aid, slot):
    geo, tex, var = ARMOR_GEO[slot]
    return {'format_version': '1.10.0', 'minecraft:attachable': {'description': {
        'identifier': f'aqualit:{aid}',
        'materials': {'default': 'armor', 'enchanted': 'armor_enchanted'},
        'textures': {'default': f'textures/models/armor/{tex}', 'enchanted': 'textures/misc/enchanted_actor_glint'},
        'geometry': {'default': geo},
        'scripts': {'parent_setup': f'variable.{var} = 0.0;'},
        'render_controllers': ['controller.render.armor'],
    }}}
