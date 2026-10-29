from pix import *
LOCK = [
"gggggggggggggggg",
"gggggggggggggggg",
"gggggggggggggggg",
"ggggggOOOOgggggg",
"gggggOccbbOggggg",
"gggggOcOOaOggggg",
"gggggOcOOaOggggg",
"ggggOOOOOOOOgggg",
"ggggOccccccbOggg"[:16],
"ggggOcbbkbbdOggg"[:16],
"ggggOcbbkbbdOggg"[:16],
"ggggOcbbbbbdOggg"[:16],
"ggggOddddddddOgg"[:16],
"ggggOOOOOOOOOggg"[:16],
"gggggggggggggggg",
"gggggggggggggggg",
]
LOCK = [
"gggggggggggggggg",
"gggggggggggggggg",
"gggggggggggggggg",
"ggggggOOOOgggggg",
"gggggOccbbOggggg",
"gggggOcOOaOggggg",
"gggggOcOOaOggggg",
"ggggOOOOOOOOgggg",
"ggggOccccccbOggg"[:12] + "gggg",
"ggggOcbbkbbdgggg",
"ggggOcbbkbbdgggg",
"ggggOcbbbbbdgggg",
"ggggOddddddOgggg",
"ggggOOOOOOOOgggg",
"gggggggggggggggg",
"gggggggggggggggg",
]
LOCK = [r[:11] + ('O' if 8 <= i <= 12 else r[11]) + r[12:] if 8 <= i <= 12 else r for i, r in enumerate(LOCK)]
pal = {'O': (36, 36, 40), 'g': (70, 72, 76)}
im = grid_to_img(LOCK, pal); im.save('dokular/locked_slot.png')
preview([(im, 'Kilitli Slot')], '9 · Kilitli Slot', 'onizleme/09_kilit.png')
for i, r in enumerate(LOCK): print(i, r)
