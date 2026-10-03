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
  ALBUM_KIND_LABELS,
  type AlbumKind,
  type SavedWork,
} from "@/lib/tools/beads/album";
import { HINT_MIN_CELL, renderPatternPng } from "@/lib/tools/beads/draw";
import {
  blankPattern,
  fillMaterial,
  floodFill,
  lineBetween,
  paint,
  paintMaterial,
  replaceColor,
  stampMaterial,
  type Symmetry,
} from "@/lib/tools/beads/edit";
import { patternToSvg, renderSheetPng } from "@/lib/tools/beads/export";
import {
  MATERIALS,
  MELT_LEVELS,
  materialAt,
  meltOf,
  type BeadShape,
  type MeltLevel,
} from "@/lib/tools/beads/finish";
import { TEMPLATES, templatePattern, type BeadTemplate } from "@/lib/tools/beads/templates";
import { boardMask, clipToOutline, isOutline, OUTLINES, type BoardOutline } from "@/lib/tools/beads/outline";
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
import { CanvasTooLargeError } from "@/lib/canvas-limits";
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
import { useDarkBackground } from "./_components/useDarkBackground";
import MerchWorkshop from "./_merch/MerchWorkshop";
import SortBoxGame from "./_sort/SortBoxGame";
import {
  addBoxPalette,
  BOX_PALETTES_KEY,
  extendedPalette,
  readBoxStore,
  type BoxStore,
} from "@/lib/tools/beads/sortbox";

const PALETTE = DEFAULT_PALETTE;
const PALETTE_LAB = paletteLab(PALETTE);

/** 板子寬度:29 是一塊小板,58 是一塊大板,87、116 是大板拼接;5、7 是拼小零件的迷你板 */
type BoardSize = "5" | "7" | "29" | "58" | "87" | "116";

const BOARD_WIDTHS: { value: BoardSize; label: string }[] = [
  { value: "29", label: "29" },
  { value: "58", label: "58" },
  { value: "87", label: "87" },
  { value: "116", label: "116" },
];

/** 空板可選的尺寸(含迷你板) */
const BLANK_SIZES: { value: BoardSize; label: string }[] = [
  { value: "5", label: "迷你 5" },
  { value: "7", label: "迷你 7" },
  ...BOARD_WIDTHS,
];

/** 這麼小的板子拼的是素材(星星、愛心這類小零件),收藏時預設放素材分頁 */
const MINI_MAX = 16;

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

/** 復原最多記這麼多步;一步就是一份 cells(加材質),大板也才幾十 KB */
const HISTORY_LIMIT = 100;

/** 預設畫筆顏色:猩々緋,空板上第一筆畫下去看得清楚 */
const DEFAULT_COLOR = Math.max(0, PALETTE.findIndex((color) => color.name === "猩々緋"));

/** 畫面上每格幾像素:板子大約 700px 寬;迷你板格子放大,但不要大到像在看單顆豆子 */
function displayCell(cols: number, rows: number): number {
  return Math.min(72, Math.max(4, Math.floor(700 / Math.max(cols, rows))));
}

type Photo = { bitmap: ImageBitmap; name: string };
type Notice = { kind: "info" | "error"; text: string } | null;

/** 現在板子上的東西從哪來:照片轉的才有轉換參數可以調 */
type Source = "photo" | "blank" | "album";

/** 復原紀錄的一步:顏色與材質一起記,復原時材質才不會跟著不見 */
type Snapshot = Pick<BeadPattern, "cells" | "materials">;

const snapshotOf = (pattern: BeadPattern): Snapshot => ({
  cells: pattern.cells,
  materials: pattern.materials,
});

const sameSnapshot = (a: Snapshot, b: Snapshot) =>
  a.cells === b.cells && a.materials === b.materials;

/** 空板:迷你板一律方形(拼小零件),其他照選的外形 */
function shapedBlank(cells: number, outline: BoardOutline): BeadPattern {
  const blank = blankPattern(cells, cells);
  return outline === "rect" || cells < 10 ? blank : { ...blank, outline };
}

/** 每燙一次換一個焦痕種子;畫面與下載的圖用同一個 */
const newScorchSeed = () => 1 + Math.floor(Math.random() * 1_000_000);

export default function BeadsPage() {
  const t = getThemeClasses();
  const canShare = useCanShareImages();
  const fileInput = useRef<HTMLInputElement>(null);

  // 照片轉換
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [settings, setSettings] = useState<ConvertSettings>(DEFAULT_SETTINGS);
  const [blankSize, setBlankSize] = useState<BoardSize>("29");
  const [blankOutline, setBlankOutline] = useState<BoardOutline>("rect");
  const samplesCache = useRef<{ key: string; samples: CellSample[] } | null>(null);

  // 板子與編輯
  const [source, setSource] = useState<Source | null>(null);
  const [pattern, setPattern] = useState<BeadPattern | null>(null);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [tool, setTool] = useState<EditTool>("pen");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [material, setMaterial] = useState(0);
  const [symmetry, setSymmetry] = useState<Symmetry>("none");
  // 照著拼:每格顯示色號,可以只亮一色
  const [hints, setHints] = useState(false);
  const [hintOneColor, setHintOneColor] = useState(false);
  const patternRef = useRef<BeadPattern | null>(null);
  const stroke = useRef<{
    base: Snapshot;
    last: number;
    color: number;
    material: number;
    mode: "color" | "material";
  } | null>(null);

  // 收藏
  const [album, setAlbum] = useState<SavedWork[]>([]);
  const [savedAs, setSavedAs] = useState<Pick<SavedWork, "id" | "createdAt"> | null>(null);
  const [saveKind, setSaveKind] = useState<AlbumKind>("work");
  const [name, setName] = useState("");
  /** 有沒有還沒收進收藏冊的改動:離開頁面、換圖、開別的作品前要問 */
  const [dirty, setDirty] = useState(false);

  // 落豆、熨燙、輸出
  const [stage, setStage] = useState<Stage>("pattern");
  const [meltLevel, setMeltLevel] = useState<MeltLevel>("medium");
  const [beadShape, setBeadShape] = useState<BeadShape>("round");
  const [scorch, setScorch] = useState(true);
  const [scorchSeed, setScorchSeed] = useState(0);
  const glow = useDarkBackground();
  const [withBoard, setWithBoard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  // 上面的「拼豆／周邊／豆盒」分頁。周邊與豆盒第一次打開才掛上去,之後切來切去各自的進度都留著
  const [view, setView] = useState<"beads" | "merch" | "sort">("beads");
  const [merchOpened, setMerchOpened] = useState(false);
  const [sortOpened, setSortOpened] = useState(false);
  // 整理豆盒收進來的色盤:接在預設色盤後面,預設色的索引不變
  const [boxStore, setBoxStore] = useState<BoxStore>({ lastCode: 0, boxes: [] });
  const palette = useMemo(() => extendedPalette(DEFAULT_PALETTE, boxStore.boxes), [boxStore.boxes]);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingShare = useRef<{ key: string; file: ExportedImage } | null>(null);

  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);

  useEffect(() => {
    setAlbum(loadAlbum());
    try {
      const raw = localStorage.getItem(BOX_PALETTES_KEY);
      if (raw) setBoxStore(readBoxStore(JSON.parse(raw)));
    } catch {
      // 讀不到就當沒有
    }
  }, []);

  const saveBoxStore = useCallback((next: BoxStore) => {
    setBoxStore(next);
    try {
      localStorage.setItem(BOX_PALETTES_KEY, JSON.stringify(next));
    } catch {
      // 存不了就只留在這次
    }
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
      const fit = next.shape === "aspect" ? "contain" : next.fit;
      const outline = isOutline(next.shape) ? next.shape : undefined;
      const key = [target.name, width, height, cols, rows, fit, next.method].join("|");

      let samples = samplesCache.current?.key === key ? samplesCache.current.samples : null;
      if (!samples) {
        samples = samplePhoto(target.bitmap, cols, rows, fit, next.method, PALETTE_LAB);
        samplesCache.current = { key, samples };
      }
      // 圓形、愛心這類板子:外形以外沒有柱子,那些格子不參與配色
      const mask = boardMask(outline, cols, rows);
      const usable = mask ? samples.map((sample, i) => (mask[i] ? sample : null)) : samples;
      loadPattern(
        {
          cols,
          rows,
          cells: matchPalette(usable, PALETTE_LAB, next.maxColors, next.minCount),
          ...(outline ? { outline } : {}),
        },
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
        setSaveKind("work");
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
    loadPattern(shapedBlank(cells, blankOutline), "blank");
  }

  /** 空板換外形:畫在外形以外的豆子會被清掉 */
  function changeBlankOutline(next: BoardOutline) {
    const current = patternRef.current;
    if (next === blankOutline || !current) return;
    setBlankOutline(next);
    const outlined = { ...current, outline: next === "rect" ? undefined : next };
    const clipped = clipToOutline(outlined, current.cells, current.materials);
    const base = snapshotOf(current);
    const updated = { ...outlined, ...clipped };
    patternRef.current = updated;
    setPattern(updated);
    if (clipped.cells !== current.cells) commitEdit(base, snapshotOf(updated));
  }

  /** 迷你板拼的是小零件,收藏時預設放素材分頁 */
  const defaultKind = (cols: number, rows: number): AlbumKind =>
    Math.max(cols, rows) <= MINI_MAX ? "material" : "work";

  /** 套用內建模板:色位用模板預設的顏色,之後在色位清單換色 */
  function startTemplate(template: BeadTemplate) {
    if (!confirmDiscard("套用模板")) return;
    const next = templatePattern(template, palette);
    setName(template.name);
    setSavedAs(null);
    setSaveKind(defaultKind(next.cols, next.rows));
    setDirty(true);
    loadPattern(next, "album");
    showNotice(`套用了「${template.name}」。在下方色位清單按「換色」就能整個換顏色。`);
  }

  /** 套用自己存的模板:開一張新的(不連到模板本身),色位一樣用色位清單換色 */
  function applyCustomTemplate(work: SavedWork) {
    if (!confirmDiscard("套用模板")) return;
    const next = fromSavedWork(work, palette);
    setName(work.name);
    setSavedAs(null);
    setSaveKind(defaultKind(next.cols, next.rows));
    setDirty(true);
    loadPattern(next, "album");
    showNotice(`套用了「${work.name}」。在下方色位清單按「換色」就能整個換顏色；模板本身不會被改到。`);
  }

  function startBlank(nextSize: BoardSize) {
    if (!confirmDiscard("開新的空板")) return;
    const cells = Number(nextSize);
    setSaveKind(defaultKind(cells, cells));
    setBlankSize(nextSize);
    setName("");
    setSavedAs(null);
    setDirty(false);
    loadPattern(shapedBlank(cells, blankOutline), "blank");
    showNotice("空板準備好了，選個顏色開始拼。");
  }

  // 整頁的貼上:游標不在輸入框裡時按 ⌘V / Ctrl+V 直接換圖
  useEffect(() => {
    function handle(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      if (view !== "beads") return;

      const [file] = readPasteImages(event);
      if (!file) return;
      event.preventDefault();
      void loadFile(file);
    }

    window.addEventListener("paste", handle);
    return () => window.removeEventListener("paste", handle);
  }, [loadFile, view]);

  // 還沒收藏的作品、或燙好了還沒帶走,離開前攔一下
  useEffect(() => {
    if (!dirty && stage !== "ironed") return;
    const handle = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handle);
    return () => window.removeEventListener("beforeunload", handle);
  }, [dirty, stage]);

  // ---- 編輯 ----

  /** 一次完整的改動(一筆畫、一次倒油漆、清一個色、換一個色位)記成一步復原 */
  const commitEdit = useCallback((base: Snapshot, next: Snapshot) => {
    if (sameSnapshot(base, next)) return;
    setPast((previous) => [...previous, base].slice(-HISTORY_LIMIT));
    setFuture([]);
    setDirty(true);
  }, []);

  /** 套用改動;patternRef 同步更新,拖曳時下一次 pointermove 才拿得到最新的 */
  function editTo(current: BeadPattern, wanted: Snapshot) {
    // 板子外形以外沒有柱子:畫出界、油漆桶倒出去的那些豆子不算
    const next = clipToOutline(current, wanted.cells, wanted.materials);
    const updated = { ...current, cells: next.cells, materials: next.materials };
    patternRef.current = updated;
    setPattern((previous) => (previous && !sameSnapshot(previous, next) ? updated : previous));
  }

  const editing = stage === "pattern" && pattern !== null;
  const showHints = hints && stage === "pattern";

  function strokeStart(index: number) {
    const current = patternRef.current;
    if (!current) return;
    const base = snapshotOf(current);

    if (tool === "picker") {
      const picked = current.cells[index];
      if (picked < 0) {
        showNotice("這格是空的，點有豆子的格子。");
        return;
      }
      setColor(picked);
      setMaterial(materialAt(current, index));
      setTool("pen");
      showNotice(`取到「${palette[picked].name}」，換回畫筆。`);
      return;
    }

    if (tool === "fill") {
      const cells = floodFill(current, index, color, symmetry);
      const next = { cells, materials: stampMaterial(current, cells, material) };
      editTo(current, next);
      commitEdit(base, next);
      return;
    }

    if (tool === "material") {
      stroke.current = { base, last: index, color, material, mode: "material" };
      editTo(current, {
        cells: current.cells,
        materials: paintMaterial(current, [index], material, symmetry),
      });
      return;
    }

    const paintColor = tool === "eraser" ? -1 : color;
    const paintMaterialId = tool === "eraser" ? 0 : material;
    const cells = paint(current, [index], paintColor, symmetry);
    stroke.current = { base, last: index, color: paintColor, material: paintMaterialId, mode: "color" };
    editTo(current, { cells, materials: stampMaterial(current, cells, paintMaterialId) });
  }

  function strokeMove(index: number) {
    const active = stroke.current;
    const current = patternRef.current;
    if (!active || !current || index === active.last) return;

    const line = lineBetween(active.last, index, current.cols);
    active.last = index;
    if (active.mode === "material") {
      editTo(current, {
        cells: current.cells,
        materials: paintMaterial(current, line, active.material, symmetry),
      });
    } else {
      const cells = paint(current, line, active.color, symmetry);
      editTo(current, { cells, materials: stampMaterial(current, cells, active.material) });
    }
  }

  function strokeEnd() {
    const active = stroke.current;
    stroke.current = null;
    if (active && patternRef.current) commitEdit(active.base, snapshotOf(patternRef.current));
  }

  const undo = useCallback(() => {
    const previous = past.at(-1);
    const current = patternRef.current;
    if (!previous || !current) return;
    setPast(past.slice(0, -1));
    setFuture((list) => [snapshotOf(current), ...list].slice(0, HISTORY_LIMIT));
    setPattern({ ...current, ...previous });
    setStage("pattern");
    setDirty(true);
  }, [past]);

  const redo = useCallback(() => {
    const next = future[0];
    const current = patternRef.current;
    if (!next || !current) return;
    setFuture(future.slice(1));
    setPast((list) => [...list, snapshotOf(current)].slice(-HISTORY_LIMIT));
    setPattern({ ...current, ...next });
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

  /** 不是一筆一筆畫的整體改動(清色、換色位、全部換材質):直接記一步 */
  function editWhole(next: (current: BeadPattern) => Snapshot): BeadPattern | null {
    const current = patternRef.current;
    if (!current) return null;
    const snapshot = next(current);
    editTo(current, snapshot);
    commitEdit(snapshotOf(current), snapshot);
    setStage("pattern");
    return current;
  }

  function clearColor(index: number) {
    const current = editWhole((p) => ({ cells: replaceColor(p.cells, index, -1), materials: p.materials }));
    if (!current) return;
    const count = current.cells.filter((cell) => cell === index).length;
    showNotice(`清掉「${palette[index].name}」${count} 顆，按「復原」可以拿回來。`);
  }

  /** 色位換色:這個顏色的每一顆都換成另一個顏色,整張圖跟著變 */
  function recolor(from: number, to: number) {
    if (from === to) return;
    const current = editWhole((p) => ({ cells: replaceColor(p.cells, from, to), materials: p.materials }));
    if (!current) return;
    const merged = current.cells.includes(to);
    showNotice(
      merged
        ? `「${palette[from].name}」換成「${palette[to].name}」，跟原本的「${palette[to].name}」併成同一色了。`
        : `「${palette[from].name}」換成「${palette[to].name}」。`
    );
  }

  function applyMaterialToAll(id: number) {
    editWhole((p) => ({ cells: p.cells, materials: fillMaterial(p, id) }));
    showNotice(`整幅都換成「${MATERIALS[id].label}」。`);
  }

  // ---- 收藏冊 ----

  function persist(next: SavedWork[], success: string) {
    const sorted = sortAlbum(next);
    setAlbum(sorted);
    if (storeAlbum(sorted)) showNotice(success);
    else showNotice("瀏覽器不讓存（空間滿了或是無痕模式），請先用「匯出備份」帶走。", "error");
  }

  function saveWork(asNew: boolean): SavedWork | null {
    if (!pattern) return null;
    const target = asNew ? undefined : (savedAs ?? undefined);
    const work = toSavedWork(pattern, palette, name, target, undefined, saveKind);
    setSavedAs({ id: work.id, createdAt: work.createdAt });
    setName(work.name);
    setDirty(false);
    persist(
      [work, ...album.filter((item) => item.id !== work.id)],
      target
        ? `已更新「${work.name}」。`
        : `已收進收藏冊的${ALBUM_KIND_LABELS[saveKind]}：「${work.name}」。`
    );
    return work;
  }

  function openWork(work: SavedWork) {
    if (savedAs?.id !== work.id && !confirmDiscard("打開別的作品")) return;
    const next = fromSavedWork(work, palette);
    setSavedAs({ id: work.id, createdAt: work.createdAt });
    setName(work.name);
    setSaveKind(work.kind);
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
  /** 現在畫面上的燙度:燙好了才算,還沒燙就是 0 */
  const currentMelt = stage === "ironed" ? meltOf(meltLevel) : 0;
  const style = { shape: beadShape, glow };
  const exportKey = JSON.stringify([
    fileTitle,
    pattern?.cells,
    pattern?.materials,
    currentMelt,
    beadShape,
    glow,
    scorchSeed,
    withBoard,
  ]);

  async function buildPng(): Promise<ExportedImage | null> {
    if (!pattern) return null;
    const blob = await renderPatternPng(pattern, palette, {
      cell: EXPORT_CELL,
      melt: currentMelt,
      board: withBoard,
      style,
      scorchSeed,
    });
    return { name: `${sanitizeFileName(fileTitle)}.png`, blob };
  }

  /** SVG:向量檔,放多大都不糊,可以拿去印實體貼紙(不含焦痕、亮粉這類質感) */
  const handleSvg = () =>
    run(async () => {
      if (!pattern) return;
      const svg = patternToSvg(pattern, palette, {
        melt: currentMelt,
        shape: beadShape,
        board: withBoard,
      });
      downloadBlob({
        name: `${sanitizeFileName(fileTitle)}.svg`,
        blob: new Blob([svg], { type: "image/svg+xml" }),
      });
      return "已下載 SVG。";
    });

  /** 圖紙:每格寫色號、附每色顆數,照著用實體豆子拼 */
  const handleSheet = () =>
    run(async () => {
      if (!pattern) return;
      const blob = await renderSheetPng(pattern, palette, name.trim() || "拼豆圖紙");
      downloadBlob({ name: `${sanitizeFileName(`${name.trim() || "拼豆"}-圖紙`)}.png`, blob });
      return "已下載圖紙。";
    });

  function startIroning() {
    setScorchSeed(scorch ? newScorchSeed() : 0);
    setStage("ironing");
  }

  async function run(task: () => Promise<string | void>) {
    setBusy(true);
    try {
      const message = await task();
      if (message) showNotice(message);
    } catch (error) {
      console.error(error);
      showNotice(
        error instanceof CanvasTooLargeError
          ? `${error.message}，圖紙太大畫不出來。`
          : "輸出失敗了，請再試一次。",
        "error"
      );
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
        if (view !== "beads") return;
        const file = Array.from(event.dataTransfer.files).find((item) =>
          item.type.startsWith("image/")
        );
        if (file) void loadFile(file);
      }}
    >
      <section className="mx-auto w-full max-w-[1600px] p-4 md:p-6">
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-[0.08em]">拼豆工坊</h1>
              <Segmented
                label="拼豆、周邊或豆盒"
                value={view}
                onChange={(next) => {
                  setView(next);
                  if (next === "merch") setMerchOpened(true);
                  if (next === "sort") setSortOpened(true);
                }}
                options={[
                  { value: "beads", label: "拼豆" },
                  { value: "merch", label: "周邊" },
                  { value: "sort", label: "豆盒" },
                ]}
                t={t}
              />
            </div>
            <p className={`mt-0.5 text-xs tracking-[0.04em] ${t.muted}`}>
              {view === "beads"
                ? "照片轉成拼豆或在空板上自己拼，看豆子落進板子再燙成一片"
                : view === "merch"
                  ? "把拼豆作品與照片做成小卡套、搖搖吊飾、御守、透卡"
                  : "把打翻的豆盒整理回漂亮的漸層，整理好的豆盒變成一組新色盤"}
              ・全部在你的瀏覽器裡完成，照片不會離開這台電腦
            </p>
          </div>

          {view === "beads" && (
            <p
              aria-live="polite"
              className={`text-xs leading-6 tracking-[0.04em] ${notice?.kind === "error" ? "" : t.muted}`}
            >
              {busy ? "處理中……" : (notice?.text ?? "")}
            </p>
          )}
        </header>

        {merchOpened && (
          <div hidden={view !== "merch"}>
            <MerchWorkshop album={album} palette={palette} active={view === "merch"} t={t} />
          </div>
        )}

        {sortOpened && (
          <div hidden={view !== "sort"}>
            <SortBoxGame
              store={boxStore}
              active={view === "sort"}
              t={t}
              onCollect={(box) => saveBoxStore(addBoxPalette(boxStore, box))}
              onRemove={(id) => {
                const next = { ...boxStore, boxes: boxStore.boxes.filter((item) => item.id !== id) };
                const nextPalette = extendedPalette(DEFAULT_PALETTE, next.boxes);
                // 拿掉一盒後,後面的顏色索引會往前移:目前的圖照色號(找不到就找最接近的)重新對應,
                // 復原紀錄裡的舊索引對不上了,一起清掉
                if (pattern) setPattern(fromSavedWork(toSavedWork(pattern, palette, name), nextPalette));
                setPast([]);
                setFuture([]);
                setColor(DEFAULT_COLOR);
                saveBoxStore(next);
              }}
            />
          </div>
        )}

        <div hidden={view !== "beads"}>
          <ToolPane
            workspace={
              pattern ? (
                <div className="rounded-2xl border border-(--border-light) bg-(--paper-bg-3) p-3">
                  <div
                    className={
                      showHints
                        ? "max-h-[75vh] overflow-auto overscroll-contain"
                        : "flex justify-center"
                    }
                  >
                    <BeadCanvas
                      pattern={pattern}
                      palette={palette}
                      stage={stage}
                      cell={
                        showHints
                          ? Math.max(HINT_MIN_CELL, displayCell(pattern.cols, pattern.rows))
                          : displayCell(pattern.cols, pattern.rows)
                      }
                      hints={showHints ? { focus: hintOneColor ? color : null } : undefined}
                      melt={meltOf(meltLevel)}
                      shape={beadShape}
                      glow={glow}
                      scorchSeed={scorchSeed}
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
                  {stage === "pattern" && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <Toggle checked={hints} onChange={setHints} label="顯示色號（照著拼）" t={t} />
                      {hints && (
                        <Toggle
                          checked={hintOneColor}
                          onChange={(next) => {
                            setHintOneColor(next);
                            // 畫筆的顏色不在圖裡的話,先亮用最多的那一色
                            if (next && counts.length > 0 && !counts.some((item) => item.index === color)) {
                              setColor(counts[0].index);
                            }
                          }}
                          label={`只亮「${palette[color].name}」`}
                          t={t}
                        />
                      )}
                      {hints && (
                        <span className={`text-[11px] leading-5 ${t.muted}`}>
                          色號跟圖紙一樣；板子放大了可以捲動，點下面顏色清單的色名換一色。
                        </span>
                      )}
                    </div>
                  )}
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
                    <button
                      type="button"
                      onClick={() => startBlank("7")}
                      disabled={busy || animating}
                      className={`rounded-xl border px-3 py-1.5 text-xs transition disabled:opacity-40 ${t.secondary}`}
                    >
                      迷你板
                    </button>
                  </div>
                  <div role="group" aria-label="模板" className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[11px] tracking-[0.08em] ${t.muted}`}>模板</span>
                    {TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => startTemplate(template)}
                        disabled={busy || animating}
                        className={`rounded-xl border px-2.5 py-1 text-xs transition disabled:opacity-40 ${t.unselected}`}
                      >
                        {template.name}
                      </button>
                    ))}
                    {album
                      .filter((work) => work.kind === "template")
                      .map((work) => (
                        <button
                          key={work.id}
                          type="button"
                          onClick={() => applyCustomTemplate(work)}
                          disabled={busy || animating}
                          title="自己存的模板"
                          className={`rounded-xl border border-dashed px-2.5 py-1 text-xs transition disabled:opacity-40 ${t.unselected}`}
                        >
                          {work.name}
                        </button>
                      ))}
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
                          { value: "circle", label: "圓形" },
                          { value: "hexagon", label: "六角形" },
                          { value: "heart", label: "愛心形" },
                        ]}
                      />
                    </Field>

                    {settings.shape !== "aspect" && (
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
                      max={DEFAULT_PALETTE.length}
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
                  <>
                    <Field label="板子" t={t}>
                      <Segmented
                        value={blankSize}
                        onChange={changeBlankSize}
                        t={t}
                        label="板子尺寸"
                        options={BLANK_SIZES.map((item) => ({
                          value: item.value,
                          label: item.value === "5" || item.value === "7" ? item.label : `${item.label}×${item.label}`,
                        }))}
                      />
                    </Field>
                    {Number(blankSize) >= 10 && (
                      <Field label="板子外形" hint="外形以外沒有柱子，放不了豆子" t={t}>
                        <Segmented
                          value={blankOutline}
                          onChange={changeBlankOutline}
                          t={t}
                          label="板子外形"
                          options={OUTLINES}
                        />
                      </Field>
                    )}
                  </>
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
                      <ActionButton t={t} onClick={startIroning}>
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

                {pattern && (
                  <div className={`space-y-3 border-t pt-4 ${t.divider}`}>
                    <Field
                      label="燙的程度"
                      hint={MELT_LEVELS.find((item) => item.value === meltLevel)?.hint}
                      t={t}
                    >
                      <Segmented
                        value={meltLevel}
                        onChange={setMeltLevel}
                        t={t}
                        label="燙的程度"
                        options={MELT_LEVELS.map(({ value, label }) => ({ value, label }))}
                      />
                    </Field>
                    <Field
                      label="豆子形狀"
                      hint={beadShape === "square" ? "方形磁磚，做出馬賽克的質感" : "一般的圓豆"}
                      t={t}
                    >
                      <Segmented
                        value={beadShape}
                        onChange={setBeadShape}
                        t={t}
                        label="豆子形狀"
                        options={[
                          { value: "round", label: "圓豆" },
                          { value: "square", label: "方形磁磚" },
                        ]}
                      />
                    </Field>
                    <Toggle
                      checked={scorch}
                      onChange={(on) => {
                        setScorch(on);
                        // 已經燙好的話馬上看得到差別;再燙一次會換一批焦痕
                        setScorchSeed(on ? newScorchSeed() : 0);
                      }}
                      label="燙出一點焦痕（位置與深淺隨機）"
                      t={t}
                    />
                  </div>
                )}

                {pattern && editing && (
                  <EditPanel
                    palette={palette}
                    tool={tool}
                    color={color}
                    material={material}
                    symmetry={symmetry}
                    canUndo={past.length > 0}
                    canRedo={future.length > 0}
                    t={t}
                    onTool={setTool}
                    onColor={(index) => {
                      setColor(index);
                      if (tool === "eraser" || tool === "picker") setTool("pen");
                    }}
                    onMaterial={(id) => {
                      setMaterial(id);
                      if (tool === "eraser" || tool === "picker") setTool("material");
                    }}
                    onMaterialAll={() => applyMaterialToAll(material)}
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
                      <ActionButton tone="secondary" t={t} onClick={() => void handleSvg()} disabled={busy}>
                        下載 SVG（向量，可印貼紙）
                      </ActionButton>
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
                    <Field label="收在哪一頁" t={t}>
                      <Segmented
                        value={saveKind}
                        onChange={(value) => {
                          setSaveKind(value);
                          setDirty(true);
                        }}
                        t={t}
                        label="收藏分頁"
                        options={[
                          { value: "work", label: "作品" },
                          { value: "material", label: "素材（小零件）" },
                          { value: "template", label: "模板（之後只換色重複用）" },
                        ]}
                      />
                    </Field>
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
                    <ActionButton
                      t={t}
                      tone="secondary"
                      onClick={() => void handleSheet()}
                      disabled={busy || animating || total === 0}
                    >
                      下載圖紙（照著拼用）
                    </ActionButton>
                    <p className={`text-[11px] leading-5 ${t.muted}`}>
                      圖紙每格寫色號、附每色顆數，可以照著用實體豆子拼。
                    </p>
                  </div>
                )}

                {pattern && (
                  <ColorList
                    palette={palette}
                    counts={counts}
                    canEdit={editing}
                    t={t}
                    onPick={(index) => {
                      setColor(index);
                      setTool("pen");
                    }}
                    onClear={clearColor}
                    onRecolor={recolor}
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
                  palette={palette}
                  activeId={savedAs?.id ?? null}
                  busy={busy || animating}
                  t={t}
                  onOpen={openWork}
                  onApply={applyCustomTemplate}
                  onDelete={deleteWork}
                  onExport={exportAlbum}
                  onImport={(file) => void importAlbum(file)}
                />
              </>
            }
          />
        </div>
      </section>
    </main>
  );
}
