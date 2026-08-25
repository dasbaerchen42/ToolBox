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
} from "@/lib/preferences";
import { type WritingMode } from "@/lib/storage";
import {
  isRenderableMode,
  renderToSafeHtml,
  splitBlocks,
  toPlainHtml,
} from "@/lib/markdown";
import {
  downloadBlob,
  exportContentToImages,
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
  { value: "none", label: "一律單張" },
];

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
  const [images, setImages] = useState<ExportedImage[] | null>(null);
  const [pickedPages, setPickedPages] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const anchorRef = useRef<number | null>(null);
  const urlsRef = useRef<string[]>([]);

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

  const selectedHtml = useMemo(
    () =>
      blocks
        .map((block, index) => (selected.has(index) ? block : ""))
        .join(""),
    [blocks, selected]
  );

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
  }

  function setAll(on: boolean) {
    dropImages();
    setSelected(on ? new Set(blocks.map((_, i) => i)) : new Set());
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
        error instanceof ExportTooLongError
          ? `內容約 ${error.contentHeight} px，超過單張上限 ${error.maxHeight} px。改用「太長自動分頁」，或少選幾段。`
          : "轉圖失敗，請按 F12 查看 Console 錯誤。"
      );
    } finally {
      setBusy(false);
    }
  }

  async function download() {
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

          <label className={`flex items-center gap-2 ${theme.mutedText}`}>
            <input
              type="checkbox"
              checked={preferences.exportImageTitle}
              onChange={(e) => updatePreference({ exportImageTitle: e.target.checked })}
            />
            含標題
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

        <div className={`min-h-0 flex-1 overflow-auto rounded-2xl border p-3 ${theme.border} ${theme.cardBg}`}>
          {blocks.length === 0 ? (
            <p className={`text-sm ${theme.mutedText}`}>沒有內容可以轉圖。</p>
          ) : (
            <div className="md-preview">
              {blocks.map((block, index) => (
                <div
                  key={index}
                  className={`flex gap-2 rounded-2xl px-2 py-1 transition ${
                    selected.has(index) ? "" : "opacity-35"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-2 shrink-0 self-start"
                    checked={selected.has(index)}
                    onChange={() => undefined}
                    onClick={(e) => toggleBlock(index, e.shiftKey)}
                    aria-label={`第 ${index + 1} 段`}
                  />
                  <div
                    className="min-w-0 flex-1"
                    dangerouslySetInnerHTML={{ __html: block }}
                  />
                </div>
              ))}
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
          {images && (
            <button
              type="button"
              onClick={download}
              disabled={busy}
              className={`rounded-2xl border px-4 py-2 text-sm transition disabled:opacity-50 ${theme.border} ${theme.primaryButton} ${theme.primaryButtonText}`}
            >
              下載選取的（{pickedPages.size}）
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
