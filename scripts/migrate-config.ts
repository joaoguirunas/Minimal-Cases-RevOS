/**
 * migrate-config.ts
 *
 * Migra dados de configuração de um projeto Supabase (SOURCE) para outro (DESTINATION).
 * Tabelas migradas: pipelines, stages, AI agents, campos personalizados, score matrix,
 * playbooks, equipes, respostas rápidas, automações, canais.
 *
 * Uso:
 *   npx tsx scripts/migrate-config.ts
 *
 * Variáveis de ambiente necessárias (criar .env.migration):
 *   SOURCE_URL             = https://wczlvfdfzipoexybeesy.supabase.co
 *   SOURCE_SERVICE_KEY     = eyJ...
 *   SOURCE_TENANT_ID       = uuid-do-tenant-no-source  (deixar vazio para auto-detectar)
 *   DEST_URL               = https://xiucvgrwfleffqlozoad.supabase.co
 *   DEST_SERVICE_KEY       = eyJ...
 *   DEST_TENANT_ID         = uuid-do-tenant-no-dest    (deixar vazio para auto-detectar)
 *   DRY_RUN                = true  (não escreve nada, só lê e reporta)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

function loadEnv() {
  const envFile = path.join(process.cwd(), '.env.migration');
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      process.env[key.trim()] = rest.join('=').trim();
    }
  }
}

loadEnv();

const SOURCE_URL = process.env.SOURCE_URL ?? '';
const SOURCE_SERVICE_KEY = process.env.SOURCE_SERVICE_KEY ?? '';
const DEST_URL = process.env.DEST_URL ?? '';
const DEST_SERVICE_KEY = process.env.DEST_SERVICE_KEY ?? '';
const DRY_RUN = process.env.DRY_RUN === 'true';

// IDs de tenant (UUID) — se vazio, auto-detectado via crm_tenants
let SOURCE_TENANT_ID = process.env.SOURCE_TENANT_ID ?? '';
let DEST_TENANT_ID = process.env.DEST_TENANT_ID ?? '';

function abort(msg: string): never {
  console.error(`\n❌ ERRO: ${msg}\n`);
  process.exit(1);
}

if (!SOURCE_URL || !SOURCE_SERVICE_KEY) abort('SOURCE_URL e SOURCE_SERVICE_KEY são obrigatórios.');
if (!DEST_URL || !DEST_SERVICE_KEY) abort('DEST_URL e DEST_SERVICE_KEY são obrigatórios.');

// ─────────────────────────────────────────────────────────────────────────────
// Clientes Supabase
// ─────────────────────────────────────────────────────────────────────────────

const src = createClient(SOURCE_URL, SOURCE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const dst = createClient(DEST_URL, DEST_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function log(msg: string) { console.log(msg); }
function logOk(msg: string) { console.log(`  ✅ ${msg}`); }
function logSkip(msg: string) { console.log(`  ⏭️  ${msg}`); }
function logWarn(msg: string) { console.warn(`  ⚠️  ${msg}`); }

async function detectTenantId(client: SupabaseClient, label: string): Promise<string> {
  // Tenta crm_tenants primeiro
  const { data: tenants, error } = await client
    .from('crm_tenants')
    .select('id, name, slug')
    .limit(10);

  if (!error && tenants && tenants.length > 0) {
    if (tenants.length === 1) {
      log(`  → [${label}] tenant detectado: ${tenants[0].name} (${tenants[0].id})`);
      return tenants[0].id;
    }
    log(`\n  [${label}] Múltiplos tenants encontrados:`);
    tenants.forEach((t, i) => log(`    ${i + 1}. ${t.name} — ${t.slug} (${t.id})`));
    abort(`[${label}] Múltiplos tenants. Defina ${label === 'SOURCE' ? 'SOURCE_TENANT_ID' : 'DEST_TENANT_ID'} no .env.migration.`);
  }

  // Fallback: busca settings com company_name
  const { data: settings } = await client
    .from('settings')
    .select('tenant_id, company_name')
    .not('tenant_id', 'is', null)
    .limit(1)
    .single();

  if (settings?.tenant_id) {
    log(`  → [${label}] tenant via settings: ${settings.company_name} (${settings.tenant_id})`);
    return settings.tenant_id;
  }

  abort(`[${label}] Não foi possível detectar o tenant_id automaticamente. Defina no .env.migration.`);
}

/**
 * Troca tenant_id em todos os registros de um array.
 * Também trata arrays aninhados se necessário.
 */
function remap<T extends Record<string, unknown>>(rows: T[], srcTenantId: string, dstTenantId: string): T[] {
  return rows.map(row => {
    const remapped = { ...row };
    for (const key of Object.keys(remapped)) {
      if (remapped[key] === srcTenantId) {
        (remapped as Record<string, unknown>)[key] = dstTenantId;
      }
    }
    return remapped;
  });
}

type MigrateTableOptions = {
  table: string;
  srcFilter?: (q: ReturnType<SupabaseClient['from']>) => ReturnType<SupabaseClient['from']>;
  transformRows?: <T extends Record<string, unknown>>(rows: T[]) => T[];
  conflictColumns?: string;   // para onConflict upsert
  skipColumns?: string[];     // colunas a omitir no insert
};

async function migrateTable(opts: MigrateTableOptions): Promise<number> {
  const { table, conflictColumns = 'id' } = opts;

  // 1. Lê do source
  let query = src.from(table).select('*');
  if (SOURCE_TENANT_ID) {
    // Filtra por tenant se a tabela tiver essa coluna
    query = query.eq('tenant_id', SOURCE_TENANT_ID);
  }
  if (opts.srcFilter) {
    query = opts.srcFilter(query) as typeof query;
  }

  const { data, error } = await query;

  if (error) {
    logWarn(`[${table}] Erro ao ler source: ${error.message}`);
    return 0;
  }
  if (!data || data.length === 0) {
    logSkip(`[${table}] Nenhum registro encontrado no source.`);
    return 0;
  }

  // 2. Remap tenant_id + transformações custom
  let rows = remap(data as Record<string, unknown>[], SOURCE_TENANT_ID, DEST_TENANT_ID) as Record<string, unknown>[];
  if (opts.transformRows) {
    rows = opts.transformRows(rows as Parameters<typeof opts.transformRows>[0]) as typeof rows;
  }

  // Remove colunas indesejadas
  if (opts.skipColumns && opts.skipColumns.length > 0) {
    rows = rows.map(row => {
      const r = { ...row };
      for (const col of opts.skipColumns!) delete r[col];
      return r;
    });
  }

  if (DRY_RUN) {
    logSkip(`[${table}] DRY_RUN — ${rows.length} registros seriam inseridos.`);
    return rows.length;
  }

  // 3. Upserta no destination em batches de 100
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error: upsertError } = await dst
      .from(table)
      .upsert(batch, { onConflict: conflictColumns, ignoreDuplicates: false });

    if (upsertError) {
      logWarn(`[${table}] Erro no batch ${i / BATCH + 1}: ${upsertError.message}`);
      // Tenta inserir linha a linha para identificar o problemático
      for (const row of batch) {
        const { error: rowErr } = await dst
          .from(table)
          .upsert(row, { onConflict: conflictColumns, ignoreDuplicates: false });
        if (rowErr) {
          logWarn(`  → Linha ignorada (${JSON.stringify(row).slice(0, 120)}): ${rowErr.message}`);
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }
  }

  logOk(`[${table}] ${inserted} / ${rows.length} registros migrados.`);
  return inserted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ordem de migração (respeita FKs)
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  log('\n══════════════════════════════════════════════════════════════');
  log('  ORA — Migração de Configuração entre projetos Supabase');
  log('══════════════════════════════════════════════════════════════');
  log(`  Source:      ${SOURCE_URL}`);
  log(`  Destination: ${DEST_URL}`);
  log(`  Modo:        ${DRY_RUN ? '🔍 DRY RUN (somente leitura)' : '✍️  WRITE (vai inserir dados)'}`);
  log('');

  // ── Detecta tenant IDs ──────────────────────────────────────────
  log('📡 Detectando tenant IDs...');
  if (!SOURCE_TENANT_ID) SOURCE_TENANT_ID = await detectTenantId(src, 'SOURCE');
  if (!DEST_TENANT_ID) DEST_TENANT_ID = await detectTenantId(dst, 'DESTINATION');
  log(`\n  SOURCE tenant_id:  ${SOURCE_TENANT_ID}`);
  log(`  DEST   tenant_id:  ${DEST_TENANT_ID}\n`);

  const results: Record<string, number> = {};

  // ── GRUPO 1: CRM Core ───────────────────────────────────────────
  log('📦 GRUPO 1 — CRM: Pipelines e Etapas');

  results['crm_pipelines'] = await migrateTable({
    table: 'crm_pipelines',
    conflictColumns: 'id',
  });

  results['crm_stages'] = await migrateTable({
    table: 'crm_stages',
    conflictColumns: 'id',
  });

  // ── GRUPO 2: Campos Personalizados ──────────────────────────────
  log('\n📦 GRUPO 2 — Campos Personalizados');

  results['lead_field_definitions'] = await migrateTable({
    table: 'lead_field_definitions',
    conflictColumns: 'id',
  });

  // ── GRUPO 3: Score Matrix ────────────────────────────────────────
  log('\n📦 GRUPO 3 — Score Matrix e Categorias');

  results['score_matrix'] = await migrateTable({
    table: 'score_matrix',
    conflictColumns: 'id',
  });

  results['score_categories'] = await migrateTable({
    table: 'score_categories',
    conflictColumns: 'id',
  });

  // ── GRUPO 4: Agentes IA ─────────────────────────────────────────
  log('\n📦 GRUPO 4 — Agentes IA');

  results['ai_agents'] = await migrateTable({
    table: 'ai_agents',
    conflictColumns: 'id',
    // Não migrar o log de execução, apenas a configuração
  });

  results['ai_agents_steps'] = await migrateTable({
    table: 'ai_agents_steps',
    conflictColumns: 'id',
  });

  results['ai_agents_score_matrix'] = await migrateTable({
    table: 'ai_agents_score_matrix',
    conflictColumns: 'id',
  });

  // ── GRUPO 5: Playbooks / Coaching ───────────────────────────────
  log('\n📦 GRUPO 5 — Playbooks e Coaching');

  results['playbooks'] = await migrateTable({
    table: 'playbooks',
    conflictColumns: 'id',
  });

  results['playbook_sections'] = await migrateTable({
    table: 'playbook_sections',
    conflictColumns: 'id',
  });

  results['playbook_criteria'] = await migrateTable({
    table: 'playbook_criteria',
    conflictColumns: 'id',
  });

  results['playbook_templates'] = await migrateTable({
    table: 'playbook_templates',
    conflictColumns: 'id',
  });

  // ── GRUPO 6: Equipes e Usuários ─────────────────────────────────
  log('\n📦 GRUPO 6 — Equipes');

  results['settings_teams'] = await migrateTable({
    table: 'settings_teams',
    conflictColumns: 'id',
  });

  // ── GRUPO 7: Respostas Rápidas ──────────────────────────────────
  log('\n📦 GRUPO 7 — Respostas Rápidas');

  results['canned_responses'] = await migrateTable({
    table: 'canned_responses',
    conflictColumns: 'id',
  });

  // ── GRUPO 8: Agendamento ────────────────────────────────────────
  log('\n📦 GRUPO 8 — Regras de Agendamento');

  results['booking_rule_sets'] = await migrateTable({
    table: 'booking_rule_sets',
    conflictColumns: 'id',
  });

  results['booking_rules'] = await migrateTable({
    table: 'booking_rules',
    conflictColumns: 'id',
  });

  results['schedule_automations'] = await migrateTable({
    table: 'schedule_automations',
    conflictColumns: 'id',
  });

  // ── GRUPO 9: Canais (cuidado com secrets) ───────────────────────
  log('\n📦 GRUPO 9 — Canais (WhatsApp, Instagram, Email)');
  log('  ⚠️  Atenção: access tokens migrados em texto plano. Rotacione após migração!');

  results['settings_whatsapp_channels'] = await migrateTable({
    table: 'settings_whatsapp_channels',
    conflictColumns: 'id',
  });

  results['omni_channel_configs'] = await migrateTable({
    table: 'omni_channel_configs',
    conflictColumns: 'id',
  });

  results['instagram_automations'] = await migrateTable({
    table: 'instagram_automations',
    conflictColumns: 'id',
  });

  // ── GRUPO 10: Settings Gerais ───────────────────────────────────
  log('\n📦 GRUPO 10 — Configurações Gerais do Tenant');

  results['settings'] = await migrateTable({
    table: 'settings',
    conflictColumns: 'id',
  });

  // ── RESUMO ──────────────────────────────────────────────────────
  log('\n══════════════════════════════════════════════════════════════');
  log(DRY_RUN ? '  RESULTADO (DRY RUN — nada foi escrito)' : '  RESULTADO FINAL');
  log('══════════════════════════════════════════════════════════════');

  let total = 0;
  for (const [table, count] of Object.entries(results)) {
    const icon = count > 0 ? '✅' : '⚪';
    log(`  ${icon} ${table.padEnd(35)} ${count} registros`);
    total += count;
  }
  log(`\n  Total: ${total} registros ${DRY_RUN ? 'identificados' : 'migrados'}`);

  if (DRY_RUN) {
    log('\n  💡 Para executar a migração real, remova DRY_RUN=true do .env.migration');
  }

  log('\n══════════════════════════════════════════════════════════════\n');
}

run().catch(err => {
  console.error('\n❌ Erro fatal:', err);
  process.exit(1);
});
