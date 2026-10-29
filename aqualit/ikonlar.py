# Robot esya ikonlari (16x16): her tur icin kafa + kucuk govde, tur detayi ile
from PIL import Image
from pix import preview
from robot import RP

def img(rows):
    assert len(rows) == 16, len(rows)
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        assert len(r) == 16, (y, r, len(r))
        for x, ch in enumerate(r):
            c = RP.get(ch) if ch != '.' else None
            if c is not None:
                im.putpixel((x, y), c + (255,))
    return im

def grid(rows):
    return [list(r) for r in rows]

def put(g, rows, ox, oy):
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != ' ':
                g[oy + y][ox + x] = ch

# Temel: anten (top), 12 genis kafa, ekran, iki oval goz, kucuk govde ve ayaklar
BASE = [
"................",
".......HW.......",
".......LH.......",
"........M.......",
"..HHHHHHHHHHHL..",
"..HkkkkkkkkkkD..",
"..HkLWkkkkLWkD..",
"..HkWWkkkkWWkD..",
"..HkWWkkkkWWkD..",
"..HkLWkkkkLWkD..",
"..HMMMMMMMMMMD..",
"...DDDDDDDDDD...",
"....LMHkkHMD....",
"....LMkHHkMD....",
"....LMMMMMMD....",
".....DD..DD.....",
]

def base():
    return grid(BASE)

def madenci():
    g = base()
    # kask: kafanin ust kismi ve anten kaskin ustunde
    put(g, ["........"], 4, 0)
    g[0] = list("................")
    g[1] = list(".......HW.......")
    g[2] = list("........M.......")
    g[3] = list("..YYYYYYYYYYYY..")
    g[4] = list(".YyyyyYWYyyyyyQ.")
    g[5] = list(".QQQQQYYYQQQQQQ.")
    return g

def kurekci():
    g = base()
    g[14] = list("....LMMMMMMD....")
    g[15] = list("....nNN..nNN....")
    # sirtta kum torbasi kenari
    g[12][3] = 'n'; g[13][3] = 'N'; g[12][12] = 'n'; g[13][12] = 'N'
    return g

def ciftci():
    g = base()
    g[0] = list("......f.f.......")
    g[1] = list(".......eE.......")
    g[2] = list("....xwxwxwxx....")
    g[3] = list("....rrrrrrrr....")
    g[4] = list(".XwxwxwxwxwxwxX.")
    return g

def oduncu():
    g = base()
    g[0] = list(".......f........")
    g[1] = list("......efe.......")
    g[2] = list("......eEe.......")
    g[3] = list("........E.......")
    g[11] = list("...fffffffffff..")
    g[12] = list("...eEeMHkkHeEe..")
    return g

def insaatci():
    g = base()
    g[0] = list(".......HW.......")
    g[1] = list("......GGGA......")
    g[2] = list("....GGWGGAAA....")
    g[3] = list("...GGAAGAAAAC...")
    g[4] = list("..GAAAAGAAAAAC..")
    g[5] = list(".CCCCCCCCCCCCCC.")
    g[14] = list("....omcmYmmyo...")
    return g

def toplayici():
    g = base()
    g[0] = list(".......HW.......")
    g[1] = list("..b..3333333..b.")
    g[2] = list("..b.3311111P..b.")
    g[3] = list("..b11111111PPP..")
    for y in (5, 8):
        g[y] = list("..PPPPPPPPPPPP..")
    for y in (6, 7, 8):
        g[y][1] = 'g'; g[y][14] = 'g'
    g[7][14] = 'L'
    g[9][13] = 'L'
    for y in (12, 13, 14):
        g[y][3] = 'u'; g[y][12] = 't'
    return g

DIGIT = {
    1: [".Y.", "YY.", ".Y.", ".Y.", "YYY"],
    2: ["YY.", "..Y", ".Y.", "Y..", "YYY"],
    3: ["YY.", "..Y", ".Y.", "..Y", "YY."],
    4: ["Y.Y", "Y.Y", "YYY", "..Y", "..Y"],
    5: ["YYY", "Y..", "YY.", "..Y", "YY."],
}

# model renkleri (robotgeo ile ayni): pelerin (acik, orta, koyu), omuz, detay/goz (parlak, orta)
RP.update({
    'j': (120, 220, 80), 'i': (70, 170, 50), 'h': (40, 110, 30), 'l': (175, 255, 140),
    'P': (196, 110, 255), 'p': (138, 64, 206), 'z': (86, 34, 140), 'Z': (226, 184, 255),
    'F': (255, 242, 160),
    'U': (110, 170, 255), 'V': (50, 110, 230), 'T': (25, 60, 150), 'S': (176, 218, 255),
})
RP.update({'1': (46, 56, 86), '2': (30, 36, 58), '3': (76, 90, 132)})
MODEL_COL = {
    1: dict(cape=('R', 'r', 'q'), shoulder=None, eye=None, detail=('R', 'r')),
    2: dict(cape=('j', 'i', 'h'), shoulder='j', eye=('l', 'j'), detail=('l', 'j')),
    3: dict(cape=('P', 'p', 'z'), shoulder='P', eye=('Z', 'P'), detail=('Z', 'P')),
    4: dict(cape=('Y', 'y', 'Q'), shoulder='Y', eye=('F', 'Y'), detail=('F', 'Y')),
    5: dict(cape=('U', 'V', 'T'), shoulder='U', eye=('S', 'U'), detail=('S', 'U')),
}

def kilicli(model=1, badge=True):
    g = base()
    M = MODEL_COL[model]
    cl, cm, cd = M['cape']
    # kararli gozler + her zaman kirmizi yanaklar
    g[5] = list("..HkkkkkkkkkkD..")
    g[6] = list("..HkkLkkkkLkkD..")
    g[7] = list("..HkWWLkkLWWkD..")
    g[8] = list("..HRWWkkkkWWRD..")
    g[9] = list("..HRLWkkkkWLRD..")
    if M['eye']:
        e0, e1 = M['eye']
        for y in range(6, 10):
            for x in list(range(4, 7)) + list(range(9, 12)):
                if g[y][x] == 'W': g[y][x] = e0
                elif g[y][x] == 'L': g[y][x] = e1
    # pelerin govdenin iki yaninda
    for y in (12, 13, 14):
        g[y][3] = cl; g[y][12] = cd
    g[15][3] = cm; g[15][12] = cd
    # renk detaylari: anten ucu + govdedeki kalp
    d0, d1 = M['detail']
    g[1][7], g[1][8] = d1, d0
    g[2][7], g[2][8] = d1, d1
    for y in (12, 13):
        for x in range(6, 10):
            if g[y][x] == 'H': g[y][x] = d0
    if M['shoulder']:
        g[11][2] = M['shoulder']; g[11][13] = M['shoulder']
    if badge:
        dg = DIGIT[model]
        for y, r in enumerate(dg):
            for x, ch in enumerate(r):
                if ch == 'Y':
                    g[y][13 + x] = 'W'
    return g

ICONS = {
    'robot_madenci': ('Madenci Robot', madenci),
    'robot_kurekci': ('Kürekçi Robot', kurekci),
    'robot_ciftci': ('Çiftçi Robot', ciftci),
    'robot_oduncu': ('Oduncu Robot', oduncu),
    'robot_insaatci': ('İnşaatçı Robot', insaatci),
    'robot_toplayici': ('Toplayıcı Robot', toplayici),
}
for m in range(1, 6):
    ICONS[f'robot_kilicli_{m}'] = (f'Kılıçlı Robot M{m}', (lambda mm: (lambda: kilicli(mm)))(m))

def build(outdir='dokular'):
    out = {}
    for key, (label, fn) in ICONS.items():
        im = img([''.join(r) for r in fn()])
        im.save(f'{outdir}/{key}.png')
        out[key] = (im, label)
    return out

if __name__ == '__main__':
    out = build()
    items = list(out.values())
    preview(items[:4], 'Robot eşyaları', 'onizleme/16_robot_ikonlari.png', scale=14)
    preview(items[4:], 'Kılıçlı robot · 5 model', 'onizleme/17_kilicli_ikonlari.png', scale=14)
    print('ok')
