"""Evcil mini dronlar (2. tasarım): her robot türü için ayrı biçim (Mimar ve Keşif dronları kadar farklı).
  Madenci     : kask biçimli gövde, önde büyük fener (tek göz gibi), yanlarda iki küçük pervane, alttan sarkan mini kazma
  Kürekçi     : kova biçimli gövde (altı dar), içinde kum, arkada itici pervane, kürek ağzı kuyruk
  Çiftçi      : saksı gövde, tepesinde dönen iki büyük yaprak (pervane yerine), hasır kenarlı ağız
  Oduncu      : yatay kütük gövde (halkalı uçlar), sırtında yaprak tutamı, iki yan kolda pervane, balta kuyruk
  Kılıçlı     : dik kalkan gövde (amblemli), çatık bakış, altta omurga gibi kılıç, arkada pelerin, tepede ikili pervane
  Organizatör : yassı tablet (cam ekranlı), dört köşede gömülü pervane, mor şerit, kulaklık anteni
  Portalcı    : süzülen portal halkası, ortasında gözlü küre; pervanesiz (portal enerjisiyle süzülür)"""
import math
import os
import numpy as np
from PIL import Image
from ortak import Form, kutu, fill, rows, panel, over, kart, OUT, Z, model

TURLER = ['madenci', 'kurekci', 'ciftci', 'oduncu', 'kilicli', 'organizator', 'portalci']
ADLAR = {'madenci': 'Madenci', 'kurekci': 'Kürekçi', 'ciftci': 'Çiftçi', 'oduncu': 'Oduncu', 'kilicli': 'Kılıçlı',
         'organizator': 'Organizatör', 'portalci': 'Portalcı'}
GOZ = rows('WkW', 'WkW')


def pervane(f, bone, ad, c, r, y, eksen='y'):
    """c merkezli, r yarıçaplı 2 kanatlı pervane kemiği (eksen y: yatay döner, z: dik döner)."""
    f.bone(ad, bone, c)
    x, yy, z = c
    if eksen == 'y':
        kutu(f, ad, ad + 'a', (x - r, yy - 0.5, z - 0.5), (x + r, yy + 0.5, z + 0.5), base='D',
             top=[list(('kL' + 'H' * (2 * r - 4) + 'Lk')[:2 * r])])
        kutu(f, ad, ad + 'b', (x - 0.5, yy - 0.5, z - r), (x + 0.5, yy + 0.5, z + r), base='D',
             top=[[c_] for c_ in ('kL' + 'H' * (2 * r - 4) + 'Lk')[:2 * r]])
    else:
        kutu(f, ad, ad + 'a', (x - r, yy - 0.5, z - 0.5), (x + r, yy + 0.5, z + 0.5), base='D',
             front=[list(('kL' + 'H' * (2 * r - 4) + 'Lk')[:2 * r])])
        kutu(f, ad, ad + 'b', (x - 0.5, yy - r, z - 0.5), (x + 0.5, yy + r, z + 0.5), base='D',
             front=[[c_] for c_ in ('kL' + 'H' * (2 * r - 4) + 'Lk')[:2 * r]])


def madenci(f):
    # kask gövde: geniş kenar + kubbe katları; önde fener; altta yüz şeridi (iki göz)
    kutu(f, 'g', 'yuz', (-2.5, 3, -2.5), (2.5, 5, 2.5), base='M', front=rows('kWkWk', 'kkkkk'), glow='W')
    kutu(f, 'g', 'kenar', (-4, 5, -4), (4, 6, 4), base='y', top=panel(8, 8, 'Y', t='W', b='Q', l='W', r='Q'))
    kutu(f, 'g', 'kubbe1', (-3, 6, -3), (3, 8, 3), base='Y', front=rows('YYYYYY', 'yyyyyy'))
    kutu(f, 'g', 'kubbe2', (-2, 8, -2), (2, 9, 2), base='Y', top=rows('WYYY', 'YYYY', 'YYYQ', 'YYQQ'))
    kutu(f, 'g', 'fener', (-1.5, 6, 3), (1.5, 8, 5), base='Q', front=rows('WWW', 'WWW'), glow='W')
    for ad, x in (('l', -5), ('r', 5)):
        kutu(f, 'g', 'kol_' + ad, (min(x, x * 0.8), 5, -0.5), (max(x, x * 0.8), 6, 0.5), base='&')
        pervane(f, 'g', 'p_' + ad, (x, 6.5, 0), 2, 6.5)
    kutu(f, 'g', 'kazma_sap', (-0.5, 0, -0.5), (0.5, 3, 0.5), base='m')
    kutu(f, 'g', 'kazma_bas', (-2.5, 0, -0.5), (2.5, 1, 0.5), base='*', front=rows('+***+'))


def kurekci(f):
    # kova: üst geniş (6x6), alt dar (4x4); kum dolu; tutma sapı; arkada itici pervane; önde göz bandı
    kutu(f, 'g', 'kova_alt', (-2, 2, -2), (2, 4, 2), base='&', front=rows('&&&&', '%%%%'))
    kutu(f, 'g', 'kova_ust', (-3, 4, -3), (3, 7, 3), base='*', front=rows('+++++++'[:6], '*kWkW*'[:6], '******'),
         top=over(fill(6, 6, 'n'), rows('NnN', 'nNn'), 1, 2), glow='W')
    kutu(f, 'g', 'sap_l', (-3.5, 7, -0.5), (-2.5, 9, 0.5), base='%')
    kutu(f, 'g', 'sap_r', (2.5, 7, -0.5), (3.5, 9, 0.5), base='%')
    kutu(f, 'g', 'sap_ust', (-3.5, 9, -0.5), (3.5, 10, 0.5), base='%')
    kutu(f, 'g', 'motor', (-1, 4, -5), (1, 6, -3), base='%')
    pervane(f, 'g', 'p_arka', (0, 5, -5.5), 3, 5, eksen='z')
    kutu(f, 'g', 'kurek', (-1.5, 0, 1), (1.5, 2, 2), base='*', front=rows('+*+', '***'))


def ciftci(f):
    # saksı: altı dar toprak rengi, üst ağız hasır; önde gözler; tepede filiz ve dönen iki büyük yaprak
    kutu(f, 'g', 'saksi_alt', (-2, 2, -2), (2, 3, 2), base='C')
    kutu(f, 'g', 'saksi', (-2.5, 3, -2.5), (2.5, 7, 2.5), base='A', front=rows('AAAAA', 'kWkWk', 'kWkWk', 'CCCCC'), glow='W')
    kutu(f, 'g', 'agiz', (-3, 7, -3), (3, 8, 3), base='w', top=over(fill(6, 6, 'm'), rows('mo', 'om'), 2, 2),
         front=rows('wxwxwx'))
    kutu(f, 'g', 'filiz', (-0.5, 8, -0.5), (0.5, 11, 0.5), base='e')
    f.bone('p_yaprak', 'g', (0, 11, 0))
    kutu(f, 'p_yaprak', 'yaprak1', (-5.5, 10.5, -1), (-0.5, 11.5, 1), base='f', top=rows('Effef', 'fEeff'))
    kutu(f, 'p_yaprak', 'yaprak2', (0.5, 10.5, -1), (5.5, 11.5, 1), base='f', top=rows('feffE', 'ffeEf'))


def oduncu(f):
    # yatay kütük (z boyunca), uçlarında yıllık halkalar; önde gözler; sırtta yaprak tutamı; iki yan kol + pervane
    halka = rows('mooom'[:5], 'ommmo', 'omxmo', 'ommmo', 'mooom')
    kutu(f, 'g', 'kutuk', (-2.5, 3, -3.5), (2.5, 8, 3.5), base='m',
         front=over([r[:] for r in halka], rows('W W'), 1, 1), back=halka,
         left=[['m' if (j % 3) else 'o' for j in range(7)] for _ in range(5)],
         right=[['m' if (j % 3) else 'o' for j in range(7)] for _ in range(5)],
         top=[['o' if j % 3 == 0 else 'm' for j in range(5)] for _ in range(7)], glow='W')
    kutu(f, 'g', 'yaprak', (-1.5, 8, -1.5), (1.5, 9, 1.5), base='e', top=rows('fEf', 'EfE', 'fEf'))
    kutu(f, 'g', 'yaprak2', (-0.5, 9, -0.5), (0.5, 10, 0.5), base='f')
    for ad, x in (('l', -5.5), ('r', 5.5)):
        sx = 1 if x > 0 else -1
        kutu(f, 'g', 'kol_' + ad, (min(sx * 2.5, sx * 4.5), 6, -0.5), (max(sx * 2.5, sx * 4.5), 7, 0.5), base='&')
        pervane(f, 'g', 'p_' + ad, (x, 7.5, 0), 3, 7.5)
    kutu(f, 'g', 'balta_sap', (-0.5, 4, -6), (0.5, 5, -3), base='m')
    kutu(f, 'g', 'balta_bas', (-0.5, 3, -7), (0.5, 6, -6), base='*', back=rows('+', '*', '*'))


def kilicli(f):
    # dik kalkan: üst geniş, alt sivri (basamaklı), kırmızı-altın amblem; çatık gözler; altta omurga kılıç; pelerin
    kutu(f, 'g', 'kalkan1', (-3, 6, -1), (3, 9, 1), base='r', front=rows('yyyyyy', 'RWkkWR', 'rkWWkr'), glow='W')
    kutu(f, 'g', 'kalkan2', (-2, 4, -1), (2, 6, 1), base='r', front=rows('ryyr', 'rrrr'))
    kutu(f, 'g', 'kalkan3', (-1, 3, -1), (1, 4, 1), base='r', front=rows('yy'))
    kutu(f, 'g', 'pelerin', (-2.5, 3, -2), (2.5, 8, -1), base='q', back=over(fill(5, 5, 'q'), rows('RRRRR'), 0, 0))
    kutu(f, 'g', 'kilic_kabza', (-1.5, 2, -0.5), (1.5, 3, 0.5), base='y')
    kutu(f, 'g', 'kilic', (-0.5, -3, -0.5), (0.5, 2, 0.5), base='+', front=rows('+', '+', '+', '+', '*'))
    kutu(f, 'g', 'direk', (-0.5, 9, -0.5), (0.5, 10, 0.5), base='%')
    f.bone('p_ikili', 'g', (0, 10.5, 0))
    for k, z in enumerate((-2, 2)):
        kutu(f, 'p_ikili', f'pk{k}', (-3.5, 10, z - 0.5), (3.5, 11, z + 0.5), base='D', top=rows('kLHHHLk'))
    kutu(f, 'p_ikili', 'pk_orta', (-0.5, 10, -2.5), (0.5, 11, 2.5), base='%')


def organizator(f, cam=True):
    # yassı tablet (8x2x8): üstte cam ekran ve gözler; dört köşede gömülü pervane; mor şerit; kulaklık anteni
    kutu(f, 'g', 'tablet', (-4, 4, -4), (4, 6, 4), base='1', front=rows('1PPPPPP1', '22222222'), glow='P',
         top=panel(8, 8, '3', t='Z', b='2', l='Z', r='2'))
    kutu(f, 'g', 'ekran', (-2.5, 6, -1), (2.5, 7, 3), base='k', top=rows('kkkkk', 'kWkWk', 'kWkWk', 'kkkkk'), glow='W')
    if cam:
        kutu(f, 'g', 'cam', (-2.5, 7, -1), (2.5, 8, 3), base='<', top=rows('~9~<<', '<<<<<', '<<<<<', '^^^^^'))
    for ad, sx, sz in (('fl', 1, 1), ('fr', -1, 1), ('bl', 1, -1), ('br', -1, -1)):
        pervane(f, 'g', 'p_' + ad, (sx * 4, 6.5, sz * 4), 2, 6.5)
    kutu(f, 'g', 'kulaklik', (-2.5, 6, -3), (2.5, 7, -2), base='g')
    kutu(f, 'g', 'anten', (-0.5, 7, -2.5), (0.5, 10, -1.5), base='g')
    kutu(f, 'g', 'anten_uc', (-1, 10, -2.5), (1, 11, -1.5), base='P', glow='P')


def portalci(f):
    # süzülen halka (dik, 9x9), ortasında gözlü küre; halka döner; pervanesiz
    f.bone('halka', 'g', (0, 6.5, 0))
    for nm, aa, bb in (('u', (-4.5, 10, -0.5), (4.5, 11, 0.5)), ('a', (-4.5, 2, -0.5), (4.5, 3, 0.5)),
                       ('l', (-4.5, 3, -0.5), (-3.5, 10, 0.5)), ('r', (3.5, 3, -0.5), (4.5, 10, 0.5))):
        w_, h_ = int(bb[0] - aa[0]), int(bb[1] - aa[1])
        kutu(f, 'halka', 'h_' + nm, aa, bb, base='ğ', glow='ğüÇ',
             front=[['ü' if (i + j) % 3 == 0 else 'ğ' for i in range(w_)] for j in range(h_)],
             back=[['ü' if (i + j) % 3 == 1 else 'ğ' for i in range(w_)] for j in range(h_)])
    kutu(f, 'g', 'kure', (-2, 4.5, -2), (2, 8.5, 2), base='3', front=rows('3333', '3W3W', '3W3W', '3333')[:4], glow='Wü',
         top=rows('3üü3', 'ü33ü', 'ü33ü', '3üü3'))
    kutu(f, 'g', 'iz', (-0.5, 1, -0.5), (0.5, 2, 0.5), base='ü', glow='ü')


CIZ = {'madenci': madenci, 'kurekci': kurekci, 'ciftci': ciftci, 'oduncu': oduncu, 'kilicli': kilicli,
       'organizator': organizator, 'portalci': portalci}


def evcil(tur, cam=True):
    f = Form(f'evcil_{tur}', ADLAR[tur])
    f.bone('root', None, (0, 0, 0))
    f.bone('g', 'root', (0, 5, 0))
    if tur == 'organizator':
        organizator(f, cam)
    else:
        CIZ[tur](f)
    return f


def poz(t, tur):
    p = {'g': {'p': [0, math.sin(t * 6.283) * 0.5, 0]}}
    for ad in ('p_l', 'p_r', 'p_fl', 'p_fr', 'p_bl', 'p_br', 'p_ikili'):
        p[ad] = [0, t * 1440, 0]
    p['p_yaprak'] = [0, t * 720, 0]
    p['p_arka'] = [0, 0, t * 1440]
    p['halka'] = [0, t * 360, 0]
    return p


def ciz(tur, cam, t, M, C):
    a = Z.render(*M[tur][:2], poz(t, tur), (), cam, glow=M[tur][2], ground={'y': -3, 'color': (58, 66, 74)}).convert('RGB')
    if tur not in C:
        return a
    b = Z.render(*C[tur][:2], poz(t, tur), (), cam, glow=C[tur][2], ground={'y': -3, 'color': (58, 66, 74)}).convert('RGB')
    a, b = np.asarray(a, np.float32), np.asarray(b, np.float32)
    m = (np.abs(a - b).sum(2) > 6)[:, :, None]
    return Image.fromarray(np.where(m, b * 0.5 + a * 0.5, a).clip(0, 255).astype(np.uint8))


if __name__ == '__main__':
    M = {t: model(evcil(t), W=128) for t in TURLER}
    C = {'organizator': model(evcil('organizator', False), W=128)}
    frames = []
    for i in range(36):
        t = i / 36
        c = Image.new('RGB', (7 * 170, 230), (24, 28, 32))
        for k, tur in enumerate(TURLER):
            cam = Z.Cam(yaw=25 + 360 * t, elev=20, scale=11, size=(170, 230), center=(0, 6, 0))
            c.paste(ciz(tur, cam, t, M, C), (k * 170, 0))
        frames.append(c)
    print(Z.gif(frames, os.path.join(OUT, '84_evcil_dronlar.gif'), ms=60))
    imgs = [(ciz(tur, Z.Cam(yaw=30, elev=18, scale=11, size=(170, 220), center=(0, 6, 0)), 0.1, M, C), ADLAR[tur])
            for tur in TURLER]
    print(kart('Evcil mini dronlar · 2. tasarım (her biri ayrı biçim)', imgs, os.path.join(OUT, '84_evcil_dronlar.png'),
               alt='Mimar ve Keşif dronları zaten var. Hepsi omuzda süzülür.'))
