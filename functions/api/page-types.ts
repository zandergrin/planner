import { Env, getOrgId, jsonResponse, errorResponse } from "./_helpers";

// GET /api/page-types
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const rows = await env.DB.prepare(
      "SELECT * FROM page_types WHERE org_id = ?"
    ).bind(getOrgId()).all();

    return jsonResponse(rows.results.map((r: any) => ({
      id: r.id,
      name: r.name,
      iconKey: r.icon_key,
      color: r.color,
      description: r.description,
    })));
  } catch (e: any) {
    return errorResponse(e.message);
  }
};

// PUT /api/page-types — replace all page types
export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const pageTypes: any[] = await request.json() as any[];
    const orgId = getOrgId();

    // Use a batch: delete all then insert all
    const statements = [
      env.DB.prepare("DELETE FROM page_types WHERE org_id = ?").bind(orgId),
      ...pageTypes.map((pt: any) =>
        env.DB.prepare(
          "INSERT INTO page_types (id, name, icon_key, color, description, org_id) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(pt.id, pt.name, pt.iconKey, pt.color, pt.description || "", orgId)
      ),
    ];

    await env.DB.batch(statements);
    return jsonResponse({ success: true });
  } catch (e: any) {
    return errorResponse(e.message);
  }
};
