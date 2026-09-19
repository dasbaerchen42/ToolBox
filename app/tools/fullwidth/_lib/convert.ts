import { applyCustomRules } from "./customRules";
import { protectSkipBlocks, protectUrls } from "./protect";
import type { FullwidthCustomRule, FullwidthOptions, TextMeta } from "./types";

function isDigit(char?: string) {
  return !!char && char >= "0" && char <= "9";
}

function replaceCharWithGuard(
  text: string,
  fromChar: string,
  toChar: string,
  shouldSkip?: (text: string, index: number) => boolean
) {
  let output = "";

  for (let i = 0; i < text.length; i += 1) {
    const current = text[i];

    if (current === fromChar) {
      if (shouldSkip?.(text, i)) {
        output += current;
      } else {
        output += toChar;
      }
    } else {
      output += current;
    }
  }

  return output;
}

function skipColonInNumber(text: string, index: number) {
  return isDigit(text[index - 1]) && isDigit(text[index + 1]);
}

function skipCommaInNumber(text: string, index: number) {
  return isDigit(text[index - 1]) && isDigit(text[index + 1]);
}

const CJK_CHAR_REGEX =
  /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF\uAC00-\uD7AF]/;

const LATIN_CHAR_REGEX = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;

const CLAUSE_BOUNDARY_REGEX =
  /[\n,.;:!?(){}"'，。．；：！？、（）｛｝「」『』…｜|*]/;

const SENTENCE_ENDERS = ".!?";

// 判斷 index 位置的標點所屬的「子句」是否為純外文：
// 往 direction 方向掃到上一個標點／引號／換行為止，
// 途中出現任何 CJK 字元就不算外文子句（該標點應照常轉全形）。
function isLatinClause(text: string, index: number, direction: -1 | 1) {
  const target = text[index];
  const transparent = SENTENCE_ENDERS.includes(target)
    ? SENTENCE_ENDERS
    : target;

  let i = index + direction;

  // 連續的同類標點（如 "..."、"?!"）視為一體，跳過後再看子句內容
  while (i >= 0 && i < text.length && transparent.includes(text[i])) {
    i += direction;
  }

  let sawLatin = false;

  for (; i >= 0 && i < text.length; i += direction) {
    const char = text[i];

    if (CLAUSE_BOUNDARY_REGEX.test(char)) {
      break;
    }
    if (CJK_CHAR_REGEX.test(char)) {
      return false;
    }
    if (LATIN_CHAR_REGEX.test(char)) {
      sawLatin = true;
    }
  }

  return sawLatin;
}

// 括號成對判斷：一對括號的內容若為純外文就整對保留半形，
// 否則整對轉全形，避免同一對括號一半轉一半不轉。
function convertBracketPairs(
  text: string,
  open: string,
  close: string,
  fullOpen: string,
  fullClose: string,
  protectLatin: boolean
) {
  if (!protectLatin) {
    return text.replaceAll(open, fullOpen).replaceAll(close, fullClose);
  }

  const stack: number[] = [];
  const skip = new Set<number>();

  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === open) {
      stack.push(i);
    } else if (text[i] === close) {
      const openIndex = stack.pop();
      if (openIndex !== undefined) {
        const inner = text.slice(openIndex + 1, i);
        if (!CJK_CHAR_REGEX.test(inner) && LATIN_CHAR_REGEX.test(inner)) {
          skip.add(openIndex);
          skip.add(i);
        }
      }
    }
  }

  let output = "";

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === open && !skip.has(i)) {
      output += fullOpen;
    } else if (char === close && !skip.has(i)) {
      output += fullClose;
    } else {
      output += char;
    }
  }

  return output;
}

function convertQuotes(text: string) {
  let doubleQuoteOpen = true;
  let singleQuoteOpen = true;
  let output = "";

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const prev = text[i - 1];
    const next = text[i + 1];

    if (char === '"') {
      output += doubleQuoteOpen ? "「" : "」";
      doubleQuoteOpen = !doubleQuoteOpen;
      continue;
    }

    if (char === "'") {
      const isApostrophe =
        /[A-Za-z]/.test(prev ?? "") && /[A-Za-z]/.test(next ?? "");

      if (isApostrophe) {
        output += char;
      } else {
        output += singleQuoteOpen ? "『" : "』";
        singleQuoteOpen = !singleQuoteOpen;
      }
      continue;
    }

    output += char;
  }

  return output;
}

// ── 修正變成斜體的對話 ────────────────────────────────────────────────
//
// 想要的結果永遠是:對話(「」『』)不要斜體、旁白要斜體。
// 從別的地方貼過來的稿子有兩種壞掉的形狀:
//   A. 整句被包起來      *「對話」旁白:「對話」*
//   B. 每段對話各自被包  *「對話」*旁白:*「對話」*
// 原本是用兩條 regex 各自處理 A,形狀一變就漏掉;B 更慘——會被當成兩個
// 「整段都是對話的斜體」拆掉,連旁白的斜體一起清光。
//
// 現在改成先把一行拆成「斜體/非斜體 × 對話/旁白」四種片段再重組:
//   1. 對話一律拿掉斜體
//   2. 原本就在斜體裡的旁白保持斜體
//   3. 夾在兩段「原本是斜體的對話」之間的旁白,把斜體接手過來(這條救 B)
// 幾段對話、旁白在前在後都不影響,因為規則不綁形狀。

type ItalicPiece = {
  text: string;
  italic: boolean;
  dialogue: boolean;
};

const DIALOGUE_REGEX = /「[^「」]*」|『[^『』]*』/g;

/** 依 * 切成斜體與非斜體兩種片段 */
function splitByItalic(line: string): { text: string; italic: boolean }[] {
  return line
    .split("*")
    .map((text, index) => ({ text, italic: index % 2 === 1 }))
    .filter((part) => part.text.length > 0);
}

/** 再依對話括號切一層 */
function splitByDialogue(text: string, italic: boolean): ItalicPiece[] {
  const pieces: ItalicPiece[] = [];
  let last = 0;

  for (const match of text.matchAll(DIALOGUE_REGEX)) {
    const start = match.index ?? 0;
    if (start > last) {
      pieces.push({ text: text.slice(last, start), italic, dialogue: false });
    }
    pieces.push({ text: match[0], italic, dialogue: true });
    last = start + match[0].length;
  }

  if (last < text.length) {
    pieces.push({ text: text.slice(last), italic, dialogue: false });
  }

  return pieces;
}

/** 規則 3:夾在兩段原本是斜體的對話之間的旁白,把斜體接手過來 */
function inheritItalicBetweenDialogues(pieces: ItalicPiece[]): boolean[] {
  const wasItalicDialogue = pieces.map(
    (piece) => piece.dialogue && piece.italic
  );

  const previousSolid = (index: number) => {
    for (let i = index - 1; i >= 0; i -= 1) {
      if (pieces[i].text.trim()) return i;
    }
    return -1;
  };

  const nextSolid = (index: number) => {
    for (let i = index + 1; i < pieces.length; i += 1) {
      if (pieces[i].text.trim()) return i;
    }
    return -1;
  };

  return pieces.map((piece, index) => {
    if (piece.dialogue) return false;
    if (piece.italic) return true;
    if (!piece.text.trim()) return false;

    const before = previousSolid(index);
    const after = nextSolid(index);

    return (
      before >= 0 &&
      after >= 0 &&
      wasItalicDialogue[before] &&
      wasItalicDialogue[after]
    );
  });
}

function rebuildLine(pieces: ItalicPiece[], italics: boolean[]): string {
  let output = "";
  let open = false;

  pieces.forEach((piece, index) => {
    const italic = italics[index];

    if (italic !== open) {
      // 只有空白的片段不值得為它收掉再開一次斜體,會變成 * * 這種空殼
      if (!italic && !piece.text.trim() && index + 1 < pieces.length) {
        const next = italics[index + 1];
        if (next) {
          output += piece.text;
          return;
        }
      }

      output += "*";
      open = italic;
    }

    output += piece.text;
  });

  if (open) output += "*";
  return output;
}

function fixLineItalics(line: string): string {
  // ** 是粗體,不是兩個斜體記號;星號落單時配不成對,兩種都不要亂動
  if (line.includes("**")) return line;
  if ((line.match(/\*/g)?.length ?? 0) % 2 !== 0) return line;
  if (!line.includes("*")) return line;

  const pieces = splitByItalic(line).flatMap((part) =>
    splitByDialogue(part.text, part.italic)
  );
  if (pieces.length === 0) return line;

  return rebuildLine(pieces, inheritItalicBetweenDialogues(pieces));
}

function fixMiswrappedDialogueItalics(text: string) {
  // 一行一行處理:Markdown 的斜體本來就不跨行,跨行的星號多半是別的意思
  return text.split("\n").map(fixLineItalics).join("\n");
}

function convertSegment(
  segment: string,
  options: FullwidthOptions,
  customRules: FullwidthCustomRule[]
) {
  let text = segment;

  if (options.enableCustomReplace) {
    text = applyCustomRules(text, customRules);
  }

  // 逗號、句號等尾隨標點屬於「前面」的子句，往回看；括號另以成對判斷
  const skipLatinClauseBefore = options.protectLatinClauses
    ? (t: string, i: number) => isLatinClause(t, i, -1)
    : undefined;

  if (options.convertColon) {
    text = replaceCharWithGuard(
      text,
      ":",
      "：",
      (t, i) => skipColonInNumber(t, i) || !!skipLatinClauseBefore?.(t, i)
    );
  }

  if (options.convertComma) {
    text = replaceCharWithGuard(
      text,
      ",",
      "，",
      (t, i) => skipCommaInNumber(t, i) || !!skipLatinClauseBefore?.(t, i)
    );
  }

  if (options.convertQuestion) {
    text = replaceCharWithGuard(text, "?", "？", skipLatinClauseBefore);
  }

  if (options.convertExclamation) {
    text = replaceCharWithGuard(text, "!", "！", skipLatinClauseBefore);
  }

  if (options.convertPeriod) {
    text = replaceCharWithGuard(text, ".", "。", skipLatinClauseBefore);
  }

  if (options.convertSemicolon) {
    text = replaceCharWithGuard(text, ";", "；", skipLatinClauseBefore);
  }

  if (options.convertParentheses) {
    text = convertBracketPairs(
      text,
      "(",
      ")",
      "（",
      "）",
      options.protectLatinClauses
    );
  }

  if (options.convertBraces) {
    text = convertBracketPairs(
      text,
      "{",
      "}",
      "｛",
      "｝",
      options.protectLatinClauses
    );
  }

  if (options.convertQuotes) {
    text = convertQuotes(text);
  }

  if (options.fixMiswrappedDialogueItalics) {
    text = fixMiswrappedDialogueItalics(text);
  }

  return text;
}

export function convertAll(
  rawText: string,
  options: FullwidthOptions,
  customRules: FullwidthCustomRule[]
) {
  let text = rawText ?? "";

  const protectedSkipBlocks = protectSkipBlocks(text);
  text = protectedSkipBlocks.text;

  const protectedUrls = protectUrls(text);
  text = protectedUrls.text;

  const parts = text.split(/(\n\s*\n+)/);

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];

    if (/^\n\s*\n+$/.test(part)) {
      continue;
    }

    parts[i] = convertSegment(part, options, customRules);
  }

  let output = parts.join("");
  output = protectedUrls.restore(output);
  output = protectedSkipBlocks.restore(output);

  return output;
}

export function calcTextMeta(text: string): TextMeta {
  const safeText = text || "";
  return {
    chars: safeText.length,
    lines: safeText ? safeText.split("\n").length : 0,
  };
}