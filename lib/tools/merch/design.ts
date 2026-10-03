// 周邊工坊的設計資料:四種周邊各自的設定,與貼紙的擺法。
//
// 每種周邊都有預設的樣子(用內建模板當貼紙),沒有照片也能直接做。
// 貼紙只記三件事:用哪一份圖(art)、位置/大小/旋轉、(拼豆的話)燙法與材質跟著格子資料走。
// 同一顆星星可以同時當吊飾裡的小亮片,也能放大當卡套主角。

import { defaultPlacement, type Placement } from "./acrylic-shape";

export type MerchKind = "card" | "charm" | "omamori" | "acrylic";

export const MERCH_KINDS: { kind: MerchKind; label: string; hint: string }[] = [
  { kind: "card", label: "小卡套", hint: "照片＋框、蕾絲邊、貼紙、雷射膜；移動滑鼠或傾斜手機，雷射彩虹會流動" },
  { kind: "charm", label: "搖搖吊飾", hint: "後層照片或底色，前層透明空間裝拼豆小零件；拖動或晃手機，零件照真實形狀碰撞翻滾" },
  { kind: "omamori", label: "壓克力御守", hint: "御守袋印在一片透明壓克力上，外緣留一圈透明邊，袋口打孔穿繩結；點一下翻面" },
  { kind: "acrylic", label: "透卡／打卡棒", hint: "壓克力上印你的圖（拼豆或去背圖），先攤平排版，再「放到照片上」和實景合成；拖板子移動、拖四個角傾斜" },
];

/** 一張貼紙放在設計上的位置:x、y 是中心點(0–1,相對設計區),size 是寬度佔設計區寬的比例 */
export type Placed = {
  id: string;
  artId: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  /** 換色:原本的色號 → 換成的色號。拼豆素材以色位存,放進周邊後一樣能換色 */
  recolor?: Recolor;
};

export type Recolor = Record<string, string>;

/**
 * 一張貼紙實際要畫的那份圖的鑰匙:沒換色就是 artId;換了色就在後面接上換法,
 * 同一份素材換成不同顏色會是不同的圖(各自快取)。
 */
export function artKey(item: { artId: string; recolor?: Recolor }): string {
  const pairs = Object.entries(item.recolor ?? {})
    .filter(([from, to]) => from !== to)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return pairs.length === 0 ? item.artId : `${item.artId}#${pairs.map(([from, to]) => `${from}>${to}`).join(",")}`;
}

/** artKey 拆回 artId 與換法 */
export function parseArtKey(key: string): { artId: string; recolor: Recolor } {
  const cut = key.indexOf("#");
  if (cut < 0) return { artId: key, recolor: {} };
  const recolor: Recolor = {};
  for (const pair of key.slice(cut + 1).split(",")) {
    const [from, to] = pair.split(">");
    if (from && to) recolor[from] = to;
  }
  return { artId: key.slice(0, cut), recolor };
}

export type CardDesign = {
  background: "photo" | "mosaic" | "color";
  color: string;
  /** 馬賽克底的兩個顏色 */
  mosaic: [string, string];
  /** motif:用一份拼豆素材(自己拼的也行)沿著邊排一圈當框 */
  frame: "none" | "lace" | "beads" | "motif";
  frameColors: [string, string];
  /** 框的圖樣(artKey);frame 是 motif 時用 */
  frameArt: string;
  laser: boolean;
  gloss: boolean;
  stickers: Placed[];
};

export type CharmDesign = {
  shape: "rounded" | "circle";
  background: "photo" | "color";
  color: string;
  ring: string;
  /** 吊飾裡的零件:哪一份圖、多大(一顆豆子幾個設計單位) */
  pieces: { id: string; artId: string; cell: number; recolor?: Recolor }[];
};

export type OmamoriDesign = {
  fabric: string;
  pattern: "plain" | "asanoha" | "seigaiha" | "dots";
  trim: string;
  thread: string;
  knot: string;
  front: string;
  back: string;
  /** 掛在繩結旁的拼豆小鈴鐺(用哪一份圖);null = 不掛 */
  bell: string | null;
  /** 壓克力御守:質感(本體的透明度、反光、厚度)與邊線,0–1 */
  clarity: number;
  edge: number;
};

/** 透卡的印刷框:相框(四邊一樣寬)、拍立得(下面比較寬)、細線框;都是通用樣式 */
export type AcrylicFrame = "none" | "photo" | "polaroid" | "line";

/**
 * 虛擬壓克力:透卡(卡片形)或打卡棒(沿著圖案外緣切 + 卡榫 + 透明棒子)。
 * 編輯時攤平,放到照片上時用 place 擺位置、大小、旋轉與傾斜。
 */
export type AcrylicDesign = {
  mode: "card" | "stick";
  frame: AcrylicFrame;
  frameColor: string;
  /** 印在框下緣的一行字(相框與拍立得) */
  caption: string;
  /** 透卡右上角打孔,掛鍊子與鑰匙圈 */
  keyring: boolean;
  /** 打卡棒:圖案外緣留多寬的透明邊(板子單位) */
  margin: number;
  /** 壓克力質感:0 幾乎看不到板子,1 反光、厚度都很明顯 */
  clarity: number;
  /** 邊線清晰度:0 沒有亮邊(像後製擦掉),1 邊緣發光 */
  edge: number;
  stickers: Placed[];
  place: Placement;
};

export type MerchDesigns = {
  card: CardDesign;
  charm: CharmDesign;
  omamori: OmamoriDesign;
  acrylic: AcrylicDesign;
};

/** 每種周邊的設計尺寸(設計單位,輸出時再乘倍率) */
export const DESIGN_SIZE: Record<MerchKind, { width: number; height: number }> = {
  // 小卡 55×85mm
  card: { width: 550, height: 850 },
  charm: { width: 640, height: 820 },
  omamori: { width: 480, height: 820 },
  acrylic: { width: 900, height: 1200 },
};

/** 搖搖吊飾零件預設的大小:一顆豆子幾個設計單位 */
export const CHARM_CELL = 16;

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function defaultDesigns(): MerchDesigns {
  return {
    card: {
      background: "mosaic",
      color: "#f6d6de",
      mosaic: ["#f2a0a1", "#fdf2f2"],
      frame: "lace",
      frameColors: ["#e95295", "#fbca4d"],
      frameArt: "tpl:heart-5",
      laser: true,
      gloss: true,
      stickers: [
        { id: newId("sticker"), artId: "tpl:cat-9", x: 0.5, y: 0.46, size: 0.62, rotation: -4 },
        { id: newId("sticker"), artId: "tpl:heart-5", x: 0.8, y: 0.8, size: 0.24, rotation: 12 },
      ],
    },
    charm: {
      shape: "rounded",
      background: "color",
      color: "#bbc8e6",
      ring: "#d8b45a",
      pieces: ["tpl:star-7", "tpl:heart-5", "tpl:star-7", "tpl:flower-7", "tpl:heart-5"].map((artId) => ({
        id: newId("piece"),
        artId,
        cell: CHARM_CELL,
      })),
    },
    omamori: {
      fabric: "#a22041",
      pattern: "asanoha",
      trim: "#e6b422",
      thread: "#f3d27a",
      knot: "#f2f0e6",
      front: "準時下班守",
      back: "願一切順利",
      bell: null,
      clarity: 0.6,
      edge: 0.6,
    },
    acrylic: {
      mode: "stick",
      frame: "photo",
      frameColor: "#ffffff",
      caption: "",
      keyring: true,
      margin: 22,
      clarity: 0.6,
      edge: 0.7,
      stickers: [
        { id: newId("sticker"), artId: "tpl:cat-9", x: 0.5, y: 0.5, size: 0.62, rotation: 0 },
        { id: newId("sticker"), artId: "tpl:heart-5", x: 0.8, y: 0.22, size: 0.2, rotation: 14 },
      ],
      place: defaultPlacement(),
    },
  };
}

/** 把一張貼紙加進設計:預設放在中間偏一點,錯開已經放的,不會全部疊在同一點 */
export function placeSticker(existing: Placed[], artId: string, size = 0.32): Placed {
  const k = existing.length;
  const angle = k * 2.4;
  const spread = k === 0 ? 0 : 0.12 + 0.03 * Math.min(k, 6);
  return {
    id: newId("sticker"),
    artId,
    x: 0.5 + Math.cos(angle) * spread,
    y: 0.5 + Math.sin(angle) * spread,
    size,
    rotation: k === 0 ? 0 : ((k * 37) % 30) - 15,
  };
}

/** 拖貼紙時夾在設計區內(中心點最多出界一點點,讓貼紙可以貼到邊上) */
export function clampPlacement(x: number, y: number): { x: number; y: number } {
  return { x: Math.min(1.05, Math.max(-0.05, x)), y: Math.min(1.05, Math.max(-0.05, y)) };
}
