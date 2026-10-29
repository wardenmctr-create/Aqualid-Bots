from pix import *

RAW = [
"................",
"................",
"......OOO.......",
".....OHWLOO.....",
"....OHWLLMMO....",
"...OHLLMcMMDO...",
"...OLMMccMDDO...",
"..OLLMMMMDDcDO..",
"..OMLMcDDDDDDO..",
"..OMMDccDDDDO...",
"...OMDDDDDOO....",
"....OODDDO......",
"......OOO.......",
"................",
"................",
"................",
]
INGOT = [
"................",
"................",
"................",
"...........OOO..",
".........OOWHHO.",
".......OOWHHHLO.",
".....OOWHHHHLMO.",
"...OOWHHHHLLMDO.",
".OOWHHHHLLLMDDO.",
".OHHHHLLLLMDDDO.",
".OLLLLMMMMDDDOO.",
".OMMMMMDDDDOO...",
".ODDDDDDDOO.....",
"..OOOOOOO.......",
"................",
"................",
]
pal = {'c': (96, 120, 120)}
raw = grid_to_img(RAW, pal); ingot = grid_to_img(INGOT)
raw.save('dokular/raw_aqualit.png'); ingot.save('dokular/aqualit_ingot.png')
preview([(raw, 'Ham Aqualit'), (ingot, 'Aqualit Külçesi')], '2 · Ham Aqualit ve Külçe', 'onizleme/02_ham_kulce.png')
