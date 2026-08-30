/**
 * KIWIFY INBOUND — KFY-1.4
 *
 * POST /kiwify-inbound  → receives Kiwify sales webhooks (public, --no-verify-jwt).
 *
 * Flow (mirrors whatsapp-inbound):
 *   1. Read raw body ONCE (exact bytes — needed for signature + parse).
 *   2. Resolve kiwify_connections (single-tenant; optional ?cid= disambiguator).
 *   3. Compute signature_valid = HMAC-SHA1(raw_body, key=webhook_token) hex, compared
 *      constant-time against the ?signature= query param. ALWAYS persist regardless of
 *      the result (best-guess mechanism — see NOTES). The 401-reject is gated behind
 *      kiwify_connections.enforce_signature (default false until confirmed vs a real payload).
 *   4. UPSERT idempotently into kiwify_webhook_events
 *      (ON CONFLICT (connection_id, event_type, dedup_key) DO NOTHING).
 *   5. Respond 200 immediately; enqueue kiwify-process-event via EdgeRuntime.waitUntil.
 *   6. Safety-net: any internal error after validation still returns 200 (Kiwify must
 *      not re-deliver in a loop); the event is stored with status='failed' + error.
 *
 * ⚠️ SIGNATURE MECHANISM IS UNCONFIRMED (research §2): the sales-webhook signature is not
 * officially documented. `?signature=HMAC-SHA1(raw_body, key=token)` hex is community
 * knowledge. enforce_signature stays false until a real webhook is captured (webhook.site)
 * and the mechanism is validated. Until then this function never rejects — intentional.
 *
 * Env vars required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import { type DerivedEvent, deriveEvent, md5Hex, verifySignature } from './logic.ts';

// Supabase Edge runtime global (not part of the Deno type lib).
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Json = Record<string, unknown>;

interface ConnectionRow {
  id: string;
  account_id: string;
  webhook_token_enc: string | null;
  enforce_signature: boolean;
  status: string;
}

// ── Connection resolution ─────────────────────────────────────────────────────

async function resolveConnection(
  supabase: SupabaseClient,
  url: URL,
): Promise<ConnectionRow | null> {
  // Optional disambiguator when kiwify-connect registers the URL with ?cid=<connection_id>.
  const cid = url.searchParams.get('cid');
  const query = supabase
    .from('kiwify_connections')
    .select('id, account_id, webhook_token_enc, enforce_signature, status');

  if (cid) {
    const { data } = await query.eq('id', cid).maybeSingle() as unknown as { data: ConnectionRow | null };
    return data ?? null;
  }

  // Single-tenant fallback: prefer a connected account, else the most recent row.
  const { data } = await supabase
    .from('kiwify_connections')
    .select('id, account_id, webhook_token_enc, enforce_signature, status')
    .order('created_at', { ascending: false }) as unknown as { data: ConnectionRow[] | null };

  if (!data || data.length === 0) return null;
  return data.find((c) => c.status === 'connected') ?? data[0];
}

async function decryptToken(
  supabase: SupabaseClient,
  conn: ConnectionRow,
): Promise<string | null> {
  if (!conn.webhook_token_enc) return null;
  const { data, error } = await supabase.rpc('app_decrypt_secret', {
    p_encrypted: conn.webhook_token_enc,
    p_context: `kiwify_${conn.account_id}`,
  });
  if (error) return null;
  return (data as string) ?? null;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const log = createLogger('kiwify-inbound');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Read the raw body ONCE — exact bytes are required for both signature + parse.
  const rawBody = await req.text();
  const url = new URL(req.url);
  const signatureParam = url.searchParams.get('signature');

  // Resolve connection + verify signature BEFORE the safety-net so a genuine 401 (when
  // enforcement is on) is not swallowed into a 200.
  const conn = await resolveConnection(supabase, url);
  if (!conn) {
    // No connection configured — nothing to attribute the event to (connection_id is
    // NOT NULL). Ack 200 so Kiwify stops retrying; integration simply isn't set up.
    log.warn('no_connection_configured', { path: url.pathname });
    return new Response('OK', { status: 200 });
  }

  const webhookToken = await decryptToken(supabase, conn);
  const signatureValid = await verifySignature(rawBody, signatureParam, webhookToken);

  if (conn.enforce_signature && !signatureValid) {
    log.warn('signature_rejected', { connection_id: conn.id, has_sig: signatureParam !== null });
    return new Response('Unauthorized', { status: 401 });
  }

  // ── Safety net: any failure past this point still returns 200 to stop Kiwify retries ──
  let derived: DerivedEvent | null = null;
  try {
    let payload: Json;
    try {
      payload = JSON.parse(rawBody) as Json;
    } catch {
      // Unparseable body — persist as failed for audit, then ack.
      log.error('invalid_json', { connection_id: conn.id });
      await supabase.from('kiwify_webhook_events').upsert({
        connection_id: conn.id,
        event_type: 'unparseable',
        dedup_key: md5Hex(rawBody),
        raw_payload: { _raw: rawBody.slice(0, 4000) },
        signature_valid: signatureValid,
        status: 'failed',
        error: 'invalid_json',
      }, { onConflict: 'connection_id,event_type,dedup_key', ignoreDuplicates: true });
      return new Response('OK', { status: 200 });
    }

    derived = deriveEvent(payload, rawBody);

    // Idempotent insert. ignoreDuplicates → a conflict returns no row; a fresh insert
    // returns the row. That distinction decides whether we enqueue processing.
    const { data: inserted, error: insertErr } = await supabase
      .from('kiwify_webhook_events')
      .upsert({
        connection_id: conn.id,
        trigger: derived.trigger,
        event_type: derived.eventType,
        order_id: derived.orderId,
        subscription_id: derived.subscriptionId,
        dedup_key: derived.dedupKey,
        raw_payload: payload,
        signature_valid: signatureValid,
        status: 'received',
      }, { onConflict: 'connection_id,event_type,dedup_key', ignoreDuplicates: true })
      .select('id')
      .maybeSingle() as unknown as { data: { id: string } | null; error: { message: string } | null };

    if (insertErr) {
      log.error('event_insert_failed', { connection_id: conn.id, error: insertErr.message });
      return new Response('OK', { status: 200 });
    }

    if (!inserted) {
      // Duplicate (Kiwify retry) — already stored, do not re-enqueue.
      log.info('duplicate_event', {
        connection_id: conn.id, event_type: derived.eventType, dedup_key: derived.dedupKey,
      });
      return new Response('OK', { status: 200 });
    }

    log.info('event_stored', {
      event_id: inserted.id, event_type: derived.eventType, trigger: derived.trigger,
      signature_valid: signatureValid,
    });

    // Enqueue processing without blocking the 200 response.
    const eventId = inserted.id;
    EdgeRuntime.waitUntil(
      fetch(`${supabaseUrl}/functions/v1/kiwify-process-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({ event_id: eventId }),
      }).then((r) => {
        if (!r.ok) log.warn('process_event_dispatch_non_ok', { event_id: eventId, status: r.status });
      }).catch((e) => {
        log.silent('process_event_dispatch_failed', { event_id: eventId, error: (e as Error).message });
      }),
    );

    return new Response('OK', { status: 200 });
  } catch (err) {
    // Post-validation failure: try to record it as a failed event for audit, always ack 200.
    log.error('unhandled_error', { connection_id: conn.id, error: (err as Error).message });
    try {
      await supabase.from('kiwify_webhook_events').upsert({
        connection_id: conn.id,
        trigger: derived?.trigger ?? null,
        event_type: derived?.eventType ?? 'error',
        order_id: derived?.orderId ?? null,
        subscription_id: derived?.subscriptionId ?? null,
        dedup_key: derived?.dedupKey ?? md5Hex(rawBody),
        raw_payload: { _raw: rawBody.slice(0, 4000) },
        signature_valid: signatureValid,
        status: 'failed',
        error: (err as Error).message,
      }, { onConflict: 'connection_id,event_type,dedup_key', ignoreDuplicates: true });
    } catch (_) { /* best-effort audit only */ }
    return new Response('OK', { status: 200 });
  }
});
