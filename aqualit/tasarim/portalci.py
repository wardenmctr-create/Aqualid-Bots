"""Portalcı (boyutlar arası) robot, 2. tasarım: yalnız kafa (normal robot kafası 12x9x10) uçan dron.
Kafanın üst köşelerine yakın, çapraz (X) dizili dört büyük yatay pervane (yarıçap 5 = kafa yarıçapının (6) 5/6'sı),
her biri kare koruma halkasında. Altta helikopter gibi ince, modern iniş kızakları (turkuaz şeritli).
Alnında portal taşı, yanlarda portal halkaları, kafanın altında yüzeye gömülü parlayan portal çekirdeği."""
import math
import os
from ortak import Form, Part, kutu, fill, rows, panel, over, dondur_gif, kart, OUT, Z, model, R

D = 7            # pervane merkezlerinin kafa merkezine x/z uzaklığı
YP = 20          # pervane yüksekliği (kafa tepesi 19)
RP = 5           # pervane yarıçapı
KOSE = [('fl', 1, 1), ('fr', -1, 1), ('bl', 1, -1), ('br', -1, -1)]


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


def model_portalci(t=0.0):
    f = Form('portalci', 'Portalcı')
    f.bone('root', None, (0, 0, 0))
    f.bone('govde', 'root', (0, 14, 0))
    # kafa = robotun kendisi
    for p in R.base_robot('portalci'):
        if p.name == 'head':
            f.parts.append(Part('govde', p, 'EYES'))
    kutu(f, 'govde', 'alin_tasi', (-1, 17, 5), (1, 19, 6), base='ğ', glow='ğüÇ', front=rows('üğ', 'ğş'))
    for ad, x0 in (('kulak_l', -7), ('kulak_r', 6)):
        kutu(f, 'govde', ad, (x0, 12, -2), (x0 + 1, 17, 3), base='3', glow='ğüÇ',
             left=over(fill(5, 5, '3'), rows('ğüğ', 'üÇü', 'ğüğ'), 1, 1), right=over(fill(5, 5, '3'), rows('ğüğ', 'üÇü', 'ğüğ'), 1, 1))
    # kafanın altında gömülü portal çekirdeği (sarkmaz)
    kutu(f, 'govde', 'cekirdek', (-3, 9, -3), (3, 10, 3), base='3', bottom=girdap(6, t), glow='ğüÇöşç')
    # tepe göbeği: dört kolu taşıyan yassı plaka
    kutu(f, 'govde', 'gobek', (-4, 19, -4), (4, 20, 4), base='&', top=panel(8, 8, '*', t='+', b='%', l='+', r='%'))
    for ad, sx, sz in KOSE:
        # göbekten pervaneye kısa çapraz kol (iki basamak)
        for k in range(3):
            x, z = sx * (3 + k * 1.5), sz * (3 + k * 1.5)
            kutu(f, 'govde', f'kol_{ad}{k}', (x - 1, 19, z - 1), (x + 1, 20, z + 1), base='&', top=fill(2, 2, '*'))
        cx, cz = sx * D, sz * D
        kutu(f, 'govde', f'mil_{ad}', (cx - 0.5, 20, cz - 0.5), (cx + 0.5, 21, cz + 0.5), base='%')
        # kare koruma halkası (yarıçap 6)
        r = RP + 1
        for nm, aa, bb in ((f'h1_{ad}', (cx - r, 20.5, cz - r), (cx + r, 21.5, cz - r + 1)),
                           (f'h2_{ad}', (cx - r, 20.5, cz + r - 1), (cx + r, 21.5, cz + r)),
                           (f'h3_{ad}', (cx - r, 20.5, cz - r + 1), (cx - r + 1, 21.5, cz + r - 1)),
                           (f'h4_{ad}', (cx + r - 1, 20.5, cz - r + 1), (cx + r, 21.5, cz + r - 1))):
            w_, d_ = int(round(bb[0] - aa[0])), int(round(bb[2] - aa[2]))
            kutu(f, 'govde', nm, aa, bb, base='%', glow='ö',
                 top=[['ö' if (i + j) % 4 == 0 else '&' for i in range(w_)] for j in range(d_)])
        pb = f'per_{ad}'
        f.bone(pb, 'govde', (cx, 21.5, cz))
        kutu(f, pb, pb + 'a', (cx - RP, 21, cz - 0.5), (cx + RP, 22, cz + 0.5), base='D', top=rows('kDLLHHLLDk'))
        kutu(f, pb, pb + 'b', (cx - 0.5, 21, cz - RP), (cx + 0.5, 22, cz + RP), base='D',
             top=[[c] for c in 'kDLLHHLLDk'])
        kutu(f, pb, pb + 'c', (cx - 1, 22, cz - 1), (cx + 1, 23, cz + 1), base='ğ', glow='ğ')
    # helikopter iniş kızakları: iki ince boru, ucu yukarı kıvrık; ikişer eğik dikme; turkuaz şerit
    for ad, sx in (('l', -1), ('r', 1)):
        x = sx * 4.5
        kutu(f, 'govde', f'kizak_{ad}', (x - 0.5, 5, -6), (x + 0.5, 6, 6), base='%',
             top=[['ö' if j % 4 == 1 else '*'] for j in range(12)], glow='ö')
        kutu(f, 'govde', f'kizak_uc_{ad}', (x - 0.5, 6, 6), (x + 0.5, 7, 7), base='%')
        kutu(f, 'govde', f'kizak_uc2_{ad}', (x - 0.5, 7, 7), (x + 0.5, 8, 8), base='*')
        for k, z in enumerate((-3.5, 3.5)):
            kutu(f, 'govde', f'dikme_{ad}{k}', (x - 0.5, 6, z - 0.5), (x + 0.5, 8, z + 0.5), base='&')
            kutu(f, 'govde', f'dikme2_{ad}{k}', (x - 0.5 - sx, 8, z - 0.5), (x + 0.5 - sx, 10, z + 0.5), base='&')
    return f


def poz(t):
    p = {f'per_{a}': [0, t * 1440 * (1 if a in ('fl', 'br') else -1), 0] for a, _, _ in KOSE}
    p['govde'] = {'p': [0, math.sin(t * 6.283) * 0.6, 0]}
    return p


if __name__ == '__main__':
    yol, fr = dondur_gif(model_portalci(), '81_portalci.gif', center=(0, 14, 0), scale=9, size=(420, 380), poz=poz,
                         W=256, elev=22)
    print(yol)
    imgs = []
    geo, tex, glow = model(model_portalci(), W=256)
    for yaw, el, ad in ((30, 18, '3/4 önden'), (0, 70, 'üstten: pervaneler'), (90, 4, 'yandan: kızaklar')):
        cam = Z.Cam(yaw=yaw, elev=el, scale=9, size=(330, 310), center=(0, 14, 0))
        imgs.append((Z.render(geo, tex, poz(0), (), cam, glow=glow, ground={'y': -1, 'color': (58, 66, 74)}), ad))
    print(kart('Portalcı robot · 2. tasarım', imgs, os.path.join(OUT, '81_portalci.png'),
               alt='Yalnız kafa · pervane yarıçapı 5 (kafa 6) · helikopter kızakları'))
