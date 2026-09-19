export type Point = { x: number; y: number };

export type Size = { width: number; height: number };

/** 一律是「原圖像素座標」,不是畫面上的顯示座標 */
export type Rect = Point & Size;

export type MaskRect = Rect & {
  id: string;
  color: string;
};

/**
 * 切割與拼接共用的方向。
 * "y" = 沿著 y 軸下刀 / 沿著 y 軸排列 → 結果是上下關係
 * "x" = 左右關係
 */
export type Axis = "y" | "x";

export type Align = "start" | "center" | "end";

/** 拼接時各張圖在「另一個軸」上要不要統一尺寸 */
export type FitMode = "none" | "min" | "max";

export type OutputFormat = "png" | "jpeg" | "webp";

export type OutputOptions = {
  format: OutputFormat;
  /** 0–1,只有 jpeg / webp 吃這個 */
  quality: number;
  /** 原圖有透明區域而輸出格式不支援時,用這個顏色墊底 */
  flattenColor: string;
};

/** 一張在工作檯上的圖。blob 是唯一真相,url 只給畫面顯示用 */
export type WorkImage = {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  width: number;
  height: number;
};
