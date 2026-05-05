#!/usr/bin/env python3
"""Migrate JSONBin backup data to Cloudflare D1 via the REST API."""

import json, os, sys, urllib.request

TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
if not TOKEN:
    print("❌ Set CLOUDFLARE_API_TOKEN first:")
    print("   export CLOUDFLARE_API_TOKEN=your_token")
    sys.exit(1)

ACCOUNT_ID = "62a6811baed06f1a8c7f994eeea95aca"
DB_ID = "e4aff6c5-a83e-48ad-8267-a7e2b190e4e8"
API_URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/d1/database/{DB_ID}/query"
BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backups", "20260505_112503")
ORG_ID = "784812546842757295"

def load_json(filename):
    with open(os.path.join(BACKUP_DIR, filename)) as f:
        return json.load(f).get("record", {})

def execute_batch(statements):
    """Send a batch of statements to D1 query API."""
    data = json.dumps(statements[0]).encode("utf-8")
    req = urllib.request.Request(API_URL, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("Content-Type", "application/json")
    
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            return result.get("success", False), result
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return False, json.loads(body)
        except:
            return False, {"error": body}

print("🔄 Migrating data to D1...")

# Build all statements
statements = []

# Sitemaps
sitemaps = load_json("sitemaps.json").get("sitemaps", [])
for s in sitemaps:
    data_obj = {
        "pages": s.get("pages", []),
        "pageTypes": s.get("pageTypes", []),
        "rootPageOrder": s.get("rootPageOrder", []),
        "collapsedGroups": s.get("collapsedGroups", []),
        "footerPages": s.get("footerPages", []),
        "versions": s.get("versions", []),
    }
    statements.append({
        "sql": "INSERT OR REPLACE INTO sitemaps (id, name, description, data, share_url, is_archived, current_version, zoom, org_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        "params": [
            s.get("id"), s.get("name"), s.get("description"),
            json.dumps(data_obj), s.get("shareUrl"),
            1 if s.get("isArchived") else 0, s.get("currentVersion"),
            s.get("zoom", 1), ORG_ID, s.get("createdAt"), s.get("updatedAt")
        ]
    })

# Page types
for pt in load_json("page-types.json").get("pageTypes", []):
    statements.append({
        "sql": "INSERT OR REPLACE INTO page_types (id, name, icon_key, color, description, org_id) VALUES (?, ?, ?, ?, ?, ?)",
        "params": [pt.get("id"), pt.get("name"), pt.get("iconKey"), pt.get("color"), pt.get("description"), ORG_ID]
    })

# Short URLs
for m in load_json("short-urls.json").get("mappings", []):
    sd = m.get("sitemapData")
    sitemap_id = sd if isinstance(sd, str) else sd.get("id", str(sd)) if isinstance(sd, dict) else str(sd)
    statements.append({
        "sql": "INSERT OR REPLACE INTO short_urls (short_id, sitemap_id, org_id, created_at) VALUES (?, ?, ?, ?)",
        "params": [m.get("shortId"), sitemap_id, ORG_ID, m.get("createdAt")]
    })

# Comments
comments_raw = load_json("comments.json")
for c in comments_raw.get("comments", []):
    statements.append({
        "sql": "INSERT OR REPLACE INTO comments (id, sitemap_id, page_id, commenter_email, commenter_name, content, resolved, org_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        "params": [c.get("id"), c.get("sitemapId"), c.get("pageId"), c.get("commenterEmail"), c.get("commenterName"), c.get("content"), 1 if c.get("resolved") else 0, ORG_ID, c.get("timestamp")]
    })

# Comment settings
for sitemap_id, settings in comments_raw.get("settings", {}).items():
    statements.append({
        "sql": "INSERT OR REPLACE INTO comment_settings (sitemap_id, comments_enabled, allowed_domain, org_id) VALUES (?, ?, ?, ?)",
        "params": [sitemap_id, 1 if settings.get("commentsEnabled") else 0, settings.get("allowedDomain", ""), ORG_ID]
    })

print(f"   {len(statements)} statements to execute")

# Execute in batches (D1 API supports multiple statements per request)
# Send one at a time for large sitemaps to avoid body size limits
errors = 0
for i, stmt in enumerate(statements):
    table = stmt["sql"].split("INTO ")[1].split(" ")[0] if "INTO" in stmt["sql"] else "?"
    print(f"   [{i+1}/{len(statements)}] {table}...", end=" ", flush=True)
    
    ok, result = execute_batch([stmt])
    
    if ok:
        print("✅")
    else:
        print("❌")
        errors += 1
        err_msgs = result.get("errors", [])
        if err_msgs:
            for e in err_msgs:
                print(f"      {e.get('message', e)}")
        else:
            print(f"      {json.dumps(result)[:200]}")

print(f"\n{'✅' if errors == 0 else '⚠️'} Migration complete: {len(statements) - errors}/{len(statements)} succeeded")
