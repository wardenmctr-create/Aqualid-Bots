"""Evcil mini dronlar (v0.4.0): her robot türünün omuzda süzülen küçük dronu.

Tek varlık (aqualit:evcil); türü 'aqualit:tur' özelliği seçer (model, doku, animasyon). Modeller tasarim/ klasöründeki
onaylı tasarımlardan gelir (evcil.py, tum_evcil.py, yardimci.py). Her türün bir eşyası var (aqualit:evcil_<tür>):
basılı tutunca dron omzunda süzülür, dokununca eşyaya döner, sen ölünce envantere geri gelir (evcil.js).
Tarif: ortada robot, çevresinde 2 demir + 2 Aqualit + 4 kızıltaş → robot geri verilir + evcil dronu.
Organizatör Yardımcısı'nın evcil hâli: 3 demir + 3 Aqualit + 2 kızıltaş, ortada Organizatör.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.normpath(os.path.join(HERE, '..', '..'))
TAS = os.path.join(ART, 'tasarim')
for p in (HERE, ART, TAS, os.path.join(ART, 'addon', 'test')):
    if p not in sys.path:
        sys.path.insert(0, p)
import kesif as K  # noqa: E402

ID = 'aqualit:evcil'
TURLER = ['mimar', 'kesif', 'madenci', 'kurekci', 'ciftci', 'oduncu', 'kilicli', 'organizator', 'portalci', 'yardimci']
ADLAR = {'mimar': 'Mimar', 'kesif': 'Keşif', 'madenci': 'Madenci', 'kurekci': 'Kürekçi', 'ciftci': 'Çiftçi',
         'oduncu': 'Oduncu', 'kilicli': 'Kılıçlı', 'organizator': 'Organizatör', 'portalci': 'Portalcı',
         'yardimci': 'Organizatör Yardımcısı'}
# robot eşyası -> evcil türü (tarif)
ROBOT_EVCIL = {'robot_insaatci': 'mimar', 'robot_kesif': 'kesif', 'robot_madenci': 'madenci', 'robot_kurekci': 'kurekci',
               'robot_ciftci': 'ciftci', 'robot_oduncu': 'oduncu', 'robot_toplayici': 'organizator',
               'robot_portalci': 'portalci', **{f'robot_kilicli_{i}': 'kilicli' for i in range(1, 6)}}
OLCEK = 0.8                 # omuzda papağan boyu
YARD_OLCEK = 0.42           # Yardımcı: aynı model, öteki evcil dronlar boyunda


def formlar():
    import evcil as E
    import tum_evcil as TE
    import kesif_dron as KD
    import yardimci as Y
    f = {t: E.evcil(t) for t in E.TURLER}
    f['mimar'] = TE.mimar()
    f['kesif'] = KD.model()
    f['yardimci'] = Y.yardimci(True)
    return f


def _cam_saydam(tex, adlar=('cam',), alfa=128):
    """Cam parçalarının UV adasını yarı saydam yapar (malzeme entity_alphablend)."""
    px = tex.load()
    for ad in adlar:
        if ad not in K.SON_UV:
            continue
        _, u, v, w, h = K.SON_UV[ad]
        for x in range(u, u + w):
            for y in range(v, v + h):
                if 0 <= x < tex.width and 0 <= y < tex.height:
                    r, g, b, a = px[x, y]
                    if a:
                        px[x, y] = (r, g, b, alfa)


def animasyon(tur, geo):
    kemik = {b['name'] for b in geo['minecraft:geometry'][0]['bones']}
    A = {}
    for b in kemik:
        if tur == 'kurekci' and b in ('p_l', 'p_r'):
            A[b] = {'rotation': ['q.life_time * 720', 0, 0]}
        elif b == 'halka':
            A[b] = {'rotation': [0, 'q.life_time * 85', 0]}            # Portalcı halkası: yavaş yavaş döner
        elif b.startswith('per_'):
            s = '' if b in ('per_fl', 'per_br') else '-'
            A[b] = {'rotation': [0, f'{s}q.life_time * 900', 0]}
        elif b.startswith('p_'):
            s = '-' if b == 'p_r' and tur == 'kesif' else ''
            A[b] = {'rotation': [0, f'{s}q.life_time * 900', 0]}
    govde = 'govde' if tur in ('kesif', 'yardimci') else 'g'
    if govde in kemik:
        A[govde] = {'position': [0, 'math.sin(q.life_time * 120) * 0.5', 0],
                    'rotation': ['math.sin(q.life_time * 120) * 3', 0, 'math.cos(q.life_time * 100) * 2']}
    return {'loop': True, 'bones': A}


def simge(geo, tex, glow, yol, yard=False):
    import render_z as Z
    cam = Z.Cam(yaw=30, elev=18, scale=(2.6 if not yard else 1.1), size=(96, 96),
                center=(0, 7 if not yard else 9, 0))
    im = Z.render(geo, tex, {}, (), cam, glow=glow, ground=None, bg=(255, 0, 255), shadow=False).convert('RGBA')
    px = im.load()
    for x in range(im.width):
        for y in range(im.height):
            r, g, b, a = px[x, y]
            if r > 200 and b > 200 and g < 60:
                px[x, y] = (0, 0, 0, 0)
    bb = im.getbbox()
    if bb:
        im = im.crop(bb)
    s = 30 / max(im.size)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))))
    from PIL import Image
    out = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    out.alpha_composite(im, ((32 - im.width) // 2, (32 - im.height) // 2))
    out.save(yol)


def bp():
    return {'format_version': '1.21.0', 'minecraft:entity': {
        'description': {'identifier': ID, 'is_spawnable': False, 'is_summonable': True,
                        'properties': {'aqualit:tur': {'type': 'int', 'range': [0, len(TURLER) - 1], 'default': 0,
                                                       'client_sync': True}}},
        'components': {
            'minecraft:type_family': {'family': ['aqualit_evcil', 'inanimate']},
            'minecraft:collision_box': {'width': 0.35, 'height': 0.35},
            'minecraft:health': {'value': 10, 'max': 10},
            'minecraft:damage_sensor': {'triggers': [{'cause': 'all', 'deals_damage': 'no'}]},
            'minecraft:physics': {'has_gravity': False, 'has_collision': False},
            'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
            'minecraft:knockback_resistance': {'value': 1.0},
            'minecraft:fire_immune': {},
            'minecraft:breathable': {'breathes_water': True, 'breathes_air': True, 'suffocate_time': 0},
            'minecraft:loot': {'table': 'loot_tables/empty.json'},
            'minecraft:persistent': {},
        }}}


def rp(geos):
    P = "q.property('aqualit:tur')"
    desc = {
        'identifier': ID,
        'materials': {'default': 'entity_alphablend', 'glow': 'copper_golem_eyes'},
        'textures': {}, 'geometry': {}, 'animations': {},
        'scripts': {'animate': [], 'scale': f"{P} == {TURLER.index('yardimci')} ? {OLCEK * YARD_OLCEK} : {OLCEK}"},
        'render_controllers': ['controller.render.aqualit.evcil', 'controller.render.aqualit.evcil_glow'],
    }
    for i, t in enumerate(TURLER):
        desc['textures'][t] = f'textures/entity/aqualit_evcil/{t}'
        desc['textures'][t + '_glow'] = f'textures/entity/aqualit_evcil/{t}_glow'
        desc['geometry'][t] = f'geometry.aqualit.evcil_{t}'
        desc['animations'][t] = f'animation.aqualit.evcil.{t}'
        desc['scripts']['animate'].append({t: f'{P} == {i}'})
    return {'format_version': '1.10.0', 'minecraft:client_entity': {'description': desc}}


def render_ctrl():
    P = "q.property('aqualit:tur')"
    geo = {'Array.geo': [f'Geometry.{t}' for t in TURLER]}
    return {'format_version': '1.10.0', 'render_controllers': {
        'controller.render.aqualit.evcil': {
            'arrays': {'geometries': geo, 'textures': {'Array.tex': [f'Texture.{t}' for t in TURLER]}},
            'geometry': f'Array.geo[{P}]', 'materials': [{'*': 'Material.default'}], 'textures': [f'Array.tex[{P}]']},
        'controller.render.aqualit.evcil_glow': {
            'arrays': {'geometries': geo, 'textures': {'Array.glow': [f'Texture.{t}_glow' for t in TURLER]}},
            'geometry': f'Array.geo[{P}]', 'materials': [{'*': 'Material.glow'}], 'textures': [f'Array.glow[{P}]'],
            'ignore_lighting': True},
    }}


def build(RP, BP, wj, GEN):
    d = f'{RP}/textures/entity/aqualit_evcil'
    os.makedirs(d, exist_ok=True)
    os.makedirs(f'{RP}/models/entity', exist_ok=True)
    anims = {}
    for t, f in formlar().items():
        W = 256 if t == 'yardimci' else 128
        geo, tex, glow = K.build(forms=[f], W=W, ident=f'geometry.aqualit.evcil_{t}')
        if t in ('organizator', 'yardimci'):
            _cam_saydam(tex)
        tex.save(f'{d}/{t}.png')
        glow.save(f'{d}/{t}_glow.png')
        wj(f'{RP}/models/entity/aqualit_evcil_{t}.geo.json', geo)
        anims[f'animation.aqualit.evcil.{t}'] = animasyon(t, geo)
        simge(geo, tex, glow, os.path.join(GEN, f'evcil_{t}.png'), yard=(t == 'yardimci'))
    wj(f'{RP}/animations/aqualit_evcil.animation.json', {'format_version': '1.8.0', 'animations': anims})
    wj(f'{BP}/entities/evcil.json', bp())
    wj(f'{RP}/entity/aqualit_evcil.entity.json', rp(None))
    wj(f'{RP}/render_controllers/aqualit_evcil.render_controllers.json', render_ctrl())
