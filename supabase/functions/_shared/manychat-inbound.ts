/**
 * Shared ManyChat inbound handler — used by tiktok-manychat-inbound and instagram-manychat-inbound.
 * Logs every request to webhook_logs regardless of outcome.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from './logger.ts';

export type ManyChatChannel = 'tiktok-manychat' | 'instagram-manychat';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

interface ManyChatPayload {
  subscriber_id?: string | number;
  full_name?: string;
  username?: string;
  text?: string;
  ts?: string;
  id?: string | number;
  name?: string;
  first_name?: string;
  last_name?: string;
  profile_pic?: string;
  last_input_text?: string | null;
  tt_username?: string | null;
  ig_username?: string | null;
  ig_id?: string | null;
  page_id?: string;
}

type WebhookEvent = 'saved' | 'forbidden' | 'empty_text' | 'dedup' | 'no_subscriber_id' | 'error' | 'parse_error';

async function writeLog(
  supabase: ReturnType<typeof createClient>,
  channel: ManyChatChannel,
  event: WebhookEvent,
  opts: {
    subscriberId?: string;
    peopleId?: string;
    messageId?: string;
    payload?: ManyChatPayload;
    errorDetail?: string;
  } = {},
): Promise<void> {
  try {
    await supabase.from('webhook_logs').insert({
      source:        'manychat',
      channel,
      event,
      subscriber_id: opts.subscriberId ?? null,
      people_id:     opts.peopleId ?? null,
      message_id:    opts.messageId ?? null,
      payload:       opts.payload ?? null,
      error_detail:  opts.errorDetail ?? null,
    });
  } catch {
    // non-fatal — never let logging break the webhook
  }
}

async function upsertPerson(
  supabase: ReturnType<typeof createClient>,
  channel: ManyChatChannel,
  subscriberId: string,
  fields: { firstName: string; lastName: string; fullName: string; profilePic: string; platformUsername: string },
): Promise<{ id: string; ai_enabled: boolean; name: string }> {
  const isIg = channel === 'instagram-manychat';
  const platformLabel = isIg ? 'Instagram' : 'TikTok';

  const { data: existing } = await supabase
    .from('clients_people')
    .select('id, ai_enabled, name, avatar_url, tiktok_username, instagram_handle')
    .eq('manychat_subscriber_id', subscriberId)
    .neq('status', 'merged')
    .maybeSingle() as unknown as {
      data: { id: string; ai_enabled: boolean; name: string; avatar_url: string | null; tiktok_username: string | null; instagram_handle: string | null } | null;
    };

  const displayName = fields.fullName
    || [fields.firstName, fields.lastName].filter(Boolean).join(' ').trim()
    || `${platformLabel} ${subscriberId.slice(-6)}`;

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (displayName && displayName !== existing.name) patch.name = displayName;
    if (fields.profilePic && fields.profilePic !== existing.avatar_url) patch.avatar_url = fields.profilePic;
    if (isIg) {
      if (fields.platformUsername && fields.platformUsername !== existing.instagram_handle) patch.instagram_handle = fields.platformUsername;
    } else {
      if (fields.platformUsername && fields.platformUsername !== existing.tiktok_username) patch.tiktok_username = fields.platformUsername;
    }
    if (Object.keys(patch).length > 0) {
      await supabase.from('clients_people').update(patch).eq('id', existing.id);
    }
    return { id: existing.id, ai_enabled: existing.ai_enabled, name: (patch.name as string) ?? existing.name };
  }

  const insert: Record<string, unknown> = {
    name: displayName,
    manychat_subscriber_id: subscriberId,
    avatar_url: fields.profilePic || null,
    ai_enabled: true,
    status: 'active',
    service_status: 'open',
  };
  if (isIg) {
    insert.instagram_handle = fields.platformUsername || null;
  } else {
    insert.tiktok_username = fields.platformUsername || null;
  }

  const { data: created, error } = await supabase
    .from('clients_people')
    .insert(insert)
    .select('id, ai_enabled, name')
    .single() as unknown as { data: { id: string; ai_enabled: boolean; name: string } | null; error: unknown };

  if (error) throw new Error(`upsertPerson: ${(error as { message: string }).message}`);
  if (!created) throw new Error('upsertPerson: no data returned');
  return created;
}

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
    await supabase.from('message_buffer').insert({ people_id: peopleId, messages: [messageEntry], expires_at: expiresAt });
  }

  await supabase.from('clients_people').update({ ai_last_message_at: new Date().toISOString() }).eq('id', peopleId);
}

async function maybeCreateNegocio(
  supabase: ReturnType<typeof createClient>,
  channel: ManyChatChannel,
  peopleId: string,
  name: string,
): Promise<void> {
  const { data: config } = await supabase
    .from('settings_omni_new_contact')
    .select('auto_create_negocio, pipeline_id, stage_id, title_template')
    .eq('channel', channel)
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

  const platformLabel = channel === 'instagram-manychat' ? 'Instagram' : 'TikTok';
  const title = (config.title_template || `Nova conversa ${platformLabel} - {{nome}}`).replace('{{nome}}', name || peopleId);

  const { error } = await supabase.from('leads').insert({
    title,
    people_id: peopleId,
    leads_pipelines_id: config.pipeline_id,
    leads_stages_id: config.stage_id,
    status: 'in_progress',
  });

  if (error) console.error(`maybeCreateNegocio (${channel}):`, error.message);
}

export async function handleManyChatInbound(req: Request, channel: ManyChatChannel): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const ok = () => new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  if (req.method !== 'POST') return ok();

  const log = createLogger(`${channel}-inbound`);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ── 1. Parse payload ──────────────────────────────────────────────────────
    let payload: ManyChatPayload;
    try {
      payload = await req.json() as ManyChatPayload;
    } catch {
      log.warn('parse_error');
      await writeLog(supabase, channel, 'parse_error', { errorDetail: 'JSON parse failed' });
      return ok();
    }

    // ── 2. Validate secret ────────────────────────────────────────────────────
    const { data: cfg } = await supabase
      .from('omni_channel_configs')
      .select('credentials, is_active')
      .eq('channel', channel)
      .maybeSingle() as unknown as { data: { credentials: Record<string, string>; is_active: boolean } | null };

    const expectedSecret = cfg?.credentials?.webhook_secret ?? '';
    const providedSecret = req.headers.get('x-webhook-secret') ?? '';

    if (!expectedSecret || providedSecret !== expectedSecret) {
      log.warn('secret_invalid', { has_expected: !!expectedSecret });
      await writeLog(supabase, channel, 'forbidden', { payload, errorDetail: 'secret mismatch' });
      return new Response(JSON.stringify({ status: 'forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Extract fields ─────────────────────────────────────────────────────
    const subscriberId = String(payload.subscriber_id ?? payload.id ?? '').trim();
    const text = (payload.text ?? payload.last_input_text ?? '').trim();

    if (!subscriberId) {
      log.warn('no_subscriber_id');
      await writeLog(supabase, channel, 'no_subscriber_id', { payload });
      return ok();
    }

    if (!text) {
      log.info('empty_text', { subscriber_id: subscriberId });
      await writeLog(supabase, channel, 'empty_text', { subscriberId, payload });
      return ok();
    }

    const ts = (payload.ts ?? '').trim();
    const externalId = `${subscriberId}_${ts || Date.now()}`;
    const sentAt = ts && !Number.isNaN(Date.parse(ts)) ? new Date(ts).toISOString() : new Date().toISOString();

    log.info('dm_received', { subscriber_id: subscriberId, external_id: externalId, preview: text.slice(0, 60) });

    // ── 4. Upsert person ──────────────────────────────────────────────────────
    const isIg = channel === 'instagram-manychat';
    let person: { id: string; ai_enabled: boolean; name: string };
    try {
      person = await upsertPerson(supabase, channel, subscriberId, {
        firstName: (payload.first_name ?? '').trim(),
        lastName: (payload.last_name ?? '').trim(),
        fullName: (payload.full_name ?? payload.name ?? '').trim(),
        profilePic: (payload.profile_pic ?? '').trim(),
        platformUsername: isIg
          ? (payload.ig_username ?? '').trim()
          : (payload.username ?? payload.tt_username ?? '').trim(),
      });
    } catch (err) {
      const errorDetail = (err as Error).message;
      log.error('person_upsert_failed', { error: errorDetail });
      await writeLog(supabase, channel, 'error', { subscriberId, payload, errorDetail });
      return ok();
    }

    // ── 5. Dedup ──────────────────────────────────────────────────────────────
    const { data: dup } = await supabase
      .from('messages')
      .select('id')
      .eq('channel', channel)
      .eq('metadata->>manychat_external_id', externalId)
      .limit(1)
      .maybeSingle();

    if (dup) {
      log.info('dedup_skip', { external_id: externalId });
      await writeLog(supabase, channel, 'dedup', { subscriberId, peopleId: person.id, payload });
      return ok();
    }

    // ── 6. Auto-create negócio (non-fatal) ────────────────────────────────────
    try { await maybeCreateNegocio(supabase, channel, person.id, person.name); } catch { /* non-fatal */ }

    // ── 7. INSERT message ─────────────────────────────────────────────────────
    const { data: savedMsg, error: msgErr } = await supabase.from('messages').insert({
      people_id: person.id,
      lead_id: null,
      channel,
      content: text,
      from_contact: 'cliente',
      source_type: 'inbound',
      message_type: 'texto',
      status: 'delivered',
      sent_at: sentAt,
      metadata: {
        manychat_subscriber_id: subscriberId,
        manychat_external_id: externalId,
        manychat_page_id: payload.page_id ?? null,
        manychat_platform: isIg ? 'instagram' : 'tiktok',
      },
    }).select('id').single() as unknown as { data: { id: string } | null; error: unknown };

    if (msgErr) {
      const errorDetail = (msgErr as { message: string }).message;
      log.error('msg_insert_failed', { error: errorDetail, person_id: person.id });
      await writeLog(supabase, channel, 'error', { subscriberId, peopleId: person.id, payload, errorDetail });
    } else {
      log.info('msg_saved', { person_id: person.id, message_id: savedMsg?.id });
      await writeLog(supabase, channel, 'saved', {
        subscriberId,
        peopleId: person.id,
        messageId: savedMsg?.id,
        payload,
      });
    }

    // ── 8. Push to message buffer → triggers AI agent ─────────────────────────
    if (person.ai_enabled && !msgErr) {
      const { data: agentCfg } = await supabase.from('ai_agents').select('buffer_ms').eq('active', true).limit(1).maybeSingle();
      try {
        await pushToBuffer(supabase, person.id, { content: text, message_type: 'texto', manychat_external_id: externalId }, agentCfg?.buffer_ms ?? 8000);
      } catch (bufErr) {
        log.warn('buffer_push_failed', { error: (bufErr as Error).message });
      }
    }

    return ok();
  } catch (err) {
    const errorDetail = (err as Error).message;
    console.error(`${channel}-inbound: unhandled error:`, errorDetail);
    try {
      await writeLog(supabase, channel, 'error', { errorDetail });
    } catch { /* last resort */ }
    return ok();
  }
}
