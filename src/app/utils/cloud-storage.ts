// Cloud storage system using Cloudflare D1 via Pages Functions API
// All data operations go through /api/* endpoints (server-side, no API keys in client)

import type {
  SerializableSitemap,
  SerializablePageType,
} from "./storage";

// Comment interfaces
export interface Comment {
  id: string;
  sitemapId: string;
  pageId: string;
  commenterEmail: string;
  commenterName: string;
  content: string;
  timestamp: string;
  resolved: boolean;
}

export interface CommentSettings {
  commentsEnabled: boolean;
  allowedDomain: string;
}

// ── Sitemaps ──────────────────────────────────────────────

export async function loadCloudSitemaps(): Promise<SerializableSitemap[]> {
  const res = await fetch("/api/sitemaps");
  if (!res.ok) throw new Error(`Failed to load sitemaps: ${res.status}`);
  return res.json();
}

export async function loadCloudSitemap(id: string): Promise<SerializableSitemap | null> {
  const res = await fetch(`/api/sitemaps/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load sitemap: ${res.status}`);
  return res.json();
}

export async function saveCloudSitemap(sitemap: SerializableSitemap): Promise<void> {
  const res = await fetch(`/api/sitemaps/${encodeURIComponent(sitemap.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sitemap),
  });
  if (!res.ok) throw new Error(`Failed to save sitemap: ${res.status}`);
}

export async function deleteCloudSitemap(id: string): Promise<void> {
  const res = await fetch(`/api/sitemaps/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete sitemap: ${res.status}`);
}

// Legacy compat for data-cleanup
export async function saveCloudSitemaps(_sitemaps: SerializableSitemap[]): Promise<void> {
  // No-op: with D1 we save individually. Only used by data-cleanup.
}

// ── Page Types ────────────────────────────────────────────

export async function loadCloudPageTypes(): Promise<SerializablePageType[]> {
  const res = await fetch("/api/page-types");
  if (!res.ok) throw new Error(`Failed to load page types: ${res.status}`);
  return res.json();
}

export async function saveCloudPageTypes(pageTypes: SerializablePageType[]): Promise<void> {
  const res = await fetch("/api/page-types", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pageTypes),
  });
  if (!res.ok) throw new Error(`Failed to save page types: ${res.status}`);
}

// ── Short URLs ────────────────────────────────────────────

export async function storeShortUrlMapping(shortId: string, sitemapId: string): Promise<void> {
  const res = await fetch("/api/short-urls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shortId, sitemapId }),
  });
  if (!res.ok) throw new Error(`Failed to store short URL: ${res.status}`);
}

export async function retrieveShortUrlMapping(shortId: string): Promise<string | null> {
  const res = await fetch(`/api/short-urls/${encodeURIComponent(shortId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to retrieve short URL: ${res.status}`);
  const data = await res.json();
  return data.sitemapId || null;
}

export async function findShortUrlForSitemap(sitemapId: string): Promise<string | null> {
  const res = await fetch(`/api/short-urls?sitemap_id=${encodeURIComponent(sitemapId)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.shortId || null;
}

// ── Comments ──────────────────────────────────────────────

export async function createComment(
  sitemapId: string,
  pageId: string,
  commenterEmail: string,
  commenterName: string,
  content: string,
  allowedDomain: string = "",
): Promise<Comment> {
  if (allowedDomain && allowedDomain.trim() !== "") {
    const emailDomain = commenterEmail.split("@")[1]?.toLowerCase();
    if (!emailDomain || emailDomain !== allowedDomain.toLowerCase().trim()) {
      throw new Error(`Email must be from domain: ${allowedDomain}`);
    }
  }

  const res = await fetch("/api/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sitemapId, pageId, commenterEmail, commenterName, content }),
  });
  if (!res.ok) throw new Error(`Failed to create comment: ${res.status}`);
  return res.json();
}

export async function getComments(sitemapId: string, pageId: string): Promise<Comment[]> {
  try {
    const res = await fetch(`/api/comments?sitemap_id=${encodeURIComponent(sitemapId)}&page_id=${encodeURIComponent(pageId)}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getAllCommentsForSitemap(sitemapId: string): Promise<Comment[]> {
  try {
    const res = await fetch(`/api/comments?sitemap_id=${encodeURIComponent(sitemapId)}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function resolveComment(commentId: string, resolved: boolean): Promise<Comment> {
  const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resolved }),
  });
  if (!res.ok) throw new Error(`Failed to update comment: ${res.status}`);
  return res.json();
}

export async function deleteComment(commentId: string): Promise<void> {
  const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete comment: ${res.status}`);
}

// ── Comment Settings ──────────────────────────────────────

export async function getCommentSettings(sitemapId: string): Promise<CommentSettings> {
  try {
    const res = await fetch(`/api/comment-settings/${encodeURIComponent(sitemapId)}`);
    if (!res.ok) return { commentsEnabled: false, allowedDomain: "" };
    return res.json();
  } catch {
    return { commentsEnabled: false, allowedDomain: "" };
  }
}

export async function updateCommentSettings(
  sitemapId: string,
  settings: CommentSettings,
): Promise<CommentSettings> {
  const res = await fetch(`/api/comment-settings/${encodeURIComponent(sitemapId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(`Failed to update comment settings: ${res.status}`);
  return res.json();
}

// ── Connection Test ───────────────────────────────────────

export async function testCloudConnection(): Promise<boolean> {
  try {
    const res = await fetch("/api/page-types");
    return res.ok;
  } catch {
    return false;
  }
}
