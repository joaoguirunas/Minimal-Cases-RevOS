/**
 * EVOLUTION WEBHOOK — WhatsApp não-oficial (Evolution API v2.3.7, self-hosted)
 *
 * ⚠️  DEPLOY: sempre `--no-verify-jwt`
 *     supabase functions deploy evolution-webhook --no-verify-jwt
 *     (config.toml: verify_jwt=false; Evolution não envia JWT).
 *
 * Recebe eventos do Evolution API e alimenta o MESMO pipeline OMNI já usado
 * pelo `whatsapp-inbound` (Meta) — upsert de pessoa, INSERT em messages,
 * message_buffer → ai-agent-execute — sem duplicar a lógica de negócio, só a
 * camada de transporte (envelope + auth diferentes do Meta).
 *
 * Integração TENANT-WIDE: sem owner_user_id, sem "canal por usuário" — mas
 * MÚLTIPLOS canais provider='evolution' podem coexistir em
 * settings_whatsapp_channels (cada um = um número/servidor distinto),
 * compartilhados por todo o CRM. Cada canal Evolution tem sua própria URL de
 * webhook (`/evolution-webhook/{seu_token}`) — o token identifica QUAL canal
 * o evento pertence, já que não há mais garantia de linha única.
 *
 * ── Auth (Evolution v2.3.7 NÃO assina o body — sem HMAC) ─────────────────────
 * Defesa em 3 camadas, qualquer falha → 401 + ZERO row gravada:
 *   (a) token em header `authorization: Bearer {evolution_webhook_token}`,
 *       validado constant-time por `verifyEvolutionWebhookAuth` (contra o canal
 *       já resolvido pelo lookup abaixo).
 *   (b) path-secreto `/evolution-webhook/{secret}` — o próprio
 *       evolution_webhook_token do canal, reusado como secret de path (sem 2º
 *       segredo) E como chave de lookup de qual canal é esse evento.
 *   (c) instance-exists: `envelope.instance` precisa casar com
 *       `evolution_instance_name` do canal já resolvido pelo token.
 *
 * ── Envelope Evolution ({ event, instance, data }, eventos lowercase.dotted) ──
 *   - messages.upsert   → inbound cliente (fromMe=false) | eco (fromMe=true, skip)
 *   - messages.update   → ACK de status, STRING (SERVER_ACK/DELIVERY_ACK/READ/PLAYED)
 *   - connection.update → status da sessão (open/connecting/close → canônico)
 *   - qrcode.updated    → QR novo (best-effort, só loga — o fluxo principal de
 *                         pareamento é via evolution-session-manage.connect())
 *
 * Escopo v1: mensagens de texto tratadas integralmente. Mídia (áudio/imagem/
 * documento) grava um placeholder — sem download/transcrição/análise ainda
 * (esse pipeline existe só pro Meta em whatsapp-inbound; portar é follow-up).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import { verifyEvolutionWebhookAuth, toCanonicalStatus, type EvolutionConnectionState } from '../_shared/evolution-client.ts';
import {
  buildStatusUpdate,
  extractMessageText,
  extractRemoteJidPhone,
  isGroupOrBroadcastJid,
  mapAckStatus,
  resolveMediaInfo,
  shouldAdvanceStatus,
  shouldSyncFromMeMessage,
  type EvoMessageUpsertData,
} from '../_shared/evolution-inbound-lib.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface EvolutionEnvelope {
  event: string;
  instance?: string;
  data?: Record<string, unknown>;
}

/**
 * Sobe o base64 já decriptado que a Evolution manda (webhookBase64:true) pro
 * bucket `omni-media` — mesma convenção de path do whatsapp-inbound (Meta),
 * mas sem precisar de download (Evolution já entrega os bytes prontos, ao
 * contrário do Meta que exige buscar uma URL assinada). Retorna `null` em
 * qualquer falha — nunca bloqueia o salvamento da mensagem em si.
 */
async function uploadEvolutionMedia(
  // deno-lint-ignore no-explicit-any
  supabase: any, // ReturnType<typeof createClient> mismatches its own call-site type here (pre-existing quirk, see recordDeliveryAttempt in whatsapp-outbound)
  base64: string,
  mimetype: string,
  fileName: string,
  phone: string,
): Promise<{ url: string; fileSize: number } | null> {
  try {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const ext = fileName.includes('.') ? fileName.split('.').pop()! : (mimetype.split('/')[1]?.split(';')[0] ?? 'bin');
    const path = `inbound/${new Date().toISOString().split('T')[0]}/${Date.now()}-${phone}-evo.${ext}`;

    const { error } = await supabase.storage
      .from('omni-media')
      .upload(path, bytes.buffer, { contentType: mimetype, cacheControl: '3600', upsert: false });

    if (error) {
      console.error('evolution-webhook: omni-media upload error:', error.message);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage.from('omni-media').getPublicUrl(path);
    return { url: publicUrl, fileSize: bytes.byteLength };
  } catch (err) {
    console.error('evolution-webhook: omni-media upload exception:', (err as Error).message);
    return null;
  }
}

async function deletePersonData(supabase: ReturnType<typeof createClient>, personId: string): Promise<void> {
  await supabase.from('messages').delete().eq('people_id', personId);
  await supabase.from('leads').delete().eq('people_id', personId);
  await supabase.from('clients_people').delete().eq('id', personId);
}

async function upsertPerson(
  supabase: ReturnType<typeof createClient>,
  phone: string,
  name: string,
): Promise<{ id: string; ai_enabled: boolean }> {
  const { data: allByPhone } = await supabase
    .from('clients_people')
    .select('id, ai_enabled, merged_into_id, status')
    .eq('whatsapp', phone)
    .order('created_at', { ascending: true }) as unknown as { data: Array<{ id: string; ai_enabled: boolean; merged_into_id: string | null; status: string }> | null };

  if (allByPhone && allByPhone.length > 0) {
    const active = allByPhone.find(p => p.status !== 'merged');
    const record = active ?? allByPhone[0];

    if (record.status === 'merged' && record.merged_into_id) {
      const { data: canonical } = await supabase
        .from('clients_people')
        .select('id, ai_enabled')
        .eq('id', record.merged_into_id)
        .single() as unknown as { data: { id: string; ai_enabled: boolean } | null };
      if (canonical) return canonical;
    }

    if (record.status === 'merged' && !record.merged_into_id) {
      await supabase.from('clients_people').update({ status: 'active' }).eq('id', record.id);
      return { id: record.id, ai_enabled: record.ai_enabled };
    }

    return record;
  }

  const { data: created, error } = await supabase
    .from('clients_people')
    .insert({ name, whatsapp: phone, ai_enabled: true, status: 'active' })
    .select('id, ai_enabled')
    .single() as unknown as { data: { id: string; ai_enabled: boolean } | null; error: any };

  if (error) throw new Error(`upsertPerson: ${error.message}`);
  if (!created) throw new Error('upsertPerson: no data returned');

  const { data: postMerge } = await supabase
    .from('clients_people')
    .select('id, ai_enabled, merged_into_id, status')
    .eq('id', created.id)
    .single() as unknown as { data: { id: string; ai_enabled: boolean; merged_into_id: string | null; status: string } | null };

  if (postMerge?.status === 'merged' && postMerge.merged_into_id) {
    const { data: canonical } = await supabase
      .from('clients_people')
      .select('id, ai_enabled')
      .eq('id', postMerge.merged_into_id)
      .single() as unknown as { data: { id: string; ai_enabled: boolean } | null };
    if (canonical) return canonical;
  }

  return created;
}

async function maybeCreateNegocio(
  supabase: ReturnType<typeof createClient>,
  peopleId: string,
  phone: string,
  name: string,
): Promise<void> {
  const { data: config } = await supabase
    .from('settings_omni_new_contact')
    .select('auto_create_negocio, pipeline_id, stage_id, title_template')
    .eq('channel', 'whatsapp')
    .maybeSingle();

  if (!config?.auto_create_negocio || !config.pipeline_id || !config.stage_id) return;

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
    .replace('{{nome}}', name || phone)
    .replace('{{telefone}}', phone);

  const { error } = await supabase.from('leads').insert({
    title,
    people_id: peopleId,
    leads_pipelines_id: config.pipeline_id,
    leads_stages_id: config.stage_id,
    status: 'in_progress',
  });

  if (error) console.error('evolution-webhook: maybeCreateNegocio failed:', error.message);
}

async function maybeHandleFirstReply(
  supabase: ReturnType<typeof createClient>,
  peopleId: string,
  phone: string,
  name: string,
): Promise<void> {
  const { data: config } = await supabase
    .from('settings_omni_new_contact')
    .select('on_first_reply_enabled, on_first_reply_stage_id, pipeline_id, title_template')
    .eq('channel', 'whatsapp')
    .maybeSingle();

  if (!config?.on_first_reply_enabled || !config.on_first_reply_stage_id) return;

  const { data: lead } = await supabase
    .from('leads')
    .select('id, first_inbound_at')
    .eq('people_id', peopleId)
    .neq('status', 'lost')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lead?.first_inbound_at) return;

  if (!lead) {
    if (!config.pipeline_id) return;
    const title = (config.title_template || 'Nova conversa - {{nome}}')
      .replace('{{nome}}', name || phone)
      .replace('{{telefone}}', phone);

    await supabase.from('leads').insert({
      title,
      people_id: peopleId,
      leads_pipelines_id: config.pipeline_id,
      leads_stages_id: config.on_first_reply_stage_id,
      first_inbound_at: new Date().toISOString(),
      status: 'in_progress',
    });
    return;
  }

  await supabase
    .from('leads')
    .update({
      leads_stages_id: config.on_first_reply_stage_id,
      first_inbound_at: new Date().toISOString(),
    })
    .eq('id', lead.id)
    .is('first_inbound_at', null);
}

async function pushToBuffer(
  supabase: ReturnType<typeof createClient>,
  personId: string,
  messageEntry: object,
  bufferMs: number,
  channelId: string,
): Promise<void> {
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
    }).eq('id', existing.id);
  } else {
    await supabase.from('message_buffer').insert({
      people_id: personId,
      messages: [messageEntry],
      expires_at: expiresAt,
      // Canal Evolution reusa a MESMA coluna que o Meta usa pra "qual telefone/canal
      // recebeu isso" — aqui vai o id (uuid) do canal, não um phone_number_id real.
      // whatsapp-outbound já sabe tratar os dois formatos (ver CHANNEL_SELECT ali).
      wa_phone_number_id: channelId,
    });
  }

  const now = new Date().toISOString();
  await supabase.from('clients_people').update({
    ai_last_message_at: now,
    updated_at: now,
  }).eq('id', personId);
}

// ── ACK de status (messages.update) — string, não numérico ──────────────────

async function handleMessageUpdate(supabase: ReturnType<typeof createClient>, data: Record<string, unknown>): Promise<void> {
  try {
    const keyId = (data.keyId as string) ?? (data.key as { id?: string } | undefined)?.id;
    const rawStatus = String(data.status ?? '');
    if (!keyId || !rawStatus) return;

    const incomingStatus = mapAckStatus(rawStatus);
    if (!incomingStatus) return; // PENDING e outros → ignora

    const { data: row } = await supabase
      .from('messages')
      .select('id, status, delivered_at')
      .eq('wa_message_id', keyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as unknown as { data: { id: number; status: string; delivered_at: string | null } | null };

    if (!row || !shouldAdvanceStatus(row.status, incomingStatus)) return;

    const update = buildStatusUpdate(incomingStatus, !!row.delivered_at, new Date().toISOString());

    await supabase.from('messages').update(update).eq('id', row.id).eq('status', row.status);
  } catch (err) {
    console.error('evolution-webhook: handleMessageUpdate error:', (err as Error).message);
  }
}

// ── fromMe (eco do CRM ou envio direto do celular pareado) ───────────────────

/**
 * `fromMe=true` chega tanto pro que o CRM mandou via `sendText`/`sendMedia`/
 * `sendAudio` (já gravado em `messages` na hora do send — dedup por
 * `wa_message_id` detecta e no-opa) quanto pro que o humano mandou direto do
 * WhatsApp do celular, fora do CRM — que precisa ser sincronizado aqui pra o
 * Omni ficar fiel à conversa real. `from_contact='humano'` + `source_type='manual'`
 * já aciona de graça `trg_auto_pause_ai_on_human_message` (pausa a IA) e
 * `trg_sync_active_channel` (atualiza o canal atual do lead).
 */
async function handleFromMeMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, // ReturnType<typeof createClient> mismatches its own call-site type here (pre-existing quirk, see recordDeliveryAttempt in whatsapp-outbound)
  log: ReturnType<typeof createLogger>,
  channelConfig: { id: string },
  envelope: EvolutionEnvelope,
  msgData: EvoMessageUpsertData,
): Promise<void> {
  try {
    const key = msgData.key;
    if (!key?.id) return; // sem wa_message_id não tem como dedupar com segurança

    const { data: existingMsg } = await supabase
      .from('messages')
      .select('id')
      .eq('wa_message_id', key.id)
      .limit(1)
      .maybeSingle();
    if (existingMsg) return; // eco do que o próprio CRM já mandou — já gravado no send

    const phone = extractRemoteJidPhone(key.remoteJid);
    if (!phone) return;
    const name = msgData.pushName || phone;

    const { text: rawText, msgType } = extractMessageText(msgData);
    const content = rawText.trim() ? rawText : '[Mensagem sem texto]';

    const person = await upsertPerson(supabase, phone, name);

    const mediaInfo = resolveMediaInfo(msgData);
    let mediaUrl: string | null = null;
    let mediaMetadata: { file_name: string; mime_type: string; file_size: number } | null = null;
    if (mediaInfo && msgData.message?.base64) {
      const uploaded = await uploadEvolutionMedia(supabase, msgData.message.base64, mediaInfo.mimetype, mediaInfo.fileName, phone);
      if (uploaded) {
        mediaUrl = uploaded.url;
        mediaMetadata = { file_name: mediaInfo.fileName, mime_type: mediaInfo.mimetype, file_size: uploaded.fileSize };
      }
    }

    const { error } = await supabase.from('messages').insert({
      people_id: person.id,
      channel: 'whatsapp',
      content,
      from_contact: 'humano',
      source_type: 'manual',
      message_type: msgType,
      status: 'sent',
      wa_message_id: key.id,
      wa_phone_number_id: channelConfig.id,
      media_url: mediaUrl,
      media_metadata: mediaMetadata,
      metadata: {
        evolution_instance: envelope.instance,
        evolution_remote_jid: key.remoteJid,
        evolution_phone_native_send: true,
      },
    });

    if (error) {
      console.error('evolution-webhook: fromMe phone-native INSERT error:', error.message);
    } else {
      log.info('phone_native_message_synced', { person_id: person.id, phone });
    }
  } catch (err) {
    console.error('evolution-webhook: handleFromMeMessage error:', (err as Error).message);
  }
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const log = createLogger('evolution-webhook');

  try {
    // ── (a) token do header ──────────────────────────────────────────────────
    // ── (b) path-secreto: /evolution-webhook/{secret} (opcional, mesmo token) ─
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const pathSecret = pathParts[pathParts.length - 1] === 'evolution-webhook' ? null : pathParts[pathParts.length - 1];
    const headerToken = req.headers.get('authorization');
    const bearerToken = headerToken?.startsWith('Bearer ') ? headerToken.slice(7) : headerToken;

    // Múltiplos canais Evolution podem coexistir — cada um tem seu próprio
    // evolution_webhook_token (gerado no setup), que também serve de chave pra
    // resolver A QUAL canal esse evento pertence. Prefere o path-secret (sempre
    // presente — configurado em /webhook/set); cai pro header se o path não tiver.
    const lookupToken = pathSecret || bearerToken;
    if (!lookupToken) {
      log.warn('auth_failed', { reason: 'no_token' });
      return new Response('Unauthorized', { status: 401 });
    }

    const { data: channelConfig } = await supabase
      .from('settings_whatsapp_channels')
      .select('id, evolution_webhook_token, evolution_instance_name, active')
      .eq('provider', 'evolution')
      .eq('evolution_webhook_token', lookupToken)
      .maybeSingle() as unknown as {
        data: { id: string; evolution_webhook_token: string; evolution_instance_name: string; active: boolean } | null;
      };

    if (!channelConfig || !channelConfig.active) {
      log.warn('auth_failed', { reason: 'channel_not_found_for_token' });
      return new Response('Unauthorized', { status: 401 });
    }

    // Confirma os DOIS fatores contra o canal já resolvido pelo token — mesma
    // defesa em profundidade de antes, agora escopada ao canal certo.
    const authOk = verifyEvolutionWebhookAuth({ headerToken, expectedToken: channelConfig.evolution_webhook_token });
    if (!authOk) {
      log.warn('auth_failed', { reason: 'invalid_token' });
      return new Response('Unauthorized', { status: 401 });
    }
    if (pathSecret && pathSecret !== channelConfig.evolution_webhook_token) {
      log.warn('auth_failed', { reason: 'path_secret_mismatch' });
      return new Response('Unauthorized', { status: 401 });
    }

    const envelope = await req.json() as EvolutionEnvelope;

    // ── (c) instance-exists — sanity check extra contra o canal já resolvido ──
    if (!envelope.instance || envelope.instance !== channelConfig.evolution_instance_name) {
      log.warn('auth_failed', { reason: 'unknown_instance', instance: envelope.instance });
      return new Response('Unauthorized', { status: 401 });
    }

    const eventLower = (envelope.event ?? '').toLowerCase();
    const data = envelope.data ?? {};

    // ── connection.update ─────────────────────────────────────────────────────
    if (eventLower === 'connection.update') {
      const state = (data.state as EvolutionConnectionState | string | undefined) ?? null;
      const canonical = toCanonicalStatus(state);
      await supabase
        .from('settings_whatsapp_channels')
        .update({ evolution_status: canonical, evolution_last_seen_at: new Date().toISOString() })
        .eq('id', channelConfig.id);
      log.info('connection_update', { state, canonical });
      return new Response('OK', { status: 200 });
    }

    // ── qrcode.updated — best-effort, o fluxo principal é evolution-session-manage ──
    if (eventLower === 'qrcode.updated') {
      await supabase
        .from('settings_whatsapp_channels')
        .update({ evolution_status: 'SCAN_QR_CODE', evolution_last_seen_at: new Date().toISOString() })
        .eq('id', channelConfig.id);
      return new Response('OK', { status: 200 });
    }

    // ── messages.update — ACK de status ──────────────────────────────────────
    if (eventLower === 'messages.update') {
      await handleMessageUpdate(supabase, data);
      return new Response('OK', { status: 200 });
    }

    // ── messages.delete — fora de escopo v1, no-op ───────────────────────────
    if (eventLower === 'messages.delete') {
      return new Response('OK', { status: 200 });
    }

    // ── messages.upsert — inbound de cliente ─────────────────────────────────
    if (eventLower !== 'messages.upsert') {
      return new Response('OK', { status: 200 }); // evento fora da lista processada
    }

    const msgData = data as unknown as EvoMessageUpsertData;
    const key = msgData.key;

    // Eco da própria instância — ou é o que o CRM já mandou (dedup no-opa) ou foi
    // mandado direto do celular pareado, fora do CRM (sincroniza). Grupo/broadcast
    // nunca sincroniza mesmo sendo fromMe.
    if (key?.fromMe) {
      if (shouldSyncFromMeMessage(true, key?.remoteJid)) {
        await handleFromMeMessage(supabase, log, channelConfig, envelope, msgData);
      }
      return new Response('OK', { status: 200 });
    }

    if (isGroupOrBroadcastJid(key?.remoteJid)) {
      return new Response('OK', { status: 200 }); // grupo/broadcast — fora de escopo
    }

    const phone = extractRemoteJidPhone(key?.remoteJid);
    if (!phone) {
      log.warn('missing_remote_jid', {});
      return new Response('OK', { status: 200 });
    }
    const name = msgData.pushName || phone;

    // Dedup: Evolution não manda request-id — chave sintética é o wa_message_id (key.id).
    if (key?.id) {
      const { data: existingMsg } = await supabase
        .from('messages')
        .select('id')
        .eq('wa_message_id', key.id)
        .limit(1)
        .maybeSingle();
      if (existingMsg) {
        return new Response('OK', { status: 200 });
      }
    }

    // Comando de exclusão (mesma convenção do Meta)
    const { text: rawText, msgType } = extractMessageText(msgData);
    if (rawText.trim() === '#apagar#') {
      const { data: person } = await supabase
        .from('clients_people')
        .select('id')
        .eq('whatsapp', phone)
        .maybeSingle();
      if (person) await deletePersonData(supabase, person.id);
      return new Response('OK', { status: 200 });
    }

    const content = rawText.trim() ? rawText : '[Mensagem sem texto]';

    let person: { id: string; ai_enabled: boolean };
    try {
      person = await upsertPerson(supabase, phone, name);
    } catch (err) {
      console.error('evolution-webhook: upsertPerson error:', (err as Error).message);
      return new Response('Internal Server Error', { status: 500 });
    }

    try {
      await maybeCreateNegocio(supabase, person.id, phone, name);
    } catch (err) {
      console.error('evolution-webhook: maybeCreateNegocio error (non-fatal):', (err as Error).message);
    }

    try {
      await maybeHandleFirstReply(supabase, person.id, phone, name);
    } catch (err) {
      console.error('evolution-webhook: maybeHandleFirstReply error (non-fatal):', (err as Error).message);
    }

    let activeLeadId: string | null = null;
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
      activeLeadId = activeLead?.id ?? null;
    } catch { /* non-fatal */ }

    const mediaInfo = resolveMediaInfo(msgData);
    let mediaUrl: string | null = null;
    let mediaMetadata: { file_name: string; mime_type: string; file_size: number } | null = null;
    if (mediaInfo && msgData.message?.base64) {
      const uploaded = await uploadEvolutionMedia(supabase, msgData.message.base64, mediaInfo.mimetype, mediaInfo.fileName, phone);
      if (uploaded) {
        mediaUrl = uploaded.url;
        mediaMetadata = { file_name: mediaInfo.fileName, mime_type: mediaInfo.mimetype, file_size: uploaded.fileSize };
      }
    }

    const { error: msgInsertError } = await supabase.from('messages').insert({
      people_id: person.id,
      lead_id: activeLeadId,
      channel: 'whatsapp',
      content,
      from_contact: 'cliente',
      source_type: 'inbound',
      message_type: msgType,
      status: 'delivered',
      wa_message_id: key?.id ?? null,
      // Reusa a mesma coluna do Meta, guardando o id (uuid) do canal Evolution —
      // ver comentário em pushToBuffer / CHANNEL_SELECT em whatsapp-outbound.
      wa_phone_number_id: channelConfig.id,
      media_url: mediaUrl,
      media_metadata: mediaMetadata,
      metadata: {
        evolution_instance: envelope.instance,
        evolution_remote_jid: key?.remoteJid,
      },
    });

    if (msgInsertError) {
      console.error('evolution-webhook: messages INSERT error:', msgInsertError.message);
    } else {
      log.info('message_saved', { person_id: person.id, phone, msg_type: msgType });
      supabase.from('clients_people').update({ updated_at: new Date().toISOString() })
        .eq('id', person.id)
        .then(({ error }) => {
          if (error) console.error('evolution-webhook: updated_at bump failed:', error.message);
        });
    }

    // ── Push to message buffer → dispara ai-agent-execute ────────────────────
    if (person.ai_enabled) {
      const { data: agentConfig } = await supabase
        .from('ai_agents')
        .select('buffer_ms')
        .eq('active', true)
        .limit(1)
        .maybeSingle();
      const bufferMs = (agentConfig as { buffer_ms?: number } | null)?.buffer_ms ?? 1000;

      try {
        await pushToBuffer(supabase, person.id, {
          content,
          message_type: msgType,
          wa_message_id: key?.id ?? null,
        }, bufferMs, channelConfig.id);
      } catch (bufErr) {
        console.error('evolution-webhook: pushToBuffer failed (non-fatal):', (bufErr as Error).message);
      }
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('evolution-webhook: unhandled error:', (err as Error).message);
    return new Response('Internal Server Error', { status: 500 });
  }
});
