"""Put the first content page of every baseline PDF side by side.

This is the "before" picture: the same Japanese document, as each existing
tool renders it with default settings.
"""
from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"

# (file, page index of the first page of the design document, caption)
PANELS = [
    ("pandoc-app.pdf", 0, "pandoc.org/app"),
    ("docusaurus-prince.pdf", 1, "docusaurus-prince-pdf (Prince)"),
    ("docs-to-pdf.pdf", 3, "docs-to-pdf (Puppeteer)"),
    ("mr-pdf.pdf", 3, "mr-pdf (Puppeteer)"),
]
WIDTH = 520
FONT = "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf"


def page_image(pdf: str, index: int) -> Image.Image:
    page = pymupdf.open(OUT / pdf)[index]
    zoom = WIDTH / page.rect.width
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def main() -> None:
    images = [page_image(f, i) for f, i, _ in PANELS]
    height = max(im.height for im in images)
    gap, caption_h = 24, 44
    canvas = Image.new("RGB", (len(images) * (WIDTH + gap) + gap, height + caption_h + gap), "#e9eaec")
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype(FONT, 20)
    except OSError:
        font = ImageFont.load_default()
    for n, (im, (_, _, caption)) in enumerate(zip(images, PANELS)):
        x = gap + n * (WIDTH + gap)
        draw.text((x, 12), caption, fill="#1d2127", font=font)
        canvas.paste(im, (x, caption_h))
        draw.rectangle([x - 1, caption_h - 1, x + im.width, caption_h + im.height], outline="#9aa0a6")
    canvas.save(OUT / "compare.png")
    print(f"out/compare.png  {canvas.width}x{canvas.height}")


if __name__ == "__main__":
    main()
