from pix import *
SCREEN = [
"kkKkkkKkkk",
"kLKkkkKkkk",
"KKKKKKKKKK",
"kkKkYkKkLk",
"kkKkkkKkkk",
"KKKKKKKKKK",
"kkKkkkKLkk",
"kkKkkkKkkk",
]
T = [
"................",
"................",
".OOOOOOOOOOOOOO.",
".OHHHHHHHHHHHLO.",
] + [".OL" + s + "MO." for s in SCREEN] + [
".OLMMMMWHMMMMDO.",
".OMDDDDDDDDDDDO.",
".OOOOOOOOOOOOOO.",
"................",
]
im = grid_to_img(T, {'K': (30, 72, 62)}); im.save('dokular/robot_tracker.png')
preview([(im, 'Takip Ekranı')], '6 · Takip Ekranı', 'onizleme/06_takip.png')
