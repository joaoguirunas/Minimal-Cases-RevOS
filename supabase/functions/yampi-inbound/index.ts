/**
 * YAMPI INBOUND — YMP-1.3
 *
 * POST /yampi-inbound → receives Yampi webhooks (public, verify_jwt=false).
 *
 * Flow (mirrors kiwify-inbound):
 *   1. Read raw body ONCE (exact bytes — needed for HMAC + parse).
 *   2. Resolve yampi_connections (single-tenant; optional ?cid= disambiguator).
 *   3. signature_valid = base64(HMAC-SHA256(raw_body, webhook secret_key)) compared
 *      constant-time against the X-Yampi-Hmac-SHA256 header (officially documented).
 *      Rejection (401) is gated on yampi_connections.enforce_signature (default TRUE).
 *   4. UPSERT idempotently into yampi_webhook_events
 *      (ON CONFLICT (connection_id, event_type, dedup_key) DO NOTHING).
 *   5. Respond 200 within Yampi's 5s deadline; enqueue yampi-process-event via
 *      EdgeRuntime.waitUntil.
 *   6. Safety-net: any internal error after validation still returns 200 (30 failures
 *      auto-deactivate the webhook on Yampi's side); event stored status='failed'.
 *
 * Env vars required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import { decryptYampiWebhookSecret, type YampiConnectionRow } from '../_shared/yampi-client.ts';
import { type DerivedEvent, deriveEvent, md5Hex, verifySignature, YAMPI_SIGNATURE_HEADER } from './logic.ts';

// Supabase Edge runtime global (not part of the Deno type lib).
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-yampi-hmac-sha256',
};

type Json = Record<string, unknown>;

async function resolveConnection(
  supabase: SupabaseClient,
  url: URL,
): Promise<YampiConnectionRow | null> {
  const sel = 'id, alias, user_token_enc, user_secret_enc, webhook_id, webhook_secret_enc, enforce_signature, status, last_error';
  const cid = url.searchParams.get('cid');
  if (cid) {
    const { data } = await supabase.from('yampi_connections').select(sel).eq('id', cid).maybeSingle();
    return (data as YampiConnectionRow | null) ?? null;
  }
  const { data } = await supabase
    .from('yampi_connections')
    .select(sel)
    .order('created_at', { ascending: false });
  const rows = (data ?? []) as YampiConnectionRow[];
  if (rows.length === 0) return null;
  return rows.find((c) => c.status === 'connected') ?? rows[0];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const log = createLogger('yampi-inbound');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const rawBody = await req.text();
  const url = new URL(req.url);
  const signatureHeader = req.headers.get(YAMPI_SIGNATURE_HEADER);

  const conn = await resolveConnection(supabase, url);
  if (!conn) {
    // No connection configured — nothing to attribute the event to. Ack 200 so
    // Yampi stops retrying; the integration simply isn't set up.
    log.warn('no_connection_configured', { path: url.pathname });
    return new Response('OK', { status: 200 });
  }

  const secretKey = await decryptYampiWebhookSecret(supabase, conn);
  const signatureValid = await verifySignature(rawBody, signatureHeader, secretKey);

  if (conn.enforce_signature && !signatureValid) {
    log.warn('signature_rejected', { connection_id: conn.id, has_sig: signatureHeader !== null });
    return new Response('Unauthorized', { status: 401 });
  }

  // ── Safety net: past this point always 200 (stop Yampi retries/deactivation) ──
  let derived: DerivedEvent | null = null;
  try {
    let payload: Json;
    try {
      payload = JSON.parse(rawBody) as Json;
    } catch {
      log.error('invalid_json', { connection_id: conn.id });
      await supabase.from('yampi_webhook_events').upsert({
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

    const { data: inserted, error: insertErr } = await supabase
      .from('yampi_webhook_events')
      .upsert({
        connection_id: conn.id,
        trigger: derived.trigger,
        event_type: derived.eventType,
        order_id: derived.orderId,
        cart_token: derived.cartToken,
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
      log.info('duplicate_event', {
        connection_id: conn.id, event_type: derived.eventType, dedup_key: derived.dedupKey,
      });
      return new Response('OK', { status: 200 });
    }

    log.info('event_stored', {
      event_id: inserted.id, event_type: derived.eventType, trigger: derived.trigger,
      signature_valid: signatureValid,
    });

    const eventId = inserted.id;
    EdgeRuntime.waitUntil(
      fetch(`${supabaseUrl}/functions/v1/yampi-process-event`, {
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
    log.error('unhandled_error', { connection_id: conn.id, error: (err as Error).message });
    try {
      await supabase.from('yampi_webhook_events').upsert({
        connection_id: conn.id,
        trigger: derived?.trigger ?? null,
        event_type: derived?.eventType ?? 'error',
        order_id: derived?.orderId ?? null,
        cart_token: derived?.cartToken ?? null,
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
