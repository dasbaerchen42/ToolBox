import { type FontFamilyName } from "@/lib/preferences";

/** 設定面板與轉圖視窗共用的字體選單,順序就是畫面上的順序 */
export const FONT_OPTIONS: { key: FontFamilyName; label: string }[] = [
  { key: "sans", label: "黑體" },
  { key: "serif", label: "明體" },
  { key: "round", label: "粉圓" },
  { key: "wenkai", label: "霞鶩文楷" },
  { key: "iansui", label: "芫荽（手寫）" },
  { key: "cactus", label: "仙人掌明體（古典）" },
  { key: "goround", label: "圓體" },
  { key: "chocolate", label: "古典黑體" },
  { key: "marker", label: "麥克筆黑體" },
  { key: "lubrifont", label: "潤字體（可愛粗體）" },
  { key: "mono", label: "等寬" },
  { key: "cursive", label: "英文手寫感" },
  // 英文字體:中文字會用黑體補上
  { key: "dancing", label: "Dancing Script（英文優雅草寫）" },
  { key: "caveat", label: "Caveat（英文隨手寫）" },
  { key: "pacifico", label: "Pacifico（英文圓潤草寫）" },
  { key: "permanent", label: "Permanent Marker（英文麥克筆）" },
  { key: "playfair", label: "Playfair Display（英文典雅襯線）" },
  { key: "bebas", label: "Bebas Neue（英文粗標題）" },
];

/** 英文字體缺中文字:補上的中文字體(黑體) */
const CJK_FALLBACK = 'var(--font-noto-sans-tc), "Noto Sans TC", "Microsoft JhengHei", sans-serif';

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
    case "goround":
      return 'var(--font-goround), "Chiron GoRound TC", sans-serif';
    case "chocolate":
      return 'var(--font-chocolate), "Chocolate Classical Sans", sans-serif';
    case "marker":
      return 'var(--font-marker), "LXGW Marker Gothic", sans-serif';
    case "lubrifont":
      return 'var(--font-lubrifont), "WDXL Lubrifont TC", sans-serif';
    case "dancing":
      return `var(--font-dancing), "Dancing Script", ${CJK_FALLBACK}`;
    case "caveat":
      return `var(--font-caveat), "Caveat", ${CJK_FALLBACK}`;
    case "pacifico":
      return `var(--font-pacifico), "Pacifico", ${CJK_FALLBACK}`;
    case "permanent":
      return `var(--font-permanent), "Permanent Marker", ${CJK_FALLBACK}`;
    case "playfair":
      return `var(--font-playfair), "Playfair Display", var(--font-noto-serif-tc), "Noto Serif TC", serif`;
    case "bebas":
      return `var(--font-bebas), "Bebas Neue", ${CJK_FALLBACK}`;
    case "sans":
    default:
      return 'var(--font-noto-sans-tc), "Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif';
  }
}
