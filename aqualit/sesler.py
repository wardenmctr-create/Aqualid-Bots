#!/usr/bin/env python3
"""Aqualit Robotları — sentezlenmiş ses efektleri.

Hepsi burada sıfırdan üretilir (örnek ses kullanılmaz):
  robot_*  : metalik robot sesleri (adım, servo, bip konuşma, çınlama, açılış, kapanış)
  guc_*    : Kılıçlı güç sesleri
  kesif_*  : Keşif robotu dönüşüm ve araç sesleri

Çıktı: sesler/<ad>.ogg (oyun için, Vorbis) ve sesler/wav/<ad>.wav (önizleme videoları için).
Kullanım: python3 sesler.py
"""
import os
import subprocess

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'sesler')
WAV = os.path.join(OUT, 'wav')
rng = np.random.default_rng(26)


# ------------------------------------------------------------------ temel araçlar
def N(d):
    return int(round(SR * d))


def T(d):
    return np.arange(N(d)) / SR


def farr(freq, n):
    if np.ndim(freq) == 0:
        return np.full(n, float(freq))
    f = np.asarray(freq, float)
    if len(f) < n:
        f = np.concatenate([f, np.full(n - len(f), f[-1])])
    return f[:n]


def phase(freq, n):
    return 2 * np.pi * np.cumsum(farr(freq, n)) / SR


def sine(freq, d, harm=()):
    n = N(d)
    ph = phase(freq, n)
    y = np.sin(ph)
    for k, a in harm:
        y = y + a * np.sin(k * ph)
    return y


def bl(freq, d, kind='saw', kmax=40):
    """Bant sınırlı testere / kare dalga (toplamsal)."""
    n = N(d)
    f = farr(freq, n)
    ph = phase(f, n)
    K = int(max(1, min(kmax, (SR / 2) / max(f.max(), 1))))
    y = np.zeros(n)
    for k in range(1, K + 1):
        if kind == 'sq' and k % 2 == 0:
            continue
        y += np.sin(k * ph) / k
    return y * (2 / np.pi)


def noise(d):
    return rng.standard_normal(N(d))


def sos(kind, fc, order=2):
    return signal.butter(order, fc, btype=kind, fs=SR, output='sos')


def lp(x, fc, order=2):
    return signal.sosfilt(sos('low', min(fc, SR * 0.45), order), x)


def hp(x, fc, order=2):
    return signal.sosfilt(sos('high', fc, order), x)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(sos('band', [lo, min(hi, SR * 0.45)], order), x)


def tv(x, fc, kind='low', q=1.0, chunk=128):
    """Zamanla değişen filtre (parça parça, durum taşınarak)."""
    out = np.zeros_like(x)
    fc = farr(fc, len(x))
    zi = None
    for i in range(0, len(x), chunk):
        c = float(np.clip(fc[i], 40, SR * 0.44))
        if kind == 'band':
            w = c * 0.5 / q
            s = signal.butter(2, [max(30, c - w), min(SR * 0.45, c + w)], btype='band', fs=SR, output='sos')
        else:
            s = signal.butter(2, c, btype=kind, fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((s.shape[0], 2))
        y, zi = signal.sosfilt(s, x[i:i + chunk], zi=zi)
        out[i:i + chunk] = y
    return out


def env_ad(n, a=0.003, d=0.1):
    t = np.arange(n) / SR
    return np.where(t < a, t / max(a, 1e-6), np.exp(-(t - a) / d))


def env_asr(n, a=0.01, r=0.05):
    e = np.ones(n)
    na, nr = max(1, N(a)), max(1, N(r))
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] *= np.linspace(1, 0, nr)
    return e


def bell(n):
    return np.sin(np.linspace(0, np.pi, n)) ** 2


def metal(base, d, ratios, decays, amps, jit=0.0):
    t = T(d)
    y = np.zeros_like(t)
    for r, dc, a in zip(ratios, decays, amps):
        f = base * r * (1 + jit * rng.uniform(-1, 1))
        y += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / dc)
    return y


def mix(d, parts):
    """parts: (başlangıç sn, sinyal, kazanç)"""
    out = np.zeros(N(d))
    for st, sig, g in parts:
        i = N(st)
        if i >= len(out):
            continue
        k = min(len(sig), len(out) - i)
        out[i:i + k] += g * sig[:k]
    return out


def fade(x, a=0.002, r=0.01):
    x = x.copy()
    na, nr = max(1, N(a)), max(1, N(r))
    x[:na] *= np.linspace(0, 1, na)
    x[-nr:] *= np.linspace(1, 0, nr)
    return x


def loopify(x, xf=0.05):
    """Döngü sesi: sonu başa yumuşakça bağlanır."""
    n = N(xf)
    y = x[:-n].copy()
    w = np.linspace(0, 1, n)
    y[:n] = y[:n] * w + x[-n:] * (1 - w)
    return y


SOUNDS = {}


def save(name, y, peak=0.89, loop=False):
    y = np.nan_to_num(np.asarray(y, float))
    y = y - np.mean(y) if loop else y
    m = np.max(np.abs(y)) or 1.0
    y = np.tanh(1.2 * y / m) / np.tanh(1.2) * peak
    if not loop:
        y = fade(y)
    os.makedirs(WAV, exist_ok=True)
    wp = os.path.join(WAV, name + '.wav')
    wavfile.write(wp, SR, (y * 32767).astype(np.int16))
    op = os.path.join(OUT, name + '.ogg')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wp, '-c:a', 'libvorbis', '-q:a', '4', '-ac', '1', op],
                   check=True)
    SOUNDS[name] = len(y) / SR


# ------------------------------------------------------------------ küçük yapı taşları
def thud(f=90, d=0.12, drop=0.6, tau=0.035):
    t = T(d)
    return np.sin(phase(f * (1 + drop * np.exp(-t / 0.02)), len(t))) * np.exp(-t / tau)


def tick(base=2400, d=0.05, tau=0.008):
    return metal(base, d, [1, 1.47, 2.09, 2.83], [tau, tau * 0.8, tau * 0.6, tau * 0.5], [0.6, 0.4, 0.3, 0.2]) + \
        hp(noise(d), 3000) * np.exp(-T(d) / 0.002) * 0.3


def servo_wave(f, d, buzz=48):
    t = T(d)
    y = bl(f, d, 'sq', 12) + 0.6 * bl(farr(f, len(t)) * 1.012, d, 'sq', 10)
    y *= 1 + 0.35 * np.sin(2 * np.pi * buzz * t)
    y = lp(y, 2400) + 0.12 * bp(noise(d), 1500, 4500)
    return y * env_asr(len(t), 0.02, 0.06)


def chime(f, d=0.6, tau=0.35):
    return metal(f, d, [1, 2.0, 2.76, 5.4], [tau, tau * 0.6, tau * 0.4, tau * 0.2], [0.7, 0.25, 0.18, 0.08])


def beep_note(f0, f1, d, harm=0.22):
    t = T(d)
    f = f0 + (f1 - f0) * (t / d) ** 0.7
    f = f * (1 + 0.006 * np.sin(2 * np.pi * 28 * t))
    return sine(f, d, [(3, harm), (2, 0.08)]) * env_asr(len(t), 0.004, 0.018)


def zap_burst(d=0.25, tau=0.1):
    n = N(d)
    gate = np.zeros(n)
    i = 0
    while i < n:
        on = int(rng.uniform(0.0015, 0.006) * SR)
        off = int(rng.uniform(0.001, 0.012) * SR)
        gate[i:i + on] = rng.uniform(0.4, 1.0)
        i += on + off
    y = bp(noise(d), 1500, 9000) * gate
    t = T(d)
    fm = np.sin(2 * np.pi * 2100 * t + 4 * np.sin(2 * np.pi * 310 * t)) * np.exp(-t / 0.06) * 0.5
    return (y + fm) * np.exp(-t / tau)


# ------------------------------------------------------------------ robot sesleri
def robot():
    # metal adımlar
    for i, k in enumerate([1.0, 1.07, 0.94, 1.13]):
        d = 0.2
        t = T(d)
        y = 0.9 * thud(92 * k, d) + 0.55 * metal(1150 * k, d, [1, 1.52, 2.31, 3.37, 4.1],
                                                 [0.045, 0.03, 0.022, 0.015, 0.01], [0.5, 0.35, 0.3, 0.2, 0.12]) + \
            hp(noise(d), 2500) * np.exp(-t / 0.004) * 0.35
        save(f'robot_step{i + 1}', y, peak=0.8)
    # servo vınlaması
    for i, (d, fn) in enumerate([(0.3, lambda t, d: 380 + 300 * t / d), (0.26, lambda t, d: 700 - 320 * t / d),
                                 (0.36, lambda t, d: 420 + 160 * np.sin(np.pi * t / d))]):
        save(f'robot_servo{i + 1}', servo_wave(fn(T(d), d), d), peak=0.7)
    # bip-bop konuşma
    for v in range(6):
        r = np.random.default_rng(100 + v)
        parts, st = [], 0.0
        for _ in range(int(r.integers(3, 6))):
            f0 = float(r.uniform(900, 2300))
            f1 = f0 * float(r.uniform(0.7, 1.45)) if r.random() < 0.55 else f0
            d = float(r.uniform(0.05, 0.11))
            parts.append((st, beep_note(f0, f1, d), 1.0))
            st += d + float(r.uniform(0.015, 0.045))
        save(f'robot_beep{v + 1}', mix(st + 0.03, parts), peak=0.62)
    # bekleme: hafif uğultu + bip-bop
    for v, (a, b) in enumerate([(1320, 990), (1180, 1570), (880, 1175)]):
        d = 0.75
        t = T(d)
        hum = (np.sin(2 * np.pi * 110 * t) + 0.4 * np.sin(2 * np.pi * 220 * t) + 0.15 * np.sin(2 * np.pi * 330 * t))
        hum *= env_asr(len(t), 0.2, 0.3) * 0.25
        y = mix(d, [(0, hum, 1.0), (0.18, beep_note(a, a, 0.07), 0.8), (0.3, beep_note(b, b * 0.92, 0.09), 0.8)])
        save(f'robot_ambient{v + 1}', y, peak=0.5)
    # hasar: metal çınlaması + telaşlı bip
    for v, base in enumerate([430, 470, 395]):
        d = 0.7
        t = T(d)
        clang = metal(base, d, [1, 2.36, 3.73, 5.28, 7.1, 9.4], [0.35, 0.25, 0.18, 0.12, 0.08, 0.05],
                      [0.6, 0.5, 0.4, 0.3, 0.2, 0.12], jit=0.02)
        hit = bp(noise(d), 800, 7000) * np.exp(-t / 0.012) * 0.8
        y = mix(d, [(0, clang + hit, 1.0), (0.06, beep_note(1500, 650, 0.14), 0.35)])
        save(f'robot_hurt{v + 1}', y)
    # kapanış: güç düşüşü
    d = 1.75
    t1 = T(1.3)
    f = 900 * (50 / 900) ** (t1 / 1.3)
    down = tv(bl(f, 1.3, 'saw', 30), 4000 * (150 / 4000) ** (t1 / 1.3)) * (1 - (t1 / 1.3) ** 3)
    cr = np.zeros(N(1.3))
    for _ in range(40):
        i = int(rng.uniform(0, 1.0) ** 1.8 * len(cr))
        k = min(len(cr) - i, N(0.004))
        cr[i:i + k] += hp(noise(0.004), 2500)[:k] * rng.uniform(0.3, 1)
    clunk = thud(70, 0.3, tau=0.06) + 0.4 * metal(620, 0.3, [1, 2.4, 3.9], [0.08, 0.05, 0.03], [0.6, 0.4, 0.2])
    save('robot_death', mix(d, [(0, down, 0.9), (0, cr, 0.5), (1.33, clunk, 1.0)]))
    # açılış: yükselen ton + çift çan
    t = T(0.8)
    up = sine(70 * (1000 / 70) ** (t / 0.8), 0.8, [(2, 0.3)]) * np.minimum(1, t / 0.5) * (1 - (t / 0.8) ** 6)
    y = mix(1.5, [(0, servo_wave(np.linspace(300, 600, N(0.18)), 0.18), 0.4), (0.05, up, 0.6),
                  (0.85, chime(1318.5), 0.55), (1.0, chime(1760), 0.55)])
    save('robot_boot', y)
    # kılıç savurma: hava + servo
    for v, (a, b, c) in enumerate([(500, 2600, 900), (420, 2200, 700)]):
        d = 0.3
        t = T(d)
        ctr = np.interp(t, [0, d * 0.45, d], [a, b, c])
        wh = tv(noise(d), ctr, 'band', q=1.4) * bell(len(t))
        snap = bl(650, 0.03, 'sq', 8) * env_asr(N(0.03), 0.002, 0.01)
        save(f'robot_swing{v + 1}', mix(d, [(0, wh, 1.0), (0, snap, 0.25)]), peak=0.75)


# ------------------------------------------------------------------ güç sesleri
def guc():
    # şarj: yükselen elektrik vızıltısı
    d = 1.3
    t = T(d)
    f = 55 * 2 ** (t / d * 1.6)
    buzz = tv(bl(f, d, 'saw', 30), 600 + 3800 * (t / d) ** 1.5) * (t / d) ** 1.4
    cr = np.zeros(len(t))
    tt = 0.0
    while tt < d - 0.01:
        rate = 10 + 90 * (tt / d) ** 2
        tt += rng.exponential(1 / rate)
        i = N(tt)
        k = min(len(cr) - i, N(0.003))
        if k > 0:
            cr[i:i + k] += hp(noise(0.003), 3000)[:k] * rng.uniform(0.2, 1)
    save('guc_sarj', mix(d + 0.2, [(0, buzz, 0.8), (0, cr, 0.5), (1.2, zap_burst(0.25), 0.8)]))
    # çarpma (zincir şimşek, kanca vuruşu)
    for v in range(3):
        save(f'guc_carp{v + 1}', zap_burst(0.32, 0.11), peak=0.8)
    # ışınlanma: ters hava emişi + parıltı
    d = 0.6
    t = T(0.22)
    swell = tv(noise(0.22), 300 * (6000 / 300) ** (t / 0.22)) * (t / 0.22) ** 2.5
    parts = [(0, swell, 1.0)]
    for _ in range(8):
        parts.append((rng.uniform(0.22, 0.45), metal(rng.uniform(2200, 4800), 0.12, [1, 2.7], [0.06, 0.03], [0.6, 0.2]), 0.4))
    save('guc_isinlan', mix(d, parts))
    # kubbe: derin uğultu + parıltı + yükselen ton
    d = 1.5
    t = T(d)
    drone = (np.sin(2 * np.pi * 82 * t) + 0.6 * np.sin(2 * np.pi * 164 * t) + 0.3 * np.sin(2 * np.pi * 246 * t))
    drone *= env_asr(len(t), 0.4, 0.45)
    sh = np.zeros(len(t))
    for fq in [1600, 1840, 2080, 2390, 2610]:
        sh += np.sin(2 * np.pi * fq * t + rng.uniform(0, 6)) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t + rng.uniform(0, 6)))
    sh *= env_asr(len(t), 0.5, 0.5) * 0.12
    t2 = T(0.5)
    rise = sine(300 * 4 ** (t2 / 0.5), 0.5) * bell(len(t2)) * 0.3
    save('guc_kubbe', mix(d, [(0, drone, 0.6), (0, sh, 1.0), (0, rise, 1.0), (0.05, zap_burst(0.3), 0.25)]))
    # kanca: fermuar gibi fırlatma + kilit tıkı
    d = 0.4
    t = T(0.16)
    zipp = sine(300 * (2600 / 300) ** (t / 0.16), 0.16) * 0.5 + hp(noise(0.16), 2500) * 0.4
    zipp *= env_asr(len(t), 0.005, 0.03)
    save('guc_kanca', mix(d, [(0, zipp, 1.0), (0.17, tick(2100, 0.1, 0.012), 0.9), (0.18, zap_burst(0.15), 0.35)]))


# ------------------------------------------------------------------ epik güç sesleri (v0.2.5)
def crackle(d, rate, lo=2500, seed=0, amp=(0.3, 1.0)):
    """Seyrek elektrik çıtırtıları (rate: saniyede ortalama çıtırtı, sabit ya da dizi)."""
    r = np.random.default_rng(seed)
    out = np.zeros(N(d))
    tt = 0.0
    while True:
        rr = rate(tt) if callable(rate) else rate
        tt += r.exponential(1 / max(rr, 1e-3))
        if tt >= d - 0.006:
            break
        i = N(tt)
        L = N(r.uniform(0.001, 0.005))
        k = min(len(out) - i, L)
        burst = hp(r.standard_normal(L), lo) * np.exp(-np.arange(L) / (L * 0.35))
        out[i:i + k] += burst[:k] * r.uniform(*amp)
    return out


def guc_epik():
    # gök gürültüsü vuruşu: keskin çatırtı + yuvarlanan derin gümbürtü + alt bas darbe
    for v, (seed, roll) in enumerate([(7, (2.3, 3.9, 6.1)), (11, (1.7, 3.1, 5.3))]):
        r = np.random.default_rng(seed)
        d = 2.9
        t = T(d)
        crack = hp(noise(0.12), 1400) * np.exp(-T(0.12) / 0.018)
        cr = crackle(0.35, lambda x: 260 * np.exp(-x / 0.12), 2000, seed)
        n = r.standard_normal(len(t))
        cut = 380 * (110 / 380) ** np.clip(t / 1.6, 0, 1)
        rumble = tv(n, cut, 'low')
        rollenv = 0.55 + 0.45 * (np.sin(2 * np.pi * roll[0] * t) * 0.5 + np.sin(2 * np.pi * roll[1] * t + 1) * 0.3 +
                                 np.sin(2 * np.pi * roll[2] * t + 2) * 0.2)
        rumble /= np.sqrt(np.mean(rumble ** 2)) + 1e-9
        rumble *= np.minimum(1, t / 0.05) * np.exp(-t / 1.05) * rollenv
        sub = sine(42 * (1 + 0.9 * np.exp(-t / 0.05)), d) * np.exp(-t / 0.35)
        save(f'guc_gok{v + 1}', mix(d, [(0, crack, 0.55), (0, cr, 0.35), (0.01, rumble, 0.42), (0, sub, 0.75)]), peak=0.95)
    # kılıç çevresinde çıtırtı
    for v in range(3):
        d = 0.32
        t = T(d)
        hum = bl(120, d, 'sq', 14) * 0.2 * bell(len(t))
        save(f'guc_citirti{v + 1}', crackle(d, 70, 2600, 40 + v) + lp(hum, 1500), peak=0.7)
    # şok dalgası: bas patlama + aşağı süzülen hava
    d = 1.1
    t = T(d)
    boom = sine(36 * (1 + 0.8 * np.exp(-t / 0.06)), d, [(2, 0.25)]) * np.exp(-t / 0.33)
    t6 = T(0.75)
    whoosh = tv(noise(0.75), 2600 * (260 / 2600) ** (t6 / 0.75), 'band', q=1.2) * np.exp(-t6 / 0.3) * np.minimum(1, t6 / 0.02)
    save('guc_sok', mix(d, [(0, boom, 1.2), (0, whoosh, 0.9), (0, zap_burst(0.18, 0.06), 0.5)]), peak=0.92)
    # elektrikli zincir fırlatma: şıngırtılar + uğultu + hava
    d = 0.75
    t = T(d)
    parts = []
    st = 0.0
    r = np.random.default_rng(5)
    while st < 0.55:
        base = float(r.uniform(1900, 3600))
        parts.append((st, metal(base, 0.09, [1, 1.58, 2.33, 3.1], [0.03, 0.022, 0.015, 0.01], [0.6, 0.4, 0.3, 0.2]), 0.55))
        st += float(r.uniform(0.022, 0.06))
    hum = lp(bl(92 * (1 + 0.5 * t / d), d, 'saw', 30), 1300) * env_asr(len(t), 0.03, 0.2) * 0.35
    wh = tv(noise(d), np.interp(t, [0, 0.25, d], [700, 3200, 1200]), 'band', q=1.5) * bell(len(t)) * 0.5
    save('guc_zincir', mix(d, parts + [(0, hum, 1.0), (0, wh, 1.0), (0.5, zap_burst(0.2, 0.08), 0.6)]), peak=0.82)
    # yıldırım kılıcı ateşlenmesi: yükselen elektrik + metal çınlaması + çatırtı
    d = 1.4
    t = T(d)
    surge = tv(bl(180 * (4.5 ** np.clip(t / 0.9, 0, 1)), d, 'saw', 30), 900 + 4200 * np.clip(t / 0.9, 0, 1)) \
        * np.clip(t / 0.9, 0, 1) ** 1.5 * np.exp(-np.clip(t - 0.9, 0, None) / 0.12)
    ring = metal(1320, 1.0, [1, 2.01, 2.97, 4.2, 5.4], [0.6, 0.45, 0.3, 0.2, 0.12], [0.5, 0.3, 0.25, 0.15, 0.08])
    crk = hp(noise(0.1), 1500) * np.exp(-T(0.1) / 0.02)
    save('guc_kilic', mix(d, [(0, surge, 0.7), (0, crackle(0.9, lambda x: 20 + 140 * x, 2600, 9), 0.4),
                              (0.9, crk, 1.0), (0.9, ring, 0.8), (0.92, zap_burst(0.3, 0.12), 0.6)]))
    # gölge adım: emilen karanlık hava + boğuk vuruş + alçalan vınlama
    d = 0.85
    t1 = T(0.32)
    swell = tv(noise(0.32), 250 * (2400 / 250) ** (t1 / 0.32)) * (t1 / 0.32) ** 2.2
    t2 = T(0.5)
    vwom = sine(110 * (45 / 110) ** (t2 / 0.5), 0.5, [(2, 0.3)]) * np.exp(-t2 / 0.2)
    thump = lp(thud(70, 0.25, tau=0.06), 600)
    save('guc_golge', mix(d, [(0, swell, 0.9), (0.3, vwom, 0.8), (0.3, thump, 0.9), (0.31, lp(zap_burst(0.2), 3500), 0.3)]))


# ------------------------------------------------------------------ Keşif sesleri
def kesif():
    # gözlük inişi: klik-klak
    d = 0.35
    leather = lp(noise(0.04), 300) * np.exp(-T(0.04) / 0.01) * 2
    save('kesif_gozluk', mix(d, [(0, tick(2600, 0.06, 0.007), 0.9), (0, leather, 0.6),
                                 (0.085, tick(2150, 0.08, 0.01), 1.0)]), peak=0.8)
    # dönüşüm: servolar, cırcırlar, tok kilitlenmeler ve yükselen güç tonu
    d = 2.0
    parts = []
    for st, f0, f1, du in [(0.0, 300, 700, 0.35), (0.3, 600, 350, 0.3), (0.6, 400, 900, 0.4),
                           (1.0, 800, 500, 0.3), (1.25, 350, 750, 0.35)]:
        parts.append((st, servo_wave(np.linspace(f0, f1, N(du)), du), 0.55))
    for a, b in [(0.2, 0.55), (0.95, 1.3)]:
        tt = a
        while tt < b:
            parts.append((tt, tick(rng.uniform(2800, 3400), 0.03, 0.005), 0.28))
            tt += 1 / 34
    for st in [0.55, 0.9, 1.35, 1.75]:
        parts.append((st, thud(72, 0.25, tau=0.05) + 0.35 * metal(610, 0.25, [1, 2.3, 3.6], [0.07, 0.05, 0.03],
                                                                    [0.6, 0.4, 0.25]), 0.9))
    t = T(d)
    parts.append((0, sine(100 * 4 ** (t / d), d) * (t / d) ** 1.5 * 0.5, 0.4))
    tw = T(0.35)
    parts.append((0.42, tv(noise(0.35), np.interp(tw, [0, 0.15, 0.35], [400, 2200, 700]), 'band', 1.3) * bell(len(tw)), 0.5))
    tr = mix(d, parts)
    save('kesif_donusum', tr)
    save('kesif_geri_donusum', np.flip(tr) * env_asr(len(tr), 0.05, 0.05))
    # kilitlenme: ağır tok ses + pnömatik tıslama + onay bipi
    d = 0.95
    hiss = hp(noise(0.6), 3000) * np.exp(-T(0.6) / 0.18)
    big = thud(55, 0.4, drop=0.9, tau=0.12) + 0.5 * metal(300, 0.4, [1, 2.2, 3.4, 4.9], [0.15, 0.1, 0.07, 0.04],
                                                              [0.6, 0.45, 0.3, 0.15])
    save('kesif_kilit', mix(d, [(0, big, 1.0), (0.05, hiss, 0.45), (0.55, beep_note(1760, 1760, 0.06), 0.35),
                                (0.65, beep_note(2349, 2349, 0.08), 0.35)]))
    # parıltı: çan merdiveni
    notes = [1568, 1760, 2093, 2349, 2637, 3136]
    save('kesif_parilti', mix(1.2, [(i * 0.07, chime(f, 0.6, 0.25), 0.5) for i, f in enumerate(notes)]), peak=0.7)

    # uçak: motor çalışması + pervane
    def plane(d, f0, f1, p0, p1, steady=False):
        t = T(d)
        ramp = np.clip(t / (d * 0.65), 0, 1) if not steady else np.ones_like(t)
        f = f0 + (f1 - f0) * ramp ** 0.8
        pr = p0 + (p1 - p0) * ramp
        eng = lp(bl(f, d, 'saw', 30), 1100)
        whup = 0.55 + 0.45 * np.sin(phase(pr, len(t)))
        air = lp(noise(d), 900) * 0.4
        return (eng * 0.8 + air) * whup * (np.minimum(1, t / 0.3) if not steady else 1)
    save('kesif_ucak', plane(2.2, 28, 75, 6, 26))
    save('kesif_ucak_dongu', loopify(plane(1.05, 75, 75, 26, 26, True)), loop=True)

    # gemi: dizel pıt-pıt + su
    def boat(d, r0, r1, steady=False):
        t = T(d)
        y = np.zeros(len(t))
        tt = 0.06 if not steady else 0.0
        while tt < d:
            r = r0 + (r1 - r0) * min(1, tt / (d * 0.6)) if not steady else r1
            i = N(tt)
            p = lp(noise(0.09), 420) * 2 + np.sin(2 * np.pi * 48 * T(0.09))
            p *= np.exp(-T(0.09) / 0.045)
            k = min(len(p), len(y) - i)
            y[i:i + k] += p[:k]
            tt += 1 / r
        water = bp(noise(d), 250, 1200) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * t)) * 0.25
        return y + water
    save('kesif_gemi', boat(1.8, 4, 8))
    save('kesif_gemi_dongu', loopify(boat(1.05, 8, 8, True)), loop=True)
    # denizaltı: sonar ve uğultu
    d = 1.8
    ping = sine(1150, 0.5, [(2, 0.12)]) * env_ad(N(0.5), 0.003, 0.22)
    rumble = lp(noise(d), 120) * 0.8
    save('kesif_sonar', mix(d, [(0, ping, 1.0), (0.4, lp(ping, 2500), 0.35), (0.8, lp(ping, 1800), 0.15),
                                (0, rumble, 0.4)]))

    def sub(d):
        t = T(d)
        hum = np.sin(2 * np.pi * 60 * t) + 0.5 * np.sin(2 * np.pi * 120 * t)
        y = hum * 0.5 + lp(noise(d), 150) * 0.5
        for _ in range(int(d * 6)):
            st = rng.uniform(0, d - 0.03)
            y += mix(d, [(st, sine(np.linspace(400, 900, N(0.025)), 0.025) * bell(N(0.025)), 0.35)])
        return y
    save('kesif_denizalti_dongu', loopify(sub(1.05)), loop=True)

    # arazi aracı: motor kükremesi
    def rover(d, steady=False):
        t = T(d)
        f = np.interp(t, [0, 0.6, d], [40, 120, 85]) if not steady else np.full(len(t), 80.0)
        y = lp(bl(f, d, 'saw', 30), 1300) + lp(noise(d), 160) * 0.7
        return y * (np.minimum(1, t / 0.12) if not steady else 1)
    save('kesif_arazi', rover(1.6))
    save('kesif_arazi_dongu', loopify(rover(1.05, True)), loop=True)

    # matkap: dönme sesi ve öğütme
    def drill(d, steady=False):
        t = T(d)
        r = 5 + 40 * np.clip(t / (d * 0.7), 0, 1) ** 1.3 if not steady else np.full(len(t), 45.0)
        whine = sine(r * 30, d, [(2, 0.2)]) * 0.35
        body = lp(bl(r * 8, d, 'saw', 20), 1800) * 0.6
        grind = bp(noise(d), 600, 3500) * (0.5 + 0.5 * np.sin(phase(r, len(t)))) * 0.6
        return (whine + body + grind) * (np.minimum(1, t / 0.15) if not steady else 1)
    save('kesif_matkap', drill(1.8))
    save('kesif_matkap_dongu', loopify(drill(1.05, True)), loop=True)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    robot()
    guc()
    kesif()
    guc_epik()   # sona: önceki seslerin rastgele tohumları değişmesin
    tot = sum(os.path.getsize(os.path.join(OUT, n + '.ogg')) for n in SOUNDS)
    print(f'{len(SOUNDS)} ses, toplam {tot / 1024:.0f} KB')
    for n, d in SOUNDS.items():
        print(f'  {n:24s} {d:.2f} sn')
