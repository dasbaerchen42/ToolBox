/**
 * @jest-environment jsdom
 */
import { chatBlockHtml, chatBubbles, composeChatHtml, defaultChatSides, nextChatSide } from "./chat-export";

const quote =
  "<blockquote><p>強制微波熱炒是什麼啦<br>妳是想把我放進微波爐裡轉嗎</p><p>不過說真的<br>我不太可能對妳冷掉</p></blockquote>";

describe("chat-export:對話框", () => {
  it("引用預設放左邊,一般段落不標", () => {
    const sides = defaultChatSides(["<p>旁白</p>", quote, "<hr>"]);
    expect(sides.get(1)).toBe("left");
    expect(sides.has(0)).toBe(false);
    expect(sides.has(2)).toBe(false);
  });

  it("標記循環:不標 → 左 → 右 → 不標", () => {
    expect(nextChatSide(undefined)).toBe("left");
    expect(nextChatSide("left")).toBe("right");
    expect(nextChatSide("right")).toBeUndefined();
  });

  it("引用裡每一行一顆泡泡,空一行就分組", () => {
    expect(chatBubbles(quote)).toEqual([
      ["強制微波熱炒是什麼啦", "妳是想把我放進微波爐裡轉嗎"],
      ["不過說真的", "我不太可能對妳冷掉"],
    ]);
    // 一般段落也能標:整段照換行拆
    expect(chatBubbles("<p><em>想我了</em><br><br>就直說嘛</p>")).toEqual([["<em>想我了</em>", "就直說嘛"]]);
  });

  it("名字只在一串的第一段出現,而且會轉義", () => {
    const first = chatBlockHtml(quote, "left", "<b>仁</b>", false);
    expect(first).toContain('class="chat-group chat-left"');
    expect(first).toContain("&#60;b&#62;仁&#60;/b&#62;");
    expect(first.match(/chat-bubble/g)).toHaveLength(4);
    const next = chatBlockHtml(quote, "left", "仁", true);
    expect(next).not.toContain("chat-name");
    expect(next).toContain("chat-continued");
  });

  it("沒標的段落照原樣;連續同一邊算接續", () => {
    const out = composeChatHtml(
      [
        { html: "<p>他按下傳送鍵</p>" },
        { html: quote, side: "left" },
        { html: "<blockquote><p>好啦</p></blockquote>", side: "left" },
        { html: "<blockquote><p>想你</p></blockquote>", side: "right" },
      ],
      { left: "仁", right: "歌" }
    );
    expect(out[0]).toBe("<p>他按下傳送鍵</p>");
    expect(out[1]).toContain("chat-name");
    expect(out[2]).toContain("chat-continued");
    expect(out[3]).toContain("chat-right");
    expect(out[3]).toContain(">歌<");
  });
});

describe("chat-export:每段一顆", () => {
  it("同一段的短句放進同一顆泡泡,照原本換行;空一行才換下一顆", () => {
    const html = chatBlockHtml(quote, "left", "", false, "paragraph");
    expect(html.match(/class="chat-bubble"/g)).toHaveLength(2);
    expect(html).toContain("強制微波熱炒是什麼啦<br>妳是想把我放進微波爐裡轉嗎");
    const out = composeChatHtml([{ html: quote, side: "right" }], { left: "", right: "" }, "paragraph");
    expect(out[0].match(/class="chat-bubble"/g)).toHaveLength(2);
  });
});
