"use client";

// 尋找/取代面板(按工具列的「尋找」或 Ctrl+F 打開)。
// 尋找採「跳選反白」模式(原生 textarea 無法同時標黃多筆),
// 顯示「第 n / 共 m 筆」,上一筆/下一筆用 setSelectionRange 跳過去。

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/react";
import type { EditorThemeConfig } from "@/lib/theme";
import {
  IconChevronDown,
  IconChevronUp,
  IconClose,
  IconReplace,
} from "./editor-icons";

type EditorFindReplaceProps = {
  content: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** 取代造成的內容變更(呼叫端要 commit 成獨立歷史步) */
  onReplaceContent: (next: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  theme: EditorThemeConfig;
  /** 文件的編輯模式:在排好的內容裡找、直接在編輯器裡取代 */
  richEditor?: Editor | null;
};

/** 編輯器內容裡每個符合的位置(只找單一段文字裡面的,跨粗體斜體邊界的不算) */
function findInEditor(editor: Editor, query: string, caseSensitive: boolean): { from: number; to: number }[] {
  if (!query) return [];
  const needle = caseSensitive ? query : query.toLowerCase();
  const found: { from: number; to: number }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = caseSensitive ? node.text : node.text.toLowerCase();
    let i = text.indexOf(needle);
    while (i !== -1 && found.length < 10000) {
      found.push({ from: pos + i, to: pos + i + query.length });
      i = text.indexOf(needle, i + needle.length);
    }
  });
  return found;
}

function findMatches(content: string, query: string, caseSensitive: boolean): number[] {
  if (!query) return [];
  const haystack = caseSensitive ? content : content.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const starts: number[] = [];
  let from = 0;
  while (true) {
    const i = haystack.indexOf(needle, from);
    if (i === -1) break;
    starts.push(i);
    from = i + needle.length;
    if (starts.length > 9999) break; // 保險
  }
  return starts;
}

export default function EditorFindReplace({
  content,
  textareaRef,
  onReplaceContent,
  open,
  setOpen,
  theme,
  richEditor,
}: EditorFindReplaceProps) {
  const [query, setQuery] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [rawActiveIndex, setActiveIndex] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);

  // 編輯模式時 content 是存檔的 Markdown,會跟著編輯器更新,拿來當重新找的時機
  const richMatches = useMemo(
    () => (richEditor ? findInEditor(richEditor, query, caseSensitive) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- content 變了代表編輯器內容變了
    [richEditor, query, caseSensitive, content]
  );
  const textMatches = useMemo(
    () => (richEditor ? [] : findMatches(content, query, caseSensitive)),
    [richEditor, content, query, caseSensitive]
  );
  const matches = richEditor ? richMatches : textMatches;

  // 內容或關鍵字變動後原本的筆數可能失效,渲染期直接夾回合法範圍
  const activeIndex =
    matches.length === 0 ? 0 : Math.min(rawActiveIndex, matches.length - 1);

  // 面板打開時自動聚焦尋找框
  useEffect(() => {
    if (open) findInputRef.current?.select();
  }, [open]);

  function jumpTo(index: number) {
    if (richEditor) {
      const match = richMatches[index];
      if (match) richEditor.chain().focus().setTextSelection(match).scrollIntoView().run();
      return;
    }
    const el = textareaRef.current;
    if (!el || matches.length === 0) return;
    const start = textMatches[index];
    const end = start + query.length;
    el.focus();
    el.setSelectionRange(start, end);
    // 估算捲動位置讓選取處落在中間(textarea 沒有精準 API,用比例近似)
    const ratio = start / Math.max(1, content.length);
    el.scrollTop = Math.max(0, ratio * el.scrollHeight - el.clientHeight / 2);
  }

  function goPrev() {
    if (matches.length === 0) return;
    const next = (activeIndex - 1 + matches.length) % matches.length;
    setActiveIndex(next);
    jumpTo(next);
  }

  function goNext() {
    if (matches.length === 0) return;
    const next = (activeIndex + 1) % matches.length;
    setActiveIndex(next);
    jumpTo(next);
  }

  function replaceCurrent() {
    if (matches.length === 0) return;
    if (richEditor) {
      const match = richMatches[activeIndex];
      richEditor.chain().focus().insertContentAt(match, replaceWith ? { type: "text", text: replaceWith } : []).run();
      return;
    }
    const start = textMatches[activeIndex];
    const next =
      content.slice(0, start) + replaceWith + content.slice(start + query.length);
    onReplaceContent(next);
    // 取代後同位置之後的下一筆會遞補成同一個 index,維持 activeIndex 即可
  }

  function replaceAll() {
    if (matches.length === 0) return;
    if (richEditor) {
      // 從後面往前換,前面的位置才不會跑掉;一次做完,復原一下就全部回來
      richEditor
        .chain()
        .command(({ tr }) => {
          for (const match of [...richMatches].reverse()) {
            if (replaceWith) tr.insertText(replaceWith, match.from, match.to);
            else tr.delete(match.from, match.to);
          }
          return true;
        })
        .run();
      setActiveIndex(0);
      return;
    }
    let next = "";
    let cursor = 0;
    for (const start of textMatches) {
      next += content.slice(cursor, start) + replaceWith;
      cursor = start + query.length;
    }
    next += content.slice(cursor);
    onReplaceContent(next);
    setActiveIndex(0);
  }

  const iconBtn = `flex items-center justify-center rounded-full border p-2 transition disabled:opacity-30 ${theme.secondaryButton} ${theme.secondaryButtonText}`;
  const inputCls = `min-w-0 flex-1 rounded-full border px-4 py-2 text-sm tracking-[0.04em] outline-none ${theme.border} ${theme.inputBg}`;

  if (!open) return null;

  return (
    <div className="mx-auto mb-3 w-full">
        <div
          className={`mt-2 flex flex-col gap-2 rounded-3xl border p-3 ${theme.border} ${theme.panelBg}`}
        >
          {/* 尋找列 */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={findInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.shiftKey) goPrev();
                  else goNext();
                }
              }}
              placeholder="尋找……"
              className={inputCls}
            />
            <span
              className={`whitespace-nowrap text-xs tracking-[0.04em] ${theme.mutedText}`}
            >
              {query
                ? matches.length > 0
                  ? `第 ${activeIndex + 1} / 共 ${matches.length} 筆`
                  : "沒有符合"
                : ""}
            </span>
            <button
              type="button"
              onClick={goPrev}
              disabled={matches.length === 0}
              title="上一筆(Shift+Enter)"
              aria-label="上一筆"
              className={iconBtn}
            >
              <IconChevronUp />
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={matches.length === 0}
              title="下一筆(Enter)"
              aria-label="下一筆"
              className={iconBtn}
            >
              <IconChevronDown />
            </button>
            <button
              type="button"
              onClick={() => setCaseSensitive((v) => !v)}
              title="區分大小寫"
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                caseSensitive
                  ? "bg-(--accent) text-(--on-accent) border-(--accent)"
                  : `${theme.secondaryButton} ${theme.secondaryButtonText}`
              }`}
            >
              Aa
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              title="關閉(Esc)"
              aria-label="關閉"
              className={iconBtn}
            >
              <IconClose />
            </button>
          </div>

          {/* 取代列 */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={replaceWith}
              onChange={(e) => setReplaceWith(e.target.value)}
              placeholder="取代為……"
              className={inputCls}
            />
            <button
              type="button"
              onClick={replaceCurrent}
              disabled={matches.length === 0}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm tracking-[0.04em] transition disabled:opacity-30 ${theme.secondaryButton} ${theme.secondaryButtonText}`}
            >
              <IconReplace size={16} />
              取代
            </button>
            <button
              type="button"
              onClick={replaceAll}
              disabled={matches.length === 0}
              className={`rounded-full px-4 py-2 text-sm tracking-[0.04em] transition disabled:opacity-30 ${theme.primaryButton} ${theme.primaryButtonText}`}
            >
              全部取代
            </button>
          </div>
        </div>
    </div>
  );
}
