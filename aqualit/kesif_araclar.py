"""Keşif Robotu'nun 5 araç hali. Her araçta robottan izler var:
gözler (ön cam/farlar), pirinç gözlük camlı farlar, dönen radar, krem atkı-bayrak, pusula amblemi.
Koordinatlar robot.py ile aynı (ön +Z, birim piksel, zemin y=0)."""
from kesif import (Form, fill, panel, rows, over, hline, vline, dots, mirror_h, G)

EYE_BIG = [" LWL ",
           "LWWWL",
           "WWWWW",
           "WWWWW",
           "LWWWL",
           " LWL "]
COMPASS7 = ["  yyy  ",
            " y4R4y ",
            "y44R44y",
            "yccWccy",
            "y44a44y",
            " y4a4y ",
            "  yyy  "]
PORT = [" yyy ",
        "y~<<y",
        "y<<>y",
        " yyy "]
PORT_LIT = [" yyy ",
            "y$##y",
            "y##!y",
            " yyy "]
LAMP = [" yYy ",
        "y$$#y",
        "y$#!y",
        " yQy "]


def eyes(w, h, big=None, frame='M', bg='k', gap=None):
    g = fill(w, h, bg)
    if frame:
        hline(g, 0, frame)
        hline(g, h - 1, frame)
        vline(g, 0, frame)
        vline(g, w - 1, frame)
    big = (h >= 8 and w >= 14) if big is None else big
    e = EYE_BIG if big else ["LWL", "WWW", "WWW", "LWL"]
    ew, eh = len(e[0]), len(e)
    gap = gap if gap is not None else max(2, (w - 2 * ew) // 3)
    ox = (w - (2 * ew + gap)) // 2
    oy = (h - eh) // 2
    over(g, e, ox, oy)
    over(g, e, ox + ew + gap, oy)
    return g


def stripe_panel(w, h, base='M', stripe=None, stripe_c='W', seams=(), rivets=False):
    g = panel(w, h, base)
    if stripe is not None:
        for s in (stripe if isinstance(stripe, (list, tuple)) else [stripe]):
            hline(g, s, stripe_c, 1, w - 1)
    for x in seams:
        vline(g, x, 'D', 1, h - 1)
    if rivets:
        for x in range(2, w - 2, 4):
            dots(g, [(x, 1), (x, h - 2)], 'H')
    return g


def tread(w, h, along='h'):
    g = fill(w, h, 'k')
    for y in range(h):
        for x in range(w):
            if along == 'h' and x % 3 == 0:
                g[y][x] = 'g'
            if along == 'v' and y % 3 == 0:
                g[y][x] = 'g'
    return g


def tire_side(w, h, hub='y'):
    """Lastiğin yan yüzü: koyu lastik, gri jant, pirinç göbek."""
    g = fill(w, h, 'k')
    cx, cy = (w - 1) / 2, (h - 1) / 2
    r = min(w, h) / 2
    for y in range(h):
        for x in range(w):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if d < r * 0.62:
                g[y][x] = '&'
            if d < r * 0.5:
                g[y][x] = '*'
            if d < r * 0.26:
                g[y][x] = hub
            if r * 0.62 <= d < r * 0.78 and (x + y) % 2 == 0:
                g[y][x] = 'K'
    return g


def deck(w, d):
    g = fill(w, d, 'v')
    for x in range(w):
        for y in range(d):
            if x % 3 == 2:
                g[y][x] = 't'
            elif ((y + (x // 3) * 5) % 9) == 0:
                g[y][x] = 'u'
    return g


def hazard(w, h):
    g = fill(w, h, 'y')
    for y in range(h):
        for x in range(w):
            if ((x + y) // 2) % 2:
                g[y][x] = 'k'
    return g


def rail(n, h, post_every=5, c='y'):
    """İnce korkuluk yüzü: üstte boru, aralarda dikmeler, gerisi saydam."""
    g = [[' '] * n for _ in range(h)]
    hline(g, 0, c)
    for x in range(0, n, post_every):
        vline(g, x, c)
    vline(g, n - 1, c)
    return g


def add_box(f, bone, name, a, b, base='M', glow='', **faces):
    return f.add(bone, name, a, b, glow=glow, base=base, **faces)


def sz(a, b):
    return tuple(int(round(b[i] - a[i])) for i in range(3))


def auto(a, b, base='M', top_base=None, side=None, front=None, back=None, top=None, bottom='D', left=None, right=None):
    """Boyuta göre varsayılan yüzler."""
    w, h, d = sz(a, b)
    out = {
        'front': front if front is not None else panel(w, h, base),
        'back': back if back is not None else panel(w, h, base),
        'left': left if left is not None else (side if side is not None else panel(d, h, base)),
        'right': right if right is not None else (mirror_h(side) if side is not None else panel(d, h, base)),
        'top': top if top is not None else panel(w, d, top_base or base, t='H', b='L', l='H', r='L'),
        'bottom': fill(w, d, bottom) if isinstance(bottom, str) else bottom,
    }
    return out


def radar(f, parent, x, y, z, bone_name, mast=3):
    """Direk + dönen radar çanağı (robotun anteni)."""
    f.add(parent, bone_name + '_mast', (x - 0.5, y, z - 0.5), (x + 0.5, y + mast, z + 0.5),
          front=fill(1, mast, '&'), back=fill(1, mast, '%'), left=fill(1, mast, '&'), right=fill(1, mast, '%'),
          top=rows('*'), bottom=rows('%'))
    f.bone(bone_name, parent, (x, y + mast, z), (-25, 0, 0))
    f.add(bone_name, bone_name + '_dish', (x - 2.5, y + mast, z - 0.5), (x + 2.5, y + mast + 3, z + 0.5),
          front=rows("LHWHL", "HMyMH", "LDDDL"), back=rows("MDDDM", "D%%%D", "MDDDM"),
          left=rows('L', 'M', 'D'), right=rows('M', 'D', 'D'), top=rows('HWWWH'), bottom=rows('DDDDD'))
    f.add(bone_name, bone_name + '_feed', (x - 0.5, y + mast + 1, z + 0.5), (x + 0.5, y + mast + 2, z + 2.5),
          front=rows('Y'), back=rows('y'), left=rows('yy'), right=rows('yy'), top=rows('Y', 'y'), bottom=rows('Q', 'Q'))


def lamp(f, bone, name, a, b, facing='front'):
    w, h, d = sz(a, b)
    face = fill(w, h, 'y')
    over(face, [r[:w] for r in LAMP][:h], max(0, (w - 5) // 2), max(0, (h - 4) // 2))
    faces = auto(a, b, base='y', top=fill(w, d, 'Y'), bottom='Q')
    faces[facing] = face
    f.add(bone, name, a, b, glow='$#!', **faces)


# ================================================================== UÇAK
def ucak():
    f = Form('ucak', 'Uçak')
    f.bone('u_root', None, (0, 12, -11))
    f.bone('u_body', 'u_root', (0, 12, 0))
    f.bone('u_prop', 'u_body', (0, 12, 19.5))
    f.bone('u_ail_l', 'u_body', (-27, 9.5, -8))
    f.bone('u_ail_r', 'u_body', (27, 9.5, -8))
    f.bone('u_elev', 'u_body', (0, 13, -40))
    f.bone('u_rudder', 'u_body', (0, 21, -40))
    f.bone('u_gear_l', 'u_body', (-13, 7, 1))
    f.bone('u_gear_r', 'u_body', (13, 7, 1))
    f.bone('u_scarf', 'u_body', (0, 21, -8))
    f.bone('u_flame', 'u_body', (0, 7, -8))
    # gövde
    side = stripe_panel(36, 12, 'M', stripe=[3], stripe_c='W', seams=(9, 22), rivets=True)
    hline(side, 4, 'y', 1, 35)
    over(side, COMPASS7, 4, 4)
    top = panel(14, 36, 'L', t='H', b='M', l='H', r='M')
    # açık kokpit: deri koltuk
    for y in range(8, 18):
        for x in range(3, 11):
            top[y][x] = 'o' if (y + x) % 5 else 'm'
    hline(top, 8, '7', 3, 11)
    for y in range(8, 18):
        top[y][3] = 'y'
        top[y][10] = 'y'
    front = panel(14, 12, 'M')
    add_box(f, 'u_body', 'u_fuse', (-7, 6, -22), (7, 18, 14), **auto((-7, 6, -22), (7, 18, 14), side=side,
                                                                    top=top, front=front, back=panel(14, 12, 'D')))
    # motor kaputu + ızgara
    cf = fill(12, 10, 'y')
    for y in range(1, 9):
        for x in range(1, 11):
            cf[y][x] = '%' if (y % 2) else 'k'
    hline(cf, 0, 'Y')
    add_box(f, 'u_body', 'u_cowl', (-6, 7, 14), (6, 17, 18), base='M',
            **auto((-6, 7, 14), (6, 17, 18), side=stripe_panel(4, 10, 'M', stripe=[2], stripe_c='y'), front=cf))
    for nm, x0 in (('u_exh_l', -7.5), ('u_exh_r', 6.5)):
        add_box(f, 'u_body', nm, (x0, 9, 10), (x0 + 1, 11, 15), base='%',
                **auto((x0, 9, 10), (x0 + 1, 11, 15), base='%', front=rows('k', 'k'), top=fill(1, 5, '&')))
    # pervane (göbek + 4 kanat)
    add_box(f, 'u_prop', 'u_hub', (-2, 10, 18), (2, 14, 21), base='y',
            **auto((-2, 10, 18), (2, 14, 21), base='y', front=rows('yYYy', 'YWYY', 'YYYy', 'yYyQ'),
                   top=fill(4, 3, 'Y')))
    blade_v = fill(2, 20, '&')
    for yy in (0, 1, 18, 19):
        blade_v[yy] = ['Y', 'Y']
    add_box(f, 'u_prop', 'u_blade_v', (-1, 2, 19), (1, 22, 20), base='&',
            front=blade_v, back=[r[:] for r in blade_v], left=fill(1, 20, '%'), right=fill(1, 20, '%'),
            top=rows('YY'), bottom=rows('YY'))
    blade_h = fill(20, 2, '&')
    for xx in (0, 1, 18, 19):
        blade_h[0][xx] = blade_h[1][xx] = 'Y'
    add_box(f, 'u_prop', 'u_blade_h', (-10, 11, 19), (10, 13, 20), base='&',
            front=blade_h, back=[r[:] for r in blade_h], left=fill(1, 2, 'Y'), right=fill(1, 2, 'Y'),
            top=fill(20, 1, '*'), bottom=fill(20, 1, '%'))
    # robot yüzü = ön cam (pirinç çerçeve)
    ws = eyes(14, 9, big=True, frame='y')
    fsd = panel(5, 9, 'M')
    over(fsd, rows('yyy', 'y<y', 'yyy'), 1, 2)
    add_box(f, 'u_body', 'u_face', (-7, 18, 4), (7, 27, 9),
            **auto((-7, 18, 4), (7, 27, 9), base='M', front=ws, side=fsd,
                   top=panel(14, 5, 'L', t='H', b='M', l='H', r='M'), back=panel(14, 9, 'D')))
    # kokpit kenarı ve deri koltuk sırtı (pilot başlığı)
    for nm, a, b in (('u_rim_l', (-6, 18, -6), (-5, 19, 4)), ('u_rim_r', (5, 18, -6), (6, 19, 4))):
        add_box(f, 'u_body', nm, a, b, base='y', **auto(a, b, base='y', top=fill(1, 10, 'Y')))
    hr = fill(8, 5, 'o')
    hline(hr, 0, '7')
    vline(hr, 4, 'm', 1, 5)
    add_box(f, 'u_body', 'u_headrest', (-4, 18, -9), (4, 23, -6), base='o',
            **auto((-4, 18, -9), (4, 23, -6), base='o', front=hr, back=[r[:] for r in hr], top=fill(8, 3, '7'),
                   side=fill(3, 5, 'o')))
    # atkı (kuyruk gibi dalgalanır)
    sc = rows('44', '45')
    add_box(f, 'u_scarf', 'u_scarf', (-1, 19, -17), (1, 21, -9), base='4',
            front=sc, back=[r[:] for r in sc], left=rows('44444555', '45454566'), right=rows('55544444', '66545454'),
            top=fill(2, 8, '4'), bottom=fill(2, 8, '5'))
    # kanatlar
    wt = panel(68, 14, 'L', t='M', b='H', l='H', r='M')
    for x in range(8, 68, 10):
        vline(wt, x, 'M', 1, 13)
    for x0 in (4, 57):
        over(wt, COMPASS7, x0, 3)
    for y in range(14):
        wt[y][0] = 'R' if y < 7 else 'r'
        wt[y][67] = 'f' if y < 7 else 'e'
    wf = fill(68, 3, 'M')
    hline(wf, 0, 'H')
    hline(wf, 2, 'D')
    add_box(f, 'u_body', 'u_wing', (-34, 8, -8), (34, 11, 6), base='M',
            front=wf, back=[r[:] for r in wf], left=panel(14, 3, 'M'), right=panel(14, 3, 'M'), top=wt,
            bottom=fill(68, 14, 'D'))
    for nm, bone, x0 in (('u_ail_l', 'u_ail_l', -34), ('u_ail_r', 'u_ail_r', 20)):
        at = panel(14, 3, 'L', t='M', b='H', l='H', r='M')
        add_box(f, bone, nm, (x0, 8.5, -11), (x0 + 14, 10.5, -8), base='M',
                **auto((x0, 8.5, -11), (x0 + 14, 10.5, -8), base='M', top=at))
    # kanat uç ışıkları
    for nm, x0, c in (('u_navl', -35, 'R'), ('u_navr', 34, 'f')):
        add_box(f, 'u_body', nm, (x0, 9, 2), (x0 + 1, 10, 5), base=c, glow=c,
                **auto((x0, 9, 2), (x0 + 1, 10, 5), base=c, top=fill(1, 3, c), bottom=c))
    # kanat altı jet motorları (sırt çantasının tüpleri)
    for nm, x0 in (('u_jet_l', -23), ('u_jet_r', 17)):
        js = fill(12, 4, 'M')
        hline(js, 0, 'H')
        vline(js, 3, 'y')
        vline(js, 8, 'y')
        hline(js, 3, 'D')
        jf = rows('yyyyyy', 'y%kk%y', 'y%kk%y', 'yyyyyy')
        add_box(f, 'u_body', nm, (x0, 4, -6), (x0 + 6, 8, 6), base='M',
                **auto((x0, 4, -6), (x0 + 6, 8, 6), side=js, front=jf, back=rows('QQQQQQ', 'Q!##!Q', 'Q!##!Q', 'QQQQQQ'),
                       top=panel(6, 12, 'L')))
        fl = rows('$#$#', '#!!#', '!  !')
        add_box(f, 'u_flame', nm + '_fl', (x0 + 1, 4.5, -10), (x0 + 5, 7.5, -6), base='!', glow='$#!',
                front=fl, back=fl, left=rows('$##!', '#!! ', '!   '), right=rows('!##$', ' !!#', '   !'),
                top=fill(4, 4, '#'), bottom=fill(4, 4, '!'))
    # kuyruk
    ts = stripe_panel(12, 8, 'M', stripe=[2], stripe_c='W')
    add_box(f, 'u_body', 'u_tail', (-5, 9, -34), (5, 17, -22), **auto((-5, 9, -34), (5, 17, -22), side=ts,
                                                                    top=panel(10, 12, 'L', t='H', b='L', l='H', r='M')))
    add_box(f, 'u_body', 'u_tailtip', (-3, 11, -40), (3, 16, -34),
            **auto((-3, 11, -40), (3, 16, -34), side=stripe_panel(6, 5, 'M', stripe=[1], stripe_c='W')))
    st = panel(32, 9, 'L', t='M', b='H', l='H', r='M')
    for x in (8, 23):
        vline(st, x, 'M', 1, 8)
    add_box(f, 'u_body', 'u_stab', (-16, 12, -40), (16, 14, -31), base='M',
            **auto((-16, 12, -40), (16, 14, -31), top=st))
    add_box(f, 'u_elev', 'u_elev', (-16, 12.5, -43), (16, 13.5, -40), base='M',
            **auto((-16, 12.5, -43), (16, 13.5, -40), top=panel(32, 3, 'L', t='M', b='H', l='H', r='M')))
    fs = panel(8, 12, 'M')
    over(fs, COMPASS7, 1, 2)
    hline(fs, 0, 'H')
    add_box(f, 'u_body', 'u_fin', (-1, 16, -40), (1, 28, -32), **auto((-1, 16, -40), (1, 28, -32), side=fs,
                                                                     top=fill(2, 8, 'H')))
    add_box(f, 'u_rudder', 'u_rudder', (-1, 16, -43), (1, 27, -40),
            **auto((-1, 16, -43), (1, 27, -40), side=stripe_panel(3, 11, 'M', stripe=[3, 7], stripe_c='4')))
    add_box(f, 'u_body', 'u_beacon', (-0.5, 28, -37), (0.5, 29, -36), base='R', glow='R',
            **auto((-0.5, 28, -37), (0.5, 29, -36), base='R', top=rows('R'), bottom='R'))
    # iniş takımları
    for nm, bone, x0 in (('l', 'u_gear_l', -14), ('r', 'u_gear_r', 12)):
        add_box(f, bone, 'u_strut_' + nm, (x0, 3, 0), (x0 + 2, 8, 2), base='&',
                **auto((x0, 3, 0), (x0 + 2, 8, 2), base='&', top=fill(2, 2, '*')))
        wx = x0 - 0.5 if nm == 'l' else x0 - 0.5
        add_box(f, bone, 'u_wheel_' + nm, (wx, 0, -2), (wx + 3, 6, 4), base='k',
                front=tread(3, 6, 'v'), back=tread(3, 6, 'v'), left=tire_side(6, 6), right=tire_side(6, 6),
                top=tread(3, 6, 'v'), bottom=tread(3, 6, 'v'))
    add_box(f, 'u_body', 'u_tailstrut', (-0.5, 5, -33), (0.5, 9, -32), base='&',
            **auto((-0.5, 5, -33), (0.5, 9, -32), base='&', top=rows('*')))
    add_box(f, 'u_body', 'u_tailwheel', (-1, 2, -34), (1, 5, -31), base='k',
            front=tread(2, 3, 'v'), back=tread(2, 3, 'v'), left=tire_side(3, 3), right=tire_side(3, 3),
            top=tread(2, 3, 'v'), bottom=tread(2, 3, 'v'))
    return f


# ================================================================== GEMİ
def gemi():
    f = Form('gemi', 'Gemi')
    f.bone('g_root', None, (0, 8, 2))
    f.bone('g_body', 'g_root', (0, 6, 0))
    f.bone('g_screw', 'g_body', (0, 2, -25.5))
    f.bone('g_flag', 'g_body', (0, 24, -24.5))
    # su altı gövde (kırmızı)
    ls = fill(46, 4, '=')
    hline(ls, 0, 'O')
    add_box(f, 'g_body', 'g_keel', (-8, 0, -24), (8, 4, 22), base='=',
            **auto((-8, 0, -24), (8, 4, 22), base='=', side=ls, top=fill(16, 46, '='), bottom='q',
                   front=fill(16, 4, '='), back=fill(16, 4, '=')))
    for nm, a, b in (('g_keelbow1', (-6, 1, 22), (6, 4, 26)), ('g_keelbow2', (-3, 2, 26), (3, 4, 29))):
        w, h, d = sz(a, b)
        add_box(f, 'g_body', nm, a, b, base='=', **auto(a, b, base='=', top=fill(w, d, '='), bottom='q',
                                                       side=fill(d, h, '=')))
    # ana gövde (turkuaz, beyaz şerit, lumbozlar, pusula)
    hs = stripe_panel(50, 8, 'M', stripe=[1], stripe_c='9', seams=(12, 37))
    hline(hs, 0, 'y')
    for x in range(8, 44, 7):
        over(hs, PORT, x, 3)
    over(hs, COMPASS7, 41, 1)
    hs_r = mirror_h(hs)
    add_box(f, 'g_body', 'g_hull', (-10, 4, -26), (10, 12, 24),
            left=hs, right=hs_r, top=deck(20, 50), bottom=fill(20, 50, 'D'),
            front=stripe_panel(20, 8, 'M', stripe=[1], stripe_c='9'),
            back=over(stripe_panel(20, 8, 'M', stripe=[1], stripe_c='9'), rows("y y y", " yyy "), 7, 3))
    for nm, a, b in (('g_bow1', (-8, 4, 24), (8, 12, 28)), ('g_bow2', (-5, 5, 28), (5, 12, 31)),
                     ('g_bow3', (-2, 6, 31), (2, 12, 33))):
        w, h, d = sz(a, b)
        sd = stripe_panel(d, h, 'M', stripe=[1], stripe_c='9')
        hline(sd, 0, 'y')
        add_box(f, 'g_body', nm, a, b, **auto(a, b, side=sd, top=deck(w, d),
                                              front=over(stripe_panel(w, h, 'M', stripe=[1], stripe_c='9'),
                                                         [['y']], w // 2, 0)))
    # korkuluklar
    for nm, x0 in (('g_rail_l', -10), ('g_rail_r', 9)):
        rl = rail(44, 3, 5)
        add_box(f, 'g_body', nm, (x0, 12, -24), (x0 + 1, 15, 20), base='y',
                left=rl, right=mirror_h(rl), front=rows('y', 'y', 'y'), back=rows('y', 'y', 'y'),
                top=fill(1, 44, 'Y'), bottom=fill(1, 44, 'y'))
    # kaptan köşkü: krem duvar, önde robot yüzü (camlar)
    cf = fill(14, 10, '4')
    hline(cf, 0, 'L')
    hline(cf, 9, 'M')
    over(cf, eyes(12, 6, big=False, frame='y'), 1, 2)
    cs = fill(16, 10, '4')
    hline(cs, 0, 'L')
    hline(cs, 9, 'M')
    for x0 in (2, 7):
        over(cs, rows('yyyy', 'y<~y', 'y<>y', 'yyyy'), x0, 2)
    # can simidi
    over(cs, rows(' R9 ', 'R  9', '9  R', ' 9R '), 12, 3)
    vline(cs, 15, '6')
    add_box(f, 'g_body', 'g_cabin', (-7, 12, -8), (7, 22, 8), base='4',
            front=cf, back=over(fill(14, 10, '4'), rows('mmm', 'mym', 'mmm', 'mmm', 'mmm', 'mmm'), 5, 3),
            left=cs, right=mirror_h(cs), top=fill(14, 16, '5'), bottom=fill(14, 16, '5'))
    add_box(f, 'g_body', 'g_roof', (-8, 22, -9), (8, 24, 9), base='L',
            **auto((-8, 22, -9), (8, 24, 9), base='M', top=panel(16, 18, 'L', t='H', b='M', l='H', r='M')))
    lamp(f, 'g_body', 'g_search', (-2.5, 24, 6), (2.5, 28, 9))
    radar(f, 'g_body', 0, 24, -4, 'g_radar', mast=4)
    # baca
    fs = fill(6, 14, 'M')
    hline(fs, 0, 'k')
    hline(fs, 1, 'k')
    hline(fs, 3, '9')
    hline(fs, 4, 'y')
    hline(fs, 5, '9')
    vline(fs, 0, 'L', 2, 14)
    add_box(f, 'g_body', 'g_funnel', (-3, 12, -19), (3, 26, -13), base='M',
            front=[r[:] for r in fs], back=[r[:] for r in fs], left=[r[:] for r in fs], right=[r[:] for r in fs],
            top=rows('kkkkkk', 'k%%%%k', 'k%gg%k', 'k%gg%k', 'k%%%%k', 'kkkkkk'), bottom=fill(6, 6, 'M'))
    # bayrak direği + krem bayrak (atkı)
    add_box(f, 'g_body', 'g_pole', (-0.5, 12, -25), (0.5, 26, -24), base='&',
            **auto((-0.5, 12, -25), (0.5, 26, -24), base='&', top=rows('Y')))
    fl = fill(8, 5, '4')
    over(fl, rows(' yRy ', 'yRWRy', ' yay '), 2, 1)
    hline(fl, 4, '5')
    add_box(f, 'g_flag', 'g_flag', (-0.5, 20, -33), (0.5, 25, -25), base='4',
            left=fl, right=mirror_h(fl), front=fill(1, 5, '4'), back=fill(1, 5, '5'), top=fill(1, 8, '4'),
            bottom=fill(1, 8, '5'))
    # pervane + dümen
    add_box(f, 'g_screw', 'g_screw_v', (-1, -1, -26), (1, 5, -25), base='y',
            **auto((-1, -1, -26), (1, 5, -25), base='y', front=fill(2, 6, 'Y'), top=rows('YY')))
    add_box(f, 'g_screw', 'g_screw_h', (-3, 1, -26), (3, 3, -25), base='y',
            **auto((-3, 1, -26), (3, 3, -25), base='y', front=fill(6, 2, 'Y'), top=fill(6, 1, 'Y')))
    add_box(f, 'g_body', 'g_rudder', (-0.5, 0, -29), (0.5, 6, -26), base='%',
            **auto((-0.5, 0, -29), (0.5, 6, -26), base='%', top=fill(1, 3, '&')))
    # can yelekli sandıklar (güverte yükü)
    for nm, a in (('g_crate1', (-8, 12, 12)), ('g_crate2', (4, 12, 13))):
        b = (a[0] + 4, a[1] + 4, a[2] + 4)
        cr = rows('vvvv', 'vuuv', 'vuuv', 'tttt')
        add_box(f, 'g_body', nm, a, b, base='v', front=cr, back=[r[:] for r in cr], left=[r[:] for r in cr],
                right=[r[:] for r in cr], top=rows('vvvv', 'vttv', 'vttv', 'vvvv'), bottom=fill(4, 4, 't'))
    return f


# ================================================================== DENİZALTI
def denizalti():
    f = Form('denizalti', 'Denizaltı')
    f.bone('d_root', None, (0, 8, -4))
    f.bone('d_body', 'd_root', (0, 8, 0))
    f.bone('d_prop', 'd_body', (0, 8, -37.5))
    f.bone('d_scope', 'd_body', (0, 28, 3.5))
    f.bone('d_plane_l', 'd_body', (-8, 8, -31))
    f.bone('d_plane_r', 'd_body', (8, 8, -31))

    def hull_side(d, h, lit=True):
        g = fill(d, h, 'M')
        for y in range(h):
            for x in range(d):
                if y < h * 0.35:
                    g[y][x] = 'L'
                elif y > h * 0.7:
                    g[y][x] = 'D'
        hline(g, 0, 'H')
        hline(g, h - 1, 'O')
        mid = int(h * 0.5)
        hline(g, mid, '4')
        if lit and d > 20:
            for x in range(6, d - 6, 8):
                over(g, PORT_LIT, x, mid - 4 if mid - 4 >= 1 else 1)
        for x in range(4, d, 6):
            dots(g, [(x, h - 3)], 'H')
        return g
    # gövde: üç kesişen kutu -> yuvarlak kesit
    add_box(f, 'd_body', 'd_core', (-7, 1, -26), (7, 15, 22),
            left=hull_side(48, 14), right=mirror_h(hull_side(48, 14)), top=panel(14, 48, 'L', t='H', b='L', l='H', r='L'),
            bottom=fill(14, 48, 'D'), front=panel(14, 14, 'M'), back=panel(14, 14, 'M'))
    add_box(f, 'd_body', 'd_side', (-8, 3, -24), (8, 13, 20),
            left=hull_side(44, 10), right=mirror_h(hull_side(44, 10)), top=panel(16, 44, 'L'), bottom=fill(16, 44, 'D'),
            front=panel(16, 10, 'M'), back=panel(16, 10, 'M'))
    tp = panel(10, 44, 'L', t='H', b='L', l='H', r='L')
    for y in range(4, 44, 6):
        dots(tp, [(2, y), (7, y)], 'H')
    add_box(f, 'd_body', 'd_topbot', (-5, 0, -24), (5, 16, 20),
            left=hull_side(44, 16, lit=False), right=mirror_h(hull_side(44, 16, lit=False)), top=tp,
            bottom=fill(10, 44, 'O'), front=panel(10, 16, 'M'), back=panel(10, 16, 'M'))
    # burun ve cam kubbe (robotun gözleri içinde)
    add_box(f, 'd_body', 'd_nose', (-6, 2, 22), (6, 14, 26),
            **auto((-6, 2, 22), (6, 14, 26), side=hull_side(4, 12, lit=False),
                   front=over(panel(12, 12, 'y', t='Y', b='Q', l='Y', r='Q'), fill(10, 10, 'M'), 1, 1)))
    dome_f = eyes(10, 10, big=False, frame='y', bg='0')
    add_box(f, 'd_body', 'd_dome', (-5, 3, 26), (5, 13, 30), base='0',
            front=dome_f, left=rows('<<~<', '<<<<', '<<<<', '>><<', '>>>>', '>>>>', '>>>>', '>>>>', '>>>>', '>>>>'),
            right=rows('<~<<', '<<<<', '<<<<', '<<>>', '>>>>', '>>>>', '>>>>', '>>>>', '>>>>', '>>>>'),
            top=rows('~<<<<<<<<~', '<<<<<<<<<<', '<<<<<<<<<<', '<<<<<<<<<<'), bottom=fill(10, 4, '>'),
            back=fill(10, 10, '0'))
    for nm, x0 in (('d_lamp_l', -8), ('d_lamp_r', 5)):
        lamp(f, 'd_body', nm, (x0, 10, 18), (x0 + 3, 13, 21))
    # kuyruk
    add_box(f, 'd_body', 'd_tail', (-6, 2, -32), (6, 14, -26), **auto((-6, 2, -32), (6, 14, -26), side=hull_side(6, 12, lit=False)))
    add_box(f, 'd_body', 'd_tailcone', (-4, 4, -36), (4, 12, -32), **auto((-4, 4, -36), (4, 12, -32), side=hull_side(4, 8, lit=False)))
    add_box(f, 'd_prop', 'd_hub', (-1, 7, -38), (1, 9, -36), base='y', **auto((-1, 7, -38), (1, 9, -36), base='y',
                                                                           top=fill(2, 2, 'Y')))
    add_box(f, 'd_prop', 'd_blade_v', (-1, 1, -38), (1, 15, -37), base='y',
            **auto((-1, 1, -38), (1, 15, -37), base='y', front=fill(2, 14, 'Y'), back=fill(2, 14, 'Q')))
    add_box(f, 'd_prop', 'd_blade_h', (-7, 7, -38), (7, 9, -37), base='y',
            **auto((-7, 7, -38), (7, 9, -37), base='y', front=fill(14, 2, 'Y'), back=fill(14, 2, 'Q')))
    for nm, a, b in (('d_rud_t', (-0.5, 12, -36), (0.5, 21, -30)), ('d_rud_b', (-0.5, -4, -36), (0.5, 4, -30))):
        w, h, d = sz(a, b)
        add_box(f, 'd_body', nm, a, b, **auto(a, b, side=stripe_panel(d, h, 'M', stripe=[h // 2], stripe_c='4')))
    for nm, bone, a, b in (('d_pl_l', 'd_plane_l', (-14, 7.5, -34), (-6, 8.5, -28)),
                           ('d_pl_r', 'd_plane_r', (6, 7.5, -34), (14, 8.5, -28))):
        add_box(f, bone, nm, a, b, **auto(a, b, top=panel(8, 6, 'L', t='H', b='M', l='H', r='M')))
    # kule (yelken): pusula, lumbozlar, üstte kapak
    ks = panel(14, 12, 'M')
    hline(ks, 0, 'y')
    hline(ks, 1, 'H')
    over(ks, COMPASS7, 6, 3)
    over(ks, PORT_LIT, 1, 4)
    hline(ks, 10, '4', 1, 13)
    kt = panel(8, 14, 'L', t='y', b='y', l='y', r='y')
    over(kt, rows(' yyy ', 'ykkky', 'ykkky', 'ykkky', ' yyy '), 1, 5)
    add_box(f, 'd_body', 'd_tower', (-4, 16, -6), (4, 28, 8), left=ks, right=mirror_h(ks), top=kt,
            front=over(panel(8, 12, 'M'), rows('yyyy', 'y<~y', 'y<>y', 'yyyy'), 2, 3), back=panel(8, 12, 'M'),
            bottom=fill(8, 14, 'D'))
    for nm, a, b in (('d_tp_l', (-9, 22, 0), (-4, 23, 5)), ('d_tp_r', (4, 22, 0), (9, 23, 5))):
        add_box(f, 'd_body', nm, a, b, **auto(a, b, top=panel(5, 5, 'L', t='H', b='M', l='H', r='M')))
    # periskop
    add_box(f, 'd_scope', 'd_scope_pole', (-0.5, 28, 3), (0.5, 35, 4), base='&',
            **auto((-0.5, 28, 3), (0.5, 35, 4), base='&', top=rows('*')))
    add_box(f, 'd_scope', 'd_scope_head', (-1, 34, 3), (1, 36, 6), base='&',
            **auto((-1, 34, 3), (1, 36, 6), base='&', front=rows('<~', '>>'), top=fill(2, 3, '*')), glow='')
    radar(f, 'd_body', 0, 28, -4, 'd_radar', mast=3)
    # kule bayrağı (atkı)
    f.bone('d_flag', 'd_body', (2.5, 33, -5.5))
    add_box(f, 'd_body', 'd_flagpole', (2, 28, -6), (3, 34, -5), base='&', **auto((2, 28, -6), (3, 34, -5), base='&',
                                                                                top=rows('Y')))
    fl = fill(6, 3, '4')
    hline(fl, 2, '5')
    dots(fl, [(1, 1)], 'R')
    add_box(f, 'd_flag', 'd_flag', (2, 30, -12), (3, 33, -6), base='4', left=fl, right=mirror_h(fl),
            front=fill(1, 3, '4'), back=fill(1, 3, '5'), top=fill(1, 6, '4'), bottom=fill(1, 6, '5'))
    return f


# ================================================================== ARAZİ ARACI
def arazi():
    f = Form('arazi', 'Arazi Aracı')
    f.bone('a_root', None, (0, 8, 0))
    f.bone('a_body', 'a_root', (0, 8, 0))
    for nm, x, z in (('fl', -13, 14), ('fr', 13, 14), ('bl', -13, -14), ('br', 13, -14)):
        if nm[0] == 'f':
            f.bone('a_steer_' + nm, 'a_root', (x, 6, z))
            f.bone('a_wheel_' + nm, 'a_steer_' + nm, (x, 6, z))
        else:
            f.bone('a_wheel_' + nm, 'a_root', (x, 6, z))
    f.bone('a_flag', 'a_body', (9.5, 30, -16.5))
    # tekerlekler (iki kesişen kutu = yuvarlak)
    for nm, x, z in (('fl', -13, 14), ('fr', 13, 14), ('bl', -13, -14), ('br', 13, -14)):
        x0 = x - 3
        bone = 'a_wheel_' + nm
        core_side = tire_side(8, 12)
        cross_side = tire_side(12, 8)
        add_box(f, bone, 'a_tire_' + nm, (x0, 0, z - 4), (x0 + 6, 12, z + 4), base='k',
                front=tread(6, 12, 'v'), back=tread(6, 12, 'v'), left=core_side, right=mirror_h(core_side),
                top=tread(6, 8, 'v'), bottom=tread(6, 8, 'v'))
        add_box(f, bone, 'a_tire2_' + nm, (x0, 2, z - 6), (x0 + 6, 10, z + 6), base='k',
                front=tread(6, 8, 'v'), back=tread(6, 8, 'v'), left=cross_side, right=mirror_h(cross_side),
                top=tread(6, 12, 'v'), bottom=tread(6, 12, 'v'))
    # v0.3.6: tırmanma tutucuları: tekerleklerin sırtında düz (||||) duran, kabarık, mavi parlayan 3B çubuklar
    # (her tekerleğin üst, alt, ön ve arka yüzünde üçer paralel çubuk; Tırmanma Modu açılınca görünür, kesif_oyun.py 'tutucu')
    for nm, x, z in (('fl', -13, 14), ('fr', 13, 14), ('bl', -13, -14), ('br', 13, -14)):
        bone = 'a_tut_' + nm
        f.bone(bone, 'a_wheel_' + nm, (x, 6, z))
        uc = rows('~')
        yuzler = (('u', (x, 12.5, z), 'Y'), ('a', (x, -0.5, z), 'Y'), ('o', (x, 6, z + 6.5), 'Z'), ('b', (x, 6, z - 6.5), 'Z'))
        for yz, (cx, cy, cz), eksen in yuzler:
            # |||| : lastiğin enine düz, yuvarlanma yönünde yan yana üç çubuk; boyu lastik kalınlığından (6) biraz kısa (5)
            for k, ofs in enumerate((-2.6, 0, 2.6)):
                bn = f'a_tut_{nm}_{yz}{k}'
                px, py, pz = (cx, cy, cz + ofs) if eksen == 'Y' else (cx, cy + ofs, cz)
                f.bone(bn, bone, (px, py, pz))
                aa, bb = (px - 2.5, py - 0.5, pz - 0.5), (px + 2.5, py + 0.5, pz + 0.5)
                add_box(f, bn, bn, aa, bb, base='<', glow='<~',
                        front=rows('~<<<~'), back=rows('~<<<~'), top=rows('~<<<~'), bottom=rows('~<<<~'),
                        left=uc, right=rows('~'))
    # gövde
    bs = stripe_panel(36, 8, 'M', stripe=[2], stripe_c='y', seams=(11, 23))
    over(bs, COMPASS7, 14, 1)
    dots(bs, [(21, 4), (9, 4)], 'Q')
    bt = panel(20, 36, 'L', t='H', b='M', l='H', r='M')
    for y in range(4, 22):
        for x in range(3, 17):
            bt[y][x] = 'm' if x in (9, 10) else 'o'
    bf = fill(20, 8, 'M')
    hline(bf, 0, 'H')
    for y in range(2, 7):
        for x in range(6, 14):
            bf[y][x] = 'k' if x % 2 else '%'
    over(bf, LAMP, 0, 2)
    over(bf, LAMP, 15, 2)
    add_box(f, 'a_body', 'a_tub', (-10, 5, -18), (10, 13, 18), left=bs, right=mirror_h(bs), top=bt,
            front=bf, back=over(panel(20, 8, 'M'), rows('R  R', 'r  r'), 2, 2), bottom=fill(20, 36, 'D'), glow='$#!')
    ht = panel(18, 12, 'L', t='H', b='M', l='H', r='M')
    for x in (5, 9, 13):
        vline(ht, x, 'M', 3, 9)
    add_box(f, 'a_body', 'a_hood', (-9, 13, 6), (9, 15, 18), **auto((-9, 13, 6), (9, 15, 18), top=ht))
    # çamurluklar
    for nm, x0, z0 in (('fl', -17, 7), ('fr', 10, 7), ('bl', -17, -21), ('br', 10, -21)):
        a, b = (x0, 12, z0), (x0 + 7, 13, z0 + 14)
        add_box(f, 'a_body', 'a_fender_' + nm, a, b, base='D', **auto(a, b, base='D', top=panel(7, 14, 'M')))
    # tampon + vinç
    bump = fill(22, 3, '&')
    hline(bump, 0, '*')
    hline(bump, 2, '%')
    over(bump, rows('yyyy', 'yQQy', 'yyyy'), 9, 0)
    add_box(f, 'a_body', 'a_bumper', (-11, 3, 18), (11, 6, 21), base='&',
            **auto((-11, 3, 18), (11, 6, 21), base='&', front=bump, top=fill(22, 3, '*')))
    # ön cam = robot yüzü
    add_box(f, 'a_body', 'a_face', (-9, 15, 4), (9, 23, 6), front=eyes(18, 8, big=True, frame='y'),
            **{k: v for k, v in auto((-9, 15, 4), (9, 23, 6), base='y').items() if k != 'front'})
    # deri koltuklar
    for nm, x0 in (('a_seat_l', -8), ('a_seat_r', 2)):
        sb = fill(6, 7, 'o')
        hline(sb, 0, '7')
        vline(sb, 0, '7')
        add_box(f, 'a_body', nm, (x0, 13, -8), (x0 + 6, 20, -6), base='o',
                **auto((x0, 13, -8), (x0 + 6, 20, -6), base='o', front=sb, back=fill(6, 7, 'm'), top=fill(6, 2, '7'),
                       side=fill(2, 7, 'o')))
    # takla kafesi + ışık barı
    for nm, a, b in (('a_post_bl', (-9, 13, -14), (-8, 24, -13)), ('a_post_br', (8, 13, -14), (9, 24, -13)),
                     ('a_post_fl', (-9, 23, -13), (-8, 24, 5)), ('a_post_fr', (8, 23, -13), (9, 24, 5)),
                     ('a_bar_b', (-8, 23, -14), (8, 24, -13)), ('a_bar_f', (-8, 23, 4), (8, 24, 5))):
        add_box(f, 'a_body', nm, a, b, base='&', **auto(a, b, base='&', top=fill(*sz(a, b)[::2], '*')))
    lb = fill(14, 2, 'y')
    for x0 in range(1, 13, 3):
        dots(lb, [(x0, 0), (x0 + 1, 0), (x0, 1), (x0 + 1, 1)], '$')
    add_box(f, 'a_body', 'a_rack', (-8, 23, -13), (8, 24, 4), base='v',
            **auto((-8, 23, -13), (8, 24, 4), base='v', top=deck(16, 17), bottom=fill(16, 17, 't')))
    add_box(f, 'a_body', 'a_lightbar', (-7, 24, 3), (7, 26, 5), base='y', glow='$',
            **auto((-7, 24, 3), (7, 26, 5), base='y', front=lb, top=fill(14, 2, 'Y')))
    radar(f, 'a_body', 0, 24, -13.5, 'a_radar', mast=2)
    # yedek lastik + bidon + anten bayrağı
    add_box(f, 'a_body', 'a_spare', (-5, 6, -21), (5, 16, -18), base='k',
            back=tire_side(10, 10), front=fill(10, 10, 'k'), left=tread(3, 10, 'v'), right=tread(3, 10, 'v'),
            top=tread(10, 3), bottom=tread(10, 3))
    jc = rows('rrr', 'RRr', 'rrr', 'rqr', 'qqq')
    add_box(f, 'a_body', 'a_jerry', (-10, 13, -18), (-7, 18, -15), base='r',
            **auto((-10, 13, -18), (-7, 18, -15), base='r', front=jc, back=jc, side=jc, top=rows('rRr', 'rrr', 'rrr')))
    add_box(f, 'a_body', 'a_whip', (9, 13, -17), (10, 31, -16), base='%',
            **auto((9, 13, -17), (10, 31, -16), base='%', top=rows('Y')))
    fl = fill(6, 3, '4')
    hline(fl, 2, '5')
    dots(fl, [(1, 1)], 'R')
    add_box(f, 'a_flag', 'a_flag', (9, 27, -23), (10, 30, -17), base='4', left=fl, right=mirror_h(fl),
            front=fill(1, 3, '4'), back=fill(1, 3, '5'), top=fill(1, 6, '4'), bottom=fill(1, 6, '5'))
    return f


# ================================================================== MATKAPLI MAKİNE
def matkap():
    f = Form('matkap', 'Matkaplı Makine')
    f.bone('m_root', None, (0, 9, 6))
    f.bone('m_body', 'm_root', (0, 9, 0))
    f.bone('m_drill', 'm_body', (0, 11, 13))
    for side, x in (('l', -16.5), ('r', 16.5)):
        for i, z in enumerate((-12, -2, 8)):
            f.bone(f'm_rw_{side}{i}', 'm_root', (x, 4.5, z))
    # paletler
    for nm, x0 in (('m_track_l', -16), ('m_track_r', 9)):
        ts = fill(34, 9, 'K')
        hline(ts, 0, 'g')
        hline(ts, 8, 'g')
        for x in range(0, 34, 2):
            ts[0][x] = 'k'
            ts[8][x] = 'k'
        add_box(f, 'm_body' if False else 'm_root', nm, (x0, 0, -18), (x0 + 7, 9, 16), base='k',
                left=ts, right=mirror_h(ts), front=tread(7, 9, 'v'), back=tread(7, 9, 'v'), top=tread(7, 34, 'v'),
                bottom=tread(7, 34, 'v'))
    # palet tekerlekleri (döner)
    for side, x0 in (('l', -17), ('r', 16)):
        for i, z in enumerate((-12, -2, 8)):
            tw = tire_side(7, 7, hub='y')
            add_box(f, f'm_rw_{side}{i}', f'm_rw_{side}{i}', (x0, 1, z - 3.5), (x0 + 1, 8, z + 3.5), base='&',
                    left=tw, right=mirror_h(tw), front=fill(1, 7, '%'), back=fill(1, 7, '%'), top=fill(1, 7, '&'),
                    bottom=fill(1, 7, '%'))
    # gövde: içi boş (v0.3.1). Duvarlar, taban, tavan ayrı kutular; arkada küçük giriş kapısı, içeride 4 robot yeri
    hs = stripe_panel(26, 15, 'M', stripe=[2], stripe_c='y', seams=(8, 17), rivets=True)
    over(hs, COMPASS7, 10, 5)
    iw = fill(26, 14, 'D')                                    # iç duvar: koyu levha, boru, lamba
    hline(iw, 2, '&')
    hline(iw, 3, '%')
    for x in (4, 12, 20):
        vline(iw, x, '%', 4, 14)
    for x in (8, 16):
        over(iw, rows('yYy', 'Y$Y', 'yYy'), x - 1, 6)
    hline(iw, 13, 'k')
    add_box(f, 'm_body', 'm_floor', (-9, 4, -16), (9, 5, 10), base='M',
            top=tread(18, 26, 'v'), bottom=fill(18, 26, 'D'), front=fill(18, 1, 'M'), back=fill(18, 1, 'M'),
            left=fill(26, 1, 'M'), right=fill(26, 1, 'M'))
    for nm, x0, dis, ic in (('m_wall_l', -9, 'left', 'right'), ('m_wall_r', 8, 'right', 'left')):
        faces = {'top': fill(1, 26, 'H'), 'bottom': fill(1, 26, 'D'), 'front': fill(1, 14, 'M'), 'back': fill(1, 14, 'M')}
        faces[dis] = [r[:] for r in hs][1:] if dis == 'left' else mirror_h(hs)[1:]
        faces[ic] = [r[:] for r in iw] if ic == 'right' else mirror_h(iw)
        add_box(f, 'm_body', nm, (x0, 5, -16), (x0 + 1, 19, 10), base='M', glow='$', **faces)
    hf = panel(16, 14, 'M')
    over(hf, hazard(16, 3), 0, 11)
    con = fill(16, 14, 'D')                                   # ön iç duvar: radar ekranı ve göstergeler
    over(con, rows('kkkkkkkkkk', 'k<~<<<<<~k', 'k<<~<<~<<k', 'k<<<~~<<<k', 'k<<~<<~<<k', 'k<~<<<<<~k',
                   'kkkkkkkkkk'), 3, 1)
    over(con, rows('R y f R y f'), 2, 10)
    add_box(f, 'm_body', 'm_wall_f', (-8, 5, 9), (8, 19, 10), base='M', glow='<~Ryf',
            front=hf, back=con, top=fill(16, 1, 'H'), bottom=fill(16, 1, 'D'), left=fill(1, 14, 'M'), right=fill(1, 14, 'M'))
    ce = fill(18, 26, 'D')                                    # tavan: ortada lamba şeridi
    vline(ce, 8, '$', 3, 23)
    vline(ce, 9, '#', 3, 23)
    add_box(f, 'm_body', 'm_ceil', (-9, 19, -16), (9, 20, 10), base='M', glow='$#',
            top=panel(18, 26, 'L', t='H', b='M', l='H', r='M'), bottom=ce, front=fill(18, 1, 'M'), back=fill(18, 1, 'M'),
            left=fill(26, 1, 'M'), right=fill(26, 1, 'M'))
    # arka duvar: ortada 8x11 kapı boşluğu, çevresinde tehlike şeritli çerçeve
    bw = panel(4, 14, 'M')
    for nm, x0 in (('m_back_l', -8), ('m_back_r', 4)):
        add_box(f, 'm_body', nm, (x0, 5, -16), (x0 + 4, 19, -15), base='M',
                back=[r[:] for r in bw], front=fill(4, 14, 'D'), top=fill(4, 1, 'H'), bottom=fill(4, 1, 'D'),
                left=fill(1, 14, 'D'), right=fill(1, 14, 'D'))
    add_box(f, 'm_body', 'm_back_t', (-4, 16, -16), (4, 19, -15), base='M',
            back=over(panel(8, 3, 'M'), rows('kRk'), 3, 1), front=fill(8, 3, 'D'), top=fill(8, 1, 'H'),
            bottom=fill(8, 1, 'D'), left=fill(1, 3, 'D'), right=fill(1, 3, 'D'))
    for nm, a, b in (('m_door_l', (-5, 5, -17), (-4, 17, -16)), ('m_door_r', (4, 5, -17), (5, 17, -16)),
                     ('m_door_t', (-5, 16, -17), (5, 17, -16))):
        w, h, d = sz(a, b)
        add_box(f, 'm_body', nm, a, b, base='y', **auto(a, b, base='y', front=hazard(w, h), back=hazard(w, h),
                                                       side=hazard(d, h), top=hazard(w, d)))
    lamp(f, 'm_body', 'm_door_lamp', (-1, 17, -17), (1, 18, -16), facing='back')
    # kapı kanadı: robot binmişken açık, yalnız oyuncu binince ya da Keşif tek gidince kapanır (aqualit:kapi)
    f.bone('m_door', 'm_body', (-4, 5, -16))
    dd = panel(8, 11, 'M')
    over(dd, PORT, 2, 2)
    dots(dd, [(6, 7)], 'y')
    hline(dd, 10, 'D')
    add_box(f, 'm_door', 'm_door', (-4, 5, -16), (4, 16, -15), base='M', glow='',
            back=dd, front=over(fill(8, 11, 'D'), rows('  y'), 4, 6), top=fill(8, 1, 'H'), bottom=fill(8, 1, 'D'),
            left=fill(1, 11, 'D'), right=fill(1, 11, 'D'))
    # arka platform: tabanla aynı yükseklikte güverte, köprü, korkuluk, küçük tekerlekler
    add_box(f, 'm_root', 'm_bridge', (-9, 3, -18), (9, 5, -16), base='M', top=deck(18, 2),
            **{k: v for k, v in auto((-9, 3, -18), (9, 5, -16), base='M').items() if k != 'top'})
    add_box(f, 'm_root', 'm_deck', (-15, 3, -35), (15, 5, -18), base='M',
            top=deck(30, 17), **{k: v for k, v in auto((-15, 3, -35), (15, 5, -18), base='M',
                                                        side=stripe_panel(17, 2, 'M'), front=hazard(30, 2),
                                                        back=hazard(30, 2)).items() if k != 'top'})
    for nm, a, b, ax in (('m_rail_l', (-15, 5, -35), (-14, 11, -18), 'x'), ('m_rail_r', (14, 5, -35), (15, 11, -18), 'x'),
                         ('m_rail_b', (-14, 5, -35), (14, 11, -34), 'z')):
        w, h, d = sz(a, b)
        n = d if ax == 'x' else w
        g = rail(n, h, post_every=4)
        faces = {'top': fill(w, d, 'y'), 'bottom': [[' '] * w for _ in range(d)]}
        if ax == 'x':
            faces.update(left=g, right=mirror_h(g), front=fill(1, h, 'y'), back=fill(1, h, 'y'))
        else:
            faces.update(front=g, back=mirror_h(g), left=fill(1, h, 'y'), right=fill(1, h, 'y'))
        add_box(f, 'm_root', nm, a, b, base='y', **faces)
    for nm, x0 in (('m_caster_l', -13), ('m_caster_r', 10)):
        tw = tire_side(3, 3, hub='y')
        add_box(f, 'm_root', nm, (x0, 0, -33), (x0 + 3, 3, -30), base='k', left=tw, right=mirror_h(tw),
                front=tread(3, 3, 'v'), back=tread(3, 3, 'v'), top=tread(3, 3, 'v'), bottom=tread(3, 3, 'v'))
    # matkap yuvası (sabit halka)
    col = panel(16, 16, '&', t='*', b='%', l='*', r='%')
    for y in range(16):
        for x in range(16):
            if 3 <= x <= 12 and 3 <= y <= 12:
                col[y][x] = 'y' if (x in (3, 12) or y in (3, 12)) else '%'
    add_box(f, 'm_body', 'm_collar', (-8, 3, 10), (8, 19, 13), base='&',
            **auto((-8, 3, 10), (8, 19, 13), base='&', front=col, side=fill(3, 16, '&'), top=fill(16, 3, '*')))
    add_box(f, 'm_body', 'm_collar_top', (-8, 19, 10), (8, 21, 12), base='&',
            **auto((-8, 19, 10), (8, 21, 12), base='&', top=fill(16, 2, '*')))

    def flute(w, h, phase=0, edge='H'):
        g = fill(w, h, '*')
        for y in range(h):
            for x in range(w):
                k = (x + y + phase) % 5
                if k == 0:
                    g[y][x] = edge
                elif k == 1:
                    g[y][x] = 'L'
                elif k == 2:
                    g[y][x] = 'M'
                elif k == 4:
                    g[y][x] = '+'
        return g
    for i, (a, b) in enumerate((((-7, 4, 13), (7, 18, 17)), ((-5, 6, 17), (5, 16, 21)),
                                ((-3, 8, 21), (3, 14, 25)), ((-1.5, 9.5, 25), (1.5, 12.5, 28)))):
        w, h, d = sz(a, b)
        add_box(f, 'm_drill', f'm_bit{i}', a, b, base='*',
                front=flute(w, h, i), back=fill(w, h, '&'), left=flute(d, h, i + 1), right=flute(d, h, i + 2),
                top=flute(w, d, i + 3), bottom=flute(w, d, i))
    add_box(f, 'm_drill', 'm_tip', (-0.5, 10.5, 28), (0.5, 11.5, 31), base='H',
            **auto((-0.5, 10.5, 28), (0.5, 11.5, 31), base='H', front=rows('W'), top=fill(1, 3, 'W')))
    # kabin = robot yüzü, deri tavan
    add_box(f, 'm_body', 'm_cabin', (-6, 20, -10), (6, 29, 2), front=eyes(12, 9, big=False, frame='M'),
            **{k: v for k, v in auto((-6, 20, -10), (6, 29, 2), side=over(panel(12, 9, 'M'), rows('yyyy', 'y<~y', 'y<>y', 'yyyy'), 4, 2)).items()
               if k != 'front'})
    rt = fill(13, 13, 'o')
    hline(rt, 0, '7')
    vline(rt, 0, '7')
    vline(rt, 6, 'm')
    add_box(f, 'm_body', 'm_roof', (-6.5, 29, -10.5), (6.5, 31, 2.5), base='o',
            **auto((-6.5, 29, -10.5), (6.5, 31, 2.5), base='o', top=rt,
                   side=rows('7777777777777', 'ooooooooooooo'), front=rows('7777777777777', 'ooooooooooooo'),
                   back=rows('7777777777777', 'ooooooooooooo')))
    for nm, x0 in (('m_lamp_l', -6), ('m_lamp_r', 3)):
        lamp(f, 'm_body', nm, (x0, 31, -1), (x0 + 3, 34, 2))
    radar(f, 'm_body', 0, 31, -7, 'm_radar', mast=2)
    # egzoz bacaları
    for nm, x0 in (('m_exh_l', -8), ('m_exh_r', 5)):
        es = fill(3, 10, '&')
        hline(es, 0, 'k')
        hline(es, 3, 'y')
        hline(es, 7, 'y')
        add_box(f, 'm_body', nm, (x0, 20, -16), (x0 + 3, 30, -13), base='&',
                front=[r[:] for r in es], back=[r[:] for r in es], left=[r[:] for r in es], right=[r[:] for r in es],
                top=rows('kkk', 'kgk', 'kkk'), bottom=fill(3, 3, '%'))
    # sürücü koltuğu: kabinin arkasında, gövdenin üstünde (sırt dayanağı)
    sb = fill(6, 5, 'o')
    hline(sb, 0, '7')
    add_box(f, 'm_body', 'm_seat', (-3, 20, -17), (3, 25, -15), base='o',
            **auto((-3, 20, -17), (3, 25, -15), base='o', front=sb, back=fill(6, 5, 'm'), top=fill(6, 2, '7'),
                   side=fill(2, 5, 'o')))
    return f


ALL = [ucak, gemi, denizalti, arazi, matkap]
