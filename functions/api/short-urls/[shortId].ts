import { Env, getOrgId, jsonResponse, errorResponse } from "../_helpers";

// GET /api/short-urls/:shortId — resolve short URL to sitemap ID
export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  try {
    const row: any = await env.DB.prepare(
      "SELECT sitemap_id FROM short_urls WHERE short_id = ? AND org_id = ?"
    ).bind(params.shortId, getOrgId()).first();

    if (!row) return errorResponse("Short URL not found", 404);

    return jsonResponse({ sitemapId: row.sitemap_id });
  } catch (e: any) {
    return errorResponse(e.message);
  }
};
