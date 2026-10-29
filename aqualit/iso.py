# Izometrik kup / kutu cizici: her doku pikselini paralelkenar olarak cizer
import math
from PIL import Image, ImageDraw

C30, S30 = math.cos(math.radians(30)), math.sin(math.radians(30))

def shade(c, f):
    return tuple(max(0, min(255, round(v * f))) for v in c[:3])

class Iso:
    def __init__(self, W, H, ox, oy, s, bg=(24, 28, 32)):
        self.img = Image.new('RGB', (W, H), bg)
        self.d = ImageDraw.Draw(self.img)
        self.ox, self.oy, self.s = ox, oy, s
    def P(self, x, y, z):
        return (self.ox + (x - z) * self.s * C30, self.oy + (x + z) * self.s * S30 - y * self.s)
    def quad(self, pts, col):
        q = [self.P(*p) for p in pts]
        self.d.polygon(q, fill=col, outline=col)
    def box(self, x0, y0, z0, x1, y1, z1, top=None, front=None, right=None, f_top=1.0, f_front=0.86, f_right=0.7):
        """top: (w=x1-x0) x (d=z1-z0) doku, j=0 arka; front (+Z): w x h; right (+X): d x h, i=0 on kose"""
        if front is not None:
            w, h = front.size
            for j in range(h):
                for i in range(w):
                    c = front.getpixel((i, j))
                    if len(c) == 4 and c[3] == 0: continue
                    xa, xb = x0 + i * (x1 - x0) / w, x0 + (i + 1) * (x1 - x0) / w
                    ya, yb = y1 - (j + 1) * (y1 - y0) / h, y1 - j * (y1 - y0) / h
                    self.quad([(xa, yb, z1), (xb, yb, z1), (xb, ya, z1), (xa, ya, z1)], shade(c, f_front))
        if right is not None:
            w, h = right.size
            for j in range(h):
                for i in range(w):
                    c = right.getpixel((i, j))
                    if len(c) == 4 and c[3] == 0: continue
                    za, zb = z1 - i * (z1 - z0) / w, z1 - (i + 1) * (z1 - z0) / w
                    ya, yb = y1 - (j + 1) * (y1 - y0) / h, y1 - j * (y1 - y0) / h
                    self.quad([(x1, yb, za), (x1, yb, zb), (x1, ya, zb), (x1, ya, za)], shade(c, f_right))
        if top is not None:
            w, d = top.size
            for j in range(d):
                for i in range(w):
                    c = top.getpixel((i, j))
                    if len(c) == 4 and c[3] == 0: continue
                    xa, xb = x0 + i * (x1 - x0) / w, x0 + (i + 1) * (x1 - x0) / w
                    za, zb = z0 + j * (z1 - z0) / d, z0 + (j + 1) * (z1 - z0) / d
                    self.quad([(xa, y1, za), (xb, y1, za), (xb, y1, zb), (xa, y1, zb)], shade(c, f_top))

def cube(tex, s=10, pad=20):
    W = int(2 * 16 * s * C30) + 2 * pad
    H = int(16 * s + 2 * 16 * s * S30) + 2 * pad
    iso = Iso(W, H, W / 2, pad + 16 * s, s)
    iso.box(0, 0, 0, 16, 16, 16, top=tex, front=tex, right=tex)
    return iso.img
