import { getFontResults, toGraphemes } from "./fancy-fonts";

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SAMPLE = `${UPPER}${LOWER}${DIGITS}`;

// 未分配（Cn）碼位不屬於任何一個下列類別，用這個當「有沒有踩到保留碼位」的探針
const ASSIGNED = /^[\p{L}\p{N}\p{S}\p{M}\p{P}\p{Z}]+$/u;

function resultFor(key: string, input: string) {
  const found = getFontResults(input).find((item) => item.key === key);
  if (!found) throw new Error(`找不到樣式 ${key}`);
  return found;
}

const keys = getFontResults("").map((item) => item.key);

describe("每個樣式的輸出都不能踩到未分配碼位", () => {
  it.each(keys)("%s", (key) => {
    const { value } = resultFor(key, SAMPLE);
    const broken = [...value].filter((char) => !ASSIGNED.test(char));
    expect(broken).toEqual([]);
  });
});

describe("預覽字串必須等於實際轉換結果", () => {
  it.each(keys)("%s", (key) => {
    const { preview, value } = resultFor(key, "fancy");
    expect(value).toBe(preview);
  });
});

describe("散落在 Letterlike Symbols 的例外字母", () => {
  it("手寫體大寫 B/E/F/H/I/L/M/R 與小寫 e/g/o", () => {
    expect(resultFor("script", "BEFHILMR").value).toBe("ℬℰℱℋℐℒℳℛ");
    expect(resultFor("script", "ego").value).toBe("ℯℊℴ");
  });

  it("哥德體大寫 C/H/I/R/Z", () => {
    expect(resultFor("fraktur", "CHIRZ").value).toBe("ℭℌℑℜℨ");
  });

  it("雙線體大寫 C/H/N/P/Q/R/Z", () => {
    expect(resultFor("doubleStruck", "CHNPQRZ").value).toBe("ℂℍℕℙℚℝℤ");
  });

  it("斜體小寫 h", () => {
    expect(resultFor("italic", "h").value).toBe("ℎ");
  });
});

describe("大小寫與數字的覆蓋率", () => {
  it("圓圈字要包含大寫與數字", () => {
    expect(resultFor("circled", "Az0159").value).toBe("Ⓐⓩ⓪①⑤⑨");
  });

  it("有對應數字碼位的樣式要轉換數字", () => {
    expect(resultFor("serifBold", "07").value).toBe("𝟎𝟕");
    expect(resultFor("doubleStruck", "07").value).toBe("𝟘𝟟");
    expect(resultFor("monospace", "07").value).toBe("𝟶𝟽");
  });

  it("沒有對應數字碼位的樣式保留原本的數字", () => {
    expect(resultFor("script", "2026").value).toBe("2026");
    expect(resultFor("italic", "2026").value).toBe("2026");
  });
});

describe("非英數字元", () => {
  it("中文原樣保留", () => {
    expect(resultFor("serifBold", "小宇宙 abc").value).toBe("小宇宙 𝐚𝐛𝐜");
  });

  it("組合符號不會拆散 emoji 的 ZWJ 序列", () => {
    const family = "👩‍👩‍👧";
    const { value } = resultFor("strike", family);
    expect(toGraphemes(value)).toHaveLength(1);
    expect(value).toBe(`${family}̶`);
  });

  it("組合符號不會加在空白與換行上", () => {
    expect(resultFor("strike", "a b\nc").value).toBe("a̶ b̶\nc̶");
  });
});
