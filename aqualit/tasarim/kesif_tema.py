"""Keşif'in Nether ve End temaları (6 hâlin hepsi): doku renk dönüşümü + temaya özel süs parçaları.
Nether: turkuaz -> kızıl/turuncu, koyu yerler kara taş; kara taş boynuzlar, parlayan magma şeritleri.
End: turkuaz -> mor, altın -> soluk End taşı sarısı; üstte süzülen End kristali, arkada mor kanatçıklar.
Oyunda: boyuta geçince otomatik (doku dizisi + süs kemikleri ölçek animasyonuyla)."""
import colorsys
import math
import os
import sys
from ortak import Form, Part, kutu, fill, rows, kart, OUT, Z, ART
sys.path.insert(0, os.path.join(ART, 'addon', 'gen'))
import kesif as K                # noqa: E402
import kesif_oyun as KO          # noqa: E402
from PIL import Image            # noqa: E402

TEMALAR = ['normal', 'nether', 'end']


def renk_donustur(tex, tema):
    """Dokunun turkuaz tonlarını temaya çevirir (ve altın sarısını End'de soluk sarıya)."""
    if tema == 'normal':
        return tex.copy()
    out = tex.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            hd = h * 360
            if 150 <= hd <= 200 and s > 0.25:          # turkuaz
                if tema == 'nether':
                    nh, ns, nv = (8 + (hd - 150) * 0.3) / 360, min(1, s * 1.1), v * 0.95
                else:
                    nh, ns, nv = (285 - (hd - 150) * 0.3) / 360, min(1, s * 0.9), v * 0.95
                r2, g2, b2 = colorsys.hsv_to_rgb(nh, ns, nv)
                px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
            elif tema == 'end' and 35 <= hd <= 55 and s > 0.35:   # altın -> End taşı sarısı
                r2, g2, b2 = colorsys.hsv_to_rgb(55 / 360, s * 0.35, min(1, v * 1.05))
                px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
            elif tema == 'nether' and s < 0.15 and v < 0.45:      # koyu gri -> kara taş (hafif mor-kara)
                px[x, y] = (int(r * 0.85 + 6), int(g * 0.75), int(b * 0.85 + 4), a)
    return out


def magma_catlak(tex, glow):
    """Nether: koyu kızıl yüzeylere seyrek, parlayan turuncu magma çatlakları (doku + ışık dokusu)."""
    t, g = tex.copy(), glow.copy()
    pt, pg = t.load(), g.load()
    for y in range(t.height):
        for x in range(t.width):
            r, gg, b, a = pt[x, y]
            if not a:
                continue
            h, s_, v = colorsys.rgb_to_hsv(r / 255, gg / 255, b / 255)
            if (h * 360 < 25 or h * 360 > 340) and s_ > 0.4 and v < 0.75 and ((x * 7 + y * 13) % 29 == 0 or (x * 3 + y * 5) % 37 == 0):
                pt[x, y] = (255, 140, 40, 255)
                pg[x, y] = (255, 160, 60, 255)
    return t, g


def kutu_sinirlari(fm, root):
    """Bir hâlin (root altındaki kemikler) parça sınırları (tasarım koordinatı)."""
    ebeveyn = {n: fm.bones[n][0] for n in fm.bones}
    def altinda(b):
        while b:
            if b == root:
                return True
            b = ebeveyn.get(b)
        return False
    a = [1e9] * 3
    b = [-1e9] * 3
    for p in fm.parts:
        if not altinda(p.bone):
            continue
        for i in range(3):
            a[i] = min(a[i], p.box.a[i], p.box.b[i])
            b[i] = max(b[i], p.box.a[i], p.box.b[i])
    return a, b


GOVDE = {'root': 'head', 'u_root': 'u_body', 'g_root': 'g_body', 'd_root': 'd_body', 'a_root': 'a_body', 'm_root': 'm_body'}


def govde_siniri(fm, kemik):
    """Ana gövde kemiğinin dar parçalarının sınırı (kanat gibi geniş parçalar hariç)."""
    a = [1e9] * 3
    b = [-1e9] * 3
    for p in fm.parts:
        if p.bone != kemik:
            continue
        if abs(p.box.b[0] - p.box.a[0]) > 22:
            continue
        for i in range(3):
            a[i] = min(a[i], p.box.a[i], p.box.b[i])
            b[i] = max(b[i], p.box.a[i], p.box.b[i])
    return a, b


def susler(fm, f, root):
    """Temaya özel süs kemikleri (tn_<root>: Nether, te_<root>: End), ana gövdeye oturur."""
    (x0, y0, z0), (x1, y1, z1) = govde_siniri(fm, GOVDE[root])
    cx, cz = round((x0 + x1) / 2), round((z0 + z1) / 2)
    ust = math.ceil(y1)
    w = x1 - x0
    tn, te = 'tn_' + root, 'te_' + root
    f.bone(tn, root, (cx, ust, cz))
    f.bone(te, root, (cx, ust, cz))
    # Nether: yalnız robot hâlinde başta iki kara taş boynuz (araçlarda magma çatlakları dokuda)
    if root == 'root':
        for ad, sx in (('l', -1), ('r', 1)):
            bx = round(cx + sx * 4)
            kutu(f, tn, f'{tn}_boynuz_{ad}', (bx - 1, ust, cz - 1), (bx + 1, ust + 3, cz + 1), base='%',
                 front=rows('%%', '%%', '!!'), top=rows('#!', '!#'), glow='!#')
            kutu(f, tn, f'{tn}_boynuz2_{ad}', (bx - 0.5 + sx * 0.5, ust + 3, cz - 0.5), (bx + 0.5 + sx * 0.5, ust + 5, cz + 0.5), base='#', glow='#!')
    # End: üstte süzülen End kristali (kafes + pembe çekirdek) ve arkada iki mor kanatçık
    f.bone(te + '_kristal', te, (cx, ust + 5, cz))
    kutu(f, te + '_kristal', f'{te}_kafes', (cx - 2, ust + 3, cz - 2), (cx + 2, ust + 7, cz + 2), base='ü',
         front=rows('üşşü', 'şÇÇş', 'şÇÇş', 'üşşü'), back=rows('üşşü', 'şÇÇş', 'şÇÇş', 'üşşü'),
         left=rows('üşşü', 'şÇÇş', 'şÇÇş', 'üşşü'), right=rows('üşşü', 'şÇÇş', 'şÇÇş', 'üşşü'), glow='üÇ')


def tema_formu(key):
    fm = K.all_forms()[key]
    f = Form(key + '_tema', fm.name)
    for n in fm.order:
        par, piv, rot = fm.bones[n]
        f.bone(n, par, piv, rot)
    f.parts = list(fm.parts)
    root = KO.ROOT['robot' if key == 'robot' else key] if key in KO.ROOT else KO.ROOT.get(key)
    susler(fm, f, root)
    return f, root


def gizle_poz(tema, root):
    return {('tn_' + root): {'s': 1 if tema == 'nether' else 0.001}, ('te_' + root): {'s': 1 if tema == 'end' else 0.001}}


if __name__ == '__main__':
    sira = ['robot', 'ucak', 'gemi', 'denizalti', 'arazi', 'matkap']
    imgs = []
    satirlar = []
    for tema in TEMALAR:
        satir = []
        for key in sira:
            f, root = tema_formu(key)
            geo, tex, glow = K.build(forms=[f], W=512)
            tex2 = renk_donustur(tex, tema)
            glow2 = renk_donustur(glow, tema)
            if tema == 'nether':
                tex2, glow2 = magma_catlak(tex2, glow2)
            sc = 9 if key == 'robot' else 3.6
            cam = Z.Cam(yaw=35, elev=20, scale=sc, size=(230, 210), center=(0, 12 if key == 'robot' else 14, 0))
            im = Z.render(geo, tex2, gizle_poz(tema, root), (), cam, glow=glow2, ground={'y': -0.5, 'color': (58, 66, 74)})
            satir.append(im)
        satirlar.append(satir)
    W, H = 230 * 6 + 20 * 7, (210 + 30) * 3 + 60
    c = Image.new('RGB', (W, H), (24, 28, 32))
    from PIL import ImageDraw, ImageFont
    d = ImageDraw.Draw(c)
    f1 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
    f2 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 16)
    d.text((20, 12), 'Keşif · Normal / Nether / End temaları (boyuta girince otomatik)', font=f1, fill=(64, 224, 208))
    for r, (tema, satir) in enumerate(zip(['Normal', 'Nether', 'End'], satirlar)):
        y = 50 + r * 240
        d.text((20, y), tema, font=f2, fill=[(64, 224, 208), (255, 120, 60), (200, 140, 255)][r])
        for i, im in enumerate(satir):
            c.paste(im.convert('RGB'), (20 + i * 250, y + 24))
    c.save(os.path.join(OUT, '90_kesif_temalar.png'))
    print(os.path.join(OUT, '90_kesif_temalar.png'))
