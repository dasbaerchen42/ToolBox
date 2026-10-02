"use client";

import { useEffect, useRef } from "react";
import type { ThemeClasses } from "@/lib/theme";
import type { Art } from "@/lib/tools/merch/render";
import { CHECKERBOARD } from "../../image/_components/checkerboard";
import { GROUP_LABELS, type ArtEntry } from "./arts";

const THUMB = 56;

function Thumb({ art }: { art: Art | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = THUMB * ratio;
    canvas.height = THUMB * ratio;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!art) return;
    const scale = Math.min((canvas.width * 0.86) / art.width, (canvas.height * 0.86) / art.height);
    const w = art.width * scale;
    const h = art.height * scale;
    ctx.drawImage(art.source, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }, [art]);
  return <canvas ref={ref} style={{ width: THUMB, height: THUMB }} className="rounded-lg" aria-hidden />;
}

/**
 * 素材庫:點一下就加到目前的周邊上。
 * filter 讓搖搖吊飾只列得出能算碰撞的小拼豆;onUpload 給了就多一顆「上傳圖片去背」。
 */
export default function ArtLibrary({
  entries,
  getArt,
  onPick,
  filter,
  onUpload,
  emptyHint,
  t,
}: {
  entries: ArtEntry[];
  getArt: (id: string) => Art | null;
  onPick: (id: string) => void;
  filter?: (entry: ArtEntry) => boolean;
  onUpload?: () => void;
  emptyHint?: string;
  t: ThemeClasses;
}) {
  const shown = filter ? entries.filter(filter) : entries;
  const groups = (["template", "material", "work", "cutout"] as const)
    .map((group) => ({ group, items: shown.filter((entry) => entry.group === group) }))
    .filter(({ items }) => items.length > 0);

  return (
    <div className="flex flex-col gap-3">
      {groups.map(({ group, items }) => (
        <div key={group} className="flex flex-col gap-1.5">
          <span className={`text-[11px] tracking-[0.08em] ${t.muted}`}>{GROUP_LABELS[group]}</span>
          <div className="flex flex-wrap gap-1.5">
            {items.map((entry) => (
              <button
                key={entry.id}
                type="button"
                title={entry.label}
                aria-label={`加入「${entry.label}」`}
                onClick={() => onPick(entry.id)}
                className={`rounded-xl border p-0.5 transition ${t.unselected}`}
                style={CHECKERBOARD}
              >
                <Thumb art={getArt(entry.id)} />
              </button>
            ))}
          </div>
        </div>
      ))}
      {groups.length === 0 && emptyHint && <p className={`text-xs leading-6 ${t.muted}`}>{emptyHint}</p>}
      {onUpload && (
        <button
          type="button"
          onClick={onUpload}
          className={`rounded-xl border border-dashed px-3 py-2 text-xs tracking-[0.04em] ${t.unselected}`}
        >
          上傳圖片，用魔術棒去背
        </button>
      )}
    </div>
  );
}
