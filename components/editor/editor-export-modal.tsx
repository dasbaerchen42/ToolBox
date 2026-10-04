"use client";

// 匯出圖片視窗:挑段落 → 產生 → 挑張數 → 下載。
// 「裁切」刻意做在內容層而不是像素層:選段落的邊界永遠是乾淨的,
// 在圖片上拖框一定會切到半行字。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EditorThemeConfig } from "@/lib/theme";
import {
  type EditorPreferences,
  type ExportImageWidth,
  type ExportPaginate,
  type FontFamilyName,
} from "@/lib/preferences";
import { FONT_OPTIONS, getFontFamily } from "@/lib/editor-font";
import { downloadEach, shareImages } from "@/lib/download";
import { useCanShareImages } from "@/hooks/useCanShareImages";
import { type WritingMode } from "@/lib/storage";
import {
  applyBlockStyle,
  BLOCK_FILLS,
  isPlainBlock,
  isRenderableMode,
  PLAIN_BLOCK,
  renderToSafeHtml,
  splitBlocks,
  toPlainHtml,
  type BlockFill,
  type BlockStyle,
} from "@/lib/markdown";
import {
  autoCuts,
  contentClassFor,
  downloadBlob,
  exportContentToImages,
  measureExport,
  pageSizes,
  ExportPageTooLongError,
  ExportTooLongError,
  zipImages,
  type ExportedImage,
} from "@/lib/export-image";

type EditorExportModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
  mode: WritingMode;
  preferences: EditorPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<EditorPreferences>>;
  theme: EditorThemeConfig;
};

const WIDTH_OPTIONS: { value: ExportImageWidth; label: string }[] = [
  { value: 600, label: "600 窄" },
  { value: 800, label: "800 中" },
  { value: 1080, label: "1080 社群" },
];

const PAGINATE_OPTIONS: { value: ExportPaginate; label: string }[] = [
  { value: "auto", label: "太長自動分頁" },
  { value: "manual", label: "手動分頁" },
  { value: "none", label: "一律單張" },
];

/** 一段的樣式列:對齊、底色、底線 */
function BlockStyleBar({
  style,
  onChange,
  theme,
}: {
  style: BlockStyle;
  onChange: (patch: Partial<BlockStyle>) => void;
  theme: EditorThemeConfig;
}) {
  const chip = (active: boolean) =>
    `rounded-xl border px-2.5 py-1 text-xs ${theme.border} ${
      active ? `${theme.primaryButton} ${theme.primaryButtonText}` : `${theme.secondaryButton} ${theme.secondaryButtonText}`
    }`;
  return (
    <div
      className="mx-2 mb-2 mt-1 flex flex-wrap items-center gap-1.5 rounded-2xl border px-2 py-1.5"
      style={{ borderColor: "var(--border-light)" }}
      onClick={(e) => e.stopPropagation()}
    >
      {(
        [
          ["left", "靠左"],
          ["center", "置中"],
          ["right", "置右"],
        ] as const
      ).map(([value, label]) => (
        <button key={value} type="button" aria-pressed={style.align === value} onClick={() => onChange({ align: value })} className={chip(style.align === value)}>
          {label}
        </button>
      ))}
      <span className="mx-1 h-4 w-px" style={{ background: "var(--border-light)" }} />
      <button type="button" aria-pressed={style.fill === "none"} onClick={() => onChange({ fill: "none" })} className={chip(style.fill === "none")}>
        無底色
      </button>
      {(Object.entries(BLOCK_FILLS) as [Exclude<BlockFill, "none">, { label: string; color: string }][]).map(([value, fill]) => (
        <button
          key={value}
          type="button"
          aria-label={`${fill.label}色底`}
          aria-pressed={style.fill === value}
          onClick={() => onChange({ fill: value })}
          className={`h-7 w-7 rounded-full border-2 ${style.fill === value ? "" : "border-transparent"}`}
          style={{ background: fill.color, borderColor: style.fill === value ? "var(--accent)" : undefined }}
        />
      ))}
      <span className="mx-1 h-4 w-px" style={{ background: "var(--border-light)" }} />
      <button type="button" aria-pressed={style.underline} onClick={() => onChange({ underline: !style.underline })} className={chip(style.underline)}>
        <span className="underline underline-offset-2">底線</span>
      </button>
    </div>
  );
}

export default function EditorExportModal({
  open,
  onClose,
  title,
  content,
  mode,
  preferences,
  setPreferences,
  theme,
}: EditorExportModalProps) {
  const [blocks, setBlocks] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [cuts, setCuts] = useState<Set<number>>(new Set());
  const [images, setImages] = useState<ExportedImage[] | null>(null);
  const [pickedPages, setPickedPages] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  /** 個別段落的樣式(置中、置右、底色、底線),用段落內容當鑰匙:關掉再開、內容沒改就還在 */
  const [blockStyles, setBlockStyles] = useState<Map<string, BlockStyle>>(() => new Map());
  /** 正在調哪一段的樣式(那一段下面展開一條樣式列) */
  const [styling, setStyling] = useState<number | null>(null);
  /** 手動分頁時,照實際轉圖的排版量出來的每個區塊高度(含標題時標題是第 0 個) */
  const [measured, setMeasured] = useState<{ key: string; heights: number[]; padding: number; maxHeight: number } | null>(null);
  const anchorRef = useRef<number | null>(null);
  const urlsRef = useRef<string[]>([]);
  const canShare = useCanShareImages();

  const revokeUrls = useCallback(() => {
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current = [];
  }, []);

  const dropImages = useCallback(() => {
    revokeUrls();
    setImages(null);
    setPickedPages(new Set());
  }, [revokeUrls]);

  // 開啟時渲染一次;內容或模式變了也重新拆段
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const html = isRenderableMode(mode)
        ? await renderToSafeHtml(mode, content)
        : toPlainHtml(content);
      if (cancelled) return;
      const next = splitBlocks(html);
      setBlocks(next);
      setSelected(new Set(next.map((_, i) => i)));
      setCuts(new Set());
      anchorRef.current = null;
    })().catch((error: unknown) => {
      console.error("渲染失敗：", error);
      if (!cancelled) setStatus("渲染失敗，請檢查內容格式。");
    });

    return () => {
      cancelled = true;
    };
  }, [open, content, mode]);

  useEffect(() => () => revokeUrls(), [revokeUrls]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const selectedIndexes = useMemo(
    () => blocks.map((_, index) => index).filter((index) => selected.has(index)),
    [blocks, selected]
  );

  const styledBlocks = useMemo(
    () => blocks.map((block) => applyBlockStyle(block, blockStyles.get(block))),
    [blocks, blockStyles]
  );

  const selectedHtml = useMemo(
    () => selectedIndexes.map((index) => styledBlocks[index]).join(""),
    [styledBlocks, selectedIndexes]
  );

  function updateBlockStyle(index: number, patch: Partial<BlockStyle>) {
    dropImages();
    const key = blocks[index];
    setBlockStyles((prev) => {
      const next = new Map(prev);
      const style = { ...(prev.get(key) ?? PLAIN_BLOCK), ...patch };
      if (isPlainBlock(style)) next.delete(key);
      else next.set(key, style);
      return next;
    });
  }

  // 畫面上的分頁點是「第幾個區塊」,匯出時的內容只有選取的區塊(而且含標題時
  // 標題會排在最前面),所以要換算成匯出內容裡的位置。最後一段之後切沒有意義。
  const exportCuts = useMemo(() => {
    const offset = preferences.exportImageTitle && title ? 1 : 0;
    const mapped = new Set<number>();
    selectedIndexes.forEach((blockIndex, position) => {
      if (cuts.has(blockIndex) && position < selectedIndexes.length - 1) {
        mapped.add(position + offset);
      }
    });
    return mapped;
  }, [cuts, selectedIndexes, preferences.exportImageTitle, title]);

  const pageCount = exportCuts.size + 1;
  const isManual = preferences.exportPaginate === "manual";
  const exportTitle = preferences.exportImageTitle && title ? title : null;
  const titleOffset = exportTitle ? 1 : 0;

  // 手動分頁:在畫面外照轉圖的寬度、字體排一次,量每一段多高(停下來 0.3 秒才量)
  const measureKey = [
    selectedHtml,
    exportTitle,
    preferences.exportImageWidth,
    preferences.fontFamily,
    preferences.fontSize,
    preferences.lineHeight,
    preferences.letterSpacing,
    preferences.softItalic,
  ].join("\u0000");
  useEffect(() => {
    if (!open || !isManual || !selectedHtml) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void measureExport({ html: selectedHtml, title: exportTitle, width: preferences.exportImageWidth, preferences })
        .then((result) => {
          if (!cancelled) setMeasured({ key: measureKey, ...result });
        })
        .catch((error: unknown) => console.warn("量高度失敗：", error));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, isManual, selectedHtml, exportTitle, preferences, measureKey]);

  // 量到的是現在這份內容才用(內容一變,舊的高度就不準了)
  const heights = measured && measured.key === measureKey && measured.heights.length === selectedIndexes.length + titleOffset ? measured : null;
  const sizes = heights ? pageSizes(heights.heights, exportCuts, preferences.exportImageWidth, heights.padding) : null;
  const overLimit = (page: number) => !!(heights && sizes && sizes[page].content > heights.maxHeight);
  /** 選取的第 position 段是第幾張(從 0 數)、是不是那一張的第一段 */
  const pageOf = (position: number) => {
    const unit = position + titleOffset;
    let page = 0;
    for (const cut of exportCuts) if (cut < unit) page += 1;
    return page;
  };

  function seedAutoCuts() {
    if (!heights) return;
    dropImages();
    const next = new Set<number>();
    for (const unit of autoCuts(heights.heights, heights.maxHeight)) {
      if (unit >= titleOffset) next.add(selectedIndexes[unit - titleOffset]);
    }
    setCuts(next);
  }

  function toggleBlock(index: number, shiftKey: boolean) {
    dropImages();
    setSelected((prev) => {
      const next = new Set(prev);
      // Shift 點第二下 = 選一整段範圍,跟檔案總管一樣
      if (shiftKey && anchorRef.current !== null) {
        const [from, to] = [anchorRef.current, index].sort((a, b) => a - b);
        const turnOn = !prev.has(index);
        for (let i = from; i <= to; i++) {
          if (turnOn) next.add(i);
          else next.delete(i);
        }
      } else if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      anchorRef.current = index;
      return next;
    });
    setCuts((prev) => {
      if (!prev.has(index)) return prev;
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }

  // 手動分頁:點區塊本身 = 在它後面切一刀(勾選框仍然是選取/不選取)
  function toggleCut(index: number) {
    if (preferences.exportPaginate !== "manual") return;
    if (!selected.has(index)) return;
    dropImages();
    setCuts((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function setAll(on: boolean) {
    dropImages();
    setSelected(on ? new Set(blocks.map((_, i) => i)) : new Set());
    if (!on) setCuts(new Set());
  }

  function updatePreference(patch: Partial<EditorPreferences>) {
    dropImages();
    setPreferences((prev) => ({ ...prev, ...patch }));
  }

  async function generate() {
    if (selected.size === 0) {
      setStatus("至少要選一段內容。");
      return;
    }

    setBusy(true);
    setStatus("產生中……");
    revokeUrls();

    try {
      const next = await exportContentToImages({
        html: selectedHtml,
        title: preferences.exportImageTitle ? title : null,
        fileTitle: title,
        width: preferences.exportImageWidth,
        paginate: preferences.exportPaginate,
        cuts: exportCuts,
        preferences,
      });

      urlsRef.current = next.map((image) => URL.createObjectURL(image.blob));
      setImages(next);
      setPickedPages(new Set(next.map((_, i) => i)));
      setStatus(next.length > 1 ? `分成 ${next.length} 張，挑要下載的。` : null);
    } catch (error) {
      console.error("轉圖失敗：", error);
      setImages(null);
      setStatus(
        error instanceof ExportPageTooLongError
          ? `第 ${error.pageIndex} 張約 ${error.pageHeight} px，超過單張上限 ${error.maxHeight} px，請在那一張中間再切一刀。`
          : error instanceof ExportTooLongError
            ? `內容約 ${error.contentHeight} px，超過單張上限 ${error.maxHeight} px。改用分頁，或少選幾段。`
            : "轉圖失敗，請按 F12 查看 Console 錯誤。"
      );
    } finally {
      setBusy(false);
    }
  }

  async function download(mode: "zip" | "each" = "zip") {
    if (!images) return;
    const picked = images.filter((_, index) => pickedPages.has(index));
    if (picked.length === 0) {
      setStatus("至少要挑一張。");
      return;
    }

    setBusy(true);
    try {
      if (picked.length === 1) {
        downloadBlob(picked[0]);
        setStatus("已下載 1 張 PNG。");
      } else if (mode === "each") {
        await downloadEach(picked);
        setStatus(`已逐張下載 ${picked.length} 張 PNG。`);
      } else {
        downloadBlob(await zipImages(picked, title));
        setStatus(`已打包 ${picked.length} 張成 zip。`);
      }
    } catch (error) {
      console.error("下載失敗：", error);
      setStatus("下載失敗，請按 F12 查看 Console 錯誤。");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!images) return;
    const picked = images.filter((_, index) => pickedPages.has(index));
    if (picked.length === 0) {
      setStatus("至少要挑一張。");
      return;
    }

    // 圖已經產好了,這裡不能再有任何耗時的 await 擋在 share 前面:
    // 手機瀏覽器只給按鈕一小段時間的授權,過了就會拒絕開分享選單。
    setBusy(true);
    try {
      const result = await shareImages(picked);
      setStatus(
        result === "shared"
          ? `已交給分享選單（${picked.length} 張）。`
          : result === "cancelled"
            ? null
            : "瀏覽器擋下了這次分享，請再按一次。"
      );
    } catch (error) {
      console.error("分享失敗：", error);
      setStatus("這個瀏覽器沒辦法分享圖片，請改用下載。");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="匯出圖片"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl border p-4 shadow-lg md:p-5 ${theme.border} ${theme.panelBg} ${theme.text}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <b className="tracking-[0.06em]">匯出圖片</b>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-2xl border px-3 py-1.5 text-sm ${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`}
          >
            ✕ 關閉
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <select
            value={preferences.exportImageWidth}
            onChange={(e) =>
              updatePreference({
                exportImageWidth: Number(e.target.value) as ExportImageWidth,
              })
            }
            className={`rounded-2xl border px-3 py-1.5 outline-none ${theme.border} ${theme.inputBg}`}
            aria-label="圖片寬度"
          >
            {WIDTH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={preferences.exportPaginate}
            onChange={(e) =>
              updatePreference({ exportPaginate: e.target.value as ExportPaginate })
            }
            className={`rounded-2xl border px-3 py-1.5 outline-none ${theme.border} ${theme.inputBg}`}
            aria-label="分頁方式"
          >
            {PAGINATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={preferences.fontFamily}
            onChange={(e) =>
              updatePreference({ fontFamily: e.target.value as FontFamilyName })
            }
            className={`rounded-2xl border px-3 py-1.5 outline-none ${theme.border} ${theme.inputBg}`}
            aria-label="字體"
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font.key} value={font.key}>
                {font.label}
              </option>
            ))}
          </select>

          <label className={`flex items-center gap-2 ${theme.mutedText}`}>
            <input
              type="checkbox"
              checked={preferences.exportImageTitle}
              onChange={(e) => updatePreference({ exportImageTitle: e.target.checked })}
            />
            含標題
          </label>

          <label className={`flex items-center gap-2 ${theme.mutedText}`}>
            <input
              type="checkbox"
              checked={preferences.softItalic}
              onChange={(e) => updatePreference({ softItalic: e.target.checked })}
            />
            斜體改淡色正體
          </label>

          <span className={`ml-auto text-xs ${theme.subtleText}`}>
            已選 {selected.size} / {blocks.length} 段
          </span>
          <button
            type="button"
            onClick={() => setAll(true)}
            className={`rounded-2xl border px-3 py-1 text-xs ${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`}
          >
            全選
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            className={`rounded-2xl border px-3 py-1 text-xs ${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`}
          >
            全不選
          </button>
        </div>

        {isManual && (
          <div className={`mb-2 flex flex-wrap items-center gap-2 text-xs ${theme.mutedText}`}>
            <span>
              點一下段落 = 在它後面切一刀（再點一次取消）。目前切成{" "}
              <b className={theme.text}>{pageCount}</b> 張。
            </span>
            <button
              type="button"
              onClick={seedAutoCuts}
              disabled={!heights}
              className={`rounded-2xl border px-3 py-1 disabled:opacity-40 ${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`}
            >
              照自動分頁先排一次
            </button>
            {cuts.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  dropImages();
                  setCuts(new Set());
                }}
                className={`rounded-2xl border px-3 py-1 ${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`}
              >
                清除分頁點
              </button>
            )}
            <div className="basis-full">
              {sizes ? (
                <span className="flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className={theme.text}>切出來的尺寸：</span>
                  {sizes.map((size, page) => (
                    <span key={page} style={overLimit(page) ? { color: "var(--danger, #c0392b)" } : undefined}>
                      {page + 1}：{size.width} × {size.height}
                      {overLimit(page) ? "（太長）" : ""}
                    </span>
                  ))}
                </span>
              ) : (
                <span>量每一張的長度中……</span>
              )}
            </div>
          </div>
        )}

        <div className={`min-h-0 flex-1 overflow-auto rounded-2xl border p-3 ${theme.border} ${theme.cardBg}`}>
          {blocks.length === 0 ? (
            <p className={`text-sm ${theme.mutedText}`}>沒有內容可以轉圖。</p>
          ) : (
            <div
              className={contentClassFor(preferences)}
              style={{ fontFamily: getFontFamily(preferences.fontFamily) }}
            >
              {blocks.map((block, index) => {
                const position = selectedIndexes.indexOf(index);
                const page = position >= 0 ? pageOf(position) : -1;
                const startsPage = isManual && position >= 0 && (position === 0 || pageOf(position - 1) !== page);
                return (
                <div key={index}>
                  {startsPage && (
                    <div
                      className="mb-1 flex items-center gap-2 px-2 pt-1 text-[11px] leading-none"
                      style={{ color: overLimit(page) ? "var(--danger, #c0392b)" : "var(--ink-tertiary)" }}
                    >
                      <span className="font-semibold">第 {page + 1} 張</span>
                      {sizes?.[page] && (
                        <span>
                          {sizes[page].width} × {sizes[page].height} px
                          {overLimit(page) ? "・太長，再切一刀" : ""}
                        </span>
                      )}
                      <span className="h-0 flex-1 border-t" style={{ borderColor: "currentColor", opacity: 0.35 }} />
                    </div>
                  )}
                  <div
                    className={`flex gap-2 rounded-2xl px-2 py-1 transition ${
                      selected.has(index) ? "" : "opacity-35"
                    } ${isManual && selected.has(index) ? "cursor-pointer hover:bg-black/10" : ""}`}
                    onClick={() => toggleCut(index)}
                  >
                    <input
                      type="checkbox"
                      className="mt-2 shrink-0 self-start"
                      checked={selected.has(index)}
                      onChange={() => undefined}
                      onClick={(e) => {
                        e.stopPropagation(); // 勾選框只管選不選,不要順便切一刀
                        toggleBlock(index, e.shiftKey);
                      }}
                      aria-label={`第 ${index + 1} 段`}
                    />
                    <div
                      className="min-w-0 flex-1"
                      dangerouslySetInnerHTML={{ __html: styledBlocks[index] }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation(); // 調樣式不要順便切一刀
                        setStyling((current) => (current === index ? null : index));
                      }}
                      aria-label={`第 ${index + 1} 段的樣式`}
                      aria-expanded={styling === index}
                      title="這一段置中、置右、加底色或底線"
                      className={`mt-1 h-7 shrink-0 self-start rounded-xl border px-2 text-[11px] ${theme.border} ${
                        styling === index || !isPlainBlock(blockStyles.get(block))
                          ? `${theme.primaryButton} ${theme.primaryButtonText}`
                          : `${theme.secondaryButton} ${theme.secondaryButtonText}`
                      }`}
                    >
                      Aa
                    </button>
                  </div>

                  {styling === index && (
                    <BlockStyleBar
                      style={blockStyles.get(block) ?? PLAIN_BLOCK}
                      onChange={(patch) => updateBlockStyle(index, patch)}
                      theme={theme}
                    />
                  )}

                  {isManual && cuts.has(index) && selected.has(index) && (
                    <div className="my-1 flex items-center gap-2 px-2">
                      <span
                        className="h-0 flex-1 border-t-2 border-dashed"
                        style={{ borderColor: "var(--accent)" }}
                      />
                      <span
                        className="rounded-xl px-2 py-0.5 text-[10px] leading-none"
                        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                      >
                        ✂ 這裡分頁
                      </span>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>

        {images && (
          <div className="mt-3">
            <div className={`mb-2 text-xs ${theme.subtleText}`}>
              產生了 {images.length} 張，勾選要下載的
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <label
                  key={image.name}
                  className={`shrink-0 cursor-pointer rounded-2xl border p-2 text-center text-xs transition ${
                    pickedPages.has(index) ? theme.activeItem : theme.inactiveItem
                  }`}
                >
                  {/* blob: URL 沒有 next/image 可以最佳化的餘地 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={urlsRef.current[index]}
                    alt={`第 ${index + 1} 張`}
                    className="mb-1 h-32 w-auto rounded-xl object-contain object-top"
                  />
                  <input
                    type="checkbox"
                    className="mr-1"
                    checked={pickedPages.has(index)}
                    onChange={() =>
                      setPickedPages((prev) => {
                        const next = new Set(prev);
                        if (next.has(index)) next.delete(index);
                        else next.add(index);
                        return next;
                      })
                    }
                  />
                  第 {index + 1} 張
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {status && <span className={`text-xs ${theme.subtleText}`}>{status}</span>}
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className={`ml-auto rounded-2xl border px-4 py-2 text-sm transition disabled:opacity-50 ${theme.border} ${
              images ? `${theme.secondaryButton} ${theme.secondaryButtonText}` : `${theme.primaryButton} ${theme.primaryButtonText}`
            }`}
          >
            {busy ? "處理中……" : images ? "重新產生" : "產生圖片"}
          </button>
          {images && pickedPages.size <= 1 && (
            <button
              type="button"
              onClick={() => void download()}
              disabled={busy}
              className={`rounded-2xl border px-4 py-2 text-sm transition disabled:opacity-50 ${theme.border} ${theme.primaryButton} ${theme.primaryButtonText}`}
            >
              下載選取的（{pickedPages.size}）
            </button>
          )}
          {images && pickedPages.size > 1 && (
            <>
              <button
                type="button"
                onClick={() => void download("each")}
                disabled={busy}
                className={`rounded-2xl border px-4 py-2 text-sm transition disabled:opacity-50 ${theme.border} ${theme.primaryButton} ${theme.primaryButtonText}`}
              >
                逐張下載（{pickedPages.size}）
              </button>
              <button
                type="button"
                onClick={() => void download("zip")}
                disabled={busy}
                className={`rounded-2xl border px-4 py-2 text-sm transition disabled:opacity-50 ${theme.border} ${theme.primaryButton} ${theme.primaryButtonText}`}
              >
                打包 ZIP
              </button>
            </>
          )}
          {images && canShare && (
            <button
              type="button"
              onClick={share}
              disabled={busy}
              className={`rounded-2xl border px-4 py-2 text-sm transition disabled:opacity-50 ${theme.border} ${theme.primaryButton} ${theme.primaryButtonText}`}
            >
              存到相簿／分享（{pickedPages.size}）
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
