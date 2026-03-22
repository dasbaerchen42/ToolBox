import type { ProtectResult } from "./types";

function createRestorer(tokenPrefix: string, values: string[]) {
  return (text: string) =>
    text.replace(new RegExp(`${tokenPrefix}(\\d+)__`, "g"), (_, index) => {
      return values[Number(index)] ?? _;
    });
}

export function protectUrls(text: string): ProtectResult {
  const urls: string[] = [];
  const tokenPrefix = "__FW_URL__";
  const urlRegex = /\bhttps?:\/\/[^\s]+/gi;

  const protectedText = text.replace(urlRegex, (match) => {
    const token = `${tokenPrefix}${urls.length}__`;
    urls.push(match);
    return token;
  });

  return {
    text: protectedText,
    restore: createRestorer(tokenPrefix, urls),
  };
}

export function protectSkipBlocks(text: string): ProtectResult {
  const blocks: string[] = [];
  const tokenPrefix = "__FW_SKIP__";
  const skipRegex = /\[SKIP\][\s\S]*?\[\/SKIP\]/g;

  const protectedText = text.replace(skipRegex, (match) => {
    const token = `${tokenPrefix}${blocks.length}__`;
    const inner = match.replace(/^\[SKIP\]/, "").replace(/\[\/SKIP\]$/, "");
    blocks.push(inner);
    return token;
  });

  return {
    text: protectedText,
    restore: createRestorer(tokenPrefix, blocks),
  };
}