import { hexToRgb, rgbToOklab, type Lab } from "./color";

export type BeadColor = {
  /** 色號:自訂的編號,不對應任何實體品牌(規格裡還沒定) */
  code: string;
  /** 和色名 */
  name: string;
  /** 讀音:同名的色(兩個「葡萄色」)靠這個分 */
  reading: string;
  hex: string;
};

/**
 * 預設豆子色盤:從和色大辞典的 465 色裡挑 76 色。
 *
 * 挑法:在 OKLab 裡每次挑離已選顏色最遠的那一色,挑到 72 色——
 * 再往上加,最難配到的那一色也只是小幅變近。之後再補 4 色:
 * 和色本身偏暗、偏濁,中間調的綠、淡黃、天藍、小麥膚色這幾個照片裡常見的顏色
 * 配得太遠,各補一個最接近的。
 * 色碼照原表抄錄。無彩色(與很暗的色)依明暗排在前面,其餘依色相排。
 */
export const DEFAULT_PALETTE: BeadColor[] = [
  { code: "W01", name: "白", reading: "しろ", hex: "#ffffff" },
  { code: "W02", name: "桜鼠", reading: "さくらねず", hex: "#e9dfe5" },
  { code: "W03", name: "薄墨色", reading: "うすずみいろ", hex: "#a3a3a2" },
  { code: "W04", name: "煤色", reading: "すすいろ", hex: "#887f7a" },
  { code: "W05", name: "紫鼠", reading: "むらさきねず", hex: "#71686c" },
  { code: "W06", name: "革色", reading: "かわいろ", hex: "#475950" },
  { code: "W07", name: "紫黒", reading: "しこく", hex: "#2e2930" },
  { code: "W08", name: "濡羽色", reading: "ぬればいろ", hex: "#000b00" },
  { code: "W09", name: "漆黒", reading: "しっこく", hex: "#0d0015" },
  { code: "W10", name: "今様色", reading: "いまよういろ", hex: "#d0576b" },
  { code: "W11", name: "真紅", reading: "しんく", hex: "#a22041" },
  { code: "W12", name: "紅梅色", reading: "こうばいいろ", hex: "#f2a0a1" },
  { code: "W13", name: "退紅", reading: "あらぞめ", hex: "#d69090" },
  { code: "W14", name: "蘇芳香", reading: "すおうこう", hex: "#a86965" },
  { code: "W15", name: "猩々緋", reading: "しょうじょうひ", hex: "#e2041b" },
  { code: "W16", name: "臙脂", reading: "えんじ", hex: "#b94047" },
  { code: "W17", name: "小豆色", reading: "あずきいろ", hex: "#96514d" },
  { code: "W18", name: "黄丹", reading: "おうに", hex: "#ee7948" },
  { code: "W19", name: "赤橙", reading: "あかだいだい", hex: "#ea5506" },
  { code: "W20", name: "代赭", reading: "たいしゃ", hex: "#bb5520" },
  { code: "W21", name: "焦茶", reading: "こげちゃ", hex: "#6f4b3e" },
  { code: "W22", name: "赤銅色", reading: "しゃくどういろ", hex: "#752100" },
  { code: "W23", name: "肉色", reading: "にくいろ", hex: "#f1bf99" },
  { code: "W24", name: "丁子茶", reading: "ちょうじちゃ", hex: "#b4866b" },
  { code: "W25", name: "褐色", reading: "かっしょく", hex: "#8a3b00" },
  { code: "W26", name: "黒茶", reading: "くろちゃ", hex: "#583822" },
  { code: "W27", name: "金茶", reading: "きんちゃ", hex: "#f39800" },
  { code: "W28", name: "伽羅色", reading: "きゃらいろ", hex: "#d8a373" },
  { code: "W29", name: "支子色", reading: "くちなしいろ", hex: "#fbca4d" },
  { code: "W30", name: "芥子色", reading: "からしいろ", hex: "#d0af4c" },
  { code: "W31", name: "路考茶", reading: "ろこうちゃ", hex: "#8c7042" },
  { code: "W32", name: "憲法黒茶", reading: "けんぽうくろちゃ", hex: "#241a08" },
  { code: "W33", name: "中黄", reading: "ちゅうき", hex: "#ffea00" },
  { code: "W34", name: "淡黄", reading: "たんこう", hex: "#f8e58c" },
  { code: "W35", name: "菜種油色", reading: "なたねゆいろ", hex: "#a69425" },
  { code: "W36", name: "璃寛茶", reading: "りかんちゃ", hex: "#6a5d21" },
  { code: "W37", name: "黄緑", reading: "きみどり", hex: "#b8d200" },
  { code: "W38", name: "柳茶", reading: "やなぎちゃ", hex: "#a1a46d" },
  { code: "W39", name: "夏虫色", reading: "なつむしいろ", hex: "#cee4ae" },
  { code: "W40", name: "鶸萌黄", reading: "ひわもえぎ", hex: "#82ae46" },
  { code: "W41", name: "老竹色", reading: "おいたけいろ", hex: "#769164" },
  { code: "W42", name: "苔色", reading: "こけいろ", hex: "#69821b" },
  { code: "W43", name: "浅緑", reading: "あさみどり", hex: "#88cb7f" },
  { code: "W44", name: "錆青磁", reading: "さびせいじ", hex: "#a6c8b2" },
  { code: "W45", name: "翡翠色", reading: "ひすいいろ", hex: "#38b48b" },
  { code: "W46", name: "緑", reading: "みどり", hex: "#3eb370" },
  { code: "W47", name: "常磐緑", reading: "ときわみどり", hex: "#028760" },
  { code: "W48", name: "深緑", reading: "ふかみどり", hex: "#00552e" },
  { code: "W49", name: "萌葱色", reading: "もえぎいろ", hex: "#006e54" },
  { code: "W50", name: "錆浅葱", reading: "さびあさぎ", hex: "#5c9291" },
  { code: "W51", name: "新橋色", reading: "しんばしいろ", hex: "#59b9c6" },
  { code: "W52", name: "納戸色", reading: "なんどいろ", hex: "#008899" },
  { code: "W53", name: "露草色", reading: "つゆくさいろ", hex: "#38a1db" },
  { code: "W54", name: "青", reading: "あお", hex: "#0095d9" },
  { code: "W55", name: "紺碧", reading: "こんぺき", hex: "#007bbb" },
  { code: "W56", name: "紺鼠", reading: "こんねず", hex: "#44617b" },
  { code: "W57", name: "淡藤色", reading: "あわふじいろ", hex: "#bbc8e6" },
  { code: "W58", name: "青藤色", reading: "あおふじいろ", hex: "#84a2d4" },
  { code: "W59", name: "杜若色", reading: "かきつばたいろ", hex: "#3e62ad" },
  { code: "W60", name: "瑠璃紺", reading: "るりこん", hex: "#19448e" },
  { code: "W61", name: "青褐", reading: "あおかち", hex: "#393e4f" },
  { code: "W62", name: "濃藍", reading: "こいあい", hex: "#0f2350" },
  { code: "W63", name: "紫苑色", reading: "しおんいろ", hex: "#867ba9" },
  { code: "W64", name: "菫色", reading: "すみれいろ", hex: "#7058a3" },
  { code: "W65", name: "本紫", reading: "ほんむらさき", hex: "#65318e" },
  { code: "W66", name: "葡萄色", reading: "ぶどういろ", hex: "#522f60" },
  { code: "W67", name: "薄葡萄", reading: "うすぶどう", hex: "#c0a2c7" },
  { code: "W68", name: "茄子紺", reading: "なすこん", hex: "#824880" },
  { code: "W69", name: "紫紺", reading: "しこん", hex: "#460e44" },
  { code: "W70", name: "菖蒲色", reading: "あやめいろ", hex: "#cc7eb1" },
  { code: "W71", name: "若紫", reading: "わかむらさき", hex: "#bc64a4" },
  { code: "W72", name: "梅紫", reading: "うめむらさき", hex: "#aa4c8f" },
  { code: "W73", name: "暗紅色", reading: "あんこうしょく", hex: "#74325c" },
  { code: "W74", name: "撫子色", reading: "なでしこいろ", hex: "#eebbcb" },
  { code: "W75", name: "躑躅色", reading: "つつじいろ", hex: "#e95295" },
  { code: "W76", name: "葡萄色", reading: "えびいろ", hex: "#640125" },
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
