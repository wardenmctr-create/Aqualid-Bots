"""Aqualit sandığı (v0.2.9): oyunun tuzaklı sandığı üzerine kurulu sandığın paket dosyaları.

- Tuzaklı sandığın dokusu Aqualit sandığıyla değiştirilir (tek 64x64, çift 128x64; çizim: cift_sandik.py).
- Her sandık bloğunun önünde türün amblem plakasını gösteren yardımcı varlık (aqualit:sandik_depo) durur;
  envanteri sandığın sayfalarını saklar. Kapasite 128 yuvayı aşınca bloğa görünmez bir ek depo (aqualit:sandik_ek) eklenir.
- Sayfa okları ve kilitli yuva eşyaları (yalnızca sandık açıkken görünür).
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, '..', '..')
sys.path.insert(0, ART)

import cift_sandik as CS  # noqa: E402  (sandiklar.EMB'ye kılıç amblemini de ekler)
import sandiklar  # noqa: E402
from pix import grid_to_img  # noqa: E402

DEPO_ID = 'aqualit:sandik_depo'
EK_ID = 'aqualit:sandik_ek'        # görünmez ek depo (kapasite bir varlığın yuvasını aşınca)
# tür -> amblem
KIND_EMB = {'genel': 'gem', 'madenci': 'pickaxe', 'kurekci': 'shovel', 'ciftci': 'hoe', 'oduncu': 'axe',
            'kilicli': 'sword', 'insaatci': 'house', 'toplayici': 'crate'}
KINDS = list(KIND_EMB)
DEPO_SIZE = 128          # varlık başına yuva: kayıtta yuva numarası bir bayt, 128 her durumda güvenli
                         # (tek sandık en çok 200 = ana + ek depo; çift en çok 500 = 2 ana + 2 ek)

# tek sandık dokusunda ön yüz (kutu UV: gövde (0,19), w=14, h=10, d=14 -> ön yüz (14,33))
FACE_X, FACE_Y = 14, 33
CROP = (FACE_X + 3, FACE_Y + 2, FACE_X + 11, FACE_Y + 10)   # 8x8: amblem + çevresi


def plate_texture(kind):
    """Sandık ön yüzünden amblem bölgesini keser (plaka sandıkla aynı görünür)."""
    sheet = CS.sheet(KIND_EMB[kind])
    crop = sheet.crop(CROP)
    tex = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    tex.alpha_composite(crop, (0, 0))
    tex.alpha_composite(crop, (8, 0))     # arka yüz (aynı amblem)
    return tex


def build_textures(entity_dir, chest_dir):
    os.makedirs(entity_dir, exist_ok=True)
    os.makedirs(chest_dir, exist_ok=True)
    for k in KINDS:
        plate_texture(k).save(os.path.join(entity_dir, f'{k}.png'))
    Image.new('RGBA', (16, 16), (0, 0, 0, 0)).save(os.path.join(entity_dir, 'bos.png'))
    # oyunun tuzaklı sandığı -> Aqualit sandığı (genel amblem; tür amblemini plaka gösterir)
    CS.sheet('gem').save(os.path.join(chest_dir, 'trapped.png'))
    CS.sheet('gem', True).save(os.path.join(chest_dir, 'trapped_double.png'))


def texture_sets():
    """Canlı Görseller (PBR) açıkken eski metal haritası yeni dokuyla karışmasın."""
    return {n: {'format_version': '1.21.30', 'minecraft:texture_set': {'color': n}}
            for n in ('trapped', 'trapped_double')}


def depo_geo():
    # 8x8 piksellik ince plaka, varlığın konumu plakanın ortası; iki yüz de dokulu
    return {'format_version': '1.12.0', 'minecraft:geometry': [{
        'description': {'identifier': 'geometry.aqualit.sandik_amblem', 'texture_width': 16, 'texture_height': 16,
                        'visible_bounds_width': 1, 'visible_bounds_height': 1, 'visible_bounds_offset': [0, 0, 0]},
        'bones': [{'name': 'plaka', 'pivot': [0, 0, 0], 'cubes': [
            {'origin': [-4, -4, -0.05], 'size': [8, 8, 0.1],
             'uv': {'north': {'uv': [0, 0], 'uv_size': [8, 8]}, 'south': {'uv': [8, 0], 'uv_size': [8, 8]},
                    'east': {'uv': [0, 0], 'uv_size': [0.1, 8]}, 'west': {'uv': [0, 0], 'uv_size': [0.1, 8]},
                    'up': {'uv': [0, 0], 'uv_size': [8, 0.1]}, 'down': {'uv': [0, 0], 'uv_size': [8, 0.1]}}},
        ]}],
    }]}


def depo_bp(extra=False):
    desc = {'identifier': EK_ID if extra else DEPO_ID, 'is_spawnable': False, 'is_summonable': True}
    if not extra:
        desc['properties'] = {'aqualit:kind': {'type': 'enum', 'values': KINDS, 'default': 'genel', 'client_sync': True}}
    return {
        'format_version': '1.26.0',
        'minecraft:entity': {
            'description': desc,
            'components': {
                'minecraft:type_family': {'family': ['aqualit_sandik', 'inanimate']},
                'minecraft:collision_box': {'width': 0.1, 'height': 0.1},
                # dokunuşlar plakaya değil sandığa gitsin
                'minecraft:custom_hit_test': {'hitboxes': [{'width': 0, 'height': 0, 'pivot': [0, -64, 0]}]},
                'minecraft:health': {'value': 1000, 'max': 1000},
                'minecraft:damage_sensor': {'triggers': [{'cause': 'all', 'deals_damage': 'no'}]},
                'minecraft:physics': {'has_gravity': False, 'has_collision': False},
                'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
                'minecraft:knockback_resistance': {'value': 1.0},
                'minecraft:persistent': {},
                # öldürülürse eşyalar yere düşer (kaybolmaz); hunilerle çekilemez
                'minecraft:inventory': {'inventory_size': DEPO_SIZE, 'container_type': 'container', 'private': False,
                                        'can_be_siphoned_from': False},
                'minecraft:fire_immune': {},
                'minecraft:conditional_bandwidth_optimization': {},
                'minecraft:loot': {'table': 'loot_tables/empty.json'},
            },
            'events': {},
        },
    }


def depo_rp():
    k = "q.property('aqualit:kind')"
    expr = ' : '.join(f"(({k} == '{kind}') ? {i}" for i, kind in enumerate(KINDS)) + ' : 0' + ')' * len(KINDS)
    return {
        'format_version': '1.10.0',
        'minecraft:client_entity': {
            'description': {
                'identifier': DEPO_ID,
                'materials': {'default': 'entity_alphatest'},
                'textures': {kind: f'textures/entity/aqualit_sandik/{kind}' for kind in KINDS},
                'geometry': {'default': 'geometry.aqualit.sandik_amblem'},
                'scripts': {'pre_animation': [f'v.k = {expr};']},
                'render_controllers': ['controller.render.aqualit.sandik_amblem'],
            }
        }
    }


def ek_rp():
    # görünmez: saydam doku
    return {
        'format_version': '1.10.0',
        'minecraft:client_entity': {
            'description': {
                'identifier': EK_ID,
                'materials': {'default': 'entity_alphatest'},
                'textures': {'default': 'textures/entity/aqualit_sandik/bos'},
                'geometry': {'default': 'geometry.aqualit.sandik_amblem'},
                'render_controllers': ['controller.render.default'],
            }
        }
    }


def depo_render():
    return {'format_version': '1.10.0', 'render_controllers': {
        'controller.render.aqualit.sandik_amblem': {
            'arrays': {'textures': {'Array.k': [f'Texture.{kind}' for kind in KINDS]}},
            'geometry': 'Geometry.default',
            'materials': [{'*': 'Material.default'}],
            'textures': ['Array.k[v.k]'],
        }}}


# ------------------------------------------------------------------ sayfa okları, kilitli yuva
ARROW = [
    "................",
    "................",
    "......OO........",
    "......OHO.......",
    "......OLHO......",
    ".OOOOOOLLHO.....",
    ".OHHHHHLLLHO....",
    ".OLLLLLLLLLHO...",
    ".OMMMMMMMMMDO...",
    ".ODDDDDMMMDO....",
    ".OOOOOOMMDO.....",
    "......OMDO......",
    "......ODO.......",
    "......OO........",
    "................",
    "................",
]


def nav_icons(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    right = grid_to_img(ARROW)
    right.save(os.path.join(out_dir, 'sayfa_ileri.png'))
    right.transpose(Image.FLIP_LEFT_RIGHT).save(os.path.join(out_dir, 'sayfa_geri.png'))


def kilicli_icon(out_dir):
    """Kılıçlı sandığı simgesi (sandık eşyası; amblem: kılıç)."""
    os.makedirs(out_dir, exist_ok=True)
    e = sandiklar.EMB['sword']
    # 7x7 kılıcı 6x6 alana sığdır (eşya simgesinde amblem alanı 6 satır)
    sandiklar.EMB['sword6'] = [row[1:] for row in e[1:]]
    sandiklar.chest('sword6').save(os.path.join(out_dir, 'chest_kilicli.png'))
