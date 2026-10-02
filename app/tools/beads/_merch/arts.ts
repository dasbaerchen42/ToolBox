"use client";

import { useCallback, useMemo, useState } from "react";
import { fromSavedWork, type SavedWork } from "@/lib/tools/beads/album";
import type { BeadColor } from "@/lib/tools/beads/palette";
import type { BeadPattern } from "@/lib/tools/beads/pattern";
import { TEMPLATES, templatePattern } from "@/lib/tools/beads/templates";
import { rasterizeBeads, type Art } from "@/lib/tools/merch/render";

/** 素材庫裡的一項:還沒畫成圖,要用時才畫(大幅作品畫起來不便宜) */
export type ArtEntry = {
  id: string;
  label: string;
  group: "template" | "material" | "work" | "cutout";
  /** 快取用:內容變了 key 就跟著變 */
  version: string;
  pattern?: BeadPattern;
  canvas?: HTMLCanvasElement;
};

/** 去背好的圖片素材 */
export type Cutout = { id: string; label: string; canvas: HTMLCanvasElement; blob: Blob };

export const GROUP_LABELS: Record<ArtEntry["group"], string> = {
  template: "模板",
  material: "素材",
  work: "作品",
  cutout: "去背圖",
};

/** 搖搖吊飾裡的零件要算碰撞,太大的作品放不進去 */
export const MAX_PIECE_SIDE = 15;

export function isPieceable(entry: ArtEntry): boolean {
  return Boolean(entry.pattern && Math.max(entry.pattern.cols, entry.pattern.rows) <= MAX_PIECE_SIDE);
}

/**
 * 周邊能用的所有圖:內建模板、相簿裡的素材與作品、使用者去背的圖片。
 * getArt 第一次要用時才把拼豆畫成點陣圖,之後照 version 快取。
 */
export function useArts(album: SavedWork[], cutouts: Cutout[], palette: BeadColor[]) {
  // 快取本身是可變的 Map;用 state 拿一個固定的實例,渲染中讀寫也安全
  const [cache] = useState(() => new Map<string, { version: string; art: Art }>());

  const entries = useMemo<ArtEntry[]>(() => {
    const list: ArtEntry[] = TEMPLATES.map((template) => ({
      id: `tpl:${template.id}`,
      label: template.name,
      group: "template",
      version: "1",
      pattern: templatePattern(template, palette),
    }));
    // 素材在前(本來就是為周邊拼的小零件),作品在後
    for (const kind of ["material", "work"] as const) {
      for (const work of album) {
        if (work.kind !== kind) continue;
        list.push({
          id: `album:${work.id}`,
          label: work.name || (kind === "material" ? "未命名素材" : "未命名作品"),
          group: kind,
          version: work.updatedAt,
          pattern: fromSavedWork(work, palette),
        });
      }
    }
    for (const cutout of cutouts) {
      list.push({ id: cutout.id, label: cutout.label, group: "cutout", version: "1", canvas: cutout.canvas });
    }
    return list;
  }, [album, cutouts, palette]);

  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);

  const getArt = useCallback(
    (id: string): Art | null => {
      const entry = byId.get(id);
      if (!entry) return null;
      const cached = cache.get(id);
      if (cached && cached.version === entry.version) return cached.art;
      const source = entry.canvas ?? (entry.pattern ? rasterizeBeads(entry.pattern, palette) : null);
      if (!source) return null;
      const art: Art = {
        id,
        label: entry.label,
        source,
        width: source.width,
        height: source.height,
        pattern: entry.pattern,
      };
      cache.set(id, { version: entry.version, art });
      return art;
    },
    [byId, cache, palette],
  );

  /** 一次拿一批(畫設計時用),找不到的(相簿裡被刪掉的)略過 */
  const artMap = useCallback(
    (ids: Iterable<string>): Map<string, Art> => {
      const map = new Map<string, Art>();
      for (const id of ids) {
        const art = getArt(id);
        if (art) map.set(id, art);
      }
      return map;
    },
    [getArt],
  );

  return { entries, byId, getArt, artMap };
}
