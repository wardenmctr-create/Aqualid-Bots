import sys, os, json
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'gen'))
from PIL import Image, ImageDraw, ImageFont
import render3d as R
import robotgeo as G
OUT = sys.argv[1]
names, geo = G.build(OUT, OUT + '/robot.geo.json')
ACC = {'madenci': {'helmet', 'antenna_ball20'}, 'kurekci': {'sand_bag', 'antenna_ball19'}, 'ciftci': {'hat', 'antenna_sprout23'},
       'oduncu': {'scarf', 'antenna_leaf19'}, 'kilicli': {'cape', 'antenna_ball19', 'right_shoulder', 'left_shoulder'},
       'insaatci': {'hardhat', 'toolbelt', 'blueprint', 'antenna_ball24'},
       'toplayici': {'backpack', 'headset', 'cap', 'visor', 'antenna_ball24'}}
allacc = set().union(*ACC.values())
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
cards = []
for kind, label in (('insaatci', 'İnşaatçı Robot'), ('toplayici', 'Toplayıcı Robot')):
    tex = Image.open(f'{OUT}/{kind}.png').convert('RGBA')
    hidden = allacc - ACC[kind]
    imgs = [R.render(geo, tex, {}, hidden, view_yaw=y, view_pitch=18, s=11, size=(300, 380), offset=(0, 26)) for y in (30, 150)]
    cards.append((label, imgs))
W = 24 + 2 * (2 * 300 + 24) + 24
img = Image.new('RGB', (W, 460), (46, 54, 62))
d = ImageDraw.Draw(img)
x = 24
for label, ims in cards:
    d.text((x, 16), label, font=ImageFont.truetype(FONT, 26), fill=(140, 234, 224))
    for i, im in enumerate(ims):
        img.paste(im, (x + i * 300, 60))
    x += 2 * 300 + 24
img.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'onizleme', '40_yeni_robotlar_3d.png'))
print('ok')
