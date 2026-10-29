# (u, w) koordinatlari: u = x - y (sap yonu), w = x + y - 15 (dik yon, negatif = sol ust)
from pix import grid_to_img

def blank():
    return [['.'] * 16 for _ in range(16)]

def cells_where(pred):
    return {(x, y) for y in range(16) for x in range(16) if pred(x - y, x + y - 15)}

def outline(g, cells, ch='O', diag=False):
    nb = [(1,0),(-1,0),(0,1),(0,-1)] + ([(1,1),(1,-1),(-1,1),(-1,-1)] if diag else [])
    for (x, y) in list(cells):
        for dx, dy in nb:
            X, Y = x+dx, y+dy
            if 0 <= X < 16 and 0 <= Y < 16 and (X, Y) not in cells and g[Y][X] == '.':
                g[Y][X] = ch

def fill(g, cells, shade):
    for (x, y) in cells:
        g[y][x] = shade(x - y, x + y - 15, x, y)

def handle(g, u0, u1, light='v', dark='t'):
    # 2 piksel genis basamakli sap, eksen x+y=15
    for y in range(16):
        x = 15 - y
        u = x - y
        if u0 <= u <= u1:
            if 0 <= x-1 < 16: g[y][x-1] = light
            g[y][x] = dark

def to_rows(g):
    return [''.join(r) for r in g]

def img(g):
    return grid_to_img(to_rows(g))
