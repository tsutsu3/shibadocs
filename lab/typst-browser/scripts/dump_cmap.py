"""Print the code points a font can render, one hex value per line."""
import sys
from fontTools.ttLib import TTFont

with TTFont(sys.argv[1], lazy=True) as font:
    for cp in sorted(font.getBestCmap()):
        print(f"{cp:x}")
