import {
  EDITOR_FONT_OPTIONS,
  IMAGE_FONT_OPTIONS,
  fontExtraLetterSpacingEm,
  fontWeightFor,
  getFontStyle,
} from "./editor-font";
import { HIGHLIGHTS, TEXT_COLORS } from "./rich-text";

describe("編輯器色票與字體提案", () => {
  it("文字色與底色各保留十二色", () => {
    expect(TEXT_COLORS).toHaveLength(12);
    expect(HIGHLIGHTS).toHaveLength(12);
    expect(new Set(TEXT_COLORS.map((item) => item.key)).size).toBe(12);
    expect(new Set(HIGHLIGHTS.map((item) => item.key)).size).toBe(12);
  });

  it("編輯器提供核心與英文預覽，影像工作臺另加效果字", () => {
    expect(EDITOR_FONT_OPTIONS.filter((item) => item.group === "core")).toHaveLength(8);
    expect(EDITOR_FONT_OPTIONS.filter((item) => item.group === "latin")).toHaveLength(4);
    expect(EDITOR_FONT_OPTIONS.some((item) => item.group === "effect")).toBe(false);
    expect(IMAGE_FONT_OPTIONS.filter((item) => item.group === "effect").map((item) => item.key)).toEqual([
      "chenyu",
      "ryusenkei",
      "kaitou",
      "konatu",
    ]);
  });

  it("Shippori 衍生明體固定使用 500、90% 字面與 0.06em 額外字距", () => {
    const option = EDITOR_FONT_OPTIONS.find((item) => item.key === "shippori");
    expect(option?.note).toBe("500・90% 寬・微寬字距");
    expect(fontWeightFor("shippori")).toBe(500);
    expect(fontExtraLetterSpacingEm("shippori")).toBe(0.06);
    expect(getFontStyle("shippori", 1).letterSpacing).toBe("calc(1px + 0.06em)");
  });
});
