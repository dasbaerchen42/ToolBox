"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getThemeClasses, type ThemeClasses } from "@/lib/theme";
import { readClipboardImages, readPasteImages } from "@/lib/clipboard";
import { downloadBlob, sanitizeFileName, shareImages, type ExportedImage } from "@/lib/download";
import { useCanShareImages } from "@/hooks/useCanShareImages";
import { renderPatternPng } from "@/lib/tools/beads/draw";
import { DEFAULT_PALETTE, paletteLab } from "@/lib/tools/beads/palette";
import {
  clearColors,
  countColors,
  matchPalette,
  type BeadPattern,
  type FitMode,
} from "@/lib/tools/beads/pattern";
import { decodePhoto, samplePhoto } from "@/lib/tools/beads/photo";
import { ImageDecodeError } from "@/lib/tools/image/render";
import { baseNameOf } from "@/lib/tools/image/format";
import { EmptyWorkspace, ToolPane } from "../image/_components/WorkbenchLayout";
import {
  ActionButton,
  Field,
  RangeField,
  Segmented,
  StationHint,
  Toggle,
} from "../image/_components/controls";
import BeadCanvas, { type Stage } from "./_components/BeadCanvas";

const PALETTE = DEFAULT_PALETTE;
const PALETTE_LAB = paletteLab(PALETTE);

type BoardSize = "29" | "58";

/** 畫面上每格幾像素:小板格子大一點,大板才塞得進畫面 */
const DISPLAY_CELL: Record<BoardSize, number> = { "29": 20, "58": 12 };

/** 輸出 PNG 每格幾像素:29 格約 700px、58 格約 1400px,社群貼圖夠用 */
const EXPORT_CELL = 24;

type Photo = { bitmap: ImageBitmap; name: string };
type Notice = { kind: "info" | "error"; text: string } | null;

export default function BeadsPage() {
  const t = getThemeClasses();
  const canShare = useCanShareImages();
  const fileInput = useRef<HTMLInputElement>(null);

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [size, setSize] = useState<BoardSize>("29");
  const [fit, setFit] = useState<FitMode>("cover");
  const [maxColors, setMaxColors] = useState(16);
  const [removed, setRemoved] = useState<Set<number>>(() => new Set());
  const [stage, setStage] = useState<Stage>("pattern");
  const [withBoard, setWithBoard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingShare = useRef<{ key: string; file: ExportedImage } | null>(null);

  const showNotice = useCallback((text: string, kind: "info" | "error" = "info") => {
    setNotice({ kind, text });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), kind === "error" ? 8000 : 3000);
  }, []);

  // 動到圖或參數,板子上的豆子就跟底圖對不上了,一律回到底圖重新開始
  const resetStage = () => setStage("pattern");

  const samples = useMemo(() => {
    if (!photo) return null;
    const cells = Number(size);
    return samplePhoto(photo.bitmap, cells, cells, fit);
  }, [photo, size, fit]);

  const pattern = useMemo<BeadPattern | null>(() => {
    if (!samples) return null;
    const cells = Number(size);
    const base = {
      cols: cells,
      rows: cells,
      cells: matchPalette(samples, PALETTE_LAB, maxColors),
    };
    return clearColors(base, removed);
  }, [samples, size, maxColors, removed]);

  const counts = useMemo(() => (pattern ? countColors(pattern.cells) : []), [pattern]);
  const total = counts.reduce((sum, item) => sum + item.count, 0);

  const loadFile = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        const bitmap = await decodePhoto(file, file.name);
        setPhoto((previous) => {
          previous?.bitmap.close();
          return { bitmap, name: baseNameOf(file.name) };
        });
        setRemoved(new Set());
        setStage("pattern");
        showNotice("轉好了。點底圖上的背景可以整色清掉。");
      } catch (error) {
        showNotice(
          error instanceof ImageDecodeError ? error.message : `無法讀取「${file.name}」`,
          "error"
        );
      } finally {
        setBusy(false);
      }
    },
    [showNotice]
  );

  // 整頁的貼上:游標不在輸入框裡時按 ⌘V / Ctrl+V 直接換圖
  useEffect(() => {
    function handle(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;

      const [file] = readPasteImages(event);
      if (!file) return;
      event.preventDefault();
      void loadFile(file);
    }

    window.addEventListener("paste", handle);
    return () => window.removeEventListener("paste", handle);
  }, [loadFile]);

  // 不保存,燙好了還沒帶走就重新整理會全沒,離開前攔一下
  useEffect(() => {
    if (stage !== "ironed" && stage !== "placed") return;
    const handle = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handle);
    return () => window.removeEventListener("beforeunload", handle);
  }, [stage]);

  async function handleReadClipboard() {
    const [file] = await readClipboardImages();
    if (file) await loadFile(file);
    else showNotice("讀不到剪貼簿裡的圖，改用鍵盤 Ctrl / ⌘ + V 貼上試試。", "error");
  }

  function removeColor(index: number) {
    setRemoved((previous) => new Set(previous).add(index));
    resetStage();
  }

  function restoreColor(index: number) {
    setRemoved((previous) => {
      const next = new Set(previous);
      next.delete(index);
      return next;
    });
    resetStage();
  }

  function handlePickCell(index: number) {
    const color = pattern?.cells[index] ?? -1;
    if (color < 0) return;
    const count = counts.find((item) => item.index === color)?.count ?? 0;
    removeColor(color);
    showNotice(`清掉「${PALETTE[color].name}」${count} 顆，可以在右邊恢復。`);
  }

  const handleSettled = useCallback((next: "placed" | "ironed") => setStage(next), []);

  const fileTitle = `${photo?.name ?? "拼豆"}-拼豆`;
  const exportKey = JSON.stringify([fileTitle, size, fit, maxColors, [...removed], stage, withBoard]);

  async function buildPng(): Promise<ExportedImage | null> {
    if (!pattern) return null;
    const blob = await renderPatternPng(pattern, PALETTE, {
      cell: EXPORT_CELL,
      melt: stage === "ironed" ? 1 : 0,
      board: withBoard,
    });
    return { name: `${sanitizeFileName(fileTitle)}.png`, blob };
  }

  async function run(task: () => Promise<string | void>) {
    setBusy(true);
    try {
      const message = await task();
      if (message) showNotice(message);
    } catch (error) {
      console.error(error);
      showNotice("輸出失敗了，請再試一次。", "error");
    } finally {
      setBusy(false);
    }
  }

  const handleDownload = () =>
    run(async () => {
      const file = await buildPng();
      if (!file) return;
      downloadBlob(file);
      return "已下載。";
    });

  const handleShare = () =>
    run(async () => {
      // 上一次產好但被瀏覽器擋下來的那張:同樣的設定就直接拿來分享,
      // share 前面沒有任何 await,按鈕的授權才不會過期
      const pending = pendingShare.current;
      const file = pending?.key === exportKey ? pending.file : await buildPng();
      pendingShare.current = null;
      if (!file) return;

      try {
        const result = await shareImages([file]);
        if (result === "needs-tap") {
          pendingShare.current = { key: exportKey, file };
          return "圖準備好了，再按一次「存到相簿／分享」就會開啟選單。";
        }
        return result === "shared" ? "已交給分享選單。" : undefined;
      } catch (error) {
        console.error(error);
        return "這個瀏覽器沒辦法分享圖片，請改用下載。";
      }
    });

  const animating = stage === "dropping" || stage === "ironing";
  const placed = stage === "placed" || stage === "ironed";

  return (
    <main
      className={`flex flex-1 flex-col ${t.page}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = Array.from(event.dataTransfer.files).find((item) =>
          item.type.startsWith("image/")
        );
        if (file) void loadFile(file);
      }}
    >
      <section className="mx-auto w-full max-w-[1600px] p-4 md:p-6">
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <h1 className="text-xl font-semibold tracking-[0.08em]">拼豆工坊</h1>
            <p className={`mt-0.5 text-xs tracking-[0.04em] ${t.muted}`}>
              照片轉成拼豆，看豆子落進板子再燙成一片・全部在你的瀏覽器裡完成，照片不會離開這台電腦
            </p>
          </div>

          <p
            aria-live="polite"
            className={`text-xs leading-6 tracking-[0.04em] ${notice?.kind === "error" ? "" : t.muted}`}
          >
            {busy ? "處理中……" : (notice?.text ?? "")}
          </p>
        </header>

        <ToolPane
          workspace={
            pattern ? (
              <div className="rounded-2xl border border-(--border-light) bg-(--paper-bg-3) p-3">
                <div className="flex justify-center">
                  <BeadCanvas
                    pattern={pattern}
                    palette={PALETTE}
                    stage={stage}
                    cell={DISPLAY_CELL[size]}
                    onSettled={handleSettled}
                    onPickCell={stage === "pattern" ? handlePickCell : undefined}
                  />
                </div>
              </div>
            ) : (
              <EmptyWorkspace t={t}>
                選一張照片，或直接拖進來、按 Ctrl / ⌘ + V 貼上。
                <br />
                有透明背景的 PNG 會自動留空。
              </EmptyWorkspace>
            )
          }
          controls={
            <>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={busy || animating}
                  className={`rounded-xl border px-3 py-1.5 text-xs transition disabled:opacity-40 ${t.primary}`}
                >
                  {photo ? "換一張照片" : "選擇照片"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleReadClipboard()}
                  disabled={busy || animating}
                  className={`rounded-xl border px-3 py-1.5 text-xs transition disabled:opacity-40 ${t.secondary}`}
                >
                  讀剪貼簿
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void loadFile(file);
                    event.target.value = "";
                  }}
                />
              </div>

              {pattern && (
                <>
                  <Field label="板子" t={t}>
                    <Segmented
                      value={size}
                      onChange={(value) => {
                        setSize(value);
                        resetStage();
                      }}
                      t={t}
                      label="板子尺寸"
                      options={[
                        { value: "29", label: "小板 29×29" },
                        { value: "58", label: "大板 58×58" },
                      ]}
                    />
                  </Field>

                  <Field
                    label="構圖"
                    hint={fit === "cover" ? "裁掉多出來的部分，把板子填滿" : "整張照片放進去，旁邊留空"}
                    t={t}
                  >
                    <Segmented
                      value={fit}
                      onChange={(value) => {
                        setFit(value);
                        resetStage();
                      }}
                      t={t}
                      label="構圖"
                      options={[
                        { value: "cover", label: "裁滿" },
                        { value: "contain", label: "完整放進" },
                      ]}
                    />
                  </Field>

                  <RangeField
                    label="最多幾種顏色"
                    display={`${maxColors} 色`}
                    value={maxColors}
                    min={2}
                    max={PALETTE.length}
                    onChange={(value) => {
                      setMaxColors(value);
                      resetStage();
                    }}
                    t={t}
                  />

                  <div className="space-y-2">
                    {stage === "pattern" && (
                      <ActionButton t={t} onClick={() => setStage("dropping")} disabled={total === 0}>
                        自動落豆
                      </ActionButton>
                    )}
                    {stage === "dropping" && (
                      <ActionButton tone="secondary" t={t} onClick={() => setStage("placed")}>
                        略過，直接放好
                      </ActionButton>
                    )}
                    {stage === "placed" && (
                      <ActionButton t={t} onClick={() => setStage("ironing")}>
                        熨燙
                      </ActionButton>
                    )}
                    {stage === "ironing" && (
                      <ActionButton tone="secondary" t={t} onClick={() => setStage("ironed")}>
                        略過，直接燙好
                      </ActionButton>
                    )}
                    {placed && (
                      <ActionButton tone="secondary" t={t} onClick={resetStage}>
                        倒回底圖
                      </ActionButton>
                    )}
                  </div>

                  {placed && (
                    <div className={`space-y-3 border-t pt-4 ${t.divider}`}>
                      <Toggle
                        checked={withBoard}
                        onChange={setWithBoard}
                        label="連板子一起輸出（不勾就是透明背景）"
                        t={t}
                      />
                      <div className="space-y-2">
                        <ActionButton t={t} onClick={() => void handleDownload()} disabled={busy}>
                          下載 PNG
                        </ActionButton>
                        {canShare && (
                          <ActionButton
                            tone="secondary"
                            t={t}
                            onClick={() => void handleShare()}
                            disabled={busy}
                          >
                            存到相簿／分享
                          </ActionButton>
                        )}
                      </div>
                      {stage === "placed" && (
                        <p className={`text-[11px] leading-5 ${t.muted}`}>
                          現在下載的是還沒燙的樣子，想要燙好的就先按「熨燙」。
                        </p>
                      )}
                    </div>
                  )}

                  <ColorList
                    counts={counts}
                    total={total}
                    removed={removed}
                    canEdit={!animating}
                    onRemove={removeColor}
                    onRestore={restoreColor}
                    t={t}
                  />
                </>
              )}

              {!pattern && (
                <StationHint t={t}>
                  照片會依板子大小切成格子，每格換成最接近的豆子顏色。
                  色數越少越有拼豆的味道。
                </StationHint>
              )}
            </>
          }
        />
      </section>
    </main>
  );
}

function ColorList({
  counts,
  total,
  removed,
  canEdit,
  onRemove,
  onRestore,
  t,
}: {
  counts: { index: number; count: number }[];
  total: number;
  removed: Set<number>;
  canEdit: boolean;
  onRemove: (index: number) => void;
  onRestore: (index: number) => void;
  t: ThemeClasses;
}) {
  return (
    <div className={`border-t pt-4 ${t.divider}`}>
      <p className="mb-2 text-xs tracking-[0.08em]">
        用到 {counts.length} 色・共 {total} 顆
      </p>

      <ul className="space-y-1">
        {counts.map(({ index, count }) => (
          <li key={index} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="h-4 w-4 shrink-0 rounded-full border border-(--border-light)"
              style={{ background: PALETTE[index].hex }}
            />
            <span className={`w-8 shrink-0 font-mono text-[11px] ${t.muted}`}>{PALETTE[index].code}</span>
            <span className="min-w-0 flex-1 truncate">
              {PALETTE[index].name}
              <span className={`ml-1.5 text-[10px] ${t.muted}`}>{PALETTE[index].reading}</span>
            </span>
            <span className={`shrink-0 tabular-nums ${t.muted}`}>{count} 顆</span>
            <button
              type="button"
              onClick={() => onRemove(index)}
              disabled={!canEdit}
              className={`shrink-0 rounded-lg border px-2 py-0.5 text-[11px] transition disabled:opacity-40 ${t.secondary}`}
              aria-label={`清掉「${PALETTE[index].name}」`}
            >
              清掉
            </button>
          </li>
        ))}
      </ul>

      {removed.size > 0 && (
        <div className="mt-3">
          <p className={`mb-1.5 text-[11px] tracking-[0.08em] ${t.muted}`}>已清掉</p>
          <div className="flex flex-wrap gap-1.5">
            {[...removed].map((index) => (
              <button
                key={index}
                type="button"
                onClick={() => onRestore(index)}
                disabled={!canEdit}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] transition disabled:opacity-40 ${t.secondary}`}
                aria-label={`恢復「${PALETTE[index].name}」`}
              >
                <span
                  aria-hidden
                  className="h-3 w-3 rounded-full border border-(--border-light)"
                  style={{ background: PALETTE[index].hex }}
                />
                {PALETTE[index].name}・恢復
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
