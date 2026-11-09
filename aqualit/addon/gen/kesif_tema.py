"""(gen) Keşif'in Nether ve End temaları (6 hâlin hepsi): doku renk dönüşümü + temaya özel süs parçaları.
Nether: turkuaz -> kızıl/turuncu, koyu yerler kara taş; kara taş boynuzlar, parlayan magma şeritleri.
End: turkuaz -> mor, altın -> soluk End taşı sarısı; üstte süzülen End kristali, arkada mor kanatçıklar.
Oyunda: boyuta geçince otomatik (doku dizisi + süs kemikleri ölçek animasyonuyla)."""
import colorsys
import math
import os
import sys
HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.normpath(os.path.join(HERE, '..', '..'))
for p in (HERE, ART):
    if p not in sys.path:
        sys.path.insert(0, p)
import kesif as K                # noqa: E402
from kesif import Form, fill, rows   # noqa: E402
from kesif_araclar import auto   # noqa: E402
import robot as R                # noqa: E402
R.RP.update({'ç': (40, 10, 70), 'ş': (90, 30, 150), 'ğ': (150, 70, 230), 'ü': (210, 150, 255),
             'ı': (0, 90, 100), 'ö': (40, 200, 210), 'Ç': (170, 255, 250)})   # End kristali / portal renkleri

ROOT = {'robot': 'root', 'ucak': 'u_root', 'gemi': 'g_root', 'denizalti': 'd_root', 'arazi': 'a_root', 'matkap': 'm_root'}


def kutu(f, bone, ad, a, b, base='M', glow='', **yuz):
    y = auto(a, b, base=base)
    y.update({k: v for k, v in yuz.items() if v is not None})
    return f.add(bone, ad, a, b, glow=glow, base=base, **y)

TEMALAR = ['normal', 'nether', 'end']


def _sinif(r, g, b):
    """Orijinal piksel rengi -> malzeme sınıfı."""
    h, s_, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    hd = h * 360
    if 150 <= hd <= 200 and s_ > 0.22:
        return 'govde'
    if 195 < hd <= 240 and s_ > 0.25:
        return 'cam'
    if 35 <= hd <= 60 and s_ > 0.35 and v > 0.45:
        return 'altin'
    if 12 <= hd < 35 and s_ > 0.3 and v < 0.8:
        return 'ahsap'
    if (hd < 12 or hd > 345) and s_ > 0.45:
        return 'kirmizi'
    if s_ < 0.2 and v > 0.68:
        return 'acik'
    if s_ < 0.25 and v <= 0.5:
        return 'koyu'
    return 'diger'


def _kar(x, y, n=1):
    """Kararlı sözde rastgele (desen benekleri)."""
    return ((x * 73856093) ^ (y * 19349663) ^ (n * 83492791)) % 1000 / 1000


def _malzeme(tema, sinif, x, y, v):
    """Atlas pikselinin (x, y) yeni rengi; v: eski parlaklık (gölgeyi korur)."""
    k = 0.75 + v * 0.45                     # yüzün ışık/gölgesi
    c = lambda r, g, b: (int(min(255, r * k)), int(min(255, g * k)), int(min(255, b * k)))
    satir = y // 4
    harc = (y % 4 == 3) or ((x + (satir % 2) * 4) % 8 == 7)
    if tema == 'nether':
        if sinif == 'govde':                # Nether tuğlası
            if harc:
                return c(26, 12, 16)
            return c(*((70, 30, 34) if _kar(x, y) < 0.55 else (58, 24, 30)))
        if sinif == 'acik':                 # Nether kuvarsı
            return c(*((236, 226, 220) if (x + y) % 5 else (210, 190, 186)))
        if sinif == 'koyu':                 # kara taş (ara ara altın kakma)
            if _kar(x, y, 2) < 0.03:
                return c(230, 180, 60)
            return c(*((42, 36, 44) if _kar(x, y, 3) < 0.6 else (56, 48, 58)))
        if sinif == 'ahsap':                # kızıl kalas
            return c(*((122, 46, 70) if (y % 4) else (92, 32, 52)))
        if sinif == 'cam':                  # lav ışıklı cam
            return c(255, 140, 40)
        if sinif == 'altin':
            return c(250, 196, 60)
        return None
    if tema == 'end':
        if sinif == 'govde':                # purpur bloğu (kare desenli)
            kenar = (x % 8 in (0, 7)) or (y % 8 in (0, 7))
            return c(*((122, 82, 122) if kenar else ((170, 120, 170) if _kar(x, y) < 0.6 else (158, 108, 158))))
        if sinif == 'acik':                 # End taşı (benekli)
            return c(*((222, 224, 166) if _kar(x, y, 4) < 0.7 else (200, 200, 140)))
        if sinif == 'koyu':                 # obsidyen (mor ışıltılı)
            return c(*((40, 16, 60) if _kar(x, y, 5) < 0.08 else (18, 14, 28)))
        if sinif == 'ahsap':                # End taşı tuğlası
            return c(*((190, 190, 130) if not harc else (150, 150, 100)))
        if sinif == 'cam':                  # pembe-mor ışık
            return c(230, 120, 255)
        if sinif == 'altin':
            return c(236, 232, 200)
        return None
    return None


def robot_maskesi(geo, W, H):
    """Atlasın robot hâline ait dikdörtgenleri: tema bu bölgelere dokunmaz (robot her yerde aynı)."""
    from PIL import Image as _I
    m = _I.new('L', (W, H), 0)
    bones = geo['minecraft:geometry'][0]['bones']
    par = {b['name']: b.get('parent') for b in bones}
    def robotun(n):
        while n:
            if n == 'root':
                return True
            n = par.get(n)
        return False
    from PIL import ImageDraw as _D
    d = _D.Draw(m)
    for b in bones:
        if not robotun(b['name']) or b['name'].startswith(('tn_', 'te_')):
            continue
        for cb in b.get('cubes', []):
            uv = cb.get('uv')
            if isinstance(uv, dict):
                for f in uv.values():
                    (u, v), (w, h) = f['uv'], f['uv_size']
                    d.rectangle([min(u, u + w), min(v, v + h), max(u, u + w) - 1, max(v, v + h) - 1], fill=255)
            elif isinstance(uv, list):
                sx, sy, sz = cb['size']
                d.rectangle([uv[0], uv[1], uv[0] + 2 * (sx + sz) - 1, uv[1] + sz + sy - 1], fill=255)
    return m


def renk_donustur(tex, tema, maske=None, glow=False):
    """Dokuyu temanın malzemelerine çevirir (Nether tuğlası, kuvars, kara taş... / purpur, End taşı, obsidyen).
    maske: dokunulmayacak bölgeler (robot hâli). glow: ışık dokusu (yalnız renk tonu değişir)."""
    if tema == 'normal':
        return tex.copy()
    out = tex.copy()
    px = out.load()
    mk = maske.load() if maske else None
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if not a or (mk and mk[x, y]):
                continue
            sinif = _sinif(r, g, b)
            v = max(r, g, b) / 255
            if glow:
                if sinif in ('govde', 'cam', 'acik'):
                    px[x, y] = ((255, 150, 50) if tema == 'nether' else (230, 130, 255)) + (a,)
                continue
            yeni = _malzeme(tema, sinif, x, y, v)
            if yeni:
                px[x, y] = yeni + (a,)
    return out


def magma_catlak(tex, glow, maske=None):
    """Nether: tuğla harcında ara ara parlayan magma (doku + ışık dokusu)."""
    t, g = tex.copy(), glow.copy()
    pt, pg = t.load(), g.load()
    mk = maske.load() if maske else None
    for y in range(t.height):
        for x in range(t.width):
            r, gg, b, a = pt[x, y]
            if not a or (mk and mk[x, y]):
                continue
            if r < 40 and gg < 20 and b < 24 and r > b and _kar(x, y, 9) < 0.07:   # harç çizgisi (seyrek)
                pt[x, y] = (255, 120, 30, 255)
                pg[x, y] = (255, 140, 40, 255)
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
    """Temaya özel süs kemikleri (tn_<root>: Nether, te_<root>: End); ana gövdenin üstüne, ortaya yakın oturur.
    Robot hâline süs yok (robot her yerde aynı); kemikler yine de var (animasyon tablosu için)."""
    tn, te = 'tn_' + root, 'te_' + root
    if root == 'root':
        f.bone(tn, root, (0, 20, 0))
        f.bone(te, root, (0, 20, 0))
        f.bone(te + '_kristal', te, (0, 25, 0))
        return
    (x0, y0, z0), (x1, y1, z1) = govde_siniri(fm, GOVDE[root])
    cx, cz = round((x0 + x1) / 2), round((z0 + z1) / 2)
    ust = math.ceil(y1)
    f.bone(tn, root, (cx, ust, cz))
    f.bone(te, root, (cx, ust, cz))
    # Nether: iki kızıl mantar (sap + şapka) ve ortada ruh feneri
    for ad, dx, dz in (('a', -3, -3), ('b', 3, 2)):
        kutu(f, tn, f'{tn}_sap_{ad}', (cx + dx - 0.5, ust, cz + dz - 0.5), (cx + dx + 0.5, ust + 2, cz + dz + 0.5), base='4')
        kutu(f, tn, f'{tn}_sapka_{ad}', (cx + dx - 1.5, ust + 2, cz + dz - 1.5), (cx + dx + 1.5, ust + 3, cz + dz + 1.5), base='r',
             top=rows('rRr', 'R9R', 'rRr'), front=rows('rRr'), back=rows('rRr'), left=rows('rRr'), right=rows('rRr'))
    kutu(f, tn, f'{tn}_fener', (cx - 1, ust, cz - 1), (cx + 1, ust + 2, cz + 1), base='%',
         front=rows('<<', '^^'), back=rows('<<', '^^'), left=rows('<<', '^^'), right=rows('<<', '^^'), top=rows('%%', '%%'), glow='<^')
    # End: iki End çubuğu (beyaz ışık) ve ortada süzülen End kristali
    for ad, dx, dz in (('a', -3, -2), ('b', 3, 2)):
        kutu(f, te, f'{te}_cubuk_{ad}', (cx + dx - 0.5, ust, cz + dz - 0.5), (cx + dx + 0.5, ust + 5, cz + dz + 0.5), base='9',
             front=rows('9', '9', '9', '9', '%'), back=rows('9', '9', '9', '9', '%'), left=rows('9', '9', '9', '9', '%'),
             right=rows('9', '9', '9', '9', '%'), glow='9')
    f.bone(te + '_kristal', te, (cx, ust + 6, cz))
    kutu(f, te + '_kristal', f'{te}_kafes', (cx - 1.5, ust + 4.5, cz - 1.5), (cx + 1.5, ust + 7.5, cz + 1.5), base='ü',
         front=rows('üşü', 'şÇş', 'üşü'), back=rows('üşü', 'şÇş', 'üşü'), left=rows('üşü', 'şÇş', 'üşü'),
         right=rows('üşü', 'şÇş', 'üşü'), top=rows('üşü', 'şÇş', 'üşü'), glow='üÇ')


def tema_formu(key):
    fm = K.all_forms()[key]
    f = Form(key + '_tema', fm.name)
    for n in fm.order:
        par, piv, rot = fm.bones[n]
        f.bone(n, par, piv, rot)
    f.parts = list(fm.parts)
    root = ROOT[key]
    susler(fm, f, root)
    return f, root


def gizle_poz(tema, root):
    return {('tn_' + root): {'s': 1 if tema == 'nether' else 0.001}, ('te_' + root): {'s': 1 if tema == 'end' else 0.001}}




def tum_formlar():
    """Oyundaki Keşif geometrisi için: 6 hâl + tema süs kemikleri (tn_*, te_*)."""
    return [tema_formu(k)[0] for k in ['robot', 'ucak', 'gemi', 'denizalti', 'arazi', 'matkap']]
