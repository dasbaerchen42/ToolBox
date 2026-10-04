import { applyBlockStyle, cleanInlineStyle, PLAIN_BLOCK } from "./markdown";

describe("貼上的 HTML:行內樣式", () => {
  it("顏色、底色、字體、字級拿掉;粗體斜體底線對齊留著", () => {
    expect(
      cleanInlineStyle("color: rgb(0, 0, 0); background-color: #fff; font-weight: 700; font-family: Arial; font-size: 11pt; text-decoration: underline")
    ).toBe("font-weight: 700; text-decoration: underline");
    expect(cleanInlineStyle("COLOR:black;Font-Style:italic")).toBe("Font-Style:italic");
    expect(cleanInlineStyle("background: white")).toBe("");
  });
});

describe("文轉圖:段落樣式", () => {
  it("沒有樣式就原樣回傳", () => {
    expect(applyBlockStyle("<p>字</p>", undefined)).toBe("<p>字</p>");
    expect(applyBlockStyle("<p>字</p>", PLAIN_BLOCK)).toBe("<p>字</p>");
  });

  it("置中、底色、底線加在最外層標籤上;原本的 style 留著", () => {
    const out = applyBlockStyle('<p class="a">字<b>粗</b></p>', { align: "center", fill: "yellow", underline: true });
    expect(out.startsWith('<p class="a" style="text-align: center; background: rgba(255, 200, 60, 0.28)')).toBe(true);
    expect(out).toContain("text-decoration: underline");
    expect(out.endsWith("字<b>粗</b></p>")).toBe(true);
    const merged = applyBlockStyle('<p style="font-weight: 700">字</p>', { ...PLAIN_BLOCK, align: "right" });
    expect(merged).toBe('<p style="font-weight: 700; text-align: right">字</p>');
  });
});
