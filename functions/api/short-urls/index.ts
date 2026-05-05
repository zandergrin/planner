import { Env, getOrgId, jsonResponse, errorResponse } from "../_helpers";

// GET /api/short-urls?sitemap_id=xxx — find short URL for a sitemap
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const sitemapId = url.searchParams.get("sitemap_id");

    if (sitemapId) {
      const row: any = await env.DB.prepare(
        "SELECT short_id FROM short_urls WHERE sitemap_id = ? AND org_id = ? LIMIT 1"
      ).bind(sitemapId, getOrgId()).first();

      return jsonResponse({ shortId: row?.short_id || null });
    }

    // List all
    const rows = await env.DB.prepare(
      "SELECT * FROM short_urls WHERE org_id = ?"
    ).bind(getOrgId()).all();

    return jsonResponse(rows.results);
  } catch (e: any) {
    return errorResponse(e.message);
  }
};

// POST /api/short-urls — create a short URL mapping
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { shortId, sitemapId }: any = await request.json();

    await env.DB.prepare(
      "INSERT INTO short_urls (short_id, sitemap_id, org_id) VALUES (?, ?, ?)"
    ).bind(shortId, sitemapId, getOrgId()).run();

    return jsonResponse({ success: true }, 201);
  } catch (e: any) {
    return errorResponse(e.message);
  }
};
