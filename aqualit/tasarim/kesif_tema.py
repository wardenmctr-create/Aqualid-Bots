"""Keşif Nether/End temaları önizlemesi (işlevler addon/gen/kesif_tema.py'de, oyunla aynı)."""
import os
import sys
from ortak import OUT, Z, ART
sys.path.insert(0, os.path.join(ART, 'addon', 'gen'))
import kesif as K                # noqa: E402
from kesif_tema import TEMALAR, renk_donustur, magma_catlak, tema_formu, gizle_poz, robot_maskesi   # noqa: E402
from PIL import Image            # noqa: E402

if __name__ == '__main__':
    sira = ['robot', 'ucak', 'gemi', 'denizalti', 'arazi', 'matkap']
    imgs = []
    satirlar = []
    for tema in TEMALAR:
        satir = []
        for key in sira:
            f, root = tema_formu(key)
            geo, tex, glow = K.build(forms=[f], W=512)
            mk = robot_maskesi(geo, tex.width, tex.height)
            tex2 = renk_donustur(tex, tema, mk, isik=glow)
            glow2 = renk_donustur(glow, tema, mk, glow=True)
            if tema == 'nether':
                tex2, glow2 = magma_catlak(tex2, glow2, mk)
            sc = 9 if key == 'robot' else 3.6
            cam = Z.Cam(yaw=35, elev=20, scale=sc, size=(230, 210), center=(0, 12 if key == 'robot' else 14, 0))
            im = Z.render(geo, tex2, gizle_poz(tema, root), (), cam, glow=glow2, ground={'y': -0.5, 'color': (58, 66, 74)})
            satir.append(im)
        satirlar.append(satir)
    W, H = 230 * 6 + 20 * 7, (210 + 30) * 3 + 60
    c = Image.new('RGB', (W, H), (24, 28, 32))
    from PIL import ImageDraw, ImageFont
    d = ImageDraw.Draw(c)
    f1 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
    f2 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 16)
    d.text((20, 12), 'Keşif · Normal / Nether / End (boyuta girince otomatik; ekranlar siyah, gözler renkli)', font=f1, fill=(64, 224, 208))
    for r, (tema, satir) in enumerate(zip(['Normal', 'Nether', 'End'], satirlar)):
        y = 50 + r * 240
        d.text((20, y), tema, font=f2, fill=[(64, 224, 208), (255, 120, 60), (200, 140, 255)][r])
        for i, im in enumerate(satir):
            c.paste(im.convert('RGB'), (20 + i * 250, y + 24))
    c.save(os.path.join(OUT, '90_kesif_temalar.png'))
    print(os.path.join(OUT, '90_kesif_temalar.png'))
