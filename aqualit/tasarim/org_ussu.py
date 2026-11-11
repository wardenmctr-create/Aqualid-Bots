"""v0.4.0 Organizatör üssü tasarımları: Aqualit Fırın (kapalı/yanık), Aqualit Kablo (bağlantılar), Uzaktan Aktarım Bloğu,
Organizatör Platformu (9x9 blok, panelli; bloklardan değil, tek parça mod yapısı)."""
import math
import os
from ortak import Form, kutu, fill, rows, panel, over, kart, OUT, Z, model


def pano(w, h, renk='%', kenar='&'):
    g = fill(w, h, renk)
    for x in range(w):
        g[0][x] = kenar; g[h - 1][x] = kenar
    for y in range(h):
        g[y][0] = kenar; g[y][w - 1] = kenar
    return g


# ------------------------------------------------------------------ Aqualit Fırın
def firin(yanik=False):
    f = Form('firin' + ('_y' if yanik else ''), 'Aqualit Fırın')
    f.bone('root', None, (0, 0, 0))
    ates = 'ö' if yanik else '0'
    on = pano(16, 16, '%', '&')
    # üstte ekran şeridi (sıcaklık çubuğu), ortada pencere, altta ızgara
    over(on, rows('kkkkkkkkkkkk'), 2, 2)
    over(on, rows(('Ç' * 7 + 'ö' * 3 + 'kk') if yanik else 'kkkkkkkkkkkk'), 2, 3)
    pen = [['k'] * 10 for _ in range(6)]
    for y in range(6):
        for x in range(10):
            if 1 <= y <= 4 and 1 <= x <= 8:
                pen[y][x] = (('Ç' if (x + y) % 3 == 0 else ates) if yanik else '0')
    over(on, pen, 3, 6)
    over(on, rows('&*&*&*&*&*&*'), 2, 13)
    yan = pano(16, 16, '%', '&')
    for y in range(3, 13, 3):
        over(yan, rows('*' * 10), 3, y)
    ust = pano(16, 16, '&', '*')
    over(ust, rows('ööö', 'öÇö', 'ööö') if yanik else rows('***', '*&*', '***'), 6, 6)
    kutu(f, 'root', 'govde', (-8, 0, -8), (8, 16, 8), base='%', front=on, back=pano(16, 16, '%', '&'),
         left=yan, right=[r[:] for r in yan], top=ust, glow='öÇ' if yanik else '')
    # yanlarda elektrik bobinleri (kabarık), arkada kablo girişi
    for ad, x0 in (('bobin_l', -9), ('bobin_r', 8)):
        kutu(f, 'root', ad, (x0, 4, -3), (x0 + 1, 12, 3), base='y',
             left=[['ö' if yanik and y % 2 else 'y' for _ in range(6)] for y in range(8)],
             right=[['ö' if yanik and y % 2 else 'y' for _ in range(6)] for y in range(8)], glow='ö' if yanik else '')
    kutu(f, 'root', 'kablo_giris', (-2, 6, -9), (2, 10, -8), base='3', back=rows('3öö3', 'ö33ö', 'ö33ö', '3öö3'), glow='ö')
    return f


# ------------------------------------------------------------------ Aqualit Kablo
def kablo(yonler):
    f = Form('kablo_' + ''.join(yonler), 'Aqualit Kablo')
    f.bone('root', None, (0, 0, 0))
    isik = lambda w, h: [['ö' if (i + j) % 4 == 0 else '3' for i in range(w)] for j in range(h)]
    kutu(f, 'root', 'merkez', (-3, 5, -3), (3, 11, 3), base='3', front=pano(6, 6, '3', '&'), back=pano(6, 6, '3', '&'),
         left=pano(6, 6, '3', '&'), right=pano(6, 6, '3', '&'), top=over(pano(6, 6, '3', '&'), rows('öö', 'öö'), 2, 2),
         bottom=pano(6, 6, '3', '&'), glow='ö')
    kol = {'n': ((-2, 6, -8), (2, 10, -3)), 's': ((-2, 6, 3), (2, 10, 8)), 'w': ((-8, 6, -2), (-3, 10, 2)),
           'e': ((3, 6, -2), (8, 10, 2)), 'u': ((-2, 11, -2), (2, 16, 2)), 'd': ((-2, 0, -2), (2, 5, 2))}
    for y in yonler:
        a, b = kol[y]
        w, h, d = (int(b[i] - a[i]) for i in range(3))
        kutu(f, 'root', 'kol_' + y, a, b, base='3', front=isik(w, h), back=isik(w, h), left=isik(d, h), right=isik(d, h),
             top=isik(w, d), bottom=isik(w, d), glow='ö')
    return f


# ------------------------------------------------------------------ Uzaktan Aktarım Bloğu
def aktarim(t=0.0):
    f = Form('aktarim', 'Uzaktan Aktarım Bloğu')
    f.bone('root', None, (0, 0, 0))
    yan = pano(16, 10, '1', '3')
    over(yan, rows('PPPPPPPPPP'), 3, 4)
    kutu(f, 'root', 'taban', (-8, 0, -8), (8, 10, 8), base='1', front=yan, back=[r[:] for r in yan], left=[r[:] for r in yan],
         right=[r[:] for r in yan], top=pano(16, 16, '3', 'P'), glow='P')
    # üstte dönen halka ve ortasında eşya girdabı
    f.bone('halka', 'root', (0, 12, 0))
    for nm, aa, bb in (('h1', (-6, 11, -6), (6, 12, -5)), ('h2', (-6, 11, 5), (6, 12, 6)),
                       ('h3', (-6, 11, -5), (-5, 12, 5)), ('h4', (5, 11, -5), (6, 12, 5))):
        w_, d_ = int(bb[0] - aa[0]), int(bb[2] - aa[2])
        kutu(f, 'halka', nm, aa, bb, base='ğ', top=[['ü' if (i + j) % 3 == 0 else 'ğ' for i in range(w_)] for j in range(d_)], glow='ğü')
    g = []
    for z in range(8):
        r = []
        for x in range(8):
            d = math.hypot(x - 3.5, z - 3.5) / 3.5
            a = math.atan2(z - 3.5, x - 3.5) + d * 3 - t * 6.283
            v = (math.sin(a * 2) + 1) / 2
            r.append('Ç' if d < 0.3 else ('ü' if v > 0.7 else 'ğ' if v > 0.4 else 'ş') if d <= 1.05 else ' ')
        g.append(r)
    kutu(f, 'root', 'girdap', (-4, 10, -4), (4, 11, 4), base='ğ', top=g, glow='ğüÇş')
    # yan anten
    kutu(f, 'root', 'anten', (6, 10, 6), (7, 16, 7), base='%')
    kutu(f, 'root', 'anten_uc', (5.5, 16, 5.5), (7.5, 17, 7.5), base='P', glow='P')
    return f


def poz_aktarim(t):
    return {'halka': [0, t * 360, 0]}


# ------------------------------------------------------------------ Organizatör Platformu (9x9 blok)
def platform():
    """Tek parça mod yapısı (bloklardan değil): 9x9 blok (144 piksel) metal zemin, kenarlarda kablo yuvaları ve ışık
    şeritleri, ortada Organizatör'ün durduğu yükseltilmiş daire, önde dokunmatik panel (konsol + yarı saydam ekran)."""
    f = Form('platform', 'Organizatör Platformu')
    f.bone('root', None, (0, 0, 0))
    N = 144
    h = N // 2
    # zemin: 9x9 karo (her karo 16 piksel) — kenar çizgili metal
    zemin = [['&' if (x % 16 in (0, 15) or y % 16 in (0, 15)) else ('*' if (x // 16 + y // 16) % 2 else '%')
              for x in range(N)] for y in range(N)]
    for i in range(N):                     # dış kenarda turkuaz ışık şeridi
        for j in (2, N - 3):
            zemin[j][i] = 'ö'; zemin[i][j] = 'ö'
    # v0.5.0: ortadaki daire artık zemine boyalı (yükseltilmiş daire Organizatör'ü içine gömüyordu)
    for r, renk in ((24, '1'), (18, '3'), (12, 'P')):
        for zz in range(N):
            for xx in range(N):
                d = math.hypot(xx - h + 0.5, zz - h + 0.5)
                if d <= r:
                    zemin[zz][xx] = renk if d < r - 1.5 else '&'
    kutu(f, 'root', 'zemin', (-h, 0, -h), (h, 2, h), base='%', top=zemin,
         front=[['&'] * N, ['ö' if x % 8 == 0 else '&' for x in range(N)]],
         back=[['&'] * N, ['ö' if x % 8 == 0 else '&' for x in range(N)]],
         left=[['&'] * N, ['ö' if x % 8 == 0 else '&' for x in range(N)]],
         right=[['&'] * N, ['ö' if x % 8 == 0 else '&' for x in range(N)]], glow='öP')
    # kenarlarda kablo yuvaları (her kenarda 3)
    for k in (-48, 0, 48):
        for ad, a, b in ((f'y_n{k}', (k - 3, 2, -h), (k + 3, 4, -h + 3)), (f'y_s{k}', (k - 3, 2, h - 3), (k + 3, 4, h)),
                         (f'y_w{k}', (-h, 2, k - 3), (-h + 3, 4, k + 3)), (f'y_e{k}', (h - 3, 2, k - 3), (h, 4, k + 3))):
            w, hh, d = (int(b[i] - a[i]) for i in range(3))
            kutu(f, 'root', ad, a, b, base='3', top=[['ö' if (i + j) % 2 == 0 else '3' for i in range(w)] for j in range(d)], glow='ö')
    # önde panel: ayak + eğik konsol + yarı saydam ekran
    kutu(f, 'root', 'panel_ayak', (-6, 2, 36), (6, 20, 42), base='%', front=pano(12, 18, '%', '&'))
    konsol = pano(24, 10, 'k', '&')
    for y in range(2, 8):
        for x in range(2, 22):
            konsol[y][x] = 'ö' if (x * 7 + y * 3) % 11 == 0 else ('Ç' if (x + y) % 13 == 0 else 'k')
    kutu(f, 'root', 'konsol', (-12, 20, 34), (12, 22, 44), base='&', top=konsol, glow='öÇ')
    kutu(f, 'root', 'ekran', (-12, 22, 34), (12, 36, 35), base='<',
         front=[['^' if y in (0, 13) or x in (0, 23) else ('~' if (x - y) % 9 == 0 else '<') for x in range(24)] for y in range(14)])
    return f




if __name__ == '__main__':
    imgs = []
    for yanik, ad in ((False, 'Fırın: kapalı'), (True, 'Fırın: çalışıyor')):
        geo, tex, glow = model(firin(yanik), W=256)
        cam = Z.Cam(yaw=30, elev=22, scale=8, size=(260, 260), center=(0, 8, 0))
        imgs.append((Z.render(geo, tex, {}, (), cam, glow=glow, ground={'y': -0.5, 'color': (58, 66, 74)}), ad))
    for yon, ad in (('ns', 'Kablo: düz'), ('nseu', 'Kablo: 4 bağlantı')):
        geo, tex, glow = model(kablo(list(yon)), W=128)
        cam = Z.Cam(yaw=30, elev=28, scale=8, size=(260, 260), center=(0, 8, 0))
        imgs.append((Z.render(geo, tex, {}, (), cam, glow=glow, ground={'y': -0.5, 'color': (58, 66, 74)}), ad))
    geo, tex, glow = model(aktarim(0.1), W=128)
    cam = Z.Cam(yaw=30, elev=30, scale=8, size=(260, 260), center=(0, 9, 0))
    imgs.append((Z.render(geo, tex, poz_aktarim(0.1), (), cam, glow=glow, ground={'y': -0.5, 'color': (58, 66, 74)}), 'Uzaktan Aktarım'))
    print(kart('Organizatör üssü · bloklar', imgs, os.path.join(OUT, '86_org_bloklar.png'),
               alt='Fırın yalnız Organizatör kullanır (elektrikli, çok hızlı). Kablo cihazları platforma bağlar.'))
    fr = []
    for i in range(36):
        t = i / 36
        geo, tex, glow = model(aktarim(t), W=128)
        fr.append(Z.render(geo, tex, poz_aktarim(t), (), Z.Cam(yaw=25 + i * 10, elev=28, scale=9, size=(300, 300), center=(0, 9, 0)),
                           glow=glow, ground={'y': -0.5, 'color': (58, 66, 74)}))
    print(Z.gif(fr, os.path.join(OUT, '86_aktarim.gif'), ms=70))
    geo, tex, glow = model(platform(), W=1024)
    fr = []
    for i in range(36):
        fr.append(Z.render(geo, tex, {}, (), Z.Cam(yaw=25 + i * 10, elev=32, scale=2.6, size=(460, 380), center=(0, 10, 0)),
                           glow=glow, ground={'y': -0.5, 'color': (58, 66, 74)}))
    print(Z.gif(fr, os.path.join(OUT, '87_org_platform.gif'), ms=70))
    print(kart('Organizatör Platformu · 9x9 blok', [(fr[0], '3/4 önden'), (fr[9], 'yandan'), (fr[18], 'arkadan')],
               os.path.join(OUT, '87_org_platform.png'),
               alt='Tek parça mod yapısı · ortada Organizatör · önde dokunmatik panel · kenarlarda 12 kablo yuvası'))
