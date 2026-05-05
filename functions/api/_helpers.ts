// Shared helpers for Pages Functions API

export interface Env {
  DB: D1Database;
}

const ORG_ID = "784812546842757295";

export function getOrgId(): string {
  return ORG_ID;
}

export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}
