import { Env, getOrgId, jsonResponse, errorResponse } from "../_helpers";

// GET /api/sitemaps/:id
export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  try {
    const row: any = await env.DB.prepare(
      "SELECT * FROM sitemaps WHERE id = ? AND org_id = ?"
    ).bind(params.id, getOrgId()).first();

    if (!row) return errorResponse("Sitemap not found", 404);

    return jsonResponse({
      id: row.id,
      name: row.name,
      description: row.description,
      ...JSON.parse(row.data || "{}"),
      shareUrl: row.share_url,
      isArchived: !!row.is_archived,
      currentVersion: row.current_version,
      zoom: row.zoom,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (e: any) {
    return errorResponse(e.message);
  }
};

// PUT /api/sitemaps/:id — upsert
export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const body: any = await request.json();

    const data = JSON.stringify({
      pages: body.pages || [],
      pageTypes: body.pageTypes || [],
      rootPageOrder: body.rootPageOrder || [],
      collapsedGroups: body.collapsedGroups || [],
      footerPages: body.footerPages || [],
      versions: body.versions || [],
    });

    await env.DB.prepare(
      `INSERT INTO sitemaps (id, name, description, data, share_url, is_archived, current_version, zoom, org_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, description = excluded.description, data = excluded.data,
         share_url = excluded.share_url, is_archived = excluded.is_archived,
         current_version = excluded.current_version, zoom = excluded.zoom, updated_at = datetime('now')`
    ).bind(
      params.id, body.name, body.description || null, data,
      body.shareUrl || null, body.isArchived ? 1 : 0,
      body.currentVersion || null, body.zoom || 1, getOrgId()
    ).run();

    return jsonResponse({ success: true });
  } catch (e: any) {
    return errorResponse(e.message);
  }
};

// DELETE /api/sitemaps/:id
export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  try {
    await env.DB.prepare("DELETE FROM sitemaps WHERE id = ? AND org_id = ?")
      .bind(params.id, getOrgId()).run();
    return jsonResponse({ success: true });
  } catch (e: any) {
    return errorResponse(e.message);
  }
};
