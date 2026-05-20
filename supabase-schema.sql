-- Das Baerchen ToolBox - Supabase Database Schema
-- 在 Supabase Dashboard > SQL Editor 裡貼上並執行這個檔案

-- ── 角色表 ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS characters (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT        UNIQUE NOT NULL,
  name          TEXT        NOT NULL,
  job           TEXT        NOT NULL DEFAULT '',
  age           TEXT        NOT NULL DEFAULT '',
  tagline       TEXT        NOT NULL DEFAULT '',
  chat_link     TEXT,
  chat_link_alt TEXT,
  display_order INTEGER     NOT NULL DEFAULT 0,
  coming_soon   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 故事表 ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stories (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  character_slug TEXT        NOT NULL REFERENCES characters(slug) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  type           TEXT        NOT NULL DEFAULT 'main' CHECK (type IN ('main', 'extra')),
  order_index    INTEGER     NOT NULL DEFAULT 0,
  excerpt        TEXT        NOT NULL DEFAULT '',
  content        TEXT        NOT NULL DEFAULT '',
  published      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 自動更新 updated_at ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER characters_updated_at
  BEFORE UPDATE ON characters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER stories_updated_at
  BEFORE UPDATE ON stories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security ─────────────────────────────────────────────

ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories    ENABLE ROW LEVEL SECURITY;

-- 所有人可讀取角色
CREATE POLICY "Public read characters"
  ON characters FOR SELECT USING (true);

-- 所有人可讀取已發布的故事
CREATE POLICY "Public read published stories"
  ON stories FOR SELECT USING (published = true);

-- （管理員寫入操作透過 service_role key 的 API routes 處理，
--   service_role 預設跳過 RLS，無需額外 policy）

-- ── 索引 ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_stories_character_slug
  ON stories (character_slug);

CREATE INDEX IF NOT EXISTS idx_stories_published
  ON stories (published, order_index);

CREATE INDEX IF NOT EXISTS idx_characters_display_order
  ON characters (display_order);
