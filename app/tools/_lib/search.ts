/**
 * 符號盤的關鍵字比對。
 *
 * 關鍵字是以空白分隔的詞(「心 heart 空心 愛」),所以單純的子字串比對
 * 會讓「愛心」這種把兩個詞黏在一起的中文查詢找不到東西。
 * 規則放寬成雙向包含:查詢字串包含某個詞、或某個詞包含查詢字串,都算命中。
 */
export function matchesKeyword(keywords: string, query: string): boolean {
  if (!query) return true;
  if (keywords.includes(query)) return true;

  return keywords
    .split(/\s+/)
    .some((token) => !!token && (token.includes(query) || query.includes(token)));
}
