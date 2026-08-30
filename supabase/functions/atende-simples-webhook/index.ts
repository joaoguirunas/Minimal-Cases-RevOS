// atende-simples-webhook — Status callback receiver from Atende Simples
//
// Receives call lifecycle events when Atende Simples dials a client and
// routes the call to the ORA voice agent (ElevenLabs SIP).
//
// Supported events:
//   - call.start     → call ringing
//   - call.answer    → client picked up
//   - call.wrap      → call ended (with result/duration/audio)
//
// Behavior:
//   - Logs all events to console (visible in Supabase Functions logs)
//   - On call.wrap with answered result, inserts a message row into the
//     CRM inbox (channel='telefone', from_contact='agente_ia') for visibility
//   - Always returns 200 OK so Atende Simples doesn't retry/mark as failed
//
// NOTE: This is a minimal version. The legacy webhook in the old project
// did campaign retry, WhatsApp fallback, credit adjustment, etc. — those
// features aren't ported here because they depend on tables (campaign_calls,
// campaigns, brokers, etc.) that don't exist in this project.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ATENDE_SECRET = Deno.env.get('ATENDE_WEBHOOK_SECRET') ?? '';

async function verifyAtendeHubSignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!ATENDE_SECRET) {
    console.warn('[atende] ATENDE_WEBHOOK_SECRET not set — skipping verification');
    return true;
  }
  if (!signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(ATENDE_SECRET),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return signature === `sha1=${hex}` || signature === hex;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-hub-signature, x-atendesimples-event, x-atendesimples-request-id, x-atendesimples-environment',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

interface AtendePayload {
  event_code?: string;
  call?: {
    id?: number;
    call_id?: string;
    dialer_info_1?: string;
    dialer_info_2?: string;
    dialer_info_3?: string;
    started_at?: string;
    ringing_at?: string;
    answered_at?: string;
    ended_at?: string;
    result_leg_a?: string;
    result_leg_b?: string;
    total_duration?: number | string;
    billed_duration?: string;
    audio_url?: string;
    outbound_calls?: Array<{
      phone_number?: string;
      to_number?: string;
      duration?: string;
      duration_call?: string;
      billing_time?: string;
      result?: string;
      audio_url?: string;
      attendant_email?: string;
      mailbox_detected?: boolean;
    }>;
  };
}

const SUPPORTED_EVENTS = ['call.start', 'call.answer', 'call.wrap'] as const;

function parseDuration(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? 0 : Math.round(parsed);
}

function mapWrapResult(resultLegB?: string): string {
  if (!resultLegB) return 'unknown';
  const map: Record<string, string> = {
    answered: 'answered',
    canceled: 'canceled',
    absent: 'rejected',
    not_answered: 'no_answer',
    busy_or_unavailable: 'busy',
    answered_machine: 'voicemail',
    error: 'failed',
  };
  return map[resultLegB.toLowerCase()] ?? 'unknown';
}

function digitsOnly(phone: string | undefined | null): string {
  return (phone ?? '').replace(/\D/g, '');
}

function phoneVariants(phone: string): string[] {
  const d = digitsOnly(phone);
  const set = new Set<string>([phone, d]);
  if (d.startsWith('55')) {
    const noBR = d.slice(2);
    set.add(noBR);
    set.add(`+${d}`);
    set.add(`+55${noBR}`);
  } else {
    set.add(`55${d}`);
    set.add(`+55${d}`);
    set.add(`+${d}`);
  }
  return [...set].filter(Boolean);
}

async function findLeadByPhone(supabase: any, phone: string): Promise<{ lead_id: string } | null> {
  const variants = phoneVariants(phone);
  if (variants.length === 0) return null;
  const { data: people } = await supabase
    .from('clients_people')
    .select('id')
    .in('whatsapp', variants)
    .limit(1);
  const person = (people ?? [])[0];
  if (!person) return null;
  const { data: leads } = await supabase
    .from('leads')
    .select('id')
    .eq('people_id', person.id)
    .neq('status', 'lost')
    .order('created_at', { ascending: false })
    .limit(1);
  const lead = (leads ?? [])[0];
  if (!lead) return null;
  return { lead_id: lead.id };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 200);

  const eventHeader = req.headers.get('x-atendesimples-event') ?? 'unknown';
  const requestId = req.headers.get('x-atendesimples-request-id') ?? 'unknown';
  const environment = req.headers.get('x-atendesimples-environment') ?? 'production';

  console.log(`[atende] received event=${eventHeader} request_id=${requestId} env=${environment}`);

  if (environment === 'staging') {
    console.log('[atende] skipping staging event');
    return json({ ok: true, skipped: 'staging' });
  }

  let body: AtendePayload | null = null;
  let bodyText = '';
  try {
    bodyText = await req.text();

    const sigHeader = req.headers.get('x-hub-signature') ?? req.headers.get('X-Hub-Signature');
    const valid = await verifyAtendeHubSignature(bodyText, sigHeader);
    if (!valid) {
      // Log warning but never reject — Atende Simples may not send signature,
      // and a 4xx response causes it to cancel the B leg (ElevenLabs SIP routing).
      console.warn('[atende] signature missing or invalid — proceeding anyway');
    }

    body = JSON.parse(bodyText);
  } catch {
    console.error('[atende] invalid JSON body');
    return json({ ok: true, error: 'invalid_json' });
  }

  const event = body?.event_code ?? eventHeader;

  if (!SUPPORTED_EVENTS.includes(event as any) && event !== 'ping') {
    console.log(`[atende] ignoring unsupported event: ${event}`);
    return json({ ok: true, ignored: event });
  }

  if (event === 'ping') {
    return json({ ok: true, event: 'ping' });
  }

  console.log(`[atende] event=${event}`, JSON.stringify(body?.call ?? {}, null, 0).slice(0, 500));

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    if (event === 'call.start') {
      console.log('[atende] call.start — call ringing');
      return json({ ok: true, event });
    }

    if (event === 'call.answer') {
      console.log('[atende] call.answer — client picked up');
      return json({ ok: true, event });
    }

    if (event === 'call.wrap') {
      const call = body?.call ?? {};
      const outbound = call.outbound_calls?.[0] ?? {};
      const resultLegB = call.result_leg_b ?? outbound.result;
      const mappedStatus = mapWrapResult(resultLegB);
      const duration = parseDuration(outbound.duration ?? outbound.duration_call ?? call.total_duration);
      const billing = parseDuration(outbound.billing_time ?? call.billed_duration);
      const audioUrl = outbound.audio_url ?? call.audio_url ?? null;
      const phone = outbound.phone_number ?? outbound.to_number ?? '';

      console.log(
        `[atende] call.wrap — result=${resultLegB} mapped=${mappedStatus} duration=${duration}s billing=${billing}s audio=${audioUrl ? 'yes' : 'no'} phone=${phone}`,
      );

      // Best-effort: log a message row in CRM inbox if we can resolve the lead by phone
      if (phone) {
        const found = await findLeadByPhone(supabase, phone);
        if (found) {
          const summary =
            mappedStatus === 'answered'
              ? `Ligação atendida (${duration}s)${audioUrl ? ` — áudio: ${audioUrl}` : ''}`
              : `Ligação ${mappedStatus} — sem conexão`;

          const { error: msgErr } = await supabase.from('messages').insert({
            lead_id: found.lead_id,
            channel: 'telefone',
            from_contact: 'agente_ia',
            message_type: 'texto',
            content: `[ORA voice agent] ${summary}`,
          });
          if (msgErr) {
            console.warn('[atende] failed to insert message log:', msgErr.message);
          } else {
            console.log(`[atende] logged message for lead=${found.lead_id}`);
          }
        } else {
          console.log(`[atende] no lead found for phone=${phone}, skipping message log`);
        }
      }

      // ── Update sends_contacts status if this call came from a disparo ──────
      const sendContactId = call.dialer_info_3;
      if (sendContactId && sendContactId.length > 10) {
        const isAnswered = mappedStatus === 'answered';
        const finalStatus = isAnswered ? 'delivered' : 'failed';
        const errorMsg = isAnswered ? null : `Chamada ${mappedStatus}`;

        const { error: updateErr } = await supabase
          .from('sends_contacts')
          .update({
            status: finalStatus,
            ...(isAnswered
              ? { delivered_at: new Date().toISOString() }
              : { error_message: errorMsg }),
          })
          .eq('id', sendContactId);

        if (updateErr) {
          console.warn('[atende] failed to update sends_contacts:', updateErr.message);
        } else {
          console.log(`[atende] sends_contacts updated: id=${sendContactId} status=${finalStatus}`);

          const { data: scRow } = await supabase
            .from('sends_contacts')
            .select('send_id')
            .eq('id', sendContactId)
            .maybeSingle();

          if (scRow?.send_id) {
            const { count } = await supabase
              .from('sends_contacts')
              .select('id', { count: 'exact', head: true })
              .eq('send_id', scRow.send_id)
              .in('status', ['pending', 'sent']);

            if ((count ?? 0) === 0) {
              await supabase
                .from('sends')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('id', scRow.send_id);
              console.log(`[atende] send ${scRow.send_id} marked completed`);
            }
          }
        }
      }

      return json({ ok: true, event, status: mappedStatus, duration, billing });
    }

    return json({ ok: true });
  } catch (err) {
    console.error('[atende] unexpected error:', err);
    return json({ ok: true, error: 'internal' });
  }
});
