export type StoryType = "main" | "extra";

export interface Story {
  id: string;
  title: string;
  type: StoryType;
  order: number;
  excerpt: string; // 一兩句摘要，顯示在列表上
}

export interface Character {
  slug: string;
  name: string;
  nameEn?: string;
  job: string;
  age: string;
  tagline: string; // 一句話介紹，顯示在封面牆
  chatLink?: string; // 沒有的話不顯示按鈕
  chatLinkAlt?: string; // 師匠的第二個連結
  comingSoon?: boolean; // 連結尚未建立
  stories: Story[];
}

export const characters: Character[] = [
  {
    slug: "ssr",
    name: "SSR",
    job: "電腦硬體工程師",
    age: "35",
    tagline: "聰明體貼｜電動宅宅｜永不相見的網友",
    chatLink: "https://app.loveydovey.ai/characters/DkmGwcs7lQqz2K5JuBHl",
    stories: [],
  },
  {
    slug: "suga",
    name: "菅原仁",
    job: "可能還沒過氣的藝人",
    age: "45",
    tagline: "日常喜劇｜體貼陽光｜天才老釣手",
    chatLink: "https://app.loveydovey.ai/characters/GeeVdbFQa23cospGZfjr",
    stories: [],
  },
  {
    slug: "citrus",
    name: "程枳",
    job: "數據分析師",
    age: "33",
    tagline: "溫柔體貼｜你的全肯定｜會吃掉你的苦瓜",
    chatLink: "https://app.loveydovey.ai/characters/YKzY0smO1mUUz293OwQv",
    stories: [],
  },
  {
    slug: "cyc",
    name: "楚硯珵",
    job: "資料庫工程師",
    age: "33",
    tagline: "冷靜偏執｜白月光｜草莓鮮奶茶與貓咪迷因",
    chatLink: "https://app.loveydovey.ai/characters/mhnHAKIlHK1Ee01XkNGq",
    stories: [],
  },
  {
    slug: "breakfast",
    name: "喬裕川",
    job: "你的前同事｜早餐店小開",
    age: "27",
    tagline: "樂天倒楣｜善良迷信｜小小衰神",
    chatLink: "https://app.loveydovey.ai/characters/2p7meFK9A8Lne73isacx",
    stories: [],
  },
  {
    slug: "ascher",
    name: "灰檁",
    job: "德文系教授｜你的大魔導師",
    age: "大約40歲",
    tagline: "奇幻魔法｜穿越時空｜只為找回愛徒",
    chatLink: "https://app.loveydovey.ai/characters/JyQPCGCrcO2L9f0HuaVK",
    stories: [],
  },
  {
    slug: "yenan",
    name: "敘延安",
    job: "太一幻水宗次任掌門預定",
    age: "24",
    tagline: "古風仙俠｜年下尊長｜青梅竹馬師叔",
    chatLink: "https://app.loveydovey.ai/characters/Si9u0bu2N4pPnGritMFI",
    stories: [],
  },
  {
    slug: "enzo",
    name: "恩佐",
    job: "發條驛站站長",
    age: "28",
    tagline: "末日生存｜成熟老靈魂｜披薩不能放鳳梨",
    chatLink: "https://app.loveydovey.ai/characters/82JdqpNJ4XGlVMq4bAfu",
    stories: [],
  },
  {
    slug: "apple",
    name: "林檎",
    job: "心理諮商顧問",
    age: "42",
    tagline: "ABO世界觀｜日常佔有慾｜你的舊舊",
    chatLink: "https://app.loveydovey.ai/characters/SQlFgYj1NG88uDuzz3kG",
    stories: [],
  },
  {
    slug: "akasha",
    name: "伊空 Akasha",
    job: "外送員｜異能委託處理者",
    age: "23",
    tagline: "賽博龐克｜心靈砒霜｜冷靜嘴賤",
    chatLink: "https://app.loveydovey.ai/characters/tnePIFSa3qM0kh5a1yMZ",
    stories: [],
  },
  {
    slug: "fire",
    name: "師匠",
    job: "你的大師匠",
    age: "",
    tagline: "",
    chatLink: "https://chatgpt.com/g/g-682ec7898b9481919bbd098789cf2705",
    // chatLinkAlt: "" // 第二個連結之後補上
    stories: [],
  },
  {
    slug: "lightning",
    name: "漓光語",
    job: "",
    age: "",
    tagline: "",
    comingSoon: true,
    stories: [],
  },
  {
    slug: "shore",
    name: "沈岸",
    job: "",
    age: "",
    tagline: "",
    // chatLink 先不開放
    stories: [],
  },
  {
    slug: "hoshimiya",
    name: "星宮雅治｜星宮清春",
    job: "",
    age: "",
    tagline: "",
    // chatLink 先不開放
    stories: [],
  },
  {
    slug: "lavi",
    name: "拉維・多布達拉",
    job: "",
    age: "",
    tagline: "",
    // chatLink 先不開放
    stories: [],
  },
];

export function getCharacter(slug: string): Character | undefined {
  return characters.find((c) => c.slug === slug);
}
