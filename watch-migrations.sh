#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# watch-migrations.sh — Auto-apply Supabase migrations
#
# Watches supabase/migrations/ for new *.sql files (without -ok suffix).
# When detected, applies via Supabase MCP and renames to *-ok.sql.
#
# Usage:
#   ./watch-migrations.sh          # foreground (Ctrl+C to stop)
#   ./watch-migrations.sh &        # background
#   ./watch-migrations.sh stop     # kill background instance
#
# Requires: fswatch (brew install fswatch), supabase CLI
# ─────────────────────────────────────────────────────────────────────────────

MIGRATIONS_DIR="$(cd "$(dirname "$0")/supabase/migrations" && pwd)"
PROJECT_ID="ohzwetkaazgxafubzvop"
LOG_FILE="$(dirname "$0")/.migration-watcher.log"
PID_FILE="$(dirname "$0")/.migration-watcher.pid"

# ── stop command ──────────────────────────────────────────────────────────────
if [[ "$1" == "stop" ]]; then
  if [[ -f "$PID_FILE" ]]; then
    PID=$(cat "$PID_FILE")
    kill "$PID" 2>/dev/null && echo "Watcher stopped (PID $PID)" || echo "Watcher not running"
    rm -f "$PID_FILE"
  else
    echo "No watcher PID file found"
  fi
  exit 0
fi

# ── helpers ───────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

pending_migrations() {
  find "$MIGRATIONS_DIR" -maxdepth 1 -name "*.sql" ! -name "*-ok.sql" | sort
}

apply_migration() {
  local file="$1"
  local name
  name=$(basename "$file" .sql)
  local ok_file="${file%.sql}-ok.sql"

  log "▶ Applying: $name"

  # Apply via supabase CLI (uses local config + remote project)
  if supabase db execute --file "$file" --project-ref "$PROJECT_ID" 2>>"$LOG_FILE"; then
    mv "$file" "$ok_file"
    log "✓ Applied & renamed: $(basename "$ok_file")"
  else
    log "✗ Failed: $name — check $LOG_FILE"
  fi
}

# ── startup ───────────────────────────────────────────────────────────────────
echo $$ > "$PID_FILE"
log "Migration watcher started — watching $MIGRATIONS_DIR"
log "PID: $$ | Log: $LOG_FILE"

# Apply any already-pending migrations on start
for f in $(pending_migrations); do
  log "Found pending on start: $(basename "$f")"
  apply_migration "$f"
done

# ── main watch loop ───────────────────────────────────────────────────────────
/opt/homebrew/bin/fswatch \
  --event Created \
  --event Updated \
  --event Renamed \
  --latency 1 \
  --recursive \
  "$MIGRATIONS_DIR" | while read -r changed_path; do

  # Only care about .sql files without -ok suffix
  if [[ "$changed_path" == *.sql ]] && [[ "$changed_path" != *-ok.sql ]]; then
    # Small delay to ensure file is fully written
    sleep 0.5

    if [[ -f "$changed_path" ]]; then
      log "Detected: $(basename "$changed_path")"
      apply_migration "$changed_path"
    fi
  fi
done
