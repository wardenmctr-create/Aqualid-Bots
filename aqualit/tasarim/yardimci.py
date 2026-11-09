"""Organizatör Yardımcısı: öteki dronlardan büyük (gövde 14x8x14), lacivert-mor Organizatör renklerinde dron.
Önde yarı saydam mavi cam ekranın ardında iki göz; köşelerde dört halkalı yatay pervane; altta blok ışınlayan
turkuaz ışın merceği ve iki kargo kıskacı; arkada küçük çanak anten."""
import math
import os
from ortak import Form, kutu, fill, rows, panel, over, kart, OUT, Z, model
from vizor2 import cam_yuz, CAM_ALFA
import numpy as np
from PIL import Image


def yardimci(cam=True):
    f = Form('org_yard', 'Organizatör Yardımcısı')
    f.bone('root', None, (0, 0, 0))
    f.bone('govde', 'root', (0, 10, 0))
    # gövde
    on = fill(14, 8, '1')
    for x in range(14):
        on[0][x] = '3'; on[7][x] = '2'
    for y in range(2, 6):
        for x in range(2, 12):
            on[y][x] = 'k'
    over(on, rows('WW', 'WW'), 4, 3)        # gözler (camın ardında)
    over(on, rows('WW', 'WW'), 8, 3)
    yan = fill(14, 8, '1')
    hline(yan, 0, '3') if False else None
    for x in range(14):
        yan[0][x] = '3'; yan[7][x] = '2'
    over(yan, rows('PPPPPP'), 4, 3)
    ust = panel(14, 14, '3', t='Z', b='2', l='Z', r='2')
    over(ust, rows('PP', 'PP'), 6, 6)
    kutu(f, 'govde', 'govde', (-7, 6, -7), (7, 14, 7), base='1', front=on, left=yan, right=[r[:] for r in yan],
         back=fill(14, 8, '2'), top=ust, glow='WPZ')
    # mor şerit (Organizatör) ve yan ışıklar
    kutu(f, 'govde', 'serit', (-7.5, 6, -7.5), (7.5, 7, 7.5), base='P', glow='P', top=fill(15, 15, 'p'))
    # alt: ışın merceği (halka + parlayan iç) ve iki kıskaç
    kutu(f, 'govde', 'mercek', (-3, 4, -3), (3, 6, 3), base='2', glow='öÇı',
         bottom=rows('ıööööı', 'öÇÇÇÇö', 'öÇ99Çö', 'öÇ99Çö', 'öÇÇÇÇö', 'ıööööı'),
         front=rows('2ööö22'[:6], '2ıııı2'), back=rows('2ööö22'[:6], '2ıııı2'),
         left=rows('2ööö22'[:6], '2ıııı2'), right=rows('2ööö22'[:6], '2ıııı2'))
    for ad, z0 in (('kiskac_on', 4), ('kiskac_arka', -5)):
        kutu(f, 'govde', ad, (-1, 2, z0), (1, 6, z0 + 1), base='&')
        kutu(f, 'govde', ad + '_uc', (-2, 1, z0 - (1 if z0 > 0 else -1) * 0), (2, 2, z0 + 1), base='*')
    # arka çanak anten
    kutu(f, 'govde', 'anten', (-0.5, 14, -6), (0.5, 17, -5), base='%')
    kutu(f, 'govde', 'canak', (-2, 16, -6.5), (2, 19, -5.5), base='*', front=rows('*++*', '+PP+', '*++*'), glow='P')
    # köşe kolları + halkalı yatay pervaneler
    for ad, (sx, sz) in (('fl', (1, 1)), ('fr', (-1, 1)), ('bl', (1, -1)), ('br', (-1, -1))):
        cx, cz = sx * 11, sz * 11
        a = (min(sx * 6, sx * 9), 12, min(sz * 6, sz * 9))
        b = (max(sx * 6, sx * 9), 13, max(sz * 6, sz * 9))
        kutu(f, 'govde', f'kol_{ad}', a, b, base='&', top=fill(3, 3, '*'))
        for nm, aa, bb in ((f'h1_{ad}', (cx - 4, 12, cz - 4), (cx + 4, 14, cz - 3)),
                           (f'h2_{ad}', (cx - 4, 12, cz + 3), (cx + 4, 14, cz + 4)),
                           (f'h3_{ad}', (cx - 4, 12, cz - 3), (cx - 3, 14, cz + 3)),
                           (f'h4_{ad}', (cx + 3, 12, cz - 3), (cx + 4, 14, cz + 3))):
            w_, d_ = int(bb[0] - aa[0]), int(bb[2] - aa[2])
            kutu(f, 'govde', nm, aa, bb, base='2', top=fill(w_, d_, 'P'), glow='P')
        pb = f'per_{ad}'
        f.bone(pb, 'govde', (cx, 13, cz))
        kutu(f, pb, pb + 'a', (cx - 3, 12.5, cz - 0.5), (cx + 3, 13.5, cz + 0.5), base='D', top=rows('kLHHLk'))
        kutu(f, pb, pb + 'b', (cx - 0.5, 12.5, cz - 3), (cx + 0.5, 13.5, cz + 3), base='D', top=rows('k', 'L', 'H', 'H', 'L', 'k'))
    if cam:
        kutu(f, 'govde', 'cam', (-6, 7, 7), (6, 13, 8), base='<', front=cam_yuz(12, 6))
    return f


def poz(t):
    p = {f'per_{a}': [0, t * 1440 * (1 if a in ('fl', 'br') else -1), 0] for a in ('fl', 'fr', 'bl', 'br')}
    p['govde'] = {'p': [0, math.sin(t * 6.283) * 0.8, 0], 'r': [math.sin(t * 6.283) * 3, 0, 0]}
    return p


def ciz(cam, t, A, B):
    a = np.asarray(Z.render(*A[:2], poz(t), (), cam, glow=A[2], ground={'y': -1, 'color': (58, 66, 74)}).convert('RGB'), np.float32)
    b = np.asarray(Z.render(*B[:2], poz(t), (), cam, glow=B[2], ground={'y': -1, 'color': (58, 66, 74)}).convert('RGB'), np.float32)
    m = (np.abs(a - b).sum(2) > 6)[:, :, None]
    return Image.fromarray(np.where(m, a * (1 - CAM_ALFA) + b * CAM_ALFA, a).clip(0, 255).astype(np.uint8))


if __name__ == '__main__':
    A, B = model(yardimci(False), W=256), model(yardimci(True), W=256)
    fr = [ciz(Z.Cam(yaw=25 + i * 10, elev=16, scale=10, size=(400, 340), center=(0, 10, 0)), i / 36, A, B) for i in range(36)]
    print(Z.gif(fr, os.path.join(OUT, '82_org_yardimci.gif'), ms=60))
    imgs = [(ciz(Z.Cam(yaw=y, elev=e, scale=9.5, size=(330, 300), center=(0, 10, 0)), 0, A, B), t)
            for y, e, t in ((15, 10, '3/4 önden'), (160, 30, 'arkadan'), (30, -35, 'alttan: ışın merceği'))]
    print(kart('Organizatör Yardımcısı (büyük dron)', imgs, os.path.join(OUT, '82_org_yardimci.png'),
               alt='Gövde 14x14 (Mimar dronu 6, Keşif dronu 5) · blok ışınlar · kıskaçla taşır'))
