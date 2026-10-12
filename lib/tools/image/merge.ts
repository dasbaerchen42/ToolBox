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


// ── 瀑布式與河道式 ────────────────────────────────────────────────────
//
// 瀑布式:每張縮成同樣寬,一欄一欄往下疊(放進目前最短的那一欄)。1 欄就是往下接成長條。
// 河道式:每張縮成同樣高,一排一排往右接,每排再整排縮放到一樣寬。1 排就是往右接成長條。
// 1 欄、1 排時直接走單向接圖(保留「各自原尺寸」與對齊)。

export type FlowOptions = {
  /** 瀑布式是欄數,河道式是排數 */
  lines: number;
  /** 統一成最大或最小那張(各自原尺寸只有 1 欄/1 排時有意義) */
  fit: FitMode;
  align: Align;
  gap: number;
  /** 瀑布式多欄時底部切齊:照順序分欄,再微調各欄寬度讓每欄一樣長(不裁圖) */
  even?: boolean;
};

export function layoutWaterfall(sizes: Size[], options: FlowOptions): MergeLayout {
  const valid = sizes.filter((size) => size.width > 0 && size.height > 0);
  const columns = Math.max(1, Math.round(options.lines));
  if (valid.length === 0) return { canvas: { width: 0, height: 0 }, placements: [] };
  if (columns === 1) return layoutMerge(valid, { axis: "y", align: options.align, fit: options.fit, gap: options.gap });

  // 底部切齊 = 把河道式轉 90 度:河道式每排左右切齊,轉過來就是每欄上下切齊
  if (options.even) {
    const turned = layoutJustified(
      valid.map((size) => ({ width: size.height, height: size.width })),
      { ...options, lines: columns, even: false }
    );
    return {
      canvas: { width: turned.canvas.height, height: turned.canvas.width },
      placements: turned.placements.map((p) => ({ x: p.y, y: p.x, width: p.height, height: p.width })),
    };
  }

  const gap = Math.max(0, Math.round(options.gap));
  const widths = valid.map((size) => size.width);
  const columnWidth = options.fit === "min" ? Math.min(...widths) : Math.max(...widths);
  const heights = new Array<number>(Math.min(columns, valid.length)).fill(0);
  const used = heights.map(() => false);

  const placements = valid.map((size) => {
    const height = Math.max(1, Math.round((size.height * columnWidth) / size.width));
    // 放進目前最短的那一欄,同樣短就放左邊的
    let column = 0;
    for (let i = 1; i < heights.length; i += 1) if (heights[i] < heights[column]) column = i;
    const y = heights[column] + (used[column] ? gap : 0);
    used[column] = true;
    heights[column] = y + height;
    return { x: column * (columnWidth + gap), y, width: columnWidth, height };
  });

  return {
    canvas: { width: heights.length * columnWidth + (heights.length - 1) * gap, height: Math.max(...heights) },
    placements,
  };
}

/** 照順序把寬度分成 k 段,讓最寬那段盡量窄(線性分割,動態規劃) */
export function balancedRows(widths: number[], k: number): number[][] {
  const n = widths.length;
  const rows = Math.max(1, Math.min(k, n));
  const prefix = [0];
  for (const width of widths) prefix.push(prefix[prefix.length - 1] + width);
  const cost: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(n + 1).fill(Infinity));
  const cut: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(n + 1).fill(0));
  cost[0][0] = 0;
  for (let r = 1; r <= rows; r += 1) {
    for (let i = r; i <= n; i += 1) {
      for (let j = r - 1; j < i; j += 1) {
        const value = Math.max(cost[r - 1][j], prefix[i] - prefix[j]);
        if (value < cost[r][i]) {
          cost[r][i] = value;
          cut[r][i] = j;
        }
      }
    }
  }
  const groups: number[][] = [];
  let end = n;
  for (let r = rows; r >= 1; r -= 1) {
    const start = cut[r][end];
    groups.unshift(Array.from({ length: end - start }, (_, i) => start + i));
    end = start;
  }
  return groups;
}

export function layoutJustified(sizes: Size[], options: FlowOptions): MergeLayout {
  const valid = sizes.filter((size) => size.width > 0 && size.height > 0);
  const lines = Math.max(1, Math.round(options.lines));
  if (valid.length === 0) return { canvas: { width: 0, height: 0 }, placements: [] };
  if (lines === 1) return layoutMerge(valid, { axis: "x", align: options.align, fit: options.fit, gap: options.gap });

  const gap = Math.max(0, Math.round(options.gap));
  const heights = valid.map((size) => size.height);
  const base = options.fit === "min" ? Math.min(...heights) : Math.max(...heights);
  const baseWidths = valid.map((size) => (size.width * base) / size.height);
  const groups = balancedRows(baseWidths, lines);
  // 最寬那排的寬度就是畫布寬;其他排整排等比放大到一樣寬(間距不跟著放大)
  const rowWidth = (group: number[]) => group.reduce((sum, i) => sum + baseWidths[i], 0);
  const canvasWidth = Math.round(Math.max(...groups.map((group) => rowWidth(group) + gap * (group.length - 1))));

  const placements: Placement[] = new Array(valid.length);
  let y = 0;
  groups.forEach((group, row) => {
    const scale = (canvasWidth - gap * (group.length - 1)) / rowWidth(group);
    const height = Math.max(1, Math.round(base * scale));
    let x = 0;
    group.forEach((index, k) => {
      // 最後一張吃掉四捨五入的誤差,右邊才會切齊
      const width = k === group.length - 1 ? canvasWidth - x : Math.max(1, Math.round(baseWidths[index] * scale));
      placements[index] = { x, y, width, height };
      x += width + gap;
    });
    y += height + (row < groups.length - 1 ? gap : 0);
  });

  return { canvas: { width: canvasWidth, height: y }, placements };
}
