import { type FontFamilyName } from "@/lib/preferences";

/** 設定面板與轉圖視窗共用的字體選單,順序就是畫面上的順序 */
export const FONT_OPTIONS: { key: FontFamilyName; label: string }[] = [
  { key: "sans", label: "黑體" },
  { key: "serif", label: "明體" },
  { key: "round", label: "粉圓" },
  { key: "wenkai", label: "霞鶩文楷" },
  { key: "iansui", label: "芫荽（手寫）" },
  { key: "cactus", label: "仙人掌明體（古典）" },
  { key: "mono", label: "等寬" },
  { key: "cursive", label: "英文手寫感" },
];

/**
 * 編輯區、預覽區、匯出圖片共用同一組字體對映,三邊看起來才會一致。
 * 中文字體都是 lib/web-fonts 建置時一起打包的網路字體,選到才載入,
 * 所以手機、沒裝中文字型的電腦匯出來的圖也長一樣。
 */
export function getFontFamily(fontFamily: FontFamilyName): string {
  switch (fontFamily) {
    case "serif":
      // 英數字維持 Georgia,中文交給思源宋體
      return 'Georgia, var(--font-noto-serif-tc), "Noto Serif TC", "PMingLiU", serif';
    case "mono":
      return '"SFMono-Regular", "Cascadia Mono", "Fira Code", "Consolas", monospace';
    case "cursive":
      return '"Segoe Script", "Brush Script MT", cursive';
    case "round":
      return "var(--font-round)";
    case "wenkai":
      return 'var(--font-wenkai), "LXGW WenKai TC", serif';
    case "iansui":
      return 'var(--font-iansui), "Iansui", cursive';
    case "cactus":
      return 'var(--font-cactus), "Cactus Classical Serif", serif';
    case "sans":
    default:
      return 'var(--font-noto-sans-tc), "Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif';
  }
}
