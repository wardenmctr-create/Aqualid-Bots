#!/usr/bin/env python3
"""Keşif'e binince gelen iki eşyanın simgeleri (16x16): Yer Bulucu Radar ve Hız Sayacı.
Çıktılar: dokular/kesif_radar.png, dokular/kesif_hiz.png, onizleme/66_kesif_radar_hiz.png (büyütülmüş)."""
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
P = {
    '.': None,
    'k': (20, 24, 28), 'K': (40, 46, 52),
    'y': (176, 132, 32), 'Y': (236, 196, 80), 'W': (255, 244, 190),
    'g': (18, 70, 66), 'c': (40, 170, 150), 'C': (100, 240, 210), 'L': (190, 255, 240),
    'M': (30, 150, 140), 'H': (90, 210, 190), 'D': (16, 92, 88),
    'r': (210, 50, 50), 'R': (255, 110, 90), 'e': (120, 20, 24), 'E': (255, 90, 80),
    'n': (16, 90, 40), 'N': (120, 255, 140), 'o': (240, 150, 50), 's': (150, 160, 170), 'S': (210, 220, 228),
}
RADAR = [
    "............Y...",
    "...........Yy...",
    "....yyyyyyyy....",
    "...yYYYYYYYYy...",
    "..yYkkkkkkkkYy..",
    "..yYkgggCgggYy..",
    "..yYkggCLggcYy..",
    "..yYkgCLCggkYy..",
    "..yYkgggCgrkYy..",
    "..yYkcggggggYy..",
    "..yYkkkkkkkkYy..",
    "..yYYYYYYYYYYy..",
    "..yMMHHMMHHMMy..",
    "..yMRMMcMMMoMy..",
    "...yyyyyyyyyy...",
    "................",
]
HIZ = [
    "................",
    "....yyyyyyyy....",
    "...yWWWWWWWWy...",
    "..yWsWcWWoWrWy..",
    ".yWcWWWWWWWWrWy.",
    ".yWWWWWWWWWkWWy.",
    "yWsWWWWWWWkWWsWy",
    "yWcWWWWWWkWWWrWy",
    "yWWWWWWWkWWWWWWy",
    "yWWWWWWkkWWWWWWy",
    "yWWWWWWkkWWWWWWy",
    ".yWWWWWWWWWWWWy.",
    ".yMMMHHHHHHMMMy.",
    "..yMMCMMMMRMMy..",
    "...yyyyyyyyyy...",
    "................",
]


# otopilot: kumanda paneli, ekranı kırmızı (kapalı: sen sürüyorsun) ya da yeşil (açık: Keşif gidiyor)
def otopilot(ekran, isik):
    return [
        "................",
        "..yyyyyyyyyyyy..",
        ".yYYYYYYYYYYYYy.",
        ".yYkkkkkkkkkkYy.",
        f".yYk{ekran * 8}kYy.",
        f".yYk{ekran}{isik * 2}{ekran * 2}{isik * 2}{ekran}kYy.",
        f".yYk{ekran * 3}{isik * 2}{ekran * 3}kYy.",
        f".yYk{ekran}{isik * 6}{ekran}kYy.",
        f".yYk{ekran * 8}kYy.",
        ".yYkkkkkkkkkkYy.",
        ".yYYYYYYYYYYYYy.",
        ".yMMHHMMMMHHMMy.",
        ".yMsSMMrrMMSsMy.",
        ".yMMMMMMMMMMMMy.",
        "..yyyyyyyyyyyy..",
        "................",
    ]


def img(rows):
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            c = P[ch]
            if c:
                im.putpixel((x, y), c + (255,))
    return im


def main():
    out = os.path.join(HERE, 'dokular')
    a, b = img(RADAR), img(HIZ)
    a.save(os.path.join(out, 'kesif_radar.png'))
    b.save(os.path.join(out, 'kesif_hiz.png'))
    card = Image.new('RGB', (560, 300), (24, 28, 32))
    card.paste(a.resize((224, 224), Image.NEAREST), (24, 40), a.resize((224, 224), Image.NEAREST))
    card.paste(b.resize((224, 224), Image.NEAREST), (312, 40), b.resize((224, 224), Image.NEAREST))
    dr = ImageDraw.Draw(card)
    f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
    dr.text((52, 10), 'Yer Bulucu Radar', font=f, fill=(64, 224, 208))
    dr.text((362, 10), 'Hız Sayacı', font=f, fill=(64, 224, 208))
    p = os.path.join(HERE, 'onizleme', '66_kesif_radar_hiz.png')
    ka, ac = img(otopilot('e', 'E')), img(otopilot('n', 'N'))
    ka.save(os.path.join(out, 'kesif_otopilot_kapali.png'))
    ac.save(os.path.join(out, 'kesif_otopilot_acik.png'))
    c2 = Image.new('RGB', (560, 300), (24, 28, 32))
    c2.paste(ka.resize((224, 224), Image.NEAREST), (24, 40), ka.resize((224, 224), Image.NEAREST))
    c2.paste(ac.resize((224, 224), Image.NEAREST), (312, 40), ac.resize((224, 224), Image.NEAREST))
    d2 = ImageDraw.Draw(c2)
    d2.text((40, 10), 'Otopilot KAPALI (sen sür)', font=f, fill=(255, 110, 100))
    d2.text((330, 10), 'Otopilot AÇIK (kendi gider)', font=f, fill=(120, 255, 140))
    c2.save(os.path.join(HERE, 'onizleme', '67_otopilot.png'))
    card.save(p)
    print(p)


if __name__ == '__main__':
    main()
