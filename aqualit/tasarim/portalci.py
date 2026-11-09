"""Portalcı (boyutlar arası) robot, 3. tasarım: Organizatör Yardımcısı tarzında dron, gövdesi normal robot kafası
boyunda (12x9x10). Önde yarı saydam mavi cam ekranın ardında gözler; köşelerde halkalı 4 yatay pervane (yarıçap 5,
kafa yarıçapı 6); altta dönen portal merceği; yanlarda portal halkaları; helikopter kızakları. Robot turkuazı + portal
moru-turkuazı."""
import math
import os
import numpy as np
from PIL import Image
from ortak import Form, kutu, kizak, fill, rows, panel, over, kart, OUT, Z, model
from vizor2 import cam_yuz, CAM_ALFA

RP = 5


def girdap(n, t=0.0):
    g, c = [], (n - 1) / 2
    for y in range(n):
        r = []
        for x in range(n):
            d = math.hypot(x - c, y - c) / max(c, 1)
            a = math.atan2(y - c, x - c) + d * 3.2 - t * 6.283
            v = (math.sin(a * 2) + 1) / 2
            r.append('ç' if d > 1.05 else 'Ç' if d < 0.25 else 'ü' if v > 0.75 else 'ğ' if v > 0.45 else 'ö' if v > 0.25 else 'ş')
        g.append(r)
    return g


def model_portalci(cam=True, t=0.0):
    f = Form('portalci', 'Portalcı')
    f.bone('root', None, (0, 0, 0))
    f.bone('govde', 'root', (0, 10, 0))
    # gövde = robot kafası boyunda kutu (x -6..6, y 6..15, z -5..5)
    on = fill(12, 9, 'k')                 # çerçevesiz tam ekran, robot gözleri
    over(on, rows('LWL', 'WWW', 'WWW', 'LWL'), 2, 2)
    over(on, rows('LWL', 'WWW', 'WWW', 'LWL'), 7, 2)
    over(on, rows('LL'), 5, 7)
    yan = fill(10, 9, 'M')
    for x in range(10):
        yan[0][x] = 'H'; yan[8][x] = 'D'
    over(yan, rows('3333', '3ğü3', '3üğ3', '3333'), 3, 2)
    ust = panel(12, 10, 'L', t='H', b='M', l='H', r='M')
    over(ust, rows('ğğ', 'ğğ'), 5, 4)
    kutu(f, 'govde', 'govde', (-6, 6, -5), (6, 15, 5), base='M', front=on, left=yan, right=[r[:] for r in yan],
         back=fill(12, 9, 'D'), top=ust, glow='WLğü')
    # mor portal şeridi (gövdenin altında) ve alında portal taşı
    kutu(f, 'govde', 'serit', (-6.5, 6, -5.5), (6.5, 7, 5.5), base='ğ', glow='ğ', top=fill(13, 11, 'ş'))
    kutu(f, 'govde', 'alin', (-1, 13, 5), (1, 15, 6), base='ğ', glow='ğü', front=rows('üğ', 'ğş'))
    # arkada 1 piksel kalınlığında dönen portal merceği (gövdenin arka yüzüne yapışık disk)
    kutu(f, 'govde', 'mercek', (-3.5, 7, -6), (3.5, 14, -5), base='3', glow='ğüÇöşç', back=girdap(7, t),
         front=fill(7, 7, '3'))
    # tepede küçük girdap küresi
    kutu(f, 'govde', 'anten', (-0.5, 15, -0.5), (0.5, 17, 0.5), base='%')
    kutu(f, 'govde', 'kure', (-1.5, 17, -1.5), (1.5, 20, 1.5), base='ğ', glow='ğüÇöşç', front=girdap(3, t),
         back=girdap(3, t + .3), left=girdap(3, t + .5), right=girdap(3, t + .7), top=girdap(3, t))
    # köşe kolları + halkalı yatay pervaneler (yarıçap 5)
    for ad, sx, sz in (('fl', 1, 1), ('fr', -1, 1), ('bl', 1, -1), ('br', -1, -1)):
        cx, cz = sx * 11, sz * 10
        a = (min(sx * 5, sx * 8), 13, min(sz * 4, sz * 7))
        b = (max(sx * 5, sx * 8), 14, max(sz * 4, sz * 7))
        kutu(f, 'govde', f'kol_{ad}', a, b, base='&', top=fill(3, 3, '*'))
        r = RP + 1
        for nm, aa, bb in ((f'h1_{ad}', (cx - r, 13, cz - r), (cx + r, 15, cz - r + 1)),
                           (f'h2_{ad}', (cx - r, 13, cz + r - 1), (cx + r, 15, cz + r)),
                           (f'h3_{ad}', (cx - r, 13, cz - r + 1), (cx - r + 1, 15, cz + r - 1)),
                           (f'h4_{ad}', (cx + r - 1, 13, cz - r + 1), (cx + r, 15, cz + r - 1))):
            w_, d_ = int(bb[0] - aa[0]), int(bb[2] - aa[2])
            kutu(f, 'govde', nm, aa, bb, base='3', glow='ğü',
                 top=[['ü' if (i + j) % 4 == 0 else 'ğ' for i in range(w_)] for j in range(d_)])
        pb = f'per_{ad}'
        f.bone(pb, 'govde', (cx, 14, cz))
        kutu(f, pb, pb + 'a', (cx - RP, 13.5, cz - 0.5), (cx + RP, 14.5, cz + 0.5), base='D', top=rows('kDLLHHLLDk'))
        kutu(f, pb, pb + 'b', (cx - 0.5, 13.5, cz - RP), (cx + 0.5, 14.5, cz + RP), base='D',
             top=[[c] for c in 'kDLLHHLLDk'])
    kizak(f, 'govde', 9, 0, 6, 6, govde_x=4)
    if cam:
        kutu(f, 'govde', 'cam', (-5.5, 7.5, 5), (5.5, 13.5, 6), base='<', front=cam_yuz(11, 6))
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
    A, B = model(model_portalci(False), W=256), model(model_portalci(True), W=256)
    fr = [ciz(Z.Cam(yaw=25 + i * 10, elev=16, scale=10, size=(400, 340), center=(0, 10, 0)), i / 36, A, B) for i in range(36)]
    print(Z.gif(fr, os.path.join(OUT, '81_portalci.gif'), ms=60))
    imgs = [(ciz(Z.Cam(yaw=y, elev=e, scale=9.5, size=(330, 300), center=(0, 10, 0)), 0, A, B), t)
            for y, e, t in ((15, 10, '3/4 önden'), (90, 6, 'yandan: kızaklar'), (180, 12, 'arkadan: portal merceği'))]
    print(kart('Portalcı robot · 3. tasarım (Yardımcı tarzında)', imgs, os.path.join(OUT, '81_portalci.png'),
               alt='Gövde robot kafası boyunda · pervane yarıçapı 5 · portal merceği · kızaklar'))
