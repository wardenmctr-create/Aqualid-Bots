"""Bedrock geometri + doku -> izometrik on izleme (box UV'yi bagimsiz olarak cozer).
Kullanim: python3 render_geo.py geo.json tex.png out.png [bone_gizle,...]"""
import os, sys, json
from PIL import Image
sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')))
from iso import Iso, C30, S30, shade


def faces_from_uv(tex, u, v, w, h, d):
    crop = lambda x, y, ww, hh: tex.crop((x, y, x + ww, y + hh))
    return {
        'up': crop(u + d, v, w, d),
        'east_reg': crop(u, v + d, d, h),          # (u, v+d)
        'north': crop(u + d, v + d, w, h),
        'west_reg': crop(u + d + w, v + d, d, h),  # (u+d+w, v+d)
        'south': crop(u + 2 * d + w, v + d, w, h),
    }


def render(geo, tex, hide=(), view='front', s=10):
    bones = geo['minecraft:geometry'][0]['bones']
    cubes = []
    for b in bones:
        if b['name'] in hide:
            continue
        for c in b.get('cubes', []):
            (ox, oy, oz), (w, h, d) = c['origin'], c['size']
            f = faces_from_uv(tex, c['uv'][0], c['uv'][1], w, h, d)
            # dosya koordinatindan "on +Z" goruntu koordinatina: x->-x, z->-z
            x0, x1 = -(ox + w), -ox
            z0, z1 = -(oz + d), -oz
            if view == 'front':
                # izleyici +Z (modelin onu) ve +X tarafinda
                cubes.append(((x0, oy, z0, x1, oy + h, z1), f['up'], f['north'], f['west_reg']))
            else:
                # arkadan: modeli dosya koordinatinda dogrudan ciz (arka +Z)
                cubes.append(((ox, oy, oz, ox + w, oy + h, oz + d), f['up'].transpose(Image.ROTATE_180), f['south'], f['east_reg']))
    # derinlik sirasi: uzaktan yakina
    cubes.sort(key=lambda t: (t[0][2] + t[0][5]) + (t[0][0] + t[0][3]) * 0.5 + (t[0][1] + t[0][4]) * 0.3)
    W, H = 360, 420
    iso = Iso(W, H, W / 2, H - 60, s)
    for (x0, y0, z0, x1, y1, z1), top, front, right in cubes:
        iso.box(x0, y0, z0, x1, y1, z1, top=top.convert('RGBA'), front=front.convert('RGBA'), right=right.convert('RGBA'))
    return iso.img


if __name__ == '__main__':
    geo = json.load(open(sys.argv[1]))
    tex = Image.open(sys.argv[2]).convert('RGBA')
    hide = sys.argv[4].split(',') if len(sys.argv) > 4 else ()
    a = render(geo, tex, hide, 'front')
    b = render(geo, tex, hide, 'back')
    out = Image.new('RGB', (a.width + b.width, a.height))
    out.paste(a, (0, 0)); out.paste(b, (a.width, 0))
    out.save(sys.argv[3])
