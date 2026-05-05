#!/bin/bash
set -euo pipefail

# Migrate JSONBin backup data into Cloudflare D1
# Usage: npm run migrate <BACKUP_TIMESTAMP>

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -z "${1:-}" ]; then
  echo "Usage: npm run migrate <BACKUP_TIMESTAMP>"
  echo ""
  echo "Available backups:"
  ls -1 "$PROJECT_DIR/backups/" 2>/dev/null | grep -v '.gitkeep' || echo "  (none)"
  exit 1
fi

BACKUP_DIR="$PROJECT_DIR/backups/$1"
if [ ! -d "$BACKUP_DIR" ]; then
  echo "❌ Backup not found: $BACKUP_DIR"
  exit 1
fi

DB_NAME="planner-db"
ORG_ID="784812546842757295"

echo "🔄 Migrating data from backup $1 to D1 database '$DB_NAME'"
echo ""

# Generate SQL from the backup JSON
MIGRATION_SQL="$BACKUP_DIR/migration.sql"

python3 << PYEOF > "$MIGRATION_SQL"
import json, sys

org_id = "$ORG_ID"

# Load backup files
with open("$BACKUP_DIR/sitemaps.json") as f:
    sitemaps_data = json.load(f).get("record", {}).get("sitemaps", [])

with open("$BACKUP_DIR/page-types.json") as f:
    page_types_data = json.load(f).get("record", {}).get("pageTypes", [])

with open("$BACKUP_DIR/short-urls.json") as f:
    short_urls_data = json.load(f).get("record", {}).get("mappings", [])

with open("$BACKUP_DIR/comments.json") as f:
    comments_raw = json.load(f).get("record", {})
    comments_data = comments_raw.get("comments", [])
    comment_settings_data = comments_raw.get("settings", {})

def sql_escape(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

# Sitemaps
for s in sitemaps_data:
    sid = sql_escape(s.get("id"))
    name = sql_escape(s.get("name"))
    desc = sql_escape(s.get("description"))
    
    # Build the data JSON (pages, pageTypes, rootPageOrder, etc.)
    data_obj = {
        "pages": s.get("pages", []),
        "pageTypes": s.get("pageTypes", []),
        "rootPageOrder": s.get("rootPageOrder", []),
        "collapsedGroups": s.get("collapsedGroups", []),
        "footerPages": s.get("footerPages", []),
        "versions": s.get("versions", []),
    }
    data = sql_escape(json.dumps(data_obj))
    share_url = sql_escape(s.get("shareUrl"))
    is_archived = 1 if s.get("isArchived") else 0
    current_version = sql_escape(s.get("currentVersion"))
    zoom = s.get("zoom", 1)
    created = sql_escape(s.get("createdAt"))
    updated = sql_escape(s.get("updatedAt"))
    
    print(f"INSERT OR REPLACE INTO sitemaps (id, name, description, data, share_url, is_archived, current_version, zoom, org_id, created_at, updated_at) VALUES ({sid}, {name}, {desc}, {data}, {share_url}, {is_archived}, {current_version}, {zoom}, {sql_escape(org_id)}, {created}, {updated});")

# Page types
for pt in page_types_data:
    print(f"INSERT OR REPLACE INTO page_types (id, name, icon_key, color, description, org_id) VALUES ({sql_escape(pt.get('id'))}, {sql_escape(pt.get('name'))}, {sql_escape(pt.get('iconKey'))}, {sql_escape(pt.get('color'))}, {sql_escape(pt.get('description'))}, {sql_escape(org_id)});")

# Short URLs
for m in short_urls_data:
    short_id = sql_escape(m.get("shortId"))
    # Handle different formats of sitemapData
    sd = m.get("sitemapData")
    if isinstance(sd, str):
        sitemap_id = sql_escape(sd)
    elif isinstance(sd, dict) and "id" in sd:
        sitemap_id = sql_escape(sd["id"])
    else:
        sitemap_id = sql_escape(str(sd))
    created = sql_escape(m.get("createdAt"))
    print(f"INSERT OR REPLACE INTO short_urls (short_id, sitemap_id, org_id, created_at) VALUES ({short_id}, {sitemap_id}, {sql_escape(org_id)}, {created});")

# Comments
for c in comments_data:
    print(f"INSERT OR REPLACE INTO comments (id, sitemap_id, page_id, commenter_email, commenter_name, content, resolved, org_id, created_at) VALUES ({sql_escape(c.get('id'))}, {sql_escape(c.get('sitemapId'))}, {sql_escape(c.get('pageId'))}, {sql_escape(c.get('commenterEmail'))}, {sql_escape(c.get('commenterName'))}, {sql_escape(c.get('content'))}, {1 if c.get('resolved') else 0}, {sql_escape(org_id)}, {sql_escape(c.get('timestamp'))});")

# Comment settings
for sitemap_id, settings in comment_settings_data.items():
    print(f"INSERT OR REPLACE INTO comment_settings (sitemap_id, comments_enabled, allowed_domain, org_id) VALUES ({sql_escape(sitemap_id)}, {1 if settings.get('commentsEnabled') else 0}, {sql_escape(settings.get('allowedDomain', ''))}, {sql_escape(org_id)});")

print(f"\n-- Migration complete: {len(sitemaps_data)} sitemaps, {len(page_types_data)} page types, {len(short_urls_data)} short URLs, {len(comments_data)} comments")
PYEOF

echo "📝 Generated migration SQL: $MIGRATION_SQL"
LINES=$(wc -l < "$MIGRATION_SQL")
echo "   $LINES SQL statements"
echo ""
echo "To apply this migration, run:"
echo "  npx wrangler d1 execute $DB_NAME --remote --file=$MIGRATION_SQL"
echo ""
echo "To test locally first:"
echo "  npx wrangler d1 execute $DB_NAME --local --file=$MIGRATION_SQL"
