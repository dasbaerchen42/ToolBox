import { parseAlbum, serializeAlbum, toSavedWork } from "@/lib/tools/beads/album";
import { DEFAULT_PALETTE } from "@/lib/tools/beads/palette";
import { recolorPattern, TEMPLATES, templatePattern } from "@/lib/tools/beads/templates";
import { artKey, defaultDesigns, parseArtKey } from "./design";
import { sanitizeDesigns } from "./persist";
import { motifPositions } from "./render";

const code = (index: number) => DEFAULT_PALETTE[index].code;
const indexOf = (c: string) => DEFAULT_PALETTE.findIndex((color) => color.code === c);

describe("周邊:換色", () => {
  it("artKey:沒換色就是 artId;換了色接在後面,順序固定,拆得回來", () => {
    expect(artKey({ artId: "tpl:star-7" })).toBe("tpl:star-7");
    expect(artKey({ artId: "tpl:star-7", recolor: { W34: "W75", W29: "W15" } })).toBe("tpl:star-7#W29>W15,W34>W75");
    expect(artKey({ artId: "a", recolor: { W01: "W01" } })).toBe("a");
    expect(parseArtKey("tpl:star-7#W29>W15,W34>W75")).toEqual({ artId: "tpl:star-7", recolor: { W29: "W15", W34: "W75" } });
    expect(parseArtKey("album:x")).toEqual({ artId: "album:x", recolor: {} });
  });

  it("照色號換色,只換指定的那一色;找不到的色號不換", () => {
    const star = templatePattern(TEMPLATES.find((tpl) => tpl.id === "star-7")!, DEFAULT_PALETTE);
    const out = recolorPattern(star, DEFAULT_PALETTE, { W29: "W75", NOPE: "W01" });
    const w29 = indexOf("W29");
    const w75 = indexOf("W75");
    star.cells.forEach((cell, i) => {
      expect(out.cells[i]).toBe(cell === w29 ? w75 : cell);
    });
    expect(recolorPattern(star, DEFAULT_PALETTE, {})).toBe(star);
    expect(code(w75)).toBe("W75");
  });
});

describe("周邊:自己拼的框", () => {
  it("框的圖樣:四個角都有、沿著邊排、都在卡片裡", () => {
    const w = 550;
    const h = 850;
    const spots = motifPositions(w, h, w * 0.07);
    const near = (x: number, y: number) => spots.some((s) => Math.abs(s.x - x) < 1 && Math.abs(s.y - y) < 1);
    const c = w * 0.07 * 0.55;
    expect(near(c, c) && near(w - c, c) && near(c, h - c) && near(w - c, h - c)).toBe(true);
    expect(spots.length).toBeGreaterThan(20);
    for (const s of spots) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(w);
      const onEdge = Math.abs(s.x - c) < 1 || Math.abs(s.x - (w - c)) < 1 || Math.abs(s.y - c) < 1 || Math.abs(s.y - (h - c)) < 1;
      expect(onEdge).toBe(true);
    }
  });
});

describe("周邊:存檔讀回", () => {
  it("換色、框的圖樣都讀得回來;壞掉的欄位用預設值;舊存檔的拼豆吊飾直接忽略", () => {
    const base = defaultDesigns();
    const saved = JSON.parse(
      JSON.stringify({
        ...base,
        card: { ...base.card, frame: "motif", frameArt: "tpl:star-7#W29>W75", stickers: [{ ...base.card.stickers[0], recolor: { W04: "W75" } }] },
        beadcharm: { artId: "album:abc", hardware: "strap" },
      })
    );
    const out = sanitizeDesigns(saved);
    expect(out.card.frame).toBe("motif");
    expect(out.card.frameArt).toBe("tpl:star-7#W29>W75");
    expect(out.card.stickers[0].recolor).toEqual({ W04: "W75" });
    expect("beadcharm" in out).toBe(false);

    const broken = sanitizeDesigns({
      card: { frame: "glitter", stickers: [{ ...base.card.stickers[0], recolor: { "W#1": 5 } }] },
    });
    expect(broken.card.frame).toBe(base.card.frame);
    expect(broken.card.stickers[0].recolor).toBeUndefined();
  });

  it("自己存的模板:收藏冊讀得回「模板」分頁", () => {
    const star = templatePattern(TEMPLATES[1], DEFAULT_PALETTE);
    const work = toSavedWork(star, DEFAULT_PALETTE, "我的星星", undefined, "2026-10-03T00:00:00Z", "template");
    const { works } = parseAlbum(serializeAlbum([work]));
    expect(works[0].kind).toBe("template");
    expect(works[0].colors).toHaveLength(2);
  });
});
