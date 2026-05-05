#!/bin/bash
set -euo pipefail

# Migrate data to D1 using the Cloudflare API directly (no wrangler needed)
# Uses CLOUDFLARE_API_TOKEN env var

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "❌ Set CLOUDFLARE_API_TOKEN first:"
  echo "   export CLOUDFLARE_API_TOKEN=your_token"
  exit 1
fi

ACCOUNT_ID="6ee4e489626b7317cb45976fbd67f2ed"
DB_ID="e4aff6c5-a83e-48ad-8267-a7e2b190e4e8"
API="https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database/$DB_ID/query"
BACKUP_DIR="/Users/zander/localhost/planner/backups/20260505_112503"

echo "🔄 Migrating data to D1 via API..."

# Generate SQL statements as a JSON array
python3 << 'PYEOF' > /tmp/d1_migration_statements.json
import json

backup_dir = "/Users/zander/localhost/planner/backups/20260505_112503"
org_id = "784812546842757295"

statements = []

def sql_escape(s):
    if s is None:
        return None
    return str(s).replace("'", "''")

# Load backup files
with open(f"{backup_dir}/sitemaps.json") as f:
    sitemaps_data = json.load(f).get("record", {}).get("sitemaps", [])

with open(f"{backup_dir}/page-types.json") as f:
    page_types_data = json.load(f).get("record", {}).get("pageTypes", [])

with open(f"{backup_dir}/short-urls.json") as f:
    short_urls_data = json.load(f).get("record", {}).get("mappings", [])

with open(f"{backup_dir}/comments.json") as f:
    comments_raw = json.load(f).get("record", {})
    comments_data = comments_raw.get("comments", [])
    comment_settings_data = comments_raw.get("settings", {})

# Sitemaps - use parameterized queries
for s in sitemaps_data:
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
            s.get("zoom", 1), org_id, s.get("createdAt"), s.get("updatedAt")
        ]
    })

# Page types
for pt in page_types_data:
    statements.append({
        "sql": "INSERT OR REPLACE INTO page_types (id, name, icon_key, color, description, org_id) VALUES (?, ?, ?, ?, ?, ?)",
        "params": [pt.get("id"), pt.get("name"), pt.get("iconKey"), pt.get("color"), pt.get("description"), org_id]
    })

# Short URLs
for m in short_urls_data:
    sd = m.get("sitemapData")
    if isinstance(sd, str):
        sitemap_id = sd
    elif isinstance(sd, dict) and "id" in sd:
        sitemap_id = sd["id"]
    else:
        sitemap_id = str(sd)
    statements.append({
        "sql": "INSERT OR REPLACE INTO short_urls (short_id, sitemap_id, org_id, created_at) VALUES (?, ?, ?, ?)",
        "params": [m.get("shortId"), sitemap_id, org_id, m.get("createdAt")]
    })

# Comments
for c in comments_data:
    statements.append({
        "sql": "INSERT OR REPLACE INTO comments (id, sitemap_id, page_id, commenter_email, commenter_name, content, resolved, org_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        "params": [c.get("id"), c.get("sitemapId"), c.get("pageId"), c.get("commenterEmail"), c.get("commenterName"), c.get("content"), 1 if c.get("resolved") else 0, org_id, c.get("timestamp")]
    })

# Comment settings
for sitemap_id, settings in comment_settings_data.items():
    statements.append({
        "sql": "INSERT OR REPLACE INTO comment_settings (sitemap_id, comments_enabled, allowed_domain, org_id) VALUES (?, ?, ?, ?)",
        "params": [sitemap_id, 1 if settings.get("commentsEnabled") else 0, settings.get("allowedDomain", ""), org_id]
    })

# Output as JSON - split into batches of 10 (API limit)
batch_size = 10
batches = [statements[i:i+batch_size] for i in range(0, len(statements), batch_size)]
json.dump({"batches": batches, "total": len(statements)}, open("/tmp/d1_migration_statements.json", "w"))
print(f"Generated {len(statements)} statements in {len(batches)} batches")
PYEOF

# Read and execute batches
TOTAL=$(python3 -c "import json; d=json.load(open('/tmp/d1_migration_statements.json')); print(d['total'])")
BATCHES=$(python3 -c "import json; d=json.load(open('/tmp/d1_migration_statements.json')); print(len(d['batches']))")
echo "   $TOTAL statements in $BATCHES batches"

for i in $(seq 0 $((BATCHES - 1))); do
  BATCH_JSON=$(python3 -c "
import json
d = json.load(open('/tmp/d1_migration_statements.json'))
batch = d['batches'][$i]
# D1 API expects array of {sql, params} objects
print(json.dumps(batch))
")

  echo -n "   Batch $((i+1))/$BATCHES... "

  RESPONSE=$(curl -s -X POST "$API" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$BATCH_JSON")

  SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "false")

  if [ "$SUCCESS" = "True" ]; then
    echo "✅"
  else
    echo "❌"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    exit 1
  fi
done

echo ""
echo "✅ Migration complete!"
