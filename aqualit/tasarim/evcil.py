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
from ortak import Form, fill, rows, panel, over, kart, OUT, Z, model
from ortak import kutu as _kutu


def kutu(f, bone, ad, a, b, base='M', glow='', **yuz):
    """Evcil dronlarda verilmeyen yüzler düz renk (turkuaz kenar çizgisi yok)."""
    w, h, d = (int(round(b[i] - a[i])) for i in range(3))
    duz = {'front': fill(w, h, base), 'back': fill(w, h, base), 'left': fill(d, h, base), 'right': fill(d, h, base),
           'top': fill(w, d, base), 'bottom': fill(w, d, base)}
    duz.update({k: v for k, v in yuz.items() if v is not None})
    return _kutu(f, bone, ad, a, b, base=base, glow=glow, **duz)

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
    """Çerçevesiz tam ekran yüz (6x5)."""
    from ortak import YUZ6, YUZ6_SERT
    return [list(r) for r in (YUZ6_SERT if sert else YUZ6)]


def govde6(f, renk='M', sert=False, y0=3):
    """Mimar dronu boyunda gövde (6x5x6), önde yüz."""
    yan = plate(6, 5, renk, top='H', bottom='D', left='L', right='D')
    yan[2][2] = yan[2][3] = 'L'
    kutu(f, 'g', 'govde', (-3, y0, -3), (3, y0 + 5, 3), base=renk, front=yuz6(renk, sert), left=yan,
         right=[r[:] for r in yan], back=plate(6, 5, renk), top=plate(6, 6, 'L', top='H', bottom='M', left='H', right='M'),
         glow='WL')


def madenci(f):
    # madenci kaskı + fener; tepede kazma başı biçimli pervane (iki sivri ucu hafif aşağı kıvrık)
    govde6(f)
    kutu(f, 'g', 'kask', (-4, 8, -4), (4, 9, 4), base='y', top=panel(8, 8, 'Y', t='W', b='Q', l='W', r='Q'))
    kutu(f, 'g', 'kask2', (-3, 9, -3), (3, 11, 3), base='Y', front=rows('YYYYYY', 'yyyyyy'))
    kutu(f, 'g', 'fener', (-1, 9, 3), (1, 11, 4), base='Q', front=rows('WW', 'WW'), glow='W')
    kutu(f, 'g', 'mil', (-0.5, 11, -0.5), (0.5, 15, 0.5), base='m', front=rows('o', 'm', 'o', 'm'))
    f.bone('p_kazma', 'g', (0, 15.5, 0))
    kutu(f, 'p_kazma', 'kz_gobek', (-1, 15, -1), (1, 16, 1), base='m')
    kutu(f, 'p_kazma', 'kz_kol', (-5, 15, -0.5), (5, 16, 0.5), base='*', top=rows('+*******+*'), front=rows('**********'))
    for ad, x in (('l', -6), ('r', 5)):
        kutu(f, 'p_kazma', 'kz_uc_' + ad, (x, 14, -0.5), (x + 1, 15, 0.5), base='+')


def kasik(f, bone, ad, cx, y0):
    """Küçük, sığ oyuk kaşık: sap + 3x3 kaşık; plaka arkada, kenarları (sol, sağ, uç) 1 piksel kabarık, ortası boş.
    Oyuk -z'ye bakar (v5'te ters ve çok derindi)."""
    kutu(f, bone, ad + '_sap', (cx - 0.5, y0 + 1, -0.5), (cx + 0.5, y0 + 2, 0.5), base='m')
    kutu(f, bone, ad + '_arka', (cx - 1.5, y0 + 2, 0), (cx + 1.5, y0 + 5, 1), base='*', back=fill(3, 3, '%'),
         front=rows('*+*', '+**', '*+*'))
    kutu(f, bone, ad + '_kenar_l', (cx - 1.5, y0 + 2, -1), (cx - 0.5, y0 + 5, 0), base='+')
    kutu(f, bone, ad + '_kenar_r', (cx + 0.5, y0 + 2, -1), (cx + 1.5, y0 + 5, 0), base='+')
    kutu(f, bone, ad + '_kenar_u', (cx - 0.5, y0 + 4, -1), (cx + 0.5, y0 + 5, 0), base='+')


def kurekci(f):
    # iki yanda tekerlek gibi dik dönen 3 kaşıklı pervane (kumu arkaya atar); üstte normal 3 kanatlı pervane
    govde6(f)
    kutu(f, 'g', 'bot', (-3.5, 2, -3.5), (3.5, 3, 3.5), base='N', top=fill(7, 7, 'n'))
    for ad, sx in (('l', -1), ('r', 1)):
        cx = sx * 5
        kutu(f, 'g', 'aks_' + ad, (min(sx * 3, sx * 5), 5, -0.5), (max(sx * 3, sx * 5), 6, 0.5), base='&')
        pb = 'p_' + ad
        f.bone(pb, 'g', (cx, 5.5, 0))
        kutu(f, pb, pb + '_gobek', (cx - 0.5 if sx < 0 else cx - 0.5, 4.5, -1), (cx + 0.5, 6.5, 1), base='%')
        for k in range(3):
            kb = f'{pb}_k{k}'
            f.bone(kb, pb, (cx, 5.5, 0), (k * 120, 0, 0))
            kasik(f, kb, kb, cx, 5.5)
    kutu(f, 'g', 'mil', (-0.5, 8, -0.5), (0.5, 10, 0.5), base='%')
    f.bone('p_ust', 'g', (0, 10.5, 0))
    kutu(f, 'p_ust', 'ust_gobek', (-1, 10, -1), (1, 11, 1), base='%')
    for k in range(3):
        kb = f'p_ust_{k}'
        f.bone(kb, 'p_ust', (0, 10.5, 0), (0, k * 120, 0))
        kutu(f, kb, kb, (1, 10, -0.5), (6, 11, 0.5), base='D', top=rows('LLHHk'))


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
    # yeşil atkı, antenin ucunda yaprak, sırtta küçük balta; tepede yatay dönen daire testere
    # (11 piksel çaplı yuvarlak disk, 12 sivri diş, pirinç göbek, iki kesik çizgi)
    govde6(f)
    kutu(f, 'g', 'atki', (-3.5, 3, -3.5), (3.5, 4, 3.5), base='E', front=rows('EfEfEfE'), top=fill(7, 7, 'E'))
    kutu(f, 'g', 'atki_uc', (2, 1, 3), (3, 3, 4), base='E')
    kutu(f, 'g', 'anten', (2, 8, -2), (3, 10, -1), base='%')
    kutu(f, 'g', 'anten_yaprak', (1.5, 10, -2.5), (3.5, 11, -0.5), base='e', top=rows('fe', 'Ef'))
    kutu(f, 'g', 'balta_sap', (-0.5, 3, -4), (0.5, 8, -3), base='m')
    kutu(f, 'g', 'balta_agiz', (-0.5, 6, -5), (0.5, 8, -3), base='*', left=rows('+*', '**'), right=rows('*+', '**'))
    kutu(f, 'g', 'mil', (-0.5, 8, -0.5), (0.5, 10, 0.5), base='%')
    f.bone('p_testere', 'g', (0, 10.5, 0))
    n = 11
    disk = []
    for zz in range(n):
        r = []
        for xx in range(n):
            d = ((xx - 5) ** 2 + (zz - 5) ** 2) ** 0.5
            if d > 5.3:
                r.append(' ')
            elif d < 1.3:
                r.append('Q')
            elif d < 2.0:
                r.append('y')
            elif d > 4.4:
                r.append('%')
            elif d > 3.4:
                r.append('+' if (xx * 3 + zz) % 5 == 0 else '*')   # dış halka (testere ağzı)
            elif xx == 5 or zz == 5:
                r.append('&')                # göbeği halkaya bağlayan 4 çubuk
            else:
                r.append(' ')                # içi boş
        disk.append(r)
    kutu(f, 'p_testere', 'disk', (-5.5, 10, -5.5), (5.5, 11, 5.5), base='*', top=disk, bottom=[r[:] for r in disk],
         front=[[' ', ' ', '%'] + ['*'] * 5 + ['%', ' ', ' ']], back=[[' ', ' ', '%'] + ['*'] * 5 + ['%', ' ', ' ']],
         left=[[' ', ' ', '%'] + ['*'] * 5 + ['%', ' ', ' ']], right=[[' ', ' ', '%'] + ['*'] * 5 + ['%', ' ', ' ']])
    import math as _m
    for k in range(12):
        a = k * 30
        x, z = round(_m.cos(_m.radians(a)) * 6 * 2) / 2, round(_m.sin(_m.radians(a)) * 6 * 2) / 2
        kutu(f, 'p_testere', f'dis{k}', (x - 0.5, 10, z - 0.5), (x + 0.5, 11, z + 0.5), base='9')


def kilicli(f):
    # kırmızı pelerin, kararlı bakış; tepede üç kılıçtan pervane (kabzalar göbekte, aralarında 120°)
    govde6(f, sert=True)
    # uzun pelerin: gövdenin altına kadar iner, ucu kırmızı şeritli
    kutu(f, 'g', 'pelerin', (-3, -1, -4), (3, 8, -3), base='r', back=over(fill(6, 9, 'r'), rows('RRRRRR'), 0, 0),
         front=fill(6, 9, 'q'))
    kutu(f, 'g', 'pelerin_uc', (-3, -2, -4.5 + 0.5), (3, -1, -3), base='R')
    kutu(f, 'g', 'mil', (-0.5, 8, -0.5), (0.5, 10, 0.5), base='y')
    f.bone('p_kilic', 'g', (0, 10.5, 0))
    kutu(f, 'p_kilic', 'k_gobek', (-1, 10, -1), (1, 11, 1), base='y', top=rows('yQ', 'Qy'))
    for k in range(3):
        kb = f'p_kilic_{k}'
        f.bone(kb, 'p_kilic', (0, 10.5, 0), (0, k * 120, 0))
        kutu(f, kb, kb + '_kabza', (1, 10, -0.5), (2, 11, 0.5), base='m')
        kutu(f, kb, kb + '_siper', (2, 10, -1.5), (3, 11, 1.5), base='y', top=rows('Q', 'y', 'Q'))
        kutu(f, kb, kb + '_agiz', (3, 10, -0.5), (8, 11, 0.5), base='+', top=rows('*+++9'), front=rows('*+++9'))


def organizator(f, cam=True):
    # dik duran ince tablet (ekranı öne bakar); cam ekranın ardında Mimar dronundaki gibi gözler; üstte iki pervane
    on = [list(r) for r in ('kkkkkkkk', 'kkWkkWkk', 'kkWkkWkk', 'kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk')]
    kutu(f, 'g', 'tablet', (-4, 3, -1), (4, 9, 1), base='1', front=on, glow='WLP',
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
    kutu(f, 'g', 'kure', (-2.5, 4.5, -2.5), (2.5, 8.5, 2.5), base='3', front=rows('kkkkk', 'kWkWk', 'kWkWk', 'kkkkk'),
         glow='WüL', top=rows('3üüü3', 'ü333ü', 'ü333ü', 'ü333ü', '3üüü3'))
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
    for ad in ('p_kazma', 'p_kilic', 'p_ust', 'p_testere'):
        p[ad] = [0, t * 2880, 0]
    for ad in ('p_l', 'p_r'):
        p[ad] = [t * 1440, 0, 0]          # Kürekçi: dik tekerlek pervaneler
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
    print(kart('Evcil mini dronlar · 6. tasarım', imgs, os.path.join(OUT, '84_evcil_dronlar.png'),
               alt='Mimar ve Keşif dronları zaten var. Hepsi omuzda süzülür.'))
