/**
 * @jest-environment jsdom
 */
import { hasItalicMarkup, htmlToItalicText, titleFromContent } from "./clipboard";

describe("hasItalicMarkup", () => {
  it("認得 <em> 與 <i>", () => {
    expect(hasItalicMarkup("<p>旁白<em>斜體</em></p>")).toBe(true);
    expect(hasItalicMarkup("<i>斜體</i>")).toBe(true);
  });

  it("也認得 Google Docs 那種 inline style", () => {
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
