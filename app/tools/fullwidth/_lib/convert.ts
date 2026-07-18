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

function fixDialogueOnlyItalic(text: string) {
  return text.replace(/\*「([^」]+)」\*/g, "「$1」");
}

function fixWrappedDialogueNarrationItalic(text: string) {
  return text.replace(
    /\*「([^」]+)」([^*「」\n]+)「([^」]+)」\*/g,
    "「$1」*$2*「$3」"
  );
}

function fixMiswrappedDialogueItalics(text: string) {
  let output = text;
  output = fixWrappedDialogueNarrationItalic(output);
  output = fixDialogueOnlyItalic(output);
  return output;
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