import { Env, getOrgId, jsonResponse, errorResponse } from "../_helpers";

// GET /api/sitemaps
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const rows = await env.DB.prepare(
      "SELECT id, name, description, data, share_url, is_archived, current_version, zoom, created_at, updated_at FROM sitemaps WHERE org_id = ? ORDER BY updated_at DESC"
    ).bind(getOrgId()).all();

    const sitemaps = rows.results.map((row: any) => ({
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
    }));

    return jsonResponse(sitemaps);
  } catch (e: any) {
    return errorResponse(e.message);
  }
};
