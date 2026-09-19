"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ToolHeader from "@/components/editor/ToolHeader";
import ToolCollapsible from "@/components/ToolCollapsible";
import { getThemeClasses } from "@/lib/theme";
import { readClipboardImages, readPasteImages } from "@/lib/clipboard";
import { downloadBlob, zipImages, type ExportedImage } from "@/lib/download";
import { CanvasTooLargeError } from "@/lib/canvas-limits";
import { borderLayout, ratioLayout } from "@/lib/tools/image/frame";
import { buildFileName } from "@/lib/tools/image/format";
import { layoutMerge, type MergeOptions } from "@/lib/tools/image/merge";
import type { Span } from "@/lib/tools/image/slice";
import {
  applyFrame,
  applyMasks,
  clearColorCache,
  convertForOutput,
  createWorkImage,
  cropImage,
  ImageDecodeError,
  mergeImages,
  pickColorAt,
  sliceImage,
  WORKING_OUTPUT,
} from "@/lib/tools/image/render";
import type {
  Axis,
  MaskRect,
  OutputOptions,
  Point,
  Rect,
  WorkImage,
} from "@/lib/tools/image/types";

import ImageTray from "./_components/ImageTray";
import MaskPanel from "./_components/MaskPanel";
import SlicePanel from "./_components/SlicePanel";
import MergePanel from "./_components/MergePanel";
import FramePanel, { type FrameSettings } from "./_components/FramePanel";
import OutputPanel from "./_components/OutputPanel";
import { StationHint } from "./_components/controls";

/** 復原只留這麼多步:每一步都抓著一整組 blob,再多就開始吃記憶體 */
const HISTORY_LIMIT = 20;

type Notice = { kind: "info" | "error"; text: string } | null;

export default function ImageWorkbenchPage() {
  const t = getThemeClasses();

  const [images, setImages] = useState<WorkImage[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [history, setHistory] = useState<WorkImage[][]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [output, setOutput] = useState<OutputOptions>({
    format: "png",
    quality: 0.85,
    flattenColor: "#ffffff",
  });

  const [openSection, setOpenSection] = useState({
    mask: true,
    slice: false,
    merge: false,
    frame: false,
    output: true,
  });

  // 每張圖都掛著一個 objectURL,離開頁面前要全部還回去
  const urls = useRef(new Set<string>());
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((text: string, kind: "info" | "error" = "info") => {
    setNotice({ kind, text });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), kind === "error" ? 8000 : 3000);
  }, []);

  const track = useCallback((added: WorkImage[]) => {
    for (const image of added) urls.current.add(image.url);
    return added;
  }, []);

  /** 動到 images 一律走這裡,順便把上一版推進復原堆疊 */
  const commit = useCallback(
    (next: WorkImage[], nextSelected?: string[]) => {
      setHistory((prev) => [...prev, images].slice(-HISTORY_LIMIT));
      setImages(next);
      if (nextSelected) setSelectedIds(nextSelected);
    },
    [images]
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setBusy(true);

      try {
        const loaded: WorkImage[] = [];
        const failed: string[] = [];

        for (const file of files) {
          try {
            loaded.push(await createWorkImage(file, file.name));
          } catch (error) {
            failed.push(
              error instanceof ImageDecodeError ? error.message : `無法讀取「${file.name}」`
            );
          }
        }

        if (loaded.length > 0) {
          track(loaded);
          setHistory((prev) => [...prev, images].slice(-HISTORY_LIMIT));
          setImages((prev) => [...prev, ...loaded]);
          setSelectedIds(loaded.map((image) => image.id));
        }

        if (failed.length > 0) showNotice(failed[0], "error");
        else if (loaded.length > 0) showNotice(`已加入 ${loaded.length} 張。`);
      } finally {
        setBusy(false);
      }
    },
    [images, showNotice, track]
  );

  // 整頁的貼上:游標不在輸入框裡時按 ⌘V / Ctrl+V 直接把剪貼簿的圖接進來
  useEffect(() => {
    function handle(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;

      const files = readPasteImages(event);
      if (files.length === 0) return;

      event.preventDefault();
      void addFiles(files);
    }

    window.addEventListener("paste", handle);
    return () => window.removeEventListener("paste", handle);
  }, [addFiles]);

  // 這個工具不保存,重新整理就全沒了,離開前攔一下
  useEffect(() => {
    if (images.length === 0) return;

    const handle = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handle);
    return () => window.removeEventListener("beforeunload", handle);
  }, [images.length]);

  useEffect(() => {
    const created = urls.current;
    return () => {
      for (const url of created) URL.revokeObjectURL(url);
      created.clear();
      clearColorCache();
    };
  }, []);

  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => images.find((image) => image.id === id))
        .filter((image): image is WorkImage => !!image),
    [selectedIds, images]
  );

  const active = selected[0] ?? null;

  function toggleSelect(id: string, additive: boolean) {
    setSelectedIds((prev) => {
      if (!additive) return prev.length === 1 && prev[0] === id ? [] : [id];
      return prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id];
    });
  }

  function removeImage(id: string) {
    commit(images.filter((image) => image.id !== id));
    setSelectedIds((prev) => prev.filter((value) => value !== id));
  }

  function clearAll() {
    if (images.length > 0 && !window.confirm("清掉工作檯上的所有圖片?這個動作沒辦法復原。")) {
      return;
    }

    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current.clear();
    clearColorCache();

    setImages([]);
    setSelectedIds([]);
    setHistory([]);
    showNotice("工作檯已清空。");
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;

    setHistory((prev) => prev.slice(0, -1));
    setImages(previous);
    // 還原後的清單可能已經沒有原本選取的那幾張了
    setSelectedIds((prev) =>
      prev.filter((id) => previous.some((image) => image.id === id))
    );
    showNotice("已復原一步。");
  }

  function moveInSelection(id: string, direction: -1 | 1) {
    setSelectedIds((prev) => {
      const index = prev.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;

      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  /** 把 id 那張換成 results(可能是一張,也可能切成好幾張) */
  function replaceImage(id: string, results: WorkImage[]) {
    const index = images.findIndex((image) => image.id === id);
    if (index < 0) return;

    track(results);
    const next = [...images];
    next.splice(index, 1, ...results);
    commit(
      next,
      selectedIds.flatMap((value) =>
        value === id ? results.map((image) => image.id) : [value]
      )
    );
  }

  /** 所有會碰到 canvas 的動作都包在這裡,統一處理忙碌狀態與錯誤訊息 */
  async function run(task: () => Promise<string | void>) {
    setBusy(true);
    try {
      const message = await task();
      if (message) showNotice(message);
    } catch (error) {
      if (error instanceof CanvasTooLargeError) {
        showNotice(`${error.message}。請先切小再處理。`, "error");
      } else if (error instanceof ImageDecodeError) {
        showNotice(error.message, "error");
      } else {
        console.error(error);
        showNotice("處理失敗了,請再試一次。", "error");
      }
    } finally {
      setBusy(false);
    }
  }

  const handleMask = (masks: MaskRect[]) =>
    run(async () => {
      if (!active) return;
      const result = await applyMasks(active, masks, WORKING_OUTPUT);
      replaceImage(active.id, [result]);
      return `蓋掉 ${masks.length} 塊。`;
    });

  const handleSlice = (spans: Span[], axis: Axis) =>
    run(async () => {
      if (!active) return;
      const pieces = await sliceImage(active, spans, axis, WORKING_OUTPUT);
      replaceImage(active.id, pieces);
      return `切成 ${pieces.length} 段。`;
    });

  const handleCrop = (rect: Rect) =>
    run(async () => {
      if (!active) return;
      const result = await cropImage(active, rect, WORKING_OUTPUT);
      replaceImage(active.id, [result]);
      return `裁成 ${rect.width} × ${rect.height}。`;
    });

  const handleMerge = (options: MergeOptions, background: string | null) =>
    run(async () => {
      if (selected.length < 2) return;

      const layout = layoutMerge(selected, options);
      const merged = await mergeImages(
        selected,
        layout,
        background,
        WORKING_OUTPUT,
        `${selected[0].name}-拼接`
      );

      track([merged]);
      commit([...images, merged], [merged.id]);
      return `接成 ${layout.canvas.width} × ${layout.canvas.height}，原本那幾張留著。`;
    });

  const handleFrame = (settings: FrameSettings) =>
    run(async () => {
      if (selected.length === 0) return;

      const done = new Map<string, WorkImage>();

      for (const image of selected) {
        let current = image;

        if (settings.border) {
          current = await applyFrame(
            current,
            borderLayout(current, settings.borderWidth, settings.borderMode),
            {
              borderWidth: settings.borderWidth,
              borderColor: settings.borderColor,
              background: settings.background,
            },
            WORKING_OUTPUT
          );
        }

        if (settings.ratio) {
          current = await applyFrame(
            current,
            ratioLayout(current, settings.ratioValue, {
              x: settings.alignX,
              y: settings.alignY,
            }),
            {
              borderWidth: 0,
              borderColor: settings.borderColor,
              background: settings.background,
            },
            WORKING_OUTPUT
          );
        }

        done.set(image.id, current);
      }

      const results = [...done.values()];
      track(results);

      commit(
        images.map((image) => done.get(image.id) ?? image),
        selectedIds.map((id) => done.get(id)?.id ?? id)
      );
      return `已套用到 ${results.length} 張。`;
    });

  const handleDownload = (targets: WorkImage[]) =>
    run(async () => {
      if (targets.length === 0) return;

      const files: ExportedImage[] = [];

      for (const [index, image] of targets.entries()) {
        files.push({
          name: buildFileName(image.name, output.format, index, targets.length),
          blob: await convertForOutput(image, output),
        });
      }

      if (files.length === 1) {
        downloadBlob(files[0]);
        return "已下載。";
      }

      downloadBlob(await zipImages(files, `${targets[0].name}-${files.length}張`));
      return `已打包 ${files.length} 張。`;
    });

  const handleReadClipboard = () =>
    run(async () => {
      const files = await readClipboardImages();
      if (files.length === 0) {
        showNotice("讀不到剪貼簿裡的圖,改用鍵盤 Ctrl / ⌘ + V 貼上試試。", "error");
        return;
      }
      await addFiles(files);
    });

  const toggleSection = (key: keyof typeof openSection) =>
    setOpenSection((prev) => ({ ...prev, [key]: !prev[key] }));

  const needOne = (
    <StationHint t={t}>先在上面的清單選一張圖。選多張時以第一張（標 1 的那張）為準。</StationHint>
  );

  return (
    <main className={`min-h-screen ${t.page}`}>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <ToolHeader
          title="影像工作檯"
          description="貼上圖片、塗遮罩、切割、拼接、加框。全部在你的瀏覽器裡完成，圖片不會離開這台電腦。"
          t={t}
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={history.length === 0 || busy}
            className={`rounded-xl border px-3 py-2 text-sm transition disabled:opacity-40 ${t.secondary}`}
          >
            復原一步{history.length > 0 ? `（${history.length}）` : ""}
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={images.length === 0 || busy}
            className={`rounded-xl border px-3 py-2 text-sm transition disabled:opacity-40 ${t.secondary}`}
          >
            清空工作檯
          </button>

          {busy && <span className={`text-xs ${t.muted}`}>處理中……</span>}

          {notice && (
            <span
              className={`text-xs leading-6 tracking-[0.04em] ${
                notice.kind === "error" ? "text-(--ink-primary)" : t.muted
              }`}
            >
              {notice.text}
            </span>
          )}
        </div>

        <ImageTray
          images={images}
          selectedIds={selectedIds}
          busy={busy}
          t={t}
          onAddFiles={(files) => void addFiles(files)}
          onReadClipboard={() => void handleReadClipboard()}
          onToggle={toggleSelect}
          onRemove={removeImage}
        />

        <div className="mt-4 space-y-4">
          <section className={`rounded-3xl border p-4 md:p-5 ${t.panel}`}>
            <ToolCollapsible
              title="遮罩塗佈區"
              description="拖一個框蓋掉不想露出來的東西"
              isOpen={openSection.mask}
              onToggle={() => toggleSection("mask")}
              t={t}
            >
              {active ? (
                <MaskPanel
                  key={active.id}
                  image={active}
                  busy={busy}
                  t={t}
                  onApply={(masks) => void handleMask(masks)}
                  onPickColor={(point: Point) => pickColorAt(active, point)}
                />
              ) : (
                needOne
              )}
            </ToolCollapsible>
          </section>

          <section className={`rounded-3xl border p-4 md:p-5 ${t.panel}`}>
            <ToolCollapsible
              title="影像切割刀"
              description="等分切、自由下刀、框選裁切"
              isOpen={openSection.slice}
              onToggle={() => toggleSection("slice")}
              t={t}
            >
              {active ? (
                <SlicePanel
                  key={active.id}
                  image={active}
                  busy={busy}
                  t={t}
                  onSlice={(spans, axis) => void handleSlice(spans, axis)}
                  onCrop={(rect) => void handleCrop(rect)}
                />
              ) : (
                needOne
              )}
            </ToolCollapsible>
          </section>

          <section className={`rounded-3xl border p-4 md:p-5 ${t.panel}`}>
            <ToolCollapsible
              title="圖片拼接台"
              description="照選取順序接成一張長圖或寬圖"
              isOpen={openSection.merge}
              onToggle={() => toggleSection("merge")}
              t={t}
            >
              <MergePanel
                images={selected}
                busy={busy}
                t={t}
                onMove={moveInSelection}
                onMerge={(options, background) => void handleMerge(options, background)}
              />
            </ToolCollapsible>
          </section>

          <section className={`rounded-3xl border p-4 md:p-5 ${t.panel}`}>
            <ToolCollapsible
              title="邊框比例區"
              description="描邊，或往外補背景湊成指定長寬比"
              isOpen={openSection.frame}
              onToggle={() => toggleSection("frame")}
              t={t}
            >
              <FramePanel
                images={selected}
                busy={busy}
                t={t}
                onApply={(settings) => void handleFrame(settings)}
              />
            </ToolCollapsible>
          </section>

          <section className={`rounded-3xl border p-4 md:p-5 ${t.panel}`}>
            <ToolCollapsible
              title="輸出下載區"
              description="格式、品質，然後帶走"
              isOpen={openSection.output}
              onToggle={() => toggleSection("output")}
              t={t}
            >
              <OutputPanel
                images={images}
                selected={selected}
                output={output}
                busy={busy}
                t={t}
                onChange={setOutput}
                onDownload={(targets) => void handleDownload(targets)}
              />
            </ToolCollapsible>
          </section>
        </div>
      </div>
    </main>
  );
}
