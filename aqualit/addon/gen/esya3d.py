"""v0.3.2: eşyaların 3B görünüşü.

- Sandıklar (8 tür): oyunun sandığı gibi gerçek 3B blok. Eşya, aynı kimlikli özel bloğun eşyası olur
  (block_placer + replace_block_item); envanterde ve elde oyun bloğu 3B çizer. Konunca sandik.js tuzaklı sandığa çevirir.
- Cihazlar (kumanda, telsiz, takip ekranı, komut çubuğu, bölge seçici, ayar dişlisi, tamir kiti, radar, hız sayacı,
  otopilot): envanterde düz simge, elde 3B model (attachable). Tutuş açıları Bedrock wiki'deki blok tutma örneğinden.
- Robotlar, aletler, zırhlar, kabuklar, kitaplar, ham Aqualit ve külçe olduğu gibi kalır.
"""
import copy
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, '..', '..')
sys.path.insert(0, ART)

import kesif as K  # noqa: E402
from kesif import Form, fill, panel, rows, over, hline, vline, dots  # noqa: E402
from kesif_araclar import add_box, auto, tread  # noqa: E402
import cift_sandik as CS  # noqa: E402
import sandik_gen as SG  # noqa: E402


# ======================================================================= cihaz modelleri (+z ön, y yukarı, piksel)
def _govde(f, a, b, base='M', front=None, top=None, glow=''):
    w, h, d = (int(round(b[i] - a[i])) for i in range(3))
    faces = auto(a, b, base=base, front=front, top=top)
    return f.add('el', f'p{len(f.parts)}', a, b, glow=glow, **faces)


def kumanda():
    f = Form('task_remote', 'Görev Kumandası')
    f.bone('el', None, (0, 4, 0))
    on = panel(5, 8, 'M')
    over(on, rows('kkk', 'k<k', 'kkk'), 1, 1)
    over(on, rows('R f', '   ', 'y y'), 1, 5)
    _govde(f, (-2.5, 0, -1.5), (2.5, 8, 1.5), front=on, glow='<')
    _govde(f, (1, 8, -0.5), (2, 11, 0.5), base='&')
    _govde(f, (0.5, 11, -1), (2.5, 12, 1), base='R', glow='R')
    return f


def telsiz():
    f = Form('robot_radio', 'Telsiz')
    f.bone('el', None, (0, 4, 0))
    on = fill(4, 7, 'D')
    for y in (1, 2, 3):
        hline(on, y, 'k', 1, 3)
    over(on, rows('<<'), 1, 5)
    _govde(f, (-2, 0, -1.5), (2, 7, 1.5), base='D', front=on, glow='<')
    _govde(f, (-1.5, 7, -0.5), (-0.5, 12, 0.5), base='k')
    _govde(f, (-1.5, 12, -0.5), (-0.5, 13, 0.5), base='y')
    _govde(f, (0.5, 7, -0.5), (1.5, 8, 0.5), base='y')
    return f


def takip_ekrani():
    f = Form('robot_tracker', 'Takip Ekranı')
    f.bone('el', None, (0, 3, 0))
    on = fill(8, 6, 'y')
    for y in range(1, 5):
        hline(on, y, '0', 1, 7)
    dots(on, [(2, 2), (5, 3), (4, 1)], 'f')
    dots(on, [(3, 4)], 'W')
    _govde(f, (-4, 0, -1), (4, 6, 1), base='y', front=on, glow='fW')
    _govde(f, (-1, -2, -0.5), (1, 0, 0.5), base='o')
    return f


def komut_cubugu():
    f = Form('command_rod', 'Komut Çubuğu')
    f.bone('el', None, (0, 5, 0))
    _govde(f, (-0.5, 0, -0.5), (0.5, 4, 0.5), base='o')
    _govde(f, (-0.5, 4, -0.5), (0.5, 9, 0.5), base='&')
    _govde(f, (-1, 9, -1), (1, 10, 1), base='y')
    _govde(f, (-1.5, 10, -1.5), (1.5, 13, 1.5), base='<', glow='<~')
    return f


def bolge_secici():
    f = Form('zone_selector', 'Bölge Seçici')
    f.bone('el', None, (0, 5, 0))
    _govde(f, (-0.5, 0, -0.5), (0.5, 8, 0.5), base='&')
    cer = [[' '] * 4 for _ in range(4)]
    for i in range(4):
        cer[0][i] = cer[3][i] = cer[i][0] = cer[i][3] = 'W'
    a, b = (-2, 8, -2), (2, 12, 2)
    f.add('el', 'kup', a, b, glow='W', front=[r[:] for r in cer], back=[r[:] for r in cer], left=[r[:] for r in cer],
          right=[r[:] for r in cer], top=[r[:] for r in cer], bottom=[r[:] for r in cer])
    _govde(f, (-1, 9, -1), (1, 11, 1), base='<', glow='<')
    return f


def ayar_dislisi():
    f = Form('tuning_gear', 'Ayar Dişlisi')
    f.bone('el', None, (0, 4, 0))
    on = fill(5, 5, 'y')
    over(on, rows('YYY', 'YRY', 'YYY'), 1, 1)
    _govde(f, (-2.5, 1.5, -1), (2.5, 6.5, 1), base='y', front=on, glow='R')
    for a, b in (((-1, 6.5, -1), (1, 7.5, 1)), ((-1, 0.5, -1), (1, 1.5, 1)), ((-3.5, 3, -1), (-2.5, 5, 1)), ((2.5, 3, -1), (3.5, 5, 1))):
        _govde(f, a, b, base='Y')
    return f


def tamir_kiti():
    f = Form('tamir_kiti', 'Tamir Kiti')
    f.bone('el', None, (0, 2.5, 0))
    on = panel(7, 4, 'R', t='R', b='R', l='R', r='R')
    over(on, rows('.W.', 'WWW', '.W.'), 2, 0)
    _govde(f, (-3.5, 0, -2), (3.5, 4, 2), base='R', front=on)
    _govde(f, (-1.5, 4, -0.5), (1.5, 5, 0.5), base='k')
    return f


def radar():
    f = Form('kesif_radar', 'Yer Bulucu Radar')
    f.bone('el', None, (0, 3, 0))
    on = fill(6, 5, 'y')
    for y in range(1, 4):
        hline(on, y, 'k', 1, 5)
    dots(on, [(2, 2), (3, 1)], '~')
    dots(on, [(4, 3)], 'R')
    _govde(f, (-3, 0, -2), (3, 5, 2), base='y', front=on, glow='~R')
    _govde(f, (-0.5, 5, -0.5), (0.5, 7, 0.5), base='&')
    _govde(f, (-2.5, 7, -0.5), (2.5, 10, 0.5), base='&', front=rows('LHWHL', 'HMyMH', 'LDDDL'))
    return f


def hiz_sayaci():
    f = Form('kesif_hiz', 'Hız Sayacı')
    f.bone('el', None, (0, 3, 0))
    on = fill(6, 6, 'W')
    over(on, rows('f   RR', '      ', '   k  ', '  k   ', ' kk   '), 0, 0)
    _govde(f, (-3, 0, -1), (3, 6, 1), base='y', front=on)
    return f


def otopilot(acik):
    f = Form('kesif_otopilot_acik' if acik else 'kesif_otopilot_kapali', 'Otopilot')
    f.bone('el', None, (0, 3, 0))
    ek, isik = ('E', 'f') if acik else ('=', 'R')
    on = fill(6, 4, 'y')
    for y in range(1, 3):
        hline(on, y, ek, 1, 5)
    dots(on, [(2, 1), (3, 2)], isik)
    _govde(f, (-3, 0, -1.5), (3, 4, 1.5), base='y', front=on, glow=isik + ek)
    _govde(f, (-0.5, 4, -0.5), (0.5, 6, 0.5), base='k')
    _govde(f, (-1, 6, -1), (1, 7, 1), base='R' if not acik else 'f', glow='Rf')
    return f


def telefon():
    f = Form('aqualit_telefon', 'Aqualit Telefon')
    f.bone('el', None, (0, 4, 0))
    on = panel(5, 8, 'M')
    for y in range(1, 6):
        hline(on, y, 'k', 1, 4)
    dots(on, [(2, 2), (3, 2), (1, 4)], '~')
    over(on, rows('H H'), 1, 6)
    _govde(f, (-2.5, 0, -0.5), (2.5, 8, 0.5), front=on, glow='~')
    return f


CIHAZLAR = [telefon, kumanda, telsiz, takip_ekrani, komut_cubugu, bolge_secici, ayar_dislisi, tamir_kiti, radar, hiz_sayaci,
            lambda: otopilot(False), lambda: otopilot(True)]


# ======================================================================= dosyalar
def _boyut(geo):
    lo, hi = [1e9] * 3, [-1e9] * 3
    for b in geo['minecraft:geometry'][0]['bones']:
        for c in b.get('cubes', []):
            for i in range(3):
                lo[i] = min(lo[i], c['origin'][i])
                hi[i] = max(hi[i], c['origin'][i] + c['size'][i])
    return max(hi[i] - lo[i] for i in range(3)), (lo[1] + hi[1]) / 2


def _bagla(geo, root):
    """Kök kemik oyuncunun eline bağlanır (bind); biçim 1.16.0."""
    geo['format_version'] = '1.16.0'
    for b in geo['minecraft:geometry'][0]['bones']:
        if b['name'] == root:
            b['binding'] = 'q.item_slot_to_bone_name(c.item_slot)'
    return geo


def _anim(aid, root, olcek, orta):
    """Bedrock wiki: blok tutma (8 piksellik kafa). Model 8 piksele ölçeklenir, ortası tutuş noktası."""
    k = 8 / max(olcek, 1)
    return {
        f'animation.aqualit.el_{aid}.fp': {'loop': True, 'bones': {root: {
            'rotation': [27, -39, -159], 'position': [0, 14.5 - (orta - 4) * k, 2.4], 'scale': k}}},
        f'animation.aqualit.el_{aid}.tp': {'loop': True, 'bones': {root: {
            'rotation': [-20, -32.5, 0], 'position': [0, 19 - (orta - 4) * k * 0.65, -4], 'scale': 0.65 * k}}},
    }


def _attachable(iid, aid, tex_path, geo_id):
    return {'format_version': '1.10.0', 'minecraft:attachable': {'description': {
        'identifier': f'aqualit:{iid}',
        'materials': {'default': 'entity_alphatest', 'enchanted': 'entity_alphatest_glint'},
        'textures': {'default': tex_path, 'enchanted': 'textures/misc/enchanted_item_glint'},
        'geometry': {'default': geo_id},
        'animations': {'fp': f'animation.aqualit.el_{aid}.fp', 'tp': f'animation.aqualit.el_{aid}.tp'},
        'scripts': {'animate': [{'fp': 'c.is_first_person'}, {'tp': '!c.is_first_person'}]},
        'render_controllers': ['controller.render.item_default'],
    }}}


def cihaz_modelleri(RP, wj):
    """Cihazların elde 3B modelleri. Önizleme için (geo, doku) listesi döner."""
    tdir = f'{RP}/textures/entity/aqualit_el'
    os.makedirs(tdir, exist_ok=True)
    anims, out = {}, []
    for fn in CIHAZLAR:
        fm = fn()
        gid = f'geometry.aqualit.el_{fm.key}'
        geo, tex, glow = K.build(forms=[fm], W=64, ident=gid)
        tex.save(f'{tdir}/{fm.key}.png')
        geo = _bagla(geo, 'el')
        wj(f'{RP}/models/entity/aqualit_el_{fm.key}.geo.json', geo)
        boy, orta = _boyut(geo)
        anims.update(_anim(fm.key, 'el', boy, orta))
        wj(f'{RP}/attachables/el_{fm.key}.json', _attachable(fm.key, fm.key, f'textures/entity/aqualit_el/{fm.key}', gid))
        out.append((fm.key, geo, tex, glow))
    return anims, out


SANDIK_GEO = 'geometry.aqualit.sandik_blok'


def sandik_geo():
    g = copy.deepcopy(CS.geo())
    g['format_version'] = '1.16.0'
    d = g['minecraft:geometry'][0]
    d['description'].update({'identifier': SANDIK_GEO, 'visible_bounds_width': 2, 'visible_bounds_height': 2,
                             'visible_bounds_offset': [0, 0.5, 0]})
    return g


def sandik_bloklari(BP, RP, wj, chests, td, sounds, anims):
    """Sandık eşyaları = aynı kimlikli 3B sandık blokları (envanterde ve elde oyunun sandığı gibi görünür)."""
    os.makedirs(f'{RP}/textures/blocks', exist_ok=True)
    os.makedirs(f'{RP}/models/blocks', exist_ok=True)
    wj(f'{RP}/models/blocks/aqualit_sandik.geo.json', sandik_geo())
    for iid, name, icon, kind in chests:
        tex = f'aqualit_sandik_{kind}'
        CS.sheet(SG.KIND_EMB[kind]).save(f'{RP}/textures/blocks/{tex}.png')
        td[tex] = {'textures': f'textures/blocks/{tex}'}
        wj(f'{BP}/blocks/{iid}.json', {'format_version': '1.26.20', 'minecraft:block': {
            'description': {'identifier': f'aqualit:{iid}', 'menu_category': {'category': 'none'}},
            'components': {
                'minecraft:display_name': f'item.aqualit.{iid}.name',
                'minecraft:geometry': SANDIK_GEO,
                'minecraft:material_instances': {'*': {'texture': tex, 'render_method': 'alpha_test'}},
                'minecraft:collision_box': {'origin': [-7, 0, -7], 'size': [14, 14, 14]},
                'minecraft:selection_box': {'origin': [-7, 0, -7], 'size': [14, 14, 14]},
                'minecraft:destructible_by_mining': {'seconds_to_destroy': 1.5},
                'minecraft:light_dampening': 0,
                'minecraft:loot': 'loot_tables/empty.json',
            }}})
        sounds[f'aqualit:{iid}'] = {'sound': 'wood'}


def onizleme(out_path, modeller):
    """Cihaz modellerinin 3B önizlemesi (tek kart)."""
    sys.path.insert(0, os.path.join(HERE, '..', 'test'))
    import render_z as Z
    from PIL import Image, ImageDraw, ImageFont
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 13)
    W, H = 180, 200
    cols = 6
    rows_ = (len(modeller) + cols - 1) // cols
    card = Image.new('RGB', (W * cols, H * rows_ + 40), (24, 28, 32))
    dr = ImageDraw.Draw(card)
    dr.text((12, 10), 'Elde 3B duran cihazlar', font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18),
            fill=(64, 224, 208))
    for i, (key, geo, tex, glow) in enumerate(modeller):
        boy, orta = _boyut(geo)
        cam = Z.Cam(yaw=35, elev=22, scale=150 / max(boy, 6), size=(W, H - 30), center=(0, orta, 0))
        g2 = copy.deepcopy(geo)
        for b in g2['minecraft:geometry'][0]['bones']:
            b.pop('binding', None)
        im = Z.render(g2, tex, cam=cam, glow=glow, ground={'y': 0, 'color': (40, 46, 52)})
        x, y = (i % cols) * W, 40 + (i // cols) * H
        card.paste(im.convert('RGB'), (x, y))
        tw = dr.textlength(key, font=font)
        dr.text((x + (W - tw) / 2, y + H - 26), key, font=font, fill=(220, 230, 232))
    card.save(out_path)
    return out_path
