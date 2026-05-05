import { Env, getOrgId, jsonResponse, errorResponse } from "../_helpers";

// GET /api/comment-settings/:sitemapId
export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  try {
    const row: any = await env.DB.prepare(
      "SELECT * FROM comment_settings WHERE sitemap_id = ? AND org_id = ?"
    ).bind(params.sitemapId, getOrgId()).first();

    return jsonResponse({
      commentsEnabled: row ? !!row.comments_enabled : false,
      allowedDomain: row?.allowed_domain || "",
    });
  } catch (e: any) {
    return errorResponse(e.message);
  }
};

// PUT /api/comment-settings/:sitemapId
export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const body: any = await request.json();

    await env.DB.prepare(
      `INSERT INTO comment_settings (sitemap_id, comments_enabled, allowed_domain, org_id)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(sitemap_id) DO UPDATE SET
         comments_enabled = excluded.comments_enabled,
         allowed_domain = excluded.allowed_domain`
    ).bind(params.sitemapId, body.commentsEnabled ? 1 : 0, body.allowedDomain || "", getOrgId()).run();

    return jsonResponse({
      commentsEnabled: !!body.commentsEnabled,
      allowedDomain: body.allowedDomain || "",
    });
  } catch (e: any) {
    return errorResponse(e.message);
  }
};
