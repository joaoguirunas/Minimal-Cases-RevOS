#!/usr/bin/env node
/**
 * lint-migrations.js — Migration discipline enforcer
 *
 * Error codes:
 *   MIG001: filename missing 14-digit timestamp prefix
 *   MIG002: CREATE TABLE without IF NOT EXISTS
 *   MIG003: CREATE INDEX without IF NOT EXISTS
 *   MIG004: ADD COLUMN without IF NOT EXISTS
 *   MIG005: DROP TABLE without @allow-destructive header
 *   MIG006: rollback file missing (unless @no-rollback)
 *   MIG007: file > 500 lines (warning — suggests split)
 *   MIG008: CREATE FUNCTION without OR REPLACE (warning)
 *
 * Usage:
 *   node scripts/lint-migrations.js --all
 *   node scripts/lint-migrations.js --changed-only
 *   node scripts/lint-migrations.js path/to/migration.sql [...]
 *
 * Skip rules per-file: add header comment `-- @lint-skip MIG002 reason: ...`
 * Skip rollback check: add header comment `-- @no-rollback reason: ...`
 * Allow DROP: add header comment `-- @allow-destructive reason: ...`
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, basename, dirname, join } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const MIGRATIONS_DIRS = [
  join(ROOT, 'supabase', 'migrations'),
  join(ROOT, 'supabase', 'migrations_adm'),
];

const ROLLBACK_DIR = join(ROOT, 'supabase', 'migrations', 'rollbacks');

// ─── Parse args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flagAll = args.includes('--all');
const flagChanged = args.includes('--changed-only');
const explicitFiles = args.filter(a => !a.startsWith('--'));

function getTargetFiles() {
  if (flagAll) {
    const files = [];
    for (const dir of MIGRATIONS_DIRS) {
      if (!existsSync(dir)) continue;
      readdirSync(dir)
        .filter(f => f.endsWith('.sql') && !f.endsWith('.rollback.sql') && !f.startsWith('_'))
        .forEach(f => files.push(join(dir, f)));
    }
    return files;
  }

  if (flagChanged) {
    try {
      const base = process.env.GITHUB_BASE_SHA ||
        execSync('git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main', { encoding: 'utf8' }).trim();
      const output = execSync(`git diff --name-only ${base} HEAD`, { encoding: 'utf8' });
      return output.trim().split('\n')
        .filter(f => f.match(/supabase\/migrations.*\.sql$/) && !f.endsWith('.rollback.sql') && !f.startsWith('_'))
        .map(f => join(ROOT, f))
        .filter(f => existsSync(f));
    } catch {
      console.error('ERR: --changed-only requires git history. Use --all instead.');
      process.exit(1);
    }
  }

  if (explicitFiles.length > 0) {
    return explicitFiles.map(f => resolve(f));
  }

  console.error('Usage: lint-migrations.js --all | --changed-only | <file> [<file> ...]');
  process.exit(1);
}

// ─── Parse skip directives from file header ───────────────────────────────────

function parseDirectives(content) {
  const skips = new Set();
  let noRollback = false;
  let allowDestructive = false;

  const header = content.slice(0, 2000);
  for (const line of header.split('\n')) {
    const trimmed = line.trim();
    const skipMatch = trimmed.match(/^--\s*@lint-skip\s+(MIG\d+)/i);
    if (skipMatch) skips.add(skipMatch[1].toUpperCase());
    if (trimmed.match(/^--\s*@no-rollback/i)) noRollback = true;
    if (trimmed.match(/^--\s*@allow-destructive/i)) allowDestructive = true;
  }

  return { skips, noRollback, allowDestructive };
}

// ─── Rules ────────────────────────────────────────────────────────────────────

function lintFile(filePath) {
  const name = basename(filePath);
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const { skips, noRollback, allowDestructive } = parseDirectives(content);

  const errors = [];
  const warnings = [];

  function err(code, line, msg) {
    if (!skips.has(code)) errors.push({ code, line, msg });
  }

  function warn(code, line, msg) {
    if (!skips.has(code)) warnings.push({ code, line, msg });
  }

  // MIG001 — timestamp prefix
  if (!name.match(/^\d{14}_/)) {
    err('MIG001', 0, `Filename must start with 14-digit timestamp (YYYYMMDDHHMMSS_). Got: ${name}`);
  }

  // MIG007 — file size warning
  if (lines.length > 500) {
    warn('MIG007', 0, `File has ${lines.length} lines (> 500). Consider splitting into smaller migrations.`);
  }

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const upper = line.toUpperCase().trim();

    // MIG002 — CREATE TABLE without IF NOT EXISTS
    if (upper.match(/^CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/)) {
      err('MIG002', lineNo, `CREATE TABLE without IF NOT EXISTS. Add IF NOT EXISTS for idempotency.`);
    }

    // MIG003 — CREATE INDEX without IF NOT EXISTS
    if (upper.match(/^CREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)/)) {
      err('MIG003', lineNo, `CREATE INDEX without IF NOT EXISTS. Add IF NOT EXISTS for idempotency.`);
    }

    // MIG004 — ADD COLUMN without IF NOT EXISTS
    if (upper.match(/ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)/)) {
      err('MIG004', lineNo, `ADD COLUMN without IF NOT EXISTS. Add IF NOT EXISTS for idempotency.`);
    }

    // MIG005 — DROP TABLE without @allow-destructive
    if (upper.match(/^\s*DROP\s+TABLE/) && !allowDestructive) {
      err('MIG005', lineNo, `DROP TABLE found without -- @allow-destructive header. Add header with justification.`);
    }

    // MIG008 — CREATE FUNCTION without OR REPLACE
    if (upper.match(/^CREATE\s+FUNCTION\s+/) || upper.match(/^CREATE\s+OR\s+REPLACE\s+FUNCTION\s+/)) {
      if (!upper.match(/^CREATE\s+OR\s+REPLACE\s+FUNCTION/)) {
        warn('MIG008', lineNo, `CREATE FUNCTION without OR REPLACE. Use CREATE OR REPLACE FUNCTION for idempotency.`);
      }
    }
  });

  // MIG006 — rollback file check
  if (!noRollback) {
    const rollbackPath = join(ROLLBACK_DIR, name.replace('.sql', '.rollback.sql'));
    // Also check same directory (migrations_adm pattern)
    const siblingRollback = filePath.replace('.sql', '.rollback.sql');
    if (!existsSync(rollbackPath) && !existsSync(siblingRollback)) {
      err('MIG006', 0, `Rollback file missing. Create ${name.replace('.sql', '.rollback.sql')} or add -- @no-rollback reason: ...`);
    }
  }

  return { filePath, name, errors, warnings };
}

// ─── Report ───────────────────────────────────────────────────────────────────

function formatResults(results) {
  const col = (s, n) => String(s).padEnd(n);
  const header = `${'FILE'.padEnd(60)} ${'LINE'.padEnd(6)} ${'CODE'.padEnd(8)} MESSAGE`;
  const sep = '─'.repeat(header.length);

  let errorCount = 0;
  let warnCount = 0;
  const rows = [];

  for (const { name, errors, warnings } of results) {
    for (const { code, line, msg } of errors) {
      rows.push(`${col(name, 60)} ${col(line || '-', 6)} ${col(code, 8)} ERROR: ${msg}`);
      errorCount++;
    }
    for (const { code, line, msg } of warnings) {
      rows.push(`${col(name, 60)} ${col(line || '-', 6)} ${col(code, 8)} WARN:  ${msg}`);
      warnCount++;
    }
  }

  if (rows.length === 0) {
    console.log(`\n  All ${results.length} migration(s) passed lint checks.\n`);
    return;
  }

  console.log(`\n${sep}`);
  console.log(header);
  console.log(sep);
  rows.forEach(r => console.log(r));
  console.log(sep);
  console.log(`\n  ${errorCount} error(s), ${warnCount} warning(s) across ${results.length} file(s).\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const files = getTargetFiles();

if (files.length === 0) {
  console.log('No migration files to lint.');
  process.exit(0);
}

const results = files.map(lintFile);
formatResults(results);

const hasErrors = results.some(r => r.errors.length > 0);
process.exit(hasErrors ? 1 : 0);
