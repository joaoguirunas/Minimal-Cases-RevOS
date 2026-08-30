#!/usr/bin/env bash
# =============================================================================
# generate-baseline.sh
#
# Concatenates all SQL migrations in supabase/migrations/ (alphabetical order,
# which equals chronological order by timestamp prefix) into a single
# supabase/baseline.sql file.
#
# Also generates supabase/migrations-manifest.json listing every migration
# included in the baseline — used by the sync engine to mark them as applied
# after bootstrapping a new client from the baseline.
#
# Usage:
#   bash scripts/generate-baseline.sh
#   npm run db:baseline
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
MIGRATIONS_DIR="$ROOT/supabase/migrations"
BASELINE_FILE="$ROOT/supabase/baseline.sql"
MANIFEST_FILE="$ROOT/supabase/migrations-manifest.json"

# ─── Collect migration files in alphabetical order ───────────────────────────
# Note: using while+read instead of mapfile for bash 3.2 compat (macOS default)

MIGRATION_FILES=()
while IFS= read -r -d '' filepath; do
  MIGRATION_FILES+=("$filepath")
done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -name "*.sql" -print0 | sort -z)

MIGRATION_COUNT=${#MIGRATION_FILES[@]}

if [[ $MIGRATION_COUNT -eq 0 ]]; then
  echo "❌  No .sql files found in $MIGRATIONS_DIR"
  exit 1
fi

GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Generate RevOS Baseline SQL"
echo "  Migrations: $MIGRATION_COUNT files"
echo "  Generated:  $GENERATED_AT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── Write baseline.sql ───────────────────────────────────────────────────────

cat > "$BASELINE_FILE" <<HEADER
-- =============================================================================
-- RevOS — Baseline Schema
-- =============================================================================
-- Generated at : ${GENERATED_AT}
-- Migrations   : ${MIGRATION_COUNT} files
--
-- This file is the concatenation of all SQL migrations in
-- supabase/migrations/ in chronological order (alphabetical by filename,
-- which equals chronological order by timestamp prefix).
--
-- HOW TO USE:
--   Apply this file to a fresh Supabase project to bootstrap the full
--   schema without running each migration individually.
--
-- HOW TO REGENERATE:
--   npm run db:baseline
--
-- ⚠️  DO NOT EDIT MANUALLY — this file is auto-generated.
-- =============================================================================

HEADER

INCLUDED=()

for filepath in "${MIGRATION_FILES[@]}"; do
  filename="$(basename "$filepath")"

  {
    echo ""
    echo "-- ---------------------------------------------------------------------------"
    echo "-- Migration: $filename"
    echo "-- ---------------------------------------------------------------------------"
    echo ""
  } >> "$BASELINE_FILE"

  cat "$filepath" >> "$BASELINE_FILE"
  printf '\n' >> "$BASELINE_FILE"

  INCLUDED+=("$filename")
done

BASELINE_BYTES="$(wc -c < "$BASELINE_FILE" | tr -d ' ')"
BASELINE_LINES="$(wc -l < "$BASELINE_FILE" | tr -d ' ')"

echo ""
echo "  ✅  baseline.sql written"
echo "      Path  : supabase/baseline.sql"
echo "      Size  : $(( BASELINE_BYTES / 1024 )) KB  ($BASELINE_LINES lines)"

# ─── Write migrations-manifest.json ──────────────────────────────────────────

# Build JSON array of filenames using python3 (available on macOS)
python3 - "$GENERATED_AT" "${INCLUDED[@]}" <<'PYEOF' > "$MANIFEST_FILE"
import json, sys

generated_at = sys.argv[1]
migrations   = sys.argv[2:]

manifest = {
    "baseline_generated_at": generated_at,
    "migrations_count": len(migrations),
    "migrations": migrations,
}

print(json.dumps(manifest, indent=2))
PYEOF

echo "  ✅  migrations-manifest.json written"
echo "      Path  : supabase/migrations-manifest.json"
echo "      Count : ${MIGRATION_COUNT} migrations"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
