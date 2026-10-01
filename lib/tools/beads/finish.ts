// 豆子的「質感」參數:材質、燙的程度、形狀。都是渲染參數,
// 材質跟著每一顆豆子走(存在格子資料裡),燙度與形狀是整幅作品一起的。

import type { BeadPattern } from "./pattern";

/**
 * 材質編號存在 BeadPattern.materials 裡;0 是霧面(預設)。
 * 編號一旦存進收藏冊就不能改意思,新增材質只能往後加。
 */
export const MATERIALS = [
  { id: 0, key: "matte", label: "霧面", hint: "一般的豆子" },
  { id: 1, key: "pearl", label: "珍珠光", hint: "表面帶一層柔和的白色光澤" },
  { id: 2, key: "glitter", label: "亮粉", hint: "混著細細的亮片" },
  { id: 3, key: "clear", label: "半透明", hint: "看得到底下的板子" },
  { id: 4, key: "glow", label: "夜光", hint: "網站切到暗色主題時會發光" },
] as const;

export type MaterialId = (typeof MATERIALS)[number]["id"];

export const MATERIAL_MATTE = 0;
export const MATERIAL_CLEAR = 3;
export const MATERIAL_GLOW = 4;

export function isMaterialId(value: unknown): value is MaterialId {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < MATERIALS.length;
}

/** 這一格的材質;沒有材質陣列(舊存檔、照片剛轉好)就是霧面 */
export function materialAt(pattern: BeadPattern, index: number): number {
  return pattern.materials?.[index] ?? MATERIAL_MATTE;
}

/** 材質陣列是不是全部都是霧面(存檔時就不必帶) */
export function allMatte(materials: number[] | undefined): boolean {
  return !materials || materials.every((material) => material === MATERIAL_MATTE);
}

/** 燙的程度:輕燙還是一顆顆圓環、中燙黏在一起、全燙壓成一片 */
export type MeltLevel = "light" | "medium" | "full";

export const MELT_LEVELS: { value: MeltLevel; label: string; melt: number; hint: string }[] = [
  { value: "light", label: "輕燙", melt: 0.25, hint: "豆子仍是一顆顆圓環，洞清楚可見" },
  { value: "medium", label: "中燙", melt: 0.55, hint: "洞縮小，相鄰豆子邊緣黏在一起" },
  { value: "full", label: "全燙", melt: 1, hint: "整片壓平，洞消失，像一塊磁磚" },
];

export function meltOf(level: MeltLevel): number {
  return MELT_LEVELS.find((item) => item.value === level)?.melt ?? 0.55;
}

/** 圓豆或方形磁磚(馬賽克質感);兩者共用同一套參數,只差形狀 */
export type BeadShape = "round" | "square";

/** 整幅作品一起套的畫法 */
export type BeadStyle = {
  shape: BeadShape;
  /** 夜光材質要不要發光(背景是暗的才看得出來) */
  glow: boolean;
};

export const DEFAULT_STYLE: BeadStyle = { shape: "round", glow: false };
