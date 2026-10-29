import colorsys, random
from PIL import Image, ImageDraw, ImageFont
import pix
from pix import grid_to_img, overlay, FONT, FONT2

BASE = {k: pix.PAL[k] for k in 'ODMLHW'}

def make_pal(hue_deg, f):
    out = {}
    for k, (r, g, b) in BASE.items():
        h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
        drift = (h * 360 - 180)            # mevcut tonlar arasi kayma korunur
        nh = ((hue_deg + drift) % 360) / 360
        nv = v * (f if k not in 'W' else (1 + f) / 2)
        ns = min(1, s * (1.05 if k in 'HW' else 1.0))
        rr, gg, bb = colorsys.hsv_to_rgb(nh, ns, nv)
        out[k] = (round(rr*255), round(gg*255), round(bb*255))
    return out

def value_noise(seed, lx, ly, levels, specks=0, speck_col=None):
    rnd = random.Random(seed)
    lat = [[rnd.random() for _ in range(lx)] for _ in range(ly)]
    img = Image.new('RGBA', (16, 16))
    cw, ch = 16 / lx, 16 / ly
    for y in range(16):
        for x in range(16):
            gx, gy = x / cw, y / ch
            x0, y0 = int(gx) % lx, int(gy) % ly
            x1, y1 = (x0 + 1) % lx, (y0 + 1) % ly
            tx, ty = gx - int(gx), gy - int(gy)
            a = lat[y0][x0] * (1-tx) + lat[y0][x1] * tx
            b = lat[y1][x0] * (1-tx) + lat[y1][x1] * tx
            v = a * (1-ty) + b * ty + (rnd.random() - 0.5) * 0.28
            i = max(0, min(len(levels) - 1, int(v * len(levels))))
            img.putpixel((x, y), levels[i] + (255,))
    for _ in range(specks):
        x, y = rnd.randrange(16), rnd.randrange(16)
        img.putpixel((x, y), speck_col + (255,))
        if rnd.random() < 0.6:
            img.putpixel(((x + 1) % 16, y), speck_col + (255,))
    return img

STONE_LV = [(104,104,104), (114,114,114), (124,124,124), (132,132,132), (142,142,142)]
DEEP_LV = [(56,56,60), (64,64,68), (72,72,76), (80,80,84), (88,88,92)]
stone = value_noise(3, 4, 4, STONE_LV, specks=7, speck_col=(92, 92, 92))
deep = value_noise(5, 4, 8, DEEP_LV, specks=5, speck_col=(46, 46, 50))

if __name__ == '__main__':
    from ore import ORE
    from ham_kulce import INGOT
    import aletler
    from shape import to_rows
    opts = [('Şimdiki', None), ('A', make_pal(168, 0.90)), ('B', make_pal(162, 0.82)), ('C', make_pal(156, 0.74))]
    scale = 10; cell = 160; pad = 22
    W = pad + len(opts) * (cell * 3 + pad * 3)
    W = 70 + len(opts) * 0  # placeholder
    rows = len(opts)
    W = 40 + 3 * (cell + 16) + 200
    H = 70 + rows * (cell + 30)
    bg = Image.new('RGB', (W, H), (24, 28, 32))
    d = ImageDraw.Draw(bg)
    ft = ImageFont.truetype(FONT, 28); fl = ImageFont.truetype(FONT, 26); fs = ImageFont.truetype(FONT2, 16)
    d.text((20, 18), 'Renk seçenekleri (koyu + daha yeşilimsi)', font=ft, fill=(230, 236, 240))
    pick_rows = to_rows(aletler.pickaxe())
    for i, (name, pal) in enumerate(opts):
        y0 = 70 + i * (cell + 30)
        d.text((24, y0 + cell // 2 - 16), name, font=fl, fill=(230, 236, 240))
        o = overlay(stone, grid_to_img(ORE, pal))
        ing = grid_to_img(INGOT, pal)
        pk = grid_to_img(pick_rows, pal)
        for j, im in enumerate((o, ing, pk)):
            x0 = 180 + j * (cell + 16)
            d.rectangle([x0, y0, x0 + cell - 1, y0 + cell - 1], fill=(40, 46, 52))
            bg.paste(im.resize((cell, cell), Image.NEAREST), (x0, y0), im.resize((cell, cell), Image.NEAREST))
        if pal:
            sw = ' '.join('#%02X%02X%02X' % pal[k] for k in 'DML')
            d.text((180, y0 + cell + 4), sw, font=fs, fill=(120, 130, 138))
    bg.save('onizleme/renk_secenekleri.png')
    print('ok')
