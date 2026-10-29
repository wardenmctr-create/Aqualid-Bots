#!/usr/bin/env python3
"""Mimar kütüphanesine dış yapıları alır: addon/gen/yapi_listesi.json'daki her yapıyı Java şemasından Bedrock'a
çevirir ve addon/yapilar/<kimlik>.mcstructure.gz olarak yazar.

Kullanım: python3 yapi_ice_aktar.py <şema_klasörü>
Şema klasörü: rom1504/minecraft-schematics-dataset (Planet Minecraft'tan ücretsiz indirilen şemalar) arşivinden
ayıklanan <dosya>.bin dosyaları. Kaynak ve yazar bilgisi yapi_listesi.json'da, docs/YAPI_KAYNAKLARI.md'de.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'addon', 'gen'))
import yapi_cevir as C  # noqa: E402
import yapi_paket as P  # noqa: E402

OUT = os.path.join(HERE, 'addon', 'yapilar')


def main(src):
    os.makedirs(OUT, exist_ok=True)
    liste = json.load(open(os.path.join(HERE, 'addon', 'gen', 'yapi_listesi.json'), encoding='utf-8'))
    for x in liste:
        raw = open(os.path.join(src, x['dosya'] + '.bin'), 'rb').read()
        W, H, D, cells, st = C.convert(raw)
        W, H, D, cells = C.temizle(cells)
        P.yaz_gz(os.path.join(OUT, x['id'] + '.mcstructure.gz'), W, H, D, cells)
        print(f"{x['id']:28} {W}x{H}x{D} {len(cells)} blok, çevrilemeyen {sum(st['eksik'].values())}")
    with open(os.path.join(HERE, 'docs', 'YAPI_KAYNAKLARI.md'), 'w', encoding='utf-8') as f:
        f.write('# Mimar kütüphanesi: dış yapıların kaynakları\n\n'
                'Yapılar Planet Minecraft\'ta ücretsiz paylaşılan şemalardır (rom1504/minecraft-schematics-dataset '
                'arşivi üzerinden alındı). Her yapı kendi yazarının eseridir; kişisel kullanım içindir. '
                'Bedrock\'a `addon/gen/yapi_cevir.py` ile çevrildi.\n\n'
                '| Kimlik | Ad | Asıl adı | Yazar | Kaynak |\n| --- | --- | --- | --- | --- |\n')
        for x in liste:
            f.write(f"| `{x['id']}` | {x['ad']} | {x['baslik'].replace('|', '/')} | {x['yazar']} | {x['kaynak']} |\n")


if __name__ == '__main__':
    main(sys.argv[1])
