import path from "node:path";
import { colorFromClass, highlightFromClass, htmlToMarkdown, stripRichTags } from "./rich-text";

// marked 只出 ESM,jest(CommonJS)直接載它的 UMD 版
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { marked } = require(path.join(process.cwd(), "node_modules/marked/lib/marked.umd.js")) as typeof import("marked");

/** 存檔的 Markdown 再渲染回 HTML(跟預覽、轉圖同一個設定) */
const render = (md: string) => marked.parse(md, { gfm: true, breaks: true, async: false }) as string;

describe("文件:編輯器 HTML ↔ Markdown", () => {
  it("粗體斜體、標題、清單、引用照 Markdown 的寫法存", () => {
    const md = htmlToMarkdown(
      "<h2>第一章</h2><p><em>他緩緩張開五指。</em></p><p>「我就在<strong>這裡</strong>。」</p><ul><li><p>一</p></li><li><p>二</p></li></ul><blockquote><p>引用</p></blockquote>"
    );
    expect(md).toBe("## 第一章\n\n*他緩緩張開五指。*\n\n「我就在**這裡**。」\n\n- 一\n- 二\n\n> 引用");
  });

  it("編號清單照順序編號", () => {
    expect(htmlToMarkdown("<ol><li><p>甲</p></li><li><p>乙</p></li></ol>")).toBe("1. 甲\n2. 乙");
  });

  it("段落裡的換行存成單一個換行", () => {
    expect(htmlToMarkdown("<p>第一行<br>第二行</p>")).toBe("第一行\n第二行");
    expect(render("第一行\n第二行")).toContain("<br>");
  });

  it("字色、底色、底線存成短標籤,渲染回來還在,裡面的粗體也還是粗體", () => {
    const md = htmlToMarkdown('<p>這句<span class="tc-red">紅<strong>字</strong></span>，<mark class="hl-yellow">黃底</mark>，<u>底線</u></p>');
    expect(md).toBe('這句<span class="tc-red">紅**字**</span>，<mark class="hl-yellow">黃底</mark>，<u>底線</u>');
    const html = render(md);
    expect(html).toContain('<span class="tc-red">紅<strong>字</strong></span>');
    expect(html).toContain('<mark class="hl-yellow">黃底</mark>');
  });

  it("置中、置右的段落存成帶對齊的 HTML 段落", () => {
    const md = htmlToMarkdown('<p>前面</p><p style="text-align: center">置中的<em>這段</em></p><h2 style="text-align: right">右邊標題</h2><p>後面</p>');
    expect(md).toBe('前面\n\n<p style="text-align: center">置中的<em>這段</em></p>\n\n<h2 style="text-align: right">右邊標題</h2>\n\n後面');
    const html = render(md);
    expect(html).toContain('<p style="text-align: center">置中的<em>這段</em></p>');
    expect(html).toContain("<p>後面</p>");
  });

  it("靠左就是一般段落,不多存東西", () => {
    expect(htmlToMarkdown('<p style="text-align: left">一般</p>')).toBe("一般");
  });

  it("從 class 讀出顏色", () => {
    expect(colorFromClass("tc-blue")).toBe("blue");
    expect(highlightFromClass("x hl-pink")).toBe("pink");
    expect(colorFromClass("other")).toBeNull();
  });
});

describe("文件:匯出成純文字", () => {
  it("拿掉字色、底色、底線、對齊的標籤", () => {
    expect(stripRichTags('a<span class="tc-red">紅</span><mark class="hl-pink">粉</mark><u>線</u>\n\n<p style="text-align: center">中</p>\n\n<h2 style="text-align: right">標</h2>')).toBe(
      "a紅粉線\n\n中\n\n## 標"
    );
  });
});
