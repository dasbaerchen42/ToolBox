import { maskHtml, parseMaskTerms } from "./export-mask";

describe("轉圖:文字遮罩", () => {
  it("逗號、頓號、換行都能隔開;去空白、去重,長的先比", () => {
    expect(parseMaskTerms(" 小明，小明明、阿花\n\n小明 ,")).toEqual(["小明明", "小明", "阿花"]);
    expect(parseMaskTerms("   ")).toEqual([]);
  });

  it("只遮文字,不動標籤與屬性", () => {
    const out = maskHtml('<p title="小明">小明說<b>你好</b></p>', ["小明"]);
    expect(out).toContain('<p title="小明">');
    expect(out.match(/data-mask/g)).toHaveLength(1);
    expect(out).toContain(">小明</span>說<b>你好</b></p>");
    expect(out.startsWith('<p title="小明"><span data-mask=""')).toBe(true);
  });

  it("長的詞優先,不會只遮到一半", () => {
    const out = maskHtml("<p>小明明和小明</p>", parseMaskTerms("小明,小明明"));
    expect(out).toContain(">小明明</span>和");
    expect(out.match(/data-mask/g)).toHaveLength(2);
  });

  it("英文不分大小寫,特殊符號照字面比", () => {
    expect(maskHtml("<p>Alex and ALEX</p>", ["alex"]).match(/data-mask/g)).toHaveLength(2);
    expect(maskHtml("<p>a.b axb</p>", ["a.b"]).match(/data-mask/g)).toHaveLength(1);
    expect(maskHtml("<p>A &amp; B</p>", ["A & B"]).match(/data-mask/g)).toHaveLength(1);
  });

  it("緊貼前後的標點跟遮罩綁在一起,不會落單在行首或行尾", () => {
    const out = maskHtml("<p>他說：「小明，你好」</p>", ["小明"]);
    expect(out).toContain('他說：<span style="white-space: nowrap">「<span data-mask=""');
    expect(out).toContain(">小明</span>，</span>你好");
  });

  it("沒有遮罩字就原樣回傳", () => {
    expect(maskHtml("<p>x</p>", [])).toBe("<p>x</p>");
  });
});
