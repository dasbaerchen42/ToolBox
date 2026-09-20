// 編輯區的文字操作:插入與取代。
//
// 全部是純函式,回傳新的內容與新的游標位置——textarea 的 selection
// 一定要跟著算,不然套用完游標會彈到開頭,接著打字就接錯位置。

export type EditResult = {
  text: string;
  selectionStart: number;
  selectionEnd: number;
};

/** 把 [start, end) 換成 replacement,並把選取範圍留在換上去的那一段 */
export function replaceRange(
  text: string,
  start: number,
  end: number,
  replacement: string
): EditResult {
  const from = Math.min(Math.max(start, 0), text.length);
  const to = Math.min(Math.max(end, from), text.length);

  return {
    text: text.slice(0, from) + replacement + text.slice(to),
    selectionStart: from,
    selectionEnd: from + replacement.length,
  };
}

/** 插入到游標;有選取範圍就取代掉它,游標落在插入內容的後面 */
export function insertAt(
  text: string,
  start: number,
  end: number,
  snippet: string
): EditResult {
  const result = replaceRange(text, start, end, snippet);
  return {
    ...result,
    selectionStart: result.selectionEnd,
  };
}

/**
 * 這次操作實際會動到哪一段。
 *
 * 有選取就是選取的那一段;沒選取(start === end)就是整篇——
 * 維持合併前「整篇轉換」的行為當退路,不然沒選取時按下去會毫無反應。
 */
export function targetRange(
  text: string,
  start: number,
  end: number
): { start: number; end: number } {
  if (start === end) return { start: 0, end: text.length };

  const from = Math.min(Math.max(start, 0), text.length);
  const to = Math.min(Math.max(end, from), text.length);
  return { start: from, end: to };
}

/** 套用一個文字轉換在作用範圍上 */
export function applyToSelection(
  text: string,
  start: number,
  end: number,
  transform: (input: string) => string
): EditResult {
  const range = targetRange(text, start, end);
  return replaceRange(text, range.start, range.end, transform(text.slice(range.start, range.end)));
}

/** 目前會作用在哪裡:給按鈕標示用 */
export function selectionScope(start: number, end: number): "selection" | "all" {
  return start === end ? "all" : "selection";
}
