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


def yuz(w, h, renk='M', sert=False, agiz=True):
    """Dron yüzü: koyu ekran, iki ışıklı göz, küçük ağız (Mimar dronu gibi sevimli)."""
    g = fill(w, h, renk)
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            g[y][x] = 'k'
    ex = [1, w - 3] if w >= 6 else [1, w - 2]
    for x in ex:
        if sert:
            g[1][x] = 'k'; g[1][x + (1 if x == ex[0] else -1) * 0] = 'k'
            g[2][x] = 'W'
            if x + 1 < w - 1:
                g[2][x + 1] = 'W'
        else:
            g[1][x] = 'W'; g[2][x] = 'W'
            if w >= 7 and x + 1 < w - 1:
                g[1][x + 1] = 'W'; g[2][x + 1] = 'W'
    if agiz and h >= 5:
        g[h - 2][w // 2] = 'W' if not sert else 'k'
    return g


def madenci(f):
    # gövde + madenci kaskı ve fener; iki yan kanatçıkta döner (tilt) pervaneler; altta mini matkap ucu
    kutu(f, 'g', 'govde', (-3, 3, -2.5), (3, 8, 2.5), base='M', front=yuz(6, 5), glow='W',
         top=panel(6, 5, 'L', t='H', b='D', l='H', r='D'))
    kutu(f, 'g', 'kask', (-3.5, 8, -3), (3.5, 9, 3), base='y', top=panel(7, 6, 'Y', t='W', b='Q', l='W', r='Q'))
    kutu(f, 'g', 'kask2', (-2.5, 9, -2), (2.5, 10, 2), base='Y')
    kutu(f, 'g', 'fener', (-1, 8, 3), (1, 10, 4), base='Q', front=rows('WW', 'WW'), glow='W')
    for ad, sx in (('l', -1), ('r', 1)):
        kutu(f, 'g', 'kanat_' + ad, (min(sx * 3, sx * 5), 5, -1), (max(sx * 3, sx * 5), 6, 1), base='&')
        kutu(f, 'g', 'nasel_' + ad, (sx * 5.5 - 1, 5, -1.5), (sx * 5.5 + 1, 7, 1.5), base='%', top=fill(2, 3, '*'))
        pervane(f, 'g', 'p_' + ad, (sx * 5.5, 7.5, 0), 3, 7.5)
    kutu(f, 'g', 'matkap1', (-1, 2, -1), (1, 3, 1), base='*')
    kutu(f, 'g', 'matkap2', (-0.5, 1, -0.5), (0.5, 2, 0.5), base='+')


def kurekci(f):
    # yassı gövde; Y düzeninde üç pervane (önde iki, arkada bir); kum rengi alt etek; önde mini kepçe kolu
    kutu(f, 'g', 'govde', (-3, 3, -3), (3, 7, 3), base='M', front=yuz(6, 4, agiz=False), glow='W',
         top=panel(6, 6, 'L', t='H', b='D', l='H', r='D'))
    kutu(f, 'g', 'etek', (-3.5, 2.5, -3.5), (3.5, 3.5, 3.5), base='N', top=fill(7, 7, 'n'))
    for ad, (x, z) in (('fl', (-5, 3)), ('fr', (5, 3)), ('b', (0, -6))):
        a = (min(0, x) if x else -0.5, 6, min(0, z)); b = (max(0, x) if x else 0.5, 7, max(0, z))
        if x == 0:
            a, b = (-0.5, 6, z), (0.5, 7, -3)
        else:
            a, b = (min(x * 0.6, x), 6, min(z * 0.6, z) - 0.5 + 0.5), (max(x * 0.6, x), 7, max(z * 0.6, z) + 0.5 + 0.5)
            a = (round(a[0]), 6, round(a[2])); b = (round(b[0]), 7, round(b[2]))
            if b[2] - a[2] < 1:
                b = (b[0], 7, a[2] + 1)
        kutu(f, 'g', 'kol_' + ad, a, b, base='&')
        pervane(f, 'g', 'p_' + ad, (x, 7.5, z), 3, 7.5)
    kutu(f, 'g', 'kepce_kol', (-0.5, 3, 3), (0.5, 4, 5), base='&')
    kutu(f, 'g', 'kepce', (-1.5, 2, 5), (1.5, 4, 6), base='*', front=rows('*+*', '***'))


def ciftci(f):
    # gövde + hasır şapka kenarı; şapkanın tepesinden çıkan filiz; filizin iki yaprağı pervane gibi döner
    kutu(f, 'g', 'govde', (-2.5, 3, -2.5), (2.5, 8, 2.5), base='M', front=yuz(5, 5), glow='W',
         top=panel(5, 5, 'L', t='H', b='D', l='H', r='D'))
    kutu(f, 'g', 'sapka_kenar', (-4, 8, -4), (4, 9, 4), base='w', top=panel(8, 8, 'w', t='x', b='X', l='x', r='X'))
    kutu(f, 'g', 'sapka_tepe', (-2, 9, -2), (2, 10, 2), base='x', front=rows('RRRR'))
    kutu(f, 'g', 'filiz', (-0.5, 10, -0.5), (0.5, 12, 0.5), base='e')
    f.bone('p_yaprak', 'g', (0, 12.5, 0))
    kutu(f, 'p_yaprak', 'yaprak1', (-5.5, 12, -1), (-0.5, 13, 1), base='f', top=rows('Effef', 'fEeff'))
    kutu(f, 'p_yaprak', 'yaprak2', (0.5, 12, -1), (5.5, 13, 1), base='f', top=rows('feffE', 'ffeEf'))
    kutu(f, 'g', 'itici', (-1, 2, -1), (1, 3, 1), base='L', bottom=rows('HW', 'WH'), glow='W')


def oduncu(f):
    # uzun gövde; önde ve arkada iki büyük pervane (çift rotorlu helikopter gibi); yeşil atkı; yan kolda balta
    kutu(f, 'g', 'govde', (-2.5, 3, -4), (2.5, 7, 4), base='M', front=yuz(5, 4, agiz=False), glow='W',
         top=panel(5, 8, 'L', t='H', b='D', l='H', r='D'))
    kutu(f, 'g', 'atki', (-3, 3, -1.5), (3, 4, 1.5), base='E', front=rows('EfEfEf'), top=fill(6, 3, 'E'))
    kutu(f, 'g', 'atki_uc', (2, 1, -1), (3, 3, 0), base='E')
    for ad, z in (('on', 4), ('arka', -4)):
        kutu(f, 'g', 'direk_' + ad, (-0.5, 7, z - 0.5 - (0 if z > 0 else 0)), (0.5, 8 + (1 if z < 0 else 0), z + 0.5), base='%')
        pervane(f, 'g', 'p_' + ad, (0, 8.5 + (1 if z < 0 else 0), z), 3, 8.5)
    kutu(f, 'g', 'balta_sap', (-4, 3, 0), (-3, 7, 1), base='m')
    kutu(f, 'g', 'balta_bas', (-5, 5, 0), (-4, 7, 2), base='*', left=rows('+*', '**'))


def kilicli(f):
    # sivri, köşeli hızlı gövde; çatık gözler; çapraz 4 küçük pervane (yarış dronu); arkada kırmızı pelerin kanadı
    kutu(f, 'g', 'govde', (-2.5, 3, -3), (2.5, 6, 3), base='r', front=over(fill(5, 3, 'r'), rows('WkW', 'kWk'), 1, 0), glow='W',
         top=panel(5, 6, 'R', t='y', b='q', l='y', r='q'))
    kutu(f, 'g', 'burun', (-1.5, 3.5, 3), (1.5, 5.5, 4), base='y', front=rows('yyy', 'QyQ'))
    kutu(f, 'g', 'pelerin', (-2, 4, -5), (2, 6, -3), base='q', back=rows('RRRR', 'qqqq'), top=fill(4, 2, 'R'))
    for ad, sx, sz in (('fl', 1, 1), ('fr', -1, 1), ('bl', 1, -1), ('br', -1, -1)):
        kutu(f, 'g', 'kol_' + ad, (min(sx * 2, sx * 4), 5, min(sz * 2, sz * 4)), (max(sx * 2, sx * 4), 6, max(sz * 2, sz * 4)),
             base='%')
        pervane(f, 'g', 'p_' + ad, (sx * 4.5, 6.5, sz * 4.5), 2, 6.5)
    kutu(f, 'g', 'kilic_kabza', (-1.5, 2, -0.5), (1.5, 3, 0.5), base='y')
    kutu(f, 'g', 'kilic', (-0.5, -2, -0.5), (0.5, 2, 0.5), base='+', front=rows('+', '+', '+', '*'))


def organizator(f, cam=True):
    # dik duran ince tablet (ekranı öne bakar), cam ekranın ardında gözler; üst köşelerde iki pervane; mor şerit;
    # tepede kulaklık bandı ve mikrofon anteni
    on = fill(8, 6, '1')
    for x in range(8):
        on[0][x] = '3'; on[5][x] = 'P'
    for y in range(1, 5):
        for x in range(1, 7):
            on[y][x] = 'k'
    over(on, rows('W  W', 'W  W'), 2, 2)
    for y in (2, 3):
        on[y][3] = 'k'; on[y][4] = 'k'
    kutu(f, 'g', 'tablet', (-4, 3, -1), (4, 9, 1), base='1', front=on, glow='WP',
         top=fill(8, 2, '3'), back=fill(8, 6, '2'))
    if cam:
        kutu(f, 'g', 'cam', (-3, 4, 1), (3, 8, 2), base='<', front=rows('~9~<<<', '<<<<<<', '<<<<<<', '^^^^^^'))
    for ad, sx in (('l', -1), ('r', 1)):
        kutu(f, 'g', 'direk_' + ad, (sx * 3.5 - 0.5, 9, -0.5), (sx * 3.5 + 0.5, 10, 0.5), base='%')
        pervane(f, 'g', 'p_' + ad, (sx * 3.5, 10.5, 0), 3, 10.5)
    kutu(f, 'g', 'kulaklik', (-1.5, 9, -0.5), (1.5, 10, 0.5), base='g')
    kutu(f, 'g', 'mikrofon', (-0.5, 10, -0.5), (0.5, 12, 0.5), base='g')
    kutu(f, 'g', 'mikrofon_uc', (-1, 12, -1), (1, 13, 1), base='P', glow='P')


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
    for ad in ('p_l', 'p_r', 'p_fl', 'p_fr', 'p_bl', 'p_br', 'p_b', 'p_on', 'p_arka'):
        p[ad] = [0, t * 2880, 0]
    p['p_yaprak'] = [0, t * 1440, 0]
    p['halka'] = [0, t * 360, 0]   # GIF 72 kare x 60 ms = ~4,3 sn'de bir tur (ne hızlı ne çok yavaş)
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
    for i in range(72):
        t = i / 72
        c = Image.new('RGB', (7 * 170, 230), (24, 28, 32))
        for k, tur in enumerate(TURLER):
            cam = Z.Cam(yaw=25 + 360 * t, elev=20, scale=11, size=(170, 230), center=(0, 6, 0))
            c.paste(ciz(tur, cam, t, M, C), (k * 170, 0))
        frames.append(c)
    print(Z.gif(frames, os.path.join(OUT, '84_evcil_dronlar.gif'), ms=60))
    imgs = [(ciz(tur, Z.Cam(yaw=30, elev=18, scale=11, size=(170, 220), center=(0, 6, 0)), 0.1, M, C), ADLAR[tur])
            for tur in TURLER]
    print(kart('Evcil mini dronlar · 3. tasarım (hepsi dron, her biri ayrı pervane düzeni)', imgs, os.path.join(OUT, '84_evcil_dronlar.png'),
               alt='Mimar ve Keşif dronları zaten var. Hepsi omuzda süzülür.'))
