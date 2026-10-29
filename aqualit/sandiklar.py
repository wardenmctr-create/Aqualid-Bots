from pix import *

# Tamamen Aqualit kaplama sandik (tahta yok)
BASE = [
"................",
".OOOOOOOOOOOOOO.",
".OWHHHHHHHHHHLO.",
".OHLHLLLLLLHLMO.",
".OLMMMMWHMMMMDO.",
".OOOOOOHLOOOOOO.",
".OLMMMMMMMMMMDO.",
".OLHMMMMMMMMHDO.",
".OLMMMMMMMMMMDO.",
".OLMMMMMMMMMMDO.",
".OLMMMMMMMMMMDO.",
".OLMMMMMMMMMMDO.",
".OLHMMMMMMMMHDO.",
".ODDDDDDDDDDDDO.",
".OOOOOOOOOOOOOO.",
"................",
]
EMB = {
 'pickaxe': [".WWWWW",
             "W...HW",
             "...H.W",
             "..H..W",
             ".H...W",
             "H...W."],
 'shovel':  ["......",
             "...WWW",
             "...WWW",
             "..HWW.",
             ".H....",
             "H....."],
 'hoe':     [".WWWWW",
             ".W..H.",
             "...H..",
             "..H...",
             ".H....",
             "H....."],
 'axe':     [".WW..H",
             "WWWWH.",
             "WWWH..",
             ".WH...",
             ".H....",
             "H....."],
 'house':   ["..WW..",
             ".WWWW.",
             "WWWWWW",
             ".WHHW.",
             ".WHHW.",
             ".WWWW."],
 'crate':   ["WWWWWW",
             "WH..HW",
             "W.HH.W",
             "W.HH.W",
             "WH..HW",
             "WWWWWW"],
 'gem':     ["......",
             "..WW..",
             ".WWHH.",
             ".HHLL.",
             "..LL..",
             "......"],
}

def chest(emb):
    g = [list(r) for r in BASE]
    e = EMB[emb]
    ox, oy = 5, 7
    pts = [(x, y, ch) for y, row in enumerate(e) for x, ch in enumerate(row) if ch != '.']
    for x, y, ch in pts:  # golge
        X, Y = ox + x + 1, oy + y + 1
        if 3 <= X <= 12 and 7 <= Y <= 12 and (X - ox, Y - oy) not in {(a, b) for a, b, _ in pts}:
            g[Y][X] = 'D'
    for x, y, ch in pts:
        g[oy + y][ox + x] = ch
    return grid_to_img([''.join(r) for r in g])

CHESTS = [('gem', 'aqualit_chest', 'Aqualit Sandık'),
          ('pickaxe', 'chest_miner', 'Madenci'),
          ('shovel', 'chest_digger', 'Kürekçi'),
          ('hoe', 'chest_farmer', 'Çiftçi'),
          ('axe', 'chest_lumber', 'Oduncu'),
          ('house', 'chest_builder', 'İnşaatçı'),
          ('crate', 'chest_collector', 'Toplayıcı')]
if __name__ == '__main__':
    items = []
    for key, fn, label in CHESTS:
        im = chest(key); im.save(f'dokular/{fn}.png'); items.append((im, label))
    preview(items, '4 · Robot Sandıkları (kaplama)', 'onizleme/04_sandiklar.png', scale=16)
