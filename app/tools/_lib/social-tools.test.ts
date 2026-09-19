import { convertSocialText } from "./social";
import {
  analyzeSocial,
  countSocial,
  describeSocial,
} from "./social-marks";
import { applyToSelection, insertAt, replaceRange, selectionScope } from "./text-edit";
import { buildDivider, DIVIDER_UNITS } from "./dividers";
import { addToRecent } from "./recent";
import { filterSymbols, SYMBOL_GROUPS } from "./symbols";
import { filterKaomoji, KAOMOJI_GROUPS } from "./kaomoji";
import { describeGaps, gapsFor } from "./font-notes";
import { matchesKeyword } from "./search";
import { getFontResults } from "./fancy-fonts";
import { hasStyledText, toPlainText } from "./font-restore";
import {
  addCustom,
  emptySets,
  mergeSets,
  parseImport,
  removeCustom,
  serialize,
} from "./custom-items";

describe("social-marks:看穿隱形字元", () => {
  const sample = "第一行\n\n    縮排四格\n最後一行";

  it("逐行判斷出空行與縮排", () => {
    expect(analyzeSocial(sample)).toEqual([
      { kind: "plain", text: "第一行" },
      { kind: "blank", length: 0 },
      { kind: "indent", spaces: 4, text: "縮排四格" },
      { kind: "plain", text: "最後一行" },
    ]);
  });

  it("算出來的字元數等於實際轉換後多出來的長度", () => {
    const count = countSocial(analyzeSocial(sample));
    expect(count).toEqual({ blankLines: 1, indentSpaces: 4, chars: 5, trimmed: 0 });
    // 這條是關鍵:計數若跟真正的轉換對不上,介面上的數字就是在騙人
    expect(convertSocialText(sample).length - sample.length).toBe(count.chars);
    expect(count.trimmed).toBe(0);
  });

  it("已經轉換過的文字不會被重複計算（轉換本身是冪等的）", () => {
    const once = convertSocialText(sample);
    expect(convertSocialText(once)).toBe(once);
    expect(countSocial(analyzeSocial(once)).chars).toBe(0);
  });

  it("空字串什麼都不算——轉換本身也是什麼都不插", () => {
    expect(analyzeSocial("")).toEqual([]);
    expect(countSocial(analyzeSocial("")).chars).toBe(0);
    expect(convertSocialText("")).toBe("");
  });

  it.each([
    ["", "空字串"],
    ["一行", "單行"],
    ["\n", "只有換行"],
    ["  ", "只有空白"],
    ["a\n\n\nb", "連續空行"],
    ["  縮排\n\n    更深", "縮排加空行"],
    ["已經轉過的\n⠀\n結果", "已轉換過"],
  ])("計數與實際轉換永遠對得上（%s）", (input) => {
    // 插入的隱形字元減掉空行被吃掉的空白,剛好等於長度差。
    // 這條是整個計數的守門員:哪天轉換改了而計數沒跟上,這裡會先叫。
    const count = countSocial(analyzeSocial(input));
    expect(convertSocialText(input).length - input.length).toBe(
      count.chars - count.trimmed
    );
  });

  it("只有空白的行算空行，而且記下原本佔了幾個字元", () => {
    expect(analyzeSocial("   ")).toEqual([{ kind: "blank", length: 3 }]);
  });

  it("沒東西可插時說清楚", () => {
    expect(describeSocial({ blankLines: 0, indentSpaces: 0, chars: 0, trimmed: 0 })).toBe(
      "沒有需要保護的空行或縮排"
    );
  });

  it("有東西時把種類拆開講", () => {
    expect(describeSocial({ blankLines: 1, indentSpaces: 4, chars: 5, trimmed: 0 })).toBe(
      "複製時會插入 5 個隱形字元（1 個空行、4 格縮排）"
    );
  });
});

describe("text-edit:選取與插入", () => {
  it("取代選取範圍，並把選取留在換上去的內容上", () => {
    expect(replaceRange("abcdef", 2, 4, "XYZ")).toEqual({
      text: "abXYZef",
      selectionStart: 2,
      selectionEnd: 5,
    });
  });

  it("插入後游標落在插入內容的後面，不是把它選起來", () => {
    expect(insertAt("abcd", 2, 2, "✦")).toEqual({
      text: "ab✦cd",
      selectionStart: 3,
      selectionEnd: 3,
    });
  });

  it("有選取時插入會取代掉它", () => {
    expect(insertAt("abcd", 1, 3, "✦").text).toBe("a✦d");
  });

  it("有選取就只套用在選取的那一段", () => {
    const result = applyToSelection("abcdef", 2, 4, (s) => s.toUpperCase());
    expect(result.text).toBe("abCDef");
    expect([result.selectionStart, result.selectionEnd]).toEqual([2, 4]);
  });

  it("沒選取就套用整篇（維持合併前的行為，不然按下去毫無反應）", () => {
    const result = applyToSelection("abc", 1, 1, (s) => s.toUpperCase());
    expect(result.text).toBe("ABC");
    expect([result.selectionStart, result.selectionEnd]).toEqual([0, 3]);
  });

  it("超出範圍的位置會被壓回字串內", () => {
    expect(replaceRange("abc", -5, 99, "X").text).toBe("X");
  });

  it("start 比 end 大時不會吃掉後面的字", () => {
    expect(replaceRange("abcdef", 4, 2, "X").text).toBe("abcdXef");
  });

  it("作用範圍標示", () => {
    expect(selectionScope(3, 3)).toBe("all");
    expect(selectionScope(1, 3)).toBe("selection");
  });
});

describe("dividers:分隔線產生器", () => {
  const line = DIVIDER_UNITS.find((item) => item.key === "line")!;
  const star = DIVIDER_UNITS.find((item) => item.key === "star")!;

  it("連續單位直接重複", () => {
    expect(buildDivider(line, 5)).toBe("─────");
  });

  it("裝飾單位之間夾空白", () => {
    expect(buildDivider(star, 3)).toBe("✦ ✦ ✦");
  });

  it("長度會被夾在上下限之間", () => {
    expect(buildDivider(line, 0)).toBe("─");
    expect(buildDivider(line, 999).length).toBe(60);
  });
});

describe("recent:最近用過", () => {
  it("最新的排最前面", () => {
    expect(addToRecent(["b", "c"], "a")).toEqual(["a", "b", "c"]);
  });

  it("重複的是往前移，不是再塞一筆", () => {
    expect(addToRecent(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
  });

  it("超過上限就砍掉最舊的", () => {
    expect(addToRecent(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
  });

  it("空字串不進清單", () => {
    expect(addToRecent(["a"], "")).toEqual(["a"]);
  });
});

describe("符號與顏文字的搜尋", () => {
  it("中文關鍵字找得到符號", () => {
    const found = filterSymbols(SYMBOL_GROUPS, "愛心");
    expect(found.flatMap((g) => g.chars.map((c) => c.char))).toContain("♡");
  });

  it("英文關鍵字也找得到", () => {
    const found = filterSymbols(SYMBOL_GROUPS, "arrow");
    expect(found.flatMap((g) => g.chars.map((c) => c.char))).toContain("→");
  });

  it("找不到就是空陣列，不是全部", () => {
    expect(filterSymbols(SYMBOL_GROUPS, "zzzzzz")).toEqual([]);
  });

  it("空字串回全部", () => {
    expect(filterSymbols(SYMBOL_GROUPS, "  ")).toHaveLength(SYMBOL_GROUPS.length);
  });

  it("顏文字用情緒關鍵字找", () => {
    const found = filterKaomoji(KAOMOJI_GROUPS, "掀桌");
    expect(found.flatMap((g) => g.items.map((i) => i.text)).join("")).toContain("┻━┻");
  });

  it("符號清單裡沒有重複的字元", () => {
    const all = SYMBOL_GROUPS.flatMap((g) => g.chars.map((c) => c.char));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("font-notes:哪些字會留在原地", () => {
  it("哥德字沒有數字對映——這就是「字母變了數字沒變」的來源", () => {
    expect(gapsFor("fraktur").digits).toBe(true);
    expect(gapsFor("script").digits).toBe(true);
    expect(gapsFor("italic").digits).toBe(true);
  });

  it("有配數字的樣式不該被誤報", () => {
    expect(gapsFor("doubleStruck").digits).toBe(false);
    expect(gapsFor("circled").digits).toBe(false);
    expect(gapsFor("monospace").digits).toBe(false);
  });

  it("字母一定轉得動", () => {
    for (const key of ["fraktur", "script", "circled", "monospace"]) {
      expect(gapsFor(key).letters).toBe(false);
    }
  });

  it("只有真的含數字時才提醒", () => {
    expect(describeGaps("fraktur", "fancy")).toBeNull();
    expect(describeGaps("fraktur", "fancy2026")).toBe("數字會維持原樣");
  });

  it("含中文時說明那是設計而不是壞掉", () => {
    expect(describeGaps("monospace", "小熊 bear")).toBe(
      "中文與其他非英數字元會維持原樣"
    );
  });

  it("兩種都中的時候一起講", () => {
    expect(describeGaps("fraktur", "小熊 bear 2026")).toBe(
      "數字、中文與其他非英數字元會維持原樣"
    );
  });
});

describe("matchesKeyword:雙向包含", () => {
  it("查詢把兩個詞黏在一起也找得到", () => {
    expect(matchesKeyword("心 heart 空心 愛", "愛心")).toBe(true);
  });

  it("單字查詢照樣命中", () => {
    expect(matchesKeyword("心 heart 空心 愛", "heart")).toBe(true);
  });

  it("不相干的查詢不會命中", () => {
    expect(matchesKeyword("心 heart 空心 愛", "箭頭")).toBe(false);
  });
});

describe("font-restore:還原成一般文字", () => {
  const styled = (input: string, key: string) =>
    getFontResults(input).find((item) => item.key === key)!.value;

  it("套過字體的文字再套別種樣式是完全沒反應的——這就是要還原的理由", () => {
    const fraktur = styled("fancy", "fraktur");
    expect(styled(fraktur, "circled")).toBe(fraktur);
  });

  it("字元對映類的樣式都還原得回來", () => {
    for (const key of [
      "fraktur", "script", "doubleStruck", "circled", "squared",
      "monospace", "italic", "boldItalic", "sansBold", "smallCaps",
    ]) {
      expect(toPlainText(styled("fancy", key))).toBe("fancy");
    }
  });

  it("有數字對映的樣式連數字一起還原", () => {
    expect(toPlainText(styled("abc2026", "doubleStruck"))).toBe("abc2026");
    expect(toPlainText(styled("abc2026", "circled"))).toBe("abc2026");
  });

  it("疊附加符號的樣式用剝除的方式還原", () => {
    for (const key of ["strike", "slashStrike", "sparkle", "doubleUnderline", "decorated"]) {
      expect(toPlainText(styled("fancy", key))).toBe("fancy");
    }
  });

  it("中文與標點不會被動到", () => {
    expect(toPlainText("小熊寶：「你好」～")).toBe("小熊寶：「你好」～");
  });

  it("混排時只還原花式字元", () => {
    const mixed = `小熊 ${styled("bear", "fraktur")} 2026`;
    expect(toPlainText(mixed)).toBe("小熊 bear 2026");
  });

  it("一般文字丟進去原樣出來", () => {
    expect(toPlainText("plain text 123")).toBe("plain text 123");
  });

  it("認得出有沒有東西可以還原", () => {
    expect(hasStyledText("plain text")).toBe(false);
    expect(hasStyledText(styled("fancy", "fraktur"))).toBe(true);
    expect(hasStyledText(styled("fancy", "strike"))).toBe(true);
  });
});

describe("custom-items:自訂項目", () => {
  it("新增的排最前面，重複的往前移", () => {
    expect(addCustom(["b"], "a")).toEqual(["a", "b"]);
    expect(addCustom(["a", "b"], "b")).toEqual(["b", "a"]);
  });

  it("只有空白的不收", () => {
    expect(addCustom(["a"], "   ")).toEqual(["a"]);
  });

  it("移除", () => {
    expect(removeCustom(["a", "b"], "a")).toEqual(["b"]);
  });

  it("匯入完整備份物件", () => {
    const raw = JSON.stringify({ symbol: ["✦"], kaomoji: ["(^^)"], divider: ["───"] });
    expect(parseImport(raw, "symbol")).toEqual({
      symbol: ["✦"],
      kaomoji: ["(^^)"],
      divider: ["───"],
    });
  });

  it("匯入單一類別的陣列，進呼叫端指定的那一類", () => {
    expect(parseImport('["✦","❀"]', "divider")).toEqual({ divider: ["✦", "❀"] });
  });

  it("匯入純文字，一行一個", () => {
    expect(parseImport("✦\n❀\n\n  ◈  ", "symbol")).toEqual({
      symbol: ["✦", "❀", "◈"],
    });
  });

  it("備份裡不認得的欄位直接忽略", () => {
    expect(parseImport('{"symbol":["✦"],"什麼鬼":["x"]}', "symbol")).toEqual({
      symbol: ["✦"],
    });
  });

  it("壞掉的 JSON 退回純文字而不是整個失敗", () => {
    expect(parseImport("{ 壞掉的", "symbol")).toEqual({ symbol: ["{ 壞掉的"] });
  });

  it("空字串就是什麼都沒有", () => {
    expect(parseImport("   ", "symbol")).toEqual({});
  });

  it("匯入是合併，不會把使用者原本加的東西清掉", () => {
    const current = { ...emptySets(), symbol: ["舊的"] };
    const merged = mergeSets(current, { symbol: ["新的"] });
    expect(merged.symbol).toEqual(["新的", "舊的"]);
  });

  it("合併時去重", () => {
    const current = { ...emptySets(), symbol: ["✦"] };
    expect(mergeSets(current, { symbol: ["✦"] }).symbol).toEqual(["✦"]);
  });

  it("匯出再匯入回得來", () => {
    const sets = { symbol: ["✦"], kaomoji: ["(^^)"], divider: ["───"] };
    expect(mergeSets(emptySets(), parseImport(serialize(sets), "symbol"))).toEqual(sets);
  });
});
