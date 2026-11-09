"""Organizatör için 3 yeni vizör seçeneği (eski çerçeve vizör beğenilmedi)."""
from ortak import *  # noqa: F401,F403
from ortak import Form, Part, kutu, fill, rows, dondur_gif, kart, robot_parcalari, OUT, Z, model
import os

# kafa: x -6..6, y 10..19, ön yüz z=5; gözler y ~13-17


def secenek(no):
    f = Form(f'org_v{no}', 'Organizatör')
    f.bone('root', None, (0, 0, 0))
    f.parts += robot_parcalari('toplayici', cikar=('visor', 'mic'))
    if no == 1:
        # Akıllı gözlük: iki ayrı köşeli cam çerçeve, köprü, saplar kulaklığa gider; camda küçük HUD noktası
        for ad, x0 in (('gl_l', -5.5), ('gl_r', 0.5)):
            on = [list('2PPP2'), list('P   P'), list('P   P'), list('P   P'), list('2ppp2')]
            if ad == 'gl_r':
                on[1][3] = 'Z'
            kutu(f, 'root', ad, (x0, 12.5, 5), (x0 + 5, 17.5, 6), base='P', glow='PZ',
                 front=[r[:5] for r in on], back=[[' '] * 5 for _ in range(5)])
        kutu(f, 'root', 'kopru', (-0.5, 15.5, 5), (0.5, 16.5, 6), base='p')
        for ad, x0 in (('sap_l', -7), ('sap_r', 6)):
            kutu(f, 'root', ad, (x0, 15.5, -1), (x0 + 1, 16.5, 6), base='2')
    elif no == 2:
        # Tarayıcı monokl: sağ gözün önünde çıkıntılı mor mercek (halka + parlayan iç), kolla kulaklığa bağlı
        kutu(f, 'root', 'mon_halka', (1, 12.5, 5), (6, 17.5, 7), base='2',
             front=rows('22222', '2ZPZ2', '2PüP2', '2ZPZ2', '22222'), glow='PZü')
        kutu(f, 'root', 'mon_isik', (2, 13.5, 7), (5, 16.5, 8), base='P', glow='PZü',
             front=rows('ZPZ', 'PüP', 'ZPZ'))
        kutu(f, 'root', 'mon_kol', (6, 14.5, 0), (7, 15.5, 7), base='3')
        kutu(f, 'root', 'mon_led', (6, 16, 3), (7, 17, 4), base='Z', glow='Z')
    else:
        # Siperlik ekranı: şapka siperliğinden inen ince, ışıklı turkuaz-mor holo panel; gözler çizgilerin arasından görünür
        on = [list(' ' * 14) for _ in range(4)]
        on[0] = list('ÇöööööööööööÇ ')[:14]
        on[0] = list('ÇööööööööööööÇ')
        on[1] = list('ö ü        ü ö')[:14]
        on[2] = list('ö            ö')
        on[3] = list('ıöööööööööööı ')[:14]
        kutu(f, 'root', 'holo', (-7, 13, 7.5), (7, 17, 8.5), base='ö', glow='öÇüı',
             front=on, back=[r[:] for r in on], top=[list('Ç' * 14)], bottom=[list('ı' * 14)],
             left=[['ö']] * 4, right=[['ö']] * 4)
        for ad, x0 in (('holo_ask_l', -7), ('holo_ask_r', 6)):
            kutu(f, 'root', ad, (x0, 17, 7), (x0 + 1, 19, 8), base='3')
    return f


ADLAR = {1: '1 · Akıllı gözlük', 2: '2 · Tarayıcı monokl', 3: '3 · Holo siperlik'}
if __name__ == '__main__':
    resimler = []
    for no in (1, 2, 3):
        f = secenek(no)
        yol, frames = dondur_gif(f, f'80_org_vizor_{no}.gif', center=(0, 11, 0), scale=13, size=(300, 340))
        geo, tex, glow = model(f)
        cam = Z.Cam(yaw=20, elev=10, scale=17, size=(300, 340), center=(0, 12, 2))
        resimler.append((Z.render(geo, tex, {}, (), cam, glow=glow, ground={'y': -1, 'color': (58, 66, 74)}), ADLAR[no]))
        print(yol)
    print(kart('Organizatör · yeni vizör seçenekleri', resimler, os.path.join(OUT, '80_org_vizor_secenekler.png'),
               alt='Birini seç: kulaklık, şapka ve sırt çantası aynı kalıyor. (oyunda denenmedi)'))
