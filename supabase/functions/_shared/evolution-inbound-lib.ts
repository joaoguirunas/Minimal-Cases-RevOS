/**
 * EVOLUTION INBOUND — pure logic
 *
 * Parsing de envelope + normalização de telefone + mapeamento de ACK,
 * decoupled de Supabase / do Deno.serve handler pra poder ser testado direto
 * (evolution-webhook/index.ts importa daqui). Espelha o padrão de
 * kiwify-inbound/logic.ts.
 */

// ── Telefone ──────────────────────────────────────────────────────────────────

/**
 * BR legado: 12 dígitos (55 + DDD + 8 dígitos, sem o "9" do celular) recebem o
 * "9" de volta na posição 4. Espelha whatsapp-inbound/index.ts:normalizeBRPhone.
 */
export function normalizeBRPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12) {
    return digits.substring(0, 4) + '9' + digits.substring(4);
  }
  return digits;
}

/** Extrai e normaliza o telefone de um remoteJid Evolution (`5511999999999@s.whatsapp.net`). */
export function extractRemoteJidPhone(remoteJid: string | undefined): string {
  if (!remoteJid) return '';
  const raw = remoteJid.split('@')[0];
  return normalizeBRPhone(raw);
}

/** `@g.us` = grupo, `@broadcast` = lista de transmissão — nenhum dos dois é 1:1 com cliente. */
export function isGroupOrBroadcastJid(remoteJid: string | undefined): boolean {
  if (!remoteJid) return false;
  return remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast');
}

/**
 * `fromMe=true` cobre dois casos: eco do que o próprio CRM mandou (já gravado
 * na hora do send — dedup por wa_message_id resolve) e mensagem mandada
 * direto do celular pareado, fora do CRM — que precisa ser sincronizada pro
 * Omni ficar fiel à conversa real. Grupo/broadcast nunca é 1:1 com cliente,
 * então nunca sincroniza mesmo sendo fromMe.
 */
export function shouldSyncFromMeMessage(fromMe: boolean, remoteJid: string | undefined): boolean {
  return fromMe && !isGroupOrBroadcastJid(remoteJid);
}

// ── Extração de conteúdo (messages.upsert) ───────────────────────────────────

export interface EvoMessageUpsertData {
  key?: { remoteJid?: string; fromMe?: boolean; id?: string };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string; mimetype?: string };
    videoMessage?: { caption?: string; mimetype?: string };
    documentMessage?: { caption?: string; fileName?: string; mimetype?: string };
    audioMessage?: { mimetype?: string };
    stickerMessage?: { mimetype?: string };
    // Com webhookBase64:true (buildEvolutionWebhookConfig), Evolution já decripta e
    // inclui os bytes prontos aqui — sibling dos campos *Message acima, não aninhado
    // dentro deles. Confirmado empiricamente contra o servidor real (sticker de teste).
    base64?: string;
  };
  messageType?: string;
}

export interface ExtractedMessage {
  text: string;
  msgType: string;
}

/**
 * Resolve texto + tipo a partir do envelope Baileys. Ordem de checagem importa:
 * `conversation` (texto puro) e `extendedTextMessage` (texto com preview/reply)
 * primeiro, depois mídia por tipo. Envelope sem `message` ou sem nenhum campo
 * reconhecido cai no fallback genérico.
 */
export function extractMessageText(data: EvoMessageUpsertData): ExtractedMessage {
  const m = data.message;
  if (!m) return { text: '', msgType: 'texto' };
  if (typeof m.conversation === 'string') return { text: m.conversation, msgType: 'texto' };
  if (m.extendedTextMessage?.text) return { text: m.extendedTextMessage.text, msgType: 'texto' };
  if (m.imageMessage) return { text: m.imageMessage.caption || '[Imagem recebida]', msgType: 'imagem' };
  if (m.videoMessage) return { text: m.videoMessage.caption || '[Vídeo recebido]', msgType: 'video' };
  if (m.documentMessage) return { text: m.documentMessage.caption || m.documentMessage.fileName || '[Arquivo recebido]', msgType: 'arquivo' };
  if (m.audioMessage) return { text: '[Áudio recebido]', msgType: 'audio' };
  if (m.stickerMessage) return { text: '[Sticker recebido]', msgType: 'imagem' };
  return { text: '[Mensagem recebida]', msgType: 'texto' };
}

export interface EvoMediaInfo {
  /** Vocabulário de messages.message_type — sticker conta como imagem (mesmo tratamento visual). */
  mediaCategory: 'audio' | 'imagem' | 'video' | 'arquivo';
  mimetype: string;
  fileName: string;
}

const DEFAULT_MIMETYPE: Record<EvoMediaInfo['mediaCategory'], string> = {
  audio: 'audio/ogg',
  imagem: 'image/jpeg',
  video: 'video/mp4',
  arquivo: 'application/octet-stream',
};

/**
 * Resolve categoria/mimetype/nome de arquivo do anexo de mídia, se houver.
 * `null` quando a mensagem não tem mídia (texto puro) OU tem mídia mas sem
 * `message.base64` (Evolution não decriptou — nada pra baixar/armazenar).
 */
export function resolveMediaInfo(data: EvoMessageUpsertData): EvoMediaInfo | null {
  const m = data.message;
  if (!m?.base64) return null;
  if (m.audioMessage) return { mediaCategory: 'audio', mimetype: m.audioMessage.mimetype || DEFAULT_MIMETYPE.audio, fileName: 'audio.ogg' };
  if (m.imageMessage) return { mediaCategory: 'imagem', mimetype: m.imageMessage.mimetype || DEFAULT_MIMETYPE.imagem, fileName: 'image.jpg' };
  if (m.videoMessage) return { mediaCategory: 'video', mimetype: m.videoMessage.mimetype || DEFAULT_MIMETYPE.video, fileName: 'video.mp4' };
  if (m.documentMessage) {
    return {
      mediaCategory: 'arquivo',
      mimetype: m.documentMessage.mimetype || DEFAULT_MIMETYPE.arquivo,
      fileName: m.documentMessage.fileName || 'document',
    };
  }
  if (m.stickerMessage) return { mediaCategory: 'imagem', mimetype: m.stickerMessage.mimetype || 'image/webp', fileName: 'sticker.webp' };
  return null;
}

// ── ACK de status (messages.update) ──────────────────────────────────────────

/**
 * Evolution manda o ACK como STRING (não numérico como o Meta). PENDING e
 * qualquer valor fora deste mapa são ignorados (retorna null) — não é
 * progressão de entrega, é só "mensagem na fila do WhatsApp".
 */
export const ACK_STATUS_MAP: Record<string, string> = {
  SERVER_ACK: 'sent',
  DELIVERY_ACK: 'delivered',
  READ: 'read',
  PLAYED: 'read',
};

/** Rank de progressão — maior = mais avançado. Usado pro guard monotônico. */
export const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3 };

/** Traduz o ACK cru (ex: "server_ack", "READ") pro vocabulário canônico de messages.status. Null = ignorar. */
export function mapAckStatus(rawStatus: string): string | null {
  return ACK_STATUS_MAP[rawStatus.toUpperCase()] ?? null;
}

/**
 * Guard monotônico: nunca regride (read→delivered→sent) e nunca "revive" uma
 * linha já marcada como erro. Espelha o STATUS_RANK de whatsapp-inbound.
 */
export function shouldAdvanceStatus(currentStatus: string, incomingStatus: string): boolean {
  if (currentStatus === 'error') return false;
  const currentRank = STATUS_RANK[currentStatus] ?? 0;
  const incomingRank = STATUS_RANK[incomingStatus] ?? 0;
  return incomingRank > currentRank;
}

export interface MessageStatusUpdate {
  status: string;
  delivered_at?: string;
  read_at?: string;
}

/**
 * Monta o objeto de UPDATE pra messages dado o status canônico já validado
 * (shouldAdvanceStatus true). `read` sempre carrega delivered_at também —
 * cliente pode ler sem o ACK de entrega ter chegado separado (fora de ordem).
 */
export function buildStatusUpdate(incomingStatus: string, hadDeliveredAt: boolean, now: string): MessageStatusUpdate {
  const update: MessageStatusUpdate = { status: incomingStatus };
  if (incomingStatus === 'delivered') {
    update.delivered_at = now;
  } else if (incomingStatus === 'read') {
    update.read_at = now;
    if (!hadDeliveredAt) update.delivered_at = now;
  }
  return update;
}
