/**
 * OMNI PRO™ Delivery Engine
 *
 * ⚠️  DEPLOY: always use --no-verify-jwt
 *     supabase functions deploy omni-delivery-engine --no-verify-jwt
 *     (called by pg_cron via service role — no Supabase JWT)
 *
 * Picks up messages with status='pending' (from_contact != 'cliente') and
 * dispatches them through the appropriate channel.
 *
 * Dispatch matrix:
 *   whatsapp  → whatsapp-outbound edge function (Meta Graph API)
 *   instagram → instagram-outbound edge function (Meta Graph API)
 *   email     → omni_channel_configs.webhook_fallback
 *   sms       → omni_channel_configs.webhook_fallback
 *   telefone  → omni_channel_configs.webhook_fallback
 *
 * Status flow (messages table, constraint: pending|sent|delivered|read|error):
 *   pending → sent    (on successful dispatch)
 *   pending → error   (on dispatch failure)
 *
 * Note: whatsapp-outbound handles its own status updates via message_ids.
 *
 * Env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import {
  sendEmailWithConfig,
  hasDirectEmailProvider,
  type EmailCredentials,
} from '../_shared/email-provider.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Max messages processed per cron tick (keeps execution under ~30s)
const BATCH_SIZE = 20;
// Max age — discard messages older than this without delivering
const MAX_AGE_HOURS = 24;

// ── Types ─────────────────────────────────────────────────────────────────────

interface PendingMessage {
  id: number;
  channel: string | null;
  content: string;
  message_type: string | null;
  media_url: string | null;
  media_metadata: Record<string, unknown> | null;
  people_id: string | null;
  lead_id: string | null;
  user_id: string | null;
  source_type: string | null;
  module_ref_id: string | null;
  whatsapp_template_id: string | null;
  wa_phone_number_id: string | null;
  execution_id: string | null;
  metadata: Record<string, unknown> | null;
  sent_at: string | null;
}

interface Person {
  id: string;
  name: string;
  whatsapp: string | null;      // WhatsApp number (primary for WA delivery)
  telefone: string | null;      // Fallback phone number
  email: string | null;
  instagram_id: string | null;  // Instagram IGSID for DM delivery
}

interface ChannelConfig {
  channel: string;
  is_active: boolean;
  credentials: Record<string, unknown>;
  settings: Record<string, unknown>;
  webhook_fallback: {
    enabled?: boolean;
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    payload_template?: string;
  };
}

interface DeliveryResult {
  message_id: number;
  channel: string;
  success: boolean;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the best phone number for WhatsApp delivery.
 * Prefers `whatsapp` field; falls back to `telefone`.
 * Strips non-digits — Meta expects digits only (with country code).
 */
function resolveWaPhone(person: Person): string | null {
  const raw = person.whatsapp || person.telefone || null;
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return null;
  // Brazilian numbers stored without DDI (10–11 digits): add country code 55
  // Meta Graph API expects digits with country code, no leading +
  if (digits.length >= 10 && digits.length <= 11) return '55' + digits;
  return digits;
}

/** Simple mustache-style template: replaces {{key}} with vars[key]. */
function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

// ── WhatsApp delivery ─────────────────────────────────────────────────────────
// Delegates to whatsapp-outbound which handles Meta API + status updates via message_ids.

async function deliverWhatsApp(
  msgs: PendingMessage[],
  people: Map<string, Person>,
  supabaseUrl: string,
  serviceRoleKey: string,
  log: ReturnType<typeof createLogger>,
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];

  // Group by people_id so each person gets one outbound call with all their messages
  const byPerson = new Map<string, PendingMessage[]>();
  for (const msg of msgs) {
    const pid = msg.people_id ?? '__unknown__';
    if (!byPerson.has(pid)) byPerson.set(pid, []);
    byPerson.get(pid)!.push(msg);
  }

  for (const [pid, group] of byPerson.entries()) {
    const person = pid !== '__unknown__' ? people.get(pid) : null;
    const to = person ? resolveWaPhone(person) : null;

    if (!to) {
      log.warn('wa_no_phone', { people_id: pid, message_ids: group.map(m => m.id) });
      for (const msg of group) {
        results.push({
          message_id: msg.id, channel: 'whatsapp', success: false,
          error: 'No WhatsApp phone number for person',
        });
      }
      continue;
    }

    // Build messages array — whatsapp-outbound normalises strings, objects, and templates
    const outboundMessages = group.map(msg => {
      if (msg.whatsapp_template_id) {
        const meta = msg.metadata as Record<string, unknown> | null;
        // template_name: ONLY use metadata (set by send-dispatch-worker or frontend).
        // NEVER fall back to whatsapp_template_id — it's a DB UUID, not a Meta template name.
        const templateName = (meta?.template_name as string) || '';
        if (!templateName) {
          log.error('wa_template_name_missing', {
            message_id: msg.id,
            whatsapp_template_id: msg.whatsapp_template_id,
            hint: 'metadata.template_name is empty — template may lack meta_template_name in DB',
          });
        }
        return {
          type: 'template',
          template_name: templateName,
          language_code: (meta?.language_code as string) || 'pt_BR',
          components: meta?.components ?? [],
        };
      }
      if (msg.media_url) {
        return {
          type: msg.message_type ?? 'image',
          text: msg.content,
          media_url: msg.media_url,
          mime_type: (msg.media_metadata as Record<string, unknown>)?.mime_type as string ?? undefined,
          filename: (msg.media_metadata as Record<string, unknown>)?.file_name as string ?? undefined,
        };
      }
      return msg.content; // plain text
    });

    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/whatsapp-outbound`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          to,
          messages: outboundMessages,
          people_id: pid !== '__unknown__' ? pid : undefined,
          lead_id: group[0].lead_id ?? undefined,
          execution_id: group[0].execution_id ?? undefined,
          // Campanha (Sends PRO) escolhe o canal explicitamente por disparo — isso é
          // intencional e tem que ganhar de active_channel_id. Pra qualquer outro
          // source_type (ai_agent, followup, manual, inbound), omite e deixa
          // whatsapp-outbound resolver via people_id -> clients_people.active_channel_id,
          // que reflete o canal que a pessoa está usando de fato agora.
          channel_id: group[0].source_type === 'campaign' ? (group[0].wa_phone_number_id ?? undefined) : undefined,
          // message_ids: whatsapp-outbound will update wa_message_id + status for each
          message_ids: group.map(m => m.id),
        }),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        log.error('wa_outbound_http_error', {
          people_id: pid, status: resp.status, error: errBody,
          message_ids: group.map(m => m.id),
        });
        for (const msg of group) {
          results.push({
            message_id: msg.id, channel: 'whatsapp', success: false,
            error: `whatsapp-outbound ${resp.status}: ${errBody}`,
          });
        }
        continue;
      }

      const result = await resp.json() as { sent?: number; failed?: number; errors?: string[] };
      const allOk = (result.failed ?? 0) === 0;

      log.info('wa_delivered', {
        people_id: pid, to, sent: result.sent, failed: result.failed,
        message_ids: group.map(m => m.id),
      });

      for (const msg of group) {
        results.push({ message_id: msg.id, channel: 'whatsapp', success: allOk });
      }
    } catch (e) {
      const errMsg = String(e);
      log.error('wa_fetch_exception', { people_id: pid, error: errMsg });
      for (const msg of group) {
        results.push({ message_id: msg.id, channel: 'whatsapp', success: false, error: errMsg });
      }
    }
  }

  return results;
}

// ── Instagram delivery ────────────────────────────────────────────────────────
// Delegates to instagram-outbound which handles Meta Graph API + status updates.

async function deliverInstagram(
  msgs: PendingMessage[],
  people: Map<string, Person>,
  supabaseUrl: string,
  serviceRoleKey: string,
  log: ReturnType<typeof createLogger>,
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];

  // Group by people_id
  const byPerson = new Map<string, PendingMessage[]>();
  for (const msg of msgs) {
    const pid = msg.people_id ?? '__unknown__';
    if (!byPerson.has(pid)) byPerson.set(pid, []);
    byPerson.get(pid)!.push(msg);
  }

  for (const [pid, group] of byPerson.entries()) {
    const person = pid !== '__unknown__' ? people.get(pid) : null;

    // Split group by delivery path:
    //   reply_comentario → instagram-comment-reply (/replies — public, visible on post)
    //   private_reply    → instagram-comment-reply (/private_replies — private DM, no IGSID needed)
    //   everything else  → instagram-outbound (/{business_id}/messages — requires IGSID + 7-day window)
    const commentReplies = group.filter(m => m.message_type === 'reply_comentario');
    const privateReplies = group.filter(m => m.message_type === 'private_reply');
    const dmMessages     = group.filter(m => m.message_type !== 'reply_comentario' && m.message_type !== 'private_reply');

    // ── Comment replies ──────────────────────────────────────────────────
    if (commentReplies.length > 0) {
      try {
        const igCommentIds = commentReplies.map(m =>
          (m.media_metadata as Record<string, string> | null)?.reply_to_comment_id ?? '',
        );
        const resp = await fetch(`${supabaseUrl}/functions/v1/instagram-comment-reply`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            people_id: pid !== '__unknown__' ? pid : undefined,
            message_ids: commentReplies.map(m => m.id),
            messages: commentReplies.map(m => m.content),
            ig_comment_ids: igCommentIds,
          }),
        });

        if (!resp.ok) {
          const errBody = await resp.text();
          log.error('ig_comment_reply_http_error', {
            people_id: pid, status: resp.status, error: errBody,
            message_ids: commentReplies.map(m => m.id),
          });
          for (const msg of commentReplies) {
            results.push({
              message_id: msg.id, channel: 'instagram', success: false,
              error: `instagram-comment-reply ${resp.status}: ${errBody}`,
            });
          }
        } else {
          const result = await resp.json() as { sent?: number; failed?: number; results?: Array<{ message_id: number; success: boolean; error?: string }> };
          const allOk = (result.failed ?? 0) === 0;
          log.info('ig_comment_reply_delivered', {
            people_id: pid, sent: result.sent, failed: result.failed,
            message_ids: commentReplies.map(m => m.id),
          });
          for (const msg of commentReplies) {
            const r = result.results?.find(x => x.message_id === msg.id);
            results.push({ message_id: msg.id, channel: 'instagram', success: r?.success ?? allOk, error: r?.error });
          }
        }
      } catch (e) {
        const errMsg = String(e);
        log.error('ig_comment_reply_exception', { people_id: pid, error: errMsg });
        for (const msg of commentReplies) {
          results.push({ message_id: msg.id, channel: 'instagram', success: false, error: errMsg });
        }
      }
    }

    // ── Private replies — POST /{comment_id}/private_replies (no IGSID needed) ─
    if (privateReplies.length > 0) {
      try {
        const igCommentIds = privateReplies.map(m =>
          (m.media_metadata as Record<string, string> | null)?.reply_to_comment_id ?? '',
        );
        const resp = await fetch(`${supabaseUrl}/functions/v1/instagram-comment-reply`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            people_id: pid !== '__unknown__' ? pid : undefined,
            message_ids: privateReplies.map(m => m.id),
            messages: privateReplies.map(m => m.content),
            ig_comment_ids: igCommentIds,
            is_private: true,
          }),
        });

        if (!resp.ok) {
          const errBody = await resp.text();
          log.error('ig_private_reply_http_error', {
            people_id: pid, status: resp.status, error: errBody,
            message_ids: privateReplies.map(m => m.id),
          });
          for (const msg of privateReplies) {
            results.push({
              message_id: msg.id, channel: 'instagram', success: false,
              error: `instagram-comment-reply[private] ${resp.status}: ${errBody}`,
            });
          }
        } else {
          const result = await resp.json() as { sent?: number; failed?: number; results?: Array<{ message_id: number; success: boolean; error?: string }> };
          const allOk = (result.failed ?? 0) === 0;
          log.info('ig_private_reply_delivered', {
            people_id: pid, sent: result.sent, failed: result.failed,
            message_ids: privateReplies.map(m => m.id),
          });
          for (const msg of privateReplies) {
            const r = result.results?.find(x => x.message_id === msg.id);
            results.push({ message_id: msg.id, channel: 'instagram', success: r?.success ?? allOk, error: r?.error });
          }
        }
      } catch (e) {
        const errMsg = String(e);
        log.error('ig_private_reply_exception', { people_id: pid, error: errMsg });
        for (const msg of privateReplies) {
          results.push({ message_id: msg.id, channel: 'instagram', success: false, error: errMsg });
        }
      }
    }

    // ── DMs ──────────────────────────────────────────────────────────────
    if (dmMessages.length === 0) continue;

    if (!person?.instagram_id) {
      log.warn('ig_no_igsid', { people_id: pid, message_ids: dmMessages.map(m => m.id) });
      for (const msg of dmMessages) {
        results.push({
          message_id: msg.id, channel: 'instagram', success: false,
          error: 'No instagram_id for person',
        });
      }
      continue;
    }

    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/instagram-outbound`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          people_id: pid,
          message_ids: dmMessages.map(m => m.id),
          messages: dmMessages.map(m => m.content),
        }),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        log.error('ig_outbound_http_error', {
          people_id: pid, status: resp.status, error: errBody,
          message_ids: dmMessages.map(m => m.id),
        });
        for (const msg of dmMessages) {
          results.push({
            message_id: msg.id, channel: 'instagram', success: false,
            error: `instagram-outbound ${resp.status}: ${errBody}`,
          });
        }
        continue;
      }

      const result = await resp.json() as { sent?: number; failed?: number; results?: Array<{ message_id: number; success: boolean; error?: string }> };
      const allOk = (result.failed ?? 0) === 0;

      log.info('ig_delivered', {
        people_id: pid,
        sent: result.sent,
        failed: result.failed,
        message_ids: dmMessages.map(m => m.id),
      });

      for (const msg of dmMessages) {
        // instagram-outbound updates status directly — mark success here for summary only
        const igResult = result.results?.find(r => r.message_id === msg.id);
        results.push({ message_id: msg.id, channel: 'instagram', success: allOk, error: igResult?.error });
      }
    } catch (e) {
      const errMsg = String(e);
      log.error('ig_fetch_exception', { people_id: pid, error: errMsg });
      for (const msg of dmMessages) {
        results.push({ message_id: msg.id, channel: 'instagram', success: false, error: errMsg });
      }
    }
  }

  return results;
}

// ── TikTok (via ManyChat) delivery ────────────────────────────────────────────
// Delegates to tiktok-manychat-outbound which calls the ManyChat sendContent API
// and updates message status directly.

async function deliverTikTokManyChat(
  msgs: PendingMessage[],
  _people: Map<string, Person>,
  supabaseUrl: string,
  serviceRoleKey: string,
  log: ReturnType<typeof createLogger>,
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];

  // Group by people_id so each person gets one outbound call with all their messages
  const byPerson = new Map<string, PendingMessage[]>();
  for (const msg of msgs) {
    const pid = msg.people_id ?? '__unknown__';
    if (!byPerson.has(pid)) byPerson.set(pid, []);
    byPerson.get(pid)!.push(msg);
  }

  for (const [pid, group] of byPerson.entries()) {
    if (pid === '__unknown__') {
      log.warn('manychat_no_people_id', { message_ids: group.map(m => m.id) });
      for (const msg of group) {
        results.push({
          message_id: msg.id, channel: 'tiktok-manychat', success: false,
          error: 'No people_id for message',
        });
      }
      continue;
    }

    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/tiktok-manychat-outbound`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          people_id: pid,
          message_ids: group.map(m => m.id),
          messages: group.map(m => m.content),
        }),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        log.error('manychat_outbound_http_error', {
          people_id: pid, status: resp.status, error: errBody,
          message_ids: group.map(m => m.id),
        });
        for (const msg of group) {
          results.push({
            message_id: msg.id, channel: 'tiktok-manychat', success: false,
            error: `tiktok-manychat-outbound ${resp.status}: ${errBody}`,
          });
        }
        continue;
      }

      const result = await resp.json() as { sent?: number; failed?: number; results?: Array<{ message_id: number; success: boolean; error?: string }> };
      const allOk = (result.failed ?? 0) === 0;

      log.info('manychat_delivered', {
        people_id: pid, sent: result.sent, failed: result.failed,
        message_ids: group.map(m => m.id),
      });

      for (const msg of group) {
        const r = result.results?.find(x => x.message_id === msg.id);
        results.push({ message_id: msg.id, channel: 'tiktok-manychat', success: r?.success ?? allOk, error: r?.error });
      }
    } catch (e) {
      const errMsg = String(e);
      log.error('manychat_fetch_exception', { people_id: pid, error: errMsg });
      for (const msg of group) {
        results.push({ message_id: msg.id, channel: 'tiktok-manychat', success: false, error: errMsg });
      }
    }
  }

  return results;
}

// ── Email delivery (provider direto: Resend/SMTP/SendGrid) ─────────────────────
// Usado quando o canal email tem provider de envio direto configurado; caso contrário
// o roteamento cai em deliverViaWebhook (webhook_fallback preservado). ADR-EMAIL-01.

async function deliverViaEmail(
  msgs: PendingMessage[],
  config: ChannelConfig,
  people: Map<string, Person>,
  log: ReturnType<typeof createLogger>,
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];

  for (const msg of msgs) {
    const person = msg.people_id ? people.get(msg.people_id) : null;
    const to = person?.email ?? '';

    if (!to) {
      log.warn('email_no_address', { message_id: msg.id, people_id: msg.people_id });
      results.push({ message_id: msg.id, channel: 'email', success: false, error: 'No email address for person' });
      continue;
    }

    const subject = ((msg.metadata as Record<string, unknown>)?.subject as string) ?? '';
    const vars: Record<string, string> = {
      'pessoa.nome': person?.name ?? '',
      'pessoa.email': person?.email ?? '',
      'pessoa.telefone': person?.telefone ?? '',
      'pessoa.whatsapp': person?.whatsapp ?? '',
    };

    const result = await sendEmailWithConfig(
      { is_active: config.is_active, credentials: config.credentials as EmailCredentials },
      { to, subject, html: msg.content, vars },
    );

    if (result.success) {
      log.info('email_delivered', { message_id: msg.id, to });
      results.push({ message_id: msg.id, channel: 'email', success: true });
    } else {
      log.error('email_send_error', { message_id: msg.id, error: result.error });
      results.push({ message_id: msg.id, channel: 'email', success: false, error: result.error });
    }
  }

  return results;
}

// ── Webhook delivery (email, sms, telefone) ───────────────────────────────────

async function deliverViaWebhook(
  msgs: PendingMessage[],
  config: ChannelConfig,
  people: Map<string, Person>,
  log: ReturnType<typeof createLogger>,
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];
  const hook = config.webhook_fallback;

  if (!hook?.enabled || !hook?.url) {
    log.warn('webhook_not_configured', { channel: config.channel, message_count: msgs.length });
    for (const msg of msgs) {
      results.push({
        message_id: msg.id, channel: config.channel, success: false,
        error: `Channel ${config.channel} webhook_fallback not enabled or URL missing`,
      });
    }
    return results;
  }

  for (const msg of msgs) {
    const person = msg.people_id ? people.get(msg.people_id) : null;
    const to = config.channel === 'email'
      ? (person?.email ?? '')
      : (person?.whatsapp ?? person?.telefone ?? '');

    const vars: Record<string, string> = {
      to,
      content: msg.content,
      channel: msg.channel ?? config.channel,
      people_name: person?.name ?? '',
      source_type: msg.source_type ?? '',
      module_ref_id: msg.module_ref_id ?? '',
      subject: ((msg.metadata as Record<string, unknown>)?.subject as string) ?? '',
    };

    const body = hook.payload_template
      ? renderTemplate(hook.payload_template, vars)
      : JSON.stringify({
          message_id: msg.id,
          people_id: msg.people_id,
          lead_id: msg.lead_id,
          ...vars,
        });

    try {
      const resp = await fetch(hook.url, {
        method: hook.method ?? 'POST',
        headers: { 'Content-Type': 'application/json', ...(hook.headers ?? {}) },
        body,
      });

      if (!resp.ok) {
        const err = await resp.text();
        log.error('webhook_http_error', {
          channel: config.channel, message_id: msg.id, status: resp.status, error: err,
        });
        results.push({
          message_id: msg.id, channel: config.channel, success: false,
          error: `webhook ${resp.status}: ${err}`,
        });
      } else {
        log.info('webhook_delivered', { channel: config.channel, message_id: msg.id, to });
        results.push({ message_id: msg.id, channel: config.channel, success: true });
      }
    } catch (e) {
      const errMsg = String(e);
      log.error('webhook_fetch_exception', { channel: config.channel, message_id: msg.id, error: errMsg });
      results.push({ message_id: msg.id, channel: config.channel, success: false, error: errMsg });
    }
  }

  return results;
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const log = createLogger('omni-delivery-engine');
  const t0 = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const trigger = (body as Record<string, unknown>).trigger ?? 'http';
    const filterPeopleId = (body as Record<string, unknown>).people_id as string | undefined;
    const filterChannel = (body as Record<string, unknown>).channel as string | undefined;

    log.info('start', { trigger, filter_people_id: filterPeopleId, filter_channel: filterChannel });

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── 1. Atomically claim pending outbound messages ──────────────────────────
    // Uses claim_pending_messages RPC with FOR UPDATE SKIP LOCKED to prevent
    // duplicate delivery when direct trigger and pg_cron fire concurrently.
    const { data: claimed, error: claimErr } = await supabase.rpc('claim_pending_messages', {
      p_batch_size: BATCH_SIZE,
      p_max_age_hours: MAX_AGE_HOURS,
      p_people_id: filterPeopleId ?? null,
      p_channel: filterChannel ?? null,
    });

    if (claimErr) {
      log.error('claim_pending_failed', { error: claimErr.message });
      return new Response(JSON.stringify({ error: 'Failed to claim pending messages' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messages = (claimed ?? []) as PendingMessage[];

    if (messages.length === 0) {
      log.info('no_pending', { elapsed_ms: log.elapsed(t0) });
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    log.info('batch_claimed', { count: messages.length, ids: messages.map(m => m.id) });

    // ── 2. Load channel configs (all active channels, one query) ───────────────
    const { data: cfgRows } = await supabase
      .from('omni_channel_configs')
      .select('channel, is_active, credentials, settings, webhook_fallback');

    const channelConfigs = new Map<string, ChannelConfig>(
      (cfgRows ?? []).map((r: ChannelConfig) => [r.channel, r]),
    );

    // ── 3. Load person contact info (phone + email for address resolution) ─────
    const peopleIds = [...new Set(messages.map(m => m.people_id).filter(Boolean))] as string[];
    const { data: peopleRows } = await supabase
      .from('clients_people')
      .select('id, name, whatsapp, telefone, email, instagram_id')
      .in('id', peopleIds);

    const people = new Map<string, Person>(
      (peopleRows ?? []).map((p: Person) => [p.id, p]),
    );

    // ── 4. Group messages by effective channel ─────────────────────────────────
    const byChannel = new Map<string, PendingMessage[]>();
    for (const msg of messages) {
      const ch = msg.channel ?? 'whatsapp';
      if (!byChannel.has(ch)) byChannel.set(ch, []);
      byChannel.get(ch)!.push(msg);
    }

    // ── 5. Deliver per channel ─────────────────────────────────────────────────
    const allResults: DeliveryResult[] = [];

    for (const [channel, msgs] of byChannel.entries()) {
      if (channel === 'whatsapp') {
        const r = await deliverWhatsApp(msgs, people, supabaseUrl, serviceRoleKey, log);
        allResults.push(...r);
      } else if (channel === 'instagram') {
        const r = await deliverInstagram(msgs, people, supabaseUrl, serviceRoleKey, log);
        allResults.push(...r);
      } else if (channel === 'tiktok-manychat' || channel === 'instagram-manychat') {
        const r = await deliverTikTokManyChat(msgs, people, supabaseUrl, serviceRoleKey, log);
        allResults.push(...r);
      } else {
        const cfg = channelConfigs.get(channel);
        if (!cfg) {
          log.warn('channel_not_found', { channel, message_ids: msgs.map(m => m.id) });
          for (const msg of msgs) {
            allResults.push({
              message_id: msg.id, channel, success: false,
              error: `Channel '${channel}' not in omni_channel_configs`,
            });
          }
          continue;
        }
        if (!cfg.is_active) {
          log.warn('channel_inactive', { channel, message_ids: msgs.map(m => m.id) });
          // Leave as pending — channel will be activated later
          continue;
        }
        // Email com provider direto (Resend/SMTP/SendGrid) → sender compartilhado.
        // Sem provider direto → webhook_fallback (comportamento legado preservado).
        if (channel === 'email' && hasDirectEmailProvider(cfg.credentials as EmailCredentials)) {
          const r = await deliverViaEmail(msgs, cfg, people, log);
          allResults.push(...r);
        } else {
          const r = await deliverViaWebhook(msgs, cfg, people, log);
          allResults.push(...r);
        }
      }
    }

    // ── 6. Update statuses ─────────────────────────────────────────────────────
    // Native channels (WA/IG): outbound functions update status on success.
    // On failure, we must revert 'sending' → 'error' here.
    // Non-native: we handle all status updates.

    const nativeChannels = ['whatsapp', 'instagram', 'tiktok-manychat', 'instagram-manychat'];

    // Non-native successes → 'sent'
    const nonNativeSuccess = allResults
      .filter(r => r.success && !nativeChannels.includes(r.channel))
      .map(r => r.message_id);

    // Non-native failures → 'error'
    const nonNativeFailures = allResults
      .filter(r => !r.success && !nativeChannels.includes(r.channel))
      .map(r => r.message_id);

    // Native failures → 'error' (outbound function didn't get to update)
    const nativeFailures = allResults
      .filter(r => !r.success && nativeChannels.includes(r.channel))
      .map(r => r.message_id);

    if (nonNativeSuccess.length > 0) {
      const { error } = await supabase
        .from('messages')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .in('id', nonNativeSuccess);
      if (error) log.error('update_sent_failed', { error: error.message, ids: nonNativeSuccess });
    }

    const allFailures = allResults.filter(r => !r.success);
    const allFailureIds = allFailures.map(r => r.message_id);
    if (allFailureIds.length > 0) {
      const { error } = await supabase
        .from('messages')
        .update({ status: 'error' } as Record<string, unknown>)
        .in('id', allFailureIds)
        .eq('status', 'sending'); // guard: only revert if still 'sending' (outbound may have updated)
      if (error) log.error('update_error_failed', { error: error.message, ids: allFailureIds });

      // ── Dead-letter queue: INSERT failed messages for retry ────────────
      const BACKOFF_SECONDS = [60, 300, 1800, 7200, 43200]; // 1min, 5min, 30min, 2h, 12h
      const deadLetterEntries = allFailures.map(r => ({
        message_id: r.message_id,
        channel: r.channel,
        error_code: 'delivery_failed',
        error_message: r.error ?? 'Unknown error',
        attempts: 1,
        max_attempts: 5,
        next_retry_at: new Date(Date.now() + BACKOFF_SECONDS[0] * 1000).toISOString(),
        status: 'pending',
      }));

      const { data: dlData, error: dlErr } = await supabase
        .from('omni_delivery_dead_letter')
        .upsert(deadLetterEntries, { onConflict: 'message_id', ignoreDuplicates: true })
        .select('id, message_id');

      if (dlErr) {
        log.error('dead_letter_insert_failed', { error: dlErr.message, ids: allFailureIds });
      } else {
        log.info('dead_letter_queued', { count: deadLetterEntries.length, ids: allFailureIds });

        // AC-2: Set dead_letter_id + error_reason on original messages' metadata
        const failureErrorMap = new Map(allFailures.map(r => [r.message_id, r.error ?? 'delivery_failed']));
        if (dlData && dlData.length > 0) {
          const dlMap = new Map(dlData.map(dl => [dl.message_id, dl.id]));
          for (const [msgId, dlId] of dlMap) {
            const { data: msg } = await supabase
              .from('messages')
              .select('metadata')
              .eq('id', msgId)
              .single();
            const merged = {
              ...(msg?.metadata ?? {}),
              dead_letter_id: dlId,
              error_reason: failureErrorMap.get(msgId) ?? 'delivery_failed',
            };
            await supabase
              .from('messages')
              .update({ metadata: merged } as Record<string, unknown>)
              .eq('id', msgId);
          }
        }
      }
    }

    const summary = {
      ok: true,
      processed: messages.length,
      sent: allResults.filter(r => r.success).length,
      failed: allResults.filter(r => !r.success).length,
      errors: allResults.filter(r => !r.success && r.error).map(r => r.error),
      elapsed_ms: log.elapsed(t0),
    };

    log.info('done', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('unhandled', { error: errMsg, elapsed_ms: log.elapsed(t0) });
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
