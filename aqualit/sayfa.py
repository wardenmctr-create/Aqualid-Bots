from PIL import Image, ImageDraw, ImageFont
from pix import FONT, FONT2
L = [
 ('aqualit_ore', 'Aqualit Cevheri'), ('deepslate_aqualit_ore', 'Derin Kayrak Cevheri'),
 ('raw_aqualit', 'Ham Aqualit'), ('aqualit_ingot', 'Aqualit Külçesi'), ('aqualit_block', 'Aqualit Bloğu'),
 ('aqualit_pickaxe', 'Kazma'), ('aqualit_shovel', 'Kürek'), ('aqualit_hoe', 'Çapa'),
 ('aqualit_axe', 'Balta'), ('aqualit_sword', 'Kılıç'),
 ('aqualit_chest', 'Aqualit Sandık'), ('chest_miner', 'Madenci Sandığı'),
 ('chest_digger', 'Kürekçi Sandığı'), ('chest_farmer', 'Çiftçi Sandığı'), ('chest_lumber', 'Oduncu Sandığı'),
 ('robot_radio', 'Robot Telsizi'), ('robot_tracker', 'Takip Ekranı'), ('task_remote', 'Görev Kumandası'),
 ('command_rod', 'Komut Çubuğu'), ('zone_selector', 'Bölge Seçici'), ('locked_slot', 'Kilitli Slot'),
]
COLS, S, PAD = 5, 10, 26
cell = 16 * S
W = PAD + COLS * (cell + PAD)
rows = (len(L) + COLS - 1) // COLS
H = 80 + rows * (cell + 56)
bg = Image.new('RGB', (W, H), (24, 28, 32))
d = ImageDraw.Draw(bg)
d.text((PAD, 22), 'Aqualit eşyaları · renk A', font=ImageFont.truetype(FONT, 30), fill=(122, 211, 183))
fl = ImageFont.truetype(FONT2, 18)
for i, (fn, label) in enumerate(L):
    r, c = divmod(i, COLS)
    x0 = PAD + c * (cell + PAD); y0 = 80 + r * (cell + 56)
    for cy in range(8):
        for cx in range(8):
            col = (44, 50, 56) if (cx + cy) % 2 == 0 else (36, 41, 46)
            d.rectangle([x0 + cx*20, y0 + cy*20, x0 + cx*20 + 19, y0 + cy*20 + 19], fill=col)
    im = Image.open(f'dokular/{fn}.png').convert('RGBA').resize((cell, cell), Image.NEAREST)
    bg.paste(im, (x0, y0), im)
    tw = d.textlength(label, font=fl)
    d.text((x0 + (cell - tw) / 2, y0 + cell + 10), label, font=fl, fill=(230, 236, 240))
bg.save('onizleme/tum_esyalar_A.png'); print(W, H)
