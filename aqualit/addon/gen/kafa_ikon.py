"""Konum çubuğu için robot kafa simgeleri: her tür/seviye için 3D kafa (aksesuarlarıyla), şeffaf arka plan.
Ayrıca robotun gönderdiği konumlar için iğneli (pin) sürüm.
"""
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'test'))
import robotgeo as RG  # noqa: E402
import render_z as Z  # noqa: E402

ACC = {'madenci': {'helmet', 'antenna_ball20'}, 'kurekci': {'antenna_ball19'}, 'ciftci': {'hat', 'antenna_sprout23'},
       'oduncu': {'antenna_leaf19'}, 'kilicli': {'antenna_ball19'},
       'insaatci': {'hardhat', 'antenna_ball24'}, 'toplayici': {'headset', 'cap', 'visor', 'antenna_ball24'}}
ALL_ACC = set().union(*ACC.values()) | {'sand_bag', 'scarf', 'cape', 'right_shoulder', 'left_shoulder', 'toolbelt',
                                        'blueprint', 'backpack', 'kova'}
KEY = (255, 0, 255)


def head_icon(geo, tex, glow, kind, size=32):
    hidden = ALL_ACC - ACC[kind]
    cam = Z.Cam(yaw=24, elev=12, scale=1.3, size=(size, size), center=(0, 17.5, 0))
    img = Z.render(geo, tex, {}, hidden, cam, glow=glow, bg=KEY, ss=1, shadow=False, only={'head'})
    img = img.convert('RGBA')
    px = img.load()
    for y in range(size):
        for x in range(size):
            r, g, b, _ = px[x, y]
            if abs(r - 255) < 40 and g < 60 and abs(b - 255) < 40:
                px[x, y] = (0, 0, 0, 0)
    # ince koyu kenar çizgisi (çubukta her zeminde seçilsin)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    a = img.split()[3]
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        sh = Image.new('RGBA', (size, size), (8, 30, 28, 255))
        out.paste(sh, (dx, dy), a)
    out.alpha_composite(img)
    return out


def pin_icon(icon):
    """Gönderilen konum: turkuaz iğnenin içinde robot kafası."""
    s = icon.size[0]
    out = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    d.ellipse([2, 0, s - 3, s - 9], fill=(43, 176, 143, 255), outline=(8, 30, 28, 255))
    d.polygon([(s // 2 - 5, s - 12), (s // 2 + 4, s - 12), (s // 2, s - 1)], fill=(43, 176, 143, 255), outline=(8, 30, 28, 255))
    small = icon.resize((s - 10, s - 10), Image.NEAREST)
    out.alpha_composite(small, (5, 2))
    return out


def build(tex_dir, out_dir):
    """tex_dir: robot dokularının olduğu klasör (robotgeo.build çıktısı)."""
    os.makedirs(out_dir, exist_ok=True)
    tmp_geo = os.path.join(out_dir, '_g.json')
    names, geo = RG.build(out_dir, tmp_geo)
    made = []
    for nm in names:
        kind = 'kilicli' if nm.startswith('kilicli') else nm
        tex = Image.open(os.path.join(out_dir, f'{nm}.png')).convert('RGBA')
        glow = Image.open(os.path.join(out_dir, f'{nm}_glow.png')).convert('RGBA')
        ic = head_icon(geo, tex, glow, kind)
        ic.save(os.path.join(out_dir, f'bas_{nm}.png'))
        pin_icon(ic).save(os.path.join(out_dir, f'pin_{nm}.png'))
        made.append(nm)
    # robot dokularının kopyalarını temizle (yalnızca simgeler kalsın)
    for nm in names:
        for suf in ('', '_glow'):
            p = os.path.join(out_dir, f'{nm}{suf}.png')
            if os.path.exists(p):
                os.remove(p)
    os.remove(tmp_geo)
    return made


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tmp', 'kafa')
    print(build(None, out))
