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

function cjkRatioOf(text: string) {
  const cjk =
    text.match(
      /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF\uAC00-\uD7AF]/g
    )?.length ?? 0;

  const letters =
    text.match(/[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/g)?.length ?? 0;

  const digits = text.match(/[0-9]/g)?.length ?? 0;

  const denominator = Math.max(1, cjk + letters + digits);
  return cjk / denominator;
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

  if (options.convertColon) {
    text = replaceCharWithGuard(text, ":", "：", skipColonInNumber);
  }

  if (options.convertComma) {
    text = replaceCharWithGuard(text, ",", "，", skipCommaInNumber);
  }

  if (options.convertQuestion) {
    text = text.replaceAll("?", "？");
  }

  if (options.convertExclamation) {
    text = text.replaceAll("!", "！");
  }

  if (options.convertPeriod) {
    text = text.split(".").join("。");
  }

  if (options.convertSemicolon) {
    text = text.replaceAll(";", "；");
  }

  if (options.convertParentheses) {
    text = text.replaceAll("(", "（").replaceAll(")", "）");
  }

  if (options.convertBraces) {
    text = text.replaceAll("{", "｛").replaceAll("}", "｝");
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

    if (options.skipNonCjkParagraphs) {
      const ratio = cjkRatioOf(part);
      if (ratio < options.cjkThreshold) {
        continue;
      }
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