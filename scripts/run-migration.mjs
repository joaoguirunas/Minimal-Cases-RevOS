/**
 * run-migration.mjs
 * Migração de configuração: wczlvfdfzipoexybeesy → xiucvgrwfleffqlozoad
 * Executa com: node scripts/run-migration.mjs
 */

const SRC = 'https://wczlvfdfzipoexybeesy.supabase.co';
const DST = 'https://xiucvgrwfleffqlozoad.supabase.co';
const SRC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indjemx2ZmRmemlwb2V4eWJlZXN5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM1NjIyNSwiZXhwIjoyMDkyOTMyMjI1fQ.xJNO4UCuwvIuRU_E2iYrcRtxuTt4m8OvqR_PnZ94HxA';
const DST_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpdWN2Z3J3ZmxlZmZxbG96b2FkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzYwOTM1NSwiZXhwIjoyMDkzMTg1MzU1fQ.dyeerKMuPTLdKT_dQCobNKTENR8rl9Y8g7HKrOYVT28';

// ─── helpers ──────────────────────────────────────────────────────────────────

// Remove colunas que o destination não tem
function strip(rows, ...cols) {
  return rows.map(r => {
    const o = { ...r };
    for (const c of cols) delete o[c];
    return o;
  });
}

async function read(url, table, query = '') {
  const res = await fetch(`${url}/rest/v1/${table}?select=*${query ? '&' + query : ''}`, {
    headers: { apikey: url === SRC ? SRC_KEY : DST_KEY, Authorization: `Bearer ${url === SRC ? SRC_KEY : DST_KEY}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`[READ ${table}] ${data?.message ?? JSON.stringify(data)}`);
  return data;
}

async function upsert(table, rows, conflict = 'id') {
  if (!rows.length) return 0;
  // batch de 50 para evitar payload muito grande
  let total = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const res = await fetch(`${DST}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: DST_KEY,
        Authorization: `Bearer ${DST_KEY}`,
        'Content-Type': 'application/json',
        Prefer: `resolution=merge-duplicates,return=minimal`,
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`[UPSERT ${table}] ${err?.message ?? res.status}`);
    }
    total += batch.length;
  }
  return total;
}

async function patchSettings(data) {
  const res = await fetch(`${DST}/rest/v1/settings?id=eq.${data.id}`, {
    method: 'PATCH',
    headers: {
      apikey: DST_KEY,
      Authorization: `Bearer ${DST_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // se não existe ainda, faz INSERT
    if (err?.code === 'PGRST116' || res.status === 406) {
      return upsert('settings', [data]);
    }
    throw new Error(`[PATCH settings] ${err?.message ?? res.status}`);
  }
  return 1;
}

function log(label, n, note = '') {
  const icon = n > 0 ? '✅' : '⚪';
  console.log(`  ${icon} ${label.padEnd(36)} ${String(n).padStart(3)} registro(s)${note ? '  ' + note : ''}`);
}

// ─── deduplicar agentes por nome (para templates) ─────────────────────────────

function deduplicateAgents(agents) {
  const seen = new Map();
  const result = [];
  // ordena por created_at mais recente para manter o mais novo de cada nome
  agents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  for (const agent of agents) {
    if (!agent.is_template) {
      result.push(agent); // sempre migra não-templates
      continue;
    }
    if (!seen.has(agent.name)) {
      seen.set(agent.name, true);
      result.push(agent);
    }
  }
  return result;
}

// ─── main ─────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log('  ORA — Migração de Configuração');
console.log(`  SOURCE:  ${SRC}`);
console.log(`  DEST:    ${DST}`);
console.log('══════════════════════════════════════════════════════════════\n');

// ── 1. Pipelines ──────────────────────────────────────────────────────────────
console.log('📦 GRUPO 1 — Pipelines e Etapas');

const pipelines = await read(SRC, 'leads_pipelines');
const n1 = await upsert('leads_pipelines', pipelines);
log('leads_pipelines', n1);

const stages = await read(SRC, 'leads_stages');
const n2 = await upsert('leads_stages', stages);
log('leads_stages', n2);

// ── 2. Campos Personalizados ──────────────────────────────────────────────────
console.log('\n📦 GRUPO 2 — Campos Personalizados');

const rawFields = await read(SRC, 'lead_field_definitions');
// 'ordem' → order_index: dest exige NOT NULL; usa ordem como fallback se order_index for null
const fields = strip(
  rawFields.map(f => ({ ...f, order_index: f.order_index ?? f.ordem ?? 0 })),
  'ordem'
);
const n3 = await upsert('lead_field_definitions', fields);
log('lead_field_definitions', n3);

// ── 3. Score Matrix ───────────────────────────────────────────────────────────
console.log('\n📦 GRUPO 3 — Score Matrix');

const scoreMatrix = await read(SRC, 'score_matrix');
const n4 = await upsert('score_matrix', scoreMatrix);
log('score_matrix', n4, scoreMatrix.length === 0 ? '(vazio no source)' : '');

// ── 4. Agentes IA ─────────────────────────────────────────────────────────────
console.log('\n📦 GRUPO 4 — Agentes IA');

const allAgents = await read(SRC, 'ai_agents');
// Normaliza colunas NOT NULL que o source antigo pode ter como null
const allAgentsFixed = allAgents.map(a => ({
  ...a,
  llm_provider:    a.llm_provider    ?? 'openai',
  llm_model:       a.llm_model       ?? 'gpt-4o-mini',
  llm_temperature: a.llm_temperature ?? 0.7,
  llm_max_tokens:  a.llm_max_tokens  ?? 1024,
  memory_window:   a.memory_window   ?? 20,
  buffer_ms:       a.buffer_ms       ?? 3000,
  stage_ids:       a.stage_ids       ?? [],
  channel_types:   a.channel_types   ?? [],
}));
const agents = deduplicateAgents(allAgentsFixed);
const skipped = allAgents.length - agents.length;

const n5 = await upsert('ai_agents', agents);
log('ai_agents', n5, skipped > 0 ? `(${skipped} duplicatas ignoradas)` : '');

// ai_agents_steps (coluna ai_agent_id)
const agentStepsRaw = await read(SRC, 'ai_agents_steps');
// Só migra steps cujo agent foi de fato migrado (deduplicação removeu duplicatas)
const migratedAgentIds = new Set(agents.map(a => a.id));
const agentSteps = strip(
  agentStepsRaw.filter(s => migratedAgentIds.has(s.ai_agent_id)),
  'pipeline_id', 'stage_id'
);
const skippedSteps = agentStepsRaw.length - agentSteps.length;
const n6 = await upsert('ai_agents_steps', agentSteps);
log('ai_agents_steps', n6, skippedSteps > 0 ? `(${skippedSteps} de agentes deduplicados ignorados)` : '');

// ── 5. Playbooks ──────────────────────────────────────────────────────────────
console.log('\n📦 GRUPO 5 — Playbooks / Coaching');

// playbook_templates PRIMEIRO (playbooks referencia parent_template_id)
let n8 = 0;
try {
  const pbt = await read(SRC, 'playbook_templates');
  n8 = await upsert('playbook_templates', pbt);
} catch (e) { /* tabela pode não existir no source */ }
log('playbook_templates', n8);

const playbooks = await read(SRC, 'playbooks');
const n7 = await upsert('playbooks', playbooks);
log('playbooks', n7);

// playbook_sections
let n9 = 0;
try {
  const pbs = await read(SRC, 'playbook_sections');
  n9 = await upsert('playbook_sections', pbs);
} catch (e) { }
log('playbook_sections', n9);

// playbook_criteria
let n10 = 0;
try {
  const pbc = await read(SRC, 'playbook_criteria');
  n10 = await upsert('playbook_criteria', pbc);
} catch (e) { }
log('playbook_criteria', n10);

// ── 6. Equipes ────────────────────────────────────────────────────────────────
console.log('\n📦 GRUPO 6 — Equipes');

const teams = await read(SRC, 'settings_teams');
const n11 = await upsert('settings_teams', teams);
log('settings_teams', n11);

// ── 7. Canais WhatsApp ────────────────────────────────────────────────────────
console.log('\n📦 GRUPO 7 — Canais WhatsApp');

// WhatsApp: destination já tem o mesmo canal (mesmo phone_number_id).
// Migrar apenas canais com phone_number_id que ainda não existam no dest.
const waChannels = await read(SRC, 'settings_whatsapp_channels');
const dstWa = await read(DST, 'settings_whatsapp_channels');
const dstPhoneIds = new Set(dstWa.map(c => c.phone_number_id));
const newChannels = strip(
  waChannels.filter(c => !dstPhoneIds.has(c.phone_number_id)),
  'meta_template_name'
);
const n12 = await upsert('settings_whatsapp_channels', newChannels);
const skippedWa = waChannels.length - newChannels.length;
log('settings_whatsapp_channels', n12,
  skippedWa > 0 ? `(${skippedWa} já existente(s) no dest — ignorado(s))` :
  newChannels.length > 0 ? '⚠️  rotacione tokens após migração' : '');

// ── 8. Automações ─────────────────────────────────────────────────────────────
console.log('\n📦 GRUPO 8 — Automações');

const automations = await read(SRC, 'schedule_automations');
const n13 = await upsert('schedule_automations', automations);
log('schedule_automations', n13);

// ── 9. Settings (empresa) ─────────────────────────────────────────────────────
console.log('\n📦 GRUPO 9 — Settings da Empresa');

const [srcSettings] = await read(SRC, 'settings');

// Verificar se destino já tem settings
const dstSettingsList = await read(DST, 'settings');

let n14 = 0;
try {
  if (dstSettingsList.length > 0) {
    const dstSettings = dstSettingsList[0];
    const merged = {
      ...dstSettings,
      company_name:        srcSettings.company_name,
      primary_color:       srcSettings.primary_color,
      secondary_color:     srcSettings.secondary_color,
      accent_color:        srcSettings.accent_color,
      timezone:            srcSettings.timezone,
      language:            srcSettings.language,
      currency:            srcSettings.currency,
      whatsapp_provider:   srcSettings.whatsapp_provider,
      brand_primary_color: srcSettings.brand_primary_color,
      brand_secondary_color: srcSettings.brand_secondary_color,
      product_name:        srcSettings.product_name,
      // logo_url: não migrar — aponta para storage do source
    };
    n14 = await patchSettings(merged);
    log('settings (update company_name/cores)', n14, `"${srcSettings.company_name}"`);
  } else {
    const toInsert = { ...srcSettings, logo_url: null };
    n14 = await upsert('settings', [toInsert]);
    log('settings (insert)', n14, '⚠️  logo_url removida (storage diferente)');
  }
} catch (e) {
  // Trigger de audit requer tenant_id — settings deve ser atualizado via UI
  log('settings', 0, `⚠️  skipped (audit trigger): atualize company_name="${srcSettings.company_name}" manualmente`);
}

// ── Resumo ────────────────────────────────────────────────────────────────────
const total = n1 + n2 + n3 + n4 + n5 + n6 + n7 + n8 + n9 + n10 + n11 + n12 + n13 + n14;

console.log('\n══════════════════════════════════════════════════════════════');
console.log(`  ✅ Migração concluída — ${total} registros migrados`);
console.log('══════════════════════════════════════════════════════════════\n');

if (waChannels.length > 0) {
  console.log('  ⚠️  AÇÃO NECESSÁRIA: Rotacione os access tokens WhatsApp no');
  console.log('     Meta Business Manager após verificar a migração.\n');
}
