/**
 * Meta Inbound Webhook Router
 *
 * ⚠️  DEPLOY: always use --no-verify-jwt
 *     supabase functions deploy meta-inbound --no-verify-jwt
 *
 * Single webhook endpoint for all Meta products:
 *   GET  → webhook verification (hub.challenge handshake)
 *   POST → routes by `object` field:
 *     "instagram"               → Instagram DMs (messages field) + Comments
 *     "page"                    → Instagram DMs + Comments + Lead Ads (leadgen)
 *     "leadgen"                 → Meta Lead Ads (standalone object)
 *     "whatsapp_business_account" → (handled by whatsapp-inbound, not this function)
 *
 * Env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   INSTAGRAM_APP_SECRET  (Meta App Secret for HMAC-SHA256 verification)
 *   INSTAGRAM_VERIFY_TOKEN (your custom string for webhook registration)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import { processCrmData } from '../_shared/crm-mapper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

// ── HMAC-SHA256 Verification ───────────────────────────────────────────────────

async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const expected = signatureHeader.slice(7);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const actual = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return actual === expected;
}

// ── Phone normalization (reused from whatsapp-inbound) ────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length === 13) {
    // Brazilian mobile: remove 9th digit (55 + DDD + 9 + XXXXXXXX → 55 + DDD + XXXXXXXX)
    return digits.slice(0, 4) + digits.slice(5);
  }
  return digits;
}

// ── Instagram Profile Enrichment ──────────────────────────────────────────────

const META_GRAPH = 'https://graph.instagram.com/v25.0';

async function enrichInstagramProfile(
  igsid: string,
  personId: string,
  supabase: ReturnType<typeof createClient>,
  log: ReturnType<typeof createLogger>,
  recipientIgbid?: string,
): Promise<void> {
  try {
    // Get access token for the account that received this message (multi-account support)
    const { data: cfg } = await supabase
      .from('omni_channel_configs')
      .select('credentials')
      .eq('channel', 'instagram')
      .single();

    const creds = (cfg?.credentials ?? {}) as Record<string, unknown>;
    const accounts = (creds.accounts ?? {}) as Record<string, { access_token: string }>;

    // Use account-specific token if available for this IGBID
    const accessToken =
      (recipientIgbid && accounts[recipientIgbid]?.access_token) ||
      (creds.access_token as string) ||
      Deno.env.get('INSTAGRAM_ACCESS_TOKEN') ||
      '';

    if (!accessToken) {
      log.warn('ig_enrich_no_token', { igsid });
      return;
    }

    const resp = await fetch(
      `${META_GRAPH}/${igsid}?fields=name,username,profile_pic,follower_count,is_verified_user&access_token=${accessToken}`,
    );

    const rawBody = await resp.text();

    if (!resp.ok) {
      // Detect expired/invalid token (Meta error code 190 = OAuthException)
      let isTokenExpired = false;
      try {
        const errBody = JSON.parse(rawBody) as { error?: { code?: number; type?: string; message?: string } };
        const errCode = errBody?.error?.code;
        const errType = errBody?.error?.type;
        isTokenExpired = errCode === 190 || errType === 'OAuthException';
        if (isTokenExpired) {
          log.error('ig_token_invalid', { igsid, code: errCode, type: errType, message: errBody?.error?.message });
          // Insert operator alert — non-fatal, fire-and-forget
          // System User Tokens don't expire by time but can be invalidated (revoked permission,
          // disconnected app, suspended Business Manager). Operator must re-auth via instagram-oauth.
          supabase.from('omni_channel_alerts').insert({
            channel: 'instagram',
            alert_type: 'token_invalid',
            severity: 'error',
            title: 'Token do Instagram inválido — reconecte a conta via OAuth',
            details: { igsid, error_code: errCode, error_type: errType, error_message: errBody?.error?.message },
          }).then(() => {}).catch(() => {});
        } else {
          log.warn('ig_enrich_fetch_failed', { igsid, status: resp.status, body: rawBody });
        }
      } catch {
        log.warn('ig_enrich_fetch_failed', { igsid, status: resp.status, body: rawBody });
      }
      return;
    }

    let profile: { name?: string; username?: string; profile_pic?: string; follower_count?: number; is_verified_user?: boolean };
    try {
      profile = JSON.parse(rawBody);
    } catch {
      log.warn('ig_enrich_parse_failed', { igsid, body: rawBody });
      return;
    }

    log.info('ig_enrich_profile', { igsid, name: profile.name, username: profile.username, followers: profile.follower_count });

    const updates: Record<string, unknown> = {};
    if (profile.name) updates.name = profile.name;
    if (profile.username) {
      updates.instagram_user_id = profile.username;
      updates.instagram_handle = profile.username;
    }
    if (profile.profile_pic) updates.profile_picture = profile.profile_pic;
    if (profile.follower_count != null) updates.instagram_followers = profile.follower_count;
    if (profile.is_verified_user != null) updates.instagram_verified = profile.is_verified_user;

    if (Object.keys(updates).length > 0) {
      await supabase.from('clients_people').update(updates).eq('id', personId);
    }
  } catch (e) {
    log.warn('ig_enrich_exception', { igsid, error: String(e) });
  }
}

// ── Instagram Post Metadata Fetch ─────────────────────────────────────────────

async function fetchPostMetadata(
  postId: string,
  accessToken: string,
  log: ReturnType<typeof createLogger>,
): Promise<{ post_image_url?: string; post_thumbnail_url?: string; post_permalink?: string; post_caption?: string } | null> {
  try {
    const fields = 'media_type,media_url,thumbnail_url,permalink,caption';
    const resp = await fetch(
      `${META_GRAPH}/${postId}?fields=${fields}&access_token=${accessToken}`,
    );
    if (!resp.ok) {
      log.warn('ig_post_fetch_failed', { post_id: postId, status: resp.status });
      return null;
    }
    const data = await resp.json() as Record<string, string | undefined>;
    return {
      post_image_url: data.media_url,
      post_thumbnail_url: data.thumbnail_url,
      post_permalink: data.permalink,
      post_caption: data.caption ? String(data.caption).slice(0, 200) : undefined,
    };
  } catch (e) {
    log.warn('ig_post_fetch_exception', { post_id: postId, error: String(e) });
    return null;
  }
}

// ── Auto-create negócio on first contact ─────────────────────────────────────

/**
 * Checks settings_omni_new_contact for the given channel.
 * If auto_create_negocio is enabled and the person has no open lead, creates one.
 * Non-fatal — never blocks message processing.
 */
async function maybeCreateNegocio(
  supabase: ReturnType<typeof createClient>,
  peopleId: string,
  name: string,
  channel: 'instagram_dm' | 'instagram_comment',
): Promise<void> {
  const { data: config } = await supabase
    .from('settings_omni_new_contact')
    .select('auto_create_negocio, pipeline_id, stage_id, title_template')
    .eq('channel', channel)
    .maybeSingle();

  if (!config?.auto_create_negocio || !config.pipeline_id || !config.stage_id) return;

  // Check if person already has an open negócio
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id')
    .eq('people_id', peopleId)
    .neq('status', 'lost')
    .neq('status', 'archived')
    .limit(1)
    .maybeSingle();

  if (existingLead) return;

  const title = (config.title_template || 'Nova conversa - {{nome}}')
    .replace('{{nome}}', name || peopleId);

  const { error } = await supabase.from('leads').insert({
    title,
    people_id: peopleId,
    leads_pipelines_id: config.pipeline_id,
    leads_stages_id: config.stage_id,
    status: 'in_progress',
    ...(channel === 'instagram_dm' && { origem_lista: 'social-selling-agent' }),
  });

  if (error) console.error('maybeCreateNegocio (instagram): failed:', error.message);
  else console.log(`maybeCreateNegocio (instagram): created negócio for people_id=${peopleId}`);
}

// ── Message buffer ────────────────────────────────────────────────────────────

/**
 * Push inbound message to message_buffer so pg_cron can trigger ai-agent-execute.
 * Mirrors the same function in whatsapp-inbound, adding channel_type support.
 */
async function pushToBuffer(
  supabase: ReturnType<typeof createClient>,
  peopleId: string,
  messageEntry: object,
  channelType: string,
  bufferMs = 8000,
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
    const updated = [...(existing.messages as object[]), messageEntry];
    await supabase.from('message_buffer')
      .update({ messages: updated, expires_at: expiresAt })
      .eq('id', existing.id);
  } else {
    await supabase.from('message_buffer').insert({
      people_id: peopleId,
      messages: [messageEntry],
      expires_at: expiresAt,
      channel_type: channelType,
    });
  }

  const now = new Date().toISOString();
  await supabase.from('clients_people')
    .update({ ai_last_message_at: now, updated_at: now })
    .eq('id', peopleId);
}

// ── Instagram Comment Handler ─────────────────────────────────────────────────

/**
 * Handles Instagram post comment webhooks (changes[].field === 'comments').
 * Stores each comment as a message with message_type='comentario' so the
 * OMNI feed can render it with the comment UI (badge + reply actions).
 *
 * Webhook payload:
 *   entry[].changes[{ field: 'comments', value: {
 *     id, text, from: { id, username }, media: { id, media_product_type },
 *     timestamp, parent_id?   ← present for replies to comments
 *   }}]
 */
async function handleInstagramComments(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  log: ReturnType<typeof createLogger>,
): Promise<void> {
  // Fetch access token once for post metadata lookups
  let igAccessToken = '';
  try {
    const { data: cfg } = await supabase
      .from('omni_channel_configs')
      .select('credentials')
      .eq('channel', 'instagram')
      .single();
    const creds = (cfg?.credentials ?? {}) as Record<string, unknown>;
    igAccessToken = (creds.access_token as string) || Deno.env.get('INSTAGRAM_ACCESS_TOKEN') || '';
  } catch { /* non-critical, post preview is best-effort */ }

  const entries = (body.entry as Record<string, unknown>[]) ?? [];

  for (const entry of entries) {
    const igbid = (entry.id as string) ?? '';
    const changes = (entry.changes as Record<string, unknown>[]) ?? [];
    const commentChanges = changes.filter(c => (c.field as string) === 'comments');

    if (commentChanges.length === 0) continue;

    log.info('ig_comment_changes', { count: commentChanges.length });

    for (const change of commentChanges) {
      const value = change.value as Record<string, unknown>;
      if (!value) continue;

      const commentId    = value.id as string;
      const text         = (value.text as string) ?? '';
      const from         = (value.from as Record<string, unknown>) ?? {};
      const senderId     = from.id as string;
      const senderUser   = (from.username as string) ?? '';
      const media        = (value.media as Record<string, unknown>) ?? {};
      const postId       = (media.id as string) ?? '';
      const timestampSec = Number(value.timestamp ?? 0);
      const parentId     = value.parent_id as string | undefined;

      if (!commentId || !senderId) {
        log.warn('ig_comment_missing_fields', { value });
        continue;
      }

      if (!text) {
        log.info('ig_comment_empty_skipped', { comment_id: commentId });
        continue;
      }

      log.info('ig_comment_received', { comment_id: commentId, sender_id: senderId, post_id: postId });

      // ── Upsert person by instagram_id (IGSID) ───────────────────────────
      const { data: existingPerson } = await supabase
        .from('clients_people')
        .select('id, name')
        .eq('instagram_id', senderId)
        .neq('status', 'merged')
        .maybeSingle();

      let personId: string;

      if (existingPerson) {
        personId = existingPerson.id;
        // Always enrich — keep profile_pic, name, followers up to date (same as DM handler)
        await enrichInstagramProfile(senderId, personId, supabase, log, igbid || undefined);
      } else {
        const newName = senderUser ? `@${senderUser}` : `Instagram ${senderId.slice(-6)}`;
        const insertPayload: Record<string, string> = {
          name: newName,
          instagram_id: senderId,
          status: 'active',
          service_status: 'open',
        };
        if (senderUser) insertPayload.instagram_user_id = senderUser;

        const { data: newPerson, error: insertErr } = await supabase
          .from('clients_people')
          .insert(insertPayload)
          .select('id')
          .single();

        if (insertErr || !newPerson) {
          log.error('ig_comment_person_insert_failed', { error: insertErr?.message, sender_id: senderId });
          continue;
        }

        personId = newPerson.id;
        log.info('ig_comment_person_created', { person_id: personId, sender_id: senderId });

        // Always enrich — fetches real display name, profile_pic, followers from Graph API
        await enrichInstagramProfile(senderId, personId, supabase, log, igbid || undefined);
      }

      // ── Fetch post metadata for preview (best-effort, non-blocking) ─────────
      let postMeta: { post_image_url?: string; post_thumbnail_url?: string; post_permalink?: string; post_caption?: string } | null = null;
      if (postId && igAccessToken) {
        postMeta = await fetchPostMetadata(postId, igAccessToken, log);
      }

      // ── Insert comment as message (deduplicated via ig_message_id unique index) ─
      const { error: msgErr } = await supabase
        .from('messages')
        .insert({
          ig_message_id: commentId,
          channel: 'instagram',
          from_contact: 'cliente',
          source_type: 'inbound',
          content: text,
          message_type: 'comentario',
          instagram_interaction_type: 'comment',
          post_id: postId || null,
          status: 'delivered',
          people_id: personId,
          sent_at: timestampSec > 0 ? new Date(timestampSec * 1000).toISOString() : new Date().toISOString(),
          media_metadata: {
            comment_id: commentId,
            post_id: postId || null,
            ...(parentId ? { parent_comment_id: parentId } : {}),
            ...(postMeta ?? {}),
          },
        });

      if (msgErr) {
        if (msgErr.code === '23505') {
          log.info('ig_comment_duplicate_skipped', { comment_id: commentId });
        } else {
          log.error('ig_comment_insert_failed', { error: msgErr.message, comment_id: commentId });
        }
        continue;
      }

      log.info('ig_comment_stored', { comment_id: commentId, person_id: personId });

      // Bump updated_at so conversation rises to top of Omni list
      supabase.from('clients_people')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', personId)
        .then(() => {}).catch(() => {});

      // Auto-create negócio if operator configured it (non-fatal)
      maybeCreateNegocio(supabase, personId, senderUser ? `@${senderUser}` : `Instagram ${senderId.slice(-6)}`, 'instagram_comment')
        .catch((e) => log.warn('maybe_create_negocio_comment_error', { error: String(e) }));

      // NOTE: Comments must NOT be pushed to message_buffer.
      // The buffer triggers ai-agent-execute which responds via DM — comments and DMs
      // are separate contexts. Comments are handled exclusively by instagram-automation-runner below.

      // Fire-and-forget automation runner (non-blocking)
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/instagram-automation-runner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          trigger_type: 'post_comment',
          person_id: personId,
          person_name: senderUser ? `@${senderUser}` : '',
          ig_message_id: commentId,
          message_text: text,
          comment_id: commentId,
          post_id: postId || undefined,
          ig_user_id: senderId,
          instagram_business_id: igbid,
        }),
      }).catch(() => {});
    }
  }
}

// ── Upsert person by Instagram IGSID ────────────────────────────────────────

async function upsertInstagramPerson(
  igsid: string,
  businessId: string | undefined,
  supabase: ReturnType<typeof createClient>,
  log: ReturnType<typeof createLogger>,
): Promise<string | null> {
  const { data: existingPerson } = await supabase
    .from('clients_people')
    .select('id, name, instagram_id')
    .eq('instagram_id', igsid)
    .neq('status', 'merged')
    .maybeSingle();

  if (existingPerson) {
    const personId = existingPerson.id as string;
    log.info('ig_person_found', { person_id: personId, instagram_id: igsid });

    // Always enrich to keep profile_pic, followers, verified up to date
    await enrichInstagramProfile(igsid, personId, supabase, log, businessId);

    // Update which IGBID received this person's messages (for multi-account routing)
    if (businessId) {
      await supabase
        .from('clients_people')
        .update({ instagram_business_id: businessId })
        .eq('id', personId);
    }
    return personId;
  }

  const { data: newPerson, error: insertErr } = await supabase
    .from('clients_people')
    .insert({
      name: `Instagram ${igsid.slice(-6)}`,
      instagram_id: igsid,
      instagram_business_id: businessId || null,
      status: 'active',
      service_status: 'open',
    })
    .select('id')
    .single();

  if (insertErr || !newPerson) {
    log.error('ig_person_insert_failed', { error: insertErr?.message, sender_id: igsid });
    return null;
  }

  const personId = newPerson.id as string;
  log.info('ig_person_created', { person_id: personId, instagram_id: igsid });

  // Enrich profile — fetch name + @username from Graph API
  await enrichInstagramProfile(igsid, personId, supabase, log, businessId);

  return personId;
}

// ── Echo (mensagem enviada direto do app do Instagram ou via ManyChat) ─────────

/**
 * `is_echo: true` chega tanto pro que o CRM mandou via instagram-outbound (já
 * gravado em `messages` na hora do send — dedup por `ig_message_id` detecta e
 * no-opa) quanto pro que foi enviado direto pelo app do Instagram/Business
 * Suite ou por uma automação externa (ex: ManyChat) usando a mesma conta —
 * precisa ser sincronizado aqui pra o Omni ficar fiel à conversa real.
 * `from_contact='humano'` + `source_type='manual'` — mesmo padrão do
 * `fromMe` do WhatsApp Evolution (evolution-webhook/handleFromMeMessage).
 */
async function handleInstagramEcho(
  event: Record<string, unknown>,
  msgObj: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  log: ReturnType<typeof createLogger>,
): Promise<void> {
  const igMessageId = msgObj.mid as string;
  if (!igMessageId) return; // sem ig_message_id não tem como dedupar com segurança

  const { data: existingMsg } = await supabase
    .from('messages')
    .select('id')
    .eq('ig_message_id', igMessageId)
    .limit(1)
    .maybeSingle();
  if (existingMsg) return; // eco do que o próprio CRM já mandou — já gravado no send

  // No echo, sender = nossa conta, recipient = o cliente.
  const senderId = (event.sender as Record<string, unknown>)?.id as string;
  const recipientId = (event.recipient as Record<string, unknown>)?.id as string;
  const timestampMs = Number(event.timestamp);
  if (!recipientId) return;

  const textContent = (msgObj.text as string) ?? '';
  const attachments = (msgObj.attachments as Record<string, unknown>[]) ?? [];
  let messageType = 'texto';
  let mediaUrl: string | null = null;
  let content = textContent;

  if (attachments.length > 0) {
    const att = attachments[0];
    const attType = att.type as string;
    const attPayload = att.payload as Record<string, unknown>;
    mediaUrl = (attPayload?.url as string) ?? null;
    if (attType === 'image') { messageType = 'imagem'; content = textContent || 'Imagem'; }
    else if (attType === 'video') { messageType = 'video'; content = textContent || 'Vídeo'; }
    else if (attType === 'audio') { messageType = 'audio'; content = textContent || 'Áudio'; }
    else { messageType = 'arquivo'; content = textContent || 'Arquivo'; }
  }

  if (!content && !mediaUrl) return;

  const personId = await upsertInstagramPerson(recipientId, senderId, supabase, log);
  if (!personId) return;

  const { error } = await supabase.from('messages').insert({
    ig_message_id: igMessageId,
    channel: 'instagram',
    content,
    from_contact: 'humano',
    source_type: 'manual',
    message_type: messageType,
    media_url: mediaUrl,
    status: 'sent',
    people_id: personId,
    sent_at: timestampMs ? new Date(timestampMs).toISOString() : new Date().toISOString(),
  } as never);

  if (error) {
    if (error.code === '23505') {
      log.info('ig_echo_duplicate_skipped', { ig_message_id: igMessageId });
    } else {
      log.error('ig_echo_insert_failed', { error: error.message, ig_message_id: igMessageId });
    }
    return;
  }

  log.info('ig_echo_synced', { ig_message_id: igMessageId, person_id: personId });
}

// ── Instagram DM Handler ──────────────────────────────────────────────────────

async function handleInstagramDMs(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  log: ReturnType<typeof createLogger>,
): Promise<void> {
  const entries = (body.entry as Record<string, unknown>[]) ?? [];

  log.info('ig_entries', { count: entries.length, object: body.object });

  for (const entry of entries) {
    // Instagram Graph API sends via changes[] (field: "messages")
    // Messenger Platform sends via messaging[] — support both
    const changes = (entry.changes as Record<string, unknown>[]) ?? [];
    const messagingEvents = (entry.messaging as Record<string, unknown>[]) ?? [];

    // Normalize: extract event objects from either format
    const events: Record<string, unknown>[] = [
      // From changes[]: unwrap value when field === 'messages'
      ...changes
        .filter(c => (c.field as string) === 'messages')
        .map(c => c.value as Record<string, unknown>),
      // From messaging[]: use directly
      ...messagingEvents,
    ];

    log.info('ig_events', { changes_count: changes.length, messaging_count: messagingEvents.length, events_count: events.length });

    for (const event of events) {
      // Only process inbound messages (has message field, no prior_message = not an echo)
      const msgObj = event.message as Record<string, unknown> | undefined;
      if (!msgObj) {
        log.info('ig_event_no_message', { event_keys: Object.keys(event) });
        continue;
      }

      // Echoes (messages sent by the page itself — direct from Instagram app,
      // Business Suite, or a third-party automation like ManyChat) still need
      // to land in the conversation history. See handleInstagramEcho.
      if (msgObj.is_echo) {
        await handleInstagramEcho(event, msgObj, supabase, log);
        continue;
      }

      const igMessageId = msgObj.mid as string;
      const senderId = (event.sender as Record<string, unknown>)?.id as string;
      const recipientId = (event.recipient as Record<string, unknown>)?.id as string;
      const timestampMs = Number(event.timestamp); // already in ms from Meta

      if (!igMessageId || !senderId) {
        log.warn('ig_missing_fields', { event });
        continue;
      }

      const textContent = (msgObj.text as string) ?? '';
      const attachments = (msgObj.attachments as Record<string, unknown>[]) ?? [];

      // Determine message type and media
      let messageType = 'texto';
      let mediaUrl: string | null = null;
      let content = textContent;

      if (attachments.length > 0) {
        const att = attachments[0];
        const attType = att.type as string;
        const attPayload = att.payload as Record<string, unknown>;
        mediaUrl = (attPayload?.url as string) ?? null;

        if (attType === 'image') {
          messageType = 'imagem';
          content = textContent || 'Imagem';
        } else if (attType === 'video') {
          messageType = 'video';
          content = textContent || 'Vídeo';
        } else if (attType === 'audio') {
          messageType = 'audio';
          content = textContent || 'Áudio';
        } else {
          messageType = 'arquivo';
          content = textContent || 'Arquivo';
        }
      }

      if (!content && !mediaUrl) {
        log.warn('ig_empty_message', { ig_message_id: igMessageId, sender_id: senderId });
        continue;
      }

      log.info('ig_dm_received', {
        ig_message_id: igMessageId,
        sender_id: senderId,
        recipient_id: recipientId,
        type: messageType,
      });

      // Store which Instagram Business Account received this person's message.
      // Used by instagram-outbound to pick the correct token for multi-account setups.
      log.info('ig_recipient_id', { recipient_id: recipientId });

      // ── Upsert person by instagram_id (IGSID) ─────────────────────────────
      const personIdOrNull = await upsertInstagramPerson(senderId, recipientId, supabase, log);
      if (!personIdOrNull) continue;
      const personId: string = personIdOrNull;

      // ── Insert message (deduplication via ig_message_id unique index) ──────
      const { error: msgErr } = await supabase
        .from('messages')
        .insert({
          ig_message_id: igMessageId,
          channel: 'instagram',
          from_contact: 'cliente',
          source_type: 'inbound',
          content,
          message_type: messageType,
          media_url: mediaUrl,
          status: 'delivered',
          people_id: personId,
          sent_at: new Date(timestampMs).toISOString(),
        });

      if (msgErr) {
        if (msgErr.code === '23505') {
          log.info('ig_duplicate_skipped', { ig_message_id: igMessageId });
        } else {
          log.error('ig_message_insert_failed', { error: msgErr.message, ig_message_id: igMessageId });
        }
        continue;
      }

      log.info('ig_message_stored', { ig_message_id: igMessageId, person_id: personId });

      // Auto-create negócio if operator configured it (non-fatal)
      maybeCreateNegocio(supabase, personId, `Instagram ${senderId.slice(-6)}`, 'instagram_dm')
        .catch((e) => log.warn('maybe_create_negocio_dm_error', { error: String(e) }));

      // Push to message buffer so pg_cron triggers ai-agent-execute (non-fatal)
      pushToBuffer(supabase, personId, { content: textContent, ig_message_id: igMessageId }, 'instagram')
        .catch((e) => log.warn('push_to_buffer_dm_error', { error: String(e) }));

      // Fire-and-forget automation runner (non-blocking)
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/instagram-automation-runner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          trigger_type: 'incoming_dm',
          person_id: personId,
          person_name: '',
          ig_message_id: igMessageId,
          message_text: textContent,
          ig_user_id: senderId,
          instagram_business_id: recipientId ?? '',
        }),
      }).catch(() => {});
    }
  }
}

// ── Leadgen Handler ─────────────────────────────────────────────────────────

const META_GRAPH_V23 = 'https://graph.facebook.com/v25.0';

async function handleLeadgen(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  log: ReturnType<typeof createLogger>,
): Promise<void> {
  const entries = (body.entry as Record<string, unknown>[]) ?? [];

  for (const entry of entries) {
    const changes = (entry.changes as Record<string, unknown>[]) ?? [];
    const leadgenChanges = changes.filter(c => (c.field as string) === 'leadgen');

    if (leadgenChanges.length === 0) continue;

    for (const change of leadgenChanges) {
      const value = change.value as Record<string, unknown>;
      if (!value) continue;

      const leadgenId = value.leadgen_id as string;
      const metaFormId = value.form_id as string;
      const pageId = value.page_id as string;
      const adgroupId = (value.adgroup_id as string) || null;

      if (!leadgenId || !metaFormId) {
        log.warn('leadgen_missing_fields', { value });
        continue;
      }

      log.info('leadgen_received', { leadgen_id: leadgenId, form_id: metaFormId, page_id: pageId });

      // ── Deduplication: skip if already processed ──────────────────────────
      const { data: existingSub } = await supabase
        .from('form_pro_submissions')
        .select('id')
        .eq('meta_leadgen_id', leadgenId)
        .maybeSingle();

      if (existingSub) {
        log.info('leadgen_duplicate_skipped', { leadgen_id: leadgenId, existing_id: existingSub.id });
        continue;
      }

      // ── Lookup meta_lead_forms by meta_form_id ──────────────────────────
      const { data: metaForm, error: formErr } = await supabase
        .from('meta_lead_forms')
        .select('id, page_id, name, field_mapping, settings, pipeline_id')
        .eq('meta_form_id', metaFormId)
        .maybeSingle();

      if (formErr || !metaForm) {
        log.warn('leadgen_form_not_managed', { meta_form_id: metaFormId, error: formErr?.message });
        continue;
      }

      // ── Fetch page token ────────────────────────────────────────────────
      const { data: page } = await supabase
        .from('meta_lead_form_pages')
        .select('access_token')
        .eq('page_id', metaForm.page_id)
        .single();

      if (!page?.access_token) {
        log.error('leadgen_no_page_token', { page_id: metaForm.page_id });
        continue;
      }

      // ── Fetch lead data from Meta Graph API ─────────────────────────────
      let fieldData: Array<{ name: string; values: string[] }> = [];
      let createdTime = '';

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const resp = await fetch(
            `${META_GRAPH_V23}/${leadgenId}?fields=id,field_data,created_time&access_token=${page.access_token}`,
          );
          if (!resp.ok) {
            const errBody = await resp.text();
            log.warn('leadgen_fetch_failed', { leadgen_id: leadgenId, status: resp.status, body: errBody, attempt });
            if (attempt === 0) continue;
            break;
          }
          const leadData = await resp.json() as Record<string, unknown>;
          fieldData = (leadData.field_data as Array<{ name: string; values: string[] }>) ?? [];
          createdTime = (leadData.created_time as string) ?? '';
          break;
        } catch (e) {
          log.warn('leadgen_fetch_exception', { leadgen_id: leadgenId, error: String(e), attempt });
          if (attempt === 1) break;
        }
      }

      if (fieldData.length === 0) {
        log.error('leadgen_no_field_data', { leadgen_id: leadgenId });
        continue;
      }

      // ── Map field_data → CRM namespace fields ──────────────────────────
      const fieldMapping = (metaForm.field_mapping ?? []) as Array<{
        crm_field: string;
        meta_field: string;
        meta_type: string;
        label: string;
        options_mapping?: Record<string, string>;
      }>;

      // Build meta_field name → { crm_field, options_mapping }
      const metaTocrm = new Map<string, { crm_field: string; options_mapping?: Record<string, string> }>();
      for (const fm of fieldMapping) {
        metaTocrm.set(fm.meta_field.toLowerCase(), {
          crm_field: fm.crm_field,
          options_mapping: fm.options_mapping,
        });
      }

      const crmData: Record<string, string> = {};
      for (const fd of fieldData) {
        const mapping = metaTocrm.get(fd.name.toLowerCase());
        if (mapping?.crm_field && fd.values?.[0]) {
          const rawValue = fd.values[0];
          // If options_mapping exists (score fields), resolve Meta option → score item UUID
          // Meta may return values with underscores/lowercase, so normalize for matching
          let resolvedValue = rawValue;
          if (mapping.options_mapping) {
            const normalise = (s: string) => s.toLowerCase().replace(/[\s_]+/g, '_');
            const normRaw = normalise(rawValue);
            for (const [optKey, itemId] of Object.entries(mapping.options_mapping)) {
              if (normalise(optKey) === normRaw) {
                resolvedValue = itemId;
                break;
              }
            }
          }
          crmData[mapping.crm_field] = resolvedValue;
        }
      }

      log.info('leadgen_mapped', { leadgen_id: leadgenId, crm_fields: Object.keys(crmData) });

      // ── Process CRM data (upsert person, company, score, lead) ─────────
      const formSettings = (metaForm.settings ?? {}) as Record<string, unknown>;
      const result = await processCrmData(
        supabase,
        crmData,
        {
          pipelineId: metaForm.pipeline_id ?? null,
          configuredStageId: (formSettings.initial_stage_id as string) ?? null,
          formName: metaForm.name,
          source: `meta_lead_ads:${metaForm.name}`,
        },
        log,
      );

      log.info('leadgen_crm_processed', {
        leadgen_id: leadgenId,
        person_id: result.personId,
        lead_id: result.leadId,
        is_existing: result.isExistingLead,
      });

      // ── Propagate Meta Lead ID + source for conversion tracking ───────
      if (result.leadId) {
        await supabase
          .from('leads')
          .update({
            fb_lead_id: leadgenId,
            lead_source: 'meta_lead_ad',
          })
          .eq('id', result.leadId);
      }

      // ── Register submission ─────────────────────────────────────────────
      const submissionData: Record<string, string> = {
        ...crmData,
        _source: 'meta',
        _leadgen_id: leadgenId,
        _created_time: createdTime,
      };

      let submissionId: string | null = null;
      {
        const { data: sub, error: subErr } = await supabase
          .from('form_pro_submissions')
          .insert({
            form_id: null,
            meta_form_id: metaForm.id,
            page_id: null,
            source: 'meta',
            data: submissionData,
            lead_id: result.leadId ?? undefined,
            people_id: result.personId ?? undefined,
            ip_address: null,
            // Dedicated columns for conversion tracking
            meta_leadgen_id: leadgenId,
            meta_adgroup_id: adgroupId,
          })
          .select('id')
          .single();
        if (subErr) {
          log.error('leadgen_submission_insert_failed', { error: subErr.message });
        } else {
          submissionId = sub?.id ?? null;
        }
      }

      // ── Post-submit actions ─────────────────────────────────────────────
      const settings = (metaForm.settings ?? {}) as Record<string, unknown>;
      const postActions = (settings.post_submit_actions ?? []) as Array<{
        id: string;
        enabled: boolean;
        channel: string;
        delay_minutes: number;
        wa_channel_id?: string;
        wa_template_id?: string;
        wa_variable_map?: Record<string, string>;
      }>;

      const enabledActions = postActions.filter(a => a.enabled);

      if (enabledActions.length > 0 && result.personId) {
        // Resolve field specs — simplified for Meta leads (we have crmData)
        const resolveSpec = (spec: string): string => {
          if (!spec) return '';
          if (spec.startsWith('fixed:')) return spec.slice(6);
          if (spec.startsWith('field:')) {
            const ref = spec.slice(6);
            return crmData[ref] ?? '';
          }
          return '';
        };

        for (const action of enabledActions) {
          try {
            if (action.channel === 'whatsapp' && action.wa_channel_id && action.wa_template_id) {
              const whatsapp = crmData['pessoa.whatsapp'];
              if (!whatsapp) {
                log.warn('leadgen_post_wa_no_phone', { actionId: action.id });
                continue;
              }

              const { data: channel } = await supabase
                .from('settings_whatsapp_channels')
                .select('phone_number_id')
                .eq('id', action.wa_channel_id)
                .single();

              if (!channel?.phone_number_id) continue;

              const { data: waTemplate } = await supabase
                .from('whatsapp_templates')
                .select('name, json_data')
                .eq('id', action.wa_template_id)
                .maybeSingle();

              const resolvedValues: string[] = Object.keys(action.wa_variable_map ?? {})
                .sort((a, b) => Number(a) - Number(b))
                .map(idx => resolveSpec((action.wa_variable_map ?? {})[idx]) || ' ');

              await supabase.from('messages').insert({
                people_id: result.personId,
                lead_id: result.leadId ?? undefined,
                channel: 'whatsapp',
                from_contact: 'sistema',
                source_type: 'form',
                status: 'pending',
                content: `[Template: ${waTemplate?.name ?? action.wa_template_id}]`,
                whatsapp_template_id: action.wa_template_id,
                wa_phone_number_id: channel.phone_number_id,
                module_ref_id: submissionId ?? undefined,
                metadata: {
                  template_name: waTemplate?.name ?? '',
                  language_code: 'pt_BR',
                  variable_map: action.wa_variable_map ?? {},
                  resolved_values: resolvedValues,
                  delay_minutes: action.delay_minutes ?? 0,
                },
                sent_at: new Date().toISOString(),
              });

              log.info('leadgen_post_wa_created', { templateId: action.wa_template_id });

              // Trigger delivery engine for zero-delay messages
              if (!action.delay_minutes) {
                const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
                const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
                fetch(`${supabaseUrl}/functions/v1/omni-delivery-engine`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${serviceKey}`,
                  },
                  body: JSON.stringify({ trigger: 'form', people_id: result.personId, channel: 'whatsapp' }),
                }).catch(() => {});
              }
            }
          } catch (e) {
            log.error('leadgen_post_action_error', { actionId: action.id, error: String(e) });
          }
        }
      }

      log.info('leadgen_processed', {
        leadgen_id: leadgenId,
        form_name: metaForm.name,
        person_id: result.personId,
        lead_id: result.leadId,
        submission_id: submissionId,
      });
    }
  }
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const verifyToken = Deno.env.get('INSTAGRAM_VERIFY_TOKEN') ?? 'growthsales_meta_verify';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const log = createLogger('meta-inbound');

  // ── GET: webhook verification handshake ────────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === verifyToken) {
      log.info('webhook_verified');
      return new Response(challenge ?? '', { status: 200 });
    }

    log.warn('webhook_verify_failed', { mode, token_match: token === verifyToken });
    return new Response('Forbidden', { status: 403 });
  }

  // ── POST: event dispatch ───────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const rawBody = await req.text();

  // Echo messages (is_echo: true) — sent-message confirmations from Meta — now
  // flow through the same signature verification as any other event (fallback
  // chain below tries all known app secrets) and get synced into the
  // conversation history by handleInstagramEcho, instead of being discarded.

  // Verify HMAC signature — resolve app_secret with fallback chain:
  //   1. omni_channel_configs.credentials.app_secret (DB — set by instagram-oauth)
  //   2. INSTAGRAM_APP_SECRET env var (Supabase secrets)
  //   3. bi_settings.meta_app_secret (DB — same Meta App used for BI)
  const signature = req.headers.get('x-hub-signature-256');
  if (!signature) {
    log.warn('signature_missing', { method: 'POST' });
    return new Response('Unauthorized — missing X-Hub-Signature-256', { status: 401 });
  }

  try {
    const supabaseForSecret = createClient(supabaseUrl, serviceRoleKey);

    // Source 1: omni_channel_configs credentials
    const { data: igConfig } = await supabaseForSecret
      .from('omni_channel_configs')
      .select('credentials')
      .eq('channel', 'instagram')
      .single();
    let appSecret = (igConfig?.credentials as Record<string, string>)?.app_secret ?? '';

    // Source 2: env var fallback
    if (!appSecret) {
      appSecret = Deno.env.get('INSTAGRAM_APP_SECRET') ?? '';
    }

    // Source 3: bi_settings fallback (same Meta App)
    if (!appSecret) {
      const { data: biSettings } = await supabaseForSecret
        .from('bi_settings')
        .select('meta_app_secret')
        .single();
      appSecret = (biSettings?.meta_app_secret as string) ?? '';
      if (appSecret) {
        log.info('signature_secret_from_bi_settings');
      }
    }

    if (!appSecret) {
      log.error('signature_no_app_secret', { channel: 'instagram', sources: 'omni_config,env,bi_settings' });
      return new Response('Unauthorized — app_secret not configured', { status: 401 });
    }
    const valid = await verifyMetaSignature(rawBody, signature, appSecret);
    // Some Meta events arrive with a trailing newline included in the HMAC.
    const validTrimmed = !valid && await verifyMetaSignature(rawBody.trimEnd(), signature, appSecret);
    if (!valid && !validTrimmed) {
      log.warn('signature_invalid', { body_len: rawBody.length });
      return new Response('Unauthorized', { status: 401 });
    }
  } catch (e) {
    log.error('signature_check_failed', { error: String(e) });
    return new Response('Unauthorized — signature verification failed', { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const object = body.object as string;
  log.info('event_received', { object });

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (object === 'instagram') {
      // Run handlers independently — one failure must NOT block others
      const results = await Promise.allSettled([
        handleInstagramDMs(body, supabase, log),
        handleInstagramComments(body, supabase, log),
      ]);
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          log.error('handler_failed', { handler: ['ig_dms', 'ig_comments'][i], error: String(r.reason) });
        }
      });
    } else if (object === 'page') {
      // 'page' object can carry Instagram DMs, comments, AND leadgen events
      // Run ALL handlers independently — one failure must NOT block others
      log.info('page_object_received', { note: 'Routing to all page handlers (isolated)' });
      const results = await Promise.allSettled([
        handleInstagramDMs(body, supabase, log),
        handleInstagramComments(body, supabase, log),
        handleLeadgen(body, supabase, log),
      ]);
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          log.error('handler_failed', { handler: ['ig_dms', 'ig_comments', 'leadgen'][i], error: String(r.reason) });
        }
      });
    } else if (object === 'leadgen') {
      // Meta Lead Ads — standalone leadgen object (rare, but documented by Meta)
      await handleLeadgen(body, supabase, log);
    } else {
      log.warn('unknown_object', { object });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('unhandled', { error: errMsg });
    // Always return 200 to Meta — otherwise they retry forever
    return new Response(JSON.stringify({ ok: false, error: errMsg }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
