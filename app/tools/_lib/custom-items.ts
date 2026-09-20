// 自訂符號／顏文字／分隔線:內建清單一定不夠用,所以讓使用者自己加,
// 並且能整份帶走再帶回來——存在 localStorage 的東西清了瀏覽器資料就沒了,
// 沒有匯出的話等於要求使用者相信瀏覽器,那不合理。

export type CustomKind = "symbol" | "kaomoji" | "divider";

export const CUSTOM_KINDS: CustomKind[] = ["symbol", "kaomoji", "divider"];

export const CUSTOM_LABELS: Record<CustomKind, string> = {
  symbol: "符號",
  kaomoji: "顏文字",
  divider: "分隔線",
};

export type CustomSets = Record<CustomKind, string[]>;

export const CUSTOM_LIMIT = 300;

export function emptySets(): CustomSets {
  return { symbol: [], kaomoji: [], divider: [] };
}

/** 新的排在最前面;已經有的往前移而不是再塞一筆 */
export function addCustom(list: string[], value: string): string[] {
  const item = value.trim();
  if (!item) return list;
  return [item, ...list.filter((entry) => entry !== item)].slice(0, CUSTOM_LIMIT);
}

export function removeCustom(list: string[], value: string): string[] {
  return list.filter((entry) => entry !== value);
}

function isKind(value: string): value is CustomKind {
  return (CUSTOM_KINDS as string[]).includes(value);
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const item = entry.trim();
    if (item) seen.add(item);
  }
  return [...seen].slice(0, CUSTOM_LIMIT);
}

/**
 * 吃三種格式:
 *   1. 完整備份物件 { symbol: [...], kaomoji: [...], divider: [...] }
 *   2. 單一類別的 JSON 陣列 ["✦", "❀"]
 *   3. 純文字,一行一個(最省事的做法:從別的地方複製一整排貼進來)
 *
 * 後兩種不帶類別資訊,所以要由呼叫端指定進哪一類。
 */
export function parseImport(raw: string, fallback: CustomKind): Partial<CustomSets> {
  const text = raw.trim();
  if (!text) return {};

  try {
    const parsed: unknown = JSON.parse(text);

    if (Array.isArray(parsed)) {
      return { [fallback]: cleanList(parsed) };
    }

    if (parsed && typeof parsed === "object") {
      const result: Partial<CustomSets> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (isKind(key)) result[key] = cleanList(value);
      }
      return result;
    }
  } catch {
    // 不是 JSON 就當純文字處理
  }

  return { [fallback]: cleanList(text.split("\n")) };
}

/** 匯入是「合併」不是「覆蓋」:使用者自己加的東西不該被一次匯入清掉 */
export function mergeSets(current: CustomSets, incoming: Partial<CustomSets>): CustomSets {
  const merged = emptySets();

  for (const kind of CUSTOM_KINDS) {
    const seen = new Set<string>([...(incoming[kind] ?? []), ...current[kind]]);
    merged[kind] = [...seen].slice(0, CUSTOM_LIMIT);
  }

  return merged;
}

export function serialize(sets: CustomSets): string {
  return JSON.stringify(sets, null, 2);
}

const STORAGE_KEY = "social-custom-items";

export function loadCustom(): CustomSets {
  if (typeof localStorage === "undefined") return emptySets();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySets();
    return mergeSets(emptySets(), parseImport(raw, "symbol"));
  } catch {
    return emptySets();
  }
}

export function saveCustom(sets: CustomSets): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, serialize(sets));
  } catch {
    // 容量滿了或無痕模式:靜靜放棄,不要讓面板炸掉
  }
}
