from pix import *
from shape import *

def tool_shade(u, w, x, y):
    if w <= -2: return 'H'
    if w == -1: return 'L'
    if w == 0: return 'M'
    if w == 1: return 'M'
    return 'D'

# KAZMA: sol-ust kol + simetrik sag kol, ayna x+y=15
def pickaxe():
    g = blank()
    up = {}
    rows = {
        1: {x: 'O' for x in range(4, 10)},
        2: {2:'O',3:'O',4:'W',5:'H',6:'H',7:'H',8:'L',9:'L',10:'O',11:'O'},
        3: {1:'O',2:'H',3:'L',4:'L',5:'L',6:'L',7:'M',8:'M',9:'M',10:'M',11:'L',12:'O'},
        4: {1:'O',2:'M',3:'O',4:'O',5:'O',6:'O',7:'O',8:'O',9:'D',10:'M',11:'L'},
        5: {1:'O',2:'O',10:'M'},
    }
    dark = {'W':'H','H':'L','L':'M','M':'D','D':'D','O':'O'}
    for y, r in rows.items():
        for x, ch in r.items():
            g[y][x] = ch
    for y, r in rows.items():
        for x, ch in r.items():
            X, Y = 15 - y, 15 - x
            if g[Y][X] == '.':
                g[Y][X] = dark[ch]
    handle(g, -15, 3)
    g[5][9] = 'D'
    return g

def shovel():
    rows = [
    "................",
    "...........OOO..",
    "..........OWHLO.",
    ".........OWHHLMO",
    ".........OHHLMDO",
    ".........OHLMDO.",
    "........vtOOOO..",
    ".......vt.......",
    "......vt........",
    ".....vt.........",
    "....vt..........",
    "...vt...........",
    "..vt............",
    ".vt.............",
    "vt..............",
    "t...............",
    ]
    return [list(r) for r in rows]

def axe():
    rows = [
    "................",
    "......OOO.......",
    ".....OWHLO..OO..",
    "....OWHHLMOvtO..",
    "...OWHHLLMvtDO..",
    "...OHHLLMvtDO...",
    "....OLMMvtDDO...",
    ".....OOvtODO....",
    "......vt..O.....",
    ".....vt.........",
    "....vt..........",
    "...vt...........",
    "..vt............",
    ".vt.............",
    "vt..............",
    "t...............",
    ]
    return [list(r) for r in rows]

def hoe():
    g = blank()
    rows = [
    "................",
    "....OOOOOOOO....",
    "...OWHHHLLLMO...",
    "...OHLLMMMDDO...",
    "...OMOOOOOODO...",
    "...OOO....OO....",
    ]
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.': g[y][x] = ch
    handle(g, -15, 5)
    return g

def sword():
    rows = [
    ".............OOO",
    "............OWHO",
    "...........OWHLO",
    "..........OWHLO.",
    ".........OWHLO..",
    "........OWHLO...",
    ".......OWHLO....",
    "......OWHLO.....",
    "..OO.OHHLO......",
    "..OLOHLMO.......",
    "...OLLMO........",
    "...OvMLMO.......",
    "..OvtOOMDO......",
    ".OvtO..ODO......",
    "OLMO....O.......",
    "OOO.............",
    ]
    return [list(r) for r in rows]

names = [('aqualit_pickaxe', pickaxe, 'Kazma'), ('aqualit_shovel', shovel, 'Kürek'),
         ('aqualit_hoe', hoe, 'Çapa'), ('aqualit_axe', axe, 'Balta'), ('aqualit_sword', sword, 'Kılıç')]
items = []
for fn, f, label in names:
    im = img(f()); im.save(f'dokular/{fn}.png'); items.append((im, label))
preview(items, '3 · Aqualit Aletleri', 'onizleme/03_aletler.png', scale=16)
