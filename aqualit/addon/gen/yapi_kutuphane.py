"""Mimar yapı kütüphanesi: elle yapılmış yapılar (yapilar.py) + dışarıdan alınanlar (yapilar/*.mcstructure.gz).

Pakete: BP/structures/aqualit/<kimlik>.mcstructure (oyunda kimlik 'aqualit:<kimlik>'),
RP/textures/ui/aqualit_yapi/<kimlik>.png (menü resmi), scripts/yapi_data.js (yalnız bilgiler; bloklar yapı dosyasında).
"""
import json
import os

import yapilar as Y
import yapi_paket as P
import yapi_alternatif as AL

HERE = os.path.dirname(os.path.abspath(__file__))
DIS = os.path.join(HERE, '..', 'yapilar')
KATEGORI = {
    'kucuk': 'Küçük yapılar', 'ev': 'Evler', 'villa': 'Villalar ve modern evler', 'koy': 'Köy ve kasaba',
    'kale': 'Kaleler', 'kule': 'Kuleler', 'tapinak': 'Tapınaklar', 'fantastik': 'Masal yapıları',
    'gemi': 'Gemiler', 'susleme': 'Süsleme ve anıtlar', 'ciftlik': 'Farmlar', 'dev': 'Dev yapılar',
}


def hepsi():
    """[(bilgi, W, H, D, hücreler)]"""
    out = []
    for fn in Y.ALL:
        s = fn()
        cells = {p: (v[0], dict(v[1])) for p, v in s.g.items()}
        out.append(({'id': s.key, 'ad': s.ad, 'kat': s.kat, 'aciklama': s.aciklama, 'elle': True}, s.W, s.H, s.D, cells))
    liste = json.load(open(os.path.join(HERE, 'yapi_listesi.json'), encoding='utf-8'))
    for x in liste:
        W, H, D, cells = P.oku(os.path.join(DIS, x['id'] + '.mcstructure.gz'))
        out.append(({'id': x['id'], 'ad': x['ad'], 'kat': x['kat'], 'yazar': x['yazar'], 'aciklama': ''}, W, H, D, cells))
    return out


def build(bp, rp, js_path):
    data = []
    for info, W, H, D, cells in hepsi():
        key = info['id']
        P.mcstructure(os.path.join(bp, 'structures', 'aqualit', key + '.mcstructure'), W, H, D, cells)
        img = P.render(W, H, D, cells, 128)
        os.makedirs(os.path.join(rp, 'textures', 'ui', 'aqualit_yapi'), exist_ok=True)
        img.save(os.path.join(rp, 'textures', 'ui', 'aqualit_yapi', key + '.png'))
        mal = P.malzeme(cells)
        bloklar = {}
        for name, st in cells.values():
            if name != 'air' and P.esya(name, st):
                bloklar[name] = bloklar.get(name, 0) + 1
        d = {'id': key, 'ad': info['ad'], 'kat': info['kat'], 'boyut': [W, H, D],
             'blok': sum(1 for v in cells.values() if v[0] != 'air'),
             'malzeme': {k: v for k, v in mal.items() if not k.startswith('?')},
             'bloklar': dict(sorted(bloklar.items(), key=lambda kv: -kv[1]))}
        if info.get('aciklama'):
            d['aciklama'] = info['aciklama']
        if info.get('yazar'):
            d['yazar'] = info['yazar']
        data.append(d)
    durum, alt, esya = AL.tablo({b for d in data for b in d['bloklar']})
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write('// build.py üretir (gen/yapi_kutuphane.py). Elle düzenleme.\n')
        f.write(f'export const KATEGORI = {json.dumps(KATEGORI, ensure_ascii=False)};\n')
        f.write('// hayatta kalmada: yok = bulunmaz, zor = Nether/End/nadir/ipeksi dokunuş\n')
        f.write(f'export const BLOK_DURUM = {json.dumps(durum, separators=(",", ":"))};\n')
        f.write(f'export const ALTERNATIF = {json.dumps(alt, separators=(",", ":"))};\n')
        f.write(f'export const BLOK_ESYA = {json.dumps(esya, separators=(",", ":"))};\n')
        f.write(f'export const YAPILAR = {json.dumps(data, ensure_ascii=False, separators=(",", ":"))};\n')
    return data
