"use client";

import { useMemo, useState } from "react";
// 引入我們剛做好的共用標題與主題！
import ToolHeader from "@/components/editor/ToolHeader";
import { getThemeClasses } from "@/lib/theme";

async function copyText(text: string) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
}

/* =========================
   Social formatter
========================= */

function convertSocialText(input: string) {
  // 如果輸入是空的，直接回傳空字串
  if (!input) return "";

  return input
    .split("\n")
    .map((line) => {
      // 1. 處理空行：如果這行完全沒東西，或只有空白，就塞入盲文空白
      if (line.trim() === "") {
        return "\u2800";
      }

      // 2. 處理開頭縮排：抓出開頭的半形空白，替換成「零寬空格 + 半形空白」
      const leadingSpaceMatch = line.match(/^ +/);
      if (leadingSpaceMatch) {
        const spaceCount = leadingSpaceMatch[0].length;
        const safeSpaces = "\u200B ".repeat(spaceCount);
        return line.replace(/^ +/, safeSpaces);
      }

      // 3. 其他正常的行，保持原樣即可，不需要在句尾加東西
      return line;
    })
    .join("\n");
}

/* =========================
   Fancy fonts
========================= */

function mapStyledChars(
  input: string,
  upperStart: number,
  lowerStart: number,
  digitStart?: number
) {
  return [...input]
    .map((char) => {
      const code = char.charCodeAt(0);

      if (code >= 65 && code <= 90) {
        return String.fromCodePoint(upperStart + (code - 65));
      }

      if (code >= 97 && code <= 122) {
        return String.fromCodePoint(lowerStart + (code - 97));
      }

      if (digitStart !== undefined && code >= 48 && code <= 57) {
        return String.fromCodePoint(digitStart + (code - 48));
      }

      return char;
    })
    .join("");
}

function mapSmallCaps(input: string) {
  const smallCapsMap: Record<string, string> = {
    a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ꜰ", g: "ɢ", h: "ʜ",
    i: "ɪ", j: "ᴊ", k: "ᴋ", l: "ʟ", m: "ᴍ", n: "ɴ", o: "ᴏ", p: "ᴘ",
    q: "ǫ", r: "ʀ", s: "ꜱ", t: "ᴛ", u: "ᴜ", v: "ᴠ", w: "ᴡ", x: "x",
    y: "ʏ", z: "ᴢ",
  };

  return [...input]
    .map((char) => {
      const lower = char.toLowerCase();
      return smallCapsMap[lower] ?? char;
    })
    .join("");
}

function flipText(input: string) {
  const flipMap: Record<string, string> = {
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

  return [...input]
    .reverse()
    .map((char) => flipMap[char] ?? char)
    .join("");
}

function addCombiningMark(input: string, mark: string) {
  return [...input]
    .map((char) => {
      if (char === " ") return " ";
      return `${char}${mark}`;
    })
    .join("");
}

function addUnderlineLike(input: string) {
  return [...input]
    .map((char) => {
      if (char === " ") return " ";
      return `${char}\u035F`;
    })
    .join("");
}

function addZalgoLight(input: string) {
  const marks = ["\u0301", "\u0300", "\u0302", "\u0308", "\u0330", "\u0323"];
  return [...input]
    .map((char, index) => {
      if (char === " ") return " ";
      return `${char}${marks[index % marks.length]}`;
    })
    .join("");
}

function getFontResults(input: string) {
  return [
    { key: "squared", label: "方框字", preview: "🅵🅰🅽🅲🆈", value: mapStyledChars(input, 0x1f130, 0x1f130) },
    { key: "negativeSquared", label: "黑底方框字", preview: "🄵🄰🄽🄲🅈", value: mapStyledChars(input, 0x1f170, 0x1f170) },
    { key: "fraktur", label: "哥德字", preview: "𝔣𝔞𝔫𝔠𝔶", value: mapStyledChars(input, 0x1d504, 0x1d51e) },
    { key: "boldFraktur", label: "粗體哥德字", preview: "𝖋𝖆𝖓𝖈𝖞", value: mapStyledChars(input, 0x1d56c, 0x1d586) },
    { key: "doubleStruck", label: "雙線字", preview: "𝕗𝕒𝕟𝕔𝕪", value: mapStyledChars(input, 0x1d538, 0x1d552, 0x1d7d8) },
    { key: "smallCaps", label: "小型大寫", preview: "ꜰᴀɴᴄʏ", value: mapSmallCaps(input) },
    {
      key: "circled", label: "圓圈字", preview: "ⓕⓐⓝⓒⓨ", value: [...input]
        .map((char) => {
          const code = char.charCodeAt(0);
          if (code >= 97 && code <= 122) return String.fromCodePoint(0x24d0 + (code - 97));
          return char;
        }).join(""),
    },
    { key: "script", label: "手寫字", preview: "𝒻𝒶𝓃𝒸𝓎", value: mapStyledChars(input, 0x1d49c, 0x1d4b6) },
    { key: "boldScript", label: "粗體手寫字", preview: "𝓯𝓪𝓷𝓬𝔂", value: mapStyledChars(input, 0x1d4d0, 0x1d4ea) },
    { key: "upsideDown", label: "上下顛倒", preview: "ɟɐuɔʎ", value: flipText(input) },
    { key: "reverseUpsideDown", label: "反向顛倒", preview: "ʇxǝʇ", value: [...flipText(input)].reverse().join("") },
    { key: "sansBold", label: "無襯線粗體", preview: "𝗳𝗮𝗻𝗰𝘆", value: mapStyledChars(input, 0x1d5d4, 0x1d5ee, 0x1d7ec) },
    { key: "serifBold", label: "襯線粗體", preview: "𝐟𝐚𝐧𝐜𝐲", value: mapStyledChars(input, 0x1d400, 0x1d41a, 0x1d7ce) },
    { key: "sansItalic", label: "無襯線斜體", preview: "𝘧𝘢𝘯𝘤𝘺", value: mapStyledChars(input, 0x1d608, 0x1d622) },
    { key: "italic", label: "斜體字", preview: "𝑓𝑎𝑛𝑐𝑦", value: mapStyledChars(input, 0x1d434, 0x1d44e) },
    { key: "boldItalic", label: "粗斜體", preview: "𝒇𝒂𝒏𝒄𝒚", value: mapStyledChars(input, 0x1d468, 0x1d482) },
    { key: "monospace", label: "等寬字", preview: "𝚏𝚊𝚗𝚌𝚢", value: mapStyledChars(input, 0x1d670, 0x1d68a, 0x1d7f6) },
    { key: "sans", label: "無襯線字", preview: "𝖿𝖺𝗇𝖼𝗒", value: mapStyledChars(input, 0x1d5a0, 0x1d5ba, 0x1d7e2) },
    { key: "strike", label: "刪除線", preview: "̶f̶a̶n̶c̶y̶", value: addCombiningMark(input, "\u0336") },
    { key: "slashStrike", label: "斜線刪除", preview: "̷f̷a̷n̷c̷y̷", value: addCombiningMark(input, "\u0337") },
    { key: "sparkle", label: "閃光裝飾", preview: "҉f҉a҉n҉c҉y҉", value: addCombiningMark(input, "\u0489") },
    { key: "decorated", label: "裝飾字", preview: "f̵a̵n̵c̵y̵", value: addZalgoLight(input) },
    { key: "doubleUnderline", label: "底線裝飾", preview: "f͟a͟n͟c͟y͟", value: addUnderlineLike(input) },
    {
      key: "superscript", label: "上標風格", preview: "ᶠᵃⁿᶜʸ", value: [...input]
        .map((char) => {
          const map: Record<string, string> = {
            a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ",
            i: "ᶦ", j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ", n: "ⁿ", o: "ᵒ", p: "ᵖ",
            q: "q", r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ",
            y: "ʸ", z: "ᶻ", A: "ᴬ", B: "ᴮ", C: "ᶜ", D: "ᴰ", E: "ᴱ", F: "ᶠ",
            G: "ᴳ", H: "ᴴ", I: "ᴵ", J: "ᴶ", K: "ᴷ", L: "ᴸ", M: "ᴹ", N: "ᴺ",
            O: "ᴼ", P: "ᴾ", Q: "Q", R: "ᴿ", S: "ˢ", T: "ᵀ", U: "ᵁ", V: "ⱽ",
            W: "ᵂ", X: "ˣ", Y: "ʸ", Z: "ᶻ",
          };
          return map[char] ?? char;
        }).join(""),
    },
  ];
}

export default function ToolsPage() {
  const t = getThemeClasses();

  return (
    <main className={`min-h-screen ${t.page}`}>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        {/* 這裡換成共用標題元件！ */}
        <ToolHeader
          title="Tools"
          description="社群排版與字體轉換工具"
          t={t}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <FontTool />
          <SocialTool />
        </div>
      </div>
    </main>
  );
}

function FontTool() {
  const t = getThemeClasses();
  const [input, setInput] = useState("");
  const [selectedFont, setSelectedFont] = useState("squared");

  const results = useMemo(() => getFontResults(input), [input]);

  const selectedResult =
    results.find((item) => item.key === selectedFont) ?? results[0];

  return (
    <section className={`rounded-3xl border p-4 md:p-5 ${t.panel}`}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-[0.08em]">字體轉換</h2>
        <p className={`mt-1 text-sm tracking-[0.04em] ${t.muted}`}>
          中文會維持原樣，英文與數字可轉換成不同 Unicode 樣式
        </p>
      </div>

      <div className="space-y-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="輸入要轉換的文字……"
          className={`h-40 w-full rounded-3xl border p-4 text-sm leading-7 tracking-[0.04em] outline-none transition ${t.input}`}
        />

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {results.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedFont(item.key)}
              className={`rounded-2xl border px-3 py-3 text-left text-sm font-medium tracking-[0.04em] transition ${
                selectedFont === item.key ? t.selected : t.unselected
              }`}
            >
              <div className="text-xs opacity-80">{item.label}</div>
              <div className="mt-1 truncate">{item.preview}</div>
            </button>
          ))}
        </div>

        <div className={`rounded-3xl border p-4 ${t.subPanel}`}>
          <div className={`mb-2 text-xs tracking-[0.06em] ${t.muted}`}>
            轉換結果｜{selectedResult.label}
          </div>

          <textarea
            value={selectedResult.value}
            readOnly
            className={`h-40 w-full resize-none rounded-2xl border p-4 text-sm leading-7 tracking-[0.05em] outline-none ${t.input}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => copyText(selectedResult.value)}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium tracking-[0.04em] transition ${t.primary}`}
          >
            複製
          </button>

          <button
            type="button"
            onClick={() => {
              setInput("");
              setSelectedFont("squared");
            }}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium tracking-[0.04em] transition ${t.secondary}`}
          >
            清空
          </button>
        </div>
      </div>
    </section>
  );
}

function SocialTool() {
  const t = getThemeClasses();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  return (
    <section className={`rounded-3xl border p-4 md:p-5 ${t.panel}`}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-[0.08em]">社群排版</h2>
        <p className={`mt-1 text-sm tracking-[0.04em] ${t.muted}`}>
          保留你原本輸入的空白、空行、縮排，按下轉換後補上隱形字元。
        </p>
      </div>

      <div className="space-y-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="先把貼文內容、空白行、縮排都整理好……"
          className={`h-40 w-full rounded-3xl border p-4 text-sm leading-7 tracking-[0.04em] outline-none transition ${t.input}`}
        />

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setOutput(convertSocialText(input))}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium tracking-[0.04em] transition ${t.primary}`}
          >
            轉換
          </button>

          <button
            type="button"
            onClick={() => copyText(output)}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium tracking-[0.04em] transition ${t.secondary}`}
          >
            複製
          </button>

          <button
            type="button"
            onClick={() => {
              setInput("");
              setOutput("");
            }}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium tracking-[0.04em] transition ${t.secondary}`}
          >
            清空
          </button>
        </div>

        <div className={`rounded-3xl border p-4 ${t.subPanel}`}>
          <div className={`mb-2 text-xs tracking-[0.06em] ${t.muted}`}>
            轉換結果
          </div>

          <textarea
            value={output}
            readOnly
            className={`h-40 w-full resize-none rounded-2xl border p-4 text-sm leading-7 tracking-[0.05em] outline-none ${t.input}`}
          />
        </div>
      </div>
    </section>
  );
}
