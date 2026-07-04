"use client";

// 編輯器的還原/重做歷史:每份文件一條快照堆疊(記憶體內)。
// - 打字停頓 800ms 內的變更合併成一步(跟一般編輯器的復原顆粒度一致)
// - 取代等程式化變更用 commit() 強制獨立成一步,按錯「全部取代」可一鍵救回
// - 不依賴瀏覽器內建 undo(程式化改值會弄斷它),快捷鍵由呼叫端攔截接進來

import { useCallback, useState } from "react";

const COALESCE_MS = 800;
const MAX_STEPS = 100;

type DocHistory = {
  stack: string[];
  index: number;
  lastRecordAt: number;
};

export function useEditorHistory(activeDocId: string) {
  // 可變 Map 以惰性 state 建立(不進 setState;變動靠 bump 觸發重繪)
  const [histories] = useState(() => new Map<string, DocHistory>());
  // 只拿來觸發重繪,讓 canUndo/canRedo 跟著按鈕更新
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const getHistory = useCallback(
    (docId: string): DocHistory | undefined => histories.get(docId),
    [histories]
  );

  /** 文件首次出現時以目前內容建立基底快照;已存在則不動。 */
  const init = useCallback(
    (docId: string, content: string) => {
      if (histories.has(docId)) return;
      histories.set(docId, {
        stack: [content],
        index: 0,
        lastRecordAt: 0,
      });
      bump();
    },
    [histories, bump]
  );

  function pushStep(h: DocHistory, content: string, coalesce: boolean) {
    if (h.stack[h.index] === content) return;

    const now = Date.now();
    const atTop = h.index === h.stack.length - 1;

    if (coalesce && atTop && h.index > 0 && now - h.lastRecordAt < COALESCE_MS) {
      // 連續打字:蓋掉最上層那步,不長新步
      h.stack[h.index] = content;
    } else {
      h.stack.length = h.index + 1; // 截掉 redo 尾巴
      h.stack.push(content);
      h.index += 1;
      while (h.stack.length > MAX_STEPS) {
        h.stack.shift();
        h.index -= 1;
      }
    }
    h.lastRecordAt = now;
  }

  /** 一般打字變更(會與 800ms 內的前一步合併)。 */
  const record = useCallback(
    (docId: string, content: string) => {
      const h = getHistory(docId);
      if (!h) return;
      pushStep(h, content, true);
      bump();
    },
    [getHistory, bump]
  );

  /** 程式化變更(取代單筆/全部取代):必定獨立成一步。 */
  const commit = useCallback(
    (docId: string, content: string) => {
      const h = getHistory(docId);
      if (!h) return;
      pushStep(h, content, false);
      h.lastRecordAt = 0; // 之後的打字不要併進這一步
      bump();
    },
    [getHistory, bump]
  );

  const undo = useCallback(
    (docId: string): string | null => {
      const h = getHistory(docId);
      if (!h || h.index <= 0) return null;
      h.index -= 1;
      h.lastRecordAt = 0;
      bump();
      return h.stack[h.index];
    },
    [getHistory, bump]
  );

  const redo = useCallback(
    (docId: string): string | null => {
      const h = getHistory(docId);
      if (!h || h.index >= h.stack.length - 1) return null;
      h.index += 1;
      h.lastRecordAt = 0;
      bump();
      return h.stack[h.index];
    },
    [getHistory, bump]
  );

  const active = histories.get(activeDocId);
  const canUndo = !!active && active.index > 0;
  const canRedo = !!active && active.index < active.stack.length - 1;

  return { init, record, commit, undo, redo, canUndo, canRedo };
}
