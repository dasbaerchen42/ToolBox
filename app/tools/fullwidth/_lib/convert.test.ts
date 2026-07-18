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
