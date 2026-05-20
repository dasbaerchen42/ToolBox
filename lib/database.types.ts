export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type CharacterRow = {
  id: string;
  slug: string;
  name: string;
  job: string;
  age: string;
  tagline: string;
  chat_link: string | null;
  chat_link_alt: string | null;
  display_order: number;
  coming_soon: boolean;
  created_at: string;
  updated_at: string;
};

type CharacterInsert = Omit<CharacterRow, "id" | "created_at" | "updated_at">;

type CharacterUpdate = {
  slug?: string;
  name?: string;
  job?: string;
  age?: string;
  tagline?: string;
  chat_link?: string | null;
  chat_link_alt?: string | null;
  display_order?: number;
  coming_soon?: boolean;
};

type StoryRow = {
  id: string;
  character_slug: string;
  title: string;
  type: "main" | "extra";
  order_index: number;
  excerpt: string;
  content: string;
  published: boolean;
  created_at: string;
  updated_at: string;
};

type StoryInsert = Omit<StoryRow, "id" | "created_at" | "updated_at">;

type StoryUpdate = {
  character_slug?: string;
  title?: string;
  type?: "main" | "extra";
  order_index?: number;
  excerpt?: string;
  content?: string;
  published?: boolean;
};

export interface Database {
  public: {
    Tables: {
      characters: {
        Row: CharacterRow;
        Insert: CharacterInsert;
        Update: CharacterUpdate;
      };
      stories: {
        Row: StoryRow;
        Insert: StoryInsert;
        Update: StoryUpdate;
      };
    };
  };
}

export type { CharacterRow, StoryRow };
