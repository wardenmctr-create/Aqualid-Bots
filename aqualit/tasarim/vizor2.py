"""Organizatör vizörü (2. tasarım): filmlerdeki gibi mavi, yarı saydam, kalın cam siperlik; kenarları daha koyu ve opak.
Yüzün önünde 1 piksel boşlukla durur, yanlara doğru sarar. Gözler camın ardından mavimsi görünür.
Oyunda cam ayrı yarı saydam malzemeyle çizilecek (entity_alphablend); önizlemede cam iki kez çizilip karıştırılıyor."""
import os
import numpy as np
from PIL import Image
from ortak import Form, Part, kutu, fill, rows, kart, OUT, Z, model, robot_parcalari

CAM_ALFA = 0.5   # camın örtücülüğü


def cam_yuz(w, h, ust='~', orta='<', alt='^'):
    """Cam yüzü: üstte açık, altta koyu mavi; çapraz parlama çizgisi."""
    g = []
    for y in range(h):
        c = ust if y == 0 else (alt if y == h - 1 else orta)
        g.append([c] * w)
    for k in range(min(w, h) + 2):
        x, y = 2 + k, h - 1 - k
        if 0 <= x < w and 0 <= y < h:
            g[y][x] = '9'
        if 0 <= x + 1 < w and 0 <= y < h:
            g[y][x + 1] = '~'
    return g


def vizor_model(cam=True):
    f = Form('org_vz', 'Organizatör')
    f.bone('root', None, (0, 0, 0))
    f.parts += robot_parcalari('toplayici', cikar=('visor', 'mic'))
    # opak, koyu kenarlar: üst ve alt bant yüzü sarar, ön köşelerde dikmeler
    kutu(f, 'root', 'vz_ust', (-7.5, 17.5, 1.5), (7.5, 18.5, 7.5), base='@',
         front=[list('>' + '@' * 13 + '>')], top=[['@'] * 15 for _ in range(6)])
    kutu(f, 'root', 'vz_alt', (-7.5, 11.5, 1.5), (7.5, 12.5, 7.5), base='>',
         front=[list('>' * 15)])
    for ad, x0 in (('vz_dikme_l', -7.5), ('vz_dikme_r', 6.5)):
        kutu(f, 'root', ad, (x0, 12.5, 6.5), (x0 + 1, 17.5, 7.5), base='>')
        kutu(f, 'root', ad + '_arka', (x0, 12.5, 1.5), (x0 + 1, 17.5, 2.5), base='>')
    # kulak tarafında küçük ışıklı bağlantı
    for ad, x0 in (('vz_led_l', -8), ('vz_led_r', 7.5)):
        kutu(f, 'root', ad, (x0, 14, 3), (x0 + 0.5 + 0.5, 16, 5), base='ö', glow='öÇ', front=rows('Ç', 'ö'))
    if cam:
        # kalın yarı saydam cam: önde 13x5, yanlarda 4x5
        kutu(f, 'root', 'vz_cam_on', (-6.5, 12.5, 6.5), (6.5, 17.5, 7.5), base='<', front=cam_yuz(13, 5),
             top=[['~'] * 13], bottom=[['^'] * 13])
        for ad, x0 in (('vz_cam_l', -7.5), ('vz_cam_r', 6.5)):
            kutu(f, 'root', ad, (x0, 12.5, 2.5), (x0 + 1, 17.5, 6.5), base='<', left=cam_yuz(4, 5), right=cam_yuz(4, 5))
    return f


def ciz(cam, geoA, texA, glA, geoB, texB, glB):
    a = np.asarray(Z.render(geoA, texA, {}, (), cam, glow=glA, ground={'y': -1, 'color': (58, 66, 74)}).convert('RGB'), np.float32)
    b = np.asarray(Z.render(geoB, texB, {}, (), cam, glow=glB, ground={'y': -1, 'color': (58, 66, 74)}).convert('RGB'), np.float32)
    m = (np.abs(a - b).sum(2) > 6)[:, :, None]
    out = np.where(m, a * (1 - CAM_ALFA) + b * CAM_ALFA, a)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


if __name__ == '__main__':
    A = model(vizor_model(False), W=256)
    B = model(vizor_model(True), W=256)
    frames = []
    for i in range(36):
        cam = Z.Cam(yaw=25 + i * 10, elev=14, scale=13, size=(320, 340), center=(0, 11, 0))
        frames.append(ciz(cam, *A, *B))
    print(Z.gif(frames, os.path.join(OUT, '80_org_vizor_cam.gif'), ms=60))
    imgs = []
    for yaw, el, ad in ((0, 6, 'önden'), (30, 14, '3/4 önden'), (70, 10, 'yandan (sarıyor)')):
        cam = Z.Cam(yaw=yaw, elev=el, scale=18, size=(300, 300), center=(0, 14, 2))
        imgs.append((ciz(cam, *A, *B), ad))
    print(kart('Organizatör · yarı saydam mavi cam vizör', imgs, os.path.join(OUT, '80_org_vizor_cam.png'),
               alt='Kalın mavi cam (yarı saydam), koyu opak kenarlar; gözler camın ardından görünür.'))
