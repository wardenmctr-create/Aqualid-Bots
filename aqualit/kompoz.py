from PIL import Image, ImageDraw, ImageFont
from pix import FONT, FONT2

def flat(img16, size=256):
    """seffaf doku -> dama tahtali buyuk kare"""
    sc = size // img16.size[0]
    w, h = img16.size[0] * sc, img16.size[1] * sc
    bg = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(bg)
    step = sc * 2 if img16.size[0] <= 16 else sc * 4
    for y in range(0, h, step):
        for x in range(0, w, step):
            c = (44, 50, 56) if ((x // step) + (y // step)) % 2 == 0 else (36, 41, 46)
            d.rectangle([x, y, x + step - 1, y + step - 1], fill=c)
    big = img16.convert('RGBA').resize((w, h), Image.NEAREST)
    bg.paste(big, (0, 0), big)
    return bg

def compose(title, panels, out, note=None):
    pad = 28
    Hc = max(p.size[1] for p, _ in panels)
    W = pad + sum(p.size[0] + pad for p, _ in panels)
    H = 80 + Hc + 50 + (30 if note else 0)
    bg = Image.new('RGB', (max(W, 560), H), (24, 28, 32))
    d = ImageDraw.Draw(bg)
    d.text((pad, 20), title, font=ImageFont.truetype(FONT, 30), fill=(122, 211, 183))
    fl = ImageFont.truetype(FONT2, 20)
    x = pad
    for p, label in panels:
        y = 80 + (Hc - p.size[1]) // 2
        bg.paste(p, (x, y))
        tw = d.textlength(label, font=fl)
        d.text((x + (p.size[0] - tw) / 2, 80 + Hc + 12), label, font=fl, fill=(230, 236, 240))
        x += p.size[0] + pad
    if note:
        d.text((pad, H - 34), note, font=ImageFont.truetype(FONT2, 16), fill=(120, 130, 138))
    bg.save(out)
    return out
