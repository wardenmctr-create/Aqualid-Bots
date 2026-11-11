"""Matkap cevher görüşü (v0.4.5): cevherler ekranda, gerçek yerlerinde, uzaklıkla küçülen resimler olarak çizilir.

Atlas: her cevher türü için 18x18 kare (16x16 oyun dokusu + 1 piksel parlak çerçeve). Kaynak: Mojang
bedrock-samples; yoksa depodaki ref/cevher_atlas.png kullanılır. Parçacık: aqualit:cevher (v.u hücre, v.boy yarı boy).
"""
import json
import os
import shutil

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.environ.get('AQUALIT_REF', os.path.join(HERE, '..', '..', 'ref'))
HAZIR = os.path.join(REF, 'cevher_atlas.png')
SAMPLES = os.environ.get('BEDROCK_SAMPLES', '/home/user/mojang/bedrock-samples/resource_pack')
# blok kimliği, doku dosyası, çerçeve rengi
CEVHERLER = [
    ('ancient_debris', 'ancient_debris_side', (200, 120, 90)),
    ('diamond_ore', 'diamond_ore', (90, 240, 230)), ('deepslate_diamond_ore', 'deepslate/deepslate_diamond_ore', (90, 240, 230)),
    ('emerald_ore', 'emerald_ore', (60, 230, 110)), ('deepslate_emerald_ore', 'deepslate/deepslate_emerald_ore', (60, 230, 110)),
    ('gold_ore', 'gold_ore', (255, 220, 60)), ('deepslate_gold_ore', 'deepslate/deepslate_gold_ore', (255, 220, 60)),
    ('nether_gold_ore', 'nether_gold_ore', (255, 220, 60)),
    ('lapis_ore', 'lapis_ore', (70, 110, 240)), ('deepslate_lapis_ore', 'deepslate/deepslate_lapis_ore', (70, 110, 240)),
    ('redstone_ore', 'redstone_ore', (240, 50, 40)), ('deepslate_redstone_ore', 'deepslate/deepslate_redstone_ore', (240, 50, 40)),
    ('iron_ore', 'iron_ore', (230, 190, 160)), ('deepslate_iron_ore', 'deepslate/deepslate_iron_ore', (230, 190, 160)),
    ('copper_ore', 'copper_ore', (230, 130, 80)), ('deepslate_copper_ore', 'deepslate/deepslate_copper_ore', (230, 130, 80)),
    ('quartz_ore', 'quartz_ore', (240, 235, 225)),
    ('coal_ore', 'coal_ore', (60, 60, 60)), ('deepslate_coal_ore', 'deepslate/deepslate_coal_ore', (60, 60, 60)),
]
K = 18


def atlas():
    if not os.path.isdir(SAMPLES):
        return Image.open(HAZIR).convert('RGBA')
    img = Image.new('RGBA', (K * len(CEVHERLER), K), (0, 0, 0, 0))
    for i, (_, doku, renk) in enumerate(CEVHERLER):
        p = os.path.join(SAMPLES, 'textures', 'blocks', doku + '.png')
        t = Image.open(p).convert('RGBA')
        t = t.crop((0, 0, t.size[0], t.size[0])).resize((16, 16), Image.NEAREST)
        hucre = Image.new('RGBA', (K, K), (0, 0, 0, 0))
        ImageDraw.Draw(hucre).rectangle((0, 0, K - 1, K - 1), outline=renk + (255,))
        hucre.paste(t, (1, 1))
        img.paste(hucre, (i * K, 0))
    os.makedirs(os.path.dirname(HAZIR), exist_ok=True)
    img.save(HAZIR)
    return img


def parcacik():
    tex = {'texture_width': K * len(CEVHERLER), 'texture_height': K, 'uv': ['v.u', 0], 'uv_size': [K, K]}
    return {'format_version': '1.10.0', 'particle_effect': {
        'description': {'identifier': 'aqualit:cevher',
                        'basic_render_parameters': {'material': 'particles_blend', 'texture': 'textures/particle/aqualit_cevher'}},
        'components': {
            'minecraft:emitter_rate_instant': {'num_particles': 1},
            'minecraft:emitter_lifetime_once': {'active_time': 0},
            'minecraft:emitter_shape_point': {'offset': [0, 0, 0]},
            'minecraft:particle_lifetime_expression': {'max_lifetime': 0.13},
            'minecraft:particle_initial_speed': 0,
            'minecraft:particle_appearance_billboard': {'size': ['v.boy', 'v.boy'], 'facing_camera_mode': 'lookat_xyz', 'uv': tex},
            'minecraft:particle_appearance_tinting': {'color': [1, 1, 1, 0.95]},
        }}}


def build(RP, scripts_dir):
    img = atlas()
    os.makedirs(f'{RP}/textures/particle', exist_ok=True)
    os.makedirs(f'{RP}/particles', exist_ok=True)
    img.save(f'{RP}/textures/particle/aqualit_cevher.png')
    with open(f'{RP}/particles/aqualit_cevher.json', 'w') as fh:
        json.dump(parcacik(), fh, indent=1)
    with open(os.path.join(scripts_dir, 'cevher_atlas.js'), 'w') as fh:
        fh.write('// gen/cevher_gorus.py üretir — elle değiştirme.\n')
        fh.write(f'export const CEVHER_U = {json.dumps({"minecraft:" + b: i * K for i, (b, _, _) in enumerate(CEVHERLER)})};\n')
    return img
