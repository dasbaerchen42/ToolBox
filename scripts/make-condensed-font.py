"""Build the ToolBox 90%-width Shippori derivative used by the editor.

The modified family is renamed as required by the SIL Open Font License.
Run with: python scripts/make-condensed-font.py INPUT.ttf OUTPUT.woff2
"""

from pathlib import Path
import sys

from fontTools.ttLib import TTFont


def set_name(font: TTFont, name_id: int, value: str) -> None:
    for record in font["name"].names:
        if record.nameID == name_id:
            record.string = value.encode(record.getEncoding(), errors="replace")


def main(source: Path, target: Path) -> None:
    font = TTFont(source)
    glyf = font["glyf"]

    for glyph in glyf.glyphs.values():
        if glyph.isComposite():
            glyph.expand(glyf)
            for component in glyph.components:
                if hasattr(component, "x"):
                    component.x = round(component.x * 0.9)
            continue
        glyph.expand(glyf)
        if getattr(glyph, "numberOfContours", 0) == 0:
            continue
        glyph.coordinates.scale((0.9, 1.0))

    font["hmtx"].metrics = {
        glyph_name: (round(advance * 0.9), round(left_bearing * 0.9))
        for glyph_name, (advance, left_bearing) in font["hmtx"].metrics.items()
    }
    if "OS/2" in font:
        font["OS/2"].xAvgCharWidth = round(font["OS/2"].xAvgCharWidth * 0.9)

    family = "ToolBox Shiori 90"
    set_name(font, 1, family)
    set_name(font, 2, "Medium")
    set_name(font, 4, f"{family} Medium")
    set_name(font, 6, "ToolBoxShiori90-Medium")
    target.parent.mkdir(parents=True, exist_ok=True)
    font.flavor = "woff2" if target.suffix.lower() == ".woff2" else None
    font.save(target)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: make-condensed-font.py INPUT.ttf OUTPUT.woff2")
    main(Path(sys.argv[1]), Path(sys.argv[2]))
