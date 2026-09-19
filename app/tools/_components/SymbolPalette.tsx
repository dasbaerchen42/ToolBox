"use client";

import { useEffect, useMemo, useState } from "react";
import type { SymbolGroup } from "../_lib/symbols";
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

export default function SymbolPalette({ mode, onMode, recent, onPick, t }: Props) {
  const [groups, setGroups] = useState<SymbolGroup[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<
    ((groups: SymbolGroup[], query: string) => SymbolGroup[]) | null
  >(null);

  // 符號表是純資料,動態載入才不會壓到 /tools 的初始包
  useEffect(() => {
    let alive = true;
    void import("../_lib/symbols").then((module) => {
      if (!alive) return;
      setGroups(module.SYMBOL_GROUPS);
      setFilter(() => module.filterSymbols);
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
      placeholder="搜尋符號（愛心、arrow、箭頭……）"
      t={t}
    >
      {shown.length === 0 ? (
        <p className={`py-6 text-center text-xs ${t.muted}`}>找不到符合的符號。</p>
      ) : (
        shown.map((group) => (
          <PaletteGroup key={group.key} label={group.label} t={t}>
            {group.chars.map((entry) => (
              <PickButton
                key={entry.char}
                value={entry.char}
                onPick={onPick}
                title={entry.keywords}
                t={t}
              />
            ))}
          </PaletteGroup>
        ))
      )}
    </PaletteFrame>
  );
}
