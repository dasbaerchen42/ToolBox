// 顏文字盤。跟 symbols.ts 一樣只有資料,由面板動態 import。

import { matchesKeyword } from "./search";

export type KaomojiGroup = {
  key: string;
  label: string;
  items: { text: string; keywords: string }[];
};

const group = (
  key: string,
  label: string,
  entries: [string, string][]
): KaomojiGroup => ({
  key,
  label,
  items: entries.map(([text, keywords]) => ({ text, keywords })),
});

export const KAOMOJI_GROUPS: KaomojiGroup[] = [
  group("happy", "開心", [
    ["(^▽^)", "開心 笑 happy"], ["(≧▽≦)", "開心 大笑 happy"],
    ["(*^ω^*)", "開心 害羞 happy"], ["♪(´▽｀)", "開心 唱歌 happy"],
    ["(◕‿◕)", "開心 微笑 happy"], ["٩(◕‿◕)۶", "開心 歡呼 happy"],
    ["(๑>◡<๑)", "開心 happy"], ["ヽ(•‿•)ノ", "開心 歡呼 happy"],
    ["(✿◕‿◕)", "開心 花 happy"], ["(๑˃̵ᴗ˂̵)و", "開心 加油 happy"],
  ]),
  group("sad", "難過", [
    ["(╥﹏╥)", "哭 難過 sad"], ["(；△；)", "哭 難過 sad"],
    ["(ಥ_ಥ)", "哭 難過 sad"], ["(っ- ‸ – ς)", "難過 sad"],
    ["( ﾟдﾟ)", "震驚 難過"], ["(´;ω;`)", "哭 難過 sad"],
    ["(._.)", "失落 sad"], ["orz", "跪 失落 挫折"],
    ["(⌯˃̶᷄ ﹏ ˂̶᷄⌯)", "哭 難過 sad"],
  ]),
  group("angry", "生氣", [
    ["(╬ﾟдﾟ)", "生氣 angry"], ["(＃`Д´)", "生氣 angry"],
    ["ヽ(`Д´)ﾉ", "生氣 抓狂 angry"], ["(╯°□°）╯", "掀桌 生氣 angry"],
    ["(ﾉಥ益ಥ)", "生氣 angry"], ["(・`ω´・)", "不滿 生氣"],
    ["(`^´)", "哼 生氣 angry"],
  ]),
  group("love", "害羞與愛", [
    ["(⁄ ⁄•⁄ω⁄•⁄ ⁄)", "害羞 臉紅 shy"], ["(*/ω＼*)", "害羞 遮臉 shy"],
    ["(´,,•ω•,,)♡", "愛 喜歡 love"], ["(♡˙︶˙♡)", "愛 love"],
    ["(⺣◡⺣)♡", "愛 love"], ["(*˘︶˘*)", "滿足 love"],
    ["(๑♡⌓♡๑)", "愛 迷戀 love"], ["( ˘ ³˘)♥", "親 吻 love"],
  ]),
  group("confused", "疑惑與無言", [
    ["(・_・?)", "疑惑 問號 confused"], ["(⊙_⊙)?", "疑惑 confused"],
    ["(￣～￣;)", "無言 猶豫"], ["¯\\_(ツ)_/¯", "聳肩 無所謂 shrug"],
    ["(´･_･`)", "困惑 為難"], ["(・∀・?)", "疑惑 confused"],
    ["(°ロ°)", "驚訝 震驚"], ["(；・∀・)", "尷尬 冷汗"],
  ]),
  group("action", "動作", [
    ["(╯°□°）╯︵ ┻━┻", "掀桌 翻桌 生氣"],
    ["┬─┬ ノ( º _ ºノ)", "扶桌 收拾"],
    ["ヽ(￣ω￣ヽ)", "跳舞 走"], ["(ノ・ω・)ノ", "丟 拋"],
    ["(っ˘▽˘)っ", "抱 擁抱 hug"], ["＼(^o^)／", "萬歲 歡呼"],
    ["(ง'̀-'́)ง", "加油 打氣 fight"], ["( ･ω･)つ⊂( ･ω･)", "互動 碰"],
    ["(zzz)", "睡覺 sleep"], ["(－_－) zzZ", "睡覺 sleep"],
  ]),
  group("animal", "動物", [
    ["(=^･ω･^=)", "貓 cat"], ["(=①ω①=)", "貓 cat"],
    ["ʕ•ᴥ•ʔ", "熊 bear"], ["ʕ￫ᴥ￩ʔ", "熊 bear"],
    ["(･ｪ･)", "動物"], ["ヽ(=^･ω･^=)丿", "貓 揮手 cat"],
    ["/ᐠ.ꞈ.ᐟ\\", "貓 cat"], ["(^・ω・^ )", "貓 cat"],
  ]),
];

export function filterKaomoji(groups: KaomojiGroup[], query: string): KaomojiGroup[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return groups;

  return groups
    .map((item) => ({
      ...item,
      items: item.items.filter(
        (entry) =>
          matchesKeyword(entry.keywords.toLowerCase(), keyword) ||
          entry.text.includes(keyword) ||
          matchesKeyword(item.label, keyword)
      ),
    }))
    .filter((item) => item.items.length > 0);
}
