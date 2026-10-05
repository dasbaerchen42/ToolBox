import { applyBlockStyle, cleanInlineStyle, PLAIN_BLOCK, resolveBlockStyles, storeBlockStyles } from "./markdown";

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

describe("段落樣式存進文件", () => {
  const center = { align: "center", fill: "none", underline: false } as const;
  const pink = { align: "left", fill: "pink", underline: false } as const;

  it("存了再讀回來,還是同一段", () => {
    const blocks = ["<p>一</p>", "<p>二</p>", "<p>三</p>"];
    const stored = storeBlockStyles(blocks, [undefined, center, pink]);
    expect(stored).toHaveLength(2);
    expect(resolveBlockStyles(blocks, stored)).toEqual([undefined, center, pink]);
  });

  it("前面插了新段落,樣式跟著原本那段走", () => {
    const stored = storeBlockStyles(["<p>一</p>", "<p>二</p>"], [undefined, center]);
    expect(resolveBlockStyles(["<p>新</p>", "<p>一</p>", "<p>二</p>"], stored)).toEqual([undefined, undefined, center]);
  });

  it("那一段改了字,樣式還在原本的位置", () => {
    const stored = storeBlockStyles(["<p>一</p>", "<p>二</p>"], [undefined, center]);
    expect(resolveBlockStyles(["<p>一</p>", "<p>二改過</p>"], stored)).toEqual([undefined, center]);
  });

  it("段落被刪掉了,樣式不會跑到別段", () => {
    const stored = storeBlockStyles(["<p>一</p>", "<p>二</p>", "<p>三</p>"], [undefined, center, undefined]);
    expect(resolveBlockStyles(["<p>一</p>", "<p>三</p>"], stored)).toEqual([undefined, undefined]);
  });

  it("同樣內容的段落有好幾段,挑原本位置最近的", () => {
    const stored = storeBlockStyles(["<p>同</p>", "<p>x</p>", "<p>同</p>"], [undefined, undefined, pink]);
    expect(resolveBlockStyles(["<p>同</p>", "<p>x</p>", "<p>同</p>"], stored)).toEqual([undefined, undefined, pink]);
  });
});
