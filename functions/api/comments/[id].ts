import { Env, getOrgId, jsonResponse, errorResponse } from "../_helpers";

// PUT /api/comments/:id — update (resolve/unresolve)
export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const body: any = await request.json();

    await env.DB.prepare(
      "UPDATE comments SET resolved = ? WHERE id = ? AND org_id = ?"
    ).bind(body.resolved ? 1 : 0, params.id, getOrgId()).run();

    // Return updated comment
    const row: any = await env.DB.prepare(
      "SELECT * FROM comments WHERE id = ? AND org_id = ?"
    ).bind(params.id, getOrgId()).first();

    if (!row) return errorResponse("Comment not found", 404);

    return jsonResponse({
      id: row.id, sitemapId: row.sitemap_id, pageId: row.page_id,
      commenterEmail: row.commenter_email, commenterName: row.commenter_name,
      content: row.content, resolved: !!row.resolved, timestamp: row.created_at,
    });
  } catch (e: any) {
    return errorResponse(e.message);
  }
};

// DELETE /api/comments/:id
export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  try {
    await env.DB.prepare("DELETE FROM comments WHERE id = ? AND org_id = ?")
      .bind(params.id, getOrgId()).run();
    return jsonResponse({ success: true });
  } catch (e: any) {
    return errorResponse(e.message);
  }
};
