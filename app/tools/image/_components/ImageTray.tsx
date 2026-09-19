"use client";

import { useRef, useState } from "react";
import { formatBytes } from "@/lib/tools/image/format";
import type { WorkImage } from "@/lib/tools/image/types";
import type { ThemeClasses } from "@/lib/theme";
import { ActionButton } from "./controls";

type Props = {
  images: WorkImage[];
  selectedIds: string[];
  busy: boolean;
  t: ThemeClasses;
  onAddFiles: (files: File[]) => void;
  onReadClipboard: () => void;
  onToggle: (id: string, additive: boolean) => void;
  onRemove: (id: string) => void;
};

/**
 * 圖片清單。
 *
 * 選取是「有順序的」:拼接時就照這個順序接,所以點選的先後有意義,
 * 縮圖上會標出目前是第幾張。
 */
export default function ImageTray({
  images,
  selectedIds,
  busy,
  t,
  onAddFiles,
  onReadClipboard,
  onToggle,
  onRemove,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);

    const files = Array.from(event.dataTransfer.files).filter((file) =>
      file.type.startsWith("image/")
    );
    if (files.length > 0) onAddFiles(files);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`rounded-2xl border-2 border-dashed p-4 transition ${
        dragging ? "border-(--accent)" : "border-(--border-light)"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton t={t} onClick={() => fileInput.current?.click()} disabled={busy}>
          選擇檔案
        </ActionButton>
        <ActionButton tone="secondary" t={t} onClick={onReadClipboard} disabled={busy}>
          讀剪貼簿
        </ActionButton>
        <p className={`text-xs leading-6 ${t.muted}`}>
          也可以直接 Ctrl / ⌘ + V 貼上，或把檔案拖進這一塊。
        </p>
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
        <p className={`mt-4 text-sm leading-7 ${t.muted}`}>
          還沒有圖。全部處理都在你的瀏覽器裡完成，圖片不會上傳到任何地方。
        </p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-3">
          {images.map((image) => {
            const order = selectedIds.indexOf(image.id);
            const selected = order >= 0;

            return (
              <li key={image.id}>
                <div
                  className={`relative w-32 overflow-hidden rounded-xl border transition ${
                    selected ? t.listSelected : t.listUnselected
                  }`}
                >
                  <button
                    type="button"
                    onClick={(event) =>
                      onToggle(image.id, event.metaKey || event.ctrlKey || event.shiftKey)
                    }
                    className="block w-full text-left"
                    title={`${image.name}（${image.width}×${image.height}）`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL,next/image 幫不上忙 */}
                    <img
                      src={image.url}
                      alt={image.name}
                      className="h-24 w-full bg-(--paper-bg-3) object-contain"
                    />
                    <div className="px-2 py-1.5">
                      <p className="truncate text-[11px] tracking-[0.04em]">
                        {image.name}
                      </p>
                      <p className="text-[10px] opacity-70">
                        {image.width}×{image.height}・{formatBytes(image.blob.size)}
                      </p>
                    </div>
                  </button>

                  {selected && (
                    <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-(--accent) text-[11px] text-(--on-accent)">
                      {order + 1}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => onRemove(image.id)}
                    disabled={busy}
                    className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-(--border-dark) bg-(--paper-bg) text-[11px] text-(--ink-primary) disabled:opacity-40"
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
        <p className={`mt-3 text-[11px] leading-5 ${t.muted}`}>
          點縮圖選取；按住 Ctrl / ⌘ 可以多選，數字就是拼接的順序。
        </p>
      )}
    </div>
  );
}
