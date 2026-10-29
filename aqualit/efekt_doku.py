#!/usr/bin/env python3
"""Kılıçlı güç efektleri için dokular (parçacık atlası, kubbe, zincir, hayalet).

dokular/aqualit_fx.png    64x64 parçacık atlası
  (0,0)-(32,32)   şimşek parçası, 4 kare (32x8, titreme)
  (32,0)-(48,8)   kıvılcım yıldızı, 2 kare (8x8)
  (48,0)-(64,16)  parlama (yumuşak ışık)
  (32,16)-(48,32) duman topu
  (0,32)-(32,64)  şok dalgası halkası
  (32,32)-(40,40) altıgen pırıltı
  (40,32)-(56,48) enerji halkası (ince)
  (32,48)-(64,64) elektrikli zincir şeridi, 2 kare (32x8)
dokular/fx_kubbe.png      64x64 altıgen enerji kalkanı (yarı saydam)
dokular/fx_zincir.png     16x16 elektrikli zincir halkaları
dokular/fx_hayalet1..3.png  Kılıçlı derisinin turkuaz, gittikçe silinen hayalet sürümü (gölge adım izi)
"""
import math
import os
import random

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
DOK = os.path.join(HERE, 'dokular')
TQ = np.array([64, 230, 210], float)
TQ2 = np.array([30, 170, 255], float)
WHITE = np.array([245, 255, 255], float)


def rgba(arr):
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')


def glow_line(w, h, pts, core=1.0, halo=2.6, seed=0):
    """pts boyunca parlak çekirdekli, turkuaz haleli çizgi (RGBA)."""
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    d = np.full((h, w), 1e9)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        vx, vy = x1 - x0, y1 - y0
        L2 = vx * vx + vy * vy or 1
        t = np.clip(((xx + 0.5 - x0) * vx + (yy + 0.5 - y0) * vy) / L2, 0, 1)
        px, py = x0 + t * vx, y0 + t * vy
        d = np.minimum(d, np.hypot(xx + 0.5 - px, yy + 0.5 - py))
    c = np.clip(1 - d / core, 0, 1)
    g = np.exp(-(d / halo) ** 2)
    col = WHITE[None, None, :] * c[..., None] + TQ[None, None, :] * (1 - c[..., None])
    a = np.clip(c + g * 0.85, 0, 1) * 255
    return np.dstack([col, a])


def atlas():
    rng = random.Random(4)
    A = np.zeros((64, 64, 4))
    # şimşek parçası: 4 kare, her biri farklı zikzak
    for f in range(4):
        pts = [(0, 4)]
        for x in range(4, 32, 4):
            pts.append((x, 4 + rng.uniform(-2.2, 2.2)))
        pts.append((32, 4))
        A[f * 8:f * 8 + 8, 0:32] = glow_line(32, 8, pts, core=0.9, halo=1.8)
    # kıvılcım yıldızı (2 kare)
    for f in range(2):
        yy, xx = np.mgrid[0:8, 0:8].astype(float)
        cx = cy = 3.5
        r = np.hypot(xx - cx, yy - cy)
        ang = np.arctan2(yy - cy, xx - cx)
        star = np.clip(1 - r / (1.2 + 2.4 * np.abs(np.cos(2 * ang + f * 0.8)) ** 6), 0, 1)
        col = WHITE * star[..., None] + TQ * (1 - star[..., None])
        A[0:8, 32 + f * 8:40 + f * 8] = np.dstack([col, star * 255])
    # parlama
    yy, xx = np.mgrid[0:16, 0:16].astype(float)
    r = np.hypot(xx - 7.5, yy - 7.5) / 7.5
    g = np.clip(1 - r, 0, 1) ** 2
    A[0:16, 48:64] = np.dstack([WHITE * g[..., None] + TQ * (1 - g[..., None]), g * 255])
    # duman topu
    yy, xx = np.mgrid[0:16, 0:16].astype(float)
    r = np.hypot(xx - 7.5, yy - 7.5) / 7.5
    n = np.array([[rng.random() for _ in range(16)] for _ in range(16)])
    sm = np.clip((1 - r) * 1.2 - n * 0.35, 0, 1)
    smoke = np.array([20, 70, 66], float)
    A[16:32, 32:48] = np.dstack([np.broadcast_to(smoke, (16, 16, 3)), sm * 200])
    # şok dalgası halkası
    yy, xx = np.mgrid[0:32, 0:32].astype(float)
    r = np.hypot(xx - 15.5, yy - 15.5) / 15.5
    ring = np.exp(-((r - 0.82) / 0.07) ** 2) + 0.35 * np.exp(-((r - 0.62) / 0.12) ** 2)
    ring = np.clip(ring, 0, 1)
    A[32:64, 0:32] = np.dstack([WHITE * ring[..., None] ** 2 + TQ * (1 - ring[..., None] ** 2), ring * 255])
    # altıgen pırıltı
    yy, xx = np.mgrid[0:8, 0:8].astype(float)
    hx = np.maximum(np.abs(xx - 3.5) * 0.866 + np.abs(yy - 3.5) * 0.5, np.abs(yy - 3.5))
    h = np.clip(1 - np.abs(hx - 2.6) / 0.9, 0, 1)
    A[32:40, 32:40] = np.dstack([WHITE * h[..., None] + TQ * (1 - h[..., None]), h * 255])
    # ince enerji halkası
    yy, xx = np.mgrid[0:16, 0:16].astype(float)
    r = np.hypot(xx - 7.5, yy - 7.5) / 7.5
    ring = np.clip(np.exp(-((r - 0.85) / 0.08) ** 2), 0, 1)
    A[32:48, 40:56] = np.dstack([TQ2 * (1 - ring[..., None]) + WHITE * ring[..., None], ring * 230])
    # elektrikli zincir şeridi: 2 kare (32x8), halkalar yatay dizilir (uzun eksen = parçacık yönü)
    steel = np.array([170, 215, 220], float)
    yy, xx = np.mgrid[0:8, 0:32].astype(float)
    for f in range(2):
        m = np.zeros((8, 32))
        for cx in (4, 20):          # önden görünen oval halkalar
            r = np.hypot((xx + 0.5 - cx) / 4.6, (yy + 0.5 - 4) / 2.9)
            m = np.maximum(m, np.clip(1 - np.abs(r - 0.82) / 0.2, 0, 1))
        for cx in (12, 28):         # yandan görünen halkalar (çubuk)
            m = np.maximum(m, np.clip(1 - np.abs(yy + 0.5 - 4) / 0.9, 0, 1) * (np.abs(xx + 0.5 - cx) < 4.6))
        glow = np.exp(-((yy + 0.5 - 4) / 2.6) ** 2) * (0.35 if f == 0 else 0.6)
        if f == 1:                  # 2. kare: ortadan geçen kıvılcım çizgisi
            pts = [(0, 4)] + [(x, 4 + rng.uniform(-1.6, 1.6)) for x in range(3, 32, 3)] + [(32, 4)]
            arc = glow_line(32, 8, pts, core=0.7, halo=1.2)
            m = np.maximum(m, arc[..., 3] / 255 * 0.9)
        col = steel * m[..., None] + TQ * (1 - m[..., None])
        A[48 + f * 8:56 + f * 8, 32:64] = np.dstack([col, np.clip(m + glow, 0, 1) * 255])
    return rgba(A)


def kubbe():
    """Altıgen petek kalkan: kenarlar parlak, iç kısım hafif."""
    W = 64
    yy, xx = np.mgrid[0:W, 0:W].astype(float)
    s = 8.0
    # altıgen ızgara: eksenel koordinatlara çevir
    q = (xx * math.sqrt(3) / 3 - yy / 3) / s
    r = (yy * 2 / 3) / s
    x, z = q, r
    y = -x - z
    rx, ry, rz = np.round(x), np.round(y), np.round(z)
    dx, dy, dz = np.abs(rx - x), np.abs(ry - y), np.abs(rz - z)
    fx = np.where((dx > dy) & (dx > dz), -ry - rz, rx)
    fz = np.where(~((dx > dy) & (dx > dz)) & ~(dy > dz), -rx - ry, rz)
    cx = s * math.sqrt(3) * (fx + fz / 2)
    cy = s * 1.5 * fz
    dd = np.hypot(xx - cx, yy - cy) / s
    edge = np.clip((dd - 0.62) / 0.3, 0, 1)
    a = 55 + 170 * edge ** 2
    col = TQ[None, None, :] * (1 - edge[..., None]) + WHITE[None, None, :] * edge[..., None] ** 3
    return rgba(np.dstack([col, a]))


def zincir():
    """16x16 dikey tekrarlayan zincir halkası + elektrik parıltısı."""
    A = np.zeros((16, 16, 4))
    steel = np.array([150, 205, 210], float)
    yy, xx = np.mgrid[0:16, 0:16].astype(float)
    # oval halka (dikey) + yan görünen halka (yatay çubuk)
    r1 = np.hypot((xx - 7.5) / 3.2, (yy - 4.5) / 4.5)
    ring1 = np.clip(1 - np.abs(r1 - 0.85) / 0.22, 0, 1)
    bar = np.clip(1 - np.abs(xx - 7.5) / 1.1, 0, 1) * ((yy > 9) & (yy < 15))
    m = np.maximum(ring1, bar)
    glow = np.exp(-((xx - 7.5) / 4.0) ** 2) * 0.55
    col = steel * m[..., None] + TQ * (1 - m[..., None])
    a = np.clip(m + glow, 0, 1) * 255
    A[:] = np.dstack([col, a])
    return rgba(A)


def hayalet(src, dst_dir):
    """Kılıçlı derisinden 3 karelik, gittikçe silinen turkuaz hayalet dokuları."""
    im = Image.open(src).convert('RGBA')
    a = np.asarray(im, float)
    lum = a[..., :3].mean(axis=2, keepdims=True) / 255
    col = TQ * (0.55 + 0.45 * lum) + WHITE * 0.15 * lum
    os.makedirs(dst_dir, exist_ok=True)
    for i, alpha in enumerate((150, 95, 45)):
        al = (a[..., 3] > 0) * alpha
        rgba(np.dstack([col, al])).save(os.path.join(dst_dir, f'fx_hayalet{i + 1}.png'))


def build(particle_dir=DOK, entity_dir=DOK, robot_tex_dir=None):
    os.makedirs(particle_dir, exist_ok=True)
    os.makedirs(entity_dir, exist_ok=True)
    atlas().save(os.path.join(particle_dir, 'aqualit_fx.png'))
    kubbe().save(os.path.join(entity_dir, 'fx_kubbe.png'))
    if robot_tex_dir:
        hayalet(os.path.join(robot_tex_dir, 'kilicli_4.png'), entity_dir)


if __name__ == '__main__':
    import sys
    build(DOK, DOK, sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'addon', 'out', 'Aqualit_RP', 'textures', 'entity', 'aqualit_robot'))
    big = Image.new('RGBA', (64 * 3 * 4, 64 * 4), (20, 26, 30, 255))
    for i, n in enumerate(['aqualit_fx', 'fx_kubbe', 'fx_zincir']):
        im = Image.open(os.path.join(DOK, n + '.png')).convert('RGBA')
        im = im.resize((im.width * 4 if im.width == 64 else 256, 256), Image.NEAREST)
        big.alpha_composite(im, (i * 256, 0))
    big.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tmp', 'fx_dokular.png'))
    print('ok')
