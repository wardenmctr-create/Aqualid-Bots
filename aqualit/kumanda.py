from pix import *
REMOTE = [
"................",
".....OOOOOO.....",
"....OHHWWLLO....",
"....OHkkkkMO....",
"....OHkLLkMO....",
"....OLkkkkMO....",
"....OLMMMMDO....",
"....OLMWMMDO....",
"....OLWHWMDO....",
"....OLMWMMDO....",
"....OLMMMMDO....",
"....OLHMRMDO....",
"....OLMMMMDO....",
"....OMHMHMDO....",
".....OOOOOO.....",
"................",
]
im = grid_to_img(REMOTE); im.save('dokular/task_remote.png')
preview([(im, 'Görev Kumandası')], '7 · Görev Kumandası', 'onizleme/07_kumanda.png')
