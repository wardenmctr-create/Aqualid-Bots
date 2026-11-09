"""Portalcı (boyutlar arası) robot: kendisi bir dron. Kafası normal robot kafası boyunda (12x9x10), altında kısa gövde ve
girdaplı portal çekirdeği; çapraza (X) açılan 4 kol, her kolun ucunda halka içinde yatay pervane. Altta iki tutma kolu
(robotları omuzlarından tutup uçurur). Boşken küçülüp omuzda süzülür."""
import math
import os
from ortak import Form, Part, kutu, fill, rows, panel, over, dondur_gif, kart, OUT, Z, model, R

KOLLAR = [('fl', 45), ('fr', -45), ('bl', 135), ('br', -135)]   # yukarıdan açı (+z ön)


def girdap(n, t=0.0):
    """n x n portal girdabı yüzü (mor-turkuaz)."""
    g = []
    c = (n - 1) / 2
    for y in range(n):
        r = []
        for x in range(n):
            dx, dy = x - c, y - c
            d = math.hypot(dx, dy) / max(c, 1)
            a = math.atan2(dy, dx) + d * 3.2 - t * 6.283
            v = (math.sin(a * 2) + 1) / 2
            if d > 1.05:
                r.append('ç')
            elif d < 0.25:
                r.append('Ç')
            else:
                r.append('ü' if v > 0.75 else 'ğ' if v > 0.45 else 'ö' if v > 0.25 else 'ş')
        g.append(r)
    return g


def model_portalci(t=0.0, kol_acik=1.0):
    f = Form('portalci', 'Portalcı')
    f.bone('root', None, (0, 0, 0))
    f.bone('govde', 'root', (0, 8, 0))
    f.bone('kafa', 'govde', (0, 10, 0))
    # kafa: normal robot kafası (gözler ışıklı), alnında portal taşı, tepesinde girdap küreli anten
    for p in R.base_robot('portalci'):
        if p.name == 'head':
            f.parts.append(Part('kafa', p, 'EYES'))
    kutu(f, 'kafa', 'alin_tasi', (-1, 17, 5), (1, 18.5 + 0.5, 5.5 + 0.5), base='ğ', glow='ğüÇ',
         front=rows('üğ', 'ğş'))
    kutu(f, 'kafa', 'anten', (-0.5, 19, -0.5), (0.5, 22, 0.5), base='%')
    kutu(f, 'kafa', 'anten_kure', (-1.5, 22, -1.5), (1.5, 25, 1.5), base='ğ', glow='ğüÇöş',
         front=girdap(3, t), back=girdap(3, t + .3), left=girdap(3, t + .5), right=girdap(3, t + .7), top=girdap(3, t))
    # yanlarda kulak yerine küçük portal halkaları
    for ad, x0 in (('kulak_l', -7), ('kulak_r', 6)):
        kutu(f, 'kafa', ad, (x0, 12.5, -1.5), (x0 + 1, 16.5, 2.5), base='3',
             left=over(fill(4, 4, '3'), rows('ğğ', 'üğ'), 1, 1), right=over(fill(4, 4, '3'), rows('ğğ', 'üğ'), 1, 1),
             glow='ğü')
    # gövde: kafanın altında yassı dron gövdesi; altında parlayan portal çekirdeği
    on = panel(10, 4, 'M')
    over(on, rows('HWWH'), 3, 1)
    kutu(f, 'govde', 'govde', (-5, 6, -5), (5, 10, 5), base='M', front=on, bottom=girdap(10, t), glow='ğüÇöş')
    kutu(f, 'govde', 'cekirdek', (-3, 4, -3), (3, 6, 3), base='3', bottom=girdap(6, t + .2), glow='ğüÇöş',
         front=rows('3ğüüğ3', '33ğğ33'), back=rows('3ğüüğ3', '33ğğ33'), left=rows('3ğüüğ3', '33ğğ33'),
         right=rows('3ğüüğ3', '33ğğ33'))
    # çapraz 4 kol + uçlarında halka içinde yatay pervane
    for ad, aci in KOLLAR:
        kb = f'kol_{ad}'
        f.bone(kb, 'govde', (0, 8, 0), (0, aci, 0))
        L = 4 + 6 * kol_acik
        kutu(f, kb, f'{kb}_cubuk', (-1, 7.5, 3), (1, 8.5, 3 + L), base='&', top=fill(2, int(L), '*'))
        z0 = 3 + L
        for nm, aa, bb in ((f'{kb}_h1', (-3, 7.5, z0), (3, 9.5, z0 + 1)), (f'{kb}_h2', (-3, 7.5, z0 + 5), (3, 9.5, z0 + 6)),
                           (f'{kb}_h3', (-3, 7.5, z0 + 1), (-2, 9.5, z0 + 5)), (f'{kb}_h4', (2, 7.5, z0 + 1), (3, 9.5, z0 + 5))):
            kutu(f, kb, nm, aa, bb, base='y', top=fill(int(bb[0] - aa[0]), int(bb[2] - aa[2]), 'Y'))
        pb = f'per_{ad}'
        f.bone(pb, kb, (0, 8.5, z0 + 3))
        kutu(f, pb, f'{pb}_a', (-2, 8, z0 + 2.5 - 0.5), (2, 9, z0 + 3.5 - 0.5), base='D', top=rows('kLHk'))
        kutu(f, pb, f'{pb}_b', (-0.5, 8, z0 + 1), (0.5, 9, z0 + 5), base='D', top=rows('k', 'L', 'H', 'k'))
    # altta iki tutma kolu (robotları omuzdan tutar)
    for ad, x0 in (('tut_l', -4), ('tut_r', 3)):
        kutu(f, 'govde', ad, (x0, 1, -0.5), (x0 + 1, 6, 0.5), base='&')
        kutu(f, 'govde', ad + '_el', (x0 - 0.5 if ad == 'tut_l' else x0, 0, -1), (x0 + 1.5 if ad == 'tut_l' else x0 + 2, 1, 1),
             base='ğ', glow='ğ')
    return f


def poz(t):
    p = {}
    for ad, _ in KOLLAR:
        p[f'per_{ad}'] = [0, t * 1440 * (1 if ad in ('fl', 'br') else -1), 0]
    p['govde'] = {'p': [0, math.sin(t * 6.283) * 0.6, 0]}
    return p


if __name__ == '__main__':
    yol, fr = dondur_gif(model_portalci(), '81_portalci.gif', center=(0, 10, 0), scale=8.5, size=(420, 380), poz=poz,
                         W=256, elev=24)
    print(yol)
    # kollar kapalı (omuz boyu hali) ve açık
    imgs = []
    for k, ad, el in ((0.0, 'kollar kapalı (omuzda)', 28), (1.0, 'kollar çapraz açık (uçarken)', 28),
                      (1.0, 'alttan: portal çekirdeği', -40)):
        f = model_portalci(kol_acik=k)
        geo, tex, glow = model(f, W=256)
        cam = Z.Cam(yaw=35, elev=el, scale=8 if k else 11, size=(330, 310), center=(0, 10, 0))
        imgs.append((Z.render(geo, tex, poz(0), (), cam, glow=glow, ground={'y': -1, 'color': (58, 66, 74)}), ad))
    print(kart('Portalcı robot (boyutlar arası dron)', imgs, os.path.join(OUT, '81_portalci.png'),
               alt='Kafa normal robot kafası boyunda · çapraz 4 pervane · altta portal çekirdeği ve 2 tutma kolu'))
