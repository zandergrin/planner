#!/bin/bash
set -euo pipefail

# Load API key from .env file
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env file not found at $ENV_FILE"
  exit 1
fi

API_KEY=$(grep '^VITE_JSONBIN_API_KEY=' "$ENV_FILE" | cut -d'=' -f2-)

if [ -z "$API_KEY" ]; then
  echo "❌ VITE_JSONBIN_API_KEY not found in .env"
  exit 1
fi

# Check for backup timestamp argument
if [ -z "${1:-}" ]; then
  echo "Usage: npm run restore <TIMESTAMP>"
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

# Bin IDs
SITEMAPS_BIN="684a23f18960c979a5a84afc"
SHORT_URLS_BIN="684a24198561e97a5022add1"
PAGE_TYPES_BIN="684a9a2e8a456b7966acc070"
COMMENTS_BIN="693ac4ce43b1c97be9e6e4c6"

API_BASE="https://api.jsonbin.io/v3"

echo "⚠️  WARNING: This will OVERWRITE all live data with backup from $1"
echo "   This affects: sitemaps, short URLs, page types, comments"
echo ""
read -p "   Type 'RESTORE' to confirm: " CONFIRM

if [ "$CONFIRM" != "RESTORE" ]; then
  echo "❌ Restore cancelled"
  exit 1
fi

# Take a safety backup first
echo ""
echo "📦 Taking safety backup of current live data first..."
bash "$SCRIPT_DIR/backup.sh"
echo ""

restore_bin() {
  local bin_id="$1"
  local name="$2"
  local input="$BACKUP_DIR/${name}.json"

  if [ ! -f "$input" ]; then
    echo "   ⚠️  Skipping $name — file not found"
    return
  fi

  echo "   ⏳ Restoring $name..."

  # Extract just the 'record' field (strip JSONBin metadata)
  RECORD=$(python3 -c "
import json, sys
with open('$input') as f:
    data = json.load(f)
    json.dump(data.get('record', data), sys.stdout)
")

  HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null \
    -X PUT \
    -H "Content-Type: application/json" \
    -H "X-Master-Key: $API_KEY" \
    -H "X-Bin-Versioning: false" \
    -d "$RECORD" \
    "$API_BASE/b/$bin_id")

  if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ $name restored"
  else
    echo "   ❌ $name — HTTP $HTTP_CODE"
    return 1
  fi
}

echo "🔄 Restoring data from backup: $1"
restore_bin "$SITEMAPS_BIN" "sitemaps"
restore_bin "$SHORT_URLS_BIN" "short-urls"
restore_bin "$PAGE_TYPES_BIN" "page-types"
restore_bin "$COMMENTS_BIN" "comments"

echo ""
echo "✅ Restore complete from backup: $1"
