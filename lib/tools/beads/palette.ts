import { hexToRgb, rgbToOklab, type Lab } from "./color";

export type BeadColor = {
  /** 色號:自訂的編號,不對應任何實體品牌(規格裡還沒定) */
  code: string;
  name: string;
  hex: string;
};

/**
 * 預設豆子色盤,36 色。
 *
 * 挑色的原則:黑白灰一整排、膚色與棕色多給幾階(照片裡最常出現、也最容易偏),
 * 其餘每個色相留亮、中、暗。數量刻意不多——拼豆的味道就是色數少。
 */
export const DEFAULT_PALETTE: BeadColor[] = [
  { code: "P01", name: "白", hex: "#f7f7f2" },
  { code: "P02", name: "奶油", hex: "#f3e6c8" },
  { code: "P03", name: "淺灰", hex: "#c9cbcc" },
  { code: "P04", name: "灰", hex: "#8d9094" },
  { code: "P05", name: "深灰", hex: "#4e5257" },
  { code: "P06", name: "黑", hex: "#1e1f22" },
  { code: "P07", name: "淺膚", hex: "#f6d3b8" },
  { code: "P08", name: "蜜桃膚", hex: "#edb896" },
  { code: "P09", name: "小麥", hex: "#d49a6a" },
  { code: "P10", name: "淺棕", hex: "#b07a4f" },
  { code: "P11", name: "棕", hex: "#7c4e2e" },
  { code: "P12", name: "深棕", hex: "#4a2e1e" },
  { code: "P13", name: "米色", hex: "#d8c3a5" },
  { code: "P14", name: "紅", hex: "#d2342e" },
  { code: "P15", name: "酒紅", hex: "#8e1f25" },
  { code: "P16", name: "珊瑚", hex: "#f07a63" },
  { code: "P17", name: "淺粉", hex: "#f8c9d6" },
  { code: "P18", name: "粉", hex: "#f29bb4" },
  { code: "P19", name: "桃紅", hex: "#e0457b" },
  { code: "P20", name: "橘", hex: "#f28a2e" },
  { code: "P21", name: "杏", hex: "#f7b267" },
  { code: "P22", name: "黃", hex: "#f6d23a" },
  { code: "P23", name: "淺黃", hex: "#f9e79a" },
  { code: "P24", name: "芥末", hex: "#c9a227" },
  { code: "P25", name: "萊姆", hex: "#a7d04b" },
  { code: "P26", name: "綠", hex: "#3fa34d" },
  { code: "P27", name: "深綠", hex: "#1f6b3a" },
  { code: "P28", name: "薄荷", hex: "#9ed9c0" },
  { code: "P29", name: "湖綠", hex: "#2a9d8f" },
  { code: "P30", name: "淺藍", hex: "#9ccbea" },
  { code: "P31", name: "天藍", hex: "#4fa3de" },
  { code: "P32", name: "藍", hex: "#2d5fb8" },
  { code: "P33", name: "深藍", hex: "#1f2f5c" },
  { code: "P34", name: "薰衣草", hex: "#c3b1e1" },
  { code: "P35", name: "紫", hex: "#7e57c2" },
  { code: "P36", name: "深紫", hex: "#5b2c6f" },
];

/** 色盤的 OKLab 值只算一次;同一份色盤陣列重複呼叫拿到的是同一份快取 */
const labCache = new WeakMap<BeadColor[], Lab[]>();

export function paletteLab(palette: BeadColor[]): Lab[] {
  let labs = labCache.get(palette);
  if (!labs) {
    labs = palette.map((color) => rgbToOklab(hexToRgb(color.hex)));
    labCache.set(palette, labs);
  }
  return labs;
}
