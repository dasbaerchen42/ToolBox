// 特殊符號盤。
//
// 清單是照 Unicode 區塊自己挑的(Dingbats、Arrows、Box Drawing、
// Miscellaneous Symbols、CJK 標點……),沒有沿用任何符號網站的整理成果。
// 這支檔案只有資料,由面板動態 import 進來,不會壓到 /tools 的初始包。

import { matchesKeyword } from "./search";

export type SymbolGroup = {
  key: string;
  label: string;
  /** 搜尋用的別名,讓「愛心」也找得到 ♡ */
  chars: { char: string; keywords: string }[];
};

const group = (
  key: string,
  label: string,
  entries: [string, string][]
): SymbolGroup => ({
  key,
  label,
  chars: entries.map(([char, keywords]) => ({ char, keywords })),
});

export const SYMBOL_GROUPS: SymbolGroup[] = [
  group("star", "星與花", [
    ["★", "星 star 實心"], ["☆", "星 star 空心"], ["✦", "星 star 四角"],
    ["✧", "星 star 四角 空心"], ["✩", "星 star"], ["✪", "星 star 圓"],
    ["✫", "星 star"], ["✬", "星 star"], ["✭", "星 star"], ["✮", "星 star"],
    ["✯", "星 star"], ["⋆", "星 star 小"], ["∗", "星號 asterisk"],
    ["❀", "花 flower"], ["✿", "花 flower"], ["❁", "花 flower"],
    ["❃", "花 flower"], ["❋", "花 flower"], ["✾", "花 flower"],
    ["✽", "花 flower"], ["❊", "花 flower"], ["✱", "花 星"],
  ]),
  group("heart", "心與愛", [
    ["♡", "心 heart 空心 愛"], ["♥", "心 heart 實心 愛"], ["❤", "心 heart 愛"],
    ["❥", "心 heart 愛"], ["❣", "心 heart 愛"], ["♢", "方塊 diamond"],
    ["♦", "方塊 diamond"], ["♤", "黑桃 spade"], ["♠", "黑桃 spade"],
    ["♧", "梅花 club"], ["♣", "梅花 club"], ["❦", "葉 leaf"],
    ["❧", "葉 leaf"], ["☙", "葉 leaf"],
  ]),
  group("arrow", "箭頭", [
    ["←", "左 left 箭頭 arrow"], ["↑", "上 up 箭頭 arrow"], ["→", "右 right 箭頭 arrow"],
    ["↓", "下 down 箭頭 arrow"], ["↔", "左右 箭頭 arrow"], ["↕", "上下 箭頭 arrow"],
    ["↖", "左上 箭頭 arrow"], ["↗", "右上 箭頭 arrow"], ["↘", "右下 箭頭 arrow"],
    ["↙", "左下 箭頭 arrow"], ["⇐", "左 雙線 箭頭 arrow"], ["⇒", "右 雙線 箭頭 arrow"],
    ["⇑", "上 雙線 箭頭 arrow"], ["⇓", "下 雙線 箭頭 arrow"], ["⟵", "左 長 箭頭 arrow"],
    ["⟶", "右 長 箭頭 arrow"], ["➔", "右 粗 箭頭 arrow"], ["➜", "右 粗 箭頭 arrow"],
    ["➝", "右 細 箭頭 arrow"], ["➞", "右 細 箭頭 arrow"], ["➡", "右 實心 箭頭 arrow"],
    ["↳", "轉 箭頭 縮排"], ["↰", "轉 箭頭 arrow"], ["⤷", "轉 箭頭 arrow"],
  ]),
  group("line", "線條與框", [
    ["─", "線 line 細"], ["━", "線 line 粗"], ["│", "直線 line"],
    ["┃", "直線 line 粗"], ["┄", "虛線 dash"], ["┈", "虛線 dash"],
    ["╌", "虛線 dash"], ["═", "雙線 double"], ["║", "雙線 double 直"],
    ["╭", "圓角 框"], ["╮", "圓角 框"], ["╯", "圓角 框"], ["╰", "圓角 框"],
    ["┌", "直角 框"], ["┐", "直角 框"], ["└", "直角 框"], ["┘", "直角 框"],
    ["├", "框 分支"], ["┤", "框 分支"], ["┬", "框 分支"], ["┴", "框 分支"],
    ["┼", "框 交叉"], ["▔", "上線"], ["▁", "下線"],
  ]),
  group("punct", "中文標點", [
    ["「", "引號 括號"], ["」", "引號 括號"], ["『", "引號 括號"],
    ["』", "引號 括號"], ["〈", "括號 書名"], ["〉", "括號 書名"],
    ["《", "書名號 括號"], ["》", "書名號 括號"], ["【", "括號"],
    ["】", "括號"], ["〔", "括號"], ["〕", "括號"], ["（", "括號 全形"],
    ["）", "括號 全形"], ["…", "刪節號 省略"], ["—", "破折號 dash"],
    ["–", "短破折 dash"], ["、", "頓號"], ["。", "句號 全形"],
    ["・", "間隔號 中點"], ["～", "波浪 全形"], ["‥", "兩點"],
  ]),
  group("misc", "標記與單位", [
    ["※", "米字 註記"], ["§", "章節 section"], ["¶", "段落"],
    ["†", "劍標 dagger"], ["‡", "雙劍標"], ["№", "編號 number"],
    ["℃", "攝氏 溫度"], ["℉", "華氏 溫度"], ["°", "度"],
    ["′", "分 prime"], ["″", "秒 prime"], ["‰", "千分"],
    ["×", "乘 叉"], ["÷", "除"], ["±", "正負"], ["∞", "無限"],
    ["≈", "約等於"], ["≠", "不等於"], ["≤", "小於等於"], ["≥", "大於等於"],
    ["√", "根號"], ["∴", "所以"], ["∵", "因為"], ["✓", "勾 打勾 check"],
    ["✔", "勾 打勾 check"], ["✗", "叉 cross"], ["✘", "叉 cross"],
  ]),
  group("nature", "天氣與自然", [
    ["☀", "太陽 晴"], ["☁", "雲 陰"], ["☂", "傘 雨"], ["☃", "雪人 雪"],
    ["☄", "彗星"], ["☽", "月 弦月"], ["☾", "月 弦月"], ["☼", "太陽"],
    ["❄", "雪花 雪"], ["❅", "雪花 雪"], ["❆", "雪花 雪"],
    ["♨", "溫泉 熱"], ["⚡", "閃電 電"], ["☘", "幸運草 葉"],
  ]),
  group("music", "音樂", [
    ["♩", "音符 music"], ["♪", "音符 music"], ["♫", "音符 music"],
    ["♬", "音符 music"], ["♭", "降記號"], ["♮", "還原記號"], ["♯", "升記號"],
  ]),
];

/** 依關鍵字過濾;空字串就回全部 */
export function filterSymbols(groups: SymbolGroup[], query: string): SymbolGroup[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return groups;

  return groups
    .map((item) => ({
      ...item,
      chars: item.chars.filter(
        (entry) =>
          entry.char === keyword ||
          matchesKeyword(entry.keywords.toLowerCase(), keyword) ||
          matchesKeyword(item.label, keyword)
      ),
    }))
    .filter((item) => item.chars.length > 0);
}
