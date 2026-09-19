"use client";

import { useEffect, useMemo, useState } from "react";
import type { KaomojiGroup } from "../_lib/kaomoji";
import type { ThemeClasses } from "@/lib/theme";
import {
  PaletteFrame,
  PaletteGroup,
  PaletteLoading,
  PickButton,
  type PickMode,
} from "./palette-parts";

type Props = {
  mode: PickMode;
  onMode: (mode: PickMode) => void;
  recent: string[];
  onPick: (value: string) => void;
  t: ThemeClasses;
};

export default function KaomojiPalette({ mode, onMode, recent, onPick, t }: Props) {
  const [groups, setGroups] = useState<KaomojiGroup[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<
    ((groups: KaomojiGroup[], query: string) => KaomojiGroup[]) | null
  >(null);

  useEffect(() => {
    let alive = true;
    void import("../_lib/kaomoji").then((module) => {
      if (!alive) return;
      setGroups(module.KAOMOJI_GROUPS);
      setFilter(() => module.filterKaomoji);
    });
    return () => {
      alive = false;
    };
  }, []);

  const shown = useMemo(
    () => (groups && filter ? filter(groups, query) : []),
    [groups, filter, query]
  );

  if (!groups) return <PaletteLoading t={t} />;

  return (
    <PaletteFrame
      query={query}
      onQuery={setQuery}
      mode={mode}
      onMode={onMode}
      recent={recent}
      onPick={onPick}
      placeholder="搜尋顏文字（開心、掀桌、shy……）"
      t={t}
    >
      {shown.length === 0 ? (
        <p className={`py-6 text-center text-xs ${t.muted}`}>找不到符合的顏文字。</p>
      ) : (
        shown.map((group) => (
          <PaletteGroup key={group.key} label={group.label} t={t}>
            {group.items.map((entry) => (
              <PickButton
                key={entry.text}
                value={entry.text}
                onPick={onPick}
                title={entry.keywords}
                wide
                t={t}
              />
            ))}
          </PaletteGroup>
        ))
      )}
    </PaletteFrame>
  );
}
