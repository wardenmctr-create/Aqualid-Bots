"""Simge sayfası: satır satır simgeler, büyütülmüş, etiketli."""
from PIL import Image, ImageDraw, ImageFont
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT2 = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def sheet(title, rows, out, scale=8, cols=None, bg=(24, 28, 32)):
    """rows: [(satır başlığı, [(img, etiket), ...]), ...]"""
    cell = 16 * scale
    pad = 22
    lab_h = 36
    cols = cols or max(len(r[1]) for r in rows)
    W = pad + cols * (cell + pad)
    H = 64
    for _, items in rows:
        H += 30 + (cell + lab_h + 10) * ((len(items) + cols - 1) // cols)
    img = Image.new('RGBA', (W, H + 10), bg + (255,))
    d = ImageDraw.Draw(img)
    ft = ImageFont.truetype(FONT, 26)
    fh = ImageFont.truetype(FONT, 18)
    fl = ImageFont.truetype(FONT2, 14)
    d.text((pad, 16), title, font=ft, fill=(140, 234, 224))
    y = 64
    for head, items in rows:
        d.text((pad, y), head, font=fh, fill=(220, 226, 230))
        y += 30
        for i, (ic, lab) in enumerate(items):
            r, c = divmod(i, cols)
            x0 = pad + c * (cell + pad)
            y0 = y + r * (cell + lab_h + 10)
            for cy in range(16):
                for cx in range(16):
                    col = (44, 50, 56) if (cx + cy) % 2 == 0 else (36, 41, 46)
                    d.rectangle([x0 + cx * scale, y0 + cy * scale, x0 + (cx + 1) * scale - 1, y0 + (cy + 1) * scale - 1], fill=col)
            img.alpha_composite(ic.convert('RGBA').resize((cell, cell), Image.NEAREST), (x0, y0))
            for k, line in enumerate(lab.split('\n')):
                tw = d.textlength(line, font=fl)
                d.text((x0 + (cell - tw) / 2, y0 + cell + 4 + k * 16), line, font=fl, fill=(200, 206, 210))
        y += (cell + lab_h + 10) * ((len(items) + cols - 1) // cols)
    img.convert('RGB').save(out)
    return out
