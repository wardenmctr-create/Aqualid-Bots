"""Bütün evcil dronlar bir arada: Mimar (dron.py), Keşif (kesif_dron.py) ve 7 yeni evcil dron (evcil.py)."""
import os
import sys
import numpy as np
from PIL import Image
from ortak import Form, Part, kart, OUT, Z, model, ART
sys.path.insert(0, os.path.join(ART, 'addon', 'gen'))
import dron as D            # noqa: E402
import kesif_dron as KD     # noqa: E402
import evcil as E           # noqa: E402
import yardimci as Y        # noqa: E402

YARD_OLCEK = 0.42            # Organizatör Yardımcısı evcil hali: aynı model, öteki evcil dronlar boyunda


def mimar():
    f = Form('evcil_mimar', 'Mimar')
    f.bone('root', None, (0, 0, 0))
    f.bone('g', 'root', (0, 2, 0))
    f.bone('p_mimar', 'g', (0, 12.5, 0))
    for p in D.parts():
        f.parts.append(Part('p_mimar' if p.name.startswith('pervane') else 'g', p, 'WL' if p.name in ('govde', 'itici') else ''))
    return f


SIRA = ['mimar', 'kesif'] + E.TURLER + ['yardimci']
ADLAR = dict(E.ADLAR, mimar='Mimar', kesif='Keşif', yardimci='Org. Yardımcısı')


def poz(t, tur):
    if tur == 'mimar':
        return {'p_mimar': [0, t * 2880, 0], 'g': {'p': [0, np.sin(t * 6.283) * 0.5, 0]}}
    if tur == 'kesif':
        return {'p_l': [0, t * 2880, 0], 'p_r': [0, -t * 2880, 0], 'govde': {'p': [0, np.sin(t * 6.283) * 0.5, 0]}}
    return E.poz(t, tur)


if __name__ == '__main__':
    M = {t: model(E.evcil(t), W=128) for t in E.TURLER}
    M['mimar'] = model(mimar(), W=128)
    M['kesif'] = model(KD.model(), W=128)
    C = {'organizator': (model(E.evcil('organizator', False), W=128), model(E.evcil('organizator', 'cerceve'), W=128))}
    E_ciz = E.ciz

    YA, YB = model(Y.yardimci(False), W=256), model(Y.yardimci(True), W=256)

    def ciz(tur, cam, t):
        if tur == 'yardimci':
            return Y.ciz(cam, t, YA, YB)
        if tur in ('mimar', 'kesif'):
            return Z.render(*M[tur][:2], poz(t, tur), (), cam, glow=M[tur][2],
                            ground={'y': -3, 'color': (58, 66, 74)}).convert('RGB')
        return E_ciz(tur, cam, t, M, C)
    W, H = 160, 220

    def kamera(tur, yaw, elev):
        if tur == 'yardimci':
            return Z.Cam(yaw=yaw, elev=elev, scale=8.5 * YARD_OLCEK, size=(W, H), center=(0, 9, 0))
        return Z.Cam(yaw=yaw, elev=elev, scale=8.5, size=(W, H), center=(0, 7, 0))
    frames = []
    for i in range(72):
        t = i / 72
        c = Image.new('RGB', (len(SIRA) * W, H), (24, 28, 32))
        for k, tur in enumerate(SIRA):
            c.paste(ciz(tur, kamera(tur, 25 + 360 * t, 20), t), (k * W, 0))
        frames.append(c)
    print(Z.gif(frames, os.path.join(OUT, '85_tum_evcil_dronlar.gif'), ms=60))
    imgs = [(ciz(tur, kamera(tur, 30, 18), 0.1), ADLAR[tur]) for tur in SIRA]
    print(kart('Bütün evcil dronlar', imgs, os.path.join(OUT, '85_tum_evcil_dronlar.png'),
               alt='Kırmızı yanak yalnız Kılıçlı\'da. Hepsi omzunda süzülür; ölünce envantere gelir.'))
