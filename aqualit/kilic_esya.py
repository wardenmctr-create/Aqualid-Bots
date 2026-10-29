from pix import *
from shape import blank, to_rows

def put(g, rows, ox=0, oy=0):
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.': g[oy + y][ox + x] = ch

def command_rod():
    g = blank()
    put(g, [
    "...........OOO..",
    "..........OWHLO.",
    "..........OHLRO.",
    "..........OLRrO.",
    "...........OOO..",
    ], 0, 1)
    for y in range(5, 16):
        x = 15 - y
        if 0 <= x - 1: g[y][x - 1] = 'L'
        g[y][x] = 'D'
    g[5][10] = 'O'; g[5][9] = 'O'; g[6][9] = 'D'; g[6][8] = 'L'
    for y in (9, 12):          # halkalar
        x = 15 - y
        g[y][x - 2] = 'O'; g[y][x - 1] = 'H'; g[y][x] = 'M'; g[y][x + 1] = 'O'
    g[15][0] = 'O'
    return g

def selector():
    g = blank()
    put(g, [
    "OOOOOOO",
    "OWLLLLO",
    "OLO.OLO",
    "OL...LO",
    "OLO.OLO",
    "OLLLLYO",
    "OOOOOOO",
    ], 8, 0)
    for y in range(7, 16):
        x = 15 - y
        if 0 <= x - 1: g[y][x - 1] = 'v'
        g[y][x] = 't'
    return g

rod = grid_to_img(to_rows(command_rod())); rod.save('dokular/command_rod.png')
sel = grid_to_img(to_rows(selector())); sel.save('dokular/zone_selector.png')
preview([(rod, 'Komut Çubuğu'), (sel, 'Koruma Bölge Seçici')], '8 · Kılıçlı Robot Eşyaları', 'onizleme/08_kilic_esya.png')
