"""Look inside each baseline PDF the way a reviewer would.

For every PDF in out/: page count, embedded fonts, whether the Japanese text
can be copied back out, whether a watermark is present, and a PNG of the first
pages so the result can be seen.
"""
import json
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"

# A sentence from the sample that is easy to break: a comma, a closing
# parenthesis and a full stop, all of which kinsoku rules keep off a line start.
PROBE = "応答が 200 以外のとき（タイムアウトを含む。）は、3回まで再送を行う。"
WATERMARKS = ["Prince", "prince", "www.princexml.com"]


def corner_mark(doc) -> bool:
    """Is there a filled shape in the top-right corner of page 1?

    Prince's free licence puts its logo there as vector paths, not as text or
    an image, so a text search does not find it.
    """
    page = doc[0]
    w = page.rect.width
    corner = pymupdf.Rect(w - 70, 0, w, 70)
    return any(d.get("fill") and d["rect"].intersects(corner) for d in page.get_drawings())


def has_cjk(name: str) -> bool:
    return any(k in name for k in ("CJK", "JP", "IPA", "Gothic", "Mincho", "Noto Sans J", "HanSans", "Meiryo", "Yu"))


def inspect(pdf: Path) -> dict:
    doc = pymupdf.open(pdf)
    fonts = sorted({f[3] for page in doc for f in page.get_fonts(full=True)})
    text = "".join(page.get_text() for page in doc)
    flat = text.replace("\n", "")

    report = {
        "file": pdf.name,
        "pages": doc.page_count,
        "bytes": pdf.stat().st_size,
        "fonts": fonts,
        "cjk_font_embedded": any(has_cjk(f) for f in fonts),
        # Kinsoku aside, is the sentence still there when copied out?
        "probe_copyable": PROBE.replace(" ", "") in flat.replace(" ", ""),
        "watermark": [w for w in WATERMARKS if w in text]
        + (["logo (top-right, vector)"] if corner_mark(doc) else []),
        "producer": doc.metadata.get("producer", ""),
        "replacement_chars": text.count("�"),
        "outline": [t[1] for t in doc.get_toc()][:10],
    }

    for i in range(min(2, doc.page_count)):
        pix = doc[i].get_pixmap(dpi=110)
        pix.save(OUT / f"{pdf.stem}-p{i + 1}.png")
    return report


def main() -> None:
    names = sys.argv[1:] or [p.name for p in sorted(OUT.glob("*.pdf"))]
    reports = [inspect(OUT / n) for n in names]
    for r in reports:
        print(f"\n== {r['file']}  {r['pages']} ページ  {r['bytes'] // 1024} KB")
        print(f"   フォント: {', '.join(r['fonts']) or '(なし)'}")
        print(f"   和文フォント埋め込み: {'あり' if r['cjk_font_embedded'] else '★なし'}")
        print(f"   文を正しくコピーできる: {'はい' if r['probe_copyable'] else '★いいえ'}")
        print(f"   透かし: {r['watermark'] or 'なし'}   置換文字(�): {r['replacement_chars']}")
        print(f"   生成: {r['producer']}")
        print(f"   しおり(目次): {r['outline'] or 'なし'}")
    existing = {}
    path = OUT / "inspect.json"
    if path.exists():
        existing = {r["file"]: r for r in json.loads(path.read_text())}
    existing.update({r["file"]: r for r in reports})
    path.write_text(json.dumps(list(existing.values()), ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
