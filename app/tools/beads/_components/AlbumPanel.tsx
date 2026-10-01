"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fromSavedWork, type AlbumKind, type SavedWork } from "@/lib/tools/beads/album";
import { drawBoard, drawFlat } from "@/lib/tools/beads/draw";
import type { BeadColor } from "@/lib/tools/beads/palette";
import type { ThemeClasses } from "@/lib/theme";

/** 縮圖:直接從格子資料畫,不存圖片,收藏冊才不會吃掉 localStorage */
function Thumbnail({ work, palette }: { work: SavedWork; palette: BeadColor[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pattern = useMemo(() => fromSavedWork(work, palette), [work, palette]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const cell = Math.max(1, Math.floor(96 / Math.max(pattern.cols, pattern.rows)));
    canvas.width = pattern.cols * cell;
    canvas.height = pattern.rows * cell;
    drawBoard(ctx, pattern.cols, pattern.rows, cell);
    drawFlat(ctx, pattern, palette, cell);
  }, [pattern, palette]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="h-12 w-12 shrink-0 rounded-md border border-(--border-light) object-contain [image-rendering:pixelated]"
    />
  );
}

type Props = {
  works: SavedWork[];
  palette: BeadColor[];
  /** 目前開著的是哪一筆(標示用) */
  activeId: string | null;
  busy: boolean;
  t: ThemeClasses;
  onOpen: (work: SavedWork) => void;
  onDelete: (work: SavedWork) => void;
  onExport: () => void;
  onImport: (file: File) => void;
};

export default function AlbumPanel({
  works,
  palette,
  activeId,
  busy,
  t,
  onOpen,
  onDelete,
  onExport,
  onImport,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<AlbumKind>("work");
  const shown = works.filter((work) => work.kind === tab);
  const countOf = (kind: AlbumKind) => works.filter((work) => work.kind === kind).length;

  return (
    <section aria-label="收藏冊" className={`border-t pt-4 ${t.divider}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs tracking-[0.08em]">收藏冊（{works.length}）</p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onExport}
            disabled={works.length === 0 || busy}
            className={`rounded-lg border px-2 py-0.5 text-[11px] transition disabled:opacity-40 ${t.secondary}`}
          >
            匯出備份
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className={`rounded-lg border px-2 py-0.5 text-[11px] transition disabled:opacity-40 ${t.secondary}`}
          >
            匯入
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImport(file);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      <p className={`mb-3 text-[11px] leading-5 ${t.muted}`}>
        只存在這個瀏覽器裡，不會上傳。清除瀏覽器資料就會不見，記得偶爾匯出備份。
      </p>

      <div role="tablist" aria-label="收藏冊分頁" className="mb-3 flex gap-1.5">
        {(
          [
            ["work", "作品"],
            ["material", "素材"],
          ] as const
        ).map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            role="tab"
            aria-selected={tab === kind}
            onClick={() => setTab(kind)}
            className={`rounded-xl border px-3 py-1 text-xs transition ${
              tab === kind ? t.selected : t.unselected
            }`}
          >
            {label}（{countOf(kind)}）
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className={`text-xs ${t.muted}`}>
          {tab === "work"
            ? "還沒有收藏的作品。"
            : "還沒有素材。用迷你板拼星星、愛心這類小零件，收藏時選「素材」就會放在這裡。"}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((work) => (
            <li
              key={work.id}
              className={`flex items-center gap-2 rounded-xl border p-1.5 ${
                work.id === activeId ? "border-(--accent)" : "border-(--border-light)"
              }`}
            >
              <Thumbnail work={work} palette={palette} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs">{work.name}</p>
                <p className={`text-[10px] ${t.muted}`}>
                  {work.cols}×{work.rows}・{new Date(work.updatedAt).toLocaleDateString("zh-TW")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpen(work)}
                disabled={busy}
                className={`shrink-0 rounded-lg border px-2 py-0.5 text-[11px] transition disabled:opacity-40 ${t.secondary}`}
              >
                打開
              </button>
              <button
                type="button"
                onClick={() => onDelete(work)}
                disabled={busy}
                aria-label={`刪除「${work.name}」`}
                className={`shrink-0 rounded-lg border px-2 py-0.5 text-[11px] transition disabled:opacity-40 ${t.secondary}`}
              >
                刪除
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
