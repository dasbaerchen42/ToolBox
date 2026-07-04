"use client";

// 編輯區上方的常駐小工具列:還原/重做 + 尋找/取代。
// 尋找採「跳選反白」模式(原生 textarea 無法同時標黃多筆),
// 顯示「第 n / 共 m 筆」,上一筆/下一筆用 setSelectionRange 跳過去。

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { EditorThemeConfig } from "@/lib/theme";
import {
  IconChevronDown,
  IconChevronUp,
  IconClose,
  IconRedo,
  IconReplace,
  IconSearch,
  IconUndo,
} from "./editor-icons";

type EditorFindReplaceProps = {
  content: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** 取代造成的內容變更(呼叫端要 commit 成獨立歷史步) */
  onReplaceContent: (next: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  theme: EditorThemeConfig;
};

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
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  theme,
}: EditorFindReplaceProps) {
  const [query, setQuery] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [rawActiveIndex, setActiveIndex] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(
    () => findMatches(content, query, caseSensitive),
    [content, query, caseSensitive]
  );

  // 內容或關鍵字變動後原本的筆數可能失效,渲染期直接夾回合法範圍
  const activeIndex =
    matches.length === 0 ? 0 : Math.min(rawActiveIndex, matches.length - 1);

  // 面板打開時自動聚焦尋找框
  useEffect(() => {
    if (open) findInputRef.current?.select();
  }, [open]);

  function jumpTo(index: number) {
    const el = textareaRef.current;
    if (!el || matches.length === 0) return;
    const start = matches[index];
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
    const start = matches[activeIndex];
    const next =
      content.slice(0, start) + replaceWith + content.slice(start + query.length);
    onReplaceContent(next);
    // 取代後同位置之後的下一筆會遞補成同一個 index,維持 activeIndex 即可
  }

  function replaceAll() {
    if (matches.length === 0) return;
    let next = "";
    let cursor = 0;
    for (const start of matches) {
      next += content.slice(cursor, start) + replaceWith;
      cursor = start + query.length;
    }
    next += content.slice(cursor);
    onReplaceContent(next);
    setActiveIndex(0);
  }

  const iconBtn = `flex items-center justify-center rounded-full border p-2 transition disabled:opacity-30 ${theme.secondaryButton} ${theme.secondaryButtonText}`;
  const inputCls = `min-w-0 flex-1 rounded-full border px-4 py-2 text-sm tracking-[0.04em] outline-none ${theme.border} ${theme.inputBg}`;

  return (
    <div className="mx-auto mb-3 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="還原(Ctrl+Z)"
          aria-label="還原"
          className={iconBtn}
        >
          <IconUndo />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="重做(Ctrl+Shift+Z)"
          aria-label="重做"
          className={iconBtn}
        >
          <IconRedo />
        </button>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          title="尋找與取代(Ctrl+F)"
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm tracking-[0.04em] transition ${
            open
              ? `bg-(--accent) text-(--on-accent) border-(--accent)`
              : `${theme.secondaryButton} ${theme.secondaryButtonText}`
          }`}
        >
          <IconSearch />
          尋找/取代
        </button>
      </div>

      {open && (
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
      )}
    </div>
  );
}
