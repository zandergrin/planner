import { Env, getOrgId, jsonResponse, errorResponse } from "../_helpers";

// GET /api/comments?sitemap_id=xxx&page_id=yyy
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const sitemapId = url.searchParams.get("sitemap_id");
    const pageId = url.searchParams.get("page_id");

    let rows;
    if (sitemapId && pageId) {
      rows = await env.DB.prepare(
        "SELECT * FROM comments WHERE sitemap_id = ? AND page_id = ? AND org_id = ? ORDER BY created_at DESC"
      ).bind(sitemapId, pageId, getOrgId()).all();
    } else if (sitemapId) {
      rows = await env.DB.prepare(
        "SELECT * FROM comments WHERE sitemap_id = ? AND org_id = ? ORDER BY created_at DESC"
      ).bind(sitemapId, getOrgId()).all();
    } else {
      return errorResponse("sitemap_id is required", 400);
    }

    return jsonResponse(rows.results.map((r: any) => ({
      id: r.id,
      sitemapId: r.sitemap_id,
      pageId: r.page_id,
      commenterEmail: r.commenter_email,
      commenterName: r.commenter_name,
      content: r.content,
      resolved: !!r.resolved,
      timestamp: r.created_at,
    })));
  } catch (e: any) {
    return errorResponse(e.message);
  }
};

// POST /api/comments — create a comment
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body: any = await request.json();
    const { id, sitemapId, pageId, commenterEmail, commenterName, content } = body;

    if (!sitemapId || !pageId || !commenterEmail || !commenterName || !content) {
      return errorResponse("Missing required fields", 400);
    }

    const commentId = id || crypto.randomUUID();

    await env.DB.prepare(
      "INSERT INTO comments (id, sitemap_id, page_id, commenter_email, commenter_name, content, org_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(commentId, sitemapId, pageId, commenterEmail, commenterName, content, getOrgId()).run();

    return jsonResponse({
      id: commentId, sitemapId, pageId, commenterEmail, commenterName, content,
      resolved: false, timestamp: new Date().toISOString(),
    }, 201);
  } catch (e: any) {
    return errorResponse(e.message);
  }
};
