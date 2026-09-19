// 最近用過的符號/顏文字。清單邏輯抽成純函式,存取 localStorage 包在外面。

export const RECENT_LIMIT = 20;

/** 最新的排最前面;重複的往前移而不是再塞一筆 */
export function addToRecent(
  list: string[],
  value: string,
  limit = RECENT_LIMIT
): string[] {
  if (!value) return list;
  return [value, ...list.filter((item) => item !== value)].slice(0, limit);
}

export function loadRecent(key: string): string[] {
  if (typeof localStorage === "undefined") return [];

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    // 存壞了就當作沒有,不要讓面板整個炸掉
    return [];
  }
}

export function saveRecent(key: string, list: string[]): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // 無痕模式或容量滿了:最近用過不是關鍵資料,靜靜放棄
  }
}
