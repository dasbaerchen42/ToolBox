import type { Align, Axis, FitMode, Rect, Size } from "./types";

export type MergeOptions = {
  axis: Axis;
  align: Align;
  /** 另一個軸上的尺寸要不要統一:none 保持原樣,min 縮到最小,max 放到最大 */
  fit: FitMode;
  /** 圖與圖之間的間距(px) */
  gap: number;
};

/**
 * 一張圖在畫布上的落點。
 *
 * 它本身就是目的地矩形(所以既有只看 x/y/width/height 的程式碼不用改);
 * source 只有「裁切填滿」時才有——那種模式下目的地是整個格子,
 * 要從原圖裁一塊出來填滿它,不然照片會被拉變形。
 */
export type Placement = Rect & { source?: Rect };

export type MergeLayout = {
  canvas: Size;
  /** 每一張圖在畫布上的位置與(可能被縮放過的)尺寸,順序同輸入 */
  placements: Placement[];
};

/**
 * 算出拼接後的畫布尺寸與每張圖的落點。
 *
 * 只做算術、不碰 canvas,所以可以單獨測。
 * axis = "y" 時沿著 y 軸往下堆,寬度是「另一個軸」;axis = "x" 反之。
 */
export function layoutMerge(sizes: Size[], options: MergeOptions): MergeLayout {
  const valid = sizes.filter((size) => size.width > 0 && size.height > 0);
  if (valid.length === 0) return { canvas: { width: 0, height: 0 }, placements: [] };

  const gap = Math.max(0, Math.round(options.gap));
  const vertical = options.axis === "y";

  // 先決定每張圖最後的尺寸:fit 只作用在「另一個軸」,且等比縮放
  const crossOf = (size: Size) => (vertical ? size.width : size.height);
  const target = resolveCrossSize(valid.map(crossOf), options.fit);

  const scaled = valid.map((size) => {
    const cross = crossOf(size);
    const ratio = target === null || cross === 0 ? 1 : target / cross;
    return {
      width: Math.max(1, Math.round(size.width * ratio)),
      height: Math.max(1, Math.round(size.height * ratio)),
    };
  });

  const crossMax = Math.max(...scaled.map(crossOf));
  const mainTotal =
    scaled.reduce((sum, size) => sum + (vertical ? size.height : size.width), 0) +
    gap * (scaled.length - 1);

  const canvas: Size = vertical
    ? { width: crossMax, height: mainTotal }
    : { width: mainTotal, height: crossMax };

  const placements: Rect[] = [];
  let cursor = 0;

  for (const size of scaled) {
    const offset = alignOffset(crossOf(size), crossMax, options.align);

    placements.push(
      vertical
        ? { x: offset, y: cursor, width: size.width, height: size.height }
        : { x: cursor, y: offset, width: size.width, height: size.height }
    );

    cursor += (vertical ? size.height : size.width) + gap;
  }

  return { canvas, placements };
}

/** null 代表不統一,各自保留原尺寸 */
function resolveCrossSize(values: number[], fit: FitMode): number | null {
  if (fit === "none") return null;
  return fit === "min" ? Math.min(...values) : Math.max(...values);
}

function alignOffset(size: number, total: number, align: Align): number {
  if (align === "start") return 0;
  if (align === "end") return total - size;
  return Math.round((total - size) / 2);
}


// ── 棋盤拼貼 ──────────────────────────────────────────────────────────
//
// 跟單軸拼接反過來:單軸是格子跟著圖走,棋盤是格子先固定、圖去配合格子。
// 不這樣做就排不出整齊的方格——每張照片尺寸都不一樣。

export type GridFit =
  /** 裁切填滿:塞滿格子,超出的部分裁掉(拼貼想要的樣子,但會裁到照片邊緣) */
  | "cover"
  /** 完整留白:整張塞進格子,空出來的地方留背景(不裁任何東西) */
  | "contain";

export type GridOptions = {
  /** 每一列幾格 */
  columns: number;
  /** 一格的寬度(px),決定輸出解析度 */
  cellWidth: number;
  /** 一格的長寬比 */
  ratio: { w: number; h: number };
  fit: GridFit;
  gap: number;
  /** 最後一列不滿時靠左還是置中 */
  lastRow: Align;
};

/**
 * 裁切填滿時要從原圖裁哪一塊:等比放到剛好蓋住格子,再從中間取。
 * 跟 CSS 的 object-fit: cover 同一個算法,所以預覽跟輸出會一致。
 */
export function coverRect(image: Size, cell: Size): Rect {
  if (image.width <= 0 || image.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const scale = Math.max(cell.width / image.width, cell.height / image.height);
  const width = Math.min(image.width, Math.round(cell.width / scale));
  const height = Math.min(image.height, Math.round(cell.height / scale));

  return {
    x: Math.round((image.width - width) / 2),
    y: Math.round((image.height - height) / 2),
    width,
    height,
  };
}

/** 完整留白時圖在格子裡的位置:等比縮到放得進去,然後置中 */
function containRect(image: Size, cell: Size): Rect {
  const scale = Math.min(cell.width / image.width, cell.height / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  return {
    x: Math.round((cell.width - width) / 2),
    y: Math.round((cell.height - height) / 2),
    width,
    height,
  };
}

export function layoutGrid(sizes: Size[], options: GridOptions): MergeLayout {
  const valid = sizes.filter((size) => size.width > 0 && size.height > 0);
  if (valid.length === 0) return { canvas: { width: 0, height: 0 }, placements: [] };

  const columns = Math.max(1, Math.round(options.columns));
  const gap = Math.max(0, Math.round(options.gap));
  const cell: Size = {
    width: Math.max(1, Math.round(options.cellWidth)),
    height: Math.max(
      1,
      Math.round((options.cellWidth * options.ratio.h) / options.ratio.w)
    ),
  };

  const rows = Math.ceil(valid.length / columns);
  const canvas: Size = {
    width: columns * cell.width + (columns - 1) * gap,
    height: rows * cell.height + (rows - 1) * gap,
  };

  // 最後一列不滿時的水平位移(靠左就是 0)
  const remainder = valid.length % columns;
  const lastRowShift =
    remainder === 0 || options.lastRow === "start"
      ? 0
      : options.lastRow === "end"
        ? (columns - remainder) * (cell.width + gap)
        : Math.round(((columns - remainder) * (cell.width + gap)) / 2);

  const placements = valid.map((size, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const onLastRow = row === rows - 1;

    const cellX = column * (cell.width + gap) + (onLastRow ? lastRowShift : 0);
    const cellY = row * (cell.height + gap);

    if (options.fit === "cover") {
      return {
        x: cellX,
        y: cellY,
        width: cell.width,
        height: cell.height,
        source: coverRect(size, cell),
      };
    }

    const inner = containRect(size, cell);
    return {
      x: cellX + inner.x,
      y: cellY + inner.y,
      width: inner.width,
      height: inner.height,
    };
  });

  return { canvas, placements };
}

/** 給 UI 預設用:格子寬度取最大那張,這樣沒有圖會被放大到糊掉 */
export function suggestCellWidth(sizes: Size[]): number {
  const widths = sizes.map((size) => size.width).filter((width) => width > 0);
  return widths.length > 0 ? Math.max(...widths) : 1000;
}
