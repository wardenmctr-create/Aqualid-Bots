#!/usr/bin/env python3
"""Robot ve güç seslerini dinlemek için kısa tanıtım videosu: onizleme/robot_sesleri.mp4"""
import os
import subprocess
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
WAV = os.path.join(HERE, 'sesler', 'wav')
SR = 44100
W, H, FPS = 1280, 720, 15
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def load(n):
    sr, y = wavfile.read(os.path.join(WAV, n + '.wav'))
    return y.astype(float) / 32767


# (başlık, açıklama, [(ses, başlangıç sn, kazanç)], süre, arka plan)
ROBOTS = 'onizleme/robotlar_hepsi.png'
KILIC = 'onizleme/robot_kilicli.png'
SEG = [
    ('Metal adımlar', 'Robot yürürken', [(f'robot_step{(i % 4) + 1}', i * 0.3, 0.8) for i in range(8)], 2.8, ROBOTS),
    ('Servo vınlaması', 'Kazarken, keserken, eğilip kalkarken',
     [('robot_servo1', 0.1, 0.8), ('robot_servo2', 0.7, 0.8), ('robot_servo3', 1.3, 0.8)], 2.2, ROBOTS),
    ('Bip-bop konuşma', 'Sana mesaj gönderirken', [('robot_beep1', 0.1, 1), ('robot_beep4', 1.0, 1), ('robot_beep5', 1.8, 1)], 2.8, ROBOTS),
    ('Bekleme sesi', 'Boşta dururken ara sıra', [('robot_ambient1', 0.1, 1), ('robot_ambient3', 1.1, 1)], 2.2, ROBOTS),
    ('Açılış', 'Robot yerleştirilince uyanır', [('robot_boot', 0.1, 1)], 2.0, ROBOTS),
    ('Hasar', 'Vurulunca metal çınlaması', [('robot_hurt1', 0.1, 1), ('robot_hurt3', 0.9, 1)], 2.0, ROBOTS),
    ('Kılıç savurma', 'Kılıçlı saldırırken', [('robot_swing1', 0.1, 1), ('robot_swing2', 0.6, 1), ('robot_swing1', 1.1, 1)], 1.8, KILIC),
    ('Kapanış', 'Canı bitince heykele dönüşür', [('robot_death', 0.1, 1)], 2.3, ROBOTS),
    ('Elektrik kancası', 'Güç · Seviye 2', [('guc_kanca', 0.1, 1), ('guc_carp1', 0.75, 0.9)], 1.7, KILIC),
    ('Yıldırım kılıcı', 'Güç · Seviye 3', [('guc_sarj', 0.1, 1), ('guc_carp2', 1.7, 0.8)], 2.5, KILIC),
    ('Gölge adım', 'Güç · Seviye 4', [('guc_isinlan', 0.1, 1), ('guc_isinlan', 0.75, 0.9)], 1.8, KILIC),
    ('Elektrik kubbe', 'Güç · Seviye 4', [('guc_kubbe', 0.1, 1)], 2.0, KILIC),
    ('Gök gürültüsü', 'Güç · Seviye 5 (yıldırım düşüşü oyunun kendi sesi)', [('guc_sarj', 0.1, 1), ('guc_carp3', 1.6, 1),
                                                                          ('guc_carp1', 1.85, 0.8)], 2.6, KILIC),
]


def bg(path):
    im = Image.open(os.path.join(HERE, path)).convert('RGB')
    s = min(W / im.width, (H - 210) / im.height)
    im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    c = Image.new('RGB', (W, H), (14, 32, 38))
    c.paste(im, ((W - im.width) // 2, 40))
    return c


def main():
    total = sum(s[3] for s in SEG)
    audio = np.zeros(int(total * SR) + SR)
    t0 = 0.0
    starts = []
    for title, sub, snds, dur, _ in SEG:
        starts.append(t0)
        for n, st, g in snds:
            y = load(n)
            i = int((t0 + st) * SR)
            audio[i:i + len(y)] += g * y
        t0 += dur
    audio = audio[:int(total * SR)]
    audio = audio / max(1e-6, np.abs(audio).max()) * 0.9
    tmp = tempfile.mkdtemp(dir=os.environ.get('TMPDIR'))
    wavfile.write(os.path.join(tmp, 'a.wav'), SR, (audio * 32767).astype(np.int16))
    fb, fr, fs = ImageFont.truetype(BOLD, 54), ImageFont.truetype(REG, 30), ImageFont.truetype(REG, 22)
    bgs = {p: bg(p) for p in {s[4] for s in SEG}}
    nf = int(total * FPS)
    for f in range(nf):
        t = f / FPS
        k = max(i for i, s in enumerate(starts) if s <= t + 1e-9)
        title, sub, snds, dur, path = SEG[k]
        im = bgs[path].copy()
        d = ImageDraw.Draw(im)
        d.rectangle([0, H - 170, W, H], fill=(10, 24, 29))
        d.text((60, H - 150), title, font=fb, fill=(64, 224, 208))
        d.text((62, H - 82), sub, font=fr, fill=(220, 235, 235))
        d.text((W - 60, H - 150), f'{k + 1}/{len(SEG)}', font=fr, fill=(140, 170, 170), anchor='ra')
        # ses dalgası çubukları
        i0 = int(t * SR)
        seg = audio[i0:i0 + SR // FPS]
        lvl = float(np.sqrt((seg ** 2).mean())) if len(seg) else 0.0
        for j in range(24):
            h = int(8 + min(1.0, lvl * 4) * 60 * (0.5 + 0.5 * np.sin(j * 0.9 + t * 12)))
            x = W - 60 - (24 - j) * 14
            d.rectangle([x, H - 40 - h, x + 8, H - 40], fill=(64, 224, 208))
        p = (t - starts[k]) / dur
        d.rectangle([0, H - 6, int(W * (starts[k] + p * dur) / total), H], fill=(64, 224, 208))
        d.text((W - 60, 14), 'Aqualit Robotları · sesler', font=fs, fill=(140, 170, 170), anchor='ra')
        im.save(os.path.join(tmp, f'f{f:05d}.png'))
    out = os.path.join(HERE, 'onizleme', 'robot_sesleri.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(tmp, 'f%05d.png'),
                    '-i', os.path.join(tmp, 'a.wav'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24',
                    '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out], check=True)
    print(out, f'{os.path.getsize(out) / 1e6:.1f} MB', f'{total:.1f} sn')


if __name__ == '__main__':
    main()
