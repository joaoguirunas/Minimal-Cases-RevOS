/**
 * META LEAD FORMS — Sync Forms + Import Leads
 *
 * POST /meta-leadgen-sync
 * Body:
 *   action: 'sync'          → Sync forms from Page
 *   action: 'import-leads'  → Import historical leads for a form
 *
 * Sync body:  { action: 'sync', page_id }
 * Import body: { action: 'import-leads', form_id }
 *
 * Flow (sync):
 *   1. Verify user JWT
 *   2. GET /{page-id}/leadgen_forms with cursor pagination
 *   3. Upsert into meta_lead_forms (new → unmapped, existing → update)
 *   4. Archive local forms not found on Meta
 *   5. Return { synced, new, archived }
 *
 * Flow (import-leads):
 *   1. Verify user JWT
 *   2. GET /{form-id}/leads with cursor pagination (max 90 days)
 *   3. For each lead: check duplicate, map fields, create via crm-mapper
 *   4. Return { total, imported, skipped_duplicates }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processCrmData } from '../_shared/crm-mapper.ts';
import { createLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API = 'https://graph.facebook.com/v25.0';

// ── Helpers ──────────────────────────────────────────────────────────────────

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface MetaFormEntry {
  id: string;
  name: string;
  status: string;
  questions?: Array<{ key: string; type: string; label: string; options?: unknown[] }>;
  created_time?: string;
  leads_count?: number;
}

interface MetaLeadEntry {
  id: string;
  field_data: Array<{ name: string; values: string[] }>;
  created_time: string;
}

// ── Fetch all forms from a Page (cursor pagination) ──────────────────────────

async function fetchAllForms(pageId: string, accessToken: string): Promise<MetaFormEntry[]> {
  const all: MetaFormEntry[] = [];
  let url: string | null =
    `${GRAPH_API}/${pageId}/leadgen_forms?fields=id,name,status,questions,created_time&limit=100&access_token=${accessToken}`;

  console.log(`[meta-leadgen-sync] Fetching forms for page ${pageId}...`);
  console.log(`[meta-leadgen-sync] Token present: ${!!accessToken}, length: ${accessToken?.length}`);

  while (url) {
    const res = await fetch(url);
    const rawBody = await res.text();
    console.log(`[meta-leadgen-sync] API response status: ${res.status}, body: ${rawBody.substring(0, 500)}`);

    if (!res.ok) {
      throw new Error(`Meta API ${res.status}: ${rawBody}`);
    }

    const page = JSON.parse(rawBody) as { data: MetaFormEntry[]; paging?: { next?: string } };
    console.log(`[meta-leadgen-sync] Page returned ${page.data?.length ?? 0} forms`);
    all.push(...(page.data ?? []));
    url = page.paging?.next ?? null;
  }

  console.log(`[meta-leadgen-sync] Total forms fetched: ${all.length}`);
  return all;
}

// ── Fetch leads from a form (cursor pagination, max 90 days) ─────────────────

async function fetchFormLeads(formId: string, accessToken: string): Promise<MetaLeadEntry[]> {
  const all: MetaLeadEntry[] = [];
  let url: string | null =
    `${GRAPH_API}/${formId}/leads?fields=id,field_data,created_time&limit=50&access_token=${accessToken}`;

  const cutoff = new Date(Date.now() - 90 * 86_400_000);

  while (url) {
    const res = await fetch(url);
    if (!res.ok) break;
    const page = await res.json() as { data: MetaLeadEntry[]; paging?: { next?: string } };

    for (const lead of page.data ?? []) {
      if (new Date(lead.created_time) < cutoff) {
        return all; // Stop when we pass 90 days
      }
      all.push(lead);
    }

    url = page.paging?.next ?? null;
  }

  return all;
}

// ── Auto-suggest field mapping ───────────────────────────────────────────────

const META_TYPE_TO_CRM: Record<string, string> = {
  FULL_NAME: 'pessoa.nome',
  EMAIL: 'pessoa.email',
  PHONE_NUMBER: 'pessoa.whatsapp',
  COMPANY_NAME: 'empresa.nome',
  WORK_EMAIL: 'empresa.email',
  WORK_PHONE_NUMBER: 'empresa.telefone',
  CITY: 'pessoa.cidade',
  STATE: 'pessoa.estado',
  ZIP_CODE: 'pessoa.cep',
};

const LABEL_FUZZY_MAP: Record<string, string> = {
  nome: 'pessoa.nome',
  name: 'pessoa.nome',
  email: 'pessoa.email',
  telefone: 'pessoa.whatsapp',
  phone: 'pessoa.whatsapp',
  whatsapp: 'pessoa.whatsapp',
  empresa: 'empresa.nome',
  company: 'empresa.nome',
};

function suggestFieldMapping(
  questions: Array<{ key: string; type: string; label: string }>,
): Array<{ crm_field: string; meta_field: string; meta_type: 'prefilled' | 'custom'; label: string }> {
  return questions.map((q) => {
    // Try standard type mapping first
    const byType = META_TYPE_TO_CRM[q.type];
    if (byType) {
      return {
        crm_field: byType,
        meta_field: q.type,
        meta_type: 'prefilled' as const,
        label: q.label,
      };
    }

    // Try fuzzy label match
    const labelLower = q.label.toLowerCase().trim();
    const byLabel = LABEL_FUZZY_MAP[labelLower];

    return {
      crm_field: byLabel ?? '',
      meta_field: q.key || q.type,
      meta_type: 'custom' as const,
      label: q.label,
    };
  });
}

// ── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const log = createLogger('meta-leadgen-sync');

  try {
    // === AUTH ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ success: false, error: 'Unauthorized — no Bearer token' });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return json({ success: false, error: 'Sessão inválida ou expirada.' });
    }

    const body = await req.json() as {
      action: string;
      page_id?: string;
      form_id?: string;
      pipeline_id?: string;
      stage_id?: string;
      send_message?: boolean;
    };
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ═══════════════════════════════════════════════════════════════════════
    // ACTION: sync
    // ═══════════════════════════════════════════════════════════════════════
    if (body.action === 'sync') {
      const { page_id } = body;
      if (!page_id) {
        return json({ success: false, error: 'Missing page_id' });
      }

      // Get page token
      const { data: page, error: pageError } = await supabase
        .from('meta_lead_form_pages')
        .select('page_id, page_name, access_token, subscribed')
        .eq('page_id', page_id)
        .single();

      console.log(`[meta-leadgen-sync] Page lookup: ${page?.page_name ?? 'NOT FOUND'}, has_token: ${!!page?.access_token}, subscribed: ${page?.subscribed}, error: ${pageError?.message ?? 'none'}`);

      if (!page?.access_token) {
        return json({ success: false, error: `Page não conectada ou sem token. page_id=${page_id}, found=${!!page}` });
      }

      // Fetch all forms from Meta
      const metaForms = await fetchAllForms(page_id, page.access_token);
      log.info('sync_fetched', { page_id, count: metaForms.length });

      // Get existing local forms for this page
      const { data: localForms = [] } = await supabase
        .from('meta_lead_forms')
        .select('id, meta_form_id')
        .eq('page_id', page_id);

      const localMetaIds = new Set((localForms ?? []).map(f => f.meta_form_id));
      const remoteMetaIds = new Set(metaForms.map(f => f.id));

      let newCount = 0;
      let updatedCount = 0;
      let archivedByStatusCount = 0;

      for (const mf of metaForms) {
        const metaStatus = (mf.status ?? '').toUpperCase();
        const isActive = metaStatus === 'ACTIVE';

        // Non-active forms (ARCHIVED, DELETED, DRAFT) → archive locally
        if (!isActive) {
          if (localMetaIds.has(mf.id)) {
            await supabase
              .from('meta_lead_forms')
              .update({ status: 'archived', updated_at: new Date().toISOString() })
              .eq('page_id', page_id)
              .eq('meta_form_id', mf.id);
            archivedByStatusCount++;
            log.info('sync_archived_by_status', { meta_form_id: mf.id, name: mf.name, meta_status: metaStatus });
          }
          // Skip non-active forms that don't exist locally — no need to insert them
          continue;
        }

        const suggestedMapping = mf.questions ? suggestFieldMapping(mf.questions) : [];

        if (localMetaIds.has(mf.id)) {
          // Update existing
          await supabase
            .from('meta_lead_forms')
            .update({
              name: mf.name,
              raw_questions: mf.questions ?? [],
              synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('page_id', page_id)
            .eq('meta_form_id', mf.id);
          updatedCount++;
        } else {
          // Insert new — unmapped status, with suggested mapping
          const hasMapping = suggestedMapping.some(m => m.crm_field !== '');
          await supabase
            .from('meta_lead_forms')
            .insert({
              page_id,
              meta_form_id: mf.id,
              name: mf.name,
              status: 'unmapped',
              field_mapping: hasMapping ? suggestedMapping : [],
              raw_questions: mf.questions ?? [],
              settings: {},
              pipeline_id: null,
              synced_at: new Date().toISOString(),
            });
          newCount++;
        }
      }

      // Archive forms that no longer exist on Meta
      let archivedCount = 0;
      for (const lf of localForms ?? []) {
        if (!remoteMetaIds.has(lf.meta_form_id)) {
          await supabase
            .from('meta_lead_forms')
            .update({ status: 'archived', updated_at: new Date().toISOString() })
            .eq('id', lf.id);
          archivedCount++;
        }
      }

      log.info('sync_complete', { new: newCount, updated: updatedCount, archived: archivedCount, archivedByStatus: archivedByStatusCount });

      return json({
        success: true,
        synced: metaForms.length,
        new: newCount,
        updated: updatedCount,
        archived: archivedCount,
        archivedByStatus: archivedByStatusCount,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ACTION: import-leads
    // ═══════════════════════════════════════════════════════════════════════
    if (body.action === 'import-leads') {
      const { form_id } = body;
      if (!form_id) {
        return json({ success: false, error: 'Missing form_id' });
      }

      // Lookup local form
      const { data: metaForm } = await supabase
        .from('meta_lead_forms')
        .select('id, page_id, meta_form_id, name, field_mapping, pipeline_id, settings')
        .eq('id', form_id)
        .single();

      if (!metaForm) {
        return json({ success: false, error: 'Form não encontrado' });
      }

      // Get page token
      const { data: page } = await supabase
        .from('meta_lead_form_pages')
        .select('access_token')
        .eq('page_id', metaForm.page_id)
        .single();

      if (!page?.access_token) {
        return json({ success: false, error: 'Page sem token' });
      }

      // Fetch leads from Meta
      const leads = await fetchFormLeads(metaForm.meta_form_id, page.access_token);
      log.info('import_fetched', { form_id, leads_count: leads.length });

      const fieldMapping = (metaForm.field_mapping ?? []) as Array<{
        crm_field: string;
        meta_field: string;
        meta_type: string;
        label: string;
        options_mapping?: Record<string, string>;
      }>;

      // Build meta_field name → { crm_field, options_mapping }
      const metaToCrm = new Map<string, { crm_field: string; options_mapping?: Record<string, string> }>();
      for (const fm of fieldMapping) {
        metaToCrm.set(fm.meta_field.toLowerCase(), {
          crm_field: fm.crm_field,
          options_mapping: fm.options_mapping,
        });
      }

      // Override pipeline/stage if provided by the caller
      const effectivePipelineId = body.pipeline_id || metaForm.pipeline_id || null;
      const effectiveStageId = body.stage_id || (metaForm.settings as Record<string, unknown>)?.initial_stage_id || null;

      let imported = 0;
      let skipped = 0;

      for (const lead of leads) {
        // Check duplicate by meta_leadgen_id column first (fast), then legacy data check
        const { data: existing } = await supabase
          .from('form_pro_submissions')
          .select('id')
          .eq('meta_leadgen_id', lead.id)
          .maybeSingle();

        if (!existing) {
          // Fallback: check legacy submissions without meta_leadgen_id column
          const { data: legacyExisting } = await supabase
            .from('form_pro_submissions')
            .select('id')
            .eq('meta_form_id', metaForm.id)
            .contains('data', { _leadgen_id: lead.id })
            .maybeSingle();
          if (legacyExisting) {
            skipped++;
            continue;
          }
        }

        if (existing) {
          skipped++;
          continue;
        }

        // Map field_data → CRM fields
        const crmData: Record<string, string> = {};
        for (const fd of lead.field_data) {
          const mapping = metaToCrm.get(fd.name.toLowerCase());
          if (mapping?.crm_field && fd.values?.[0]) {
            const rawValue = fd.values[0];
            // If options_mapping exists (score fields), resolve Meta option → score item UUID
            // Meta may return values with underscores/lowercase, so normalize for matching
            let resolvedValue = rawValue;
            if (mapping.options_mapping) {
              const normalise = (s: string) => s.toLowerCase().replace(/[\s_]+/g, '_');
              const normRaw = normalise(rawValue);
              for (const [optKey, itemId] of Object.entries(mapping.options_mapping)) {
                if (normalise(optKey) === normRaw) {
                  resolvedValue = itemId;
                  break;
                }
              }
            }
            crmData[mapping.crm_field] = resolvedValue;
          }
        }

        if (Object.keys(crmData).length === 0) {
          skipped++;
          continue;
        }

        // Process CRM data
        const result = await processCrmData(
          supabase,
          crmData,
          {
            pipelineId: effectivePipelineId,
            configuredStageId: effectiveStageId as string | null,
            formName: metaForm.name,
            source: `meta_lead_ads_import:${metaForm.name}`,
          },
          log,
        );

        // Register submission (include meta_leadgen_id for dedup consistency with webhook)
        await supabase.from('form_pro_submissions').insert({
          form_id: null,
          meta_form_id: metaForm.id,
          page_id: null,
          source: 'meta',
          data: {
            ...crmData,
            _source: 'meta_import',
            _leadgen_id: lead.id,
            _created_time: lead.created_time,
          },
          lead_id: result.leadId ?? undefined,
          people_id: result.personId ?? undefined,
          ip_address: null,
          meta_leadgen_id: lead.id,
        });

        imported++;
      }

      log.info('import_complete', { form_id, total: leads.length, imported, skipped });

      return json({
        success: true,
        total: leads.length,
        imported,
        skipped_duplicates: skipped,
      });
    }

    return json({ success: false, error: `Unknown action: ${body.action}` });

  } catch (err) {
    log.error('unexpected_error', { error: String(err) });
    return json({ success: false, error: String(err) });
  }
});
