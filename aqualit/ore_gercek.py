# Aqualit cevheri: oyunun GERCEK tas / derin kayrak dokusu + Aqualit katmani
from PIL import Image
from pix import grid_to_img, overlay
from ore import ORE
from iso import cube
from kompoz import flat, compose

stone = Image.open('vanilla/stone.png').convert('RGBA')
deep = Image.open('vanilla/deepslate.png').convert('RGBA')
layer = grid_to_img(ORE)
aq = overlay(stone, layer); aqd = overlay(deep, layer)
aq.save('dokular/aqualit_ore.png'); aqd.save('dokular/deepslate_aqualit_ore.png')

if __name__ == '__main__':
    dia = Image.open('vanilla/diamond_ore.png').convert('RGBA')
    panels = [(flat(aq, 224), 'Aqualit Cevheri'), (cube(aq, 9), '3D'),
              (flat(aqd, 224), 'Derin Kayrak'), (cube(aqd, 9), '3D'),
              (flat(dia, 224), 'Karşılaştırma: Elmas')]
    compose('Aqualit Cevheri · oyunun kendi taş dokusuyla', panels, 'onizleme/15_cevher_gercek_tas.png',
            note='Taş ve derin kayrak kısmı artık oyunun birebir kendi dokusu.')
