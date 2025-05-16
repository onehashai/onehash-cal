#!/bin/bash

set -e

# Usage message
usage() {
  echo "Usage: $0 <SOURCE_DB_URL> <TARGET_DB_URL>"
  echo "Example: $0 postgres://user:pass@source_host:5432/sourcedb postgres://user:pass@target_host:5432/targetdb"
  exit 1
}

# Validate input
if [ "$#" -ne 2 ]; then
  usage
fi

SOURCE_DB_URL="$1"
TARGET_DB_URL="$2"


check_connection() {
  local DB_URL=$1
  if PGPASSWORD=$(echo "$DB_URL" | sed -E 's/.*\/\/[^:]+:([^@]+)@.*/\1/') \
     psql "$DB_URL" -c '\q' &> /dev/null; then
    echo "✅ Connection to $DB_URL successful."
  else
    echo "❌ ERROR: Could not connect to $DB_URL"
    exit 1
  fi
}

check_connection "$SOURCE_DB_URL"
check_connection "$TARGET_DB_URL"
# Get the directory of the script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create a temporary file
DUMP_FILE=$(mktemp /tmp/db_dump_XXXXXX.dump)


echo "📦 Backing up source database to $DUMP_FILE..."
pg_dump "$SOURCE_DB_URL" -F c -f "$DUMP_FILE"

echo "📥 Restoring into target database..."
pg_restore --clean --no-owner --dbname="$TARGET_DB_URL" "$DUMP_FILE"

echo "Cleaning up..."
rm -f "$DUMP_FILE"
echo "✅ Migration complete."
