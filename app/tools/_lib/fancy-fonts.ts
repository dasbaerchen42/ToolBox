// 社群字體轉換：把 ASCII 英數對映到 Unicode 的各種樣式變體。
// 中文與其他字元一律原樣保留。
//
// 重點陷阱：Mathematical Alphanumeric Symbols（U+1D400–U+1D7FF）並不是
// 26 個字母連續排好。手寫體、哥德體、雙線體、斜體都有幾個字母被挖空，
// 真正的字元散落在 Letterlike Symbols（U+2100 區）。直接用 start + offset
// 算出來的會是保留碼位，畫面上就是豆腐方塊，所以每個有洞的樣式都要帶例外表。

type StyleSpec = {
  upperStart?: number;
  lowerStart?: number;
  /** 數字連續排列時的起點 */
  digitStart?: number;
  /** 數字不連續時，直接給 0–9 十個字元 */
  digitMap?: string;
  /** key 是 A 起算的位移，value 是該字母真正的字元 */
  upperExceptions?: Record<number, string>;
  /** key 是 a 起算的位移 */
  lowerExceptions?: Record<number, string>;
};

function mapAlphabet(input: string, spec: StyleSpec): string {
  return [...input]
    .map((char) => {
      const code = char.charCodeAt(0);

      if (code >= 65 && code <= 90) {
        const offset = code - 65;
        if (spec.upperExceptions?.[offset]) return spec.upperExceptions[offset];
        if (spec.upperStart === undefined) return char;
        return String.fromCodePoint(spec.upperStart + offset);
      }

      if (code >= 97 && code <= 122) {
        const offset = code - 97;
        if (spec.lowerExceptions?.[offset]) return spec.lowerExceptions[offset];
        if (spec.lowerStart === undefined) return char;
        return String.fromCodePoint(spec.lowerStart + offset);
      }

      if (code >= 48 && code <= 57) {
        const offset = code - 48;
        if (spec.digitMap) return [...spec.digitMap][offset] ?? char;
        if (spec.digitStart !== undefined) {
          return String.fromCodePoint(spec.digitStart + offset);
        }
        return char;
      }

      return char;
    })
    .join("");
}

/** 手寫體：大寫 B/E/F/H/I/L/M/R、小寫 e/g/o 不在連續區塊裡 */
const SCRIPT: StyleSpec = {
  upperStart: 0x1d49c,
  lowerStart: 0x1d4b6,
  upperExceptions: {
    1: "ℬ", 4: "ℰ", 5: "ℱ", 7: "ℋ", 8: "ℐ", 11: "ℒ", 12: "ℳ", 17: "ℛ",
  },
  lowerExceptions: { 4: "ℯ", 6: "ℊ", 14: "ℴ" },
};

/** 哥德體：大寫 C/H/I/R/Z 是例外 */
const FRAKTUR: StyleSpec = {
  upperStart: 0x1d504,
  lowerStart: 0x1d51e,
  upperExceptions: { 2: "ℭ", 7: "ℌ", 8: "ℑ", 17: "ℜ", 25: "ℨ" },
};

/** 雙線體：大寫 C/H/N/P/Q/R/Z 是例外 */
const DOUBLE_STRUCK: StyleSpec = {
  upperStart: 0x1d538,
  lowerStart: 0x1d552,
  digitStart: 0x1d7d8,
  upperExceptions: {
    2: "ℂ", 7: "ℍ", 13: "ℕ", 15: "ℙ", 16: "ℚ", 17: "ℝ", 25: "ℤ",
  },
};

/** 斜體：小寫 h 是例外（U+1D455 是保留碼位，正字在 U+210E） */
const ITALIC: StyleSpec = {
  upperStart: 0x1d434,
  lowerStart: 0x1d44e,
  lowerExceptions: { 7: "ℎ" },
};

/** 圓圈字：大小寫與數字各自一個區塊，0 又跟 1–9 分開 */
const CIRCLED: StyleSpec = {
  upperStart: 0x24b6,
  lowerStart: 0x24d0,
  digitMap: "⓪①②③④⑤⑥⑦⑧⑨",
};

// 白框方框字與黑底方框字：大小寫共用同一組大寫字形，沒有對應數字
const SQUARED: StyleSpec = { upperStart: 0x1f130, lowerStart: 0x1f130 };
const NEGATIVE_SQUARED: StyleSpec = { upperStart: 0x1f170, lowerStart: 0x1f170 };

/**
 * 小型大寫。Unicode 沒有 small capital X，只能保留原樣；
 * f/q/s 用的是形近字（ꜰ/ǫ/ꜱ），不是同一套設計，這是現況能做到的最好對映。
 */
const SMALL_CAPS: Record<string, string> = {
  a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ꜰ", g: "ɢ", h: "ʜ",
  i: "ɪ", j: "ᴊ", k: "ᴋ", l: "ʟ", m: "ᴍ", n: "ɴ", o: "ᴏ", p: "ᴘ",
  q: "ǫ", r: "ʀ", s: "ꜱ", t: "ᴛ", u: "ᴜ", v: "ᴠ", w: "ᴡ", x: "x",
  y: "ʏ", z: "ᴢ",
};

function mapSmallCaps(input: string): string {
  return [...input].map((c) => SMALL_CAPS[c.toLowerCase()] ?? c).join("");
}

const FLIP: Record<string, string> = {
  a: "ɐ", b: "q", c: "ɔ", d: "p", e: "ǝ", f: "ɟ", g: "ƃ", h: "ɥ",
  i: "ᴉ", j: "ɾ", k: "ʞ", l: "l", m: "ɯ", n: "u", o: "o", p: "d",
  q: "b", r: "ɹ", s: "s", t: "ʇ", u: "n", v: "ʌ", w: "ʍ", x: "x",
  y: "ʎ", z: "z", A: "∀", B: "𐐒", C: "Ɔ", D: "◖", E: "Ǝ", F: "Ⅎ",
  G: "⅁", H: "H", I: "I", J: "ſ", K: "⋊", L: "˥", M: "W", N: "N",
  O: "O", P: "Ԁ", Q: "Ό", R: "ᴚ", S: "S", T: "┴", U: "∩", V: "Λ",
  W: "M", X: "X", Y: "⅄", Z: "Z", 1: "Ɩ", 2: "ᄅ", 3: "Ɛ", 4: "ㄣ",
  5: "ϛ", 6: "9", 7: "ㄥ", 8: "8", 9: "6", 0: "0", ".": "˙", ",": "'",
  "'": ",", '"': ",,", "!": "¡", "?": "¿", "(": ")", ")": "(",
  "[": "]", "]": "[", "{": "}", "}": "{",
};

const SUPERSCRIPT: Record<string, string> = {
  a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ",
  i: "ᶦ", j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ", n: "ⁿ", o: "ᵒ", p: "ᵖ",
  q: "q", r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ",
  y: "ʸ", z: "ᶻ", A: "ᴬ", B: "ᴮ", C: "ᶜ", D: "ᴰ", E: "ᴱ", F: "ᶠ",
  G: "ᴳ", H: "ᴴ", I: "ᴵ", J: "ᴶ", K: "ᴷ", L: "ᴸ", M: "ᴹ", N: "ᴺ",
  O: "ᴼ", P: "ᴾ", Q: "Q", R: "ᴿ", S: "ˢ", T: "ᵀ", U: "ᵁ", V: "ⱽ",
  W: "ᵂ", X: "ˣ", Y: "ʸ", Z: "ᶻ", 0: "⁰", 1: "¹", 2: "²", 3: "³",
  4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹",
};

/**
 * 以「使用者感知的一個字」為單位切分。組合符號類樣式一定要用這個，
 * 否則 emoji 的 ZWJ 序列會被拆開、在中間插入組合符號而破圖。
 */
export function toGraphemes(input: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return [...segmenter.segment(input)].map((s) => s.segment);
  }
  return [...input];
}

function addCombiningMark(input: string, mark: string): string {
  return toGraphemes(input)
    .map((g) => (g.trim() === "" ? g : `${g}${mark}`))
    .join("");
}

function addZalgoLight(input: string): string {
  const marks = ["́", "̀", "̂", "̈", "̰", "̣"];
  return toGraphemes(input)
    .map((g, i) => (g.trim() === "" ? g : `${g}${marks[i % marks.length]}`))
    .join("");
}

function flipText(input: string): string {
  return toGraphemes(input)
    .reverse()
    .map((g) => FLIP[g] ?? g)
    .join("");
}

function mapTable(input: string, table: Record<string, string>): string {
  return [...input].map((c) => table[c] ?? c).join("");
}

export interface FontResult {
  key: string;
  label: string;
  preview: string;
  value: string;
}

export function getFontResults(input: string): FontResult[] {
  return [
    { key: "squared", label: "方框字", preview: "🄵🄰🄽🄲🅈", value: mapAlphabet(input, SQUARED) },
    { key: "negativeSquared", label: "黑底方框字", preview: "🅵🅰🅽🅲🆈", value: mapAlphabet(input, NEGATIVE_SQUARED) },
    { key: "fraktur", label: "哥德字", preview: "𝔣𝔞𝔫𝔠𝔶", value: mapAlphabet(input, FRAKTUR) },
    { key: "boldFraktur", label: "粗體哥德字", preview: "𝖋𝖆𝖓𝖈𝖞", value: mapAlphabet(input, { upperStart: 0x1d56c, lowerStart: 0x1d586 }) },
    { key: "doubleStruck", label: "雙線字", preview: "𝕗𝕒𝕟𝕔𝕪", value: mapAlphabet(input, DOUBLE_STRUCK) },
    { key: "smallCaps", label: "小型大寫", preview: "ꜰᴀɴᴄʏ", value: mapSmallCaps(input) },
    { key: "circled", label: "圓圈字", preview: "ⓕⓐⓝⓒⓨ", value: mapAlphabet(input, CIRCLED) },
    { key: "script", label: "手寫字", preview: "𝒻𝒶𝓃𝒸𝓎", value: mapAlphabet(input, SCRIPT) },
    { key: "boldScript", label: "粗體手寫字", preview: "𝓯𝓪𝓷𝓬𝔂", value: mapAlphabet(input, { upperStart: 0x1d4d0, lowerStart: 0x1d4ea }) },
    { key: "upsideDown", label: "上下顛倒", preview: "ʎɔuɐɟ", value: flipText(input) },
    { key: "reverseUpsideDown", label: "反向顛倒", preview: "ɟɐuɔʎ", value: toGraphemes(flipText(input)).reverse().join("") },
    { key: "sansBold", label: "無襯線粗體", preview: "𝗳𝗮𝗻𝗰𝘆", value: mapAlphabet(input, { upperStart: 0x1d5d4, lowerStart: 0x1d5ee, digitStart: 0x1d7ec }) },
    { key: "serifBold", label: "襯線粗體", preview: "𝐟𝐚𝐧𝐜𝐲", value: mapAlphabet(input, { upperStart: 0x1d400, lowerStart: 0x1d41a, digitStart: 0x1d7ce }) },
    { key: "sansItalic", label: "無襯線斜體", preview: "𝘧𝘢𝘯𝘤𝘺", value: mapAlphabet(input, { upperStart: 0x1d608, lowerStart: 0x1d622 }) },
    { key: "italic", label: "斜體字", preview: "𝑓𝑎𝑛𝑐𝑦", value: mapAlphabet(input, ITALIC) },
    { key: "boldItalic", label: "粗斜體", preview: "𝒇𝒂𝒏𝒄𝒚", value: mapAlphabet(input, { upperStart: 0x1d468, lowerStart: 0x1d482 }) },
    { key: "monospace", label: "等寬字", preview: "𝚏𝚊𝚗𝚌𝚢", value: mapAlphabet(input, { upperStart: 0x1d670, lowerStart: 0x1d68a, digitStart: 0x1d7f6 }) },
    { key: "sans", label: "無襯線字", preview: "𝖿𝖺𝗇𝖼𝗒", value: mapAlphabet(input, { upperStart: 0x1d5a0, lowerStart: 0x1d5ba, digitStart: 0x1d7e2 }) },
    { key: "strike", label: "刪除線", preview: "f̶a̶n̶c̶y̶", value: addCombiningMark(input, "̶") },
    { key: "slashStrike", label: "斜線刪除", preview: "f̷a̷n̷c̷y̷", value: addCombiningMark(input, "̷") },
    { key: "sparkle", label: "閃光裝飾", preview: "f҉a҉n҉c҉y҉", value: addCombiningMark(input, "҉") },
    { key: "decorated", label: "裝飾字", preview: "f́àn̂c̈y̰", value: addZalgoLight(input) },
    { key: "doubleUnderline", label: "底線裝飾", preview: "f͟a͟n͟c͟y͟", value: addCombiningMark(input, "͟") },
    { key: "superscript", label: "上標風格", preview: "ᶠᵃⁿᶜʸ", value: mapTable(input, SUPERSCRIPT) },
  ];
}
