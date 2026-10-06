"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createNewDoc } from "@/lib/storage";
import { EDITOR_THEME } from "@/lib/theme";
import EditorSidebar from "@/components/editor/editor-sidebar";
import EditorGoogleToolbar from "@/components/editor/editor-google-toolbar";
import EditorSettingsPanel from "@/components/editor/editor-settings-panel";
import EditorTextarea from "@/components/editor/editor-textarea";
import EditorPreview from "@/components/editor/editor-preview";
import EditorViewToggle, { DocViewToggle } from "@/components/editor/editor-view-toggle";
import dynamic from "next/dynamic";
import { useEditorState, type Editor } from "@tiptap/react";
import { htmlToMarkdown } from "@/lib/rich-text";
import { blockStylesToMarkup, renderToSafeHtml } from "@/lib/markdown";

// 所見即所得編輯器比較大,用到才載
const RichEditor = dynamic(() => import("@/components/editor/rich/rich-editor"), { ssr: false });
const RichFormatBar = dynamic(() => import("@/components/editor/rich/rich-format-bar"), { ssr: false });
import EditorExportModal from "@/components/editor/editor-export-modal";
import EditorFindReplace from "@/components/editor/editor-find-replace";
import EditorStatusPanel from "@/components/editor/editor-status-panel";
import { validateContent } from "@/lib/validators";
import EditorStatsBar from "@/components/editor/editor-stats-bar";
import { getEditorStats } from "@/lib/editor-stats";
import EditorMainToolbar from "@/components/editor/editor-main-toolbar";
import { formatDateTime24h } from "@/lib/datetime";
import { isRenderableMode } from "@/lib/markdown";
import {
  hasRichFormatting,
  readClipboard,
  titleFromContent,
  type PastePayload,
} from "@/lib/clipboard";
import { usePagePaste } from "@/hooks/usePagePaste";
import { useDocuments } from "@/hooks/useDocuments";
import { useEditorPreferences } from "@/hooks/useEditorPreferences";
import { useEditorHistory } from "@/hooks/useEditorHistory";

export default function EditorPage() {
  const {
    docs,
    activeDoc,
    activeDocId,
    setActiveDocId,
    handleCreateDoc,
    handleDeleteDoc,
    updateActiveDoc,
    addDoc,
  } = useDocuments();

  const {
    preferences,
    setPreferences,
    adjustFontSize,
    adjustLineHeight,
    adjustLetterSpacing,
  } = useEditorPreferences();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [pasteHint, setPasteHint] = useState<string | null>(null);
  // 剪貼簿裡有格式時先問要不要保留,問完才真的貼
  const [pendingPaste, setPendingPaste] = useState<
    { payload: PastePayload; thenExport: boolean } | null
  >(null);
  const [findOpen, setFindOpen] = useState(false);
  /** 文件編輯模式下的編輯器(工具列、尋找取代、復原重做要用) */
  const [richEditor, setRichEditor] = useState<Editor | null>(null);
  const richHistory = useEditorState({
    editor: richEditor,
    selector: ({ editor }) => ({ canUndo: !!editor?.can().undo(), canRedo: !!editor?.can().redo() }),
  });
  const history = useEditorHistory(activeDocId);

  // 文件首次出現時建立歷史基底快照
  useEffect(() => {
    if (activeDoc) history.init(activeDoc.id, activeDoc.content);
  }, [activeDoc, history]);

  function handleContentChange(value: string) {
    updateActiveDoc({ content: value });
    history.record(activeDocId, value);
  }

  function handleReplaceContent(value: string) {
    updateActiveDoc({ content: value });
    history.commit(activeDocId, value); // 取代必定獨立成一步,可一鍵還原
  }

  function doUndo() {
    if (richActive && richEditor) {
      richEditor.chain().focus().undo().run();
      return;
    }
    const prev = history.undo(activeDocId);
    if (prev !== null) updateActiveDoc({ content: prev });
  }

  function doRedo() {
    if (richActive && richEditor) {
      richEditor.chain().focus().redo().run();
      return;
    }
    const next = history.redo(activeDocId);
    if (next !== null) updateActiveDoc({ content: next });
  }

  // 攔截快捷鍵走自建歷史(瀏覽器內建 undo 會被程式化取代弄斷,不能混用)
  function handleEditorKeyDown(e: React.KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      setFindOpen(true);
    } else if (richActive) {
      // 編輯模式的復原重做交給編輯器自己(它記得游標與格式)
      if (e.key === "Escape" && findOpen) setFindOpen(false);
    } else if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      doUndo();
    } else if (
      (mod && e.shiftKey && e.key.toLowerCase() === "z") ||
      (mod && e.key.toLowerCase() === "y")
    ) {
      e.preventDefault();
      doRedo();
    } else if (e.key === "Escape" && findOpen) {
      setFindOpen(false);
      textareaRef.current?.focus();
    }
  }

  // 貼上一律開新文件:不會覆蓋掉正在寫的東西,所以純文字可以完全免確認
  const applyPaste = useCallback(
    async (payload: PastePayload, keepFormat: boolean, thenExport: boolean) => {
      const keep = keepFormat && !!payload.html;
      // 保留格式:先清洗,再轉成文件的 Markdown(粗體、清單、標題留著,顏色字體交給主題)
      const content = keep ? htmlToMarkdown(await renderToSafeHtml("html", payload.html!)) : payload.text;
      if (!content.trim()) return;

      addDoc({
        ...createNewDoc(),
        title: titleFromContent(payload.text || content),
        content,
        mode: "markdown",
      });

      setPendingPaste(null);
      setPasteHint(null);
      if (thenExport) setExportOpen(true);
    },
    [addDoc]
  );

  const handlePaste = useCallback(
    (payload: PastePayload, thenExport = false) => {
      if (hasRichFormatting(payload.html)) {
        setPendingPaste({ payload, thenExport });
        return;
      }
      void applyPaste(payload, false, thenExport);
    },
    [applyPaste]
  );

  // 游標不在輸入框裡時按 ⌘V / Ctrl+V 就直接貼進來
  const onPagePaste = useCallback(
    (payload: PastePayload) => handlePaste(payload),
    [handlePaste]
  );
  usePagePaste(onPagePaste);

  async function pasteFromClipboard(thenExport: boolean) {
    const payload = await readClipboard();
    if (!payload) {
      setPasteHint("讀不到剪貼簿（瀏覽器可能擋住了），直接按 ⌘V / Ctrl+V 貼上就好。");
      return;
    }
    handlePaste(payload, thenExport);
  }

  const theme = EDITOR_THEME;

  const validationResult = useMemo(
    () =>
      activeDoc
        ? validateContent(activeDoc.mode, activeDoc.content)
        : { status: "idle" as const, title: "狀態", messages: ["尚未選擇文件。"] },
    [activeDoc]
  );

  // 只有 Markdown / HTML 有東西可以渲染,其他模式一律停在純文字
  // 舊版在轉圖視窗設定的段落樣式:第一次打開時寫進內容裡,之後就跟一般格式一樣在編輯器裡改
  const legacyStyles = activeDoc?.blockStyles?.length ? activeDoc : null;
  useEffect(() => {
    if (!legacyStyles) return;
    let cancelled = false;
    const { mode, content, blockStyles } = legacyStyles;
    void (async () => {
      let next = content;
      if (mode === "markdown") next = htmlToMarkdown(blockStylesToMarkup(await renderToSafeHtml("markdown", content), blockStyles));
      else if (mode === "html") next = blockStylesToMarkup(await renderToSafeHtml("html", content), blockStyles);
      if (!cancelled) updateActiveDoc({ content: next, blockStyles: undefined });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 每份文件只轉一次
  }, [legacyStyles?.id]);

  // 文件(Markdown)用「編輯/原始語法」;HTML 進階模式才有「純文字/渲染/並排」
  const isDoc = activeDoc?.mode === "markdown";
  const richActive = isDoc && preferences.docView === "rich";
  const previewMode =
    activeDoc && isRenderableMode(activeDoc.mode) ? activeDoc.mode : null;
  const renderable = previewMode !== null && !isDoc;
  const viewMode = renderable ? preferences.viewMode : "edit";
  const showEditor = viewMode !== "preview";
  const showPreview = viewMode !== "edit";
  // 編輯區固定寬度;並排時兩欄,放寬一點
  const areaWidthClass = viewMode === "split" ? "max-w-6xl" : "max-w-4xl";
  // 進階模式(YAML、JSON……)本來就是為了語法檢查,一律顯示提示
  const showHints = preferences.showHints || !["markdown", "plain"].includes(activeDoc?.mode ?? "plain");

  const editorStats = useMemo(
    () => getEditorStats(activeDoc?.content ?? ""),
    [activeDoc?.content]
  );

  return (
    <main className={`flex flex-1 flex-col ${theme.pageBg} ${theme.text}`}>
      <div className="mx-auto grid w-full flex-1 max-w-7xl grid-cols-1 md:grid-cols-[280px_1fr]">
        <EditorSidebar
          docs={docs}
          activeDocId={activeDocId}
          onSelectDoc={setActiveDocId}
          onCreateDoc={handleCreateDoc}
          onDeleteDoc={handleDeleteDoc}
          theme={theme}
        />

        <section className="p-4 md:p-6">
          {activeDoc ? (
            <div className="flex h-full flex-col">
              <div className={`mx-auto w-full ${areaWidthClass}`}>
                <div className="mb-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={activeDoc.title}
                    onChange={(e) => updateActiveDoc({ title: e.target.value })}
                    aria-label="文件標題"
                    className={`min-w-0 flex-1 rounded-2xl border px-4 py-2.5 text-lg font-semibold tracking-[0.04em] outline-none transition ${theme.border} ${theme.inputBg}`}
                    placeholder="請輸入文件標題"
                  />
                  <button
                    type="button"
                    onClick={() => setExportOpen(true)}
                    className={`shrink-0 rounded-full border border-(--accent) px-3 py-2.5 text-sm sm:hidden ${theme.primaryButton} ${theme.primaryButtonText}`}
                  >
                    匯出圖片
                  </button>
                </div>

                <EditorMainToolbar
                  onUndo={doUndo}
                  onRedo={doRedo}
                  canUndo={richActive ? !!richHistory?.canUndo : history.canUndo}
                  canRedo={richActive ? !!richHistory?.canRedo : history.canRedo}
                  findOpen={findOpen}
                  onToggleFind={() => setFindOpen(!findOpen)}
                  formatBar={richActive && richEditor ? <RichFormatBar editor={richEditor} theme={theme} /> : null}
                  viewToggle={
                    isDoc ? (
                      <DocViewToggle
                        value={preferences.docView}
                        onChange={(docView) => setPreferences((prev) => ({ ...prev, docView }))}
                        theme={theme}
                      />
                    ) : renderable ? (
                      <EditorViewToggle
                        viewMode={viewMode}
                        onChange={(next) => setPreferences((prev) => ({ ...prev, viewMode: next }))}
                        theme={theme}
                      />
                    ) : null
                  }
                  onPaste={() => void pasteFromClipboard(false)}
                  onPasteExport={() => void pasteFromClipboard(true)}
                  googleItems={
                    <EditorGoogleToolbar activeDoc={activeDoc} updateActiveDoc={updateActiveDoc} addDoc={addDoc} theme={theme} />
                  }
                  settings={
                    <EditorSettingsPanel
                      preferences={preferences}
                      currentMode={activeDoc.mode}
                      onChangeMode={(mode) => updateActiveDoc({ mode })}
                      setPreferences={setPreferences}
                      theme={theme}
                      adjustFontSize={adjustFontSize}
                      adjustLineHeight={adjustLineHeight}
                      adjustLetterSpacing={adjustLetterSpacing}
                    />
                  }
                  onExportImage={() => setExportOpen(true)}
                  theme={theme}
                />
              </div>

              <div
                onKeyDown={handleEditorKeyDown}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className={`mx-auto w-full ${areaWidthClass}`}>
                  <EditorFindReplace
                    content={activeDoc.content}
                    textareaRef={textareaRef}
                    onReplaceContent={handleReplaceContent}
                    richEditor={richActive ? richEditor : null}
                    open={findOpen}
                    setOpen={setFindOpen}
                    theme={theme}
                  />
                </div>

                <div
                  className={`mx-auto flex w-full flex-1 flex-col gap-4 md:flex-row ${areaWidthClass}`}
                >
                  {richActive && !legacyStyles && (
                    <RichEditor
                      key={activeDoc.id}
                      content={activeDoc.content}
                      onChange={handleContentChange}
                      onReady={setRichEditor}
                      preferences={preferences}
                      theme={theme}
                      className="flex-1"
                    />
                  )}

                  {showEditor && !richActive && (
                    <EditorTextarea
                      ref={textareaRef}
                      content={activeDoc.content}
                      onChange={handleContentChange}
                      preferences={preferences}
                      theme={theme}
                      className="flex-1"
                    />
                  )}

                  {showPreview && previewMode && (
                    <EditorPreview
                      content={activeDoc.content}
                      mode={previewMode}
                      preferences={preferences}
                      theme={theme}
                      className="flex-1"
                    />
                  )}
                </div>
              </div>

              <div className={`mx-auto mt-2 w-full ${areaWidthClass}`}>
                {pasteHint && <p className={`mb-1 text-xs ${theme.subtleText}`}>{pasteHint}</p>}
                <EditorStatsBar stats={editorStats} theme={theme} savedAt={formatDateTime24h(activeDoc.updatedAt)} linked={!!activeDoc.googleDocId} />
                {showHints && (
                  <div className={`mt-3 rounded-2xl border px-4 py-3 ${theme.border} ${theme.panelBg}`}>
                    <EditorStatusPanel result={validationResult} theme={theme} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={`flex h-full items-center justify-center ${theme.mutedText}`}>
              尚未選擇文件
            </div>
          )}

          {activeDoc && (
            <EditorExportModal
              open={exportOpen}
              onClose={() => setExportOpen(false)}
              title={activeDoc.title}
              content={activeDoc.content}
              mode={activeDoc.mode}
              preferences={preferences}
              setPreferences={setPreferences}
              theme={theme}
            />
          )}

          {pendingPaste && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="貼上格式"
            >
              <div
                className={`w-full max-w-sm rounded-3xl border p-5 shadow-lg ${theme.border} ${theme.panelBg} ${theme.text}`}
              >
                <b className="tracking-[0.06em]">要保留原本的格式嗎？</b>
                <p className={`mt-2 text-sm ${theme.mutedText}`}>
                  剪貼簿裡有帶排版的版本（粗體、清單、標題那些）。保留格式會用 HTML
                  模式貼進來，純文字則只留下文字。
                </p>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingPaste(null)}
                    className={`rounded-2xl border px-4 py-2 text-sm ${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void applyPaste(pendingPaste.payload, false, pendingPaste.thenExport)
                    }
                    className={`rounded-2xl border px-4 py-2 text-sm ${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`}
                  >
                    純文字
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void applyPaste(pendingPaste.payload, true, pendingPaste.thenExport)
                    }
                    className={`rounded-2xl border px-4 py-2 text-sm ${theme.border} ${theme.primaryButton} ${theme.primaryButtonText}`}
                  >
                    保留格式
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
