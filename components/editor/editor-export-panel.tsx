"use client";

// 出圖畫面(編輯器的「出圖」分頁):挑段落 → 產生 → 挑張數 → 下載。
// 「裁切」刻意做在內容層而不是像素層:選段落的邊界永遠是乾淨的,
// 在圖片上拖框一定會切到半行字。
// 預覽照真正轉圖的排版縮小顯示(export-preview),看到的就是下載到的。
// 設定盡量少:寬度固定、字級一條滑桿、切頁一個選單、配色只有預設(跟著網站)與自選。

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { EditorThemeConfig } from "@/lib/theme";
import { type EditorPreferences, type FontFamilyName } from "@/lib/preferences";
import { PER_LINE_MAX, PER_LINE_MIN } from "@/lib/preferences-migrate";
import { maskHtml, parseMaskTerms } from "@/lib/export-mask";
import { FONT_OPTIONS } from "@/lib/editor-font";
import { downloadEach, shareImages } from "@/lib/download";
import { useCanShareImages } from "@/hooks/useCanShareImages";
import { type WritingMode } from "@/lib/storage";
import {
  isRenderableMode,
  renderToSafeHtml,
  splitBlocks,
  toPlainHtml,
} from "@/lib/markdown";
import { contrastRatio } from "@/lib/theme-core";
import {
  contentClassFor,
  downloadBlob,
  exportContentToImages,
  measureExport,
  ExportPageTooLongError,
  zipImages,
  type ExportedImage,
  type ExportMeasure,
} from "@/lib/export-image";
import {
  autoCuts,
  EXPORT_IMAGE_WIDTH,
  EXPORT_MARGINS,
  EXPORT_PAGES,
  exportLayout,
  exportPalette,
  pageSizes,
  paginateOf,
  type ExportMargin,
} from "@/lib/export-layout";
import ExportPreview, { type PreviewPage, type SheetItem } from "./export-preview";

type EditorExportPanelProps = {
  title: string;
  content: string;
  mode: WritingMode;
  preferences: EditorPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<EditorPreferences>>;
  theme: EditorThemeConfig;
};

const WIDTH = EXPORT_IMAGE_WIDTH;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 一排互斥的小按鈕(切頁、留白、配色) */
function Choices<T extends string>({
  label,
  value,
  options,
  onChange,
  theme,
  fill = false,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  theme: EditorThemeConfig;
  /** 平均分成一格一格、排滿一行(切頁六個選項在手機上才不會斷成兩行) */
  fill?: boolean;
}) {
  return (
    <div
      className={fill ? "grid w-full max-w-md gap-1" : "flex flex-wrap gap-1.5"}
      style={fill ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-full border text-sm whitespace-nowrap transition ${fill ? "px-0" : "min-w-10 px-3"} ${
              active ? "border-(--accent-fill) bg-(--accent-fill) text-(--on-accent)" : `${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** 設定的一列:左邊小標、右邊控制項 */
function Row({ label, children, theme }: { label: string; children: ReactNode; theme: EditorThemeConfig }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-3">
      <span className={`shrink-0 whitespace-nowrap text-xs tracking-normal ${theme.mutedText}`}>{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** 配色圈圈:大的是底色、小的是字色 */
function Swatch({ bg, ink }: { bg: string; ink: string }) {
  return (
    <span className="relative inline-block h-5 w-7 shrink-0" aria-hidden>
      <span className="absolute left-0 top-0 h-5 w-5 rounded-full" style={{ background: bg, boxShadow: "0 0 0 1px rgba(128, 128, 128, 0.6)" }} />
      <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full" style={{ background: ink, boxShadow: "0 0 0 1.5px rgba(128, 128, 128, 0.6)" }} />
    </span>
  );
}

export default function EditorExportPanel({
  title,
  content,
  mode,
  preferences,
  setPreferences,
  theme,
}: EditorExportPanelProps) {
  const [blocks, setBlocks] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [cuts, setCuts] = useState<Set<number>>(new Set());
  const [images, setImages] = useState<ExportedImage[] | null>(null);
  const [pickedPages, setPickedPages] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  /** 設定列展開了沒:手機上預設收起來,把高度留給預覽 */
  const [settingsOpen, setSettingsOpen] = useState(() => typeof window === "undefined" || window.matchMedia("(min-width: 768px)").matches);
  /** 照實際轉圖的排版量出來的每個區塊位置(含標題時標題是第 0 個) */
  const [measured, setMeasured] = useState<(ExportMeasure & { key: string }) | null>(null);
  const anchorRef = useRef<number | null>(null);
  /** 連選:手機沒有 Shift,開了以後點起點、再點終點,中間全部一起選或一起取消 */
  const [rangeMode, setRangeMode] = useState(false);
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

  // 切到出圖時渲染一次;內容或模式變了也重新拆段
  useEffect(() => {
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
  }, [content, mode]);

  useEffect(() => () => revokeUrls(), [revokeUrls]);

  const selectedIndexes = useMemo(
    () => blocks.map((_, index) => index).filter((index) => selected.has(index)),
    [blocks, selected]
  );

  const selectedHtml = useMemo(
    () => selectedIndexes.map((index) => blocks[index]).join(""),
    [blocks, selectedIndexes]
  );

  const paginate = paginateOf(preferences.exportPages);
  const isManual = paginate === "manual";
  const exportTitle = preferences.exportImageTitle && title ? title : null;
  const titleOffset = exportTitle ? 1 : 0;
  const unitCount = selectedIndexes.length + titleOffset;

  // 畫面上的分頁點是「第幾個區塊」,匯出時的內容只有選取的區塊(而且含標題時
  // 標題會排在最前面),所以要換算成匯出內容裡的位置。最後一段之後切沒有意義。
  const exportCuts = useMemo(() => {
    const mapped = new Set<number>();
    selectedIndexes.forEach((blockIndex, position) => {
      if (cuts.has(blockIndex) && position < selectedIndexes.length - 1) {
        mapped.add(position + titleOffset);
      }
    });
    return mapped;
  }, [cuts, selectedIndexes, titleOffset]);

  // 在畫面外照轉圖的寬度、字體排一次,量每一段的位置(停下來 0.3 秒才量)
  const measureKey = [
    selectedHtml,
    exportTitle,
    preferences.exportPerLine,
    preferences.exportPages,
    preferences.exportSignature.trim() !== "",
    preferences.exportPageNumbers,
    preferences.exportMasks,
    preferences.exportMargin,
    preferences.fontFamily,
    preferences.fontSize,
    preferences.lineHeight,
    preferences.letterSpacing,
    preferences.softItalic,
    preferences.softItalicBold,
  ].join("\u0000");
  useEffect(() => {
    if (!selectedHtml) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void measureExport({ html: selectedHtml, title: exportTitle, width: WIDTH, preferences })
        .then((result) => {
          if (!cancelled) setMeasured({ key: measureKey, ...result });
        })
        .catch((error: unknown) => console.warn("量高度失敗：", error));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedHtml, exportTitle, preferences, measureKey]);

  // 量到的是現在這份內容才用(內容一變,舊的位置就不準了)
  const fresh = measured && measured.key === measureKey && measured.units.length === unitCount ? measured : null;
  const layout = useMemo(() => exportLayout(WIDTH, preferences), [preferences]);

  /** 實際會在哪幾個匯出區塊之後切 */
  const effectiveCuts = useMemo(() => {
    if (isManual) return exportCuts;
    if (fresh) return autoCuts(fresh.units, fresh.maxHeight);
    return new Set<number>();
  }, [isManual, exportCuts, fresh]);

  const sizes = useMemo(
    () => (fresh && unitCount > 0 ? pageSizes(fresh.units, effectiveCuts, WIDTH, fresh.padding, fresh.layout.pageHeight, fresh.layout.paddingBottom) : null),
    [fresh, unitCount, effectiveCuts]
  );

  /** 要遮起來的字:預覽在這裡遮,轉圖在 export-image 裡遮(同一個函式) */
  const masks = useMemo(() => parseMaskTerms(preferences.exportMasks), [preferences.exportMasks]);

  /** 預覽的每一張:沒勾的段落跟著前一段,放在同一張裡(縮成一行) */
  const previewPages = useMemo<PreviewPage[]>(() => {
    const pageOfUnit = (unit: number) => {
      let page = 0;
      for (const cut of effectiveCuts) if (cut < unit) page += 1;
      return page;
    };
    const pageCount = unitCount > 0 ? pageOfUnit(unitCount - 1) + 1 : 1;
    const pages: PreviewPage[] = Array.from({ length: pageCount }, (_, page) => {
      const size = sizes?.[page];
      const slices = size && fresh ? Math.ceil(size.content / fresh.maxHeight) : 1;
      return { items: [], size: size ? { ...size, over: slices > 1, slices } : null, cutBefore: null };
    });
    // 手動分頁:每張前面那一刀是使用者切的,可以按掉;換回畫面上的段落編號
    if (isManual) {
      selectedIndexes.forEach((blockIndex, position) => {
        const unit = position + titleOffset;
        if (effectiveCuts.has(unit)) pages[pageOfUnit(unit) + 1].cutBefore = blockIndex;
      });
    }
    if (exportTitle) pages[0].items.push({ kind: "title", html: `<div class="md-preview-title">${maskHtml(escapeHtml(exportTitle), masks)}</div>` });
    let current = 0;
    let position = 0;
    blocks.forEach((_, index) => {
      const isSelected = selected.has(index);
      if (isSelected) {
        current = pageOfUnit(position + titleOffset);
        position += 1;
      }
      const item: SheetItem = { kind: "block", index, html: maskHtml(blocks[index], masks), selected: isSelected };
      pages[Math.min(current, pages.length - 1)].items.push(item);
    });
    return pages;
  }, [effectiveCuts, unitCount, sizes, fresh, isManual, titleOffset, selectedIndexes, exportTitle, blocks, selected, masks]);

  function seedAutoCuts() {
    if (!fresh) return;
    dropImages();
    const next = new Set<number>();
    for (const unit of autoCuts(fresh.units, fresh.maxHeight)) {
      if (unit >= titleOffset) next.add(selectedIndexes[unit - titleOffset]);
    }
    setCuts(next);
  }

  function toggleBlock(index: number, shiftKey: boolean) {
    dropImages();
    // 連選模式:第一下是起點(照常切換),第二下把起點到這裡全部設成一樣,然後結束連選
    const ranged = rangeMode && anchorRef.current !== null;
    if (ranged) setRangeMode(false);
    shiftKey = shiftKey || ranged;
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
    if (!isManual) return;
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
    setStatus("準備中……");
    revokeUrls();

    try {
      const next = await exportContentToImages({
        html: selectedHtml,
        title: exportTitle,
        fileTitle: title,
        width: WIDTH,
        paginate,
        cuts: exportCuts,
        preferences,
        onProgress: (done, total) => setStatus(total > 1 ? `產生中…… 第 ${done} / ${total} 張` : "產生中……"),
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
          ? `第 ${error.pageIndex} 張太長了，請在那一張中間再切一刀。`
          : "轉圖失敗了。可能是內容太長或手機記憶體不夠：試試少選幾段，或改用固定比例分成好幾張再按一次。"
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
        setStatus(`已下載 1 張 PNG。`);
      } else if (mode === "each") {
        await downloadEach(picked);
        setStatus(`已逐張下載 ${picked.length} 張 PNG。`);
      } else {
        downloadBlob(await zipImages(picked, title));
        setStatus(`已打包 ${picked.length} 張成 zip。`);
      }
    } catch (error) {
      console.error("下載失敗：", error);
      setStatus(canShare ? "下載失敗，請再按一次，或改用「存到相簿／分享」。" : "下載失敗，請再按一次；一次下載很多張時可以改用打包 ZIP。");
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

  const smallButton = `rounded-2xl border px-3 py-1 text-xs disabled:opacity-40 ${theme.border} ${theme.secondaryButton} ${theme.secondaryButtonText}`;
  const bigButton = (primary: boolean) =>
    `rounded-2xl border px-4 py-2 text-sm transition disabled:opacity-50 ${theme.border} ${
      primary ? `${theme.primaryButton} ${theme.primaryButtonText}` : `${theme.secondaryButton} ${theme.secondaryButtonText}`
    }`;
  const fontLabel = FONT_OPTIONS.find((font) => font.key === preferences.fontFamily)?.label ?? "";
  // 「預設」(跟著網站主題)那顆圈圈要畫網站現在的顏色
  const rootStyle = getComputedStyle(document.documentElement);
  const siteColors = {
    bg: rootStyle.getPropertyValue("--paper-bg").trim() || "#ffffff",
    ink: rootStyle.getPropertyValue("--ink-primary").trim() || "#000000",
  };
  const customContrast = contrastRatio(preferences.exportCustomBg, preferences.exportCustomInk);
  const pagesLabel = EXPORT_PAGES.find((option) => option.value === preferences.exportPages)?.label ?? "自動";
  const summary = [
    `切頁 ${pagesLabel}`,
    `一行 ${preferences.exportPerLine} 字`,
    `留白${EXPORT_MARGINS[preferences.exportMargin]?.label ?? "一般"}`,
    fontLabel,
    preferences.exportPalette === "custom" ? "自選配色" : null,
    masks.length > 0 ? `遮罩 ${masks.length} 個詞` : null,
  ]
    .filter(Boolean)
    .join("・");
  // 自動分頁時,太長的那張會在段落中間再切開,算張數時要一起算;手動分頁則要使用者自己再切
  const pageCount = isManual ? previewPages.length : previewPages.reduce((sum, page) => sum + (page.size?.slices ?? 1), 0);
  const tooLong = isManual ? previewPages.findIndex((page) => page.size?.over) : -1;

  /** 自選配色:第一次點的時候先帶入網站現在的兩個顏色,再讓人改 */
  function choosePalette(next: "site" | "custom") {
    if (next === "custom" && preferences.exportPalette !== "custom") {
      updatePreference({ exportPalette: "custom", exportCustomBg: toHex(siteColors.bg, preferences.exportCustomBg), exportCustomInk: toHex(siteColors.ink, preferences.exportCustomInk) });
    } else {
      updatePreference({ exportPalette: next });
    }
  }

  const check = (label: string, checked: boolean, onChange: (checked: boolean) => void) => (
    <label className={`flex items-center gap-1.5 text-sm ${theme.mutedText}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );

  return (
    <div className={theme.text}>
      {/* 設定:手機上收成一行摘要,點開才展開 */}
      <div className={`mb-3 rounded-2xl border ${theme.border} ${theme.cardBg}`}>
        <button
          type="button"
          onClick={() => setSettingsOpen((value) => !value)}
          aria-expanded={settingsOpen}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
        >
          <span className="font-semibold tracking-[0.06em]">設定</span>
          <span className={`min-w-0 flex-1 truncate text-xs ${theme.mutedText}`}>{settingsOpen ? "" : summary}</span>
          <span aria-hidden className={theme.subtleText}>
            {settingsOpen ? "▴" : "▾"}
          </span>
        </button>

        {settingsOpen && (
          <div className="flex flex-col gap-3 px-3 pb-3">
            <Row label="切頁" theme={theme}>
              <Choices
                label="切頁"
                value={preferences.exportPages}
                options={EXPORT_PAGES.map((option) => ({ value: option.value, label: option.label }))}
                onChange={(exportPages) => updatePreference({ exportPages })}
                theme={theme}
                fill
              />
            </Row>

            <Row label="字級" theme={theme}>
              <span className="text-xs" aria-hidden>
                A
              </span>
              {/* 往右字越大:滑桿的值反過來就是一行幾個字 */}
              <input
                type="range"
                min={PER_LINE_MIN}
                max={PER_LINE_MAX}
                step={1}
                value={PER_LINE_MIN + PER_LINE_MAX - preferences.exportPerLine}
                onChange={(e) => updatePreference({ exportPerLine: PER_LINE_MIN + PER_LINE_MAX - Number(e.target.value) })}
                aria-label="字級"
                aria-valuetext={`一行約 ${preferences.exportPerLine} 字`}
                className="min-w-0 max-w-64 flex-1 accent-(--accent)"
              />
              <span className="text-lg leading-none" aria-hidden>
                A
              </span>
            </Row>

            <Row label="留白" theme={theme}>
              <Choices
                label="留白"
                value={preferences.exportMargin}
                options={(Object.entries(EXPORT_MARGINS) as [ExportMargin, { label: string }][]).map(([value, margin]) => ({ value, label: margin.label }))}
                onChange={(exportMargin) => updatePreference({ exportMargin })}
                theme={theme}
              />
            </Row>

            <Row label="字體" theme={theme}>
              <select
                value={preferences.fontFamily}
                onChange={(e) => updatePreference({ fontFamily: e.target.value as FontFamilyName })}
                className={`rounded-full border px-3 py-1 text-sm outline-none ${theme.border} ${theme.inputBg}`}
                aria-label="字體"
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font.key} value={font.key}>
                    {font.label}
                  </option>
                ))}
              </select>
            </Row>

            <Row label="配色" theme={theme}>
              <Choices
                label="配色"
                value={preferences.exportPalette}
                options={[
                  { value: "site", label: <><Swatch {...siteColors} />預設</> },
                  { value: "custom", label: <><Swatch bg={preferences.exportCustomBg} ink={preferences.exportCustomInk} />自選</> },
                ]}
                onChange={choosePalette}
                theme={theme}
              />
              {preferences.exportPalette === "custom" && (
                <div className={`flex flex-wrap items-center gap-3 text-xs ${theme.mutedText}`}>
                  <label className="flex items-center gap-1.5">
                    底色
                    <input
                      type="color"
                      value={preferences.exportCustomBg}
                      onChange={(e) => updatePreference({ exportCustomBg: e.target.value })}
                      className="h-8 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                    />
                  </label>
                  <label className="flex items-center gap-1.5">
                    文字
                    <input
                      type="color"
                      value={preferences.exportCustomInk}
                      onChange={(e) => updatePreference({ exportCustomInk: e.target.value })}
                      className="h-8 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                    />
                  </label>
                  {customContrast < 3 && <span style={{ color: "var(--danger, #c0392b)" }}>兩個顏色太接近，字會看不清楚</span>}
                </div>
              )}
            </Row>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {check("含標題", preferences.exportImageTitle, (exportImageTitle) => updatePreference({ exportImageTitle }))}
              {check("頁碼", preferences.exportPageNumbers, (exportPageNumbers) => updatePreference({ exportPageNumbers }))}
              {check("斜體改淡色正體", preferences.softItalic, (softItalic) => updatePreference({ softItalic }))}
              {preferences.softItalic && check("對白加粗", preferences.softItalicBold, (softItalicBold) => updatePreference({ softItalicBold }))}
            </div>

            <Row label="遮罩" theme={theme}>
              <input
                type="text"
                value={preferences.exportMasks}
                onChange={(e) => updatePreference({ exportMasks: e.target.value.slice(0, 300) })}
                placeholder="要遮起來的字，用逗號隔開（例如人名）"
                aria-label="遮罩文字"
                className={`min-w-0 flex-1 rounded-2xl border px-3 py-1.5 text-base outline-none sm:text-sm ${theme.border} ${theme.inputBg}`}
              />
            </Row>

            <input
              type="text"
              value={preferences.exportSignature}
              onChange={(e) => updatePreference({ exportSignature: e.target.value.slice(0, 40) })}
              placeholder="署名（例如 @你的帳號）"
              aria-label="署名"
              className={`w-full rounded-2xl border px-3 py-1.5 text-base outline-none sm:text-sm ${theme.border} ${theme.inputBg}`}
            />
          </div>
        )}
      </div>

        {!images && (
          <div className={`mb-2 flex flex-wrap items-center gap-2 text-xs ${theme.mutedText}`}>
            <span>
              已選 {selected.size} / {blocks.length} 段・共 <b className={theme.text}>{pageCount}</b> 張
            </span>
            <button type="button" onClick={() => setAll(true)} className={smallButton}>
              全選
            </button>
            <button type="button" onClick={() => setAll(false)} className={smallButton}>
              全不選
            </button>
            <button
              type="button"
              aria-pressed={rangeMode}
              onClick={() => {
                anchorRef.current = null;
                setRangeMode((value) => !value);
              }}
              className={
                rangeMode
                  ? `rounded-2xl border px-3 py-1 text-xs ${theme.border} ${theme.primaryButton} ${theme.primaryButtonText}`
                  : smallButton
              }
            >
              連選
            </button>
            {rangeMode && <span>{anchorRef.current === null ? "點起點那一段的勾選框" : "再點終點那一段"}</span>}
            {isManual && (
              <>
                <button type="button" onClick={seedAutoCuts} disabled={!fresh} className={smallButton}>
                  照自動分頁先排一次
                </button>
                {cuts.size > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      dropImages();
                      setCuts(new Set());
                    }}
                    className={smallButton}
                  >
                    清除分頁點
                  </button>
                )}
                <span className="basis-full">點一下段落 = 在它後面切一刀，再點一次取消。</span>
              </>
            )}
          </div>
        )}

      <div className={`rounded-2xl border p-2 md:p-3 ${theme.border} ${theme.cardBg}`}>
          {images ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((image, index) => (
                <label
                  key={image.name}
                  className={`cursor-pointer rounded-2xl border p-2 text-center text-xs transition ${pickedPages.has(index) ? theme.activeItem : theme.inactiveItem}`}
                >
                  {/* blob: URL 沒有 next/image 可以最佳化的餘地 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlsRef.current[index]} alt={`第 ${index + 1} 張`} className="mb-1 max-h-[60vh] w-full rounded-xl object-contain object-top" />
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
          ) : blocks.length === 0 ? (
            <p className={`text-sm ${theme.mutedText}`}>沒有內容可以轉圖。</p>
          ) : (
            <ExportPreview
              pages={previewPages}
              layout={fresh?.layout ?? layout}
              contentClass={contentClassFor(preferences)}
              fontFamily={preferences.fontFamily}
              cutting={isManual}
              palette={exportPalette(preferences)}
              signature={preferences.exportSignature.trim()}
              pageNumbers={preferences.exportPageNumbers}
              theme={theme}
              onToggleSelect={toggleBlock}
              onToggleCut={toggleCut}
              onRemoveCut={toggleCut}
              overLabel={(slices) => (isManual ? "太長，在中間再切一刀" : `太長，會在段落中間切成 ${slices} 張`)}
            />
          )}
        </div>

      {/* 動作列:捲到哪裡都在畫面底部 */}
      <div className={`sticky bottom-0 z-20 -mx-1 mt-2 flex flex-wrap items-center gap-2 px-1 py-2 ${theme.pageBg}`}>
          {status && <span className={`basis-full text-xs sm:basis-auto ${theme.subtleText}`}>{status}</span>}
          {images ? (
            <>
              <button type="button" onClick={dropImages} disabled={busy} className={`sm:ml-auto ${bigButton(false)}`}>
                ← 回去調整
              </button>
              {pickedPages.size <= 1 ? (
                <button type="button" onClick={() => void download()} disabled={busy} className={bigButton(true)}>
                  下載選取的（{pickedPages.size}）
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => void download("each")} disabled={busy} className={bigButton(true)}>
                    逐張下載（{pickedPages.size}）
                  </button>
                  <button type="button" onClick={() => void download("zip")} disabled={busy} className={bigButton(true)}>
                    打包 ZIP
                  </button>
                </>
              )}
              {canShare && (
                <button type="button" onClick={share} disabled={busy} className={bigButton(true)}>
                  存到相簿／分享（{pickedPages.size}）
                </button>
              )}
            </>
          ) : (
            <button type="button" onClick={generate} disabled={busy || tooLong >= 0} className={`ml-auto ${bigButton(true)}`}>
              {busy
                ? "處理中……"
                : tooLong >= 0
                  ? `第 ${tooLong + 1} 張太長，先在中間再切一刀`
                  : `產生圖片（${pageCount} 張）`}
            </button>
          )}
      </div>
    </div>
  );
}

/** getComputedStyle 讀到的顏色可能是 rgb(),顏色選擇器只吃 #rrggbb */
function toHex(color: string, fallback: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  const match = color.match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/);
  if (!match) return fallback;
  return `#${match.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
}
