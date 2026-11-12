"""Kılıçlı güç efektleri (v0.5.0): 51 gücün her birine özel bir 3D ve bir 2D efekt.

3D: tek varlık aqualit:guc_fx, tamsayı özellik aqualit:fx (0-50) hangi geometrinin çizileceğini seçer. Her efekt
çubuklardan yapılır: içte TAM OPAK parlak çubuk, etrafında YARI SAYDAM daha koyu kılıf (parlama). Dönen parçalar
'don' kemiğinde. Renkler küçük bir palet dokusundan (her güce 4 piksel: çekirdek, kılıf, vurgu çekirdek, vurgu kılıf).
2D: her güce 32x32 bir parçacık resmi (atlas) ve kendine göre bir parçacık hareketi (patlama, halka, ışın, yükselme...).
Önizlemeler: onizleme/guc_3d.gif|png, onizleme/guc_2d.gif|png (önizleme bu dosyadaki çubuk listesinden çizilir).
"""
import json
import math
import os
import random

from PIL import Image, ImageDraw, ImageFont

try:
    YAZI = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 10)
except OSError:
    YAZI = None

GUCLER = [("kanca", "Elektrik kancası"), ("yildirim_kilici", "Yıldırım kılıcı"), ("golge_adim", "Gölge adım"),
          ("kubbe", "Elektrik kubbe"), ("gok_gurultusu", "Gök gürültüsü"), ("duvar_kosusu", "Duvar koşusu"),
          ("uzun_ucus", "Uzun uçuş"), ("ayna_klonlari", "Ayna klonları"), ("zaman_yavaslatma", "Zaman yavaşlatma"),
          ("zaman_durdurma", "Zaman durdurma"), ("geri_sarma", "Geri sarma"), ("yildirim_firtinasi", "Yıldırım fırtınası"),
          ("plazma_lazeri", "Plazma lazeri"), ("enerji_kuresi", "Enerji küresi"), ("kara_delik", "Kara delik"),
          ("yercekimi", "Yerçekimi kontrolü"), ("manyetik_firtina", "Manyetik fırtına"), ("gorunmezlik", "Görünmezlik"),
          ("meteor_dalisi", "Meteor dalışı"), ("deprem", "Deprem darbesi"), ("nano_onarim", "Nano onarım"),
          ("kalkan_uydulari", "Kalkan uyduları"), ("son_form", "Son form"), ("klon_firtinasi", "Klon fırtınası"),
          ("faz_gecisi", "Faz geçişi"), ("dron_surusu", "Drone sürüsü"), ("roket_yumruk", "Roket yumruk"),
          ("kalkan_firlatma", "Kalkan fırlatma"), ("kilic_kasirgasi", "Kılıç kasırgası"), ("bumerang_kilic", "Bumerang kılıç"),
          ("hayalet_adimlar", "Hayalet adımlar"), ("seken_basis", "Seken basış zinciri"), ("yapisik_saldiri", "Yapışık saldırı"),
          ("elektrik_agi", "Elektrik ağı"), ("enerji_kanatlari", "Enerji kanatları"), ("isik_kilici", "Işık kılıcı formu"),
          ("yansitici_zirh", "Yansıtıcı zırh"), ("portal_kapisi", "Portal kapısı"), ("savas_analizi", "Savaş analizi"),
          ("taktik_gorus", "Taktik görüş"), ("nanobot_surusu", "Nanobot sürüsü"), ("nanobot_gorusu", "Nanobot görüşü"),
          ("nanobot_isirigi", "Nanobot ısırığı"), ("nanobot_bulutu", "Nanobot bulutu"), ("nanobot_zirhi", "Nanobot zırhı"),
          ("akilli_karsilik", "Akıllı karşılık"), ("savas_ogrenmesi", "Savaş öğrenmesi"), ("emp_darbesi", "EMP darbesi"),
          ("yildiz_kiliclari", "Yıldız kılıçları"), ("dev_form", "Dev form"), ("mod101", "%101 modu")]

# güç -> (biçim, ana renk, vurgu renk, ayarlar, 2D hareket)
T = {
    "kanca": ("zincir", "#33e6ff", "#ffffff", {}, "isin"),
    "yildirim_kilici": ("kilic", "#7fd8ff", "#fff27a", {"simsek": 1}, "patlama"),
    "golge_adim": ("portal", "#5a2a8a", "#c79bff", {"r": 9}, "yukari"),
    "kubbe": ("kubbe", "#3ef0ff", "#d8ffff", {"r": 28}, "halka"),
    "gok_gurultusu": ("simsek", "#ffe14a", "#ffffff", {"n": 3, "dalga": 1}, "patlama"),
    "duvar_kosusu": ("izler", "#4cff8a", "#d6ffe4", {"dik": 1}, "yukari"),
    "uzun_ucus": ("kanat", "#4aa8ff", "#e0f0ff", {"kat": 4}, "yukari"),
    "ayna_klonlari": ("siluet", "#cfd8e6", "#7fe9ff", {"n": 2}, "patlama"),
    "zaman_yavaslatma": ("saat", "#7ad7ff", "#ffffff", {"akrep": 30}, "halka"),
    "zaman_durdurma": ("saat", "#ffd23a", "#fff6c8", {"akrep": 0, "halka": 1}, "halka"),
    "geri_sarma": ("saat", "#2ee6c0", "#d6fff4", {"akrep": -60, "ok": 1}, "halka"),
    "yildirim_firtinasi": ("simsek", "#c78cff", "#ffffff", {"n": 5, "cevre": 1}, "patlama"),
    "plazma_lazeri": ("isin", "#ff3ad6", "#ffd6f5", {"L": 72}, "isin"),
    "enerji_kuresi": ("kure", "#2ff0ff", "#e8ffff", {"r": 9}, "patlama"),
    "kara_delik": ("kara_delik", "#2a0838", "#b85cff", {}, "yorunge"),
    "yercekimi": ("dalga", "#9b6bff", "#e6d9ff", {"dik": 1}, "asagi"),
    "manyetik_firtina": ("ag", "#ff4a4a", "#4a8bff", {"yay": 1}, "yorunge"),
    "gorunmezlik": ("siluet", "#9aa6b8", "#e0e8f0", {"n": 1, "hayalet": 1}, "yukari"),
    "meteor_dalisi": ("meteor", "#ff8a1f", "#ffe08a", {}, "asagi"),
    "deprem": ("dalga", "#c9772e", "#ffcf8a", {"catlak": 1}, "halka"),
    "nano_onarim": ("arti", "#3dff7a", "#e0ffe9", {}, "yukari"),
    "kalkan_uydulari": ("uydu", "#4ad0ff", "#e8fbff", {"n": 4, "kalkan": 1}, "yorunge"),
    "son_form": ("zirh", "#ffc21f", "#fff4c2", {"yildiz": 1}, "patlama"),
    "klon_firtinasi": ("siluet", "#f0f4ff", "#7ab8ff", {"n": 4, "cember": 1}, "halka"),
    "faz_gecisi": ("portal", "#21d6c2", "#d2fff9", {"r": 11, "serit": 1}, "yukari"),
    "dron_surusu": ("uydu", "#ff9a3a", "#ffe6c8", {"n": 6}, "yorunge"),
    "roket_yumruk": ("yumruk", "#ff4a2a", "#ffd04a", {}, "isin"),
    "kalkan_firlatma": ("kalkan", "#3a8bff", "#d8e8ff", {}, "isin"),
    "kilic_kasirgasi": ("yay", "#c8f6ff", "#4ae0ff", {"tam": 1, "bicak": 6}, "yorunge"),
    "bumerang_kilic": ("yay", "#ffe24a", "#ffffff", {"aci": 270, "bicak": 1}, "yorunge"),
    "hayalet_adimlar": ("izler", "#a77bff", "#f0e6ff", {}, "patlama"),
    "seken_basis": ("ok", "#c6ff3a", "#f4ffd0", {"asagi": 1}, "asagi"),
    "yapisik_saldiri": ("isirik", "#ff3a5c", "#ffd0da", {}, "patlama"),
    "elektrik_agi": ("ag", "#3af2ff", "#ffffff", {"dugum": 1}, "halka"),
    "enerji_kanatlari": ("kanat", "#6ff6ff", "#ffffff", {"kat": 6, "buyuk": 1}, "yukari"),
    "isik_kilici": ("kilic", "#e8ffff", "#3ad8ff", {"L": 56}, "isin"),
    "yansitici_zirh": ("kubbe", "#d6dde8", "#7fe0ff", {"r": 18, "petek": 1}, "halka"),
    "portal_kapisi": ("portal", "#a43aff", "#3af6ff", {"r": 16, "buyuk": 1}, "yorunge"),
    "savas_analizi": ("goz", "#4aff9a", "#e0ffef", {"izgara": 1}, "halka"),
    "taktik_gorus": ("goz", "#ff4a4a", "#ffe0e0", {}, "patlama"),
    "nanobot_surusu": ("uydu", "#9ab89e", "#e6ffe9", {"n": 10, "kucuk": 1}, "yorunge"),
    "nanobot_gorusu": ("goz", "#a8c4ad", "#3aff8a", {"tarama": 1}, "isin"),
    "nanobot_isirigi": ("isirik", "#9fb0a4", "#e8fff0", {"kucuk": 1}, "patlama"),
    "nanobot_bulutu": ("kure", "#a6b4ab", "#e8f2ea", {"r": 14, "bulut": 1}, "yorunge"),
    "nanobot_zirhi": ("zirh", "#9cc6c4", "#e2ffff", {}, "halka"),
    "akilli_karsilik": ("ok", "#ff9a2e", "#ffe7c8", {}, "isin"),
    "savas_ogrenmesi": ("yildiz", "#4a7bff", "#dde6ff", {"halka": 1}, "patlama"),
    "emp_darbesi": ("dalga", "#e8f4ff", "#3aa0ff", {"buyuk": 1}, "halka"),
    "yildiz_kiliclari": ("yildiz", "#ffd84a", "#fff8d6", {"kilic": 1}, "patlama"),
    "dev_form": ("zirh", "#ff3a3a", "#ffd0d0", {"buyuk": 1}, "yukari"),
    "mod101": ("yildiz", "#ff2a2a", "#ffd23a", {"halka": 1, "buyuk": 1}, "patlama"),
}

KAL = 1.5          # kılıf kalınlığı (piksel)


def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def koyu(c, k=0.45):
    return tuple(int(v * k) for v in c)


# ------------------------------------------------------------------ çubuklar
def bar(o, s, r=(0, 0, 0), b='sabit', a=0, kabuk=True, sadece_kabuk=False):
    return {'o': o, 's': s, 'r': r, 'b': b, 'a': a, 'kabuk': kabuk, 'sk': sadece_kabuk}


def seg(A, B, w=2, b='sabit', a=0, **k):
    """İki nokta arası çubuk (tek eksen dönüşüyle: noktalar aynı xy, yz ya da xz düzleminde olmalı)."""
    dx, dy, dz = B[0] - A[0], B[1] - A[1], B[2] - A[2]
    L = math.sqrt(dx * dx + dy * dy + dz * dz)
    m = ((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2)
    if abs(dz) < 1e-6:            # xy düzlemi: y ekseni boyunca çubuk, z'de dön
        return bar(m, (w, L, w), (0, 0, -math.degrees(math.atan2(dx, dy))), b, a, **k)
    if abs(dx) < 1e-6:            # yz düzlemi: x'te dön
        return bar(m, (w, L, w), (math.degrees(math.atan2(dz, dy)), 0, 0), b, a, **k)
    # xz düzlemi: z ekseni boyunca çubuk, y'de dön
    return bar(m, (w, w, L), (0, math.degrees(math.atan2(dx, dz)), 0), b, a, **k)


def halka_xz(R, y, n=16, w=2, b='don', a=0, a0=0, a1=360, **k):
    out = []
    for i in range(n):
        t0 = math.radians(a0 + (a1 - a0) * i / n)
        t1 = math.radians(a0 + (a1 - a0) * (i + 1) / n)
        out.append(seg((R * math.cos(t0), y, R * math.sin(t0)), (R * math.cos(t1), y, R * math.sin(t1)), w, b, a, **k))
    return out


def halka_xy(R, cy, z=0, n=16, w=2, b='sabit', a=0, a0=0, a1=360, **k):
    out = []
    for i in range(n):
        t0 = math.radians(a0 + (a1 - a0) * i / n)
        t1 = math.radians(a0 + (a1 - a0) * (i + 1) / n)
        out.append(seg((R * math.cos(t0), cy + R * math.sin(t0), z), (R * math.cos(t1), cy + R * math.sin(t1), z), w, b, a, **k))
    return out


def zigzag(x0, z, top, bot, n, sapma, rnd, w=2, a=0, b='sabit'):
    pts = [(x0, top, z)]
    for i in range(1, n + 1):
        y = top + (bot - top) * i / n
        pts.append((x0 + (rnd.uniform(-sapma, sapma) if i < n else 0), y, z))
    return [seg(pts[i], pts[i + 1], w, b, a) for i in range(n)]


# ------------------------------------------------------------------ biçimler (dosya uzayı: y yukarı, ileri = -z)
def bicim(key):
    tur, _, _, p, _ = T[key]
    rnd = random.Random(key)
    B = []
    if tur == "zincir":
        for i in range(7):
            z = -6 - i * 6
            B.append(bar((0, 14, z), (4, 2 if i % 2 else 5, 5) if i % 2 else (2, 5, 5)))
        B += [seg((0, 14, -48), (0, 20, -52), 2, a=1), seg((0, 20, -52), (0, 16, -56), 2, a=1)]
    elif tur == "kilic":
        L = p.get("L", 40)
        B += [bar((0, 16, -L / 2 - 3), (2, 3, L)), bar((0, 16, -2), (10, 2, 2), a=1), bar((0, 16, 2), (2, 2, 6), a=1)]
        if p.get("simsek"):
            B += zigzag(0, -L / 2, 30, 18, 4, 4, rnd, 1, a=1)
    elif tur == "simsek":
        n = p.get("n", 1)
        for i in range(n):
            ang = 2 * math.pi * i / n
            r = 18 if (p.get("cevre") or n > 1) else 0
            B += zigzag(r * math.cos(ang), r * math.sin(ang), 64, 0, 6, 5, rnd, 3)
        if p.get("dalga"):
            B += halka_xz(22, 1, 18, 2, a=1)
    elif tur == "portal":
        r = p.get("r", 12)
        B += halka_xy(r, r + 2, 0, 20, 3)
        for k in range(3):
            B += halka_xy(r * (0.3 + 0.2 * k), r + 2, 0.5, 8, 1, b='sabit', a=1, a0=k * 40, a1=k * 40 + 220)
        if p.get("serit"):
            B += [bar((0, r + 2 + dy, 0), (2 * r, 1, 1), a=1) for dy in (-6, 0, 6)]
    elif tur == "kubbe":
        r = p.get("r", 24)
        for k in range(5):
            y = r * math.sin(math.radians(k * 18))
            B += halka_xz(r * math.cos(math.radians(k * 18)), y, 20 - k * 2, 2, a=k % 2)
        if p.get("petek"):
            for i in range(6):
                t = math.radians(i * 60)
                B.append(bar((r * 0.7 * math.cos(t), r * 0.5, r * 0.7 * math.sin(t)), (4, 4, 4), a=1, b='don'))
    elif tur == "izler":
        for i in range(6):
            if p.get("dik"):
                B.append(bar((-4 if i % 2 else 4, 4 + i * 8, -10), (4, 6, 1)))
            else:
                B.append(bar((-4 if i % 2 else 4, 0.5, -i * 8), (4, 1, 6), a=i % 2))
    elif tur == "kanat":
        n = p.get("kat", 4)
        s = 1.6 if p.get("buyuk") else 1
        for side in (-1, 1):
            for i in range(n):
                ang = math.radians(20 + i * (60 / n))
                L = (28 - i * 3) * s
                B.append(seg((side * 3, 20, 6), (side * (3 + L * math.cos(ang)), 20 + L * math.sin(ang), 6), 2, a=i % 2))
    elif tur == "siluet":
        n = p.get("n", 1)
        for i in range(n):
            if p.get("cember"):
                ang = 2 * math.pi * i / n
                cx, cz = 20 * math.cos(ang), 20 * math.sin(ang)
            else:
                cx, cz = (i - (n - 1) / 2) * 18, 0
            sk = bool(p.get("hayalet"))
            B += [bar((cx, 26, cz), (6, 6, 6), sadece_kabuk=sk), bar((cx, 16, cz), (6, 12, 3), sadece_kabuk=sk),
                  bar((cx - 4, 16, cz), (2, 10, 2), sadece_kabuk=sk, a=1), bar((cx + 4, 16, cz), (2, 10, 2), sadece_kabuk=sk, a=1),
                  bar((cx - 2, 5, cz), (2, 10, 2), sadece_kabuk=sk), bar((cx + 2, 5, cz), (2, 10, 2), sadece_kabuk=sk)]
    elif tur == "saat":
        R = 16
        B += halka_xy(R, 20, 0, 24, 2)
        for i in range(12):
            t = math.radians(i * 30)
            B.append(seg((0.8 * R * math.cos(t), 20 + 0.8 * R * math.sin(t), 0), (0.95 * R * math.cos(t), 20 + 0.95 * R * math.sin(t), 0), 1, a=1))
        ak = math.radians(90 - p.get("akrep", 0))
        B += [seg((0, 20, -1), (10 * math.cos(ak), 20 + 10 * math.sin(ak), -1), 2, a=1), seg((0, 20, -1), (0, 33, -1), 1, a=1, b='don')]
        if p.get("halka"):
            B += halka_xz(24, 2, 20, 2)
        if p.get("ok"):
            B += halka_xy(R + 6, 20, 0, 10, 2, a=1, a0=200, a1=340)
    elif tur == "isin":
        L = p.get("L", 60)
        B += [bar((0, 14, -L / 2 - 4), (3, 3, L)), *halka_xy(6, 14, -4, 12, 2, a=1), *halka_xy(4, 14, -L / 2, 8, 1, a=1)]
    elif tur == "kure":
        r = p.get("r", 10)
        if p.get("bulut"):
            for i in range(14):
                B.append(bar((rnd.uniform(-r, r), 14 + rnd.uniform(-r / 2, r), rnd.uniform(-r, r)), (3, 3, 3), b='don', a=i % 2))
        else:
            B += [bar((0, 16, 0), (r, r, r), b='don'), bar((0, 16, 0), (r * 1.6, 2, 2), b='don', a=1),
                  bar((0, 16, 0), (2, r * 1.6, 2), b='don', a=1), bar((0, 16, 0), (2, 2, r * 1.6), b='don', a=1)]
            B += halka_xz(r + 4, 16, 16, 1, a=1)
    elif tur == "kara_delik":
        B.append(bar((0, 16, 0), (8, 8, 8), b='don'))
        for k in range(3):
            for i in range(6):
                rr = 6 + i * 3
                t = math.radians(k * 120 + i * 30)
                B.append(bar((rr * math.cos(t), 16, rr * math.sin(t)), (3, 1, 3), b='don', a=1))
    elif tur == "dalga":
        s = 1.5 if p.get("buyuk") else 1
        if p.get("dik"):
            for k in range(4):
                B += halka_xz(12 - k * 2, 30 - k * 8, 14, 2, a=k % 2)
        else:
            for k in range(3):
                B += halka_xz((10 + k * 9) * s, 1, 16 + k * 4, 2, a=k % 2)
        if p.get("catlak"):
            for i in range(6):
                t = math.radians(i * 60 + 15)
                B.append(seg((0, 0.5, 0), (26 * math.cos(t), 0.5, 26 * math.sin(t)), 1, a=1))
    elif tur == "ag":
        for i in range(-2, 3):
            B += [bar((i * 8, 18, 0), (1.5, 1.5, 34)), bar((0, 18, i * 8), (34, 1.5, 1.5))]
        if p.get("dugum"):
            B += [bar((i * 8, 18, j * 8), (3, 3, 3), a=1) for i in range(-2, 3) for j in range(-2, 3) if (i + j) % 2 == 0]
        if p.get("yay"):
            B += halka_xz(22, 18, 12, 2, a=1, a0=0, a1=180) + halka_xz(22, 18, 12, 2, a=0, a0=180, a1=360)
    elif tur == "meteor":
        B += [bar((0, 40, 0), (8, 8, 8), a=1)]
        for i in range(5):
            B.append(seg((0, 44 + i * 2, 0), (6 + i * 3, 56 + i * 4, 0), 2))
    elif tur == "arti":
        B += [bar((0, 20, 0), (4, 14, 4)), bar((0, 20, 0), (14, 4, 4))]
        for i in range(4):
            t = math.radians(i * 90 + 45)
            B += [bar((12 * math.cos(t), 10 + i * 4, 12 * math.sin(t)), (1, 5, 1), a=1, b='don'),
                  bar((12 * math.cos(t), 10 + i * 4, 12 * math.sin(t)), (5, 1, 1), a=1, b='don')]
    elif tur == "uydu":
        n = p.get("n", 4)
        k = 2 if p.get("kucuk") else 4
        for i in range(n):
            t = 2 * math.pi * i / n
            y = 16 + (4 * math.sin(3 * t) if n > 4 else 0)
            s = (6, 6, 1) if p.get("kalkan") else (k, k, k)
            B.append(bar((16 * math.cos(t), y, 16 * math.sin(t)), s, b='don'))
        B += halka_xz(16, 16, 20, 1, a=1)
    elif tur == "zirh":
        s = 1.5 if p.get("buyuk") else 1
        for i in range(8):
            t = math.radians(i * 45)
            B.append(bar((11 * s * math.cos(t), 16 * s, 11 * s * math.sin(t)), (2, 28 * s, 2), b='don'))
        B += halka_xz(11 * s, 2, 16, 2, a=1) + halka_xz(11 * s, 30 * s, 16, 2, a=1)
        if p.get("yildiz"):
            for i in range(8):
                t = math.radians(i * 45)
                B.append(seg((0, 36, 0), (14 * math.cos(t), 36, 14 * math.sin(t)), 2, a=1, b='don'))
    elif tur == "yumruk":
        B += [bar((0, 16, -14), (8, 8, 8)), bar((0, 16, -9), (6, 6, 3), a=1)]
        for i in range(5):
            B.append(seg((rnd.uniform(-2, 2), 16 + rnd.uniform(-2, 2), -6), (rnd.uniform(-5, 5), 16 + rnd.uniform(-5, 5), 12 + i * 3), 2, a=1))
    elif tur == "kalkan":
        B += halka_xy(10, 16, -4, 6, 3) + halka_xy(5, 16, -4.5, 6, 2, a=1) + [bar((0, 16, -4), (3, 3, 2), a=1)]
    elif tur == "yay":
        a1 = 360 if p.get("tam") else p.get("aci", 180)
        B += halka_xz(20, 14, 18 if a1 == 360 else 14, 3, a1=a1)
        nb = p.get("bicak", 1)
        for i in range(nb):
            t = math.radians(i * 360 / nb)
            B.append(seg((14 * math.cos(t), 14, 14 * math.sin(t)), (26 * math.cos(t), 14, 26 * math.sin(t)), 2, a=1, b='don'))
    elif tur == "ok":
        dy = -1 if p.get("asagi") else 0
        for i in range(4):
            if dy:
                y = 40 - i * 10
                B += [seg((-6, y + 6, 0), (0, y, 0), 2, a=i % 2), seg((0, y, 0), (6, y + 6, 0), 2, a=i % 2)]
            else:
                z = -6 - i * 9
                B += [seg((-6, 16, z + 6), (0, 16, z), 2, a=i % 2), seg((0, 16, z), (6, 16, z + 6), 2, a=i % 2)]
    elif tur == "isirik":
        s = 0.6 if p.get("kucuk") else 1
        B += halka_xy(10 * s, 16, -8, 10, 2, a0=200, a1=340) + halka_xy(10 * s, 16, -8, 10, 2, a0=20, a1=160)
        for i in range(5):
            x = (-8 + i * 4) * s
            B += [bar((x, 16 + 8 * s, -8), (2, 5 * s, 2), a=1), bar((x, 16 - 8 * s, -8), (2, 5 * s, 2), a=1)]
    elif tur == "goz":
        B += halka_xy(12, 18, -2, 16, 2) + [bar((0, 18, -2.5), (6, 6, 1), a=1)]
        for i in range(8):
            t = math.radians(i * 45)
            B.append(seg((16 * math.cos(t), 18 + 16 * math.sin(t), -2), (20 * math.cos(t), 18 + 20 * math.sin(t), -2), 1, a=1))
        if p.get("izgara"):
            B += [bar((0, 18, -2), (30, 1, 1), a=1), bar((0, 18, -2), (1, 30, 1), a=1)]
        if p.get("tarama"):
            B.append(bar((0, 18, -20), (1, 1, 32), a=1))
    elif tur == "yildiz":
        s = 1.4 if p.get("buyuk") else 1
        for i in range(8):
            t = math.radians(i * 45)
            L = (24 if i % 2 == 0 else 14) * s
            B.append(seg((0, 18, 0), (L * math.cos(t), 18, L * math.sin(t)), 3 if p.get("kilic") else 2, a=i % 2, b='don'))
        for i in range(4):
            t = math.radians(i * 90 + 45)
            B.append(seg((0, 18, 0), (14 * s * math.cos(t), 18 + 14 * s * math.sin(t), 0), 2, a=1))
        if p.get("halka"):
            B += halka_xz(18 * s, 18, 20, 1, a=1)
    return B


# ------------------------------------------------------------------ geometri (Bedrock, yüz başına UV)
def geometri(i, key, tex_w, tex_h):
    bones = {'kok': {'name': 'kok', 'pivot': [0, 0, 0], 'cubes': []},
             'sabit': {'name': 'sabit', 'parent': 'kok', 'pivot': [0, 0, 0], 'cubes': []},
             'don': {'name': 'don', 'parent': 'kok', 'pivot': [0, 0, 0], 'cubes': []}}
    for br in bicim(key):
        katlar = []
        if not br['sk']:
            katlar.append((0, 0 + 2 * br['a']))
        if br['kabuk'] or br['sk']:
            katlar.append((KAL, 1 + 2 * br['a']))
        for ek, col in katlar:
            s = [max(0.5, v + 2 * ek) for v in br['s']]
            o = [br['o'][j] - s[j] / 2 for j in range(3)]
            uv = {f: {'uv': [col, i], 'uv_size': [1, 1]} for f in ('north', 'south', 'east', 'west', 'up', 'down')}
            c = {'origin': [round(v, 3) for v in o], 'size': [round(v, 3) for v in s], 'uv': uv}
            if any(abs(v) > 1e-6 for v in br['r']):
                c['pivot'] = [round(v, 3) for v in br['o']]
                c['rotation'] = [round(v, 3) for v in br['r']]
            bones[br['b']]['cubes'].append(c)
    return {'description': {'identifier': f'geometry.aqualit.guc_fx_{i}', 'texture_width': tex_w, 'texture_height': tex_h,
                            'visible_bounds_width': 8, 'visible_bounds_height': 8, 'visible_bounds_offset': [0, 2, 0]},
            'bones': [bones['kok'], bones['sabit'], bones['don']]}


def palet():
    im = Image.new('RGBA', (4, 64), (0, 0, 0, 0))
    px = im.load()
    for i, (k, _) in enumerate(GUCLER):
        c, a = hexc(T[k][1]), hexc(T[k][2])
        px[0, i] = c + (255,)
        px[1, i] = koyu(c, 0.6) + (95,)
        px[2, i] = a + (255,)
        px[3, i] = koyu(a, 0.6) + (95,)
    return im


# ------------------------------------------------------------------ 2D parçacık resimleri
def sprite2d(key):
    tur, ana, vurgu, p, _ = T[key]
    c, v = hexc(ana), hexc(vurgu)
    S = 32
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im, 'RGBA')
    rnd = random.Random(key + '2d')
    hal = koyu(c) + (110,)

    def cizgi(pts, w=2, renk=c):
        d.line(pts, fill=hal, width=w + 4, joint='curve')
        d.line(pts, fill=renk + (255,), width=w, joint='curve')

    def daire(r, w=2, renk=c, cx=16, cy=16):
        d.ellipse((cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2), outline=hal, width=w + 4)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=renk + (255,), width=w)
    if tur in ("simsek", "kilic", "meteor"):
        if tur == "kilic":
            cizgi([(16, 3), (16, 26)], 3); cizgi([(10, 24), (22, 24)], 2, v)
        if tur in ("simsek", "kilic") and (tur == "simsek" or p.get("simsek")):
            x, pts = 16, [(16, 2)]
            for y in range(6, 31, 5):
                x = 16 + rnd.randint(-6, 6); pts.append((x, y))
            cizgi(pts, 2, v if tur == "kilic" else c)
        if tur == "meteor":
            d.ellipse((17, 17, 29, 29), fill=hal); d.ellipse((19, 19, 27, 27), fill=v + (255,))
            for k in range(3):
                cizgi([(19 - k * 3, 19 - k * 2), (4 - k * 2, 4 + k * 3)], 2)
    elif tur in ("halka", "dalga", "kubbe", "portal", "saat", "yay", "goz", "kalkan"):
        daire(12, 2)
        if tur in ("dalga", "kubbe", "portal"):
            daire(7, 2, v)
        if tur == "portal":
            daire(3, 1, v)
        if tur == "saat":
            cizgi([(16, 16), (16, 7)], 2, v); cizgi([(16, 16), (22, 19)], 2, v)
        if tur == "goz":
            d.ellipse((12, 12, 20, 20), fill=v + (255,))
        if tur == "kalkan":
            d.polygon([(16, 5), (26, 10), (24, 22), (16, 28), (8, 22), (6, 10)], fill=hal, outline=c + (255,))
        if tur == "yay":
            d.arc((3, 3, 29, 29), 200, 340, fill=v + (255,), width=3)
    elif tur in ("kure", "kara_delik", "uydu", "arti"):
        if tur == "kara_delik":
            d.ellipse((4, 4, 28, 28), fill=koyu(hexc(vurgu), 0.4) + (140,)); d.ellipse((10, 10, 22, 22), fill=(10, 0, 18, 255))
            for k in range(3):
                d.arc((3 + k * 3, 3 + k * 3, 29 - k * 3, 29 - k * 3), k * 120, k * 120 + 140, fill=v + (255,), width=2)
        elif tur == "arti":
            cizgi([(16, 5), (16, 27)], 4); cizgi([(5, 16), (27, 16)], 4)
        elif tur == "uydu":
            for k in range(4):
                t = k * math.pi / 2
                x, y = 16 + 10 * math.cos(t), 16 + 10 * math.sin(t)
                d.rectangle((x - 4, y - 4, x + 4, y + 4), fill=hal); d.rectangle((x - 2, y - 2, x + 2, y + 2), fill=c + (255,))
        else:
            d.ellipse((4, 4, 28, 28), fill=hal); d.ellipse((9, 9, 23, 23), fill=c + (255,)); d.ellipse((13, 11, 18, 16), fill=v + (255,))
    elif tur in ("kanat", "siluet", "zirh", "isirik", "izler", "ok", "ag", "zincir", "yumruk", "yildiz", "isin"):
        if tur == "kanat":
            for k in range(4):
                cizgi([(16, 18), (2 + k * 2, 4 + k * 4)], 2, v if k % 2 else c); cizgi([(16, 18), (30 - k * 2, 4 + k * 4)], 2, v if k % 2 else c)
        elif tur == "siluet":
            d.ellipse((12, 3, 20, 11), fill=hal); d.rectangle((11, 12, 21, 23), fill=hal)
            d.ellipse((13, 4, 19, 10), outline=c + (255,), width=2); d.rectangle((12, 13, 20, 22), outline=c + (255,), width=2)
            cizgi([(14, 23), (13, 30)], 2); cizgi([(18, 23), (19, 30)], 2)
        elif tur == "zirh":
            for x in range(6, 27, 5):
                cizgi([(x, 4), (x, 28)], 2)
            cizgi([(4, 6), (28, 6)], 2, v); cizgi([(4, 26), (28, 26)], 2, v)
        elif tur == "isirik":
            for x in range(6, 27, 5):
                d.polygon([(x - 2, 6), (x + 2, 6), (x, 14)], fill=c + (255,)); d.polygon([(x - 2, 26), (x + 2, 26), (x, 18)], fill=v + (255,))
        elif tur == "izler":
            for k in range(4):
                x, y = (10 if k % 2 else 20), 26 - k * 7
                d.ellipse((x - 4, y - 3, x + 4, y + 3), fill=hal); d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=c + (255,))
        elif tur == "ok":
            for k in range(3):
                y = 8 + k * 8
                cizgi([(6, y - 4), (16, y + 2), (26, y - 4)], 2, v if k % 2 else c)
        elif tur == "ag":
            for k in range(4, 29, 8):
                cizgi([(k, 2), (k, 30)], 1); cizgi([(2, k), (30, k)], 1)
        elif tur == "zincir":
            for k in range(4):
                d.ellipse((4 + k * 6, 12, 12 + k * 6, 20), outline=c + (255,), width=2)
            cizgi([(28, 16), (30, 8), (24, 6)], 2, v)
        elif tur == "yumruk":
            d.rectangle((14, 9, 28, 23), fill=hal); d.rectangle((16, 11, 26, 21), fill=c + (255,))
            for k in range(3):
                cizgi([(14, 12 + k * 4), (2, 10 + k * 6)], 2, v)
        elif tur == "yildiz":
            for k in range(8):
                t = k * math.pi / 4
                L = 14 if k % 2 == 0 else 8
                cizgi([(16, 16), (16 + L * math.cos(t), 16 + L * math.sin(t))], 2, c if k % 2 == 0 else v)
        elif tur == "isin":
            cizgi([(2, 16), (30, 16)], 4); cizgi([(2, 16), (30, 16)], 1, v)
    return im


def parcacik(key, i, kare):
    tur, ana, vurgu, p, hareket = T[key]
    c = [round(v / 255, 3) for v in hexc(ana)]
    comp = {
        'minecraft:emitter_lifetime_once': {'active_time': 0.25},
        'minecraft:particle_lifetime_expression': {'max_lifetime': 'math.random(0.6, 1.0)'},
        'minecraft:particle_appearance_billboard': {
            'size': ['0.3 * (1 - v.particle_age / v.particle_lifetime * 0.6)', '0.3 * (1 - v.particle_age / v.particle_lifetime * 0.6)'],
            'facing_camera_mode': 'rotate_xyz',
            'uv': {'texture_width': kare * len(GUCLER), 'texture_height': kare, 'uv': [i * kare, 0], 'uv_size': [kare, kare]}},
        'minecraft:particle_appearance_tinting': {'color': [1, 1, 1, '1 - math.pow(v.particle_age / v.particle_lifetime, 2)']},
    }
    if hareket == "patlama":
        comp.update({'minecraft:emitter_rate_steady': {'spawn_rate': 60, 'max_particles': 24},
                     'minecraft:emitter_shape_sphere': {'radius': 0.4, 'direction': 'outwards'},
                     'minecraft:particle_initial_speed': 'math.random(2, 5)',
                     'minecraft:particle_motion_dynamic': {'linear_drag_coefficient': 2.5}})
    elif hareket == "halka":
        comp.update({'minecraft:emitter_rate_steady': {'spawn_rate': 80, 'max_particles': 32},
                     'minecraft:emitter_shape_disc': {'radius': 0.6, 'plane_normal': 'y', 'direction': 'outwards'},
                     'minecraft:particle_initial_speed': 'math.random(3, 5)',
                     'minecraft:particle_motion_dynamic': {'linear_drag_coefficient': 2}})
    elif hareket == "isin":
        comp.update({'minecraft:emitter_rate_steady': {'spawn_rate': 70, 'max_particles': 28},
                     'minecraft:emitter_shape_point': {'direction': ['v.d.x', 'v.d.y', 'v.d.z']},
                     'minecraft:particle_initial_speed': 'math.random(8, 12)',
                     'minecraft:particle_motion_dynamic': {'linear_drag_coefficient': 1}})
    elif hareket == "yukari":
        comp.update({'minecraft:emitter_rate_steady': {'spawn_rate': 50, 'max_particles': 20},
                     'minecraft:emitter_shape_disc': {'radius': 0.8, 'plane_normal': 'y', 'direction': [0, 1, 0]},
                     'minecraft:particle_initial_speed': 'math.random(1.5, 3)',
                     'minecraft:particle_motion_dynamic': {'linear_drag_coefficient': 1.5}})
    elif hareket == "asagi":
        comp.update({'minecraft:emitter_rate_steady': {'spawn_rate': 50, 'max_particles': 20},
                     'minecraft:emitter_shape_disc': {'radius': 1.0, 'plane_normal': 'y', 'offset': [0, 3, 0], 'direction': [0, -1, 0]},
                     'minecraft:particle_initial_speed': 'math.random(3, 6)',
                     'minecraft:particle_motion_dynamic': {'linear_drag_coefficient': 0.5}})
    else:   # yorunge
        comp.update({'minecraft:emitter_rate_steady': {'spawn_rate': 40, 'max_particles': 20},
                     'minecraft:emitter_shape_disc': {'radius': 1.2, 'plane_normal': 'y', 'direction': 'inwards'},
                     'minecraft:particle_initial_speed': 1.5,
                     'minecraft:particle_motion_dynamic': {'linear_acceleration': [0, 1, 0], 'linear_drag_coefficient': 1}})
    return {'format_version': '1.10.0', 'particle_effect': {
        'description': {'identifier': f'aqualit:g2_{i}', 'basic_render_parameters': {'material': 'particles_blend', 'texture': 'textures/particle/aqualit_guc2d'}},
        'components': comp}}


# ------------------------------------------------------------------ önizleme (çubuklardan doğrudan, yarı saydamlıkla)
def _rot(v, r):
    x, y, z = v
    rx, ry, rz = (math.radians(a) for a in r)
    # z, sonra y, sonra x (Bedrock küp dönüşü)
    x, y = x * math.cos(rz) - y * math.sin(rz), x * math.sin(rz) + y * math.cos(rz)
    x, z = x * math.cos(ry) + z * math.sin(ry), -x * math.sin(ry) + z * math.cos(ry)
    y, z = y * math.cos(rx) - z * math.sin(rx), y * math.sin(rx) + z * math.cos(rx)
    return (x, y, z)


def onizleme(key, t, S=120, yaw=35, elev=22):
    tur, ana, vurgu, p, _ = T[key]
    renk = {0: hexc(ana) + (255,), 1: koyu(hexc(ana), 0.6) + (95,), 2: hexc(vurgu) + (255,), 3: koyu(hexc(vurgu), 0.6) + (95,)}
    yuzler = []
    olcek = min(1.0, t * 5) * (1 if t < 0.8 else max(0.1, 1 - (t - 0.8) * 4))
    don = t * 360
    for br in bicim(key):
        katlar = []
        if not br['sk']:
            katlar.append((0, 0 + 2 * br['a']))
        if br['kabuk'] or br['sk']:
            katlar.append((KAL, 1 + 2 * br['a']))
        for ek, col in katlar:
            s = [max(0.5, v + 2 * ek) for v in br['s']]
            kose = []
            for dx in (-0.5, 0.5):
                for dy in (-0.5, 0.5):
                    for dz in (-0.5, 0.5):
                        v = _rot((dx * s[0], dy * s[1], dz * s[2]), br['r'])
                        v = (v[0] + br['o'][0], v[1] + br['o'][1], v[2] + br['o'][2])
                        if br['b'] == 'don':
                            v = _rot(v, (0, don, 0))
                        kose.append(v)
            for idx in ((0, 1, 3, 2), (4, 5, 7, 6), (0, 1, 5, 4), (2, 3, 7, 6), (0, 2, 6, 4), (1, 3, 7, 5)):
                yuzler.append(([kose[i] for i in idx], renk[col], ek > 0))
    # kamera
    cy, sy = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    ce, se = math.cos(math.radians(elev)), math.sin(math.radians(elev))

    tum = [q for f, _, _ in yuzler for q in f]
    mx = [min(q[i] for q in tum) for i in range(3)]
    Mx = [max(q[i] for q in tum) for i in range(3)]
    merkez = [(mx[i] + Mx[i]) / 2 for i in range(3)]
    yaricap = max(8.0, max(Mx[i] - mx[i] for i in range(3)) * 0.62)

    def proj(v):
        x, y, z = (v[0] - merkez[0]) * olcek, (v[1] - merkez[1]) * olcek, (v[2] - merkez[2]) * olcek
        k = (S * 0.42) / yaricap
        x, y, z = x * k, y * k, z * k
        x, z = x * cy - z * sy, x * sy + z * cy
        y, z = y * ce - z * se, y * se + z * ce
        return (S / 2 + x, S / 2 - y, z)
    im = Image.new('RGBA', (S, S), (22, 26, 32, 255))
    d = ImageDraw.Draw(im, 'RGBA')
    pl = [([proj(v) for v in f], c, kab) for f, c, kab in yuzler]
    # önce kılıflar (yarı saydam, koyu), sonra parlak çekirdekler: parlama görünümü
    for grup in (True, False):
        sec = sorted([f for f in pl if f[2] == grup], key=lambda f: -sum(q[2] for q in f[0]) / 4)
        for f, c, kab in sec:
            nz = (f[1][0] - f[0][0]) * (f[3][1] - f[0][1]) - (f[1][1] - f[0][1]) * (f[3][0] - f[0][0])
            parl = 1.0 if kab else (0.82 + 0.18 * min(1, abs(nz) / 40))
            d.polygon([(q[0], q[1]) for q in f], fill=tuple(min(255, int(v * parl)) for v in c[:3]) + (c[3],))
    return im


def build(RP, BP, wj, scripts_dir, onizleme_dir=None):
    os.makedirs(f'{RP}/models/entity', exist_ok=True)
    os.makedirs(f'{RP}/textures/entity/aqualit_guc_fx', exist_ok=True)
    os.makedirs(f'{RP}/textures/particle', exist_ok=True)
    os.makedirs(f'{RP}/particles', exist_ok=True)
    pal = palet()
    pal.save(f'{RP}/textures/entity/aqualit_guc_fx/palet.png')
    geos = [geometri(i, k, 4, 64) for i, (k, _) in enumerate(GUCLER)]
    wj(f'{RP}/models/entity/aqualit_guc_fx.geo.json', {'format_version': '1.12.0', 'minecraft:geometry': geos})
    n = len(GUCLER)
    wj(f'{RP}/entity/aqualit_guc_fx.entity.json', {'format_version': '1.10.0', 'minecraft:client_entity': {'description': {
        'identifier': 'aqualit:guc_fx', 'materials': {'default': 'entity_alphablend'},
        'textures': {'default': 'textures/entity/aqualit_guc_fx/palet'},
        'geometry': {f'g{i}': f'geometry.aqualit.guc_fx_{i}' for i in range(n)},
        'animations': {'oyna': 'animation.aqualit.guc_fx.oyna'}, 'scripts': {'animate': ['oyna']},
        'render_controllers': ['controller.render.aqualit.guc_fx']}}})
    wj(f'{RP}/render_controllers/aqualit_guc_fx.render_controllers.json', {'format_version': '1.10.0', 'render_controllers': {
        'controller.render.aqualit.guc_fx': {
            'arrays': {'geometries': {'Array.g': [f'Geometry.g{i}' for i in range(n)]}},
            'geometry': "Array.g[q.property('aqualit:fx')]", 'materials': [{'*': 'Material.default'}],
            'textures': ['Texture.default'], 'ignore_lighting': True}}})
    wj(f'{RP}/animations/aqualit_guc_fx.animation.json', {'format_version': '1.8.0', 'animations': {
        'animation.aqualit.guc_fx.oyna': {'loop': True, 'bones': {
            'kok': {'scale': 'math.min(1, q.life_time * 5) * (q.life_time < 0.9 ? 1 : math.max(0.05, 1 - (q.life_time - 0.9) * 4))'},
            'don': {'rotation': [0, 'q.life_time * 360', 0]}}}}})
    wj(f'{BP}/entities/guc_fx.json', {'format_version': '1.21.0', 'minecraft:entity': {
        'description': {'identifier': 'aqualit:guc_fx', 'is_spawnable': False, 'is_summonable': True,
                        'properties': {'aqualit:fx': {'type': 'int', 'range': [0, n - 1], 'default': 0, 'client_sync': True}}},
        'components': {
            'minecraft:type_family': {'family': ['aqualit_fx', 'inanimate']},
            'minecraft:collision_box': {'width': 0.1, 'height': 0.1},
            'minecraft:health': {'value': 10, 'max': 10},
            'minecraft:damage_sensor': {'triggers': [{'cause': 'all', 'deals_damage': 'no'}]},
            'minecraft:physics': {'has_gravity': False, 'has_collision': False},
            'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
            'minecraft:loot': {'table': 'loot_tables/empty.json'}}}})
    # 2D
    K = 32
    atlas = Image.new('RGBA', (K * n, K), (0, 0, 0, 0))
    for i, (k, _) in enumerate(GUCLER):
        atlas.paste(sprite2d(k), (i * K, 0))
        wj(f'{RP}/particles/aqualit_g2_{i}.json', parcacik(k, i, K))
    atlas.save(f'{RP}/textures/particle/aqualit_guc2d.png')
    with open(os.path.join(scripts_dir, 'guc_efekt_data.js'), 'w', encoding='utf-8') as fh:
        fh.write('// gen/guc_efekt.py üretir — elle değiştirme.\n')
        fh.write(f'export const GUC_FX = {json.dumps({k: i for i, (k, _) in enumerate(GUCLER)})};\n')
        fh.write(f'export const GUC_FX_HAREKET = {json.dumps({k: T[k][4] for k, _ in GUCLER})};\n')
    return atlas


def onizlemeler(cikti_dir, kare=12):
    """3D ve 2D önizleme ızgaraları (PNG + GIF)."""
    n = len(GUCLER)
    sut = 9
    sat = (n + sut - 1) // sut
    S = 120
    # 3D
    kareler = []
    for f in range(kare):
        t = 0.15 + 0.6 * f / kare
        g = Image.new('RGB', (sut * S, sat * (S + 14)), (14, 16, 20))
        d = ImageDraw.Draw(g)
        for i, (k, ad) in enumerate(GUCLER):
            im = onizleme(k, t, S, yaw=35 + f * 6)
            x, y = (i % sut) * S, (i // sut) * (S + 14)
            g.paste(im.convert('RGB'), (x, y))
            d.text((x + 3, y + S), ad[:22], fill=(170, 220, 230), font=YAZI)
        kareler.append(g)
    kareler[kare // 2].save(os.path.join(cikti_dir, 'guc_3d.png'))
    kareler[0].save(os.path.join(cikti_dir, 'guc_3d.gif'), save_all=True, append_images=kareler[1:], duration=110, loop=0)
    # 2D: parçacık benzetimi
    kareler = []
    for f in range(kare):
        g = Image.new('RGB', (sut * S, sat * (S + 14)), (14, 16, 20))
        d = ImageDraw.Draw(g)
        for i, (k, ad) in enumerate(GUCLER):
            hareket = T[k][4]
            sp = sprite2d(k)
            rnd = random.Random(k)
            hucre = Image.new('RGBA', (S, S), (22, 26, 32, 255))
            for j in range(14):
                yas = (f / kare + j / 14) % 1
                a = rnd.uniform(0, 2 * math.pi)
                hiz = rnd.uniform(0.6, 1)
                if hareket in ("patlama", "halka"):
                    px, py = S / 2 + math.cos(a) * yas * 50 * hiz, S / 2 + math.sin(a) * yas * (50 if hareket == "patlama" else 18) * hiz
                elif hareket == "isin":
                    px, py = 15 + yas * 95, S / 2 + rnd.uniform(-6, 6)
                elif hareket == "yukari":
                    px, py = S / 2 + rnd.uniform(-30, 30), S - 15 - yas * 85
                elif hareket == "asagi":
                    px, py = S / 2 + rnd.uniform(-30, 30), 10 + yas * 90
                else:
                    r = 42 * (1 - yas)
                    px, py = S / 2 + math.cos(a + yas * 4) * r, S / 2 + math.sin(a + yas * 4) * r * 0.5 - yas * 20
                boy = int(26 * (1 - yas * 0.6))
                s2 = sp.resize((boy, boy), Image.NEAREST)
                if yas > 0.6:
                    al = s2.getchannel('A').point(lambda v: int(v * (1 - (yas - 0.6) / 0.4)))
                    s2.putalpha(al)
                hucre.alpha_composite(s2, (max(0, int(px - boy / 2)), max(0, int(py - boy / 2))))
            x, y = (i % sut) * S, (i // sut) * (S + 14)
            g.paste(hucre.convert('RGB'), (x, y))
            d.text((x + 3, y + S), ad[:22], fill=(230, 200, 150), font=YAZI)
        kareler.append(g)
    kareler[kare // 2].save(os.path.join(cikti_dir, 'guc_2d.png'))
    kareler[0].save(os.path.join(cikti_dir, 'guc_2d.gif'), save_all=True, append_images=kareler[1:], duration=110, loop=0)


if __name__ == '__main__':
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    onizlemeler(out)
