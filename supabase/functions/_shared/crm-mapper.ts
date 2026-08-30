/**
 * CRM Mapper — Shared module for mapping form data → CRM entities
 *
 * Extracted from lp-submit for reuse by meta-inbound (leadgen handler).
 *
 * Handles:
 *   - Namespace bucket parsing (pessoa.*, empresa.*, score.*, custom.*)
 *   - Upsert clients_people
 *   - Upsert clients_companies + junction
 *   - Score matrix resolution + application
 *   - Custom field persistence via RPC
 *   - Lead creation in pipeline (dedup by people_id + pipeline_id)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from './logger.ts';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PessoaBucket {
  nome?: string;
  email?: string;
  whatsapp?: string;
  instagram?: string;
  notas?: string;
  documento?: string;
}

export interface EmpresaBucket {
  nome?: string;
  site?: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
}

export type ScoreBucket = Record<string, string>;

export interface CrmMappedData {
  pessoa: PessoaBucket;
  empresa: EmpresaBucket;
  score: ScoreBucket;
  customFields: { key: string; value: string }[];
}

export interface CrmResult {
  personId: string | null;
  companyId: string | null;
  leadId: string | null;
  isExistingLead: boolean;
}

// ── Column maps ──────────────────────────────────────────────────────────────

export const PESSOA_COLUMN_MAP: Record<string, string> = {
  nome:      'name',
  email:     'email',
  whatsapp:  'whatsapp',
  instagram: 'instagram_handle',
  telefone:  'telefone',
  notas:     'notes',
  documento: 'document',
};

export const EMPRESA_COLUMN_MAP: Record<string, string> = {
  nome:     'trade_name',
  site:     'website',
  cnpj:     'tax_id',
  telefone: 'phone',
  email:    'email',
};

// ── Phone normalization ──────────────────────────────────────────────────────

export function normalizePhone(raw: string, countryCode = '55'): string {
  const digits = raw.replace(/\D/g, '').slice(0, 20);
  if (!digits || digits.length < 8) return '';
  if (digits.startsWith(countryCode) && digits.length >= 12) return digits;
  const cleaned = digits.startsWith('0') ? digits.slice(1) : digits;
  return countryCode + cleaned;
}

// ── Parse namespace buckets from flat key-value data ─────────────────────────

/**
 * Parse CRM fields from flat { crm_field: value } map into namespace buckets.
 * Handles legacy bare keys (nome→pessoa.nome, email→pessoa.email, etc).
 */
export function parseCrmBuckets(
  crmData: Record<string, string>,
): CrmMappedData {
  const pessoa: PessoaBucket = {};
  const empresa: EmpresaBucket = {};
  const score: ScoreBucket = {};
  const customFields: { key: string; value: string }[] = [];

  for (const [rawKey, val] of Object.entries(crmData)) {
    if (!val) continue;

    // Normalize legacy bare keys → pessoa.* namespace
    const crmField = rawKey.includes('.') ? rawKey : `pessoa.${
      rawKey === 'nome' ? 'nome' :
      rawKey === 'email' ? 'email' :
      rawKey === 'telefone' ? 'whatsapp' :
      rawKey === 'observacoes' ? 'notas' :
      rawKey
    }`;

    const [ns, key] = crmField.split('.');

    if (ns === 'pessoa') {
      (pessoa as Record<string, string>)[key] = val;
    } else if (ns === 'empresa') {
      (empresa as Record<string, string>)[key] = val;
    } else if (ns === 'score') {
      (score as Record<string, string>)[key] = val;
    } else if (ns === 'custom') {
      customFields.push({ key, value: val });
    }
  }

  return { pessoa, empresa, score, customFields };
}

// ── Upsert clients_people ────────────────────────────────────────────────────

export async function upsertPerson(
  supabase: ReturnType<typeof createClient>,
  pessoa: PessoaBucket,
  source: string,
): Promise<string | null> {
  if (!pessoa.email && !pessoa.nome && !pessoa.whatsapp) return null;

  const personName = pessoa.nome || pessoa.email?.split('@')[0] || 'Lead';

  if (pessoa.whatsapp) {
    pessoa.whatsapp = normalizePhone(pessoa.whatsapp);
  }

  let personId: string | null = null;

  // Try find existing by email, then by whatsapp
  if (pessoa.email) {
    const { data: byEmail } = await supabase
      .from('clients_people')
      .select('id')
      .eq('email', pessoa.email)
      .neq('status', 'merged')
      .maybeSingle();
    if (byEmail) personId = byEmail.id;
  }

  if (!personId && pessoa.whatsapp) {
    const { data: byPhone } = await supabase
      .from('clients_people')
      .select('id')
      .eq('whatsapp', pessoa.whatsapp)
      .neq('status', 'merged')
      .maybeSingle();
    if (byPhone) personId = byPhone.id;
  }

  if (personId) {
    // Update existing person
    const updatePayload: Record<string, string | null> = { source };
    for (const [key, col] of Object.entries(PESSOA_COLUMN_MAP)) {
      const val = (pessoa as Record<string, string | undefined>)[key];
      if (val !== undefined) updatePayload[col] = val;
    }
    await supabase.from('clients_people').update(updatePayload).eq('id', personId);
  } else {
    // Insert new person
    const insertPayload: Record<string, string | null> = {
      source,
      name: personName,
    };
    for (const [key, col] of Object.entries(PESSOA_COLUMN_MAP)) {
      if (col === 'name') continue;
      const val = (pessoa as Record<string, string | undefined>)[key];
      if (val !== undefined && val !== null && val !== '') insertPayload[col] = val;
    }

    const { data: newPerson, error: insErr } = await supabase
      .from('clients_people')
      .insert(insertPayload)
      .select('id')
      .single();
    if (insErr) {
      console.error('crm-mapper: insert clients_people error:', insErr);
    } else if (newPerson) {
      personId = newPerson.id;
    }
  }

  return personId;
}

// ── Upsert clients_companies + junction ──────────────────────────────────────

export async function upsertCompany(
  supabase: ReturnType<typeof createClient>,
  empresa: EmpresaBucket,
  personId: string,
): Promise<string | null> {
  if (!empresa.nome) return null;

  const companyPayload: Record<string, string | null> = {};
  for (const [key, col] of Object.entries(EMPRESA_COLUMN_MAP)) {
    const val = (empresa as Record<string, string | undefined>)[key];
    if (val !== undefined) companyPayload[col] = val;
  }

  const normalizedName = empresa.nome.trim();
  let companyId: string | null = null;

  // Dedup by CNPJ first, then by name
  if (empresa.cnpj) {
    const cnpjDigits = empresa.cnpj.replace(/\D/g, '');
    if (cnpjDigits) {
      const { data: byCnpj } = await supabase
        .from('clients_companies')
        .select('id')
        .eq('tax_id', cnpjDigits)
        .maybeSingle();
      if (byCnpj) companyId = byCnpj.id;
    }
  }

  if (!companyId) {
    const { data: byName } = await supabase
      .from('clients_companies')
      .select('id')
      .ilike('trade_name', normalizedName)
      .maybeSingle();
    if (byName) companyId = byName.id;
  }

  if (companyId) {
    await supabase.from('clients_companies').update(companyPayload).eq('id', companyId);
  } else {
    const { data: newCompany } = await supabase
      .from('clients_companies')
      .insert({ ...companyPayload, trade_name: normalizedName })
      .select('id')
      .single();
    if (newCompany) companyId = newCompany.id;
  }

  // Link person ↔ company (upsert to avoid race condition on concurrent requests)
  if (companyId) {
    const { error: linkErr } = await supabase
      .from('clients_people_companies')
      .upsert(
        { people_id: personId, company_id: companyId },
        { onConflict: 'people_id,company_id' },
      );
    if (linkErr) {
      // Fallback: if no unique constraint, try insert and ignore duplicate
      await supabase
        .from('clients_people_companies')
        .insert({ people_id: personId, company_id: companyId })
        .then(() => null)
        .catch(() => null);
    }
  }

  return companyId;
}

// ── Apply score ──────────────────────────────────────────────────────────────

export async function applyScore(
  supabase: ReturnType<typeof createClient>,
  score: ScoreBucket,
  personId: string,
  log: ReturnType<typeof createLogger>,
): Promise<void> {
  const scoreValues = Object.values(score).filter(Boolean);
  if (scoreValues.length === 0) return;

  // UUID pattern: 8-4-4-4-12 hex characters
  const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

  let resolvedItemIds: string[];

  if (scoreValues.every(isUuid)) {
    // Fast path: values are already UUIDs from options_mapping resolution
    resolvedItemIds = scoreValues;
  } else {
    // Fallback: values are text (Meta option keys/labels) — resolve by name match
    log.info('score: resolving text values to item IDs', { values: scoreValues });
    const normalise = (s: string) => s.toLowerCase().replace(/[\s_]+/g, '_');
    const normValues = scoreValues.map(normalise);

    const { data: allItems, error: allItemsErr } = await supabase
      .from('score_category_items')
      .select('id, category_id, name')
      .eq('active', true);

    if (allItemsErr || !allItems || allItems.length === 0) {
      log.warn('score: no active category items found', { error: allItemsErr?.message });
      return;
    }

    resolvedItemIds = [];
    for (const normVal of normValues) {
      const match = allItems.find(item => normalise(item.name) === normVal);
      if (match) {
        resolvedItemIds.push(match.id);
      }
    }

    if (resolvedItemIds.length === 0) {
      log.warn('score: no items matched by name', { attempted: scoreValues });
      return;
    }
    if (resolvedItemIds.length < scoreValues.length) {
      log.warn('score: partial match', { matched: resolvedItemIds.length, total: scoreValues.length });
    }
  }

  // Resolve category_id for each item
  const { data: itemRows, error: itemErr } = await supabase
    .from('score_category_items')
    .select('id, category_id')
    .in('id', resolvedItemIds);

  if (itemErr) {
    log.error('score: failed to resolve category items', { error: itemErr.message });
    return;
  }
  if (!itemRows || itemRows.length === 0) {
    log.warn('score: no category items found for IDs', { ids: resolvedItemIds });
    return;
  }

  const catSelections: Record<string, string[]> = {};
  for (const row of itemRows) {
    if (!catSelections[row.category_id]) {
      catSelections[row.category_id] = [];
    }
    catSelections[row.category_id].push(row.id);
  }

  const { data: matrixRows, error: matrixErr } = await supabase
    .from('score_matrix')
    .select('id, score_number')
    .contains('category_selections', catSelections)
    .limit(1);

  if (matrixErr) {
    log.error('score: matrix query failed', { error: matrixErr.message });
    return;
  }

  if (matrixRows && matrixRows.length > 0) {
    const matrix = matrixRows[0];
    const { error: scoreUpdateErr } = await supabase
      .from('clients_people')
      .update({ score_matrix_id: matrix.id, score: matrix.score_number })
      .eq('id', personId);
    if (scoreUpdateErr) {
      log.error('score: update failed', { error: scoreUpdateErr.message });
    } else {
      log.info('score: applied', { matrixId: matrix.id, score: matrix.score_number });
    }
  } else {
    log.warn('score: no matrix match', { catSelections, personId });
  }
}

// ── Persist custom fields ────────────────────────────────────────────────────

/**
 * Custom fields whose value must be APPENDED instead of overwritten when the
 * person already has a value. Each repeated submission for the same person
 * concatenates the new value with '; ' as separator; duplicates are skipped.
 *
 * Background: lead_field_values has UNIQUE (entity_type, entity_id,
 * field_definition_id) — physically one row per (person, field). The default
 * RPC `upsert_crm_field_value` overwrites. For 'curso' we must preserve the
 * full history of which courses a person engaged with via webhook.
 * (Decision by lead, 2026-05-27 — see PIPE-2.1.)
 *
 * The concat is done DB-side by `append_crm_field_value` (migration
 * 20260527150000) which holds a pg_advisory_xact_lock on (person, definition)
 * to prevent lost-update races between concurrent webhook hits.
 */
/** Fields that use append-on-conflict semantics (DB-level atomic concat via
 *  append_crm_field_value RPC). Import this set in any edge function that
 *  persists custom fields independently of processCrmData/persistCustomFields.
 *  PIPE-3.2: exported so lp-submit and future callers share a single source of truth.
 */
export const APPEND_ON_CONFLICT_FIELDS = new Set(['curso']);

export async function persistCustomFields(
  supabase: ReturnType<typeof createClient>,
  customFields: { key: string; value: string }[],
  personId: string,
): Promise<void> {
  for (const cf of customFields) {
    const useAppend = APPEND_ON_CONFLICT_FIELDS.has(cf.key);

    if (useAppend) {
      const { error } = await supabase.rpc('append_crm_field_value', {
        p_person_id: personId,
        p_field_key: cf.key,
        p_new_value: cf.value,
      });
      if (error) {
        console.error(`crm-mapper: append custom field '${cf.key}' failed:`, error.message);
      }
    } else {
      const { error } = await supabase.rpc('upsert_crm_field_value', {
        p_person_id: personId,
        p_field_key: cf.key,
        p_value: cf.value,
      });
      if (error) {
        console.error(`crm-mapper: custom field '${cf.key}' save failed:`, error.message);
      }
    }
  }
}

// ── Create lead ──────────────────────────────────────────────────────────────

export async function createLead(
  supabase: ReturnType<typeof createClient>,
  opts: {
    personId: string;
    companyId: string | null;
    pipelineId: string | null;
    configuredStageId?: string | null;
    personName: string;
    formName: string;
    source: string;
    forceCreateLead?: boolean;
    utm?: {
      source?: string | null;
      medium?: string | null;
      campaign?: string | null;
      content?: string | null;
      term?: string | null;
    };
  },
): Promise<{ leadId: string | null; isExisting: boolean }> {
  const { personId, companyId, pipelineId, configuredStageId, personName, formName, utm, forceCreateLead } = opts;

  // Resolve initial stage
  let firstStageId: string | null = configuredStageId ?? null;
  if (!firstStageId && pipelineId) {
    const { data: firstStage } = await supabase
      .from('leads_stages')
      .select('id')
      .eq('leads_pipelines_id', pipelineId)
      .eq('active', true)
      .order('order_index', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstStage) firstStageId = firstStage.id;
  }

  const description = `Origem: ${opts.source} — ${formName}`;

  if (pipelineId) {
    // Check for existing lead in this pipeline (unless forceCreateLead is set)
    const existingLead = forceCreateLead
      ? null
      : (await supabase
          .from('leads')
          .select('id')
          .eq('people_id', personId)
          .eq('leads_pipelines_id', pipelineId)
          .maybeSingle()).data;

    if (existingLead) {
      const updatePayload: Record<string, unknown> = {
        description,
        status: 'in_progress',
        utm_source: utm?.source ?? null,
        utm_medium: utm?.medium ?? null,
        utm_campaign: utm?.campaign ?? null,
        utm_content: utm?.content ?? null,
        utm_term: utm?.term ?? null,
      };
      if (firstStageId) updatePayload.leads_stages_id = firstStageId;
      if (companyId) updatePayload.company_id = companyId;
      await supabase.from('leads').update(updatePayload).eq('id', existingLead.id);
      return { leadId: existingLead.id, isExisting: true };
    }

    const { data: newLead, error: leadErr } = await supabase
      .from('leads')
      .insert({
        people_id: personId,
        title: personName,
        leads_pipelines_id: pipelineId,
        leads_stages_id: firstStageId,
        company_id: companyId || null,
        status: 'in_progress',
        description,
        utm_source: utm?.source ?? null,
        utm_medium: utm?.medium ?? null,
        utm_campaign: utm?.campaign ?? null,
        utm_content: utm?.content ?? null,
        utm_term: utm?.term ?? null,
      })
      .select('id')
      .single();
    if (leadErr) console.error('crm-mapper: insert lead error:', JSON.stringify(leadErr));
    return { leadId: newLead?.id ?? null, isExisting: false };
  }

  // No pipeline — use first active pipeline as fallback
  const { data: firstPipeline } = await supabase
    .from('leads_pipelines')
    .select('id')
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const fallbackPipelineId = firstPipeline?.id ?? null;

  let fallbackStageId: string | null = null;
  if (fallbackPipelineId) {
    const { data: fs } = await supabase
      .from('leads_stages')
      .select('id')
      .eq('leads_pipelines_id', fallbackPipelineId)
      .eq('active', true)
      .order('order_index', { ascending: true })
      .limit(1)
      .maybeSingle();
    fallbackStageId = fs?.id ?? null;
  }

  const { data: newLead, error: leadErr } = await supabase
    .from('leads')
    .insert({
      people_id: personId,
      title: personName,
      leads_pipelines_id: fallbackPipelineId,
      leads_stages_id: fallbackStageId,
      company_id: companyId || null,
      status: 'in_progress',
      description,
      utm_source: utm?.source ?? null,
      utm_medium: utm?.medium ?? null,
      utm_campaign: utm?.campaign ?? null,
    })
    .select('id')
    .single();
  if (leadErr) console.error('crm-mapper: insert lead (fallback) error:', JSON.stringify(leadErr));
  return { leadId: newLead?.id ?? null, isExisting: false };
}

// ── Full CRM pipeline (convenience) ─────────────────────────────────────────

/**
 * Full CRM pipeline: parse buckets → upsert person → company → score → custom → lead.
 * Used by both lp-submit and meta-inbound leadgen handler.
 */
export async function processCrmData(
  supabase: ReturnType<typeof createClient>,
  crmData: Record<string, string>,
  opts: {
    pipelineId: string | null;
    configuredStageId?: string | null;
    formName: string;
    source: string;
    forceCreateLead?: boolean;
    utm?: {
      source?: string | null;
      medium?: string | null;
      campaign?: string | null;
      content?: string | null;
      term?: string | null;
    };
  },
  log: ReturnType<typeof createLogger>,
): Promise<CrmResult> {
  const { pessoa, empresa, score, customFields } = parseCrmBuckets(crmData);

  const personId = await upsertPerson(supabase, pessoa, opts.source);
  if (!personId) {
    return { personId: null, companyId: null, leadId: null, isExistingLead: false };
  }

  const companyId = empresa.nome
    ? await upsertCompany(supabase, empresa, personId)
    : null;

  await applyScore(supabase, score, personId, log);
  await persistCustomFields(supabase, customFields, personId);

  const personName = pessoa.nome || pessoa.email?.split('@')[0] || 'Lead';
  const { leadId, isExisting } = await createLead(supabase, {
    personId,
    companyId,
    pipelineId: opts.pipelineId,
    configuredStageId: opts.configuredStageId,
    personName,
    formName: opts.formName,
    source: opts.source,
    forceCreateLead: opts.forceCreateLead,
    utm: opts.utm,
  });

  return { personId, companyId, leadId, isExistingLead: isExisting };
}
