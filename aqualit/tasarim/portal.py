"""Portalcı'nın portalı (Minecraft portalı değil): 1x1 ve 2x1 (1 en, 2 boy) blok. İnce teknolojik çerçeve (koyu çelik,
turkuaz ışıklar), içinde dönen mor-turkuaz girdap. Açılırken halkadan büyür, kapanırken içe çöker."""
import math
import os
from ortak import Form, kutu, fill, kart, OUT, Z, model
from PIL import Image


def girdap(w, h, t):
    g = []
    cx, cy = (w - 1) / 2, (h - 1) / 2
    for y in range(h):
        r = []
        for x in range(w):
            dx, dy = (x - cx) / max(cx, 1), (y - cy) / max(cy, 1)
            d = math.hypot(dx, dy)
            a = math.atan2(dy, dx) + d * 4 - t * 6.283
            v = (math.sin(a * 3) + 1) / 2
            if d < 0.18:
                r.append('9')
            elif d < 0.35:
                r.append('Ç')
            else:
                r.append('ü' if v > 0.78 else 'ğ' if v > 0.5 else 'ö' if v > 0.3 else 'ş' if d < 0.9 else 'ç')
        g.append(r)
    return g


def portal(t, w_blok=1, h_blok=1, x0=0):
    f = Form(f'portal{w_blok}{h_blok}', 'Portal')
    f.bone('root', None, (0, 0, 0))
    W, H = 16 * w_blok, 16 * h_blok
    a, b = x0 - W / 2, x0 + W / 2
    kutu(f, 'root', 'ic', (a + 1, 1, -0.5), (b - 1, H - 1, 0.5), base='ğ', glow='çşğüöÇ9',
         front=girdap(W - 2, H - 2, t), back=girdap(W - 2, H - 2, -t))
    isik = lambda n: [['ö' if (i + int(t * 8)) % 4 == 0 else '%' for i in range(n)]]
    kutu(f, 'root', 'alt', (a, 0, -1), (b, 1, 1), base='%', front=isik(W), back=isik(W), glow='ö')
    kutu(f, 'root', 'ust', (a, H - 1, -1), (b, H, 1), base='%', front=isik(W), back=isik(W), glow='ö')
    for ad, xx in (('sol', a), ('sag', b - 1)):
        kutu(f, 'root', ad, (xx, 1, -1), (xx + 1, H - 1, 1), base='&',
             front=[[c] for c in isik(H - 2)[0]], back=[[c] for c in isik(H - 2)[0]], glow='ö')
    return f


if __name__ == '__main__':
    frames = []
    for i in range(24):
        t = i / 24
        ims = []
        for wb, hb in ((1, 1), (1, 2)):
            geo, tex, glow = model(portal(t, wb, hb), W=64)
            cam = Z.Cam(yaw=20, elev=8, scale=7.5, size=(220, 320), center=(0, 14, 0))
            ims.append(Z.render(geo, tex, {}, (), cam, glow=glow, ground={'y': -1, 'color': (58, 66, 74)}))
        c = Image.new('RGB', (460, 320), (24, 28, 32))
        c.paste(ims[0].convert('RGB'), (0, 0)); c.paste(ims[1].convert('RGB'), (240, 0))
        frames.append(c)
    print(Z.gif(frames, os.path.join(OUT, '83_portal.gif'), ms=70))
    print(kart('Portalcı portalı · 1x1 ve 2x1', [(frames[0].crop((0, 0, 220, 320)), '1x1 (eşya)'),
                                                (frames[0].crop((240, 0, 460, 320)), '2x1 (oyuncu, robot)')],
               os.path.join(OUT, '83_portal.png'), alt='Girdap döner, kenar ışıkları akar.'))
