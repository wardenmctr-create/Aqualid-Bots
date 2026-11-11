"""Keşif Haritası işaretleri (v0.4.0).

Harita artık gerçek dünyayı üstten gösteren kameradır (kesif_harita.js). Yapılar, sen, robotlar, sandıklar ve
moblar Minecraft haritası işaretleri gibi küçük piksel simgelerle gösterilir; yapıların altında adı yazar.
Hepsi tek bir parçacıkla (aqualit:harita_isaret) çizilir: simge atlası textures/particle/aqualit_harita.png,
betik hangi hücreyi göstereceğini v.u / v.v ile seçer.
"""
import json
import os
from PIL import Image, ImageDraw

from harita_glif import YAPILAR, yazi_ciz, yazi_genislik

HW, HH = 128, 80           # hücre: simge üstte, adı altta (2 kat harf)
SUTUN = 4
ATLAS = (512, 1024)

AD = {'koy': 'KÖY', 'col_tapinagi': 'ÇÖL TAPINAĞI', 'orman_tapinagi': 'ORMAN TAPINAĞI', 'cadi_kulubesi': 'CADI KULÜBESİ',
      'iglo': 'İGLO', 'karakol': 'KARAKOL', 'orman_kosku': 'ORMAN KÖŞKÜ', 'okyanus_aniti': 'OKYANUS ANITI',
      'deneme_odasi': 'DENEME ODASI', 'maden_ocagi': 'MADEN OCAĞI', 'zindan': 'ZİNDAN', 'kale_yeralti': 'KALE',
      'antik_sehir': 'ANTİK ŞEHİR', 'yikik_portal': 'YIKIK PORTAL', 'gemi_enkazi': 'GEMİ ENKAZI',
      'okyanus_harabesi': 'OKY. HARABESİ', 'iz_harabesi': 'İZ HARABESİ', 'col_kuyusu': 'ÇÖL KUYUSU', 'fosil': 'FOSİL',
      'geod': 'AMETİST GEODU', 'nether_kalesi': 'NETHER KALESİ', 'burc_kalintisi': 'BURÇ KALINTISI', 'end_sehri': 'END ŞEHRİ'}

# Minecraft haritası işaretleri gibi: düz renk, koyu kenar, az ton
YON8 = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
KUCUK = ['robot', 'kesif', 'sandik', 'canavar', 'hayvan', 'koylu']


def _koyu(c, k=0.55):
    return tuple(int(v * k) for v in c[:3]) + (255,)


def _acik(c, k=0.45):
    return tuple(int(v + (255 - v) * k) for v in c[:3]) + (255,)


def _kenarli(maske, renk, ic=None):
    """maske: {(x, y): 'g'|'a'} -> 1 piksel siyah kenarlı resim (16x16)."""
    img = Image.new('RGBA', (18, 18), (0, 0, 0, 0))
    for (x, y) in maske:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                img.putpixel((x + 1 + dx, y + 1 + dy), (20, 16, 12, 255))
    for (x, y), t in maske.items():
        img.putpixel((x + 1, y + 1), (ic or _acik(renk)) if t == 'a' else tuple(renk[:3]) + (255,))
    return img


def yapi_simgesi(tur):
    renk, satirlar = YAPILAR[tur]
    m = {}
    for y, s in enumerate(satirlar):
        for x, c in enumerate(s):
            if c == '#':
                m[(x, y)] = 'g'
            elif c == '+':
                m[(x, y)] = 'a'
    img = _kenarli(m, renk, ic=_koyu(renk, 0.5))
    bb = img.getbbox()
    return img.crop(bb) if bb else img


def ok_simgesi(yon, govde, kenar=(20, 16, 12, 255)):
    """Minecraft haritasındaki oyuncu oku gibi: sivri uç, çentikli kuyruk. 8 yön (45° adım), yukarı = kuzey."""
    import math
    S, K = 13, 8                      # son boy, çizim büyütmesi (yumuşak kenar için)
    img = Image.new('RGBA', (S * K, S * K), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    a = math.radians(YON8.index(yon) * 45)
    c = S * K / 2
    dis = [(0, -7), (5.2, 6), (0, 3), (-5.2, 6)]
    ic = [(x * 0.58, 0.5 + (y - 0.5) * 0.58) for x, y in dis]

    def don(pts):
        return [(c + (x * math.cos(a) - y * math.sin(a)) * K, c + (x * math.sin(a) + y * math.cos(a)) * K) for x, y in pts]
    d.polygon(don(dis), fill=kenar)
    d.polygon(don(ic), fill=govde)
    k = img.resize((S, S), Image.BOX)
    # keskin piksel: yarı saydamları tam opak/tam saydam yap (Minecraft işaretleri gibi)
    px = k.load()
    for x in range(S):
        for y in range(S):
            r, g, b, al = px[x, y]
            if al < 110:
                px[x, y] = (0, 0, 0, 0)
                continue
            # en yakın renge oturt (gövde ya da kenar): gri ara tonlar kalmasın
            dg = sum((u - w) ** 2 for u, w in zip((r, g, b), govde[:3]))
            dk = sum((u - w) ** 2 for u, w in zip((r, g, b), kenar[:3]))
            px[x, y] = tuple(govde[:3]) + (255,) if dg < dk else tuple(kenar[:3]) + (255,)
    return k


def kucuk_simge(ad):
    """Robot, Keşif, sandık, canavar, hayvan, köylü: 9-11 piksel nokta simgeler (harita işaretleri boyunda)."""
    R = {
        'robot': ((70, 220, 230), ['.#####.', '#######', '#.#.#.#', '#######', '##...##', '.#####.']),
        'kesif': ((60, 140, 255), ['..###..', '.#####.', '#######', '#.###.#', '#######', '.#...#.']),
        'sandik': ((190, 130, 60), ['#######', '#.....#', '###+###', '#.....#', '#######']),
        'canavar': ((230, 50, 50), ['.###.', '#####', '#####', '#####', '.###.']),
        'hayvan': ((250, 240, 230), ['.###.', '#####', '#####', '#####', '.###.']),
        'koylu': ((70, 200, 80), ['.###.', '#####', '#####', '#####', '.###.']),
    }
    renk, satirlar = R[ad]
    m = {}
    for y, s in enumerate(satirlar):
        for x, c in enumerate(s):
            if c in '#':
                m[(x, y)] = 'g'
            elif c == '+':
                m[(x, y)] = 'a'
    img = _kenarli(m, renk, ic=(240, 220, 120, 255))
    bb = img.getbbox()
    return img.crop(bb)


def etiket(metin):
    w = yazi_genislik(metin, 2)
    img = Image.new('RGBA', (w + 8, 19), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, w + 7, 18), radius=4, fill=(12, 10, 8, 175))
    yazi_ciz(img, 4, 1, metin, (255, 255, 255, 255), 2)
    return img


def atlas():
    img = Image.new('RGBA', ATLAS, (0, 0, 0, 0))
    hucre = {}
    n = 0

    def koy(ad, parca, etk=None, olcek=2):
        nonlocal n
        x0, y0 = (n % SUTUN) * HW, (n // SUTUN) * HH
        p = parca.resize((parca.width * olcek, parca.height * olcek), Image.NEAREST)
        # simgenin ortası hücrenin ortasında (parçacık konumu = simgenin ortası); ad altında
        img.alpha_composite(p, (x0 + (HW - p.width) // 2, y0 + (HH - 20 - p.height) // 2 + 1))
        if etk is not None:
            img.alpha_composite(etk, (x0 + (HW - etk.width) // 2, y0 + HH - etk.height))
        hucre[ad] = [x0, y0]
        n += 1

    for tur in YAPILAR:
        s = yapi_simgesi(tur)
        # simge 2 kat; ad hücrenin altına sığmazsa simge biraz küçülür
        koy(tur, s, etiket(AD[tur]), 3)
    for y in YON8:
        koy('sen_' + y, ok_simgesi(y, (255, 255, 255, 255)), None, 3)
    for y in YON8:
        koy('ok_' + y, ok_simgesi(y, (255, 205, 60, 255)), None, 2)
    for k in KUCUK:
        koy(k, kucuk_simge(k), None, 3)
    return img, hucre


def parcacik():
    tex = {'texture_width': ATLAS[0], 'texture_height': ATLAS[1], 'uv': ['v.u', 'v.v'], 'uv_size': [HW, HH]}
    return {'format_version': '1.10.0', 'particle_effect': {
        'description': {'identifier': 'aqualit:harita_isaret',
                        'basic_render_parameters': {'material': 'particles_blend', 'texture': 'textures/particle/aqualit_harita'}},
        'components': {
            'minecraft:emitter_rate_instant': {'num_particles': 1},
            'minecraft:emitter_lifetime_once': {'active_time': 0},
            'minecraft:emitter_shape_point': {'offset': [0, 0, 0]},
            'minecraft:particle_lifetime_expression': {'max_lifetime': 0.3},
            'minecraft:particle_initial_speed': 0,
            'minecraft:particle_appearance_billboard': {
                'size': ['v.boy', 'v.boy * 0.625'], 'facing_camera_mode': 'lookat_xyz', 'uv': tex},
            'minecraft:particle_appearance_tinting': {'color': [1, 1, 1, 'v.alfa']},
        }}}


def sis():
    hava = {'fog_start': 900.0, 'fog_end': 1000.0, 'fog_color': '#a8c8ff', 'render_distance_type': 'fixed'}
    return {'format_version': '1.16.100', 'minecraft:fog_settings': {
        'description': {'identifier': 'aqualit:harita_sis'}, 'distance': {'air': hava}}}


def js_yaz(hucre, yol):
    with open(yol, 'w') as fh:
        fh.write('// gen/harita_isaret.py üretir — elle değiştirme.\n')
        fh.write('// Harita işaretleri atlası (textures/particle/aqualit_harita.png) hücreleri: ad -> [u, v]\n')
        fh.write(f'export const HUCRE = {json.dumps(hucre)};\n')
        fh.write(f'export const AD = {json.dumps(AD, ensure_ascii=False)};\n')


def build(RP, scripts_dir):
    img, hucre = atlas()
    os.makedirs(f'{RP}/textures/particle', exist_ok=True)
    os.makedirs(f'{RP}/particles', exist_ok=True)
    os.makedirs(f'{RP}/fogs', exist_ok=True)
    img.save(f'{RP}/textures/particle/aqualit_harita.png')
    with open(f'{RP}/particles/aqualit_harita_isaret.json', 'w') as fh:
        json.dump(parcacik(), fh, indent=1)
    with open(f'{RP}/fogs/aqualit_harita_sis.json', 'w') as fh:
        json.dump(sis(), fh, indent=1)
    # pusula çubuğu (locator bar) simgeleri: yapı başına ayrı küçük resim
    os.makedirs(f'{RP}/textures/ui/aqualit_harita', exist_ok=True)
    for tur in YAPILAR:
        yapi_simgesi(tur).save(f'{RP}/textures/ui/aqualit_harita/{tur}.png')
    js_yaz(hucre, os.path.join(scripts_dir, 'harita_isaret.js'))
    return img, hucre


if __name__ == '__main__':
    img, h = atlas()
    img.resize((1024, 1024), Image.NEAREST).save('/tmp/claude-0/-home-user-Aqualid-Bots/c1d36d93-cc13-5156-a87b-5d95e4be10aa/scratchpad/harita_atlas.png')
    print(len(h))
