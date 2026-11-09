"""Evcil mini dronlar: her robot türüne uygun, omuzda süzülen küçük dron (5x5x5 küp gövde, ekranda iki göz,
tepede yatay pervane) + türün aksesuarı. Mimar ve Keşif dronları zaten var."""
import math
import os
from ortak import Form, kutu, fill, rows, panel, over, kart, OUT, Z, model
from PIL import Image

TURLER = ['madenci', 'kurekci', 'ciftci', 'oduncu', 'kilicli', 'organizator', 'portalci']
ADLAR = {'madenci': 'Madenci', 'kurekci': 'Kürekçi', 'ciftci': 'Çiftçi', 'oduncu': 'Oduncu', 'kilicli': 'Kılıçlı',
         'organizator': 'Organizatör', 'portalci': 'Portalcı'}


def evcil(tur, cam=True):
    f = Form(f'evcil_{tur}', ADLAR[tur])
    f.bone('root', None, (0, 0, 0))
    f.bone('govde', 'root', (0, 5, 0))
    renk = {'organizator': '1', 'portalci': '3'}.get(tur, 'M')
    goz = rows('kkkkk', 'kWkWk', 'kWkWk', 'kkkkk') if tur != 'kilicli' else rows('kkkkk', 'WkkkW', 'kWkWk', 'kkkkk')
    on = fill(5, 5, renk)
    over(on, goz, 0, 0)
    on[4] = ['D'] * 5 if renk == 'M' else ['2'] * 5
    kutu(f, 'govde', 'govde', (-2.5, 3, -2.5), (2.5, 8, 2.5), base=renk, front=on, glow='W',
         top=panel(5, 5, 'L' if renk == 'M' else '3', t='H', b='D', l='H', r='D'))
    ust = 8
    # tür aksesuarı
    if tur == 'madenci':
        kutu(f, 'govde', 'kask', (-3, 8, -3), (3, 9, 3), base='y', top=panel(6, 6, 'Y', t='W', b='Q', l='W', r='Q'))
        kutu(f, 'govde', 'kask2', (-2, 9, -2), (2, 10, 2), base='Y')
        kutu(f, 'govde', 'lamba', (-1, 8, 3), (1, 9, 4), base='W', glow='W', front=rows('WW'))
        kutu(f, 'govde', 'kazma_sap', (3, 3, 0), (4, 8, 1), base='m')
        kutu(f, 'govde', 'kazma_bas', (2, 7, -0.5 + 0.5), (6, 8, 1), base='*')
        ust = 10
    elif tur == 'kurekci':
        kutu(f, 'govde', 'kizak_l', (-3, 2, -3), (-2, 3, 3), base='N')
        kutu(f, 'govde', 'kizak_r', (2, 2, -3), (3, 3, 3), base='N')
        kutu(f, 'govde', 'torba', (-2, 4, -4), (2, 7, -2.5 + 0.5), base='n', top=fill(4, 2, 'N'))
        kutu(f, 'govde', 'kurek_sap', (3, 4, 0), (4, 9, 1), base='m')
        kutu(f, 'govde', 'kurek_ag', (2.5 + 0.5, 2, -0.5 + 0.5), (5, 4, 1), base='*')
    elif tur == 'ciftci':
        kutu(f, 'govde', 'sapka_kenar', (-4, 8, -4), (4, 9, 4), base='w', top=panel(8, 8, 'w', t='x', b='X', l='x', r='X'))
        kutu(f, 'govde', 'sapka_tepe', (-2, 9, -2), (2, 11, 2), base='x', front=rows('xxxx', 'RRRR'))
        kutu(f, 'govde', 'filiz', (-0.5, 11, -0.5), (0.5, 12, 0.5), base='e')
        kutu(f, 'govde', 'yaprak', (-1.5, 12, -0.5), (1.5, 13, 0.5), base='f', front=rows('feE'))
        ust = 13
    elif tur == 'oduncu':
        kutu(f, 'govde', 'atki', (-3, 3, -3), (3, 4, 3), base='E', front=rows('EfEfEf'))
        kutu(f, 'govde', 'atki_uc', (1, 1, 2.5 + 0.5), (2, 3, 4), base='E')
        kutu(f, 'govde', 'balta_sap', (-4, 3, 0), (-3, 8, 1), base='m')
        kutu(f, 'govde', 'balta_bas', (-6, 6, 0), (-4, 8, 1), base='*', front=rows('+*', '**'))
    elif tur == 'kilicli':
        kutu(f, 'govde', 'pelerin', (-2.5, 2, -3.5), (2.5, 8, -2.5), base='r', back=over(fill(5, 6, 'r'), rows('RRRRR'), 0, 0))
        kutu(f, 'govde', 'kilic_ag', (3.5 - 0.5, 4, 0), (4, 11, 1), base='+', front=rows(*['+'] * 6 + ['*']))
        kutu(f, 'govde', 'kilic_kabza', (2, 4, -0.5 + 0.5), (5, 5, 1), base='y')
        kutu(f, 'govde', 'kilic_sap', (3, 2, 0), (4, 4, 1), base='m')
    elif tur == 'organizator':
        kutu(f, 'govde', 'vizor_ust', (-3, 7, 2), (3, 8, 4), base='@')
        kutu(f, 'govde', 'vizor_alt', (-3, 4, 2), (3, 5, 4), base='>')
        if cam:
            kutu(f, 'govde', 'vizor', (-3, 5, 3), (3, 7, 4), base='<', front=rows('~9~<<~', '^<<<<^'))
        kutu(f, 'govde', 'kulaklik', (-3, 8, -0.5), (3, 9, 0.5), base='g')
        kutu(f, 'govde', 'ped_l', (-4, 5, -1), (-3, 8, 1), base='g')
        kutu(f, 'govde', 'ped_r', (3, 5, -1), (4, 8, 1), base='g')
        kutu(f, 'govde', 'serit', (-2.5, 3, -2.5 - 0.5 + 0.5), (2.5, 4, 2.5), base='P', glow='P')
        ust = 9
    elif tur == 'portalci':
        for nm, aa, bb in (('h1', (-4, 5, -4), (4, 6, -3)), ('h2', (-4, 5, 3), (4, 6, 4)),
                           ('h3', (-4, 5, -3), (-3, 6, 3)), ('h4', (3, 5, -3), (4, 6, 3))):
            w_, d_ = int(bb[0] - aa[0]), int(bb[2] - aa[2])
            kutu(f, 'govde', nm, aa, bb, base='ğ', glow='ğüÇ', top=[['ü' if (i + j) % 3 == 0 else 'ğ' for i in range(w_)] for j in range(d_)])
        kutu(f, 'govde', 'alt_cekirdek', (-1.5, 2, -1.5), (1.5, 3, 1.5), base='ü', glow='üÇ', bottom=rows('ğüğ', 'üÇü', 'ğüğ'))
    # tepe: direk + yatay pervane
    kutu(f, 'govde', 'direk', (-0.5, ust, -0.5), (0.5, ust + 1, 0.5), base='%')
    f.bone('pervane', 'govde', (0, ust + 1.5, 0))
    kutu(f, 'pervane', 'p1', (-3.5, ust + 1, -0.5), (3.5, ust + 2, 0.5), base='D', top=rows('kLHHHLk'))
    kutu(f, 'pervane', 'p2', (-0.5, ust + 1, -3.5), (0.5, ust + 2, 3.5), base='D', top=rows('k', 'L', 'H', 'H', 'H', 'L', 'k'))
    return f


def poz(t):
    return {'pervane': [0, t * 1440, 0], 'govde': {'p': [0, math.sin(t * 6.283) * 0.5, 0]}}


import numpy as np


def ciz(tur, cam, t):
    A = modeller[tur]
    a = Z.render(A[0], A[1], poz(t), (), cam, glow=A[2], ground={'y': 0, 'color': (58, 66, 74)}).convert('RGB')
    if tur != 'organizator':
        return a
    B = camsiz[tur]
    b = Z.render(B[0], B[1], poz(t), (), cam, glow=B[2], ground={'y': 0, 'color': (58, 66, 74)}).convert('RGB')
    a, b = np.asarray(a, np.float32), np.asarray(b, np.float32)
    m = (np.abs(a - b).sum(2) > 6)[:, :, None]
    return Image.fromarray(np.where(m, b * 0.5 + a * 0.5, a).clip(0, 255).astype(np.uint8))


if __name__ == '__main__':
    modeller = {t: model(evcil(t), W=128) for t in TURLER}
    camsiz = {'organizator': model(evcil('organizator', False), W=128)}
    frames = []
    for i in range(36):
        t = i / 36
        c = Image.new('RGB', (7 * 170, 230), (24, 28, 32))
        for k, tur in enumerate(TURLER):
            cam = Z.Cam(yaw=25 + 360 * t, elev=18, scale=11, size=(170, 230), center=(0, 7, 0))
            c.paste(ciz(tur, cam, t), (k * 170, 0))
        frames.append(c)
    print(Z.gif(frames, os.path.join(OUT, '84_evcil_dronlar.gif'), ms=60))
    imgs = []
    for tur in TURLER:
        cam = Z.Cam(yaw=30, elev=16, scale=11, size=(170, 220), center=(0, 7, 0))
        imgs.append((ciz(tur, cam, 0), ADLAR[tur]))
    print(kart('Evcil mini dronlar (omuzda süzülür)', imgs, os.path.join(OUT, '84_evcil_dronlar.png'),
               alt='Mimar ve Keşif dronları zaten var. Tarif: 2 demir + 2 Aqualit + 4 kızıltaş + ortaya robot.'))
