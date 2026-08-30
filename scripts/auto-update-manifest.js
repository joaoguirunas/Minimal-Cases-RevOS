#!/usr/bin/env node
/**
 * Auto-update client-migrations.json manifest.
 *
 * Scans supabase/migrations/*.sql, compares against the current manifest,
 * and appends any NEW migrations that are missing.
 *
 * Exclusions (control-plane only):
 *   - Files containing 'adm_' in the filename
 *   - Files containing 'insights_context' (control-plane analytics)
 *   - Files from before the manifest epoch (order_index < 11 / pre-20260312)
 *
 * Usage:
 *   node scripts/auto-update-manifest.js          # dry-run (default)
 *   node scripts/auto-update-manifest.js --write   # actually write changes
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const MANIFEST_PATH = join(ROOT, 'supabase', 'client-migrations.json');

// Migrations before this timestamp are legacy (pre-manifest) and should be ignored
const EPOCH_TIMESTAMP = '20260312';

// Patterns that indicate control-plane-only migrations
const EXCLUDE_PATTERNS = [
  /adm_/i,
  /insights_context/i,
  /remove_ora_viva_america/i, // control-plane only — removes clients from adm_clients table
];

function shouldExclude(filename) {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filename));
}

function extractNameFromFilename(filename) {
  // Remove .sql extension
  let name = filename.replace(/\.sql$/, '');
  // Remove -ok suffix (legacy migrations)
  name = name.replace(/-ok$/, '');
  // Remove timestamp prefix (e.g. 20260327120000_)
  name = name.replace(/^\d+[_-]/, '');
  // Remove UUID-style suffixes (e.g. -692fb78f-5eae-40f2-b384-c364f9f20eb4)
  name = name.replace(/-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, '');
  // Replace remaining dashes with underscores
  name = name.replace(/-/g, '_');
  return name;
}

function getTimestamp(filename) {
  const match = filename.match(/^(\d{14})/);
  return match ? match[1] : '0';
}

function main() {
  const dryRun = !process.argv.includes('--write');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Auto-Update Client Migrations Manifest');
  console.log(`  Mode: ${dryRun ? 'DRY RUN (use --write to apply)' : 'WRITE'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Load current manifest
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const manifestFiles = new Set();
  const manifestTimestamps = new Set();
  for (const entry of manifest) {
    if (entry.file) {
      manifestFiles.add(entry.file);
      manifestTimestamps.add(getTimestamp(entry.file));
    }
    if (entry.files) entry.files.forEach(f => {
      manifestFiles.add(f);
      manifestTimestamps.add(getTimestamp(f));
    });
  }

  const maxOrderIndex = Math.max(...manifest.map(e => e.order_index));
  console.log(`  Manifest: ${manifest.length} entries (max order_index: ${maxOrderIndex})`);

  // 2. Scan all migration files
  const allFiles = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`  Migrations dir: ${allFiles.length} .sql files`);

  // 3. Find new migrations
  const newMigrations = [];
  let excluded = 0;
  let skippedEpoch = 0;

  for (const file of allFiles) {
    // Already in manifest
    if (manifestFiles.has(file)) continue;

    // Before epoch
    const ts = getTimestamp(file);
    if (ts < EPOCH_TIMESTAMP) {
      skippedEpoch++;
      continue;
    }

    // Control-plane exclusions
    if (shouldExclude(file)) {
      excluded++;
      continue;
    }

    // Skip if same timestamp already in manifest (e.g. foo.sql vs foo-ok.sql)
    if (manifestTimestamps.has(ts)) {
      skippedEpoch++; // count as skipped
      continue;
    }

    newMigrations.push(file);
  }

  console.log(`  Skipped (pre-epoch): ${skippedEpoch}`);
  console.log(`  Excluded (adm_/insights_context): ${excluded}`);
  console.log(`  New to add: ${newMigrations.length}\n`);

  if (newMigrations.length === 0) {
    console.log('  ✅ Manifest is up to date. Nothing to add.');
    return;
  }

  // 4. Sort new migrations by timestamp
  newMigrations.sort((a, b) => getTimestamp(a).localeCompare(getTimestamp(b)));

  // 5. Build new entries
  const newEntries = [];
  let nextIndex = maxOrderIndex + 1;

  for (const file of newMigrations) {
    const baseName = extractNameFromFilename(file);
    const paddedIndex = String(nextIndex).padStart(3, '0');
    const name = `${paddedIndex}_${baseName}`;

    newEntries.push({
      order_index: nextIndex,
      name,
      file,
    });

    const flag = dryRun ? '(dry)' : '  ✓';
    console.log(`  ${flag}  ${name}`);
    console.log(`        └─ ${file}`);

    nextIndex++;
  }

  // 6. Write updated manifest
  if (!dryRun) {
    const updated = [...manifest, ...newEntries];
    writeFileSync(MANIFEST_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf8');
    console.log(`\n  ✅ Manifest updated: ${manifest.length} → ${updated.length} entries`);
  } else {
    console.log(`\n  ℹ  ${newEntries.length} entries would be added. Run with --write to apply.`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main();
