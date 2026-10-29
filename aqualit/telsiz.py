from pix import *
RADIO = [
".....OO.........",
"....OWHO........",
"....OLMO........",
".....kO.........",
".....kO.........",
"...OOOOOOOOOO...",
"..OHHHHHHHLRLO..",
"..OHkkkkkkkkMO..",
"..OHkLLLkRkkMO..",
"..OLkLLLLkkkMO..",
"..OLkkkkkkkkMO..",
"..OLMMMMMMMMDO..",
"..OLWHMOMOMODO..",
"..OLHLMOMOMODO..",
"..OMDDDDDDDDDO..",
"...OOOOOOOOOO...",
]
im = grid_to_img(RADIO); im.save('dokular/robot_radio.png')
preview([(im, 'Robot Telsizi')], '5 · Robot Telsizi', 'onizleme/05_telsiz.png')
