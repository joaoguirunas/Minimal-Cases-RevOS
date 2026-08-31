/**
 * yampi-process-event (YMP-1.4 + YMP-4) — GOD NODE (touches `clients_people` e `leads`).
 *
 * Invoked (service_role bearer, verify_jwt=false) by yampi-inbound, yampi-reconcile and
 * yampi-connect(reprocess) with { event_id }. The webhook event is already persisted in
 * yampi_webhook_events; this function:
 *   1. Precedence guard por pedido (order_id) ou carrinho (cart_token) — um evento menos
 *      avançado que o último processado do mesmo escopo é ignorado (nunca regride o lead).
 *   2. Resolves/creates the contact by email/phone (BR normalization + auto-merge chain).
 *   3. Applies yampi_event_mappings (trigger → pipeline/stage): move (ou cria) o lead do
 *      contato na esteira, aplica tags. É isso que faz o cliente aparecer no CRM assim
 *      que entra no checkout (trigger checkout_iniciado, sintetizado pelo reconcile).
 *   4. Marks the event processed (people_id stamped).
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import {
  guardScope,
  isYampiTrigger,
  parseYampiPayload,
  rankOf,
  shouldProceed,
  type YampiTrigger,
} from '../_shared/yampi-events.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** 12-digit BR numbers (55+DDD+8) → 13-digit (adds the 9th digit). Mirrors whatsapp-inbound. */
function normalizeBRPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12) return digits.substring(0, 4) + '9' + digits.substring(4);
  return digits;
}

interface EventRow {
  id: string;
  connection_id: string;
  trigger: string | null;
  event_type: string;
  order_id: string | null;
  cart_token: string | null;
  raw_payload: Record<string, unknown>;
  status: string;
}

interface MappingRow {
  target_pipeline_id: string;
  target_stage_id: string;
  tags_to_add: string[];
  tags_to_remove: string[];
}

/**
 * Resolve an existing contact by email then phone, or create one. Follows the
 * auto-merge chain (trg_identity_auto_merge).
 */
async function resolvePerson(
  supabase: SupabaseClient,
  opts: { email: string | null; phone: string | null; name: string | null },
): Promise<string | null> {
  const sel = 'id, merged_into_id, status';

  const followCanonical = (row: { id: string; merged_into_id: string | null; status: string }): string =>
    row.status === 'merged' && row.merged_into_id ? row.merged_into_id : row.id;

  if (opts.email) {
    const { data } = await supabase
      .from('clients_people').select(sel).eq('email', opts.email)
      .order('created_at', { ascending: true });
    const rows = (data ?? []) as Array<{ id: string; merged_into_id: string | null; status: string }>;
    const hit = rows.find((r) => r.status !== 'merged') ?? rows[0];
    if (hit) return followCanonical(hit);
  }

  const phone = opts.phone ? normalizeBRPhone(opts.phone) : null;
  if (phone) {
    for (const col of ['whatsapp', 'telefone']) {
      const { data } = await supabase
        .from('clients_people').select(sel).eq(col, phone)
        .order('created_at', { ascending: true });
      const rows = (data ?? []) as Array<{ id: string; merged_into_id: string | null; status: string }>;
      const hit = rows.find((r) => r.status !== 'merged') ?? rows[0];
      if (hit) return followCanonical(hit);
    }
  }

  if (!opts.email && !phone) return null;

  const insert: Record<string, unknown> = {
    name: opts.name ?? opts.email ?? phone ?? 'Contato Yampi',
    status: 'active',
  };
  if (opts.email) insert.email = opts.email;
  if (phone) insert.whatsapp = phone;
  const { data: created, error } = await supabase
    .from('clients_people').insert(insert).select('id').single();
  if (error || !created) return null;

  const { data: reread } = await supabase
    .from('clients_people').select(sel).eq('id', (created as { id: string }).id).maybeSingle();
  if (reread) return followCanonical(reread as { id: string; merged_into_id: string | null; status: string });
  return (created as { id: string }).id;
}

/** Find the person's active lead in the target pipeline, or create one; set its stage. */
async function moveLead(
  supabase: SupabaseClient,
  peopleId: string,
  pipelineId: string,
  stageId: string,
  title: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('leads')
    .select('id')
    .eq('people_id', peopleId)
    .eq('leads_pipelines_id', pipelineId)
    .neq('status', 'lost')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const id = (existing as { id: string }).id;
    await supabase.from('leads').update({ leads_stages_id: stageId }).eq('id', id);
    return id;
  }

  const { data: created } = await supabase
    .from('leads')
    .insert({
      title,
      people_id: peopleId,
      leads_pipelines_id: pipelineId,
      leads_stages_id: stageId,
      status: 'in_progress',
      lead_source: 'yampi',
    })
    .select('id')
    .single();
  return created ? (created as { id: string }).id : null;
}

/** Apply tags non-destructively to clients_people.q23_behavioral_tags (mirror Kiwify). */
async function applyTags(
  supabase: SupabaseClient,
  peopleId: string,
  add: string[],
  remove: string[],
): Promise<void> {
  if (add.length === 0 && remove.length === 0) return;
  const { data } = await supabase
    .from('clients_people').select('q23_behavioral_tags').eq('id', peopleId).maybeSingle();
  const current = ((data as { q23_behavioral_tags: string | null } | null)?.q23_behavioral_tags ?? '')
    .split(',').map((t) => t.trim()).filter(Boolean);
  const set = new Set(current);
  for (const t of add) set.add(t.trim());
  for (const t of remove) set.delete(t.trim());
  await supabase.from('clients_people').update({ q23_behavioral_tags: [...set].join(', ') }).eq('id', peopleId);
}

async function loadMapping(supabase: SupabaseClient, trigger: YampiTrigger): Promise<MappingRow | null> {
  const { data } = await supabase
    .from('yampi_event_mappings')
    .select('target_pipeline_id, target_stage_id, tags_to_add, tags_to_remove')
    .eq('trigger', trigger)
    .eq('active', true)
    .maybeSingle();
  return (data as MappingRow | null) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const log = createLogger('yampi-process-event');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Only internal callers (service role bearer) may invoke.
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.includes(serviceRoleKey)) {
    return new Response('Forbidden', { status: 403 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { event_id } = (await req.json().catch(() => ({}))) as { event_id?: string };
  if (!event_id) return json({ ok: false, error: 'event_id required' });

  const { data: eventRaw } = await supabase
    .from('yampi_webhook_events')
    .select('id, connection_id, trigger, event_type, order_id, cart_token, raw_payload, status')
    .eq('id', event_id)
    .maybeSingle();
  const event = eventRaw as EventRow | null;

  if (!event) return json({ ok: false, error: 'event not found' });
  if (event.status !== 'received') {
    return json({ ok: true, skipped: true, reason: `status=${event.status}` });
  }

  await supabase.from('yampi_webhook_events').update({ status: 'processing' }).eq('id', event.id);

  try {
    if (!isYampiTrigger(event.trigger)) {
      await supabase.from('yampi_webhook_events').update({
        status: 'ignored',
        processed_at: new Date().toISOString(),
      }).eq('id', event.id);
      return json({ ok: true, ignored: true, reason: 'no canonical trigger' });
    }
    const trigger = event.trigger;
    const parsed = parseYampiPayload(event.raw_payload);

    // ── Precedence guard (order- or cart-scoped) ────────────────────────────
    const scope = guardScope(event);
    if (scope) {
      const { data: priors } = await supabase
        .from('yampi_webhook_events')
        .select('trigger, raw_payload')
        .eq('connection_id', event.connection_id)
        .eq(scope.column, scope.value)
        .eq('status', 'processed')
        .order('processed_at', { ascending: false })
        .limit(1);
      const prior = (priors ?? [])[0] as { trigger: string | null; raw_payload: Record<string, unknown> } | undefined;
      if (prior && isYampiTrigger(prior.trigger)) {
        const priorTs = parseYampiPayload(prior.raw_payload).eventTs;
        if (!shouldProceed(rankOf(trigger), parsed.eventTs, rankOf(prior.trigger), priorTs)) {
          await supabase.from('yampi_webhook_events').update({
            status: 'ignored',
            error: `precedence: ${trigger} does not advance ${prior.trigger}`,
            processed_at: new Date().toISOString(),
          }).eq('id', event.id);
          log.info('precedence_ignored', { event_id, trigger, prior: prior.trigger });
          return json({ ok: true, ignored: true, reason: 'precedence' });
        }
      }
    }

    // ── Resolve contact ─────────────────────────────────────────────────────
    const peopleId = await resolvePerson(supabase, {
      email: parsed.customerEmail,
      phone: parsed.customerPhone,
      name: parsed.customerName,
    });
    if (!peopleId) {
      // Cart sem identificação ainda (sem email/telefone) — nada a criar no CRM.
      await supabase.from('yampi_webhook_events').update({
        status: 'ignored',
        error: 'no contact identity in payload',
        processed_at: new Date().toISOString(),
      }).eq('id', event.id);
      return json({ ok: true, ignored: true, reason: 'no identity' });
    }

    // Backfill identity fields the CRM is missing (never overwrite existing data).
    const { data: person } = await supabase
      .from('clients_people').select('id, name, email, whatsapp').eq('id', peopleId).maybeSingle();
    if (person) {
      const p = person as { name: string | null; email: string | null; whatsapp: string | null };
      const patch: Record<string, unknown> = {};
      if (!p.email && parsed.customerEmail) patch.email = parsed.customerEmail;
      if (!p.whatsapp && parsed.customerPhone) patch.whatsapp = normalizeBRPhone(parsed.customerPhone);
      if ((!p.name || p.name === 'Contato Yampi') && parsed.customerName) patch.name = parsed.customerName;
      if (Object.keys(patch).length > 0) {
        await supabase.from('clients_people').update(patch).eq('id', peopleId);
      }
    }

    // ── Apply mapping: move/create lead na esteira + tags ───────────────────
    let leadId: string | null = null;
    const mapping = await loadMapping(supabase, trigger);
    if (mapping) {
      const item = parsed.itemTitles[0] ?? 'Loja Minimal';
      const title = `${item} — ${parsed.customerName ?? parsed.customerEmail ?? ''}`.trim();
      leadId = await moveLead(supabase, peopleId, mapping.target_pipeline_id, mapping.target_stage_id, title);
      if (leadId && parsed.total !== null) {
        await supabase.from('leads').update({ value: parsed.total }).eq('id', leadId);
      }
      await applyTags(supabase, peopleId, mapping.tags_to_add ?? [], mapping.tags_to_remove ?? []);
    } else {
      log.info('no_mapping', { trigger });
    }

    await supabase.from('yampi_webhook_events').update({
      people_id: peopleId,
      status: 'processed',
      processed_at: new Date().toISOString(),
      error: null,
    }).eq('id', event.id);

    log.info('processed', { event_id, trigger, people_id: peopleId, lead_id: leadId });
    return json({ ok: true, trigger, people_id: peopleId, lead_id: leadId });
  } catch (err) {
    await supabase.from('yampi_webhook_events').update({
      status: 'failed',
      error: (err as Error).message.slice(0, 500),
    }).eq('id', event.id);
    log.error('event_failed', { event_id: event.id, error: (err as Error).message });
    return json({ ok: false, error: (err as Error).message });
  }
});
