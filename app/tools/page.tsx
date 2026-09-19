"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ToolHeader from "@/components/editor/ToolHeader";
import Segmented from "@/components/segmented";
import { getThemeClasses } from "@/lib/theme";
import { useEditorHistory } from "@/hooks/useEditorHistory";
import { getFontResults } from "./_lib/fancy-fonts";
import { convertSocialText } from "./_lib/social";
import { analyzeSocial, countSocial, describeSocial } from "./_lib/social-marks";
import {
  applyToSelection,
  insertAt,
  selectionScope,
  type EditResult,
} from "./_lib/text-edit";
import { addToRecent, loadRecent, saveRecent } from "./_lib/recent";
import MarkedView from "./_components/MarkedView";
import FontPalette from "./_components/FontPalette";
import SymbolPalette from "./_components/SymbolPalette";
import KaomojiPalette from "./_components/KaomojiPalette";
import DividerPalette from "./_components/DividerPalette";
import type { PickMode } from "./_components/palette-parts";

/** useEditorHistory 是以文件 id 分堆的,這裡只有一份內容 */
const DOC_ID = "social";

const STORAGE = {
  view: "social-view-mode",
  pick: "social-pick-mode",
  symbols: "social-recent-symbols",
  kaomoji: "social-recent-kaomoji",
} as const;

type ViewMode = "plain" | "marked" | "split";
type PaletteKey = "font" | "symbol" | "divider" | "kaomoji";

const PALETTES: { key: PaletteKey; label: string }[] = [
  { key: "font", label: "字體" },
  { key: "symbol", label: "符號" },
  { key: "divider", label: "分隔線" },
  { key: "kaomoji", label: "顏文字" },
];

export default function SocialToolsPage() {
  const t = getThemeClasses();

  const [text, setText] = useState("");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [palette, setPalette] = useState<PaletteKey>("font");
  const [view, setView] = useState<ViewMode>("plain");
  const [pickMode, setPickMode] = useState<PickMode>("insert");
  const [recentSymbols, setRecentSymbols] = useState<string[]>([]);
  const [recentKaomoji, setRecentKaomoji] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const history = useEditorHistory(DOC_ID);

  useEffect(() => {
    history.init(DOC_ID, "");
  }, [history]);

  // 偏好在 client 才讀得到,所以是水合而不是初始值
  useEffect(() => {
    const savedView = localStorage.getItem(STORAGE.view);
    if (savedView === "plain" || savedView === "marked" || savedView === "split") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only localStorage 水合
      setView(savedView);
    }

    const savedPick = localStorage.getItem(STORAGE.pick);
    if (savedPick === "insert" || savedPick === "copy") setPickMode(savedPick);

    setRecentSymbols(loadRecent(STORAGE.symbols));
    setRecentKaomoji(loadRecent(STORAGE.kaomoji));
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  /**
   * 選取範圍要即時同步給面板:字體預覽顯示的是「會被套用的那段字」,
   * 拿到過期的選取就等於預覽在騙人。
   *
   * 不能只靠 React 的 onSelect——它是合成事件,不是原生 select 的直接轉發,
   * 某些變更(用鍵盤移動、程式化設定)不一定接得到。document 上的
   * selectionchange 才是唯一會全部涵蓋的來源。
   */
  useEffect(() => {
    function sync() {
      const node = textareaRef.current;
      if (!node || document.activeElement !== node) return;

      setSelection((prev) => {
        const start = node.selectionStart ?? 0;
        const end = node.selectionEnd ?? 0;
        // 值沒變就不要觸發重繪,不然每次移動游標都重算 24 個字體預覽
        if (prev.start === start && prev.end === end) return prev;
        return { start, end };
      });
    }

    document.addEventListener("selectionchange", sync);
    return () => document.removeEventListener("selectionchange", sync);
  }, []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 2400);
  }, []);

  /** 套用一次程式化編輯:更新內容、還原游標、記成獨立的一步 */
  const applyEdit = useCallback(
    (result: EditResult) => {
      setText(result.text);
      history.commit(DOC_ID, result.text);

      // 不等這一幀畫完就設 selection 會被 React 的重繪蓋掉
      requestAnimationFrame(() => {
        const node = textareaRef.current;
        if (!node) return;
        node.focus();
        node.setSelectionRange(result.selectionStart, result.selectionEnd);
        setSelection({ start: result.selectionStart, end: result.selectionEnd });
      });
    },
    [history]
  );

  /** 按下面板時游標可能已經離開 textarea,但 selectionStart 會留著,以它為準 */
  const currentRange = () => {
    const node = textareaRef.current;
    if (!node) return selection;
    return { start: node.selectionStart ?? 0, end: node.selectionEnd ?? 0 };
  };

  function handleChange(value: string) {
    setText(value);
    history.record(DOC_ID, value);
  }

  function handleUndo() {
    const previous = history.undo(DOC_ID);
    if (previous !== null) setText(previous);
  }

  function handleRedo() {
    const next = history.redo(DOC_ID);
    if (next !== null) setText(next);
  }

  function applyFont(styleKey: string) {
    const { start, end } = currentRange();
    const result = applyToSelection(text, start, end, (input) => {
      const found = getFontResults(input).find((item) => item.key === styleKey);
      return found?.value ?? input;
    });
    applyEdit(result);
  }

  async function pick(value: string, kind: "symbol" | "kaomoji" | "divider") {
    if (kind === "symbol") {
      const next = addToRecent(recentSymbols, value);
      setRecentSymbols(next);
      saveRecent(STORAGE.symbols, next);
    }
    if (kind === "kaomoji") {
      const next = addToRecent(recentKaomoji, value);
      setRecentKaomoji(next);
      saveRecent(STORAGE.kaomoji, next);
    }

    if (pickMode === "copy") {
      await navigator.clipboard.writeText(value);
      showNotice(`已複製 ${value}`);
      return;
    }

    const { start, end } = currentRange();
    applyEdit(insertAt(text, start, end, value));
  }

  async function copyOut(withSocial: boolean) {
    const value = withSocial ? convertSocialText(text) : text;
    if (!value) return;

    await navigator.clipboard.writeText(value);
    showNotice(withSocial ? "已複製（含社群排版）。" : "已複製。");
  }

  function changeView(next: ViewMode) {
    setView(next);
    localStorage.setItem(STORAGE.view, next);
  }

  function changePickMode(next: PickMode) {
    setPickMode(next);
    localStorage.setItem(STORAGE.pick, next);
  }

  const count = useMemo(() => countSocial(analyzeSocial(text)), [text]);
  const scope = selectionScope(selection.start, selection.end);
  const sample =
    scope === "selection"
      ? text.slice(selection.start, selection.end)
      : text;

  const showEditor = view !== "marked";
  const showMarked = view !== "plain";

  return (
    <main className={`min-h-screen ${t.page}`}>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <ToolHeader
          title="社群轉換區"
          description="一個編輯區，字體、符號、分隔線、顏文字都直接作用在上面。社群排版在複製的那一刻才套用。"
          t={t}
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className={`rounded-3xl border p-4 md:p-5 ${t.panel}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <Segmented
                value={view}
                onChange={changeView}
                t={t}
                label="檢視方式"
                options={[
                  { value: "plain", label: "原文" },
                  { value: "marked", label: "標記查看" },
                  { value: "split", label: "並排", mdOnly: true },
                ]}
              />

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!history.canUndo}
                  className={`rounded-xl border px-3 py-1.5 text-xs transition disabled:opacity-40 ${t.secondary}`}
                >
                  復原
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={!history.canRedo}
                  className={`rounded-xl border px-3 py-1.5 text-xs transition disabled:opacity-40 ${t.secondary}`}
                >
                  重做
                </button>
              </div>
            </div>

            <div
              className={`grid gap-3 ${
                view === "split" ? "md:grid-cols-2" : "grid-cols-1"
              }`}
            >
              {showEditor && (
                <div>
                  {view === "split" && (
                    <p className={`mb-1 text-[11px] tracking-[0.12em] ${t.muted}`}>
                      原文（在這裡打字）
                    </p>
                  )}
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(event) => handleChange(event.target.value)}
                    onSelect={(event) => {
                      const node = event.currentTarget;
                      setSelection({
                        start: node.selectionStart ?? 0,
                        end: node.selectionEnd ?? 0,
                      });
                    }}
                    placeholder="在這裡寫貼文……圈起一段文字再到右邊選字體，就只會換那一段。"
                    className={`h-[26rem] w-full rounded-[24px] border p-4 text-sm leading-8 tracking-[0.04em] outline-none ${t.input}`}
                  />
                </div>
              )}

              {showMarked && (
                <div>
                  {view === "split" && (
                    <p className={`mb-1 text-[11px] tracking-[0.12em] ${t.muted}`}>
                      標記查看（唯讀）
                    </p>
                  )}
                  <div className="h-[26rem]">
                    <MarkedView text={text} t={t} />
                  </div>
                </div>
              )}
            </div>

            <p className={`mt-3 text-xs leading-6 ${t.muted}`}>
              {text.length} 字・{describeSocial(count)}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void copyOut(true)}
                disabled={!text}
                className={`rounded-2xl border px-4 py-2 text-sm tracking-[0.04em] transition disabled:opacity-40 ${t.primary}`}
              >
                複製（含社群排版）
              </button>
              <button
                type="button"
                onClick={() => void copyOut(false)}
                disabled={!text}
                className={`rounded-2xl border px-4 py-2 text-sm tracking-[0.04em] transition disabled:opacity-40 ${t.secondary}`}
              >
                只複製原文
              </button>
              <button
                type="button"
                onClick={() => {
                  setText("");
                  history.commit(DOC_ID, "");
                }}
                disabled={!text}
                className={`rounded-2xl border px-4 py-2 text-sm tracking-[0.04em] transition disabled:opacity-40 ${t.secondary}`}
              >
                清空
              </button>

              {notice && (
                <span aria-live="polite" className={`text-xs ${t.muted}`}>
                  {notice}
                </span>
              )}
            </div>
          </section>

          <aside className={`rounded-3xl border p-4 md:p-5 ${t.panel}`}>
            <div className="mb-3">
              <Segmented
                value={palette}
                onChange={setPalette}
                t={t}
                label="面板"
                options={PALETTES.map((item) => ({
                  value: item.key,
                  label: item.label,
                }))}
              />
            </div>

            {palette === "font" && (
              <FontPalette sample={sample} scope={scope} onApply={applyFont} t={t} />
            )}

            {palette === "symbol" && (
              <SymbolPalette
                mode={pickMode}
                onMode={changePickMode}
                recent={recentSymbols}
                onPick={(value) => void pick(value, "symbol")}
                t={t}
              />
            )}

            {palette === "divider" && (
              <DividerPalette
                mode={pickMode}
                onMode={changePickMode}
                onPick={(value) => void pick(value, "divider")}
                t={t}
              />
            )}

            {palette === "kaomoji" && (
              <KaomojiPalette
                mode={pickMode}
                onMode={changePickMode}
                recent={recentKaomoji}
                onPick={(value) => void pick(value, "kaomoji")}
                t={t}
              />
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
