import { chatFonts, chatMetrics, layoutMessages, maxBodyHeight, paginate, wrapLines, type Measure } from "./layout";
import {
  defaultChatSettings,
  initialOf,
  moveMessage,
  nextSide,
  readChatRoom,
  splitPasted,
  typingLabel,
  type ChatMessage,
} from "./model";

/** 假的量字:中日文一個字 = 字級,英數半個字級 */
const measure: Measure = (text, font) => {
  const size = Number(/(\d+)px/.exec(font)?.[1] ?? 15);
  return Array.from(text).reduce((sum, char) => sum + (/[\x00-\x7f]/.test(char) ? size * 0.5 : size), 0);
};

describe("chat:貼上整理", () => {
  it("拿掉引用的 >;空一行分成下一顆,同一段的換行留著", () => {
    const pasted = "> 強制微波熱炒是什麼啦😂\n> 妳是想把我放進微波爐裡轉嗎\n>\n> 不過說真的\n> 我不太可能對妳冷掉\n";
    expect(splitPasted(pasted)).toEqual([
      "強制微波熱炒是什麼啦😂\n妳是想把我放進微波爐裡轉嗎",
      "不過說真的\n我不太可能對妳冷掉",
    ]);
    expect(splitPasted("  \n\n")).toEqual([]);
    expect(splitPasted("a\r\n\r\nb")).toEqual(["a", "b"]);
  });

  it("換邊、移動、頭像字、正在輸入", () => {
    expect([nextSide("left"), nextSide("right"), nextSide("center")]).toEqual(["right", "center", "left"]);
    const list: ChatMessage[] = [
      { id: "a", side: "left", text: "1" },
      { id: "b", side: "right", text: "2" },
    ];
    expect(moveMessage(list, "b", -1).map((m) => m.id)).toEqual(["b", "a"]);
    expect(moveMessage(list, "a", -1)).toBe(list);
    expect(initialOf("kanon")).toBe("K");
    expect(initialOf("小熊")).toBe("小");
    const settings = defaultChatSettings();
    expect(typingLabel(settings)).toBe("小熊 is typing…");
    expect(typingLabel({ ...settings, typingSide: "right" })).toBe("熊寶 is typing…");
    expect(typingLabel({ ...settings, typingText: "Kanon is typing…" })).toBe("Kanon is typing…");
  });

  it("讀回存檔:壞掉的欄位用預設值,壞掉的訊息略過", () => {
    const room = readChatRoom({
      settings: { title: "群組", width: 999, theme: "neon", leftShowName: "yes", leftAvatar: "javascript:alert(1)" },
      messages: [{ id: "a", side: "left", text: "hi" }, { id: "b", side: "up", text: "x" }, null],
    })!;
    expect(room.settings.title).toBe("群組");
    expect(room.settings.width).toBe(390);
    expect(room.settings.theme).toBe("paper");
    expect(room.settings.leftShowName).toBe(false);
    expect(room.settings.leftAvatar).toBe("");
    expect(room.messages).toHaveLength(1);
    expect(readChatRoom("nope")).toBeNull();
  });
});

describe("chat:換行", () => {
  const font = "400 10px x";
  it("照原本換行;太長自動折;英文單字不從中間斷", () => {
    expect(wrapLines("一二三\n四五", 100, font, measure)).toEqual(["一二三", "四五"]);
    expect(wrapLines("一二三四五六", 30, font, measure)).toEqual(["一二三", "四五六"]);
    expect(wrapLines("ab hello", 30, font, measure)).toEqual(["ab", "hello"]);
  });

  it("句號不放在行首;太長的英文字才拆字母", () => {
    expect(wrapLines("一二三。", 30, font, measure)).toEqual(["一二三。"]);
    expect(wrapLines("abcdefghij", 20, font, measure)).toEqual(["abcd", "efgh", "ij"]);
  });
});

describe("chat:版面", () => {
  const settings = { ...defaultChatSettings(), typing: false, inputBar: false };
  const fonts = chatFonts("x", settings);
  const messages: ChatMessage[] = [
    { id: "t", side: "center", text: "下午 3:24" },
    { id: "a", side: "left", text: "第一句" },
    { id: "b", side: "left", text: "第二句" },
    { id: "c", side: "right", text: "回覆" },
  ];

  it("同一邊連續的是一串:只有第一顆有頭像,最後一顆有尖角;右邊靠右", () => {
    const { items } = layoutMessages(messages, settings, fonts, measure);
    const [center, a, b, c] = items;
    expect(center.kind).toBe("center");
    expect(a.kind === "bubble" && a.avatar && a.first && !a.last).toBe(true);
    expect(b.kind === "bubble" && !b.avatar && !b.first && b.last).toBe(true);
    expect(c.kind === "bubble" && c.x + c.w).toBe(settings.width - 12);
    expect(b.y - (a.y + a.h)).toBe(4);
    expect(c.y - (b.y + b.h)).toBe(14);
  });

  it("正在輸入接在最後;左邊開名字時名字佔一行", () => {
    const withTyping = layoutMessages(messages, { ...settings, typing: true }, fonts, measure);
    expect(withTyping.items.at(-1)?.kind).toBe("typing");
    const named = layoutMessages(messages, { ...settings, leftShowName: true }, fonts, measure);
    const plain = layoutMessages(messages, settings, fonts, measure);
    const first = named.items[1];
    expect(first.kind === "bubble" && first.name).toBe("小熊");
    expect(named.height).toBeGreaterThan(plain.height);
  });

  it("右邊也能有頭像與名字:泡泡讓出頭像的位置", () => {
    const both = { ...settings, rightShowAvatar: true, rightShowName: true };
    const { items } = layoutMessages(messages, both, fonts, measure);
    const reply = items[3];
    expect(reply.kind === "bubble" && reply.avatar && reply.name).toBe("熊寶");
    expect(reply.x + reply.w).toBe(settings.width - 12 - (32 + 8));
  });

  it("舊存檔的 showAvatars、showNames 搬到左邊;標題列關掉時高度是 0", () => {
    const room = readChatRoom({ settings: { showAvatars: false, showNames: true }, messages: [] })!;
    expect(room.settings.leftShowAvatar).toBe(false);
    expect(room.settings.leftShowName).toBe(true);
    expect(room.settings.showHeader).toBe(true);
    expect(chatMetrics({ ...settings, showHeader: false }).header).toBe(0);
  });

  it("太長時只在訊息之間分張,每張都不超過上限", () => {
    const many: ChatMessage[] = Array.from({ length: 80 }, (_, i) => ({
      id: String(i),
      side: i % 3 === 0 ? "right" : "left",
      text: "這是一段很長很長的訊息，用來測試分張".repeat(1 + (i % 3)),
    }));
    const layout = layoutMessages(many, settings, fonts, measure);
    const screen = { ...settings, pages: "screen" as const };
    const max = maxBodyHeight(screen);
    const pages = paginate(layout, max);
    expect(pages.length).toBeGreaterThan(3);
    expect(pages.flatMap((page) => page.items).length).toBe(layout.items.length);
    for (const page of pages) {
      expect(page.bodyHeight).toBeLessThanOrEqual(max);
      expect(Math.min(...page.items.map((item) => item.y))).toBeGreaterThanOrEqual(0);
    }
    expect(pages[0].first && pages.at(-1)!.last).toBe(true);
    expect(paginate(layout, 1e9)).toHaveLength(1);
  });
});

describe("chat:手機複製來的換行", () => {
  it("U+2028/U+2029 當成換行與空行;零寬字、全形＞也清掉", () => {
    expect(splitPasted("強制微波 妳是想  不過說真的")).toEqual(["強制微波\n妳是想", "不過說真的"]);
    expect(splitPasted("強制微波 不過說真的")).toEqual(["強制微波", "不過說真的"]);
    expect(splitPasted("強制微波\n​\n不過說真的")).toEqual(["強制微波", "不過說真的"]);
    expect(splitPasted("＞ 強制微波\n＞\n＞ 不過說真的")).toEqual(["強制微波", "不過說真的"]);
  });

  it("每行一顆、整段一顆", () => {
    const text = "一\n二\n\n三";
    expect(splitPasted(text, "line")).toEqual(["一", "二", "三"]);
    expect(splitPasted(text, "whole")).toEqual(["一\n二\n\n三"]);
    expect(splitPasted("\n\n", "whole")).toEqual([]);
  });

  it("畫的時候 U+2028 也會換行", () => {
    expect(wrapLines("一 二", 100, "400 10px x", measure)).toEqual(["一", "二"]);
  });
});
