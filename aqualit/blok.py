from pix import *
from iso import cube

# Ilk hal: koyu cizgi yok, sadece acik/koyu kenar golgesi
BLOCK = [
"WHHHHHHHHHHHHHHL",
"HLLLLLLLLLLLLLMD",
"HLHMMMMMMMMMMHMD",
"HLMMMMMMMMMMMMMD",
"HLMMMMMLHMMMMMMD",
"HLMMMMLWHLMMMMMD",
"HLMMMLWHHLMMMMMD",
"HLMMLHHLLMDMMMMD",
"HLMMMLLMMDDMMMMD",
"HLMMMMLMDDMMMMMD",
"HLMMMMMDDMMMMMMD",
"HLMMMMMMMMMMMMMD",
"HLMMMMMMMMMMMMMD",
"HLHMMMMMMMMMMHMD",
"HMMMMMMMMMMMMMMD",
"LDDDDDDDDDDDDDDO",
]
if __name__ == '__main__':
    from PIL import Image
    from kompoz import compose, flat
    im = grid_to_img(BLOCK); im.save('dokular/aqualit_block.png')
    cube(im, s=10).save('onizleme/3d_blok.png')
    compose('Aqualit Bloğu (9 külçe)', [(flat(im, 256), 'Doku (6 yüzde aynı)'),
            (Image.open('onizleme/3d_blok.png'), '3D önizleme')], 'onizleme/10_aqualit_blogu.png')
