/**
 * @jest-environment jsdom
 */
import { hasInlineMarkdown, hasItalicMarkup, htmlToItalicText, inlineMarkdownForPaste, richHtmlToPlainText, titleFromContent } from "./clipboard";

describe("hasInlineMarkdown", () => {
  it("認得夾在正體文字中間的斜體", () => {
    expect(hasInlineMarkdown("文字*斜體文字*文字")).toBe(true);
    expect(hasInlineMarkdown("「正體」*斜體：*「正體」")).toBe(true);
  });

  it("認得段落開頭的粗體，也不誤判單獨星號", () => {
    expect(hasInlineMarkdown("**段落開頭**接續文字")).toBe(true);
    expect(hasInlineMarkdown("一般文字 * 一般文字")).toBe(false);
  });

  it("中文標點貼著星號時仍轉成斜體，段首粗體也直接轉好", () => {
    expect(inlineMarkdownForPaste("文字，*斜體：*文字")).toBe("文字，<em>斜體：</em>文字");
    expect(inlineMarkdownForPaste("**粗體開頭**接續")).toBe("<strong>粗體開頭</strong>接續");
  });
});

describe("richHtmlToPlainText", () => {
  it("相鄰段落只放一個換行", () => {
    expect(richHtmlToPlainText("<p>第一句</p><p>第二句</p><p>第三句</p>")).toBe("第一句\n第二句\n第三句");
  });

  it("真正的空白段落仍會保留", () => {
    expect(richHtmlToPlainText("<p>第一段</p><p><br></p><p>第二段</p>")).toBe("第一段\n\n第二段");
  });

  it("行內格式不會污染純文字，br 仍是換行", () => {
    expect(richHtmlToPlainText("<p><strong>粗體</strong><br><em>斜體</em></p>")).toBe("粗體\n斜體");
  });
});

describe("hasItalicMarkup", () => {
  it("認得 <em> 與 <i>", () => {
    expect(hasItalicMarkup("<p>旁白<em>斜體</em></p>")).toBe(true);
    expect(hasItalicMarkup("<i>斜體</i>")).toBe(true);
  });

  it("也認得文書編輯器常用的 inline style", () => {
    expect(hasItalicMarkup('<span style="font-style:italic">旁白</span>')).toBe(true);
  });

  it("沒有斜體就是沒有", () => {
    expect(hasItalicMarkup("<p><b>粗體</b></p>")).toBe(false);
    expect(hasItalicMarkup(null)).toBe(false);
  });
});

describe("htmlToItalicText", () => {
  it("把 <em> 還原成星號——這是斜體規則有東西可修的前提", () => {
    expect(
      htmlToItalicText("<p>「對話對話對話」<em>旁白旁白旁白：</em>「對話對話」</p>")
    ).toBe("「對話對話對話」*旁白旁白旁白：*「對話對話」");
  });

  it("整句都是斜體時包在最外層", () => {
    expect(htmlToItalicText("<p><em>「對話」旁白：「對話」</em></p>")).toBe(
      "*「對話」旁白：「對話」*"
    );
  });

  it("inline style 的斜體一樣抓得到", () => {
    expect(
      htmlToItalicText('<div>「對話」<span style="font-style: italic;">旁白</span></div>')
    ).toBe("「對話」*旁白*");
  });

  it("巢狀斜體不會疊出兩層星號", () => {
    expect(htmlToItalicText("<em>外層<i>內層</i></em>")).toBe("*外層內層*");
  });

  it("<br> 與區塊邊界換行", () => {
    expect(htmlToItalicText("<p>第一段</p><p>第二段</p>")).toBe("第一段\n第二段");
    expect(htmlToItalicText("一<br>二")).toBe("一\n二");
  });

  it("HTML 的排版空白會被壓掉,不會變成一堆空行", () => {
    expect(htmlToItalicText("<p>\n  一段話\n</p>\n\n<p>\n  另一段\n</p>")).toBe(
      "一段話\n另一段"
    );
  });

  it("只框到空白的斜體是空殼,不留星號", () => {
    expect(htmlToItalicText("一<em> </em>二")).toBe("一 二");
  });

  it("script / style 的內容不會跑進文字裡", () => {
    expect(htmlToItalicText("<p>正文</p><script>alert(1)</script>")).toBe("正文");
    expect(htmlToItalicText("<style>p{color:red}</style><p>正文</p>")).toBe("正文");
  });

  it("HTML 實體會被解開", () => {
    expect(htmlToItalicText("<p>&lt;標籤&gt; &amp; 符號</p>")).toBe("<標籤> & 符號");
  });
});

describe("titleFromContent", () => {
  it("用第一行非空白的內容當標題", () => {
    expect(titleFromContent("\n\n  # 標題\n內文")).toBe("標題");
  });

  it("全空白時回預設值", () => {
    expect(titleFromContent("   \n  ")).toBe("未命名文件");
  });
});
