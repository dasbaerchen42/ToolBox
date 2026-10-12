import { getFontFamily } from "@/lib/editor-font";
import { type FontFamilyName } from "@/lib/preferences";

// 中文網路字體的 @font-face 宣告一套就有一兩百條 unicode-range,
// 五套直接掛在 layout 上,每一頁都要先下載將近 300KB(gzip 後)的 CSS 才畫得出來。
// 所以每套字各自一個模組、用動態 import 載入:選到哪套才抓哪套的 CSS,
// 真正的字檔再由瀏覽器依頁面上用到的字逐片抓。
//
// 字檔都是建置時從 Google 下載、跟網站一起放的,執行時不連 Google。

type FontModule = { default: { variable: string } };

const LOADERS: Partial<Record<FontFamilyName, () => Promise<FontModule>>> = {
  sans: () => import("./noto-sans-tc"),
  serif: () => import("./noto-serif-tc"),
  wenkai: () => import("./wenkai"),
  iansui: () => import("./iansui"),
  cactus: () => import("./cactus"),
  goround: () => import("./goround"),
  chocolate: () => import("./chocolate"),
  marker: () => import("./marker"),
  lubrifont: () => import("./lubrifont"),
  dancing: () => import("./dancing"),
  caveat: () => import("./caveat"),
  pacifico: () => import("./pacifico"),
  permanent: () => import("./permanent"),
  playfair: () => import("./playfair"),
  bebas: () => import("./bebas"),
};

/** 英文字體缺中文字,一起載入補位的中文字體 */
const COMPANIONS: Partial<Record<FontFamilyName, FontFamilyName>> = {
  dancing: "sans",
  caveat: "sans",
  pacifico: "sans",
  permanent: "sans",
  bebas: "sans",
  playfair: "serif",
};

const loading = new Map<FontFamilyName, Promise<void>>();

/**
 * 確保這套字的 CSS 變數已經掛在 <html> 上。
 * 掛在 <html> 而不是某個元件上,轉圖時插在 body 底下的暫存節點也吃得到。
 */
export function ensureWebFont(font: FontFamilyName): Promise<void> {
  const companion = COMPANIONS[font];
  if (companion) return Promise.all([loadOne(font), loadOne(companion)]).then(() => undefined);
  return loadOne(font);
}

function loadOne(font: FontFamilyName): Promise<void> {
  const loader = LOADERS[font];
  if (!loader || typeof document === "undefined") return Promise.resolve();

  let task = loading.get(font);
  if (!task) {
    task = loader()
      .then((mod) => {
        document.documentElement.classList.add(mod.default.variable);
      })
      .catch((error: unknown) => {
        // 載不到就用備援字體,下次選到再試一次
        loading.delete(font);
        console.warn("字體載入失敗:", error);
      });
    loading.set(font, task);
  }
  return task;
}

/** font-family 清單裡真正要下載的字體:去掉通用字族與 next/font 產生的「Fallback」別名 */
export function loadableFamilies(fontFamily: string): string[] {
  return fontFamily
    .split(",")
    .map((name) => name.trim())
    .filter((name) => {
      const bare = name.replace(/^["']|["']$/g, "");
      if (!bare) return false;
      if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|math|emoji|fangsong|ui-[a-z-]+)$/i.test(bare)) return false;
      // next/font 為每套字產生一個「XXX Fallback」:指向系統字(local)調整大小用。
      // 系統裡沒有那套字時(很多手機)載入會失敗,一起丟進 load 的話整批都失敗、粗體就沒載到
      return !/ fallback$/i.test(bare);
    })
    .filter((name, index, list) => list.indexOf(name) === index);
}

/**
 * canvas 的 ctx.font 不認 CSS 變數,要先換成真正的字體名稱。
 * 順便把這段文字要用到的字抓下來,畫的當下才不會用到備援字體。
 */
export async function canvasFontFamily(
  font: FontFamilyName,
  sample: string,
  weight: number
): Promise<string> {
  await ensureWebFont(font);
  const root = getComputedStyle(document.documentElement);
  const family = getFontFamily(font).replace(
    /var\((--[\w-]+)\)/g,
    (_, name: string) => root.getPropertyValue(name).trim() || "sans-serif"
  );
  // 一套一套分開載:清單裡的「Fallback」別名載不到時,不會連真正的字體都沒載
  const results = await Promise.allSettled(
    loadableFamilies(family).map((name) => document.fonts?.load(`${weight} 48px ${name}`, sample))
  );
  for (const result of results) if (result.status === "rejected") console.warn("字體載入失敗:", result.reason);
  return family;
}

/**
 * 英文花體字母(𝓐、𝔄、🄰……)是 Unicode 裡的數學、符號字元,不少手機的系統字型缺幾種。
 * 用到時載入 Noto Sans Math 與 Noto Sans Symbols 2 補上,回傳要接在 font-family 後面的字體。
 */
let fancyLoading: Promise<void> | null = null;
export const FANCY_FALLBACK = '"Noto Sans Math", "Noto Sans Symbols 2"';

export async function ensureFancyFallback(sample: string): Promise<string> {
  if (typeof document === "undefined") return FANCY_FALLBACK;
  fancyLoading ??= Promise.all([import("./math"), import("./symbols2")])
    .then((mods) => {
      for (const mod of mods) document.documentElement.classList.add(mod.default.variable);
    })
    .catch((error: unknown) => {
      fancyLoading = null;
      console.warn("花體字型載入失敗:", error);
    });
  await fancyLoading;
  await Promise.allSettled(['48px "Noto Sans Math"', '48px "Noto Sans Symbols 2"'].map((font) => document.fonts?.load(font, sample)));
  return FANCY_FALLBACK;
}
