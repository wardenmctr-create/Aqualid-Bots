from PIL import Image, ImageDraw, ImageFont
import random

PAL = {
    '.': None,
    # Turk turkuazi (Aqualit)
    'O': (7, 50, 45),  # dis hat (renk A)
    'D': (13, 94, 81),  # koyu (renk A)
    'M': (22, 135, 112),  # orta (renk A)
    'L': (43, 176, 143),  # acik (renk A)
    'H': (122, 211, 183),  # parlak (renk A)
    'W': (213, 242, 231),  # parilti (renk A)
    # tahta / cubuk
    's': (40, 30, 11),
    't': (73, 54, 26),
    'u': (104, 78, 30),
    'v': (137, 103, 39),
    # gri / tas
    'a': (104, 104, 104),
    'b': (122, 122, 122),
    'c': (138, 138, 138),
    'd': (90, 90, 90),
    'g': (60, 60, 64),
    # kirmizi
    'r': (178, 34, 34),
    'R': (232, 72, 72),
    'q': (110, 18, 18),
    # sari / altin
    'y': (230, 190, 60),
    'Y': (255, 230, 120),
    # siyah ekran
    'k': (18, 22, 26),
    'K': (30, 40, 46),
}

def grid_to_img(rows, pal=None):
    p = dict(PAL)
    if pal: p.update(pal)
    assert len(rows) == 16, len(rows)
    img = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        assert len(row) == 16, (y, row, len(row))
        for x, ch in enumerate(row):
            col = p[ch]
            if col is not None:
                img.putpixel((x, y), col + (255,) if len(col) == 3 else col)
    return img

def overlay(base, top):
    out = base.copy()
    out.alpha_composite(top)
    return out

FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT2 = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

def preview(items, title, out, scale=20):
    """items: list of (img16, label)"""
    n = len(items)
    cell = 16 * scale
    pad = 28
    W = max(pad + n * (cell + pad), 560)
    H = 70 + cell + 40 + 80
    bg = Image.new('RGBA', (W, H), (24, 28, 32, 255))
    d = ImageDraw.Draw(bg)
    ft = ImageFont.truetype(FONT, 30)
    fl = ImageFont.truetype(FONT2, 20)
    fs = ImageFont.truetype(FONT2, 15)
    d.text((pad, 18), title, font=ft, fill=(140, 234, 224))
    for i, (img, label) in enumerate(items):
        x0 = pad + i * (cell + pad)
        y0 = 70
        # dama tahtasi (seffaflik)
        for cy in range(16):
            for cx in range(16):
                c = (44, 50, 56) if (cx + cy) % 2 == 0 else (36, 41, 46)
                d.rectangle([x0 + cx*scale, y0 + cy*scale, x0 + (cx+1)*scale - 1, y0 + (cy+1)*scale - 1], fill=c)
        big = img.resize((cell, cell), Image.NEAREST)
        bg.alpha_composite(big, (x0, y0))
        tw = d.textlength(label, font=fl)
        d.text((x0 + (cell - tw) / 2, y0 + cell + 10), label, font=fl, fill=(230, 236, 240))
        # oyun ici boyut
        for k, s in enumerate((2, 4)):
            sm = img.resize((16*s, 16*s), Image.NEAREST)
            bx = x0 + 10 + k * 90
            by = y0 + cell + 44
            bg.alpha_composite(sm, (bx, by))
    bg.convert('RGB').save(out)
    return out
