// 故事館的資料型別。
//
// 角色與故事的實際內容存在 Supabase，由 /api/characters、/api/stories/[slug]、
// /api/story/[id] 供應；這個檔案只定義形狀，不放任何作品內容。
// 想跑起來的人自己建資料（見 supabase-schema.sql）。

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
  chatLink?: string;
  chatLinkAlt?: string;
  comingSoon?: boolean; // 連結尚未建立
  stories: Story[];
}
