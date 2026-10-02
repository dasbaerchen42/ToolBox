import {
  defaultInterfaceSettings,
  interfaceLayout,
  type InterfaceKind,
  type PlayerSettings,
  type SocialSettings,
  type StorySettings,
  type VideoSettings,
} from "./interface";

// 沖印所的設定:把照片「印」成某種質感,或裝進某種殼。
// 尺寸類的參數都以「短邊的 1%」為單位(下面註解寫的 u),
// 大圖小圖、預覽與輸出看起來才一樣。

export type PrintKind =
  | "halftone"
  | "riso"
  | "photocopy"
  | "polaroid"
  | "digicam"
  | "stamp"
  | "postcard"
  | "ticket"
  | "film"
  | "poster"
  | InterfaceKind;

export const INTERFACE_KINDS: readonly PrintKind[] = ["player", "video", "social", "story"];

export function isInterfaceKind(kind: PrintKind): kind is InterfaceKind {
  return INTERFACE_KINDS.includes(kind);
}

export const PRINT_GROUPS: {
  key: string;
  label: string;
  kinds: { kind: PrintKind; label: string; hint: string }[];
}[] = [
  {
    key: "print",
    label: "印刷質感",
    kinds: [
      { kind: "halftone", label: "網點印刷", hint: "CMYK 四色網點，點的大小隨明暗變化，像舊報紙" },
      { kind: "riso", label: "孔版印刷", hint: "只用 2–3 個特色色，各色刻意套色偏移" },
      { kind: "photocopy", label: "影印機", hint: "高反差、碳粉痕、紙張灰底" },
    ],
  },
  {
    key: "camera",
    label: "相機",
    kinds: [
      { kind: "polaroid", label: "拍立得", hint: "下方留白邊、偏色與暗角；預覽可以看它慢慢顯影" },
      { kind: "digicam", label: "古早數位相機", hint: "低解析、閃光過曝、右下角橘色日期" },
    ],
  },
  {
    key: "frame",
    label: "邊框",
    kinds: [
      { kind: "stamp", label: "郵票", hint: "齒孔邊、郵戳，日期與地名自訂" },
      { kind: "postcard", label: "明信片", hint: "照片放左邊，右邊是地址線與郵票框" },
      { kind: "ticket", label: "票券", hint: "撕線與票根" },
      { kind: "film", label: "底片條", hint: "齒孔與片號" },
    ],
  },
  {
    key: "poster",
    label: "海報",
    kinds: [
      {
        kind: "poster",
        label: "單色高反差海報",
        hint: "主題色＋黑白、斜切版面、標語字；換主題色時色塊、網點、字的底色一起換",
      },
    ],
  },
  {
    key: "ui",
    label: "介面",
    kinds: [
      { kind: "player", label: "音樂播放器", hint: "照片當封面，歌名、歌手、進度條與播放鍵都能改；底色可以用照片暈開的顏色" },
      { kind: "video", label: "影片播放器", hint: "16:9 畫面加控制列與進度條，可以接標題資訊區、切換暫停中" },
      { kind: "social", label: "社群貼文", hint: "頭像、名字、照片、愛心留言列、讚數與內文；方形或 4:5 直式" },
      { kind: "story", label: "限時動態", hint: "9:16 全螢幕，上面分段進度條與名字，下面回覆框" },
    ],
  },
];

/** 海報主題色的預設選項;也可以自選 */
export const THEME_COLORS = [
  { label: "紅", hex: "#d7262e" },
  { label: "藍", hex: "#1f5fbf" },
  { label: "黃", hex: "#f2c230" },
  { label: "綠", hex: "#2e9e5b" },
];

/** 海報的照片怎麼上色:平塗最清楚,網點、線條比較有印刷味 */
export type PosterTexture = "solid" | "dots" | "lines";
/** 海報的標語字樣式 */
export type PosterTextStyle = "tiles" | "ribbon" | "circles" | "badge" | "label";

export const POSTER_TEXT_STYLES: { value: PosterTextStyle; label: string; hint: string }[] = [
  { value: "tiles", label: "方格剪貼", hint: "每個字一塊自己的底色、大小與角度，像從報紙剪下來拼的" },
  { value: "ribbon", label: "彩帶", hint: "一條斜斜的長彩帶，兩端剪成燕尾" },
  { value: "circles", label: "圓點字", hint: "每個字一顆圓，顏色輪流換" },
  { value: "badge", label: "圓章", hint: "一顆大圓章，字排在中間，外圈虛線" },
  { value: "label", label: "標籤條", hint: "黑底白字的長方標籤，一行一條，交錯疊著" },
];

export type PrintSettings = {
  kind: PrintKind;
  /** 碳粉痕、剪貼字擺法這類隨機元素的種子;按「換一組」就換 */
  seed: number;
  /** 顆粒噪點:可以疊在任何效果上 */
  grain: { enabled: boolean; amount: number; size: number };
  halftone: { dot: number; paper: string };
  riso: { inks: string[]; count: 2 | 3; offset: number; grain: number };
  photocopy: { contrast: number; toner: number };
  polaroid: { warmth: number; fade: number; vignette: number };
  digicam: { flash: number; lowRes: boolean; showDate: boolean; date: string };
  stamp: { postmark: boolean; date: string; place: string; value: string };
  postcard: { heading: string };
  ticket: { title: string; number: string; color: string };
  film: { label: string; number: number };
  poster: {
    color: string;
    /** 2:主題色＋黑;3:白＋主題色＋黑;4:再多一階淡主題色,人像的臉比較清楚 */
    levels: 2 | 3 | 4;
    texture: PosterTexture;
    /** 網點、線條的粗細(u) */
    dotSize: number;
    balance: number;
    background: "rays" | "stripes" | "plain";
    tilt: number;
    text: string;
    textStyle: PosterTextStyle;
  };
  player: PlayerSettings;
  video: VideoSettings;
  social: SocialSettings;
  story: StorySettings;
};

function today(): { y: number; m: number; d: number } {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 古早數位相機的日期印字:'26 10 01 */
export function digicamDate(date = today()): string {
  return `'${pad(date.y % 100)} ${pad(date.m)} ${pad(date.d)}`;
}

/** 郵戳的日期:2026.10.01 */
export function postmarkDate(date = today()): string {
  return `${date.y}.${pad(date.m)}.${pad(date.d)}`;
}

export function defaultPrintSettings(): PrintSettings {
  return {
    kind: "halftone",
    seed: 1,
    grain: { enabled: false, amount: 0.25, size: 0.15 },
    halftone: { dot: 1.2, paper: "#f3eee1" },
    riso: { inks: ["#ff48b0", "#0078bf", "#ffe800"], count: 2, offset: 0.6, grain: 0.25 },
    photocopy: { contrast: 0.6, toner: 0.5 },
    polaroid: { warmth: 0.4, fade: 0.35, vignette: 0.5 },
    digicam: { flash: 0.55, lowRes: true, showDate: true, date: digicamDate() },
    stamp: { postmark: true, date: postmarkDate(), place: "台北", value: "12" },
    postcard: { heading: "POST CARD" },
    ticket: { title: "ADMIT ONE", number: "No. 000123", color: "#f3e6c8" },
    film: { label: "TOOLBOX 400", number: 12 },
    poster: {
      color: THEME_COLORS[0].hex,
      levels: 4,
      texture: "solid",
      dotSize: 1.2,
      balance: 0.5,
      background: "rays",
      tilt: -6,
      text: "今天也好好過",
      textStyle: "tiles",
    },
    ...defaultInterfaceSettings(),
  };
}

export type Size = { width: number; height: number };

/**
 * 輸出圖的尺寸。印刷質感、相機、海報跟原圖一樣大;邊框類會在外面加一圈。
 * 每種邊框的比例集中在這裡,畫的時候照這個切版面。
 */
export function printLayout(
  size: Size,
  kind: PrintKind,
  settings?: Pick<PrintSettings, "player" | "video" | "social" | "story">
): {
  canvas: Size;
  /** 照片在輸出圖裡的位置 */
  photo: { x: number; y: number; width: number; height: number };
} {
  const { width: w, height: h } = size;
  const u = Math.min(w, h) / 100;
  const same = { canvas: { width: w, height: h }, photo: { x: 0, y: 0, width: w, height: h } };
  if (isInterfaceKind(kind)) return interfaceLayout(size, kind, settings ?? defaultInterfaceSettings());

  switch (kind) {
    case "polaroid": {
      const side = Math.round(6 * u);
      const bottom = Math.round(24 * u);
      return {
        canvas: { width: w + side * 2, height: h + side + bottom },
        photo: { x: side, y: side, width: w, height: h },
      };
    }
    case "stamp": {
      const m = Math.round(7 * u);
      return {
        canvas: { width: w + m * 2, height: h + m * 2 },
        photo: { x: m, y: m, width: w, height: h },
      };
    }
    case "postcard": {
      // 明信片 3:2,照片在左邊約一半的地方
      const height = h;
      const width = Math.round(h * 1.5);
      const p = Math.round(5 * u);
      return {
        canvas: { width, height },
        photo: { x: p, y: p, width: Math.round(width * 0.47) - p, height: height - p * 2 },
      };
    }
    case "ticket": {
      const stub = Math.round(h * 0.42);
      const p = Math.round(4 * u);
      return {
        canvas: { width: w + stub, height: h },
        photo: { x: p, y: p, width: w - p * 2, height: h - p * 2 },
      };
    }
    case "film": {
      const band = Math.round(h * 0.16);
      const side = Math.round(h * 0.05);
      return {
        canvas: { width: w + side * 2, height: h + band * 2 },
        photo: { x: side, y: band, width: w, height: h },
      };
    }
    default:
      return same;
  }
}
