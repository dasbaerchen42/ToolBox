"use client";

import { useRef } from "react";
import { formatBytes } from "@/lib/tools/image/format";
import type { WorkImage } from "@/lib/tools/image/types";
import type { ThemeClasses } from "@/lib/theme";

export type ToolKey = "mask" | "slice" | "merge" | "frame" | "output";

export const TOOLS: { key: ToolKey; label: string; hint: string }[] = [
  { key: "mask", label: "遮罩塗佈區", hint: "蓋掉不想露出來的東西" },
  { key: "slice", label: "影像切割刀", hint: "等分切、自由下刀、框選裁切" },
  { key: "merge", label: "圖片拼接台", hint: "照順序接成一張" },
  { key: "frame", label: "邊框比例區", hint: "描邊、補成指定長寬比" },
  { key: "output", label: "輸出下載區", hint: "格式、品質，然後帶走" },
];

type Props = {
  tool: ToolKey;
  onSelectTool: (tool: ToolKey) => void;
  images: WorkImage[];
  selectedIds: string[];
  busy: boolean;
  canUndo: boolean;
  t: ThemeClasses;
  onAddFiles: (files: File[]) => void;
  onReadClipboard: () => void;
  onToggle: (id: string, additive: boolean) => void;
  onRemove: (id: string) => void;
  onUndo: () => void;
  onClearAll: () => void;
};

/**
 * 側欄:工具切換 + 圖片清單 + 全域動作。
 *
 * 桌面版靠左直向,手機版收成上方橫條(工具與縮圖都改成橫向捲動)——
 * 跟 app/editor 的側欄同一套做法。
 */
export default function Sidebar({
  tool,
  onSelectTool,
  images,
  selectedIds,
  busy,
  canUndo,
  t,
  onAddFiles,
  onReadClipboard,
  onToggle,
  onRemove,
  onUndo,
  onClearAll,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <aside
      className={`border-b p-4 md:border-b-0 md:border-r ${t.divider} bg-(--paper-bg-2) md:h-screen md:sticky md:top-0 md:overflow-y-auto`}
    >
      <p className="mb-4 hidden text-sm font-semibold tracking-[0.12em] md:block">
        影像工作檯
      </p>

      <nav aria-label="工具" className="mb-5">
        <p className={`mb-2 text-[11px] tracking-[0.18em] ${t.muted}`}>工具</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 md:flex-col md:overflow-x-visible md:pb-0">
          {TOOLS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectTool(item.key)}
              aria-current={tool === item.key ? "page" : undefined}
              className={`shrink-0 rounded-xl border px-3 py-2 text-left text-sm tracking-[0.04em] transition md:shrink ${
                tool === item.key ? t.listSelected : t.listUnselected
              }`}
            >
              <span className="block">{item.label}</span>
              <span
                className={`hidden text-[11px] md:block ${
                  tool === item.key ? "opacity-80" : t.muted
                }`}
              >
                {item.hint}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <div className={`mb-4 border-t pt-4 ${t.divider}`}>
        <div className="mb-2 flex items-center justify-between">
          <p className={`text-[11px] tracking-[0.18em] ${t.muted}`}>
            圖片 {images.length > 0 ? `(${images.length})` : ""}
          </p>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className={`rounded-xl border px-3 py-1.5 text-xs transition disabled:opacity-40 ${t.primary}`}
          >
            選擇檔案
          </button>
          <button
            type="button"
            onClick={onReadClipboard}
            disabled={busy}
            className={`rounded-xl border px-3 py-1.5 text-xs transition disabled:opacity-40 ${t.secondary}`}
          >
            讀剪貼簿
          </button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length > 0) onAddFiles(files);
            // 清掉才能連續選同一個檔案
            event.target.value = "";
          }}
        />

        {images.length === 0 ? (
          <p className={`text-xs leading-6 ${t.muted}`}>
            還沒有圖。Ctrl / ⌘ + V 貼上，或把檔案拖進來都行。
            全部處理都在你的瀏覽器裡完成。
          </p>
        ) : (
          <ul className="flex gap-2 overflow-x-auto pb-1 md:max-h-[42vh] md:flex-col md:overflow-x-visible md:overflow-y-auto md:pb-0">
            {images.map((image) => {
              const order = selectedIds.indexOf(image.id);
              const selected = order >= 0;

              return (
                <li key={image.id} className="shrink-0 md:shrink">
                  <div
                    className={`relative flex w-40 items-center gap-2 rounded-xl border p-1.5 transition md:w-full ${
                      selected ? t.listSelected : t.listUnselected
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(event) =>
                        onToggle(
                          image.id,
                          event.metaKey || event.ctrlKey || event.shiftKey
                        )
                      }
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      title={`${image.name}（${image.width}×${image.height}）`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL,next/image 幫不上忙 */}
                      <img
                        src={image.url}
                        alt={image.name}
                        className="h-11 w-11 shrink-0 rounded-lg bg-(--paper-bg-3) object-contain"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] tracking-[0.04em]">
                          {image.name}
                        </span>
                        <span className="block text-[10px] opacity-70">
                          {image.width}×{image.height}・
                          {formatBytes(image.blob.size)}
                        </span>
                      </span>
                    </button>

                    {selected && (
                      <span className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-(--accent) text-[10px] text-(--on-accent)">
                        {order + 1}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => onRemove(image.id)}
                      disabled={busy}
                      className="shrink-0 rounded-lg px-1.5 py-0.5 text-xs opacity-60 transition hover:opacity-100 disabled:opacity-30"
                      aria-label={`移除 ${image.name}`}
                      title="移除這張"
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {images.length > 0 && (
          <p className={`mt-2 text-[10px] leading-4 ${t.muted}`}>
            點一下選取，按住 Ctrl / ⌘ 多選；數字是拼接順序。
          </p>
        )}
      </div>

      <div className={`flex flex-wrap gap-1.5 border-t pt-4 ${t.divider}`}>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo || busy}
          className={`rounded-xl border px-3 py-1.5 text-xs transition disabled:opacity-40 ${t.secondary}`}
        >
          復原一步
        </button>
        <button
          type="button"
          onClick={onClearAll}
          disabled={images.length === 0 || busy}
          className={`rounded-xl border px-3 py-1.5 text-xs transition disabled:opacity-40 ${t.secondary}`}
        >
          清空工作檯
        </button>
      </div>
    </aside>
  );
}
