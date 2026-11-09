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


from robot import plate, put, G


def yuz6(renk='M', sert=False):
    """Mimar dronundaki yüz (6x5): iki dik göz, gülen ağız, pembe yanaklar. sert: kısık gözler, düz ağız."""
    g = plate(6, 5, renk, top='H', bottom='D', left='H', right='D')
    put(g, ['WkkW', 'WkkW'] if not sert else ['kkkk', 'WkkW'], 1, 1)
    if sert:
        g[3][2] = g[3][3] = 'k'
        g[3][1] = g[3][4] = 'R'
    else:
        g[3][2] = g[3][3] = 'k'
        g[3][1] = g[3][4] = 'R'
    return g


def govde6(f, renk='M', sert=False, y0=3):
    """Mimar dronu boyunda gövde (6x5x6), önde yüz."""
    yan = plate(6, 5, renk, top='H', bottom='D', left='L', right='D')
    yan[2][2] = yan[2][3] = 'L'
    kutu(f, 'g', 'govde', (-3, y0, -3), (3, y0 + 5, 3), base=renk, front=yuz6(renk, sert), left=yan,
         right=[r[:] for r in yan], back=plate(6, 5, renk), top=plate(6, 6, 'L', top='H', bottom='M', left='H', right='M'),
         glow='W')


def madenci(f):
    # madenci kaskı + fener; tepede kazma başı biçimli pervane (iki sivri ucu hafif aşağı kıvrık)
    govde6(f)
    kutu(f, 'g', 'kask', (-4, 8, -4), (4, 9, 4), base='y', top=panel(8, 8, 'Y', t='W', b='Q', l='W', r='Q'))
    kutu(f, 'g', 'kask2', (-3, 9, -3), (3, 11, 3), base='Y', front=rows('YYYYYY', 'yyyyyy'))
    kutu(f, 'g', 'fener', (-1, 9, 3), (1, 11, 4), base='Q', front=rows('WW', 'WW'), glow='W')
    kutu(f, 'g', 'mil', (-0.5, 11, -0.5), (0.5, 12, 0.5), base='m')
    f.bone('p_kazma', 'g', (0, 12.5, 0))
    kutu(f, 'p_kazma', 'kz_gobek', (-1, 12, -1), (1, 13, 1), base='m')
    kutu(f, 'p_kazma', 'kz_kol', (-5, 12, -0.5), (5, 13, 0.5), base='*', top=rows('+*******+*'), front=rows('**********'))
    for ad, x in (('l', -6), ('r', 5)):
        kutu(f, 'p_kazma', 'kz_uc_' + ad, (x, 11, -0.5), (x + 1, 12, 0.5), base='+')


def kurekci(f):
    # kum renkli botlar; iki yanda yatay dönen kaşık (kürek ağzı) biçimli pervaneler: kumu arkaya atar gibi
    govde6(f)
    kutu(f, 'g', 'bot', (-3.5, 2, -3.5), (3.5, 3, 3.5), base='N', top=fill(7, 7, 'n'))
    kutu(f, 'g', 'torba', (-2, 4, -4), (2, 7, -3), base='n', back=rows('nNnN', 'NnNn', 'nNnN'))
    for ad, sx in (('l', -1), ('r', 1)):
        kutu(f, 'g', 'kol_' + ad, (min(sx * 3, sx * 5), 5, -0.5), (max(sx * 3, sx * 5), 6, 0.5), base='&')
        pb = 'p_' + ad
        cx = sx * 7
        f.bone(pb, 'g', (cx, 5.5, 0))
        kutu(f, pb, pb + '_gobek', (cx - 1, 5, -1), (cx + 1, 6, 1), base='%')
        for k, sz in enumerate((1, -1)):
            # sap + kaşık ağzı (ortası çukur: koyu, kenarı çelik, içinde kum)
            kutu(f, pb, f'{pb}_sap{k}', (cx - 0.5, 5, min(sz * 1, sz * 3)), (cx + 0.5, 6, max(sz * 1, sz * 3)), base='m')
            kutu(f, pb, f'{pb}_kasik{k}', (cx - 1.5, 5, min(sz * 3, sz * 6)), (cx + 1.5, 6, max(sz * 3, sz * 6)), base='*',
                 top=rows('*+*', '+n+', '*+*'), bottom=fill(3, 3, '%'))


def ciftci(f):
    # hasır şapka; şapkanın tepesinden çıkan filiz, iki yaprağı pervane gibi döner
    govde6(f)
    kutu(f, 'g', 'sapka_kenar', (-4.5, 8, -4.5), (4.5, 9, 4.5), base='w', top=panel(9, 9, 'w', t='x', b='X', l='x', r='X'))
    kutu(f, 'g', 'sapka_tepe', (-2.5, 9, -2.5), (2.5, 11, 2.5), base='x', front=rows('xxxxx', 'RRRRR'))
    kutu(f, 'g', 'filiz', (-0.5, 11, -0.5), (0.5, 13, 0.5), base='e')
    f.bone('p_yaprak', 'g', (0, 13.5, 0))
    kutu(f, 'p_yaprak', 'yaprak1', (-5.5, 13, -1), (-0.5, 14, 1), base='f', top=rows('Effef', 'fEeff'))
    kutu(f, 'p_yaprak', 'yaprak2', (0.5, 13, -1), (5.5, 14, 1), base='f', top=rows('feffE', 'ffeEf'))


def oduncu(f):
    # yeşil atkı; tepede çift balta biçimli pervane (ortada sap, iki ucunda dik balta ağzı)
    govde6(f)
    kutu(f, 'g', 'atki', (-3.5, 3, -3.5), (3.5, 4, 3.5), base='E', front=rows('EfEfEfE'), top=fill(7, 7, 'E'))
    kutu(f, 'g', 'atki_uc', (2, 1, 3), (3, 3, 4), base='E')
    kutu(f, 'g', 'mil', (-0.5, 8, -0.5), (0.5, 10, 0.5), base='%')
    f.bone('p_balta', 'g', (0, 10.5, 0))
    kutu(f, 'p_balta', 'b_sap', (-5, 10, -0.5), (5, 11, 0.5), base='m', top=rows('mmmmoommmm'))
    for ad, x in (('l', -6), ('r', 5)):
        kutu(f, 'p_balta', 'b_agiz_' + ad, (x, 9, -0.5), (x + 1, 12, 1.5), base='*',
             left=rows('*+', '**', '*+'), right=rows('+*', '**', '+*'))


def kilicli(f):
    # kırmızı pelerin, kararlı bakış; tepede iki kılıçtan pervane (kabzalar göbekte, ağızlar dışa)
    govde6(f, sert=True)
    kutu(f, 'g', 'pelerin', (-3, 2, -4), (3, 8, -3), base='r', back=over(fill(6, 6, 'r'), rows('RRRRRR'), 0, 0))
    kutu(f, 'g', 'mil', (-0.5, 8, -0.5), (0.5, 10, 0.5), base='y')
    f.bone('p_kilic', 'g', (0, 10.5, 0))
    kutu(f, 'p_kilic', 'k_gobek', (-1, 10, -1), (1, 11, 1), base='y', top=rows('yQ', 'Qy'))
    for ad, sx in (('l', -1), ('r', 1)):
        kutu(f, 'p_kilic', 'k_kabza_' + ad, (min(sx * 1, sx * 2), 10, -0.5), (max(sx * 1, sx * 2), 11, 0.5), base='m')
        kutu(f, 'p_kilic', 'k_siper_' + ad, (min(sx * 2, sx * 3), 10, -1.5), (max(sx * 2, sx * 3), 11, 1.5), base='y')
        kutu(f, 'p_kilic', 'k_agiz_' + ad, (min(sx * 3, sx * 8), 10, -0.5), (max(sx * 3, sx * 8), 11, 0.5), base='+',
             top=rows('+++++' if sx > 0 else '+++++'), front=rows('*+++*' if True else ''))
        kutu(f, 'p_kilic', 'k_uc_' + ad, (min(sx * 8, sx * 9), 10, -0.5), (max(sx * 8, sx * 9), 11, 0.5), base='9')


def organizator(f, cam=True):
    # dik duran ince tablet (ekranı öne bakar); cam ekranın ardında Mimar dronundaki gibi gözler; üstte iki pervane
    on = fill(8, 6, '1')
    for x in range(8):
        on[0][x] = '3'; on[5][x] = 'P'
    for y in range(1, 5):
        for x in range(1, 7):
            on[y][x] = 'k'
    put(on, ['WkkW', 'WkkW'], 2, 1)
    on[3][3] = on[3][4] = 'k'
    on[3][2] = on[3][5] = 'P'
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
    kutu(f, 'g', 'kure', (-2.5, 4.5, -2.5), (2.5, 8.5, 2.5), base='3', front=rows('33333', '3W3W3', '3W3W3', '33333'),
         glow='Wü', top=rows('3üüü3', 'ü333ü', 'ü333ü', 'ü333ü', '3üüü3'))
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
    for ad in ('p_l', 'p_r', 'p_kazma', 'p_balta', 'p_kilic'):
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
            cam = Z.Cam(yaw=25 + 360 * t, elev=20, scale=8.5, size=(170, 230), center=(0, 7, 0))
            c.paste(ciz(tur, cam, t, M, C), (k * 170, 0))
        frames.append(c)
    print(Z.gif(frames, os.path.join(OUT, '84_evcil_dronlar.gif'), ms=60))
    imgs = [(ciz(tur, Z.Cam(yaw=30, elev=18, scale=8.5, size=(170, 220), center=(0, 7, 0)), 0.1, M, C), ADLAR[tur])
            for tur in TURLER]
    print(kart('Evcil mini dronlar · 4. tasarım (temalı pervaneler)', imgs, os.path.join(OUT, '84_evcil_dronlar.png'),
               alt='Mimar ve Keşif dronları zaten var. Hepsi omuzda süzülür.'))
