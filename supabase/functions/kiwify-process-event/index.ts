/**
 * kiwify-process-event (KFY-1.5) — GOD NODE (touches `leads` and enqueues WhatsApp jobs).
 *
 * Invoked (service_role, no JWT) by kiwify-inbound and kiwify-reconcile with { event_id }.
 * The webhook event is already persisted in kiwify_webhook_events; this function:
 *   1. Resolves/creates the contact by email/phone (BR normalization + auto-merge).
 *   2. Applies kiwify_event_mappings (product-specific → default) — moves the lead's
 *      pipeline/stage and applies tags.
 *   3. Precedence guard by order/subscription — a later, less-advanced event never regresses.
 *   4. Materializes kiwify_message_automations steps into kiwify_message_jobs.
 *   5. Cancels pending jobs whose cancel_on_triggers include the current trigger.
 *
 * Actual WhatsApp sending happens later in kiwify-dispatch-worker. Opt-in gating is applied
 * there (needs the resolved template category at send time).
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import {
  buildVariableMap,
  isPossessionTrigger,
  type KiwifyTrigger,
  parseKiwifyPayload,
  rankOf,
  resolveStepVariables,
  resolveTrigger,
  shouldProceed,
} from '../_shared/kiwify-events.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 12-digit BR numbers (55 + DDD + 8-digit) → 13-digit (adds the 9th digit).
 * Mirrors whatsapp-inbound.normalizeBRPhone so contacts resolve consistently.
 */
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
  subscription_id: string | null;
  raw_payload: Record<string, unknown>;
  status: string;
}

interface MappingRow {
  target_pipeline_id: string;
  target_stage_id: string;
  tags_to_add: string[];
  tags_to_remove: string[];
}

interface AutomationRow {
  id: string;
  steps: Array<{ delay_minutes?: number; template_id?: string | null; variables?: Record<string, unknown> }>;
  cancel_on_triggers: string[];
}

/**
 * Resolve an existing contact by email then phone, or create one. Follows the auto-merge
 * chain (trg_identity_auto_merge) so a freshly-inserted row that merges into a canonical
 * returns the canonical id. Returns { id, name, whatsapp_optin }.
 */
async function resolvePerson(
  supabase: SupabaseClient,
  opts: { email: string | null; phone: string | null; name: string | null },
): Promise<{ id: string; whatsapp_optin: boolean } | null> {
  const sel = 'id, whatsapp_optin, merged_into_id, status';

  const followCanonical = async (
    row: { id: string; whatsapp_optin: boolean; merged_into_id: string | null; status: string },
  ): Promise<{ id: string; whatsapp_optin: boolean }> => {
    if (row.status === 'merged' && row.merged_into_id) {
      const { data: canon } = await supabase
        .from('clients_people').select('id, whatsapp_optin').eq('id', row.merged_into_id).maybeSingle();
      if (canon) return canon as { id: string; whatsapp_optin: boolean };
    }
    return { id: row.id, whatsapp_optin: row.whatsapp_optin };
  };

  // 1. By email
  if (opts.email) {
    const { data } = await supabase
      .from('clients_people').select(sel).eq('email', opts.email)
      .order('created_at', { ascending: true });
    const rows = (data ?? []) as Array<{ id: string; whatsapp_optin: boolean; merged_into_id: string | null; status: string }>;
    const hit = rows.find((r) => r.status !== 'merged') ?? rows[0];
    if (hit) return followCanonical(hit);
  }

  // 2. By phone (whatsapp then telefone)
  const phone = opts.phone ? normalizeBRPhone(opts.phone) : null;
  if (phone) {
    for (const col of ['whatsapp', 'telefone']) {
      const { data } = await supabase
        .from('clients_people').select(sel).eq(col, phone)
        .order('created_at', { ascending: true });
      const rows = (data ?? []) as Array<{ id: string; whatsapp_optin: boolean; merged_into_id: string | null; status: string }>;
      const hit = rows.find((r) => r.status !== 'merged') ?? rows[0];
      if (hit) return followCanonical(hit);
    }
  }

  // 3. Create — the DB trigger may auto-merge into an existing canonical.
  const insert: Record<string, unknown> = { name: opts.name ?? opts.email ?? phone ?? 'Contato Kiwify', status: 'active' };
  if (opts.email) insert.email = opts.email;
  if (phone) insert.whatsapp = phone;
  const { data: created, error } = await supabase
    .from('clients_people').insert(insert).select('id').single();
  if (error || !created) return null;

  const { data: post } = await supabase
    .from('clients_people').select(sel).eq('id', (created as { id: string }).id).maybeSingle();
  if (post) return followCanonical(post as { id: string; whatsapp_optin: boolean; merged_into_id: string | null; status: string });
  return { id: (created as { id: string }).id, whatsapp_optin: false };
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
    .insert({ title, people_id: peopleId, leads_pipelines_id: pipelineId, leads_stages_id: stageId, status: 'in_progress' })
    .select('id')
    .single();
  return created ? (created as { id: string }).id : null;
}

/**
 * Apply tags non-destructively to clients_people.q23_behavioral_tags (comma-separated).
 * NOTE (flagged to lead): the CRM has no structured tags model on leads/clients_people;
 * q23_behavioral_tags is the only tag-like field. Seed mappings ship empty tag arrays, so
 * this is inert until tags are configured. Union for add, difference for remove.
 */
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const log = createLogger('kiwify-process-event');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { event_id } = (await req.json().catch(() => ({}))) as { event_id?: string };
    if (!event_id) return json({ ok: false, error: 'event_id required' }, 400);

    const { data: eventData } = await supabase
      .from('kiwify_webhook_events')
      .select('id, connection_id, trigger, event_type, order_id, subscription_id, raw_payload, status')
      .eq('id', event_id)
      .maybeSingle();

    if (!eventData) return json({ ok: false, error: 'event not found' }, 404);
    const event = eventData as EventRow;

    // Idempotency: only a freshly-received event is processed. Retries/duplicates no-op.
    if (event.status !== 'received') {
      log.info('skip_non_received', { event_id, status: event.status });
      return json({ ok: true, skipped: true, reason: `status=${event.status}` });
    }
    await supabase.from('kiwify_webhook_events').update({ status: 'processing' }).eq('id', event.id);

    const trigger = resolveTrigger(event.trigger, event.event_type);
    if (!trigger) {
      await supabase.from('kiwify_webhook_events')
        .update({ status: 'failed', error: `unresolved trigger (event_type=${event.event_type})`, processed_at: new Date().toISOString() })
        .eq('id', event.id);
      return json({ ok: false, error: 'unresolved trigger' });
    }

    const parsed = parseKiwifyPayload(event.raw_payload);

    // ── Precedence guard (order/subscription scoped) ────────────────────────
    const guardKey = event.order_id ?? event.subscription_id;
    if (guardKey) {
      const col = event.order_id ? 'order_id' : 'subscription_id';
      const { data: priors } = await supabase
        .from('kiwify_webhook_events')
        .select('trigger, event_type, raw_payload, processed_at')
        .eq('connection_id', event.connection_id)
        .eq(col, guardKey)
        .eq('status', 'processed')
        .order('processed_at', { ascending: false })
        .limit(1);

      const prior = (priors ?? [])[0] as
        | { trigger: string | null; event_type: string; raw_payload: Record<string, unknown> }
        | undefined;

      if (prior) {
        const priorTrigger = resolveTrigger(prior.trigger, prior.event_type);
        const priorTs = parseKiwifyPayload(prior.raw_payload).eventTs;
        if (!shouldProceed(rankOf(trigger), parsed.eventTs, rankOf(priorTrigger), priorTs)) {
          await supabase.from('kiwify_webhook_events')
            .update({ status: 'ignored', error: `precedence: ${trigger} does not advance ${priorTrigger}`, processed_at: new Date().toISOString() })
            .eq('id', event.id);
          log.info('precedence_ignored', { event_id, trigger, prior: priorTrigger });
          return json({ ok: true, ignored: true, reason: 'precedence' });
        }
      }
    }

    // ── Resolve contact ─────────────────────────────────────────────────────
    const person = await resolvePerson(supabase, {
      email: parsed.customerEmail,
      phone: parsed.customerPhone,
      name: parsed.customerName,
    });
    if (!person) {
      await supabase.from('kiwify_webhook_events')
        .update({ status: 'failed', error: 'could not resolve contact', processed_at: new Date().toISOString() })
        .eq('id', event.id);
      return json({ ok: false, error: 'contact resolution failed' });
    }

    // ── Apply mapping (product-specific → default) + move lead + tags ────────
    let leadId: string | null = null;
    const mapping = await loadMapping(supabase, parsed.productId, trigger);
    if (mapping) {
      const title = `${parsed.productName ?? 'Kiwify'} — ${parsed.customerName ?? ''}`.trim();
      leadId = await moveLead(supabase, person.id, mapping.target_pipeline_id, mapping.target_stage_id, title);
      await applyTags(supabase, person.id, mapping.tags_to_add ?? [], mapping.tags_to_remove ?? []);
    } else {
      log.warn('no_mapping', { trigger, product_id: parsed.productId });
    }

    // ── KFY-2.2: record course ownership on possession events ────────────────
    // Only compra_aprovada / subscription_renewed represent an owned product. Runs AFTER
    // the precedence guard (an ignored event returned earlier), so it never regresses.
    // Idempotent upsert on (people_id, product_id): refreshes product_name/last_seen_at and
    // leaves first_seen_at untouched (omitted → DB default on insert, kept on conflict).
    // Enrichment only — a failure here is logged but MUST NOT fail the event (AC6).
    if (isPossessionTrigger(trigger) && parsed.productId && parsed.productName) {
      try {
        const nowIso = new Date().toISOString();
        const { error: ownErr } = await supabase
          .from('kiwify_lead_products')
          .upsert({
            people_id: person.id,
            product_id: parsed.productId,
            product_name: parsed.productName,
            connection_id: event.connection_id,
            last_seen_at: nowIso,
            updated_at: nowIso,
          }, { onConflict: 'people_id,product_id' });
        if (ownErr) {
          log.error('lead_product_upsert_failed', { people_id: person.id, product_id: parsed.productId, error: ownErr.message });
        }
      } catch (e) {
        log.error('lead_product_upsert_exception', { people_id: person.id, error: (e as Error).message });
      }
    }

    // ── Cancellation: current trigger halts pending jobs that list it ────────
    await cancelJobs(supabase, person.id, event.order_id, trigger);

    // ── Materialize automation steps into jobs ──────────────────────────────
    const automation = await loadAutomation(supabase, parsed.productId, trigger);
    let jobsCreated = 0;
    if (automation) {
      const eventVars = buildVariableMap(parsed);
      const now = Date.now();
      const rows = automation.steps.map((step, idx) => ({
        event_id: event.id,
        automation_id: automation.id,
        people_id: person.id,
        lead_id: leadId,
        order_id: event.order_id,
        trigger,
        step_index: idx,
        template_id: step.template_id ?? null,
        variables: resolveStepVariables(step.variables, eventVars),
        cancel_on_triggers: automation.cancel_on_triggers ?? [],
        scheduled_for: new Date(now + (step.delay_minutes ?? 0) * 60_000).toISOString(),
        status: 'pending',
      }));
      if (rows.length > 0) {
        const { error: jobErr } = await supabase.from('kiwify_message_jobs').insert(rows);
        if (jobErr) log.error('jobs_insert_failed', { error: jobErr.message });
        else jobsCreated = rows.length;
      }
    }

    await supabase.from('kiwify_webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString(), error: null })
      .eq('id', event.id);

    log.info('processed', { event_id, trigger, people_id: person.id, lead_id: leadId, jobs: jobsCreated });
    return json({ ok: true, trigger, people_id: person.id, lead_id: leadId, jobs_created: jobsCreated });
  } catch (e) {
    log.error('unhandled', { error: (e as Error).message });
    return json({ ok: false, error: 'internal error' }, 500);
  }
});

/** Load mapping preferring a product-specific row, falling back to the default (product_id IS NULL). */
async function loadMapping(
  supabase: SupabaseClient,
  productId: string | null,
  trigger: KiwifyTrigger,
): Promise<MappingRow | null> {
  if (productId) {
    const { data } = await supabase
      .from('kiwify_event_mappings')
      .select('target_pipeline_id, target_stage_id, tags_to_add, tags_to_remove')
      .eq('trigger', trigger).eq('product_id', productId).eq('active', true).maybeSingle();
    if (data) return data as MappingRow;
  }
  const { data } = await supabase
    .from('kiwify_event_mappings')
    .select('target_pipeline_id, target_stage_id, tags_to_add, tags_to_remove')
    .eq('trigger', trigger).is('product_id', null).eq('active', true).maybeSingle();
  return (data as MappingRow) ?? null;
}

/** Load automation preferring a product-specific row, falling back to the default. */
async function loadAutomation(
  supabase: SupabaseClient,
  productId: string | null,
  trigger: KiwifyTrigger,
): Promise<AutomationRow | null> {
  if (productId) {
    const { data } = await supabase
      .from('kiwify_message_automations')
      .select('id, steps, cancel_on_triggers')
      .eq('trigger', trigger).eq('product_id', productId).eq('active', true).maybeSingle();
    if (data) return data as AutomationRow;
  }
  const { data } = await supabase
    .from('kiwify_message_automations')
    .select('id, steps, cancel_on_triggers')
    .eq('trigger', trigger).is('product_id', null).eq('active', true).maybeSingle();
  return (data as AutomationRow) ?? null;
}

/**
 * Cancel pending jobs of the same contact (and order, when present) whose cancel_on_triggers
 * include the current trigger. e.g. compra_aprovada cancels pending pix/cart recovery jobs.
 */
async function cancelJobs(
  supabase: SupabaseClient,
  peopleId: string,
  orderId: string | null,
  trigger: KiwifyTrigger,
): Promise<void> {
  let q = supabase
    .from('kiwify_message_jobs')
    .update({ status: 'cancelled', error_message: `cancelled by ${trigger}` })
    .eq('people_id', peopleId)
    .eq('status', 'pending')
    .contains('cancel_on_triggers', [trigger]);
  // Scope to the order when the cancelling event carries one; cart-recovery jobs (no order)
  // are cancelled by contact only.
  if (orderId) q = q.or(`order_id.eq.${orderId},order_id.is.null`);
  await q;
}
