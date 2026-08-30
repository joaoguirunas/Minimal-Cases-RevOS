/**
 * Cal.com — Webhook Receiver
 *
 * POST /calcom-webhook  (verify_jwt = false; validated by HMAC-SHA256)
 *
 * Triggers handled:
 *   BOOKING_CREATED         → upsert meetings (onConflict: calcom_uid)
 *   BOOKING_RESCHEDULED     → update start/end, status 'agendado'
 *   BOOKING_CANCELLED       → status 'cancelado'
 *   BOOKING_NO_SHOW_UPDATED → status 'nao_compareceu'
 *
 * Security: HMAC-SHA256 of the raw body with the connection's webhook_secret,
 * compared against the `x-cal-signature-256` header.
 *
 * IMPORTANT: always returns HTTP 200 (except on a verified HMAC mismatch → 401)
 * so Cal.com does not re-enqueue the event.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cal-signature-256',
};

function ok(body: Record<string, unknown> = { ok: true }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ ok: false, error: 'invalid_signature' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function verifyCalcomSignature(body: string, secret: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  return computed === signature.toLowerCase();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const log = createLogger('calcom-webhook');

  if (req.method !== 'POST') {
    return ok({ ok: false, error: 'method_not_allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const raw = await req.text();
    const signature = req.headers.get('x-cal-signature-256') ?? '';

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      log.error('Invalid JSON body');
      return ok({ ok: false, error: 'invalid_json' });
    }

    const triggerEvent = (parsed.triggerEvent ?? parsed.event) as string | undefined;
    const payload = (parsed.payload ?? parsed) as Record<string, any>;

    // === Resolve the owning connection ===
    const crmLeadId = payload?.metadata?.crm_lead_id ?? payload?.responses?.leadId?.value ?? null;
    const crmPeopleId = payload?.metadata?.crm_people_id ?? null;
    const crmUserIdMeta = payload?.metadata?.crm_user_id ?? null;
    const organizerEmail = payload?.organizer?.email ?? null;

    type Conn = { user_id: string; webhook_secret: string | null };
    let conn: Conn | null = null;

    if (crmUserIdMeta) {
      const { data } = await supabase
        .from('user_calcom_connections')
        .select('user_id, webhook_secret')
        .eq('user_id', crmUserIdMeta)
        .maybeSingle();
      conn = (data as Conn | null) ?? null;
    }

    if (!conn && organizerEmail) {
      const { data: su } = await supabase
        .from('settings_users')
        .select('id')
        .eq('email', organizerEmail)
        .maybeSingle();
      if (su?.id) {
        const { data } = await supabase
          .from('user_calcom_connections')
          .select('user_id, webhook_secret')
          .eq('user_id', su.id)
          .maybeSingle();
        conn = (data as Conn | null) ?? null;
      }
    }

    if (!conn) {
      log.warn('No matching Cal.com connection — skipping', { organizerEmail, crmUserIdMeta });
      return ok({ ok: false, error: 'connection_not_found' });
    }

    // === HMAC validation ===
    if (conn.webhook_secret) {
      const valid = await verifyCalcomSignature(raw, conn.webhook_secret, signature);
      if (!valid) {
        log.warn('HMAC signature mismatch — rejecting', { organizerEmail });
        return unauthorized();
      }
    } else {
      log.warn('Connection has no webhook_secret — accepting without HMAC validation');
    }

    const crmUserId = conn.user_id;
    const uid: string | undefined = payload?.uid;
    const now = new Date().toISOString();

    log.info('Received event', { triggerEvent, uid });

    switch (triggerEvent) {
      case 'BOOKING_CREATED': {
        if (!uid) {
          log.warn('BOOKING_CREATED without uid — skipping');
          break;
        }
        const meeting = {
          title: payload.title ?? 'Reunião Cal.com',
          start_time: payload.startTime,
          end_time: payload.endTime,
          calcom_uid: uid,
          status: 'agendado',
          source: 'calcom',
          user_id: crmUserId,
          lead_id: crmLeadId,
          people_id: crmPeopleId,
          notes: payload?.responses?.notes?.value ?? null,
          meeting_link: payload?.metadata?.videoCallUrl ?? null,
          attendee_emails: Array.isArray(payload?.attendees)
            ? payload.attendees.map((a: any) => a.email).filter(Boolean)
            : [],
          updated_at: now,
        };
        const { error } = await supabase
          .from('meetings')
          .upsert(meeting, { onConflict: 'calcom_uid' });
        if (error) log.error('BOOKING_CREATED upsert failed', { error: error.message, uid });
        break;
      }

      case 'BOOKING_RESCHEDULED': {
        if (!uid) break;
        const { error } = await supabase
          .from('meetings')
          .update({ start_time: payload.startTime, end_time: payload.endTime, status: 'agendado', updated_at: now })
          .eq('calcom_uid', uid);
        if (error) log.error('BOOKING_RESCHEDULED update failed', { error: error.message, uid });
        break;
      }

      case 'BOOKING_CANCELLED': {
        if (!uid) break;
        const { error } = await supabase
          .from('meetings')
          .update({ status: 'cancelado', updated_at: now })
          .eq('calcom_uid', uid);
        if (error) log.error('BOOKING_CANCELLED update failed', { error: error.message, uid });
        break;
      }

      case 'BOOKING_NO_SHOW_UPDATED': {
        if (!uid) break;
        const { error } = await supabase
          .from('meetings')
          .update({ status: 'nao_compareceu', updated_at: now })
          .eq('calcom_uid', uid);
        if (error) log.error('BOOKING_NO_SHOW_UPDATED update failed', { error: error.message, uid });
        break;
      }

      default:
        log.warn('Unknown Cal.com trigger — ignoring', { triggerEvent });
        break;
    }

    return ok({ ok: true, triggerEvent });
  } catch (err) {
    log.error('Unhandled error in calcom-webhook', { error: (err as Error).message });
    return ok({ ok: true, internal_error: true });
  }
});
