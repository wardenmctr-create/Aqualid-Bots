from pix import *
import math

def gear():
    g = [['.'] * 16 for _ in range(16)]
    cx = cy = 7.5
    for y in range(16):
        for x in range(16):
            dx, dy = x - cx, y - cy
            r = math.hypot(dx, dy)
            a = math.degrees(math.atan2(dy, dx)) % 45
            tooth = a < 12 or a > 33
            if r <= 1.6:
                continue
            if r <= 5.2 or (tooth and r <= 7.4):
                if r <= 3.1:
                    g[y][x] = 'R' if (dx + dy) < 0 else 'r'
                    continue
                light = (-dx - dy) / (r * 1.4142)          # sol ust isik
                edge = r > 6.3 or (not tooth and r > 4.4)
                v = light - (0.35 if edge else 0)
                g[y][x] = 'W' if v > 0.75 else 'H' if v > 0.3 else 'L' if v > -0.15 else 'M' if v > -0.6 else 'D'
    return grid_to_img([''.join(r) for r in g])

COSTUME = [
".......WH.......",
".......LM.......",
"........D.......",
"..HHHHHHHHHHHL..",
"..HLLLLLLLLLLD..",
"..HkkkkkkkkkkD..",
"..HkLkkkkkkLkD..",
"..HkWWLkkLWWkD..",
"..HkWWWkkWWWkD..",
"..HRLWLkkLWLRD..",
"..HRkkkkkkkkRD..",
"..HMMMMMMMMMMD..",
".rRRRRRRRRRRRRr.",
".rRrrrrrrrrrrRr.",
"..rqrrrrrrrrqr..",
"...qq......qq...",
]
if __name__ == '__main__':
    gi = gear(); gi.save('dokular/tuning_gear.png')
    ci = grid_to_img(COSTUME); ci.save('dokular/kilicli_costume.png')
    preview([(gi, 'Kılıçlı Ayar Dişlisi'), (ci, 'Kılıçlı Robot Kostümü')], 'Ayar dişlisi ve kostüm', 'onizleme/14_disli_kostum.png')
