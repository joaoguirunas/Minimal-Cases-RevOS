/**
 * TIKTOK INBOUND — Webhook receiver for TikTok Business Messaging (T-09)
 *
 * ⚠️  DEPLOY: always use --no-verify-jwt
 *     supabase functions deploy tiktok-inbound --no-verify-jwt
 *
 * GET  /tiktok-inbound  → TikTok webhook verification
 * POST /tiktok-inbound  → Process inbound DM events
 *
 * IMPORTANT: TikTok challenge response must be JSON, NOT plain text:
 *   Response: { "challenge": "<value>" }
 *   (Unlike Meta which returns the challenge as plain text)
 *
 * Flow:
 *   1. GET: return JSON {"challenge": "<value>"} with 200
 *   2. POST: validate HMAC-SHA256 via X-TikTok-Signature header
 *   3. Parse DM event — normalize across TikTok API format variations
 *   4. Upsert clients_people by tiktok_open_id
 *   5. INSERT messages (channel='tiktok', from_contact='cliente')
 *   6. Push to message_buffer → triggers ai-agent-execute via pg_cron
 *   7. Auto-create negócio if configured in settings_omni_new_contact
 *   8. Always return 200 (even on error) — prevents TikTok retry flood
 *
 * Env vars required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TIKTOK_APP_SECRET  — from TikTok Developer App (for HMAC validation)
 *                        Falls back to omni_channel_configs.credentials.app_secret
 *
 * Webhook signature:
 *   Header: X-TikTok-Signature: <hex_hmac_sha256(app_secret, raw_body)>
 *   (no "sha256=" prefix — raw hex only)
 *
 * DM Event format (TikTok Messaging API v2):
 *   {
 *     "event_type": "dm.message",
 *     "sender": { "open_id": "...", "display_name": "..." },
 *     "conversation_id": "...",
 *     "message": {
 *       "message_id": "...",
 *       "content": { "message_type": "text", "text": "Olá!" },
 *       "create_time": 1234567890
 *     }
 *   }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, tiktok-signature',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface TikTokDMContent {
  message_type?: string;   // "text" | "image" | "video" | "audio" | "sticker"
  text?: string;
  url?: string;
  image_url?: string;
  // legacy / alternative field names
  type?: string;
  message?: string;
}

interface TikTokDMMessage {
  message_id?: string;
  content?: TikTokDMContent;
  create_time?: number;
}

interface TikTokDMEvent {
  event_type?: string;         // "dm.message" | "message"
  type?: string;               // alternative
  sender?: {
    open_id?: string;
    display_name?: string;
  };
  from?: {
    open_id?: string;
    display_name?: string;
  };
  // Flat sender fields (some API versions)
  sender_open_id?: string;
  sender_display_name?: string;
  conversation_id?: string;
  message?: TikTokDMMessage;
}

// ── HMAC Signature Verification ───────────────────────────────────────────────

/**
 * TikTok Messaging API webhook signature verification.
 *
 * Header: TikTok-Signature: t={unix_timestamp},s={hmac_hex}
 *
 * Verification steps:
 *   1. Parse t and s from header
 *   2. Anti-replay: reject if |now - t| > 300s (5 min)
 *   3. Build signed payload: t + '.' + rawBody
 *   4. HMAC-SHA256(client_secret, signed_payload) must equal s
 */
async function verifyTikTokSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<{ valid: boolean; reason?: string }> {
  // Parse "t={timestamp},s={hex}" format
  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(',')) {
    const idx = part.indexOf('=');
    if (idx > 0) parts[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }

  const timestamp = parts['t'];
  const hexSig    = parts['s'];

  if (!timestamp || !hexSig) {
    return { valid: false, reason: 'malformed_header' };
  }

  // Anti-replay: reject requests older than 5 minutes
  const ts  = parseInt(timestamp, 10);
  const age = Math.abs(Date.now() / 1000 - ts);
  if (age > 300) {
    return { valid: false, reason: `timestamp_too_old: ${Math.round(age)}s` };
  }

  // Signed payload = timestamp + '.' + rawBody
  const signedPayload = `${timestamp}.${rawBody}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const actual = Array.from(new Uint8Array(mac))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return actual === hexSig
    ? { valid: true }
    : { valid: false, reason: 'hmac_mismatch' };
}

// ── Event normalization ───────────────────────────────────────────────────────

interface NormalizedDMEvent {
  eventType: string;
  senderId: string;
  senderName: string;
  messageId: string;
  conversationId: string;
  content: string;
  contentType: string;  // "texto" | "imagem" | "video" | "audio"
  createTime: Date;
}

function normalizeDMEvent(evt: TikTokDMEvent): NormalizedDMEvent | null {
  // Detect event type
  const rawType = (evt.event_type ?? evt.type ?? '').toLowerCase();
  const isMessage = rawType === '' || rawType === 'dm.message' || rawType === 'message' || rawType.includes('message');
  if (!isMessage) return null;

  // Extract sender
  const sender = evt.sender ?? evt.from;
  const senderId = sender?.open_id ?? evt.sender_open_id ?? '';
  if (!senderId) return null;

  const senderName = sender?.display_name ?? evt.sender_display_name ?? `TikTok ${senderId.slice(-6)}`;

  // Extract message
  const msg = evt.message;
  const messageId = msg?.message_id ?? '';
  const conversationId = evt.conversation_id ?? '';
  const createTime = msg?.create_time
    ? new Date(msg.create_time * 1000)
    : new Date();

  // Extract content
  const rawContent = msg?.content ?? {};
  const rawType2 = (rawContent.message_type ?? rawContent.type ?? 'text').toLowerCase();

  let content: string;
  let contentType: string;

  switch (rawType2) {
    case 'text':
      content = rawContent.text ?? rawContent.message ?? '';
      contentType = 'texto';
      break;
    case 'image':
      content = rawContent.url ?? rawContent.image_url ?? '[Imagem recebida]';
      contentType = 'imagem';
      break;
    case 'video':
      content = rawContent.url ? `[Vídeo: ${rawContent.url}]` : '[Vídeo recebido]';
      contentType = 'video';
      break;
    case 'audio':
      content = '[Áudio recebido]';
      contentType = 'audio';
      break;
    case 'sticker':
      content = '[Sticker recebido]';
      contentType = 'imagem';
      break;
    default:
      content = rawContent.text ?? `[${rawType2} recebido]`;
      contentType = 'texto';
  }

  if (!content.trim()) content = '[Mensagem recebida]';

  return { eventType: rawType, senderId, senderName, messageId, conversationId, content, contentType, createTime };
}

// ── Database: Upsert Person ───────────────────────────────────────────────────

async function upsertTikTokPerson(
  supabase: ReturnType<typeof createClient>,
  openId: string,
  displayName: string,
): Promise<{ id: string; ai_enabled: boolean }> {
  // Lookup by tiktok_open_id — mirrors instagram_id pattern in meta-inbound
  const { data: existing } = await supabase
    .from('clients_people')
    .select('id, ai_enabled, status, merged_into_id')
    .eq('tiktok_open_id', openId)
    .neq('status', 'merged')
    .maybeSingle() as unknown as {
      data: { id: string; ai_enabled: boolean; status: string; merged_into_id: string | null } | null;
    };

  if (existing) return existing;

  // Create new person
  const { data: created, error } = await supabase
    .from('clients_people')
    .insert({
      name:          displayName,
      tiktok_open_id: openId,
      ai_enabled:    true,
      status:        'active',
      service_status: 'open',
    })
    .select('id, ai_enabled')
    .single() as unknown as { data: { id: string; ai_enabled: boolean } | null; error: unknown };

  if (error) throw new Error(`upsertTikTokPerson: ${(error as { message: string }).message}`);
  if (!created) throw new Error('upsertTikTokPerson: no data returned');
  return created;
}

// ── Database: Message Buffer ──────────────────────────────────────────────────

async function pushToBuffer(
  supabase: ReturnType<typeof createClient>,
  peopleId: string,
  messageEntry: object,
  bufferMs: number,
): Promise<void> {
  const { data: existing } = await supabase
    .from('message_buffer')
    .select('id, messages')
    .eq('people_id', peopleId)
    .eq('processed', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const expiresAt = new Date(Date.now() + bufferMs).toISOString();

  if (existing) {
    await supabase
      .from('message_buffer')
      .update({ messages: [...(existing.messages as object[]), messageEntry], expires_at: expiresAt })
      .eq('id', existing.id);
  } else {
    await supabase.from('message_buffer').insert({
      people_id: peopleId,
      messages:  [messageEntry],
      expires_at: expiresAt,
    });
  }

  await supabase
    .from('clients_people')
    .update({ ai_last_message_at: new Date().toISOString() })
    .eq('id', peopleId);
}

// ── Auto-create negócio ───────────────────────────────────────────────────────

async function maybeCreateNegocio(
  supabase: ReturnType<typeof createClient>,
  peopleId: string,
  name: string,
): Promise<void> {
  const { data: config } = await supabase
    .from('settings_omni_new_contact')
    .select('auto_create_negocio, pipeline_id, stage_id, title_template')
    .eq('channel', 'tiktok')
    .maybeSingle();

  if (!config?.auto_create_negocio || !config.pipeline_id || !config.stage_id) return;

  const { data: existing } = await supabase
    .from('leads')
    .select('id')
    .eq('people_id', peopleId)
    .neq('status', 'lost')
    .neq('status', 'archived')
    .limit(1)
    .maybeSingle();

  if (existing) return;

  const title = (config.title_template || 'Nova conversa TikTok - {{nome}}')
    .replace('{{nome}}', name || peopleId);

  const { error } = await supabase.from('leads').insert({
    title,
    people_id:         peopleId,
    leads_pipelines_id: config.pipeline_id,
    leads_stages_id:   config.stage_id,
    status:            'in_progress',
  });

  if (error) console.error('maybeCreateNegocio (tiktok):', error.message);
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const log = createLogger('tiktok-inbound');
  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const envAppSecret   = Deno.env.get('TIKTOK_APP_SECRET') ?? '';

  // ── GET: TikTok webhook verification ────────────────────────────────────────
  // CRITICAL: TikTok requires JSON response: {"challenge":"<value>"}
  // NOT plain text (this is different from Meta hub.challenge which uses plain text)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const challenge = url.searchParams.get('challenge');
    if (challenge) {
      log.info('tiktok_challenge', { challenge });
      return new Response(JSON.stringify({ challenge }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Health check
    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Read body once — needed for signature + parsing
  const bodyText = await req.text();
  const sigHeader = req.headers.get('tiktok-signature');

  // ── Outer safety net: always 200 so TikTok doesn't retry and flood logs ─────
  try {

  // ── Resolve app_secret: env var OR stored in omni_channel_configs ────────────
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let appSecret = envAppSecret;
  if (!appSecret) {
    const { data: cfg } = await supabase
      .from('omni_channel_configs')
      .select('credentials')
      .eq('channel', 'tiktok')
      .eq('is_active', true)
      .maybeSingle() as unknown as { data: { credentials: Record<string, string> } | null };
    appSecret = cfg?.credentials?.app_secret ?? '';
  }

  // ── Validate HMAC-SHA256 signature ───────────────────────────────────────────
  // Header: TikTok-Signature: t={unix_timestamp},s={hmac_hex}
  // Payload: timestamp + '.' + rawBody  (NOT just rawBody)
  // Anti-replay window: 5 minutes
  // AC-8: invalid signatures return 200 (to prevent retry) but log + abort processing
  if (appSecret && sigHeader) {
    const { valid, reason } = await verifyTikTokSignature(bodyText, sigHeader, appSecret);
    if (!valid) {
      log.warn('tiktok_sig_invalid', { reason, sig_prefix: sigHeader.slice(0, 32) });
      return new Response('OK', { status: 200 });
    }
  } else if (appSecret && !sigHeader) {
    log.warn('tiktok_sig_missing', { note: 'app_secret configured but TikTok-Signature header absent' });
  }

  // ── Parse payload ────────────────────────────────────────────────────────────
  let payload: TikTokDMEvent | { events?: TikTokDMEvent[] };
  try {
    payload = JSON.parse(bodyText);
  } catch {
    log.warn('tiktok_parse_error', { body_preview: bodyText.slice(0, 200) });
    return new Response('OK', { status: 200 });
  }

  // ── Collect events — handle envelope or direct event ─────────────────────────
  const rawEvents: TikTokDMEvent[] = 'events' in payload && Array.isArray(payload.events)
    ? payload.events
    : [payload as TikTokDMEvent];

  if (rawEvents.length === 0) {
    return new Response('OK', { status: 200 });
  }

  // Fetch AI agent buffer_ms setting
  const { data: agentConfig } = await supabase
    .from('ai_agents')
    .select('buffer_ms')
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  const bufferMs = agentConfig?.buffer_ms ?? 8000;

  // ── Process each event ───────────────────────────────────────────────────────
  for (const rawEvt of rawEvents) {
    const evt = normalizeDMEvent(rawEvt);
    if (!evt) {
      log.info('tiktok_event_skipped', { type: rawEvt.event_type ?? rawEvt.type ?? 'unknown' });
      continue;
    }

    log.info('tiktok_dm_received', {
      message_id:   evt.messageId,
      sender_id:    evt.senderId,
      content_type: evt.contentType,
      preview:      evt.content.slice(0, 60),
    });

    // ── Upsert person by tiktok_open_id ────────────────────────────────────────
    let person: { id: string; ai_enabled: boolean };
    try {
      person = await upsertTikTokPerson(supabase, evt.senderId, evt.senderName);
    } catch (err) {
      log.error('tiktok_person_upsert_failed', {
        error: (err as Error).message,
        sender_id: evt.senderId,
      });
      continue;
    }

    // ── Auto-create negócio (non-fatal) ────────────────────────────────────────
    try {
      await maybeCreateNegocio(supabase, person.id, evt.senderName);
    } catch (err) {
      log.warn('tiktok_negocio_failed', { error: (err as Error).message });
    }

    // ── INSERT message ─────────────────────────────────────────────────────────
    const { error: msgErr } = await supabase.from('messages').insert({
      people_id:    person.id,
      lead_id:      null,
      channel:      'tiktok',
      content:      evt.content,
      from_contact: 'cliente',
      source_type:  'inbound',
      message_type: evt.contentType,
      status:       'delivered',
      sent_at:      evt.createTime.toISOString(),
      metadata: {
        tiktok_message_id:    evt.messageId,
        tiktok_sender_id:     evt.senderId,
        tiktok_conversation:  evt.conversationId,
        tiktok_content_type:  evt.contentType,
      },
    });

    if (msgErr) {
      log.error('tiktok_msg_insert_failed', { error: msgErr.message, person_id: person.id });
    } else {
      log.info('tiktok_msg_saved', {
        person_id: person.id,
        sender_id: evt.senderId,
        type: evt.contentType,
      });
    }

    // ── Push to message buffer → triggers AI agent ────────────────────────────
    if (person.ai_enabled) {
      try {
        await pushToBuffer(supabase, person.id, {
          content:           evt.content,
          message_type:      evt.contentType,
          tiktok_message_id: evt.messageId,
        }, bufferMs);
      } catch (bufErr) {
        log.warn('tiktok_buffer_push_failed', { error: (bufErr as Error).message });
      }
    }
  }

  return new Response('OK', { status: 200 });

  } catch (topLevelErr) {
    // Always 200 — prevents TikTok retry flood
    console.error('tiktok-inbound: unhandled error:', (topLevelErr as Error).message, topLevelErr);
    return new Response('OK', { status: 200 });
  }
});
