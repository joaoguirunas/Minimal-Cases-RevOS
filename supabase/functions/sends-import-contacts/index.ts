/**
 * SENDS-IMPORT-CONTACTS
 *
 * POST /sends-import-contacts
 *
 * Processes an imported contact list for SENDS PRO campaigns:
 *   1. Normalizes phone numbers (last 11 digits, strip non-digits)
 *   2. Deduplicates against clients_people (whatsapp / phone / email)
 *   3. Creates new clients_people when no match found
 *   4. Optionally inserts lead_field_values for person extra fields (entity_type='pessoa')
 *   5. Optionally creates leads + lead_field_values when create_leads=true
 *   6. Persists Q-fields (q1_*...q26_*) directly in clients_people columns
 *   7. Optionally deduplicates and links clients_companies via company_struct
 *   8. Tracks progress in sends_import_sessions
 *   9. Returns people_ids for sends_contacts population
 *
 * ⚠️ DEPLOY: supabase functions deploy sends-import-contacts --no-verify-jwt
 *
 * Env vars required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImportContactsInput {
  rows: Array<Record<string, string>>;
  field_mapping: {
    name: string;
    whatsapp?: string;
    email?: string;
    company?: string;                    // legacy — ignored, log warning only
    lead_control?: string;               // CSV column whose value sets leads.control per row
    crm_extra?: Record<string, string>;      // { [field_key]: header_csv } — pessoa entity
    empresa_extra?: Record<string, string>;  // { [field_key]: header_csv } — empresa entity
    lead_extra?: Record<string, string>;     // { [field_key]: header_csv } — negocio/lead entity
    score_cat?: Record<string, string>;                    // { [categoryId]: csvHeader }
    value_maps?: Record<string, Record<string, string>>;   // { ["score_cat:categoryId"]: { [csvValue]: itemId } }
    q_field?: Record<string, string>;   // { [q_column_key]: csvHeader }
    company_struct?: Record<string, string>; // { [company_field]: csvHeader }
    lead_cols?: Record<string, string>; // { [native_col_key]: csvHeader } — native leads table columns
  };
  create_leads: boolean;
  pipeline_id?: string;
  stage_id?: string;
  channel: string;
  send_id?: string;
  lead_control?: string;     // value set on leads.control for all imported leads
  score_matrix_id?: string;  // direct score matrix to assign to all imported leads
  assign_user_id?: string;   // settings_users.id to assign as lead owner
  assign_team_id?: string;   // settings_teams.id to assign as lead team
  origem_lista?: string;     // saved to leads.origem_lista for all imported leads
}

interface ImportContactsOutput {
  session_id: string;
  new_people: number;
  existing_people: number;
  failed_rows: number;
  total: number;
  people_ids: string[];
  contacts: Array<{ people_id: string; whatsapp: string | null; email: string | null }>;
}

// ── Phone normalization ───────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  // Strip non-digits and leading zeros (international access codes like 00/0)
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '');
  // Already has BR country code (55) + 10–11 digit local number → keep as-is
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  // Local BR number (10–11 digits without DDI) → add 55
  if (digits.length >= 10 && digits.length <= 11) return '55' + digits;
  // Other formats (too short, international non-BR) → return stripped digits
  return digits;
}

// ── String normalization for company dedup ────────────────────────────────────

function normalizeCompanyName(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  let body: ImportContactsInput;
  try {
    body = await req.json() as ImportContactsInput;
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const {
    rows, field_mapping, create_leads, pipeline_id, stage_id, send_id,
    lead_control, score_matrix_id, assign_user_id, assign_team_id, origem_lista,
  } = body;

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return new Response(
      JSON.stringify({ error: 'rows is required and must be a non-empty array' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (!field_mapping?.name) {
    return new Response(
      JSON.stringify({ error: 'field_mapping.name is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // ── Create import session ─────────────────────────────────────────────────

  const { data: session, error: sessionError } = await supabase
    .from('sends_import_sessions')
    .insert({
      send_id: send_id ?? null,
      status: 'processing',
      total_rows: rows.length,
    })
    .select('id')
    .single();

  if (sessionError || !session) {
    return new Response(
      JSON.stringify({ error: 'Failed to create import session', details: sessionError?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const sessionId = session.id as string;

  // ── Pre-fetch field definition ID maps (once, outside the per-row loop) ─────

  const { crm_extra, empresa_extra, lead_extra, score_cat, value_maps, q_field, company_struct, lead_cols } = field_mapping;

  // Defensive handler for legacy payload containing company simple field (no-op, 1-release warning)
  if (field_mapping.company) {
    console.warn('[sends-import-contacts] field_mapping.company is deprecated and ignored. Use company_struct instead.');
  }

  // Helper: resolve score_matrix_id for a given CSV row
  async function resolveScoreMatrixId(row: Record<string, string>): Promise<string | null> {
    if (!score_cat || Object.keys(score_cat).length === 0) return null;

    const categorySelections: Record<string, string[]> = {};
    for (const [categoryId, csvHeader] of Object.entries(score_cat)) {
      const csvValue = row[csvHeader]?.trim();
      if (!csvValue) continue;
      const mapKey = `score_cat:${categoryId}`;
      const itemId = value_maps?.[mapKey]?.[csvValue];
      if (!itemId) continue;
      categorySelections[categoryId] = [itemId];
    }

    if (Object.keys(categorySelections).length === 0) return null;

    const { data: match } = await supabase
      .from('score_matrix')
      .select('id')
      .contains('category_selections', categorySelections)
      .limit(1)
      .maybeSingle();

    return match ? (match.id as string) : null;
  }

  // Extract Q-field values from a row — returns all entries (null for empty)
  function extractQFieldValues(row: Record<string, string>): Record<string, string | null> {
    if (!q_field || Object.keys(q_field).length === 0) return {};
    const result: Record<string, string | null> = {};
    for (const [qKey, csvHeader] of Object.entries(q_field)) {
      const v = row[csvHeader]?.trim();
      result[qKey] = v && v.length > 0 ? v : null;
    }
    return result;
  }

  // Extract company struct values from a row (only non-empty values)
  function extractCompanyStructValues(row: Record<string, string>): Record<string, string> {
    if (!company_struct || Object.keys(company_struct).length === 0) return {};
    const result: Record<string, string> = {};
    for (const [compKey, csvHeader] of Object.entries(company_struct)) {
      const v = row[csvHeader]?.trim();
      if (v) result[compKey] = v;
    }
    return result;
  }

  // Resolve or create a company and return its ID
  async function resolveCompanyId(companyValues: Record<string, string>): Promise<string | null> {
    const tradeName = companyValues.trade_name;
    const legalName = companyValues.legal_name;
    const taxId     = companyValues.tax_id;

    const hasAnyValue = tradeName || legalName || taxId ||
      companyValues.address || companyValues.website ||
      companyValues.email || companyValues.phone;

    if (!hasAnyValue) return null;

    let existingId: string | null = null;

    // Dedup by tax_id first
    if (taxId) {
      const { data: byTaxId } = await supabase
        .from('clients_companies')
        .select('id')
        .eq('tax_id', taxId)
        .limit(1)
        .maybeSingle();
      if (byTaxId) existingId = byTaxId.id as string;
    }

    // Dedup by trade_name (normalized) if no tax_id match
    if (!existingId && tradeName) {
      const normalized = normalizeCompanyName(tradeName);
      const { data: byName } = await supabase
        .from('clients_companies')
        .select('id, trade_name')
        .ilike('trade_name', normalized)
        .limit(5);

      if (byName && byName.length > 0) {
        const match = (byName as Array<{ id: string; trade_name: string }>).find(
          (c) => normalizeCompanyName(c.trade_name) === normalized,
        );
        if (match) existingId = match.id;
      }
    }

    if (existingId) return existingId;

    // Insert new company — trade_name is NOT NULL, fallback chain
    const effectiveTradeName = tradeName || legalName || 'Empresa sem nome';
    const insertPayload: Record<string, string> = { trade_name: effectiveTradeName };
    if (legalName)               insertPayload.legal_name = legalName;
    if (taxId)                   insertPayload.tax_id = taxId;
    if (companyValues.address)   insertPayload.address = companyValues.address;
    if (companyValues.website)   insertPayload.website = companyValues.website;
    if (companyValues.email)     insertPayload.email = companyValues.email;
    if (companyValues.phone)     insertPayload.phone = companyValues.phone;

    const { data: newCompany, error: companyError } = await supabase
      .from('clients_companies')
      .insert(insertPayload)
      .select('id')
      .single();

    if (companyError || !newCompany) return null;
    return newCompany.id as string;
  }

  // Link person to company via clients_people_companies
  async function linkPersonToCompany(peopleId: string, companyId: string): Promise<void> {
    // Check if any association already exists for this person (to set is_primary correctly)
    const { data: existing } = await supabase
      .from('clients_people_companies')
      .select('id')
      .eq('people_id', peopleId)
      .limit(1)
      .maybeSingle();

    const isPrimary = !existing;

    await supabase
      .from('clients_people_companies')
      .upsert(
        { people_id: peopleId, company_id: companyId, is_primary: isPrimary },
        { onConflict: 'people_id,company_id', ignoreDuplicates: true },
      );
  }

  // Map of field_key → field_definition_id for pessoa fields
  const personFieldDefs: Record<string, string> = {};
  if (crm_extra && Object.keys(crm_extra).length > 0) {
    const { data: defs } = await supabase
      .from('lead_field_definitions')
      .select('id, key')
      .eq('entity_type', 'pessoa')
      .in('key', Object.keys(crm_extra));
    for (const def of defs ?? []) {
      personFieldDefs[(def as { id: string; key: string }).key] = (def as { id: string; key: string }).id;
    }
  }

  // Map of field_key → field_definition_id for empresa fields
  const empresaFieldDefs: Record<string, string> = {};
  if (empresa_extra && Object.keys(empresa_extra).length > 0) {
    const { data: defs } = await supabase
      .from('lead_field_definitions')
      .select('id, key')
      .eq('entity_type', 'empresa')
      .in('key', Object.keys(empresa_extra));
    for (const def of defs ?? []) {
      empresaFieldDefs[(def as { id: string; key: string }).key] = (def as { id: string; key: string }).id;
    }
  }

  // Map of field_key → field_definition_id for lead-level fields (pipeline-scoped)
  // Supports entity_type = 'negocio' (legacy) and 'lead' (current ORA convention)
  const negocioFieldDefs: Record<string, string> = {};
  if (create_leads && lead_extra && Object.keys(lead_extra).length > 0 && pipeline_id) {
    const { data: defs } = await supabase
      .from('lead_field_definitions')
      .select('id, key')
      .in('entity_type', ['negocio', 'lead'])
      .eq('pipeline_id', pipeline_id)
      .in('key', Object.keys(lead_extra));
    for (const def of defs ?? []) {
      negocioFieldDefs[(def as { id: string; key: string }).key] = (def as { id: string; key: string }).id;
    }
  }

  // ── Process rows in batches of 100 ───────────────────────────────────────

  const BATCH_SIZE = 100;
  const peopleIds: string[] = [];
  const contacts: Array<{ people_id: string; whatsapp: string | null; email: string | null }> = [];
  let newPeople = 0;
  let existingPeople = 0;
  let failedRows = 0;

  for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
    const batch = rows.slice(batchStart, batchStart + BATCH_SIZE);

    for (const row of batch) {
      try {
        // 1. Extract mapped values
        const rawName     = row[field_mapping.name]?.trim() ?? '';
        const rawWhatsapp = field_mapping.whatsapp ? row[field_mapping.whatsapp]?.trim() ?? '' : '';
        const rawEmail    = field_mapping.email    ? row[field_mapping.email]?.trim() ?? ''    : '';

        // 2. Normalize phone
        const normalizedPhone = rawWhatsapp ? normalizePhone(rawWhatsapp) : '';

        // Name fallback: use phone if name is empty
        const personName = rawName || normalizedPhone || rawEmail;

        if (!personName) {
          failedRows++;
          continue;
        }

        // 3. Validate normalizedPhone — must be 6-15 digits to be a safe PostgREST filter value.
        // If the raw input produces fewer digits (e.g. all non-numeric chars), treat as invalid
        // to avoid passing a malformed string into the .or() ilike pattern.
        if (normalizedPhone && !/^\d{6,15}$/.test(normalizedPhone)) {
          failedRows++;
          continue;
        }

        // 4. Extract Q-fields and company_struct for this row
        const qFieldValues  = extractQFieldValues(row);
        const companyValues = extractCompanyStructValues(row);

        // 5. Deduplicate: search clients_people by phone suffix OR email
        // Use last 11 digits as suffix to match both stored formats (with or without DDI 55)
        let existingPersonId: string | null = null;

        if (normalizedPhone) {
          // clients_people não tem coluna `phone` (só `whatsapp`) — o .or() antigo
          // referenciava uma coluna inexistente, o que faz o PostgREST retornar
          // 400 SEMPRE; como o erro não era checado, o dedup por telefone nunca
          // funcionou (toda pessoa era tratada como nova, mesmo já existindo).
          const phoneSearchSuffix = normalizedPhone.slice(-11);
          const { data: byPhone, error: byPhoneError } = await supabase
            .from('clients_people')
            .select('id')
            .ilike('whatsapp', `%${phoneSearchSuffix}`)
            .limit(1)
            .maybeSingle();

          if (byPhoneError) console.error('[sends-import-contacts] dedup by phone failed:', byPhoneError.message);
          if (byPhone) existingPersonId = byPhone.id as string;
        }

        if (!existingPersonId && rawEmail) {
          const { data: byEmail } = await supabase
            .from('clients_people')
            .select('id')
            .eq('email', rawEmail)
            .limit(1)
            .maybeSingle();

          if (byEmail) existingPersonId = byEmail.id as string;
        }

        // 5a. Existing person
        if (existingPersonId) {
          existingPeople++;
          peopleIds.push(existingPersonId);
          contacts.push({ people_id: existingPersonId, whatsapp: normalizedPhone || null, email: rawEmail || null });

          // UPSERT lead_field_values for person extra fields
          if (crm_extra) {
            for (const [field_key, header_csv] of Object.entries(crm_extra)) {
              const value = row[header_csv]?.trim();
              const defId = personFieldDefs[field_key];
              if (!value || !defId) continue;
              await supabase.from('lead_field_values').upsert(
                {
                  entity_id: existingPersonId,
                  entity_type: 'pessoa',
                  field_definition_id: defId,
                  value_text: value,
                },
                { onConflict: 'entity_type,entity_id,field_definition_id' },
              );
            }
          }

          // UPDATE Q-fields — single UPDATE statement with only non-empty values
          const qUpdates: Record<string, string> = {};
          for (const [qKey, v] of Object.entries(qFieldValues)) {
            if (v) qUpdates[qKey] = v;
          }
          if (Object.keys(qUpdates).length > 0) {
            await supabase.from('clients_people').update(qUpdates).eq('id', existingPersonId);
          }

          // Resolve and apply score_matrix_id
          const scoreMatrixId = await resolveScoreMatrixId(row);
          if (scoreMatrixId) {
            await supabase.from('clients_people').update({ score_matrix_id: scoreMatrixId }).eq('id', existingPersonId);
          }

          // Link company + empresa_extra fields
          const companyId = await resolveCompanyId(companyValues);
          if (companyId) {
            await linkPersonToCompany(existingPersonId, companyId);
            if (empresa_extra) {
              for (const [field_key, header_csv] of Object.entries(empresa_extra)) {
                const value = row[header_csv]?.trim();
                const defId = empresaFieldDefs[field_key];
                if (!value || !defId) continue;
                await supabase.from('lead_field_values').upsert(
                  { entity_id: companyId, entity_type: 'empresa', field_definition_id: defId, value_text: value },
                  { onConflict: 'entity_type,entity_id,field_definition_id' },
                );
              }
            }
          }

          continue;
        }

        // 5b. New person — INSERT with Q-fields spread into payload
        const insertPayload: Record<string, unknown> = {
          name:       personName,
          whatsapp:   normalizedPhone || null,
          email:      rawEmail || null,
          status:     'active',
          ai_enabled: true,
          ...qFieldValues,
        };

        const { data: newPerson, error: insertPersonError } = await supabase
          .from('clients_people')
          .insert(insertPayload)
          .select('id')
          .single();

        if (insertPersonError || !newPerson) {
          failedRows++;
          continue;
        }

        const newPersonId = newPerson.id as string;
        newPeople++;
        peopleIds.push(newPersonId);
        contacts.push({ people_id: newPersonId, whatsapp: normalizedPhone || null, email: rawEmail || null });

        // INSERT lead_field_values for person extra fields
        if (crm_extra) {
          for (const [field_key, header_csv] of Object.entries(crm_extra)) {
            const value = row[header_csv]?.trim();
            const defId = personFieldDefs[field_key];
            if (!value || !defId) continue;
            await supabase.from('lead_field_values').insert({
              entity_id: newPersonId,
              entity_type: 'pessoa',
              field_definition_id: defId,
              value_text: value,
            });
          }
        }

        // Resolve and apply score_matrix_id for new person
        const newPersonScoreMatrixId = await resolveScoreMatrixId(row);
        if (newPersonScoreMatrixId) {
          await supabase.from('clients_people').update({ score_matrix_id: newPersonScoreMatrixId }).eq('id', newPersonId);
        }

        // Link company for new person + empresa_extra fields
        const newPersonCompanyId = await resolveCompanyId(companyValues);
        if (newPersonCompanyId) {
          await linkPersonToCompany(newPersonId, newPersonCompanyId);
          if (empresa_extra) {
            for (const [field_key, header_csv] of Object.entries(empresa_extra)) {
              const value = row[header_csv]?.trim();
              const defId = empresaFieldDefs[field_key];
              if (!value || !defId) continue;
              await supabase.from('lead_field_values').insert({
                entity_id: newPersonCompanyId,
                entity_type: 'empresa',
                field_definition_id: defId,
                value_text: value,
              });
            }
          }
        }

        // 6. Optionally create lead
        if (create_leads && pipeline_id && stage_id) {
          // Row-level control overrides preset-level static lead_control
          const rowLeadControl = field_mapping.lead_control
            ? row[field_mapping.lead_control]?.trim() || null
            : null;
          const effectiveControl = rowLeadControl || lead_control || '1';

          // Native lead column values from lead_cols mapping
          const leadColValues: Record<string, string> = {};
          if (lead_cols) {
            for (const [colKey, csvHeader] of Object.entries(lead_cols)) {
              const v = row[csvHeader]?.trim();
              if (v) leadColValues[colKey] = v;
            }
          }

          const { data: newLead, error: insertLeadError } = await supabase
            .from('leads')
            .insert({
              people_id:          newPersonId,
              title:              personName,
              leads_pipelines_id: pipeline_id,
              leads_stages_id:    stage_id,
              status:             'in_progress',
              control:        effectiveControl,
              ...(assign_user_id      ? { user_id:        assign_user_id }      : {}),
              ...(assign_team_id      ? { teams_id:       assign_team_id }      : {}),
              ...(score_matrix_id     ? { score_matrix_id } : {}),
              ...(origem_lista        ? { origem_lista }    : {}),
              ...leadColValues,
            })
            .select('id')
            .single();

          if (!insertLeadError && newLead) {
            const leadId = newLead.id as string;

            if (lead_extra) {
              for (const [field_key, header_csv] of Object.entries(lead_extra)) {
                const value = row[header_csv]?.trim();
                const defId = negocioFieldDefs[field_key];
                if (!value || !defId) continue;
                await supabase.from('lead_field_values').upsert(
                  {
                    entity_id:          leadId,
                    entity_type:        'negocio',
                    lead_id:            leadId,
                    field_definition_id: defId,
                    value_text:         value,
                  },
                  { onConflict: 'entity_type,entity_id,field_definition_id' },
                );
              }
            }

            // Apply score_matrix_id to lead (reuse already-resolved value from person step)
            if (newPersonScoreMatrixId) {
              await supabase.from('leads').update({ score_matrix_id: newPersonScoreMatrixId }).eq('id', leadId);
            }
          }
        }
      } catch (rowErr) {
        failedRows++;
        console.error('[sends-import-contacts] row processing error:', rowErr);
      }
    }

    // Update session progress after each batch
    await supabase
      .from('sends_import_sessions')
      .update({
        processed:       Math.min(batchStart + BATCH_SIZE, rows.length),
        new_people:      newPeople,
        existing_people: existingPeople,
        failed_rows:     failedRows,
        updated_at:      new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  // ── Insert sends_contacts when send_id is provided ────────────────────────

  if (send_id && contacts.length > 0) {
    const CONTACTS_BATCH = 500;
    for (let i = 0; i < contacts.length; i += CONTACTS_BATCH) {
      const batch = contacts.slice(i, i + CONTACTS_BATCH).map((c) => ({
        send_id,
        people_id: c.people_id,
        whatsapp:  c.whatsapp ?? '',
        status:    'pending',
      }));
      await supabase.from('sends_contacts').insert(batch);
    }
  }

  // ── Finalize session ──────────────────────────────────────────────────────

  await supabase
    .from('sends_import_sessions')
    .update({
      status:          'done',
      processed:       rows.length,
      new_people:      newPeople,
      existing_people: existingPeople,
      failed_rows:     failedRows,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', sessionId);

  const output: ImportContactsOutput = {
    session_id:      sessionId,
    new_people:      newPeople,
    existing_people: existingPeople,
    failed_rows:     failedRows,
    total:           rows.length,
    people_ids:      peopleIds,
    contacts,
  };

  return new Response(
    JSON.stringify(output),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
