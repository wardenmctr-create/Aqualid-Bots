"""Zırhların oyuncu üstünde 3B önizlemesi (Steve + zırh katmanları)."""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'gen'))
import render3d as R  # noqa: E402
import zirh as Z  # noqa: E402
import aqualit_set as A  # noqa: E402

VAN = os.path.join(HERE, '..', '..', 'vanilla')
OUT = os.path.join(HERE, '..', '..', 'onizleme')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT2 = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def geo(bones, w=64, h=64):
    return {'minecraft:geometry': [{'description': {'texture_width': w, 'texture_height': h}, 'bones': bones}]}


def steve():
    B = lambda n, piv, cubes, parent=None: {'name': n, 'pivot': piv, 'cubes': cubes, **({'parent': parent} if parent else {})}
    return geo([
        B('waist', [0, 12, 0], []),
        B('body', [0, 24, 0], [{'origin': [-4, 12, -2], 'size': [8, 12, 4], 'uv': [16, 16]},
                               {'origin': [-4, 12, -2], 'size': [8, 12, 4], 'uv': [16, 32], 'inflate': 0.25}], 'waist'),
        B('head', [0, 24, 0], [{'origin': [-4, 24, -4], 'size': [8, 8, 8], 'uv': [0, 0]},
                               {'origin': [-4, 24, -4], 'size': [8, 8, 8], 'uv': [32, 0], 'inflate': 0.5}], 'body'),
        B('rightArm', [-5, 22, 0], [{'origin': [-8, 12, -2], 'size': [4, 12, 4], 'uv': [40, 16]},
                                    {'origin': [-8, 12, -2], 'size': [4, 12, 4], 'uv': [40, 32], 'inflate': 0.25}], 'body'),
        B('leftArm', [5, 22, 0], [{'origin': [4, 12, -2], 'size': [4, 12, 4], 'uv': [32, 48]},
                                  {'origin': [4, 12, -2], 'size': [4, 12, 4], 'uv': [48, 48], 'inflate': 0.25}], 'body'),
        B('rightLeg', [-1.9, 12, 0], [{'origin': [-3.9, 0, -2], 'size': [4, 12, 4], 'uv': [0, 16]},
                                      {'origin': [-3.9, 0, -2], 'size': [4, 12, 4], 'uv': [0, 32], 'inflate': 0.25}], 'body'),
        B('leftLeg', [1.9, 12, 0], [{'origin': [-0.1, 0, -2], 'size': [4, 12, 4], 'uv': [16, 48]},
                                    {'origin': [-0.1, 0, -2], 'size': [4, 12, 4], 'uv': [0, 48], 'inflate': 0.25}], 'body'),
    ])


def vanilla_armor(parts):
    """Elmas zırh geometrisi (oyunun kendi ölçüleri): helmet, chest, legs, boots."""
    bones = [{'name': 'waist', 'pivot': [0, 12, 0]}]
    L1, L2 = [], []

    def add(lst, name, piv, parent, cube):
        lst.append({'name': name, 'pivot': piv, 'parent': parent, 'cubes': [cube]})
    if 'helmet' in parts:
        add(L1, 'head', [0, 24, 0], 'body', {'origin': [-4, 24, -4], 'size': [8, 8, 8], 'uv': [0, 0], 'inflate': 1.0})
    if 'chest' in parts:
        add(L1, 'body', [0, 24, 0], 'waist', {'origin': [-4, 12, -2], 'size': [8, 12, 4], 'uv': [16, 16], 'inflate': 1.01})
        add(L1, 'rightArm', [-5, 22, 0], 'body', {'origin': [-8, 12, -2], 'size': [4, 12, 4], 'uv': [40, 16], 'inflate': 1.0})
        add(L1, 'leftArm', [5, 22, 0], 'body', {'origin': [4, 12, -2], 'size': [4, 12, 4], 'uv': [40, 16], 'inflate': 1.0,
                                               'mirror': True})
    if 'boots' in parts:
        add(L1, 'rightLeg', [-1.9, 12, 0], 'body', {'origin': [-3.9, 0, -2], 'size': [4, 12, 4], 'uv': [0, 16], 'inflate': 1.0})
        add(L1, 'leftLeg', [1.9, 12, 0], 'body', {'origin': [-0.1, 0, -2], 'size': [4, 12, 4], 'uv': [0, 16], 'inflate': 1.0,
                                                 'mirror': True})
    if 'legs' in parts:
        add(L2, 'body', [0, 24, 0], 'waist', {'origin': [-4, 12, -2], 'size': [8, 12, 4], 'uv': [16, 16], 'inflate': 0.5})
        add(L2, 'rightLeg', [-1.9, 12, 0], 'body', {'origin': [-3.9, 0, -2], 'size': [4, 12, 4], 'uv': [0, 16], 'inflate': 0.49})
        add(L2, 'leftLeg', [1.9, 12, 0], 'body', {'origin': [-0.1, 0, -2], 'size': [4, 12, 4], 'uv': [0, 16], 'inflate': 0.49,
                                                 'mirror': True})
    return geo(bones + L1, 64, 32), geo(bones + L2, 64, 32)


def bootcut(img):
    """Botlar için katman 1'in bacak bölgesinin yalnızca alt kısmı görünür (oyundaki gibi)."""
    return img


POSE = {'rightArm': [-18, 0, 0], 'leftArm': [14, 0, 0], 'rightLeg': [14, 0, 0], 'leftLeg': [-14, 0, 0]}


def figure(layers, yaw=32, pitch=14, s=9, size=(250, 360)):
    return R.render_multi(layers, POSE, view_yaw=yaw, view_pitch=pitch, s=s, size=size, offset=(0, -6))


def card(items, title, out, cols=None):
    cols = cols or len(items)
    cw, ch = items[0][0].size
    pad = 16
    W = pad + cols * (cw + pad)
    rows = (len(items) + cols - 1) // cols
    H = 70 + rows * (ch + 46)
    img = Image.new('RGB', (W, H), (24, 28, 32))
    d = ImageDraw.Draw(img)
    d.text((pad, 18), title, font=ImageFont.truetype(FONT, 26), fill=(140, 234, 224))
    fl = ImageFont.truetype(FONT2, 17)
    for i, (im, lab) in enumerate(items):
        r, c = divmod(i, cols)
        x, y = pad + c * (cw + pad), 70 + r * (ch + 46)
        img.paste(im, (x, y))
        tw = d.textlength(lab, font=fl)
        d.text((x + (cw - tw) / 2, y + ch + 8), lab, font=fl, fill=(214, 220, 224))
    img.save(out)
    return out


def main():
    stv = Image.open(os.path.join(VAN, 'steve.png')).convert('RGBA')
    S = steve()
    # Aqualit seti
    l1, l2 = A.armor_layers()
    g1, g2 = vanilla_armor({'helmet', 'chest', 'legs', 'boots'})
    full = [(S, stv), (g2, l2), (g1, l1)]
    imgs = [(figure(full, yaw=30), 'Önden'), (figure(full, yaw=150), 'Arkadan'),
            (figure([(S, stv), (vanilla_armor({'helmet', 'chest'})[0], l1)], yaw=-35), 'Miğfer + göğüslük')]
    print(card(imgs, 'Aqualit Zırh Seti (3D)', os.path.join(OUT, '32_aqualit_zirh_3d.png')))
    # kabuk setleri (4 parça)
    def bark_set(t):
        return [(Z.geometry('g', Z.BARK_PIECES[k]), Z.bark_texture(t, Z.BARK_PIECES[k])) for k in ('legs', 'boots', 'chest', 'helmet')]
    items = []
    for t in Z.TREES:
        items.append((figure([(S, stv)] + bark_set(t), yaw=32, s=7.5, size=(200, 300)), t[1]))
    print(card(items, 'Kabuk Zırh Setleri (3D)', os.path.join(OUT, '36_kabuk_set_3d.png'), cols=5))
    # taş setleri
    def stone_set(st):
        return [(Z.geometry('g', Z.STONE_PIECES[k]), Z.stone_texture(st, Z.STONE_PIECES[k])) for k in ('legs', 'boots', 'chest', 'helmet')]
    items = []
    for st in Z.STONES:
        items.append((figure([(S, stv)] + stone_set(st), yaw=32), st[1] + ' set'))
        items.append((figure([(S, stv)] + stone_set(st), yaw=150), st[1] + ' set (arka)'))
    print(card(items, 'Taş Zırh Setleri (3D)', os.path.join(OUT, '37_tas_set_3d.png')))


if __name__ == '__main__':
    main()
