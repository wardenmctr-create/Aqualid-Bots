"""Aqualit İnşa Çubuğu simgesi (büyü parıltısı yok, Aqualit kaplama, taş başlık)."""
import os, sys
ART = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
sys.path.insert(0, ART)
from pix import grid_to_img, PAL  # noqa: E402

ROD = [
    "................",
    "...........WHL..",
    "..........WHLMD.",
    "..........HLMMD.",
    "..........LMMD..",
    ".........LMD....",
    "........LMD.....",
    ".......LMD......",
    "......LMD.......",
    ".....LMD........",
    "....LMD.........",
    "...vu...........",
    "..vut...........",
    ".vut............",
    ".ut.............",
    "................",
]


def rod_icon():
    return grid_to_img(ROD)
