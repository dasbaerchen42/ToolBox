import { type FontFamilyName } from "@/lib/preferences";

/** 編輯區、預覽區、匯出圖片共用同一組字體對映,三邊看起來才會一致 */
export function getFontFamily(fontFamily: FontFamilyName): string {
  switch (fontFamily) {
    case "serif":
      return 'Georgia, "Times New Roman", serif';
    case "mono":
      return '"SFMono-Regular", "Cascadia Mono", "Fira Code", "Consolas", monospace';
    case "cursive":
      return '"Segoe Script", "Brush Script MT", cursive';
    case "round":
      return "var(--font-round)";
    case "sans":
    default:
      return '"Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif';
  }
}
