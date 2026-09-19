import { convertAll } from "./convert";
import {
  DEFAULT_CUSTOM_RULES,
  DEFAULT_FULLWIDTH_OPTIONS,
} from "./types";
import type { FullwidthOptions } from "./types";

function convert(text: string, overrides: Partial<FullwidthOptions> = {}) {
  return convertAll(
    text,
    { ...DEFAULT_FULLWIDTH_OPTIONS, ...overrides },
    DEFAULT_CUSTOM_RULES
  );
}

// ─── 中英混排段落：外文子句保護 ──────────────────────────────────────────────

describe("protectLatinClauses（中英混排段落）", () => {
  it("中文子句的半形逗號轉全形", () => {
    expect(
      convert("*電梯門在身後合攏,狹小的金屬空間裡瞬間只剩下兩人。*")
    ).toBe("*電梯門在身後合攏，狹小的金屬空間裡瞬間只剩下兩人。*");
  });

  it("同一段落中，英文對白保留半形、中文敘述轉全形", () => {
    const input =
      "「Wrong floor.（樓層錯了。）」*他簡短地說道,語氣平淡得像在陳述一個不容質疑的事實。*";
    const output = convert(input, { convertPeriod: true });

    expect(output).toContain("Wrong floor.");
    expect(output).toContain("他簡短地說道，語氣平淡得像在陳述一個不容質疑的事實。");
  });

  it("長句混排：英文的逗號、句號、問號都保留，中文的都轉換", () => {
    const input =
      "「Six people crammed into one room, shared bathrooms, no soundproofing, and zero privacy. Tell me, how exactly are you supposed to recover your mental energy in that kind of environment?（六個人擠在一間房,共用浴室,沒有隔音,零隱私。告訴我,你到底要怎麼在那種環境裡恢復你的精神力?）」";
    const output = convert(input, { convertPeriod: true });

    expect(output).toContain(
      "Six people crammed into one room, shared bathrooms, no soundproofing, and zero privacy. Tell me, how exactly are you supposed to recover your mental energy in that kind of environment?"
    );
    expect(output).toContain(
      "（六個人擠在一間房，共用浴室，沒有隔音，零隱私。告訴我，你到底要怎麼在那種環境裡恢復你的精神力？）"
    );
  });

  it("中文子句結尾的半形問號轉全形", () => {
    expect(convert("「一般的休息宿舍?」")).toBe("「一般的休息宿舍？」");
  });

  it("英文結尾的連續句點（刪節號）不被拆散", () => {
    const output = convert("「Also... take care of yourself.」", {
      convertPeriod: true,
    });
    expect(output).toBe("「Also... take care of yourself.」");
  });

  it("英文的 ?! 連用視為一體保留", () => {
    expect(convert("「What?!」他愣住了。")).toBe("「What?!」他愣住了。");
  });

  it("括號成對判斷：純外文括號保留，中文括號轉換", () => {
    expect(convert("(laughs)他說(這樣啊)")).toBe("(laughs)他說（這樣啊）");
  });

  it("關閉 protectLatinClauses 時回到整段轉換的舊行為", () => {
    const output = convert("「Wrong floor.」*他說道,如此。*", {
      convertPeriod: true,
      protectLatinClauses: false,
    });
    expect(output).toBe("「Wrong floor。」*他說道，如此。*");
  });
});

// ─── 既有防護不受影響 ────────────────────────────────────────────────────────

describe("既有的數字防護", () => {
  it("時間的冒號不轉換", () => {
    expect(convert("時間是 10:22 沒錯")).toBe("時間是 10:22 沒錯");
  });

  it("數字千分位逗號不轉換", () => {
    expect(convert("共 1,000 元,很貴")).toBe("共 1,000 元，很貴");
  });
});

describe("純外文段落", () => {
  it("純英文段落經子句保護後整段維持原樣", () => {
    const input = "Hello, world! How are you?\n\n你好,世界!";
    expect(convert(input)).toBe("Hello, world! How are you?\n\n你好，世界！");
  });
});

// ─── 整合：使用者提供的實際文本 ──────────────────────────────────────────────

describe("整合測試：RP 混排文本", () => {
  const sample = [
    "Page.25｜裂隙紀元18年07月23日 10:22",
    "",
    "*當按下宿舍區的樓層按鈕時,他的視線落在那個發亮的數字上,眉頭微不可察地皺了起來。*",
    "",
    "「From now on, you'll be using the First Division's facilities. That includes accommodation. Non-negotiable.（從現在開始,將使用第一部隊的設施。包括住宿。不容商量。）」",
  ].join("\n");

  it("英文維持原樣、中文標點轉為全形", () => {
    const output = convert(sample, { convertPeriod: true });

    expect(output).toContain("Page.25");
    expect(output).toContain("10:22");
    expect(output).toContain(
      "From now on, you'll be using the First Division's facilities. That includes accommodation. Non-negotiable."
    );
    expect(output).toContain(
      "*當按下宿舍區的樓層按鈕時，他的視線落在那個發亮的數字上，眉頭微不可察地皺了起來。*"
    );
    expect(output).toContain(
      "（從現在開始，將使用第一部隊的設施。包括住宿。不容商量。）"
    );
  });
});

// ─── 修正變成斜體的對話 ────────────────────────────────────────────────────

describe("fixMiswrappedDialogueItalics", () => {
  // 只驗斜體規則，別讓標點轉換混進預期值
  function italic(text: string) {
    return convert(text, {
      fixMiswrappedDialogueItalics: true,
      convertColon: false,
      convertComma: false,
      convertQuestion: false,
      convertExclamation: false,
      convertPeriod: false,
      convertSemicolon: false,
      convertParentheses: false,
      convertBraces: false,
      convertQuotes: false,
      protectLatinClauses: false,
    });
  }

  it("形狀 A：整句被包起來 → 斜體只留在旁白上", () => {
    expect(italic("*「對話對話對話」旁白旁白旁白：「對話對話」*")).toBe(
      "「對話對話對話」*旁白旁白旁白：*「對話對話」"
    );
  });

  it("形狀 B：每段對話各自被包 → 斜體搬到中間的旁白，不是全部清掉", () => {
    // 這是回報的災情：原本兩條 regex 會把兩組 *「」* 各自拆掉，連旁白的斜體一起沒了
    expect(italic("*「對話對話對話」*旁白旁白旁白：*「對話對話」*")).toBe(
      "「對話對話對話」*旁白旁白旁白：*「對話對話」"
    );
  });

  it("三段以上的對話也算數（舊規則只認剛好兩段）", () => {
    expect(italic("*「一」旁白「二」旁白「三」*")).toBe(
      "「一」*旁白*「二」*旁白*「三」"
    );
  });

  it("旁白在最前面（舊規則完全不處理）", () => {
    expect(italic("*旁白旁白「對話」*")).toBe("*旁白旁白*「對話」");
  });

  it("旁白在最後面", () => {
    expect(italic("*「對話」旁白旁白*")).toBe("「對話」*旁白旁白*");
  });

  it("整句都是對話：拿掉斜體，沒有旁白可以接手", () => {
    expect(italic("*「對話對話」*")).toBe("「對話對話」");
  });

  it("『』也算對話", () => {
    expect(italic("*『對話』旁白『對話』*")).toBe("『對話』*旁白*『對話』");
  });

  it("本來就對的不要動它", () => {
    const right = "「對話對話對話」*旁白旁白旁白：*「對話對話」";
    expect(italic(right)).toBe(right);
  });

  it("純旁白的斜體整段保留", () => {
    expect(italic("*他放下平板，身體往後靠進沙發墊裡。*")).toBe(
      "*他放下平板，身體往後靠進沙發墊裡。*"
    );
  });

  it("貼上時星號就掉了的話，這裡救不回來——不會無中生有", () => {
    const noAsterisk = "「對話對話對話」旁白旁白旁白：「對話對話」";
    expect(italic(noAsterisk)).toBe(noAsterisk);
  });

  it("不碰粗體", () => {
    expect(italic("**重點**「對話」")).toBe("**重點**「對話」");
  });

  it("落單的星號原樣留著，不硬配對", () => {
    expect(italic("三點五*四「對話」")).toBe("三點五*四「對話」");
  });

  it("多行各自處理，不會跨行配對", () => {
    expect(italic("*「一」旁白「二」*\n*「三」旁白「四」*")).toBe(
      "「一」*旁白*「二」\n「三」*旁白*「四」"
    );
  });

  it("沒勾選就完全不動", () => {
    const input = "*「對話」*旁白*「對話」*";
    expect(convert(input, { fixMiswrappedDialogueItalics: false })).toBe(input);
  });
});
