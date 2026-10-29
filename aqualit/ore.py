from pix import *
from renk import stone, deep

# Cevher katmani: oyunda oyunun kendi tas / derin kayrak dokusunun USTUNE konur.
ORE = [
"................",
"...........HL...",
"..HL......HWLM..",
".HWLM......LMD..",
"..LMD.......D...",
"...D............",
".......LM.......",
".......MD.......",
"................",
"...HL...........",
"..HWLM.......HL.",
"..LLMD......HWLM",
"...MD.......LMDD",
"............MD..",
"................",
"................",
]
if __name__ == '__main__':
    layer = grid_to_img(ORE)
    layer.save('dokular/aqualit_ore_overlay.png')        # oyunda kullanilacak katman
    aq_ore = overlay(stone, layer); aq_deep = overlay(deep, layer)
    aq_ore.save('dokular/aqualit_ore.png')                # yedek (kendi tasimla)
    aq_deep.save('dokular/deepslate_aqualit_ore.png')
    preview([(aq_ore, 'Aqualit Cevheri'), (aq_deep, 'Derin Kayrak Aqualit Cevheri')],
            '1 · Aqualit Cevheri', 'onizleme/01_cevher.png')
