"""Kuşbakışı Keşif Haritası önizlemesi: telefonda ekranın nasıl görüneceği (temsilî arazi + gerçek işaret atlası)."""
import math, random, sys, os
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'addon', 'gen'))
import harita_isaret as HI

B = '/home/user/mojang/bedrock-samples/resource_pack/textures/blocks/'
OUT = '/home/user/Aqualid-Bots/aqualit/onizleme'
random.seed(4)


def tex(ad, tint=None):
    im = Image.open(B + ad).convert('RGBA')
    im = im.crop((0, 0, 16, 16))
    if tint:
        px = im.load()
        for x in range(16):
            for y in range(16):
                r, g, b, a = px[x, y]
                l = (r + g + b) / 765
                px[x, y] = (int(tint[0] * l), int(tint[1] * l), int(tint[2] * l), 255)
    return im


T = {'cim': tex('grass_top.png', (124, 189, 90)), 'su': tex('water_still_grey.png', (60, 100, 220)), 'kum': tex('sand.png'),
     'yaprak': tex('leaves_oak.tga', (70, 140, 50)), 'tahta': tex('planks_oak.png'), 'tas': tex('cobblestone.png'),
     'yol': tex('grass_path_top.png'), 'kutuk': tex('log_oak_top.png'), 'tarla': tex('wheat_stage_7.png'),
     'saman': tex('hay_block_top.png'), 'cakil': tex('gravel.png')}


def arazi(W, H, px):
    """W x H blok, blok başına px piksel."""
    img = Image.new('RGBA', (W * px, H * px))
    k = {a: b.resize((px, px), Image.BOX) for a, b in T.items()}
    harita = [['cim'] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            n = math.sin(x * 0.09) + math.cos(y * 0.11 + x * 0.03) + 0.6 * math.sin((x + y) * 0.05)
            if n < -1.25:
                harita[y][x] = 'su'
            elif n < -1.0:
                harita[y][x] = 'kum'
            elif random.random() < 0.035 and n > -0.6:
                for dy in range(-2, 3):
                    for dx in range(-2, 3):
                        if 0 <= x + dx < W and 0 <= y + dy < H and abs(dx) + abs(dy) < 4:
                            harita[y + dy][x + dx] = 'yaprak'
    return harita, k


def bina(h, x0, y0, w, d, tur='tahta'):
    for y in range(y0, y0 + d):
        for x in range(x0, x0 + w):
            if 0 <= y < len(h) and 0 <= x < len(h[0]):
                h[y][x] = tur if (y in (y0, y0 + d - 1) or x in (x0, x0 + w - 1)) else 'tahta'


def ciz(ad, olcek, yapilar, kenar, robotlar=()):
    SW, SH = 960, 540
    px = {0: 12, 1: 6, 2: 3}[olcek]
    W, H = SW // px + 2, SH // px + 2
    h, k = arazi(W, H, px)
    cx, cy = W // 2, H // 2
    # köy: yollar, evler, tarlalar
    vx, vy = cx + int(26 * 12 / px), cy - int(6 * 12 / px)
    for x in range(vx - 14, vx + 14):
        if 0 <= x < W and 0 <= vy < H:
            h[vy][x] = 'yol'
    for y in range(vy - 12, vy + 12):
        if 0 <= y < H and 0 <= vx < W:
            h[y][vx] = 'yol'
    for (ox, oy) in ((-9, -7), (3, -8), (-8, 3), (4, 4), (-14, -2)):
        bina(h, vx + ox, vy + oy, 5, 4, 'kutuk')
    for (ox, oy) in ((8, -4), (8, 2)):
        for y in range(vy + oy, vy + oy + 4):
            for x in range(vx + ox, vx + ox + 6):
                if 0 <= y < H and 0 <= x < W:
                    h[y][x] = 'tarla' if (x - vx) % 3 else 'su'
    img = Image.new('RGBA', (W * px, H * px))
    for y in range(H):
        for x in range(W):
            img.paste(k[h[y][x]], (x * px, y * px))
    # tepeden ışık: yaprak/bina biraz gölge
    img = img.crop((px, px, px + SW, px + SH))
    at, hc = HI.atlas()
    # işaret boyu: 64x48 hücre ekran yüksekliğinin ~%8'i
    s = 0.85

    def isaret(ad_, x, y, alfa=1.0, k_=1.0):
        u, v = hc[ad_]
        c = at.crop((u, v, u + 128, v + 80))
        c = c.resize((int(128 * 1.1 * k_), int(80 * 1.1 * k_)), Image.NEAREST)
        if alfa < 1:
            a = c.split()[3].point(lambda q: int(q * alfa))
            c.putalpha(a)
        img.alpha_composite(c, (int(x - c.width / 2), int(y - c.height / 2)))
    for (t, bx, by) in yapilar:
        isaret(t, SW / 2 + bx * 12 / px * px / 12 * (12 / px) * px / 12 if False else SW / 2 + bx * px, SH / 2 + by * px)
    for (t, ang) in kenar:
        R = SH * 0.55 / 0.7 / 2 * 0.88
        x, y = SW / 2 + math.sin(math.radians(ang)) * R, SH / 2 - math.cos(math.radians(ang)) * R
        isaret(t, x, y, 0.75, 0.8)
        x2, y2 = SW / 2 + math.sin(math.radians(ang)) * R * 0.97 / 0.88, SH / 2 - math.cos(math.radians(ang)) * R * 0.97 / 0.88
        isaret('ok_' + HI.YON8[round(ang / 45) % 8], x2, y2, 1, 0.7)
    for (t, bx, by) in robotlar:
        isaret(t, SW / 2 + bx * px, SH / 2 + by * px, 1, 0.6)
    isaret('sen_ne', SW / 2, SH / 2, 1, 0.9)
    # alt yazı (eylem çubuğu) ve kısayol çubuğu
    d = ImageDraw.Draw(img)
    try:
        f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
    except Exception:
        f = ImageFont.load_default()
    satir = [f'Harita ({["yakın", "orta", "uzak"][olcek]}) · 312, -88 · haritaya bas: {"uzaklaştır" if olcek < 2 else "kapat"} · eğil: kapat',
             'Köy 340, -160 · 82m KD', 'İglo 300, 1300 · 1388m G']
    y = SH - 118
    for t in satir:
        w = d.textlength(t, font=f)
        d.rectangle((SW / 2 - w / 2 - 6, y - 2, SW / 2 + w / 2 + 6, y + 19), fill=(0, 0, 0, 110))
        d.text((SW / 2 - w / 2, y), t, font=f, fill=(255, 255, 255, 255))
        y += 22
    d.rectangle((SW / 2 - 182, SH - 44, SW / 2 + 182, SH - 4), fill=(0, 0, 0, 120), outline=(90, 90, 90, 255), width=2)
    img.save(f'{OUT}/{ad}')
    return img


if __name__ == '__main__':
    a = ciz('92_harita_yakin.png', 0, [('koy', 26, -6)], [('iglo', 180)])
    b = ciz('93_harita_kesif.png', 1, [('koy', 52, -12), ('zindan', -50, 6)], [('iglo', 180), ('okyanus_aniti', 290)],
            [('robot', 8, 4), ('robot', -10, -6), ('sandik', 6, 8), ('canavar', -30, 20), ('hayvan', 20, -25), ('hayvan', 24, -22), ('koylu', 50, -10)])
    print('ok')
