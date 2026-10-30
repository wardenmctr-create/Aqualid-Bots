#!/usr/bin/env python3
"""Keşif araçlarında robotların oturduğu yerler (koltuk, kanat, tavan, üst üste) — 3B önizleme.

Koltuklar oyundakinin aynısı (gen/kesif_oyun.py SEATS); robotlar oyundaki 'sit' hareketiyle oturur.
Koltuk yetmezse kalanlar aracın içine girer (görünmez): resimde "+N içeride" yazar.
Çıktılar: onizleme/64_kesif_koltuklar.gif, onizleme/64_kesif_koltuklar.png
"""
import copy
import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'addon', 'test'))
sys.path.insert(0, os.path.join(HERE, 'addon', 'gen'))
import render_z as Z  # noqa: E402
import kesif_onizleme as KO  # noqa: E402
import kesif_oyun as KG  # noqa: E402
import mimar_onizleme as MO  # noqa: E402
import entities as E  # noqa: E402

OUT = os.path.join(HERE, 'onizleme')
SCR = MO.SCR                      # robot.geo.json ve robot dokuları (mimar_onizleme üretir)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
KAPASITE = 10
PX = 16 / 0.8                     # blok → model pikseli (iki varlığın da ölçeği 0.8)
BIN = 0.7                         # binen robot küçülür (gen/entities.py: q.is_riding)
SKINS = ['madenci', 'kilicli_1', 'kilicli_2']
ACC = {'helmet', 'antenna_ball20', 'sand_bag', 'antenna_ball19', 'hat', 'antenna_sprout23', 'scarf', 'antenna_leaf19',
       'cape', 'right_shoulder', 'left_shoulder', 'kova', 'hardhat', 'toolbelt', 'blueprint', 'antenna_ball24',
       'headset', 'cap', 'visor', 'backpack'}
SHOW = {'madenci': {'helmet', 'antenna_ball20'}, 'kilicli_1': {'cape', 'antenna_ball19'},
        'kilicli_2': {'cape', 'antenna_ball19', 'right_shoulder', 'left_shoulder'}}
AD = {'ucak': 'Uçak', 'gemi': 'Gemi', 'denizalti': 'Denizaltı', 'arazi': 'Arazi aracı', 'matkap': 'Matkap'}
ZUM = {'arazi': 0.74, 'matkap': 0.78}          # uzun olanlar: kamera biraz uzakta
NMAX = max(len(v) for v in KG.SEATS.values())


def birlesik():
    """Keşif + NMAX robot tek geometri/doku (robot dokuları Keşif dokusunun altında yan yana)."""
    if not os.path.exists(os.path.join(SCR, 'robot.geo.json')):
        MO.birlesik(0)
    rgeo = json.load(open(os.path.join(SCR, 'robot.geo.json')))
    geo = copy.deepcopy(KO.GEO)
    d = geo['minecraft:geometry'][0]
    kw, kh = KO.TEX.size
    tex = Image.new('RGBA', (kw, kh + 128), (0, 0, 0, 0))
    glow = Image.new('RGBA', (kw, kh + 128), (0, 0, 0, 0))
    tex.paste(KO.TEX, (0, 0))
    glow.paste(KO.GLOW, (0, 0))
    for j, s in enumerate(SKINS):
        tex.paste(Image.open(os.path.join(SCR, f'{s}.png')).convert('RGBA'), (j * 128, kh))
        glow.paste(Image.open(os.path.join(SCR, f'{s}_glow.png')).convert('RGBA'), (j * 128, kh))
    d['description']['texture_height'] = kh + 128
    for i in range(NMAX):
        ox = (i % len(SKINS)) * 128
        for b in rgeo['minecraft:geometry'][0]['bones']:
            nb = copy.deepcopy(b)
            nb['name'] = f'r{i}_' + b['name']
            if 'parent' in b:
                nb['parent'] = f'r{i}_' + b['parent']
            for c in nb.get('cubes', []):
                c['uv'] = [c['uv'][0] + ox, c['uv'][1] + kh]
            d['bones'].append(nb)
    return geo, tex, glow


GEO, TEX, GLOW = birlesik()
RANIM = {k.split('.')[-1]: v for k, v in E.robot_animations()['animations'].items()}
FNT = ImageFont.truetype(FONT, 17)
FNT2 = ImageFont.truetype(FONT, 14)


def sahne(key, t, yolcu=KAPASITE, yaw=None):
    sc = KO.SCENES[key]()
    seats = KG.SEATS[key]
    vpose, vhide, _, _ = sc['motion'](0)
    pose = copy.deepcopy(vpose)
    hidden = KO.hidden_for([key], vhide | {'k_flame'})
    oturan = min(yolcu, len(seats))
    for i in range(NMAX):
        pre = f'r{i}_'
        if i >= oturan:
            hidden.add(pre + 'root')
            continue
        skin = SKINS[i % len(SKINS)]
        hidden |= {pre + a for a in ACC - SHOW[skin]}
        rp = MO.pose_of(RANIM, [('idle', t + i * 0.21), ('sit', t + i * 0.37)])
        x, y, z = seats[i]
        r = rp.setdefault('root', {'r': [0, 0, 0], 'p': [0, 0, 0], 's': 1})
        r['p'] = [r['p'][0] * BIN - x * PX, r['p'][1] * BIN + y * PX, r['p'][2] * BIN - z * PX]
        r['s'] = BIN
        for bone, v in rp.items():
            pose[pre + bone] = v
    cam0 = sc['cam']
    cam = Z.Cam(yaw=(35 if yaw is None else yaw), elev=24, scale=cam0.scale * ZUM.get(key, 0.92), size=KO.SIZE,
                center=(0, 14 + 4 * (key in ZUM), 0))
    env = sc['env']('idle', 0, 0)
    img = Z.render(GEO, TEX, pose, hidden, cam, glow=GLOW, **env)
    return yazi(img, key, oturan, yolcu - oturan)


def yazi(img, key, oturan, iceride):
    img = img.convert('RGB')
    dr = ImageDraw.Draw(img)
    w, h = img.size
    dr.rounded_rectangle((8, 8, 8 + 200, 36), 8, fill=(12, 92, 98))
    dr.text((16, 12), f'{AD[key]}: {len(KG.SEATS[key])} yer', font=FNT, fill=(230, 255, 252))
    t2 = f'{oturan} robot dışarıda' + (f'  +{iceride} içeride' if iceride else '')
    tw = dr.textlength(t2, font=FNT2)
    dr.rounded_rectangle((8, h - 34, 20 + tw, h - 8), 8, fill=(20, 24, 28))
    dr.text((14, h - 30), t2, font=FNT2, fill=(64, 224, 208))
    return img


def gif():
    frames = []
    for key in ['ucak', 'gemi', 'denizalti', 'arazi', 'matkap']:
        base = 35
        n = 28
        for f in range(n):
            frames.append(sahne(key, f / 20, yaw=base + f * 360 / n))
    return Z.gif(frames, os.path.join(OUT, '64_kesif_koltuklar.gif'), ms=60)


def kart():
    keys = ['ucak', 'gemi', 'denizalti', 'arazi', 'matkap']
    ims = [sahne(k, 0.3) for k in keys]
    w, h = ims[0].size
    card = Image.new('RGB', (w * 3, h * 2), (24, 28, 32))
    for i, im in enumerate(ims):
        card.paste(im, ((i % 3) * w, (i // 3) * h))
    dr = ImageDraw.Draw(card)
    x0, y0 = 2 * w + 20, h + 30
    for j, line in enumerate(['Keşif en çok 10 robot taşır.', 'Koltuk, kanat, tavan ve üst üste',
                              'oturanlar dışarıda görünür.', 'Yer kalmazsa kalanlar aracın', 'içine girer (görünmez),',
                              'araç inince dışarı çıkar.']):
        dr.text((x0, y0 + j * 26), line, font=FNT, fill=(64, 224, 208) if j == 0 else (220, 230, 232))
    p = os.path.join(OUT, '64_kesif_koltuklar.png')
    card.save(p)
    return p


if __name__ == '__main__':
    print(kart())
    if 'kart' not in sys.argv:
        print(gif())
