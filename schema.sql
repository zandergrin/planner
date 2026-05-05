-- Site Planner D1 Schema

CREATE TABLE IF NOT EXISTS sitemaps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  share_url TEXT,
  is_archived INTEGER DEFAULT 0,
  current_version TEXT,
  zoom REAL DEFAULT 1,
  org_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS page_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon_key TEXT NOT NULL,
  color TEXT NOT NULL,
  description TEXT,
  org_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS short_urls (
  short_id TEXT PRIMARY KEY,
  sitemap_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  sitemap_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  commenter_email TEXT NOT NULL,
  commenter_name TEXT NOT NULL,
  content TEXT NOT NULL,
  resolved INTEGER DEFAULT 0,
  org_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comment_settings (
  sitemap_id TEXT PRIMARY KEY,
  comments_enabled INTEGER DEFAULT 0,
  allowed_domain TEXT DEFAULT '',
  org_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sitemaps_org ON sitemaps(org_id);
CREATE INDEX IF NOT EXISTS idx_comments_sitemap ON comments(sitemap_id);
CREATE INDEX IF NOT EXISTS idx_comments_page ON comments(sitemap_id, page_id);
CREATE INDEX IF NOT EXISTS idx_short_urls_sitemap ON short_urls(sitemap_id);
