"use client";

import { useRef, useState } from "react";
import type { CustomKind } from "../_lib/custom-items";
import { CUSTOM_LABELS } from "../_lib/custom-items";
import type { ThemeClasses } from "@/lib/theme";

type Props = {
  kind: CustomKind;
  items: string[];
  onPick: (value: string) => void;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  onImport: (raw: string) => void;
  onExport: () => void;
  t: ThemeClasses;
};

/**
 * 自訂項目。
 *
 * 內建清單一定不夠用,所以每一類都能自己加。匯出是整份備份(三類一起),
 * 匯入則是合併而不是覆蓋——存在 localStorage 的東西清了瀏覽器資料就沒了,
 * 沒有帶得走的檔案等於要求使用者相信瀏覽器。
 */
export default function CustomSection({
  kind,
  items,
  onPick,
  onAdd,
  onRemove,
  onImport,
  onExport,
  t,
}: Props) {
  const [draft, setDraft] = useState("");
  const [importing, setImporting] = useState(false);
  const [raw, setRaw] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  function submit() {
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft("");
  }

  function runImport() {
    if (!raw.trim()) return;
    onImport(raw);
    setRaw("");
    setImporting(false);
  }

  return (
    <section className={`rounded-xl border p-3 ${t.subPanel}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className={`text-[11px] tracking-[0.12em] ${t.muted}`}>
          自訂{CUSTOM_LABELS[kind]}
          {items.length > 0 ? `（${items.length}）` : ""}
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setImporting((prev) => !prev)}
            className={`rounded-lg border px-2 py-1 text-[11px] transition ${t.secondary}`}
          >
            匯入
          </button>
          <button
            type="button"
            onClick={onExport}
            className={`rounded-lg border px-2 py-1 text-[11px] transition ${t.secondary}`}
          >
            匯出全部
          </button>
        </div>
      </div>

      {importing && (
        <div className="mb-3 space-y-2">
          <textarea
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            placeholder={"貼上備份檔的內容，或一行一個直接貼進來"}
            className={`h-24 w-full rounded-lg border p-2 text-xs ${t.input}`}
            aria-label="匯入內容"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={runImport}
              disabled={!raw.trim()}
              className={`rounded-lg border px-2.5 py-1 text-[11px] transition disabled:opacity-40 ${t.primary}`}
            >
              匯入
            </button>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className={`rounded-lg border px-2.5 py-1 text-[11px] transition ${t.secondary}`}
            >
              從檔案
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,.txt,text/plain,application/json"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setRaw(await file.text());
              }}
            />
          </div>
          <p className={`text-[10px] leading-4 ${t.muted}`}>
            匯入是合併，不會蓋掉你已經加過的東西。
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {items.map((item) => (
            <span
              key={item}
              className={`inline-flex items-center rounded-lg border ${t.listUnselected}`}
            >
              <button
                type="button"
                onClick={() => onPick(item)}
                className="px-2 py-1 text-sm"
                title={item}
              >
                {item}
              </button>
              <button
                type="button"
                onClick={() => onRemove(item)}
                className="px-1.5 py-1 text-[10px] opacity-50 transition hover:opacity-100"
                aria-label={`移除 ${item}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={`加一個${CUSTOM_LABELS[kind]}……`}
          className={`min-w-0 flex-1 rounded-lg border px-2 py-1 text-xs ${t.input}`}
          aria-label={`新增自訂${CUSTOM_LABELS[kind]}`}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim()}
          className={`rounded-lg border px-2.5 py-1 text-xs transition disabled:opacity-40 ${t.primary}`}
        >
          加入
        </button>
      </div>
    </section>
  );
}
