#!/usr/bin/env python3
"""Keşif araçlarının oturma planları (her araç ayrı) — 3B önizleme.

Koltuklar oyundakinin aynısı (addon/gen/kesif_oyun.py SEATS, model pikseli); araçlar 1.4, robotlar 0.8 ölçekli.
Binen robot oturur, uçağın tekerleğindekiler tutunur (oyundaki 'sit' ve 'tutun' hareketleri).
Çıktılar: onizleme/64_oturma_<araç>.png (eğik + yukarıdan numaralı plan), 64_oturma_<araç>.gif (dönen),
          onizleme/65_matkap_ici.png (arka kapı, platform ve kesit görünüm)
"""
import copy
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont
import numpy as np

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
SCR = MO.SCR
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
BIN = 0.8 / KG.VS                 # robot pikseli → araç pikseli
SKINS = ['madenci', 'kilicli_1', 'kilicli_2']
ACC = {'helmet', 'antenna_ball20', 'sand_bag', 'antenna_ball19', 'hat', 'antenna_sprout23', 'scarf', 'antenna_leaf19',
       'cape', 'right_shoulder', 'left_shoulder', 'kova', 'hardhat', 'toolbelt', 'blueprint', 'antenna_ball24',
       'headset', 'cap', 'visor', 'backpack'}
SHOW = {'madenci': {'helmet', 'antenna_ball20'}, 'kilicli_1': {'cape', 'antenna_ball19'},
        'kilicli_2': {'cape', 'antenna_ball19', 'right_shoulder', 'left_shoulder'}}
AD = {'ucak': 'Uçak', 'gemi': 'Gemi', 'denizalti': 'Denizaltı', 'arazi': 'Arazi aracı', 'matkap': 'Matkap'}
TUR = {'koltuk': 'koltuk', 'kanat': 'kanat', 'arka_kanat': 'arka kanat', 'tutun': 'tekerleğe tutunur',
       'guverte': 'güverte', 'bas': 'pruva', 'kic': 'kıç', 'tavan': 'tavan', 'ust': 'üst üste', 'kaput': 'kaput',
       'camurluk': 'çamurluk', 'ic': 'içeride', 'platform': 'arka platform'}
RENK = {'koltuk': (64, 224, 208), 'kanat': (255, 196, 70), 'arka_kanat': (255, 150, 60), 'tutun': (255, 90, 90),
        'guverte': (120, 200, 255), 'bas': (120, 200, 255), 'kic': (120, 200, 255), 'tavan': (200, 140, 255),
        'ust': (255, 120, 220), 'kaput': (160, 230, 120), 'camurluk': (160, 230, 120), 'ic': (255, 230, 120),
        'platform': (120, 200, 255)}
NMAX = 10
KESIT_YAW = float(os.environ.get('KESIT_YAW', -120))
CAM = {'ucak': (5.6, (0, 12, -10)), 'gemi': (6.0, (0, 19, 0)), 'denizalti': (6.6, (0, 16, -4)),
       'arazi': (6.4, (0, 21, 0)), 'matkap': (6.6, (0, 14, -8))}


def birlesik():
    """Keşif + 10 robot tek geometri/doku (robot dokuları Keşif dokusunun altında yan yana)."""
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


def kesit_geo(gizle):
    """Bazı kutuları (parça adına göre) çıkarılmış geometri: kesit görünümü için."""
    import kesif as K
    geo = copy.deepcopy(GEO)
    by = {b['name']: b for b in geo['minecraft:geometry'][0]['bones']}
    sil = {}
    sayac = {}
    for fm in K.all_forms().values():
        for p in fm.parts:
            i = sayac.get(p.bone, 0)
            sayac[p.bone] = i + 1
            if p.box.name in gizle:
                sil.setdefault(p.bone, set()).add(i)
    for bone, idx in sil.items():
        by[bone]['cubes'] = [c for i, c in enumerate(by[bone]['cubes']) if i not in idx]
    return geo
RANIM = {k.split('.')[-1]: v for k, v in E.robot_animations()['animations'].items()}
FNT = ImageFont.truetype(FONT, 17)
FNT2 = ImageFont.truetype(FONT, 13)
FNT3 = ImageFont.truetype(FONT, 11)


def poz(key, t, extra_hide=()):
    sc = KO.SCENES[key]()
    vpose, vhide, _, _ = sc['motion'](0)
    pose = copy.deepcopy(vpose)
    hidden = KO.hidden_for([key], set(vhide) | {'k_flame', 'u_flame'} | set(extra_hide))
    seats = [] if key in KG.YALNIZ_OYUNCU else KG.SEATS[key]
    if key == 'matkap' and seats:
        pose['m_door'] = [0, KG.KAPI_ACI, 0]       # robotlar binmişken kapı açık
    for i in range(NMAX):
        pre = f'r{i}_'
        if i >= len(seats):
            hidden.add(pre + 'root')
            continue
        skin = SKINS[i % len(SKINS)]
        hidden |= {pre + a for a in ACC - SHOW[skin]}
        x, y, z, tur = seats[i]
        an = 'tutun' if tur == 'tutun' else 'sit'
        rp = MO.pose_of(RANIM, [('idle', t + i * 0.21), (an, t + i * 0.37)])
        r = rp.setdefault('root', {'r': [0, 0, 0], 'p': [0, 0, 0], 's': 1})
        r['p'] = [r['p'][0] * BIN - x, r['p'][1] * BIN + y, r['p'][2] * BIN - z]
        r['s'] = BIN
        for bone, v in rp.items():
            pose[pre + bone] = v
    return pose, hidden, sc


def ciz(key, t, yaw=35, elev=24, size=(520, 400), extra_hide=(), zoom=1.0, center=None, env=True):
    pose, hidden, sc = poz(key, t, extra_hide)
    sc_, c = CAM[key]
    cam = Z.Cam(yaw=yaw, elev=elev, scale=sc_ * zoom * size[0] / 520, size=size, center=center or c)
    kw = sc['env']('idle', 0, 0) if env else {'ground': {'y': 0, 'color': (58, 66, 74)}}
    if key == 'ucak' and env:
        kw = dict(kw)
        kw.pop('bg_image', None)
        kw['bg'] = (150, 200, 240)
    return Z.render(GEO, TEX, pose, hidden, cam, glow=GLOW, **kw).convert('RGB'), cam


def numaralar(img, cam, key):
    seats = KG.SEATS[key]
    dr = ImageDraw.Draw(img)
    pts = np.array([[-x, y + 4, -z] for x, y, z, _ in seats], float)
    sp, _ = cam.proj(pts)
    for i, ((sx, sy), s) in enumerate(zip(sp, seats)):
        c = RENK[s[3]]
        dr.ellipse((sx - 9, sy - 9, sx + 9, sy + 9), fill=(20, 24, 28), outline=c, width=2)
        t = str(i + 1)
        tw = dr.textlength(t, font=FNT3)
        dr.text((sx - tw / 2, sy - 7), t, font=FNT3, fill=c)
    return img


def baslik(img, txt, alt=None):
    dr = ImageDraw.Draw(img)
    tw = dr.textlength(txt, font=FNT)
    dr.rounded_rectangle((8, 8, 24 + tw, 36), 8, fill=(12, 92, 98))
    dr.text((16, 12), txt, font=FNT, fill=(230, 255, 252))
    if alt:
        w, h = img.size
        aw = dr.textlength(alt, font=FNT2)
        dr.rounded_rectangle((8, h - 32, 20 + aw, h - 8), 8, fill=(20, 24, 28))
        dr.text((14, h - 29), alt, font=FNT2, fill=(64, 224, 208))
    return img


def plan_karti(key):
    seats = KG.SEATS[key]
    oyuncu = key in KG.YALNIZ_OYUNCU
    a, _ = ciz(key, 0.3)
    alt = ('Robotların hepsi içeride (dışarıda boğulurlar)' if oyuncu
           else f'{len(seats)} robot yeri; fazlası içeri girer, inince çıkar')
    baslik(a, f'{AD[key]} — oturma planı', alt)
    b, cam = ciz(key, 0.3, yaw=180.01, elev=89.5, env=False, zoom=0.62 if key in ('matkap', 'ucak') else 0.8)
    if not oyuncu:
        numaralar(b, cam, key)
    baslik(b, 'Yukarıdan (ön yukarıda)')
    w, h = a.size
    card = Image.new('RGB', (w * 2, h + 160), (24, 28, 32))
    card.paste(a, (0, 0))
    card.paste(b, (w, 0))
    dr = ImageDraw.Draw(card)
    if oyuncu:
        lines = [((64, 224, 208), '1  koltuk: sürücü (oyuncu)'),
                 ((255, 230, 120), 'Robotlar denizaltına binince içeri girer (görünmez), su altında boğulmazlar.'),
                 ((220, 230, 232), 'Araç robot ya da başka araç olunca, inince dışarı çıkarlar.')]
        for j, (c, ln) in enumerate(lines):
            dr.text((16, h + 12 + j * 28), ln, font=FNT2, fill=c)
    else:
        for j, s in enumerate(seats):
            ln = f'{j + 1}  {TUR[s[3]]}' + ('  (oyuncu binerse sürücü)' if j == 0 else '')
            dr.text((16 + (j % 3) * (w * 2 // 3), h + 12 + (j // 3) * 28), ln, font=FNT2, fill=RENK[s[3]])
    p = os.path.join(OUT, f'64_oturma_{key}.png')
    card.save(p)
    return p


def gif(key, n=36):
    frames = []
    for f in range(n):
        img, _ = ciz(key, f / 20, yaw=35 + f * 360 / n, size=(440, 340))
        frames.append(baslik(img, AD[key]))
    return Z.gif(frames, os.path.join(OUT, f'64_oturma_{key}.gif'), ms=70)


def matkap_ici():
    """Arka kapı + platform (arkadan) ve kesit (tavan, sağ duvar, kabin gizli: içerideki 4 robot)."""
    a, _ = ciz('matkap', 0.3, yaw=200, elev=20, size=(520, 400))
    baslik(a, 'Matkap: arka kapı ve platform', '5 robot platformda, 4 robot içeride')
    ust = {'m_ceil', 'm_wall_l', 'm_cabin', 'm_roof', 'm_lamp_l', 'm_lamp_r', 'm_radar_mast', 'm_radar_dish',
           'm_radar_feed', 'm_exh_l', 'm_exh_r', 'm_seat', 'm_collar_top', 'm_back_l', 'm_door_l', 'm_rail_l'}
    geo = kesit_geo(ust)
    pose, hidden, sc = poz('matkap', 0.3)
    hidden |= {'m_radar'}
    hidden |= {f'r{i}_root' for i in (0, 5, 6, 7)}
    cam = Z.Cam(yaw=KESIT_YAW, elev=42, scale=8.6, size=(520, 400), center=(0, 8, -10))
    b = Z.render(geo, TEX, pose, hidden, cam, glow=GLOW, ground={'y': 0, 'color': (58, 66, 74)}).convert('RGB')
    baslik(b, 'Kesit: matkabın içi', 'Tavan lambası, radar ekranı, duvar lambaları')
    card = Image.new('RGB', (1040, 400), (24, 28, 32))
    card.paste(a, (0, 0))
    card.paste(b, (520, 0))
    p = os.path.join(OUT, '65_matkap_ici.png')
    card.save(p)
    return p


if __name__ == '__main__':
    keys = [k for k in sys.argv[1:] if k in AD] or list(AD)
    for k in keys:
        print(plan_karti(k))
    if 'matkap' in keys:
        print(matkap_ici())
    if 'gif' in sys.argv:
        for k in keys:
            print(gif(k))
