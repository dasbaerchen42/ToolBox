"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getThemeClasses } from "@/lib/theme";
import { readClipboardImages, readPasteImages } from "@/lib/clipboard";
import { downloadBlob, sanitizeFileName, shareImages, type ExportedImage } from "@/lib/download";
import { useCanShareImages } from "@/hooks/useCanShareImages";
import {
  loadAlbum,
  mergeAlbum,
  parseAlbum,
  serializeAlbum,
  sortAlbum,
  storeAlbum,
  toSavedWork,
  fromSavedWork,
  type SavedWork,
} from "@/lib/tools/beads/album";
import { renderPatternPng } from "@/lib/tools/beads/draw";
import {
  blankPattern,
  floodFill,
  lineBetween,
  paint,
  replaceColor,
  type Symmetry,
} from "@/lib/tools/beads/edit";
import { DEFAULT_PALETTE, paletteLab } from "@/lib/tools/beads/palette";
import {
  countColors,
  matchPalette,
  type BeadPattern,
  type CellSample,
  boardSize,
  type BoardShape,
  type FitMode,
  type SampleMethod,
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
import EditPanel, { type EditTool } from "./_components/EditPanel";
import ColorList from "./_components/ColorList";
import AlbumPanel from "./_components/AlbumPanel";

const PALETTE = DEFAULT_PALETTE;
const PALETTE_LAB = paletteLab(PALETTE);

/** 板子寬度:29 是一塊小板,58 是一塊大板,87、116 是大板拼接 */
type BoardSize = "29" | "58" | "87" | "116";

const BOARD_WIDTHS: { value: BoardSize; label: string }[] = [
  { value: "29", label: "29" },
  { value: "58", label: "58" },
  { value: "87", label: "87" },
  { value: "116", label: "116" },
];

/** 照片轉換的所有參數 */
type ConvertSettings = {
  size: BoardSize;
  shape: BoardShape;
  fit: FitMode;
  method: SampleMethod;
  maxColors: number;
  /** 用量少於這麼多顆的顏色併掉;0 = 不併 */
  minCount: number;
};

const DEFAULT_SETTINGS: ConvertSettings = {
  size: "58",
  shape: "aspect",
  fit: "cover",
  method: "majority",
  maxColors: 16,
  minCount: 0,
};

/** 輸出 PNG 每格幾像素:29 格約 700px、58 格約 1400px,社群貼圖夠用 */
const EXPORT_CELL = 24;

/** 復原最多記這麼多步;一步就是一份 cells,大板也才幾 KB */
const HISTORY_LIMIT = 100;

/** 預設畫筆顏色:猩々緋,空板上第一筆畫下去看得清楚 */
const DEFAULT_COLOR = Math.max(0, PALETTE.findIndex((color) => color.name === "猩々緋"));

/** 畫面上每格幾像素:小板格子大一點,大板才塞得進畫面 */
function displayCell(cols: number): number {
  if (cols <= 29) return 20;
  if (cols <= 58) return 12;
  return Math.max(4, Math.floor(700 / cols));
}

type Photo = { bitmap: ImageBitmap; name: string };
type Notice = { kind: "info" | "error"; text: string } | null;

/** 現在板子上的東西從哪來:照片轉的才有轉換參數可以調 */
type Source = "photo" | "blank" | "album";

export default function BeadsPage() {
  const t = getThemeClasses();
  const canShare = useCanShareImages();
  const fileInput = useRef<HTMLInputElement>(null);

  // 照片轉換
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [settings, setSettings] = useState<ConvertSettings>(DEFAULT_SETTINGS);
  const [blankSize, setBlankSize] = useState<BoardSize>("29");
  const samplesCache = useRef<{ key: string; samples: CellSample[] } | null>(null);

  // 板子與編輯
  const [source, setSource] = useState<Source | null>(null);
  const [pattern, setPattern] = useState<BeadPattern | null>(null);
  const [past, setPast] = useState<number[][]>([]);
  const [future, setFuture] = useState<number[][]>([]);
  const [tool, setTool] = useState<EditTool>("pen");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [symmetry, setSymmetry] = useState<Symmetry>("none");
  const patternRef = useRef<BeadPattern | null>(null);
  const stroke = useRef<{ base: number[]; last: number; color: number } | null>(null);

  // 收藏
  const [album, setAlbum] = useState<SavedWork[]>([]);
  const [savedAs, setSavedAs] = useState<Pick<SavedWork, "id" | "createdAt"> | null>(null);
  const [name, setName] = useState("");
  /** 有沒有還沒收進收藏冊的改動:離開頁面、換圖、開別的作品前要問 */
  const [dirty, setDirty] = useState(false);

  // 落豆、熨燙、輸出
  const [stage, setStage] = useState<Stage>("pattern");
  const [withBoard, setWithBoard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingShare = useRef<{ key: string; file: ExportedImage } | null>(null);

  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);

  useEffect(() => {
    setAlbum(loadAlbum());
  }, []);

  const showNotice = useCallback((text: string, kind: "info" | "error" = "info") => {
    setNotice({ kind, text });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), kind === "error" ? 8000 : 3000);
  }, []);

  /** 換一塊新的板子:復原紀錄、落豆進度一律從頭 */
  const loadPattern = useCallback((next: BeadPattern, from: Source) => {
    setPattern(next);
    setSource(from);
    setPast([]);
    setFuture([]);
    setStage("pattern");
    pendingShare.current = null;
  }, []);

  const confirmDiscard = useCallback(
    (what: string) => !dirty || window.confirm(`目前的作品還沒收進收藏冊，${what}會把它蓋掉。要繼續嗎？`),
    [dirty]
  );

  /** 照片 → 格子。取樣結果依尺寸、構圖、取色方式快取,只調色數時不必重畫一次照片 */
  const convert = useCallback(
    (target: Photo, next: ConvertSettings) => {
      const { width, height } = target.bitmap;
      const { cols, rows } = boardSize(width, height, Number(next.size), next.shape);
      // 依比例時板子跟照片一樣形狀,裁不裁都一樣;用 contain 免得四捨五入裁掉邊
      const fit = next.shape === "square" ? next.fit : "contain";
      const key = [target.name, width, height, cols, rows, fit, next.method].join("|");

      let samples = samplesCache.current?.key === key ? samplesCache.current.samples : null;
      if (!samples) {
        samples = samplePhoto(target.bitmap, cols, rows, fit, next.method, PALETTE_LAB);
        samplesCache.current = { key, samples };
      }
      loadPattern(
        { cols, rows, cells: matchPalette(samples, PALETTE_LAB, next.maxColors, next.minCount) },
        "photo"
      );
      setDirty(true);
    },
    [loadPattern]
  );

  const loadFile = useCallback(
    async (file: File) => {
      if (!confirmDiscard("換照片")) return;
      setBusy(true);
      try {
        const bitmap = await decodePhoto(file, file.name);
        const next = { bitmap, name: baseNameOf(file.name) };
        photo?.bitmap.close();
        samplesCache.current = null;
        setPhoto(next);
        setName(next.name);
        setSavedAs(null);
        convert(next, settings);
        showNotice("轉好了。可以直接在板子上修，或先按「自動落豆」。");
      } catch (error) {
        showNotice(
          error instanceof ImageDecodeError ? error.message : `無法讀取「${file.name}」`,
          "error"
        );
      } finally {
        setBusy(false);
      }
    },
    [confirmDiscard, convert, photo, settings, showNotice]
  );

  /** 轉換參數改了:照片轉的板子會重新轉,手動改過的部分會被蓋掉 */
  function changeConversion(change: Partial<ConvertSettings>) {
    const next = { ...settings, ...change };
    if (source === "photo" && photo) {
      if (past.length > 0 && !window.confirm("重新轉換會蓋掉你在板子上手動改的部分。要繼續嗎？")) {
        return;
      }
      convert(photo, next);
    }
    setSettings(next);
  }

  /** 空板換尺寸:畫過的東西會清掉 */
  function changeBlankSize(next: BoardSize) {
    if (next === blankSize) return;
    if (past.length > 0 && !window.confirm("換板子尺寸會清空目前畫的內容。要繼續嗎？")) return;
    const cells = Number(next);
    setBlankSize(next);
    loadPattern(blankPattern(cells, cells), "blank");
  }

  function startBlank(nextSize: BoardSize) {
    if (!confirmDiscard("開新的空板")) return;
    const cells = Number(nextSize);
    setBlankSize(nextSize);
    setName("");
    setSavedAs(null);
    setDirty(false);
    loadPattern(blankPattern(cells, cells), "blank");
    showNotice("空板準備好了，選個顏色開始拼。");
  }

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

  // 還沒收藏的作品、或燙好了還沒帶走,離開前攔一下
  useEffect(() => {
    if (!dirty && stage !== "ironed") return;
    const handle = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handle);
    return () => window.removeEventListener("beforeunload", handle);
  }, [dirty, stage]);

  // ---- 編輯 ----

  /** 一次完整的改動(一筆畫、一次倒油漆、清一個色)記成一步復原 */
  const commitEdit = useCallback((base: number[], next: number[]) => {
    if (base === next) return;
    setPast((previous) => [...previous, base].slice(-HISTORY_LIMIT));
    setFuture([]);
    setDirty(true);
  }, []);

  const applyCells = (cells: number[]) =>
    setPattern((previous) => (previous && previous.cells !== cells ? { ...previous, cells } : previous));

  const editing = stage === "pattern" && pattern !== null;

  function strokeStart(index: number) {
    const current = patternRef.current;
    if (!current) return;

    if (tool === "picker") {
      const picked = current.cells[index];
      if (picked < 0) {
        showNotice("這格是空的，點有豆子的格子。");
        return;
      }
      setColor(picked);
      setTool("pen");
      showNotice(`取到「${PALETTE[picked].name}」，換回畫筆。`);
      return;
    }

    if (tool === "fill") {
      const next = floodFill(current, index, color, symmetry);
      applyCells(next);
      commitEdit(current.cells, next);
      return;
    }

    const paintColor = tool === "eraser" ? -1 : color;
    const next = paint(current, [index], paintColor, symmetry);
    stroke.current = { base: current.cells, last: index, color: paintColor };
    applyCells(next);
    patternRef.current = { ...current, cells: next };
  }

  function strokeMove(index: number) {
    const active = stroke.current;
    const current = patternRef.current;
    if (!active || !current || index === active.last) return;

    const next = paint(current, lineBetween(active.last, index, current.cols), active.color, symmetry);
    active.last = index;
    applyCells(next);
    patternRef.current = { ...current, cells: next };
  }

  function strokeEnd() {
    const active = stroke.current;
    stroke.current = null;
    if (active && patternRef.current) commitEdit(active.base, patternRef.current.cells);
  }

  const undo = useCallback(() => {
    const previous = past.at(-1);
    const current = patternRef.current;
    if (!previous || !current) return;
    setPast(past.slice(0, -1));
    setFuture((list) => [current.cells, ...list].slice(0, HISTORY_LIMIT));
    setPattern({ ...current, cells: previous });
    setStage("pattern");
    setDirty(true);
  }, [past]);

  const redo = useCallback(() => {
    const next = future[0];
    const current = patternRef.current;
    if (!next || !current) return;
    setFuture(future.slice(1));
    setPast((list) => [...list, current.cells].slice(-HISTORY_LIMIT));
    setPattern({ ...current, cells: next });
    setStage("pattern");
    setDirty(true);
  }, [future]);

  // 復原/重做快捷鍵;游標在輸入框裡時留給瀏覽器自己的復原
  useEffect(() => {
    function handle(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      if (!(event.ctrlKey || event.metaKey)) return;

      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [undo, redo]);

  function clearColor(index: number) {
    const current = patternRef.current;
    if (!current) return;
    const count = current.cells.filter((cell) => cell === index).length;
    const next = replaceColor(current.cells, index, -1);
    applyCells(next);
    commitEdit(current.cells, next);
    setStage("pattern");
    showNotice(`清掉「${PALETTE[index].name}」${count} 顆，按「復原」可以拿回來。`);
  }

  // ---- 收藏冊 ----

  function persist(next: SavedWork[], success: string) {
    const sorted = sortAlbum(next);
    setAlbum(sorted);
    if (storeAlbum(sorted)) showNotice(success);
    else showNotice("瀏覽器不讓存（空間滿了或是無痕模式），請先用「匯出備份」帶走。", "error");
  }

  function saveWork(asNew: boolean) {
    if (!pattern) return;
    const target = asNew ? undefined : (savedAs ?? undefined);
    const work = toSavedWork(pattern, PALETTE, name, target);
    setSavedAs({ id: work.id, createdAt: work.createdAt });
    setName(work.name);
    setDirty(false);
    persist(
      [work, ...album.filter((item) => item.id !== work.id)],
      target ? `已更新「${work.name}」。` : `已收進收藏冊：「${work.name}」。`
    );
  }

  function openWork(work: SavedWork) {
    if (savedAs?.id !== work.id && !confirmDiscard("打開別的作品")) return;
    const next = fromSavedWork(work, PALETTE);
    setSavedAs({ id: work.id, createdAt: work.createdAt });
    setName(work.name);
    setDirty(false);
    loadPattern(next, "album");
    showNotice(`打開了「${work.name}」。`);
  }

  function deleteWork(work: SavedWork) {
    if (!window.confirm(`刪除「${work.name}」？刪掉就找不回來了。`)) return;
    if (savedAs?.id === work.id) {
      setSavedAs(null);
      setDirty(true);
    }
    persist(
      album.filter((item) => item.id !== work.id),
      `已刪除「${work.name}」。`
    );
  }

  function exportAlbum() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob({
      name: `拼豆收藏冊-${stamp}.json`,
      blob: new Blob([serializeAlbum(album)], { type: "application/json" }),
    });
    showNotice(`已匯出 ${album.length} 件作品。`);
  }

  async function importAlbum(file: File) {
    const { works, skipped } = parseAlbum(await file.text());
    if (works.length === 0) {
      showNotice("這個檔案裡沒有讀得懂的作品。", "error");
      return;
    }
    persist(
      mergeAlbum(album, works),
      `匯入 ${works.length} 件${skipped > 0 ? `，${skipped} 件格式不對略過了` : ""}。`
    );
  }

  // ---- 輸出 ----

  const counts = useMemo(() => (pattern ? countColors(pattern.cells) : []), [pattern]);
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  const fileTitle = `${name.trim() || "拼豆"}-拼豆`;
  const exportKey = JSON.stringify([fileTitle, pattern?.cells, stage, withBoard]);

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
      // 上一次產好但被瀏覽器擋下來的那張:同樣的內容就直接拿來分享,
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

  async function handleReadClipboard() {
    const [file] = await readClipboardImages();
    if (file) await loadFile(file);
    else showNotice("讀不到剪貼簿裡的圖，改用鍵盤 Ctrl / ⌘ + V 貼上試試。", "error");
  }

  const handleSettled = useCallback((next: "placed" | "ironed") => setStage(next), []);

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
              照片轉成拼豆或在空板上自己拼，看豆子落進板子再燙成一片・全部在你的瀏覽器裡完成，照片不會離開這台電腦
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
                    cell={displayCell(pattern.cols)}
                    onSettled={handleSettled}
                    editing={
                      editing
                        ? {
                            symmetry,
                            onStrokeStart: strokeStart,
                            onStrokeMove: strokeMove,
                            onStrokeEnd: strokeEnd,
                          }
                        : undefined
                    }
                  />
                </div>
              </div>
            ) : (
              <EmptyWorkspace t={t}>
                選一張照片（或直接拖進來、按 Ctrl / ⌘ + V 貼上），
                <br />
                或開一塊空板自己拼。
              </EmptyWorkspace>
            )
          }
          controls={
            <>
              <div className="space-y-2">
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
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => startBlank("29")}
                    disabled={busy || animating}
                    className={`rounded-xl border px-3 py-1.5 text-xs transition disabled:opacity-40 ${t.secondary}`}
                  >
                    空白小板
                  </button>
                  <button
                    type="button"
                    onClick={() => startBlank("58")}
                    disabled={busy || animating}
                    className={`rounded-xl border px-3 py-1.5 text-xs transition disabled:opacity-40 ${t.secondary}`}
                  >
                    空白大板
                  </button>
                </div>
              </div>

              {pattern && source === "photo" && (
                <>
                  <Field
                    label="取色方式"
                    hint={
                      settings.method === "majority"
                        ? "每格取出現最多的顏色，線條和色塊比較乾淨，適合插畫"
                        : "每格取平均色，漸層比較順，適合照片；細線容易糊成雜點"
                    }
                    t={t}
                  >
                    <Segmented
                      value={settings.method}
                      onChange={(value) => changeConversion({ method: value })}
                      t={t}
                      label="取色方式"
                      options={[
                        { value: "majority", label: "插畫（主色）" },
                        { value: "average", label: "照片（平均）" },
                      ]}
                    />
                  </Field>

                  <Field
                    label={`板子寬 ${pattern.cols} 格・高 ${pattern.rows} 格`}
                    hint="58 是一塊大板；87、116 等於大板拼接。格數越多細節越多，豆子也越多"
                    t={t}
                  >
                    <Segmented
                      value={settings.size}
                      onChange={(value) => changeConversion({ size: value })}
                      t={t}
                      label="板子寬度"
                      options={BOARD_WIDTHS}
                    />
                  </Field>

                  <Field label="形狀" t={t}>
                    <Segmented
                      value={settings.shape}
                      onChange={(value) => changeConversion({ shape: value })}
                      t={t}
                      label="板子形狀"
                      options={[
                        { value: "aspect", label: "照照片比例" },
                        { value: "square", label: "正方形" },
                      ]}
                    />
                  </Field>

                  {settings.shape === "square" && (
                    <Field
                      label="構圖"
                      hint={
                        settings.fit === "cover"
                          ? "裁掉多出來的部分，把板子填滿"
                          : "整張照片放進去，旁邊留空"
                      }
                      t={t}
                    >
                      <Segmented
                        value={settings.fit}
                        onChange={(value) => changeConversion({ fit: value })}
                        t={t}
                        label="構圖"
                        options={[
                          { value: "cover", label: "裁滿" },
                          { value: "contain", label: "完整放進" },
                        ]}
                      />
                    </Field>
                  )}

                  <RangeField
                    label="最多幾種顏色"
                    display={`${settings.maxColors} 色`}
                    value={settings.maxColors}
                    min={2}
                    max={PALETTE.length}
                    onChange={(value) => changeConversion({ maxColors: value })}
                    t={t}
                  />

                  <RangeField
                    label="每色至少幾顆"
                    display={
                      settings.minCount === 0
                        ? "不合併"
                        : `少於 ${settings.minCount} 顆就併進相近色`
                    }
                    value={settings.minCount}
                    min={0}
                    max={30}
                    onChange={(value) => changeConversion({ minCount: value })}
                    t={t}
                  />
                </>
              )}

              {pattern && source === "blank" && (
                <Field label="板子" t={t}>
                  <Segmented
                    value={blankSize}
                    onChange={changeBlankSize}
                    t={t}
                    label="板子尺寸"
                    options={BOARD_WIDTHS.map((item) => ({
                      value: item.value,
                      label: `${item.label}×${item.label}`,
                    }))}
                  />
                </Field>
              )}

              {pattern && (
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
                    <ActionButton tone="secondary" t={t} onClick={() => setStage("pattern")}>
                      回到編輯
                    </ActionButton>
                  )}
                </div>
              )}

              {pattern && editing && (
                <EditPanel
                  palette={PALETTE}
                  tool={tool}
                  color={color}
                  symmetry={symmetry}
                  canUndo={past.length > 0}
                  canRedo={future.length > 0}
                  t={t}
                  onTool={setTool}
                  onColor={(index) => {
                    setColor(index);
                    if (tool === "eraser" || tool === "picker") setTool("pen");
                  }}
                  onSymmetry={setSymmetry}
                  onUndo={undo}
                  onRedo={redo}
                />
              )}

              {pattern && placed && (
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
                      <ActionButton tone="secondary" t={t} onClick={() => void handleShare()} disabled={busy}>
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

              {pattern && (
                <div className={`space-y-2 border-t pt-4 ${t.divider}`}>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs tracking-[0.08em]">作品名稱</span>
                    <input
                      type="text"
                      value={name}
                      maxLength={60}
                      placeholder="未命名作品"
                      onChange={(event) => {
                        setName(event.target.value);
                        setDirty(true);
                      }}
                      className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                    />
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <ActionButton
                      t={t}
                      tone={dirty ? "primary" : "secondary"}
                      onClick={() => saveWork(false)}
                      disabled={busy || animating}
                    >
                      {savedAs ? "更新收藏" : "收進收藏冊"}
                    </ActionButton>
                    {savedAs && (
                      <ActionButton
                        t={t}
                        tone="secondary"
                        onClick={() => saveWork(true)}
                        disabled={busy || animating}
                      >
                        另存一份
                      </ActionButton>
                    )}
                  </div>
                </div>
              )}

              {pattern && (
                <ColorList
                  palette={PALETTE}
                  counts={counts}
                  canEdit={editing}
                  t={t}
                  onPick={(index) => {
                    setColor(index);
                    setTool("pen");
                  }}
                  onClear={clearColor}
                />
              )}

              {!pattern && (
                <StationHint t={t}>
                  照片會依板子大小切成格子，每格換成最接近的豆子顏色，轉好之後還能用畫筆修。
                  色數越少越有拼豆的味道。
                </StationHint>
              )}

              <AlbumPanel
                works={album}
                palette={PALETTE}
                activeId={savedAs?.id ?? null}
                busy={busy || animating}
                t={t}
                onOpen={openWork}
                onDelete={deleteWork}
                onExport={exportAlbum}
                onImport={(file) => void importAlbum(file)}
              />
            </>
          }
        />
      </section>
    </main>
  );
}
