"use client";

// 文轉圖:把整篇內容(含渲染結果)畫成 PNG。
// 寬度由使用者決定,跟視窗大小無關;太長會自動分頁,多張時打包成 zip。

import { useState } from "react";
import type { EditorThemeConfig } from "@/lib/theme";
import {
  type EditorPreferences,
  type ExportImageWidth,
} from "@/lib/preferences";
import { type WritingMode } from "@/lib/storage";
import { isRenderableMode, renderToSafeHtml, toPlainHtml } from "@/lib/markdown";
import {
  downloadBlob,
  exportContentToImages,
  zipImages,
} from "@/lib/export-image";

type EditorExportImageProps = {
  title: string;
  content: string;
  mode: WritingMode;
  preferences: EditorPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<EditorPreferences>>;
  theme: EditorThemeConfig;
};

const WIDTH_OPTIONS: { value: ExportImageWidth; label: string }[] = [
  { value: 600, label: "600（窄）" },
  { value: 800, label: "800（中）" },
  { value: 1080, label: "1080（社群）" },
];

export default function EditorExportImage({
  title,
  content,
  mode,
  preferences,
  setPreferences,
  theme,
}: EditorExportImageProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    if (!content.trim()) {
      setStatus("沒有內容可以轉圖。");
      return;
    }

    setBusy(true);
    setStatus("產生中……");

    try {
      const html = isRenderableMode(mode)
        ? await renderToSafeHtml(mode, content)
        : toPlainHtml(content);

      const images = await exportContentToImages({
        html,
        title: preferences.exportImageTitle ? title : null,
        fileTitle: title,
        width: preferences.exportImageWidth,
        preferences,
      });

      if (images.length === 1) {
        downloadBlob(images[0]);
        setStatus("已下載 1 張 PNG。");
      } else {
        downloadBlob(await zipImages(images, title));
        setStatus(`內容較長，已分成 ${images.length} 張並打包成 zip。`);
      }
    } catch (error) {
      console.error("轉圖失敗：", error);
      setStatus("轉圖失敗，請按 F12 查看 Console 錯誤。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={preferences.exportImageWidth}
        onChange={(e) =>
          setPreferences((prev) => ({
            ...prev,
            exportImageWidth: Number(e.target.value) as ExportImageWidth,
          }))
        }
        className={`rounded-2xl border px-3 py-1.5 text-sm outline-none ${theme.border} ${theme.inputBg}`}
        aria-label="圖片寬度"
      >
        {WIDTH_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <label className={`flex items-center gap-2 text-sm ${theme.mutedText}`}>
        <input
          type="checkbox"
          checked={preferences.exportImageTitle}
          onChange={(e) =>
            setPreferences((prev) => ({
              ...prev,
              exportImageTitle: e.target.checked,
            }))
          }
        />
        含標題
      </label>

      <button
        type="button"
        onClick={handleExport}
        disabled={busy}
        className={`rounded-2xl border px-4 py-1.5 text-sm tracking-[0.04em] transition disabled:opacity-50 ${theme.border} ${theme.primaryButton} ${theme.primaryButtonText}`}
      >
        {busy ? "產生中……" : "下載 PNG"}
      </button>

      {status && <span className={`text-xs ${theme.subtleText}`}>{status}</span>}
    </div>
  );
}
