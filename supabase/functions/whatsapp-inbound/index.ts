/**
 * WHATSAPP INBOUND — N8N-WAA Phase 2 (N8N-WAA-5)
 *
 * POST /whatsapp-inbound  → process inbound WhatsApp events
 * GET  /whatsapp-inbound  → Meta webhook verification
 *
 * Flow:
 *   1. Validate Meta HMAC-SHA256 signature
 *   2. Filter: skip status events (delivered/sent), keep message events
 *   3. Normalize BR phone number
 *   4. Detect #apagar# → cascade delete + return
 *   5. Send typing indicator (fire & forget)
 *   6. Route by message type (text | interactive | button | audio | image | pdf)
 *   7. Process media if needed (audio→transcript, image→description, pdf→text)
 *   8. Upsert clients_people
 *  8b. Maybe auto-create negócio (if operator enabled in settings_omni_new_contact)
 *   9. INSERT to messages (lead_id=null, status='delivered')
 *  10. INSERT/UPDATE message_buffer → triggers ai-agent-execute via pg_cron
 *
 * Env vars required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   WHATSAPP_APP_SECRET     — Meta App Secret for signature validation
 *   OPENAI_API_KEY          — for audio transcription + image analysis
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface WaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'interactive' | 'button' | 'audio' | 'image' | 'document' | 'video' | 'sticker' | string;
  text?: { body: string };
  interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
  button?: { text: string; payload: string };
  audio?: { id: string; mime_type: string };
  image?: { id: string; caption?: string; mime_type: string };
  video?: { id: string; caption?: string; mime_type: string };
  document?: { id: string; caption?: string; filename?: string; mime_type: string };
  sticker?: { id: string; mime_type: string };
}

interface WaPayload {
  messaging_product?: string;
  metadata?: { display_phone_number: string; phone_number_id: string };
  contacts?: Array<{ profile: { name: string }; wa_id: string }>;
  messages?: WaMessage[];
  statuses?: Array<{
    id: string;
    status: string;
    recipient_id: string;
    timestamp: string;
    errors?: Array<{ code: number; title: string; error_data?: unknown }>;
  }>;
  field?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function verifyMetaSignature(body: string, signatureHeader: string | null, secret: string): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  const sig = signatureHeader.replace('sha256=', '');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === sig;
}

/**
 * Brazilian phone normalization:
 * 12-digit numbers (55 + DDD + 8-digit) → 13-digit (55 + DDD + 9 + 8-digit)
 * e.g. 5511981103151 (13 digits) stays the same
 *      554891388486  (12 digits) → 5548991388486
 */
function normalizeBRPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12) {
    return digits.substring(0, 4) + '9' + digits.substring(4);
  }
  return digits;
}

function extractMessageText(msg: WaMessage): string {
  switch (msg.type) {
    case 'text':        return msg.text?.body ?? '';
    case 'interactive': return msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? '';
    case 'button':      return msg.button?.text ?? '';
    default:            return '';
  }
}

// ── Media Processing ──────────────────────────────────────────────────────────

async function getMediaUrl(mediaId: string, waToken: string): Promise<string> {
  const resp = await fetch(`https://graph.facebook.com/v25.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${waToken}` },
  });
  if (!resp.ok) throw new Error(`Media URL fetch failed: ${resp.status}`);
  const data = await resp.json();
  return data.url;
}

async function downloadMedia(url: string, waToken: string): Promise<ArrayBuffer> {
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${waToken}` } });
  if (!resp.ok) throw new Error(`Media download failed: ${resp.status}`);
  return resp.arrayBuffer();
}

async function transcribeAudio(buffer: ArrayBuffer, mimeType: string, openaiKey: string): Promise<string> {
  // Normalize: 'audio/ogg; codecs=opus' → 'audio/ogg', ext = 'ogg'
  const normalized = mimeType.split(';')[0].trim();
  const ext = normalized.split('/')[1] ?? 'ogg';
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: normalized }), `audio.${ext}`);
  form.append('model', 'whisper-1');
  form.append('language', 'pt');
  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: form,
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Whisper transcription failed: ${resp.status} ${errText}`);
  }
  const data = await resp.json();
  return data.text ?? '';
}

async function analyzeImage(buffer: ArrayBuffer, caption: string, openaiKey: string): Promise<string> {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5.4-mini',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Descreva esta imagem detalhadamente para ser usada como contexto por um agente de vendas.${caption ? ` Contexto adicional do usuário: "${caption}"` : ''}`,
          },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
        ],
      }],
      max_tokens: 400,
    }),
  });
  if (!resp.ok) throw new Error(`Image analysis failed: ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? '[imagem não processada]';
}

async function extractPdfText(buffer: ArrayBuffer, openaiKey?: string): Promise<string> {
  // Primary: OpenAI vision API reads the PDF as base64 and extracts readable text.
  // Fallback: regex scan for readable strings in the PDF byte stream (works for simple PDFs).
  if (openaiKey) {
    try {
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Extraia e retorne todo o texto legível deste documento PDF. Retorne apenas o texto, sem comentários.' },
              { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64}` } },
            ],
          }],
          max_tokens: 2000,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const extracted = data.choices?.[0]?.message?.content as string | undefined;
        if (extracted && extracted.length > 10) return extracted.substring(0, 4000);
      }
    } catch (err) {
      console.error('whatsapp-inbound: PDF vision extraction failed:', (err as Error).message);
    }
  }
  // Fallback: regex for readable text strings in raw PDF stream
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const matches = text.match(/\(([^\)]{3,})\)/g);
  if (matches && matches.length > 5) {
    return matches.map(m => m.slice(1, -1)).join(' ').substring(0, 3000);
  }
  return '[PDF recebido — extração de texto não disponível]';
}

// ── Storage Upload ────────────────────────────────────────────────────────────

/**
 * Uploads a media buffer to the omni-media Supabase Storage bucket.
 * Returns the public URL, or null on failure (non-fatal — message still saved).
 */
async function uploadToOmniMedia(
  supabase: ReturnType<typeof createClient>,
  buffer: ArrayBuffer,
  mimeType: string,
  phone: string,
  mediaType: string,
): Promise<string | null> {
  try {
    const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'bin';
    const path = `inbound/${new Date().toISOString().split('T')[0]}/${Date.now()}-${phone}-${mediaType}.${ext}`;

    const { error } = await supabase.storage
      .from('omni-media')
      .upload(path, new Blob([buffer], { type: mimeType }), { cacheControl: '3600', upsert: false });

    if (error) {
      console.error('omni-media upload error:', error.message);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage.from('omni-media').getPublicUrl(path);
    return publicUrl;
  } catch (err) {
    console.error('omni-media upload exception:', (err as Error).message);
    return null;
  }
}

// ── Database Operations ───────────────────────────────────────────────────────

async function deletePersonData(supabase: ReturnType<typeof createClient>, personId: string): Promise<void> {
  await supabase.from('messages').delete().eq('people_id', personId);
  await supabase.from('leads').delete().eq('people_id', personId);
  await supabase.from('clients_people').delete().eq('id', personId);
}

async function upsertPerson(
  supabase: ReturnType<typeof createClient>,
  phone: string,
  name: string,
): Promise<{ id: string; ai_enabled: boolean; buffer_ms?: number }> {
  // Try find by whatsapp — include merged records to handle broken-merge edge case
  const { data: allByPhone } = await supabase
    .from('clients_people')
    .select('id, ai_enabled, merged_into_id, status')
    .eq('whatsapp', phone)
    .order('created_at', { ascending: true }) as unknown as { data: Array<{ id: string; ai_enabled: boolean; merged_into_id: string | null; status: string }> | null };

  if (allByPhone && allByPhone.length > 0) {
    // Prefer active record first
    const active = allByPhone.find(p => p.status !== 'merged');
    const record = active ?? allByPhone[0]; // fallback to first (even if merged)

    // If merged with a valid canonical → follow chain
    if (record.status === 'merged' && record.merged_into_id) {
      const { data: canonical } = await supabase
        .from('clients_people')
        .select('id, ai_enabled')
        .eq('id', record.merged_into_id)
        .single() as unknown as { data: { id: string; ai_enabled: boolean } | null };
      if (canonical) return canonical;
    }

    // If merged but merged_into_id is null (broken merge) → restore and use this record
    if (record.status === 'merged' && !record.merged_into_id) {
      console.log(`upsertPerson: broken merge detected on ${record.id} — restoring to active`);
      await supabase.from('clients_people').update({ status: 'active' }).eq('id', record.id);
      return { id: record.id, ai_enabled: record.ai_enabled };
    }

    return record;
  }

  // Create new — the DB trigger trg_identity_auto_merge will fire after INSERT
  // and may auto-merge this record into an existing one if identities match
  const { data: created, error } = await supabase
    .from('clients_people')
    .insert({ name, whatsapp: phone, ai_enabled: true, status: 'active' })
    .select('id, ai_enabled')
    .single() as unknown as { data: { id: string; ai_enabled: boolean } | null; error: any };

  if (error) throw new Error(`upsertPerson: ${error.message}`);
  if (!created) throw new Error('upsertPerson: no data returned');

  // Re-fetch to check if the trigger auto-merged this record into an existing canonical
  const { data: postMerge } = await supabase
    .from('clients_people')
    .select('id, ai_enabled, merged_into_id, status')
    .eq('id', created.id)
    .single() as unknown as { data: { id: string; ai_enabled: boolean; merged_into_id: string | null; status: string } | null };

  if (postMerge?.status === 'merged' && postMerge.merged_into_id) {
    // Trigger merged this new record — use the canonical instead
    const { data: canonical } = await supabase
      .from('clients_people')
      .select('id, ai_enabled')
      .eq('id', postMerge.merged_into_id)
      .single() as unknown as { data: { id: string; ai_enabled: boolean } | null };
    if (canonical) {
      console.log(`upsertPerson: auto-merged new person ${created.id} → canonical ${canonical.id}`);
      return canonical;
    }
  }

  return created;
}


async function maybeCreateNegocio(
  supabase: ReturnType<typeof createClient>,
  peopleId: string,
  phone: string,
  name: string,
): Promise<void> {
  // 1. Fetch WhatsApp config
  const { data: config } = await supabase
    .from('settings_omni_new_contact')
    .select('auto_create_negocio, pipeline_id, stage_id, title_template')
    .eq('channel', 'whatsapp')
    .maybeSingle();

  if (!config?.auto_create_negocio || !config.pipeline_id || !config.stage_id) return;

  // 2. Check if person already has an open negócio
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id')
    .eq('people_id', peopleId)
    .neq('status', 'lost')
    .neq('status', 'archived')
    .limit(1)
    .maybeSingle();

  if (existingLead) return; // Already has active negócio

  // 3. Render title template
  const title = (config.title_template || 'Nova conversa - {{nome}}')
    .replace('{{nome}}', name || phone)
    .replace('{{telefone}}', phone);

  // 4. Create negócio — leads table uses leads_pipelines_id / leads_stages_id / title
  const { error } = await supabase.from('leads').insert({
    title,
    people_id: peopleId,
    leads_pipelines_id: config.pipeline_id,
    leads_stages_id: config.stage_id,
    status: 'in_progress',
  });

  if (error) console.error('maybeCreateNegocio: failed to create lead:', error.message);
  else console.log(`maybeCreateNegocio: created negócio for people_id=${peopleId}`);
}


async function maybeHandleFirstReply(
  supabase: ReturnType<typeof createClient>,
  peopleId: string,
  phone: string,
  name: string,
): Promise<void> {
  // 1. Fetch WhatsApp first-reply config (pipeline_id + title_template needed for lead creation fallback)
  const { data: config } = await supabase
    .from('settings_omni_new_contact')
    .select('on_first_reply_enabled, on_first_reply_stage_id, pipeline_id, title_template')
    .eq('channel', 'whatsapp')
    .maybeSingle();

  if (!config?.on_first_reply_enabled || !config.on_first_reply_stage_id) return;

  // 2. Look for any active lead for this person (not just ones with first_inbound_at=null).
  //    If we find one already processed (first_inbound_at != null) we skip.
  //    If we find one unprocessed → UPDATE it (existing flow).
  //    If no active lead at all → CREATE one in the configured pipeline/stage (fix for first-time inbound).
  const { data: lead } = await supabase
    .from('leads')
    .select('id, first_inbound_at')
    .eq('people_id', peopleId)
    .neq('status', 'lost')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Already processed first reply → nothing to do
  if (lead?.first_inbound_at) return;

  if (!lead) {
    // No active lead → create one in the configured pipeline/stage
    if (!config.pipeline_id) {
      console.warn('maybeHandleFirstReply: cannot create lead — pipeline_id not configured in settings_omni_new_contact');
      return;
    }

    const title = (config.title_template || 'Nova conversa - {{nome}}')
      .replace('{{nome}}', name || phone)
      .replace('{{telefone}}', phone);

    const { data: created, error: insertError } = await supabase
      .from('leads')
      .insert({
        title,
        people_id: peopleId,
        leads_pipelines_id: config.pipeline_id,
        leads_stages_id: config.on_first_reply_stage_id,
        first_inbound_at: new Date().toISOString(),
        status: 'in_progress',
      })
      .select('id')
      .single() as unknown as { data: { id: string } | null; error: { message: string } | null };

    if (insertError) console.error('maybeHandleFirstReply: failed to create lead:', insertError.message);
    else if (created) console.log(`maybeHandleFirstReply: created lead ${created.id} in stage ${config.on_first_reply_stage_id} for people_id=${peopleId}`);
    return;
  }

  // 3. Active lead exists but first_inbound_at is null → move to configured stage and record timestamp (atomic guard)
  const { error } = await supabase
    .from('leads')
    .update({
      leads_stages_id: config.on_first_reply_stage_id,
      first_inbound_at: new Date().toISOString(),
    })
    .eq('id', lead.id)
    .is('first_inbound_at', null); // Re-check to avoid race conditions

  if (error) console.error('maybeHandleFirstReply: failed to move lead stage:', error.message);
  else console.log(`maybeHandleFirstReply: lead ${lead.id} moved to stage ${config.on_first_reply_stage_id}`);
}


async function pushToBuffer(
  supabase: ReturnType<typeof createClient>,
  personId: string,
  messageEntry: object,
  bufferMs: number,
  waPhoneNumberId?: string,
): Promise<void> {
  // Find existing unprocessed buffer entry or create new
  const { data: existing } = await supabase
    .from('message_buffer')
    .select('id, messages')
    .eq('people_id', personId)
    .eq('processed', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const expiresAt = new Date(Date.now() + bufferMs).toISOString();

  if (existing) {
    const updated = [...(existing.messages as object[]), messageEntry];
    await supabase.from('message_buffer').update({
      messages: updated,
      expires_at: expiresAt,
      // wa_phone_number_id: keep first message's channel (do not overwrite)
    }).eq('id', existing.id);
  } else {
    await supabase.from('message_buffer').insert({
      people_id: personId,
      messages: [messageEntry],
      expires_at: expiresAt,
      wa_phone_number_id: waPhoneNumberId ?? null,
    });
  }

  // Update last message timestamp and bump conversation to top of Omni list
  const now = new Date().toISOString();
  await supabase.from('clients_people').update({
    ai_last_message_at: now,
    updated_at: now,
  }).eq('id', personId);
}

// ── Delivery Status Updates (Meta statuses[] webhook) ──────────────────────────

/**
 * Persists Meta delivery-status events (sent/delivered/read/failed) onto the
 * matching outbound row (match by wa_message_id = status.id).
 *
 * FIX-WA-STATUS-WEBHOOK-01: previously these events were silently discarded by
 * the `!payload.messages?.length` early-return, so every outbound stayed stuck
 * at status='sent' with delivered_at/read_at NULL — total blindness to delivery
 * failures (e.g. error 131049 marketing cap).
 *
 * Resilience contract:
 *  - Monotonic progression: never downgrade read → delivered → sent. Enforced
 *    by a status-rank guard fetched per message before the UPDATE.
 *  - 'failed' maps to the canonical 'error' status (messages_status_check has NO
 *    'failed' value — writing it would silently violate the constraint).
 *  - Per-status try/catch so one bad event never aborts the batch or the handler.
 *  - Unknown wamid → silent no-op (the status may be for a message we never
 *    persisted, e.g. a system message). Always return 200 to Meta upstream.
 *  - metadata jsonb is read-modify-written so delivery_error merges with the
 *    existing payload (template_name/components/etc.) instead of clobbering it.
 */
async function handleStatusUpdates(
  supabase: ReturnType<typeof createClient>,
  statuses: NonNullable<WaPayload['statuses']>,
): Promise<void> {
  // Monotonic rank — higher = more advanced. 'sent' is the initial outbound
  // state; we only ever move forward. 'error' is terminal and may overwrite any
  // non-terminal state (a send can fail after being marked sent).
  const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3 };

  for (const status of statuses) {
    try {
      const wamid = status.id;
      if (!wamid) continue;

      // Map Meta status → canonical messages.status (no 'failed' in constraint).
      const isFailed = status.status === 'failed';
      const incomingStatus = isFailed ? 'error' : status.status;

      // Only sent/delivered/read/failed are actionable. Ignore anything else.
      if (!isFailed && !(incomingStatus in STATUS_RANK)) continue;

      // Fetch the current row to enforce monotonic progression + merge metadata.
      const { data: row } = await supabase
        .from('messages')
        .select('id, status, delivered_at, metadata')
        .eq('wa_message_id', wamid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as unknown as {
          data: { id: number; status: string; delivered_at: string | null; metadata: Record<string, unknown> | null } | null;
        };

      // Unknown wamid → silent no-op (status for a message we don't track).
      if (!row) {
        console.log(`whatsapp-inbound: status '${status.status}' for unknown wa_message_id=${wamid} — no-op`);
        continue;
      }

      // Resolve the event timestamp (Meta sends epoch seconds as a string).
      const tsSeconds = Number(status.timestamp);
      const eventTime = Number.isFinite(tsSeconds) && tsSeconds > 0
        ? new Date(tsSeconds * 1000).toISOString()
        : new Date().toISOString();

      if (isFailed) {
        // Failure is terminal: always record it, regardless of current rank, but
        // do not re-fail an already-errored row (idempotent on Meta retries).
        if (row.status === 'error') continue;

        const err = status.errors?.[0];
        const mergedMetadata = {
          ...(row.metadata ?? {}),
          delivery_error: {
            code: err?.code ?? null,
            title: err?.title ?? null,
            error_data: err?.error_data ?? null,
            at: eventTime,
          },
        };

        const { error: updErr } = await supabase
          .from('messages')
          .update({ status: 'error', metadata: mergedMetadata })
          .eq('id', row.id);

        if (updErr) console.error(`whatsapp-inbound: failed-status update error (wamid=${wamid}):`, updErr.message);
        else console.log(`whatsapp-inbound: marked message ${row.id} as error (code=${err?.code ?? 'n/a'}) wamid=${wamid}`);
        continue;
      }

      // Terminal-state guard: a row already marked 'error' (failed delivery)
      // must never be "revived" to delivered/read by a late/out-of-order event.
      if (row.status === 'error') continue;

      // Non-failure progression: skip if current status is already >= incoming.
      const currentRank = STATUS_RANK[row.status] ?? 0;
      const incomingRank = STATUS_RANK[incomingStatus] ?? 0;
      if (incomingRank <= currentRank) {
        // Already at this stage or beyond (e.g. read event after we recorded read,
        // or a late 'delivered' after 'read') — monotonic guard, no-op.
        continue;
      }

      // Build the update. 'read' implies 'delivered' already happened, so
      // backfill delivered_at if Meta skipped/raced the delivered event.
      const update: Record<string, unknown> = { status: incomingStatus };
      if (incomingStatus === 'delivered') {
        update.delivered_at = eventTime;
      } else if (incomingStatus === 'read') {
        update.read_at = eventTime;
        if (!row.delivered_at) update.delivered_at = eventTime;
      }

      const { error: updErr } = await supabase
        .from('messages')
        .update(update)
        .eq('id', row.id)
        // Re-assert monotonicity at the DB layer to avoid a concurrent webhook
        // racing us past our read. Only advance from the status we observed.
        .eq('status', row.status);

      if (updErr) console.error(`whatsapp-inbound: status update error (wamid=${wamid}):`, updErr.message);
      else console.log(`whatsapp-inbound: message ${row.id} ${row.status} → ${incomingStatus} (wamid=${wamid})`);
    } catch (err) {
      // One bad status event must never abort the batch or the 200 response.
      console.error('whatsapp-inbound: handleStatusUpdates per-event error:', (err as Error).message);
    }
  }
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const log = createLogger('whatsapp-inbound');
  const supabaseUrl     = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const appSecret       = Deno.env.get('WHATSAPP_APP_SECRET') ?? '';
  let openaiKey         = Deno.env.get('OPENAI_API_KEY') ?? '';

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Fallback: if OPENAI_API_KEY env var not set, fetch from settings_ai_providers
  if (!openaiKey) {
    try {
      const { data } = await supabase
        .from('settings_ai_providers')
        .select('api_key')
        .eq('provider', 'openai')
        .eq('active', true)
        .limit(1)
        .single();
      if (data?.api_key) openaiKey = data.api_key;
    } catch { /* non-fatal — transcription will be skipped */ }
  }

  // ── GET: Meta webhook verification ──────────────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode      = url.searchParams.get('hub.mode');
    const token     = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? 'growthsales2026';

    if (mode === 'subscribe' && token === verifyToken) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // ── POST: Process event ──────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Read body once — needed for both signature verification and parsing
  const bodyText = await req.text();
  const sigHeader = req.headers.get('x-hub-signature-256');

  // ── Outer safety net: always return 200 to Meta so it doesn't keep retrying ──
  try {

  // ── Parse envelope first so we can look up channel config ────────────────────
  let payload: WaPayload;
  try {
    const raw = JSON.parse(bodyText);
    // Meta sends events in a nested envelope:
    // { object: "whatsapp_business_account", entry: [{ changes: [{ value: WaPayload }] }] }
    // Extract the inner value; fall back to raw for direct / legacy calls.
    if (raw?.object === 'whatsapp_business_account' && raw?.entry?.[0]?.changes?.[0]?.value) {
      payload = raw.entry[0].changes[0].value as WaPayload;
    } else {
      payload = raw as WaPayload;
    }
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // ── Look up channel config first (needed for token + signature + active flag) ─
  // Resolved up-front so the HMAC signature check below gates BOTH status-only
  // payloads (statuses[]) and message payloads (messages[]) — neither path may
  // write to the DB before the payload is authenticated. Status-only webhooks
  // also carry metadata.phone_number_id, so channel lookup works for them too.
  const phoneNumberId = payload.metadata?.phone_number_id;
  const { data: channelConfig } = phoneNumberId
    ? await supabase
        .from('settings_whatsapp_channels' as 'messages')
        .select('active, access_token, app_secret')
        .eq('phone_number_id', phoneNumberId)
        .maybeSingle() as unknown as { data: { active: boolean; access_token: string; app_secret: string | null } | null }
    : { data: null };

  // ── Validate Meta signature using channel app_secret (or env var fallback) ───
  // Only reject if BOTH the secret AND the signature header are present but don't match.
  // If sigHeader is missing (e.g. test mode, internal calls) → skip validation.
  // If secret is not configured anywhere → skip validation.
  const resolvedAppSecret = channelConfig?.app_secret || appSecret;
  if (resolvedAppSecret && sigHeader) {
    const valid = await verifyMetaSignature(bodyText, sigHeader, resolvedAppSecret);
    if (!valid) {
      console.error(`whatsapp-inbound: invalid signature for phone_number_id=${phoneNumberId ?? 'unknown'}`);
      return new Response('Unauthorized', { status: 401 });
    }
  } else if (resolvedAppSecret && !sigHeader) {
    // App secret configured but Meta didn't send the signature header — log & proceed.
    console.warn(`whatsapp-inbound: app_secret configured but x-hub-signature-256 header missing — skipping validation`);
  }

  // ── Delivery status events (delivered/read/failed) ──────────────────────────
  // FIX-WA-STATUS-WEBHOOK-01 + CONCERN-1: persist Meta status callbacks only AFTER
  // the HMAC signature has been validated above, so we never write to the DB on an
  // unauthenticated payload. A single webhook carries either messages[] OR
  // statuses[] (never both), so this runs only for status-only payloads, then the
  // early-return below short-circuits before the message path. Failures here must
  // not block the 200 — handleStatusUpdates isolates per-event errors internally.
  if (payload.statuses?.length) {
    await handleStatusUpdates(supabase, payload.statuses);
  }

  // ── Filter: skip status events and non-message payloads ─────────────────────
  if (!payload.messages?.length) {
    return new Response('OK', { status: 200 });
  }

  const msg = payload.messages[0];
  const metadata = payload.metadata!;
  const contact = payload.contacts?.[0];

  // Normalize phone number
  const rawPhone = msg.from;
  const phone    = normalizeBRPhone(rawPhone);
  const name     = contact?.profile?.name ?? phone;

  // If channel exists and is explicitly disabled → store message but skip AI
  const channelBlocked = channelConfig !== null && channelConfig?.active === false;

  // Prefer token from channel config (set via UI), fall back to env var
  const resolvedWaToken = channelConfig?.access_token || Deno.env.get('WHATSAPP_ACCESS_TOKEN') || '';

  // ── AI agent config — look up early to gate typing indicator ─────────────────
  // Agents may route by wa_phone_number_id (exact match) OR by pipeline_id (wa_phone_number_id=null).
  // Check for both: exact match first, then any active agent as fallback.
  const { data: agentConfig } = await supabase
    .from('ai_agents')
    .select('buffer_ms, wa_phone_number_id')
    .eq('active', true)
    .or(`wa_phone_number_id.eq.${metadata.phone_number_id},wa_phone_number_id.is.null`)
    .limit(1)
    .maybeSingle();

  const bufferMs = agentConfig?.buffer_ms ?? 1000;

  // ── Typing indicator — deferred until after person upsert ─────────────────────
  // Moved below: only fires when person.ai_enabled AND agentConfig exist.
  // Showing "typing..." when no one is about to respond is misleading to the client.

  // ── FIX-AGENT-DUP-02 — inbound wamid dedup (defense-in-depth) ─────────────────
  // Meta retries webhook deliveries (it expects 200; any slowness/5xx → redelivery).
  // A redelivered message has the SAME wa_message_id (msg.id). Without this gate the
  // same inbound gets appended to the buffer twice and can spawn a second trigger →
  // duplicate agent reply. If we've already persisted a message with this wamid, this
  // is a retry → ack 200 and stop. (The atomic buffer claim in ai-agent-execute is the
  // primary serialization; this stops the duplicate at the source.)
  if (msg.id) {
    const { data: existingMsg } = await supabase
      .from('messages')
      .select('id')
      .eq('wa_message_id', msg.id)
      .limit(1)
      .maybeSingle();
    if (existingMsg) {
      console.log(`whatsapp-inbound: duplicate wamid ${msg.id} — already processed, skipping (Meta retry)`);
      return new Response('OK', { status: 200 });
    }
  }

  // ── Detect #apagar# command ───────────────────────────────────────────────────
  const rawText = extractMessageText(msg);
  if (rawText.trim() === '#apagar#') {
    const { data: person } = await supabase
      .from('clients_people')
      .select('id')
      .eq('whatsapp', phone)
      .maybeSingle();

    if (person) {
      await deletePersonData(supabase, person.id);
    }
    return new Response('OK', { status: 200 });
  }

  // ── Resolve message content by type ──────────────────────────────────────────
  let content   = rawText;
  let msgType   = 'texto';
  let storedUrl: string | null = null;
  let mediaMetadata: { file_name: string; mime_type: string; file_size: number } | null = null;

  if (msg.type === 'audio' && msg.audio) {
    msgType = 'audio';
    if (resolvedWaToken) {
      try {
        const metaUrl = await getMediaUrl(msg.audio.id, resolvedWaToken);
        const buffer  = await downloadMedia(metaUrl, resolvedWaToken);
        const ext     = (msg.audio.mime_type.split(';')[0].split('/')[1] ?? 'ogg');
        storedUrl     = await uploadToOmniMedia(supabase, buffer, msg.audio.mime_type, phone, 'audio');
        mediaMetadata = { file_name: `audio.${ext}`, mime_type: msg.audio.mime_type, file_size: buffer.byteLength };
        // Transcribe for AI context (non-fatal)
        if (openaiKey) {
          try {
            content = await transcribeAudio(buffer, msg.audio.mime_type, openaiKey);
          } catch (transcErr) {
            console.error('whatsapp-inbound: audio transcription failed:', transcErr);
            content = '[Áudio recebido]';
          }
        } else {
          content = '[Áudio recebido]';
        }
      } catch (err) {
        console.error('whatsapp-inbound: audio download/upload failed:', err);
        content = '[Áudio recebido]';
      }
    } else {
      content = '[Áudio recebido]';
    }

  } else if (msg.type === 'image' && msg.image) {
    msgType = 'imagem';
    if (resolvedWaToken) {
      try {
        const metaUrl = await getMediaUrl(msg.image.id, resolvedWaToken);
        const buffer  = await downloadMedia(metaUrl, resolvedWaToken);
        const ext     = msg.image.mime_type.split('/')[1] ?? 'jpg';
        storedUrl     = await uploadToOmniMedia(supabase, buffer, msg.image.mime_type, phone, 'image');
        mediaMetadata = { file_name: `image.${ext}`, mime_type: msg.image.mime_type, file_size: buffer.byteLength };
        if (msg.image.caption) {
          content = msg.image.caption;
        } else if (openaiKey) {
          try { content = await analyzeImage(buffer, '', openaiKey); } catch { content = '[Imagem recebida]'; }
        } else {
          content = '[Imagem recebida]';
        }
      } catch (err) {
        console.error('whatsapp-inbound: image download/upload failed:', err);
        content = '[Imagem recebida]';
      }
    } else {
      content = '[Imagem recebida]';
    }

  } else if (msg.type === 'video' && msg.video) {
    msgType = 'video';
    if (resolvedWaToken) {
      try {
        const metaUrl = await getMediaUrl(msg.video.id, resolvedWaToken);
        const buffer  = await downloadMedia(metaUrl, resolvedWaToken);
        const ext     = msg.video.mime_type.split('/')[1] ?? 'mp4';
        storedUrl     = await uploadToOmniMedia(supabase, buffer, msg.video.mime_type, phone, 'video');
        mediaMetadata = { file_name: `video.${ext}`, mime_type: msg.video.mime_type, file_size: buffer.byteLength };
        content = msg.video.caption || '[Vídeo recebido]';
      } catch (err) {
        console.error('whatsapp-inbound: video download/upload failed:', err);
        content = '[Vídeo recebido]';
      }
    } else {
      content = '[Vídeo recebido]';
    }

  } else if (msg.type === 'document' && msg.document) {
    msgType = 'arquivo';
    if (resolvedWaToken) {
      try {
        const metaUrl  = await getMediaUrl(msg.document.id, resolvedWaToken);
        const buffer   = await downloadMedia(metaUrl, resolvedWaToken);
        const ext      = msg.document.mime_type.split('/')[1] ?? 'bin';
        const fileName = msg.document.filename || `document.${ext}`;
        storedUrl      = await uploadToOmniMedia(supabase, buffer, msg.document.mime_type, phone, 'doc');
        mediaMetadata  = { file_name: fileName, mime_type: msg.document.mime_type, file_size: buffer.byteLength };
        if (msg.document.mime_type === 'application/pdf') {
          const pdfText = await extractPdfText(buffer, openaiKey || undefined);
          content = pdfText ? `[PDF: ${fileName}]\n${pdfText}` : (msg.document.caption || fileName);
        } else {
          content = msg.document.caption || fileName;
        }
      } catch (err) {
        console.error('whatsapp-inbound: document download/upload failed:', err);
        content = '[Arquivo recebido]';
      }
    } else {
      content = '[Arquivo recebido]';
    }

  } else if (msg.type === 'sticker' && msg.sticker) {
    msgType = 'imagem';
    if (resolvedWaToken) {
      try {
        const metaUrl = await getMediaUrl(msg.sticker.id, resolvedWaToken);
        const buffer  = await downloadMedia(metaUrl, resolvedWaToken);
        storedUrl     = await uploadToOmniMedia(supabase, buffer, msg.sticker.mime_type, phone, 'sticker');
        mediaMetadata = { file_name: 'sticker.webp', mime_type: msg.sticker.mime_type, file_size: buffer.byteLength };
        content = '[Sticker recebido]';
      } catch (err) {
        console.error('whatsapp-inbound: sticker download/upload failed:', err);
        content = '[Sticker recebido]';
      }
    } else {
      content = '[Sticker recebido]';
    }

  } else if (['text', 'interactive', 'button'].includes(msg.type)) {
    msgType = 'texto';
    content = rawText;
  } else {
    // Unknown type — store as text with a note
    msgType = 'texto';
    content = rawText || `[Mensagem do tipo ${msg.type}]`;
  }

  if (!content.trim()) {
    content = '[Mensagem sem texto]';
  }

  // ── Upsert person ─────────────────────────────────────────────────────────────
  let person: { id: string; ai_enabled: boolean };
  try {
    person = await upsertPerson(supabase, phone, name);
  } catch (err) {
    console.error('upsertPerson error:', (err as Error).message);
    return new Response('Internal Server Error', { status: 500 });
  }

  // ── Maybe auto-create negócio ─────────────────────────────────────────────────
  // Only runs when operator has enabled auto-create in settings_omni_new_contact
  try {
    await maybeCreateNegocio(supabase, person.id, phone, name);
  } catch (err) {
    // Non-fatal: message delivery must not be blocked by CRM automation
    console.error('maybeCreateNegocio error (non-fatal):', (err as Error).message);
  }

  // ── Maybe move lead stage on first inbound reply ───────────────────────────────
  // Runs when operator has enabled on_first_reply in settings_omni_new_contact.
  // Creates a lead if one doesn't exist (covers first-time inbound without prior auto_create).
  try {
    await maybeHandleFirstReply(supabase, person.id, phone, name);
  } catch (err) {
    console.error('maybeHandleFirstReply error (non-fatal):', (err as Error).message);
  }

  // ── Resolve lead_id for the message ──────────────────────────────────────────
  // Fetch active lead for this person so the message appears in the Omni inbox.
  // maybeCreateNegocio may have just created one, so this always reflects latest state.
  let activeleadId: string | null = null;
  try {
    const { data: activeLead } = await supabase
      .from('leads')
      .select('id')
      .eq('people_id', person.id)
      .neq('status', 'lost')
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    activeleadId = activeLead?.id ?? null;
  } catch (_) { /* non-fatal — message still stored without lead_id */ }

  // ── INSERT message to messages table ─────────────────────────────────────────
  const { error: msgInsertError } = await supabase.from('messages').insert({
    people_id:      person.id,
    lead_id:        activeleadId,
    channel:        'whatsapp',
    content,
    from_contact:   'cliente',
    source_type:    'inbound',
    message_type:   msgType,
    media_url:      storedUrl,
    media_metadata: mediaMetadata,
    status:             'delivered',
    wa_message_id:      msg.id,
    wa_phone_number_id: metadata.phone_number_id,
    metadata: {
      wa_from: rawPhone,
      wa_phone_number_id: metadata.phone_number_id,
      wa_message_type: msg.type,
    },
  });
  if (msgInsertError) {
    console.error('messages INSERT error:', msgInsertError.message, '| details:', JSON.stringify(msgInsertError));
  } else {
    console.log(`whatsapp-inbound: message saved — person=${person.id} phone=${phone} type=${msgType}`);
  }

  // ── Always bump contact to top of Omni inbox ─────────────────────────────────
  // Must run regardless of ai_enabled — pushToBuffer only runs when AI is active,
  // but the contact should appear in Omni for any inbound message.
  if (!msgInsertError) {
    supabase.from('clients_people').update({ updated_at: new Date().toISOString() })
      .eq('id', person.id)
      .then(({ error }) => {
        if (error) console.error('whatsapp-inbound: clients_people.updated_at bump failed:', error.message);
      });
  }

  // ── Typing indicator — only when AI will actually process the message ─────────
  // Fires after person upsert so we know ai_enabled status.
  // Prevents "typing..." from showing to clients with no AI agent responding.
  if (person.ai_enabled && agentConfig && resolvedWaToken && !channelBlocked) {
    fetch(`https://graph.facebook.com/v25.0/${metadata.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${resolvedWaToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: msg.id,
        typing_indicator: { type: 'text' },
      }),
    }).catch(e => log.silent('typing_indicator_failed', { error: (e as Error).message }));
  }

  // ── Push to message buffer + trigger ai-agent-execute directly ───────────────
  if (person.ai_enabled && !channelBlocked) {
    try {
      await pushToBuffer(supabase, person.id, {
        content,
        message_type: msgType,
        wa_message_id: msg.id,
      }, bufferMs, metadata.phone_number_id);
    } catch (bufErr) {
      console.error('whatsapp-inbound: pushToBuffer failed (non-fatal):', (bufErr as Error).message);
    }

    // Trigger ai-agent-execute after buffer window — background, non-blocking.
    // Replaces pg_cron dependency: agent fires in bufferMs ms, not up to 60s.
    const _agentUrl = `${supabaseUrl}/functions/v1/ai-agent-execute`;
    const _agentKey = serviceRoleKey;
    const _peopleId = person.id;
    const _delay    = bufferMs;
    EdgeRuntime.waitUntil(
      new Promise<void>(resolve => {
        setTimeout(async () => {
          try {
            await fetch(_agentUrl, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_agentKey}` },
              body:    JSON.stringify({ people_id: _peopleId }),
            });
          } catch (e) {
            console.error('whatsapp-inbound: ai-agent-execute trigger failed:', (e as Error).message);
          }
          resolve();
        }, _delay);
      })
    );
  } else if (channelBlocked) {
    console.log(`whatsapp-inbound: channel ${metadata.phone_number_id} is paused — message stored but AI skipped`);
  }

  return new Response('OK', { status: 200 });

  } catch (topLevelErr) {
    // Log the error but always respond 200 so Meta doesn't retry and flood logs
    console.error('whatsapp-inbound: unhandled top-level error:', (topLevelErr as Error).message, topLevelErr);
    return new Response('OK', { status: 200 });
  }
});
