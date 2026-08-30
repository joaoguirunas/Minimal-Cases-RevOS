#!/usr/bin/env bash
# Bootstrap a fresh control plane by applying all migrations_adm/ in order.
#
# Usage:
#   CONTROL_PLANE_DB_URL="postgres://..." ./scripts/bootstrap-control-plane.sh
#
# The CONTROL_PLANE_DB_URL must be the direct Postgres connection string for the
# control plane Supabase project (Settings > Database > Connection string > URI).
# Never run this against a tenant database — tenant migrations live in migrations/.
#
# Idempotency: all migrations use IF NOT EXISTS / CREATE OR REPLACE so re-running
# on an already-bootstrapped control plane is safe.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../supabase/migrations_adm"

if [[ -z "${CONTROL_PLANE_DB_URL:-}" ]]; then
  echo "ERROR: CONTROL_PLANE_DB_URL is not set." >&2
  echo "Export the direct Postgres connection string for the control plane before running." >&2
  exit 1
fi

echo "=== rev-os control plane bootstrap ==="
echo "Migrations directory: $MIGRATIONS_DIR"
echo ""

mapfile -t MIGRATION_FILES < <(find "$MIGRATIONS_DIR" -name "*.sql" | sort)

if [[ ${#MIGRATION_FILES[@]} -eq 0 ]]; then
  echo "No migration files found in $MIGRATIONS_DIR" >&2
  exit 1
fi

echo "Applying ${#MIGRATION_FILES[@]} migration(s)..."
echo ""

for file in "${MIGRATION_FILES[@]}"; do
  name="$(basename "$file")"
  echo "  -> $name"
  psql "$CONTROL_PLANE_DB_URL" -f "$file" -v ON_ERROR_STOP=1 --quiet
done

echo ""
echo "Bootstrap complete."
