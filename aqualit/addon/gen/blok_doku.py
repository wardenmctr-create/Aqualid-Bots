"""Mimar menü resimleri için gerçek blok dokuları.

Oyunun kaynak paketinden (Mojang bedrock-samples) her bloğun üst, yan ve alt dokusu alınır, tek bir atlasa
(ref/yapi_cevir/blok_dokulari.png + .json) yazılır. Atlas depoda durur; bedrock-samples yoksa atlas kullanılır.
Eşya görünümündeki ("carried") dokular önceliklidir: çimen ve yapraklar zaten yeşil boyalıdır.
"""
import json
import os
import re

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.environ.get('AQUALIT_REF', os.path.join(HERE, '..', '..', 'ref'))
ATLAS = os.path.join(REF, 'yapi_cevir', 'blok_dokulari.png')
INDEX = os.path.join(REF, 'yapi_cevir', 'blok_dokulari.json')
SAMPLES = os.environ.get('BEDROCK_SAMPLES', '/home/user/mojang/bedrock-samples/resource_pack')
TAKMA = {'grass_block': 'grass', 'sea_lantern': 'seaLantern', 'trip_wire': 'tripWire'}
# gri dokular: oyun biyom rengiyle boyar
BOYA = {'water': (63, 118, 228), 'flowing_water': (63, 118, 228), 'vine': (72, 140, 48), 'short_grass': (110, 170, 70),
        'tall_grass': (110, 170, 70), 'fern': (100, 160, 70), 'large_fern': (100, 160, 70), 'lily_pad': (40, 120, 40),
        'grass': (110, 170, 70)}

_cache = {}


def _json(p):
    s = open(p, encoding='utf-8').read()
    s = re.sub(r'^\s*//.*$', '', s, flags=re.M)
    return json.loads(s)


def _yol(tt, key):
    e = tt.get(key)
    if not e:
        return None
    t = e.get('textures')
    while isinstance(t, list):
        t = t[0] if t else None
    if isinstance(t, dict):
        t = t.get('path') or (t.get('variations') or [{}])[0].get('path')
    return t


def _resim(path):
    for ext in ('.png', '.tga'):
        p = os.path.join(SAMPLES, path + ext)
        if os.path.exists(p):
            im = Image.open(p).convert('RGBA')
            w = im.size[0]
            return im.crop((0, 0, w, w)).resize((16, 16), Image.NEAREST)   # animasyonlu dokuda ilk kare
    return None


def atlas_yap(names):
    """names: blok adları. Atlas ve dizini yazar."""
    bj = _json(os.path.join(SAMPLES, 'blocks.json'))
    tt = _json(os.path.join(SAMPLES, 'textures', 'terrain_texture.json'))['texture_data']
    kareler, dizin = [], {}
    kare_no = {}

    def ekle(path, boya=None):
        k = (path, boya)
        if k in kare_no:
            return kare_no[k]
        im = _resim(path)
        if im is None:
            return None
        if boya:
            px = im.load()
            for y in range(16):
                for x in range(16):
                    r, g, b, a = px[x, y]
                    l = (r + g + b) / 3 / 255
                    px[x, y] = (round(boya[0] * l * 1.25), round(boya[1] * l * 1.25), round(boya[2] * l * 1.25), a)
        kare_no[k] = len(kareler)
        kareler.append(im)
        return kare_no[k]

    for n in sorted(names):
        e = bj.get(TAKMA.get(n, n))
        if not e:
            continue
        tx = e.get('carried_textures') or e.get('textures')
        if n in ('water', 'flowing_water'):
            tx = e.get('textures')
        if isinstance(tx, str):
            tx = {'up': tx, 'down': tx, 'side': tx}
        yuz = {}
        for f in ('up', 'side', 'down'):
            key = tx.get(f) or tx.get('side') or tx.get('north') or tx.get('up')
            p = _yol(tt, key) if key else None
            if p:
                i = ekle(p, BOYA.get(n))
                if i is not None:
                    yuz[f] = i
        if yuz:
            dizin[n] = {'u': yuz.get('up', yuz.get('side')), 's': yuz.get('side', yuz.get('up')), 'd': yuz.get('down', yuz.get('side'))}
    sut = 32
    sat = (len(kareler) + sut - 1) // sut
    img = Image.new('RGBA', (sut * 16, max(1, sat) * 16), (0, 0, 0, 0))
    for i, im in enumerate(kareler):
        img.paste(im, ((i % sut) * 16, (i // sut) * 16))
    os.makedirs(os.path.dirname(ATLAS), exist_ok=True)
    img.save(ATLAS)
    with open(INDEX, 'w', encoding='utf-8') as fh:
        json.dump(dizin, fh, sort_keys=True)
    _cache.clear()
    return len(dizin), len(kareler)


def doku(name):
    """(üst, yan, alt) 16x16 RGBA resimleri ya da None."""
    if not _cache:
        if not os.path.exists(INDEX):
            _cache['_yok'] = True
            return None
        img = Image.open(ATLAS).convert('RGBA')
        dizin = json.load(open(INDEX, encoding='utf-8'))
        kare = lambda i: img.crop(((i % 32) * 16, (i // 32) * 16, (i % 32) * 16 + 16, (i // 32) * 16 + 16))  # noqa: E731
        _cache['_d'] = {n: (kare(v['u']), kare(v['s']), kare(v['d'])) for n, v in dizin.items()}
    if _cache.get('_yok'):
        return None
    d = _cache['_d']
    return d.get(name) or d.get(name.replace('_double_slab', '_slab')) or d.get(name.replace('wall_', '').replace('_wall', ''))


if __name__ == '__main__':
    import sys
    sys.path.insert(0, HERE)
    import yapi_kutuphane as YK
    ad = set()
    for info, W, H, D, cells in YK.hepsi():
        for v in cells.values():
            ad.add(v[0])
    print(atlas_yap(ad))
