import { cleanInlineStyle, resolveBlockStyles, storeBlockStyles } from "./markdown";

describe("貼上的 HTML:行內樣式", () => {
  it("顏色、底色、字體、字級拿掉;粗體斜體底線對齊留著", () => {
    expect(
      cleanInlineStyle("color: rgb(0, 0, 0); background-color: #fff; font-weight: 700; font-family: Arial; font-size: 11pt; text-decoration: underline")
    ).toBe("font-weight: 700; text-decoration: underline");
    expect(cleanInlineStyle("COLOR:black;Font-Style:italic")).toBe("Font-Style:italic");
    expect(cleanInlineStyle("background: white")).toBe("");
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
