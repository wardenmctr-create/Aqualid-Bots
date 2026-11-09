"""v0.4 tasarımları için ortak yardımcılar: model (kesif.Form), robot parçaları, 3B önizleme."""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(HERE)
for p in (ART, os.path.join(ART, 'addon', 'gen'), os.path.join(ART, 'addon', 'test')):
    if p not in sys.path:
        sys.path.insert(0, p)
import kesif as K                      # noqa: E402
from kesif import Form, Part, fill, panel, rows, over, hline, vline, dots, mirror_h   # noqa: E402,F401
from kesif_araclar import add_box, auto  # noqa: E402,F401
import robot as R                       # noqa: E402
import render_z as Z                    # noqa: E402
from PIL import Image, ImageDraw, ImageFont   # noqa: E402

OUT = os.path.join(ART, 'onizleme')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

# yeni renkler (portal: mor-turkuaz girdap)
R.RP.update({
    'ç': (40, 10, 70), 'ş': (90, 30, 150), 'ğ': (150, 70, 230), 'ü': (210, 150, 255),   # portal moru
    'ı': (0, 90, 100), 'ö': (40, 200, 210), 'Ç': (170, 255, 250),                      # portal turkuazı
})


def robot_parcalari(kind, cikar=()):
    """robot.py'deki robotu (bone 'root') Form parçası olarak verir; 'cikar' adlı parçalar atlanır."""
    out = []
    for p in R.robot(kind):
        if p.name in cikar:
            continue
        out.append(Part('root', p, 'EYES' if p.name == 'head' else ''))
    return out


def kutu(f, bone, ad, a, b, base='M', glow='', **yuz):
    """auto() yüzleriyle kutu; verilen yüzler üstüne yazılır."""
    y = auto(a, b, base=base)
    y.update({k: v for k, v in yuz.items() if v is not None})
    return f.add(bone, ad, a, b, glow=glow, base=base, **y)


def model(f, W=128):
    return K.build(forms=[f], W=W, ident='geometry.aqualit.tasarim')


def dondur_gif(f, ad, center, scale, size=(360, 360), elev=18, poz=None, kare=36, W=128, ground=-1):
    """Döner 3B önizleme. poz(t) -> render_z pozu (pervane dönüşü vb.)."""
    geo, tex, glow = model(f, W)
    frames = []
    for i in range(kare):
        t = i / kare
        cam = Z.Cam(yaw=25 + 360 * t, elev=elev, scale=scale, size=size, center=center)
        frames.append(Z.render(geo, tex, poz(t) if poz else {}, (), cam, glow=glow,
                               ground={'y': ground, 'color': (58, 66, 74)}))
    yol = os.path.join(OUT, ad)
    Z.gif(frames, yol, ms=60)
    return yol, frames


def kart(baslik, resimler, yol, alt=None):
    """Yan yana resimler + başlıklar (PNG)."""
    w = sum(im.width for im, _ in resimler) + 20 * (len(resimler) + 1)
    h = max(im.height for im, _ in resimler) + 115
    c = Image.new('RGB', (w, h), (24, 28, 32))
    d = ImageDraw.Draw(c)
    f1, f2 = ImageFont.truetype(FONT, 24), ImageFont.truetype(FONT, 17)
    d.text((20, 12), baslik, font=f1, fill=(64, 224, 208))
    x = 20
    for im, t in resimler:
        c.paste(im.convert('RGB'), (x, 50))
        d.text((x + 6, 54 + im.height), t, font=f2, fill=(230, 230, 230))
        x += im.width + 20
    if alt:
        d.text((20, h - 26), alt, font=f2, fill=(160, 170, 180))
    c.save(yol)
    return yol


def kizak(f, bone, x, y0, y1, z, govde_x=None, isik='ö'):
    """Helikopter iniş kızakları: gövdenin altından (x=±govde_x, y1) sağa-sola çapraz açılan düz dikmeler;
    dikmelerin ucunda z boyunca kızak borusu (x=±x, y0), ön ucu yukarı kıvrık, üstünde akan turkuaz şerit."""
    gx = govde_x if govde_x is not None else x - 4
    dx, dy = x - gx, y1 - (y0 + 1)
    L = math.hypot(dx, dy)
    aci = math.degrees(math.atan2(dx, dy))
    for ad, sx in (('l', -1), ('r', 1)):
        cx = sx * x
        kutu(f, bone, f'kizak_{ad}', (cx - 0.5, y0, -z), (cx + 0.5, y0 + 1, z), base='%',
             top=[['ö' if j % 4 == 1 else '*'] for j in range(int(2 * z))], glow=isik)
        # ön uç: tek düz çubuk, çapraz yukarı kalkar (eğik kemik)
        ub = f'kizak_uc_{ad}'
        f.bone(ub, bone, (cx, y0 + 0.5, z), (UC_ACI, 0, 0))
        kutu(f, ub, ub, (cx - 0.5, y0, z - 1), (cx + 0.5, y0 + 1, z + 3), base='%',
             top=[['*'], ['*'], ['*'], [isik]], front=rows(isik), glow=isik)
        kutu(f, bone, f'kizak_arka_{ad}', (cx - 0.5, y0, -z - 1), (cx + 0.5, y0 + 1, -z), base='*')
        for k, zz in enumerate((-round(z * 0.55), round(z * 0.55))):
            db = f'dikme_{ad}{k}'
            f.bone(db, bone, (sx * gx, y1, zz), (0, 0, sx * aci * KIZAK_ISARET))
            n = max(1, round(L))
            kutu(f, db, db, (sx * gx - 0.5, y1 - n, zz - 0.5), (sx * gx + 0.5, y1, zz + 0.5), base='&',
                 left=[['&'] for _ in range(n)], right=[['&'] for _ in range(n)])
            kutu(f, bone, f'baglanti_{ad}{k}', (sx * gx - 1, y1, zz - 1), (sx * gx + 1, y1 + 1, zz + 1), base='%')


KIZAK_ISARET = -1
UC_ACI = -40
