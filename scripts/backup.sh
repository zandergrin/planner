#!/bin/bash
set -euo pipefail

# Load API key from .env file
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env file not found at $ENV_FILE"
  echo "   Create it with: VITE_JSONBIN_API_KEY=your_key_here"
  exit 1
fi

API_KEY=$(grep '^VITE_JSONBIN_API_KEY=' "$ENV_FILE" | cut -d'=' -f2-)

if [ -z "$API_KEY" ]; then
  echo "❌ VITE_JSONBIN_API_KEY not found in .env"
  exit 1
fi

# Bin IDs
SITEMAPS_BIN="684a23f18960c979a5a84afc"
SHORT_URLS_BIN="684a24198561e97a5022add1"
PAGE_TYPES_BIN="684a9a2e8a456b7966acc070"
COMMENTS_BIN="693ac4ce43b1c97be9e6e4c6"

API_BASE="https://api.jsonbin.io/v3"

# Create timestamped backup directory
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$PROJECT_DIR/backups/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

echo "📦 Backing up all JSONBin data to: $BACKUP_DIR"

download_bin() {
  local bin_id="$1"
  local name="$2"
  local output="$BACKUP_DIR/${name}.json"

  echo "   ⏳ Downloading $name..."
  HTTP_CODE=$(curl -s -w "%{http_code}" -o "$output" \
    -H "X-Master-Key: $API_KEY" \
    "$API_BASE/b/$bin_id/latest")

  if [ "$HTTP_CODE" = "200" ]; then
    SIZE=$(wc -c < "$output" | tr -d ' ')
    echo "   ✅ $name — ${SIZE} bytes"
  else
    echo "   ❌ $name — HTTP $HTTP_CODE"
    return 1
  fi
}

download_bin "$SITEMAPS_BIN" "sitemaps"
download_bin "$SHORT_URLS_BIN" "short-urls"
download_bin "$PAGE_TYPES_BIN" "page-types"
download_bin "$COMMENTS_BIN" "comments"

# Write a manifest
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "bins": {
    "sitemaps": "$SITEMAPS_BIN",
    "short-urls": "$SHORT_URLS_BIN",
    "page-types": "$PAGE_TYPES_BIN",
    "comments": "$COMMENTS_BIN"
  }
}
EOF

echo ""
echo "✅ Backup complete: $BACKUP_DIR"
echo "   To restore, run: npm run restore $TIMESTAMP"
