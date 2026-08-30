/**
 * WHATSAPP OUTBOUND — N8N-WAA Phase 2 (N8N-WAA-9)
 *
 * ⚠️  DEPLOY: always use --no-verify-jwt
 *     supabase functions deploy whatsapp-outbound --no-verify-jwt
 *     (Meta webhooks and internal callers don't have a Supabase JWT)
 *
 * Sends one or more messages to a WhatsApp number via Meta Graph API.
 * Also handles typing indicators: { action: 'typing', people_id }
 * Called by ai-agent-execute (fire-and-forget) and by OMNI PRO manual send.
 *
 * Flow (send):
 *   1. Receive { to, phone_number_id, messages[], people_id, lead_id, execution_id, channel_id? }
 *   2. Resolve credentials: channel_id > last inbound channel > default channel > any active
 *   3. For each message item:
 *      a. Humanizer delay (text only)
 *      b. POST to Meta Graph API /messages
 *      c. Update persisted message row with wa_message_id
 *
 * Flow (typing):
 *   1. Receive { action: 'typing', people_id }
 *   2. Look up last received wa_message_id from this person
 *   3. POST read + typing_indicator to Meta — client sees "typing..." for ~25 s
 *
 * Env vars:
 *   WHATSAPP_ACCESS_TOKEN  — Fallback Meta access token (used when no channel_id)
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import { createEvolutionClient, formatRecipient as formatEvolutionRecipient } from '../_shared/evolution-client.ts';
import {
  buildInteractiveFallbackText,
  resolveChannelDispatch,
  resolveTemplateBodyText,
  resolveTemplateParams,
  substituteTemplateVars,
  type ChannelRow,
} from '../_shared/evolution-outbound-lib.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API_VERSION = 'v23.0';

// ── Types ─────────────────────────────────────────────────────────────────────

type MetaMediaType = 'image' | 'audio' | 'video' | 'document';

interface OutboundMessageObj {
  type: 'text' | MetaMediaType;
  text?: string;       // body for text; caption for media
  media_url?: string;  // publicly accessible URL
  caption?: string;    // alias for text when sending media
  filename?: string;   // used for document type
  mime_type?: string;  // MIME type for media upload to Meta
  context_wamid?: string; // wa_message_id being quoted — renders as a WhatsApp quoted reply
}

interface TemplateMessageObj {
  type: 'template';
  template_name: string;                            // Meta template name (nome/name DB column)
  language_code?: string;                           // e.g. 'pt_BR' (default)
  components?: Array<Record<string, unknown>>;      // full header+body+buttons array (preferred)
  variable_values?: string[];                       // legacy: body-only ordered values
  variable_names?: string[];                        // variable names for parameter_format=NAMED
  parameter_format?: string;                        // 'NAMED' | 'POSITIONAL'
}

// Normalised internal message — always resolved from string | OutboundMessageObj
interface NormMsg {
  type: 'text' | MetaMediaType;
  text: string;
  media_url: string | null;
  filename: string | null;
  mime_type: string | null;
  context_wamid: string | null;
}

function normalise(item: string | OutboundMessageObj): NormMsg {
  if (typeof item === 'string') {
    return { type: 'text', text: item, media_url: null, filename: null, mime_type: null, context_wamid: null };
  }
  const caption = item.text ?? item.caption ?? '';
  return {
    type: item.type ?? 'text',
    text: caption,
    media_url: item.media_url ?? null,
    filename: item.filename ?? null,
    mime_type: item.mime_type ?? null,
    context_wamid: item.context_wamid ?? null,
  };
}

// ── Meta API helpers ──────────────────────────────────────────────────────────

type MetaResult = { wamid: string } | { error: string } | null;

/**
 * Downloads a file from Supabase Storage using a direct HTTP fetch with the
 * service role key as Bearer token. Works for private and public buckets.
 * This approach is more reliable in Deno than the Supabase JS storage client.
 */
async function downloadFromStorage(
  mediaUrl: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<ArrayBuffer | null> {
  // Parse: https://{project}.supabase.co/storage/v1/object/{public|authenticated}/{bucket}/{path}
  const storageMatch = mediaUrl.match(/\/storage\/v1\/object\/(?:public|authenticated)\/([^/?]+)\/(.+?)(?:\?.*)?$/);
  if (storageMatch) {
    const [, bucket, path] = storageMatch;
    // Direct service-role HTTP — bypasses bucket ACL and RLS
    const storageApiUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${encodeURIComponent(path).replace(/%2F/g, '/')}`;
    console.log(`downloadFromStorage: service-role HTTP GET bucket=${bucket} path=${path}`);
    try {
      const res = await fetch(storageApiUrl, {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
        },
      });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        console.log(`downloadFromStorage: ok bytes=${buf.byteLength} content-type=${res.headers.get('content-type')}`);
        return buf;
      }
      const errBody = await res.text();
      console.error(`downloadFromStorage: service-role HTTP failed ${res.status}: ${errBody}`);
    } catch (e) {
      console.error(`downloadFromStorage: service-role fetch exception:`, e);
    }
  } else {
    console.log(`downloadFromStorage: URL not a Supabase storage URL, trying direct fetch: ${mediaUrl}`);
  }
  // Fallback: direct public URL fetch (works if bucket is truly public)
  try {
    const res = await fetch(mediaUrl);
    if (res.ok) {
      const buf = await res.arrayBuffer();
      console.log(`downloadFromStorage: public fallback ok bytes=${buf.byteLength}`);
      return buf;
    }
    console.error(`downloadFromStorage: public fallback failed ${res.status}`);
  } catch (e) {
    console.error(`downloadFromStorage: public fallback exception:`, e);
  }
  return null;
}

// ── WebM Opus → OGG Opus converter ───────────────────────────────────────────
// Chrome's MediaRecorder only produces audio/webm. Meta WhatsApp only supports
// audio/ogg. Both formats use the same Opus codec packets — this function
// re-containerises the Opus data (Matroska → OGG), no audio re-encoding needed.

function buildOggCrcTable(): Uint32Array {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) r = ((r & 0x80000000) !== 0 ? (r << 1) ^ 0x04C11DB7 : r << 1) >>> 0;
    t[i] = r;
  }
  return t;
}
const OGG_CRC_TABLE = buildOggCrcTable();

function oggCrc32(data: Uint8Array): number {
  let crc = 0;
  for (const b of data) crc = (((crc << 8) >>> 0) ^ OGG_CRC_TABLE[((crc >>> 24) ^ b) & 0xFF]) >>> 0;
  return crc;
}

/** Read an EBML element ID (1-4 bytes). */
function readEbmlId(d: Uint8Array, p: number): { id: number; len: number } {
  const b = d[p];
  if (b >= 0x80) return { id: b, len: 1 };
  if (b >= 0x40) return { id: (b << 8) | d[p + 1], len: 2 };
  if (b >= 0x20) return { id: (b << 16) | (d[p + 1] << 8) | d[p + 2], len: 3 };
  return { id: (b * 0x1000000) + (d[p + 1] << 16) + (d[p + 2] << 8) + d[p + 3], len: 4 };
}

/** Read an EBML data size (1-8 bytes). Returns -1 for unknown-size. */
function readEbmlSize(d: Uint8Array, p: number): { size: number; len: number } {
  const b = d[p];
  if (b >= 0x80) { const v = b & 0x7F; return { size: v === 0x7F ? -1 : v, len: 1 }; }
  if (b >= 0x40) { const v = ((b & 0x3F) << 8) | d[p + 1]; return { size: v === 0x3FFF ? -1 : v, len: 2 }; }
  if (b >= 0x20) { const v = ((b & 0x1F) << 16) | (d[p + 1] << 8) | d[p + 2]; return { size: v === 0x1FFFFF ? -1 : v, len: 3 }; }
  if (b >= 0x10) { const v = ((b & 0xF) * 0x1000000) + (d[p + 1] << 16) + (d[p + 2] << 8) + d[p + 3]; return { size: v === 0x0FFFFFFF ? -1 : v, len: 4 }; }
  return { size: -1, len: 8 }; // 8-byte vint (unknown-size)
}

/** Read an EBML variable-length integer (for track number in SimpleBlock). */
function readVint(d: Uint8Array, p: number): { value: number; len: number } {
  const b = d[p];
  if (b >= 0x80) return { value: b & 0x7F, len: 1 };
  if (b >= 0x40) return { value: ((b & 0x3F) << 8) | d[p + 1], len: 2 };
  if (b >= 0x20) return { value: ((b & 0x1F) << 16) | (d[p + 1] << 8) | d[p + 2], len: 3 };
  return { value: ((b & 0xF) * 0x1000000) + (d[p + 1] << 16) + (d[p + 2] << 8) + d[p + 3], len: 4 };
}

interface WebmOpusData { packets: Uint8Array[]; codecPrivate: Uint8Array | null; }

function parseWebmOpus(data: Uint8Array): WebmOpusData {
  const packets: Uint8Array[] = [];
  let codecPrivate: Uint8Array | null = null;
  let pos = 0;

  function walk(end: number): void {
    while (pos < end && pos + 2 <= data.length) {
      const { id, len: idLen } = readEbmlId(data, pos); pos += idLen;
      if (pos >= data.length) break;
      const { size, len: szLen } = readEbmlSize(data, pos); pos += szLen;
      const elemEnd = size < 0 ? data.length : Math.min(pos + size, data.length);

      switch (id) {
        // Container elements — recurse
        case 0x18538067: // Segment (unknown-size in Chrome)
        case 0x1654AE6B: // Tracks
        case 0xAE:       // TrackEntry
        case 0x1F43B675: // Cluster
        case 0xA0:       // BlockGroup
          walk(elemEnd); break;

        case 0x63A2: // CodecPrivate → Opus ID header
          codecPrivate = data.slice(pos, elemEnd);
          pos = elemEnd; break;

        case 0xA3: // SimpleBlock: [vint track][int16 timecode][u8 flags][Opus packet]
        case 0xA1: { // Block (inside BlockGroup)
          const tn = readVint(data, pos);
          const dataStart = pos + tn.len + 3; // skip track number + 2-byte timecode + 1-byte flags
          if (dataStart < elemEnd) packets.push(data.slice(dataStart, elemEnd));
          pos = elemEnd; break;
        }

        default: pos = elemEnd;
      }
    }
    pos = Math.min(end, data.length);
  }

  walk(data.length);
  return { packets, codecPrivate };
}

function writeOggPage(
  serial: number, seqNum: number, granule: bigint, headerType: number, pkts: Uint8Array[],
): Uint8Array {
  const segTable: number[] = [];
  const body: number[] = [];
  for (const pkt of pkts) {
    let rem = pkt.length, off = 0;
    while (rem >= 255) { segTable.push(255); for (let i = 0; i < 255; i++) body.push(pkt[off + i]); off += 255; rem -= 255; }
    segTable.push(rem); for (let i = 0; i < rem; i++) body.push(pkt[off + i]);
  }
  const page = new Uint8Array(27 + segTable.length + body.length);
  const v = new DataView(page.buffer);
  page.set([0x4F, 0x67, 0x67, 0x53, 0, headerType]); // "OggS" + version + type
  v.setBigInt64(6, granule, true);
  v.setUint32(14, serial >>> 0, true);
  v.setUint32(18, seqNum >>> 0, true);
  v.setUint32(22, 0, true); // CRC placeholder
  page[26] = segTable.length;
  for (let i = 0; i < segTable.length; i++) page[27 + i] = segTable[i];
  const base = 27 + segTable.length;
  for (let i = 0; i < body.length; i++) page[base + i] = body[i];
  v.setUint32(22, oggCrc32(page) >>> 0, true);
  return page;
}

/**
 * Converts a WebM Opus buffer to an OGG Opus buffer.
 * Pure re-containerisation — extracts Opus packets from Matroska and wraps in OGG.
 * Returns null if parsing fails (caller will fall back to original file).
 */
function convertWebmToOgg(webmBuffer: ArrayBuffer): ArrayBuffer | null {
  try {
    const data = new Uint8Array(webmBuffer);
    const { packets, codecPrivate } = parseWebmOpus(data);
    if (packets.length === 0) { console.error('convertWebmToOgg: no Opus packets found'); return null; }

    const serial = Math.floor(Math.random() * 0xFFFFFFFF);
    let seq = 0;
    const pages: Uint8Array[] = [];

    // Page 0: Opus ID header (use CodecPrivate from WebM — it IS the OpusHead)
    let opusHead: Uint8Array;
    if (codecPrivate && codecPrivate.length >= 8) {
      opusHead = codecPrivate;
    } else {
      opusHead = new Uint8Array(19);
      const hv = new DataView(opusHead.buffer);
      opusHead.set([0x4F, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64]); // "OpusHead"
      opusHead[8] = 1; opusHead[9] = 1; // version, channels=1
      hv.setUint16(10, 3840, true); hv.setUint32(12, 48000, true); // pre-skip, sample_rate
      hv.setInt16(16, 0, true); opusHead[18] = 0; // gain, channel_map
    }
    // RFC 7845 §5.1: granule position of the ID header page MUST be 0
    pages.push(writeOggPage(serial, seq++, 0n, 0x02, [opusHead]));

    // Page 1: Opus comment header (minimal)
    const vendor = new TextEncoder().encode('webm-repack');
    const tags = new Uint8Array(8 + 4 + vendor.length + 4);
    const tv = new DataView(tags.buffer);
    tags.set([0x4F, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73]); // "OpusTags"
    tv.setUint32(8, vendor.length, true); tags.set(vendor, 12);
    tv.setUint32(12 + vendor.length, 0, true);
    pages.push(writeOggPage(serial, seq++, 0n, 0x00, [tags]));

    // RFC 7845 §4: granule = pre-skip + cumulative samples
    // pre-skip is stored at bytes 10-11 (LE) in OpusHead
    let preSkip = 3840n; // 80ms default (Chrome's typical value)
    if (opusHead.length >= 12) {
      const hdv = new DataView(opusHead.buffer, opusHead.byteOffset, opusHead.byteLength);
      preSkip = BigInt(hdv.getUint16(10, true));
    }

    // Audio pages: group packets for efficient paging
    const PER_PAGE = 50; const SPF = 960n; // 20ms @ 48kHz
    for (let i = 0; i < packets.length; i += PER_PAGE) {
      const batch = packets.slice(i, i + PER_PAGE);
      const isLast = i + PER_PAGE >= packets.length;
      const granule = preSkip + BigInt(i + batch.length) * SPF;
      pages.push(writeOggPage(serial, seq++, granule, isLast ? 0x04 : 0x00, batch));
    }

    const total = pages.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(total); let off = 0;
    for (const p of pages) { out.set(p, off); off += p.length; }
    console.log(`convertWebmToOgg: ok packets=${packets.length} pages=${pages.length} bytes=${total}`);
    return out.buffer;
  } catch (e) {
    console.error('convertWebmToOgg exception:', e);
    return null;
  }
}

// Diagnostic info accumulated during a send — returned in response for debugging
interface Diag {
  download_bytes: number | null;
  download_error: string | null;
  upload_mime: string | null;
  upload_media_id: string | null;
  upload_error: string | null;
  signed_url_ok: boolean | null;
  meta_payload_type: string | null;
  meta_payload_link_or_id: string | null;
}

/**
 * Converts audio/webm → audio/ogg and uploads to Supabase Storage (public bucket).
 * Returns a public CDN URL that Meta can fetch when delivering the voice note.
 * This avoids Meta's internal transcoding pipeline which causes "Este áudio não está mais disponível".
 */
async function prepareAudioUrl(
  mediaUrl: string,
  mimeType: string,
  supabaseUrl: string,
  serviceRoleKey: string,
  diag: Diag,
): Promise<string | null> {
  try {
    // 1. Download from Supabase Storage via service role HTTP
    const mediaBytes = await downloadFromStorage(mediaUrl, supabaseUrl, serviceRoleKey);
    if (!mediaBytes) {
      diag.download_bytes = null;
      diag.download_error = 'downloadFromStorage returned null';
      return null;
    }
    diag.download_bytes = mediaBytes.byteLength;

    // 2. Normalize MIME type — strip codec params, then detect actual container from magic bytes
    let baseMime = mimeType.split(';')[0].trim();
    let uploadBytes = mediaBytes;

    // Detect real container from magic bytes (MIME metadata can be wrong, e.g. TTS stored as audio/ogg but actually WebM)
    const magic = new Uint8Array(mediaBytes.slice(0, 4));
    const isActuallyWebm = magic[0] === 0x1A && magic[1] === 0x45 && magic[2] === 0xDF && magic[3] === 0xA3; // EBML header = WebM/MKV
    const isActuallyOgg = magic[0] === 0x4F && magic[1] === 0x67 && magic[2] === 0x67 && magic[3] === 0x53;  // "OggS"
    if (isActuallyWebm && baseMime !== 'audio/webm') {
      console.log(`prepareAudioUrl: magic bytes indicate WebM but MIME was ${baseMime} — correcting to audio/webm for conversion`);
      baseMime = 'audio/webm';
    }

    // 3. Convert audio/webm → audio/ogg (re-containerise Opus packets, no re-encoding)
    //    Meta WhatsApp supports audio/ogg (Opus) but NOT audio/webm.
    if (baseMime === 'audio/webm') {
      const oggBuffer = convertWebmToOgg(mediaBytes);
      if (oggBuffer) {
        uploadBytes = oggBuffer;
        baseMime = 'audio/ogg';
        console.log(`prepareAudioUrl: converted audio/webm → audio/ogg (${oggBuffer.byteLength} bytes, ${(mediaBytes.byteLength/1024).toFixed(1)}KB src)`);
      } else {
        diag.upload_error = 'webm→ogg conversion failed: no Opus packets extracted';
        console.error('prepareAudioUrl: webm→ogg conversion failed — aborting');
        return null;
      }
    }
    // audio/ogg (from ElevenLabs TTS ogg_opus) — already in correct format, pass through
    // audio/mpeg (MP3) — Meta sends as document, not voice note; keep as-is for playback

    diag.upload_mime = baseMime;

    // 4. Upload to Supabase Storage (public bucket) so Meta can fetch it via CDN
    const ext = baseMime === 'audio/ogg' ? 'ogg' : baseMime === 'audio/mpeg' ? 'mp3' : 'ogg';
    const storePath = `converted-audio/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const storeEndpoint = `${supabaseUrl}/storage/v1/object/omni-media/${storePath}`;

    const storeRes = await fetch(storeEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': baseMime,
        'x-upsert': 'true',
      },
      body: uploadBytes,
    });

    if (!storeRes.ok) {
      const err = await storeRes.text();
      diag.upload_error = `Supabase store ${storeRes.status}: ${err}`;
      console.error(`prepareAudioUrl: Supabase upload failed ${storeRes.status}: ${err}`);
      return null;
    }

    // 5. Return public CDN URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/omni-media/${storePath}`;
    diag.upload_media_id = publicUrl;
    console.log(`prepareAudioUrl: ok stored at ${storePath} mime=${baseMime} bytes=${uploadBytes.byteLength}`);
    return publicUrl;
  } catch (e) {
    diag.upload_error = String(e);
    console.error('prepareAudioUrl: exception', e);
    return null;
  }
}

async function sendInteractiveToMeta(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  body: string,
  buttons: string[],
): Promise<MetaResult> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.slice(0, 3).map((btn, i) => ({
          type: 'reply',
          reply: { id: `opt_${i}`, title: btn.slice(0, 20) },
        })),
      },
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || json.error) return { error: json.error?.message ?? `HTTP ${res.status}` };
  return { wamid: json.messages?.[0]?.id ?? '' };
}

async function sendToMeta(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  msg: NormMsg,
  supabaseUrl: string,
  serviceRoleKey: string,
  diag?: Diag,
): Promise<MetaResult> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  let payload: Record<string, unknown>;

  if (msg.type === 'text' || !msg.media_url) {
    // Plain text (also fallback when media_url is missing)
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: msg.text || '[mensagem sem conteúdo]' },
    };
  } else {
    // Media message
    let mediaPayload: Record<string, unknown>;
    let sendType = msg.type;

    // Audio: convert webm→ogg, store in Supabase public bucket, send via link.
    // Using link (not Meta Media Upload API) because Meta's upload/transcoding pipeline
    // was causing "Este áudio não está mais disponível" — the file uploads fine but
    // Meta's CDN fails to serve it. Serving from our own Supabase CDN avoids that.
    const isAudio = msg.type === 'audio' || (msg.mime_type != null && msg.mime_type.startsWith('audio/'));

    if (isAudio && msg.media_url) {
      console.log(`sendToMeta: audio detected mime=${msg.mime_type} — preparing OGG Opus for voice note`);
      const uploadDiag: Diag = {
        download_bytes: null, download_error: null, upload_mime: null,
        upload_media_id: null, upload_error: null, signed_url_ok: null,
        meta_payload_type: null, meta_payload_link_or_id: null,
      };

      // Step 1: Download and convert to OGG Opus if needed
      const mediaBytes = await downloadFromStorage(msg.media_url, supabaseUrl, serviceRoleKey);
      let audioBytes = mediaBytes;
      let audioMime = 'audio/ogg; codecs=opus';

      if (mediaBytes) {
        uploadDiag.download_bytes = mediaBytes.byteLength;
        const magic = new Uint8Array(mediaBytes.slice(0, 4));
        const isWebm = magic[0] === 0x1A && magic[1] === 0x45 && magic[2] === 0xDF && magic[3] === 0xA3;

        if (isWebm) {
          console.log('sendToMeta: audio is WebM — converting to OGG Opus');
          const oggBuffer = convertWebmToOgg(mediaBytes);
          if (oggBuffer) {
            audioBytes = new Uint8Array(oggBuffer);
          } else {
            console.error('sendToMeta: WebM→OGG conversion failed');
            audioBytes = null;
          }
        }
      } else {
        uploadDiag.download_error = 'downloadFromStorage returned null';
      }

      // Step 2: Upload directly to Meta Media API (voice notes work reliably with media_id, not link)
      if (audioBytes) {
        const mediaUploadUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/media`;
        const formData = new FormData();
        formData.append('messaging_product', 'whatsapp');
        formData.append('type', audioMime);
        formData.append('file', new Blob([audioBytes], { type: audioMime }), 'voice.ogg');

        const uploadRes = await fetch(mediaUploadUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}` },
          body: formData,
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          const mediaId = uploadData.id;
          console.log(`sendToMeta: uploaded to Meta media_id=${mediaId} bytes=${audioBytes.byteLength}`);
          sendType = 'audio';
          mediaPayload = { id: mediaId, voice: true };
          if (diag) { diag.meta_payload_type = 'media_id_voice_note'; diag.meta_payload_link_or_id = mediaId; }
          uploadDiag.upload_media_id = mediaId;
        } else {
          const uploadErr = await uploadRes.text();
          console.error(`sendToMeta: Meta media upload failed ${uploadRes.status}: ${uploadErr}`);
          uploadDiag.upload_error = `Meta media ${uploadRes.status}: ${uploadErr}`;
          // Fallback: try with link
          sendType = 'audio';
          mediaPayload = { link: msg.media_url, voice: true };
          if (diag) { diag.meta_payload_type = 'link_fallback_voice'; diag.meta_payload_link_or_id = msg.media_url; }
        }
      } else {
        // Download/conversion failed — last-resort fallback as document link
        console.warn(`sendToMeta: audio prep failed (mime=${msg.mime_type}), falling back to document link`);
        sendType = 'document';
        mediaPayload = { link: msg.media_url };
        if (diag) { diag.meta_payload_type = 'link_fallback_doc'; diag.meta_payload_link_or_id = msg.media_url; }
      }
      if (diag) Object.assign(diag, uploadDiag);
    } else {
      // Non-audio media: use direct public link (image, document, video)
      mediaPayload = { link: msg.media_url };
      if (diag) { diag.meta_payload_type = 'link'; diag.meta_payload_link_or_id = msg.media_url; }
    }

    // Meta API: audio does NOT support caption — only image, video, document do
    if (msg.text && sendType !== 'audio') mediaPayload.caption = msg.text;
    if (sendType === 'document' && msg.filename) mediaPayload.filename = msg.filename;

    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: sendType,
      [sendType]: mediaPayload,
    };
  }

  // Quoted reply — renders in the recipient's WhatsApp app as a real quote, not just in our CRM.
  // Works for any message type; Meta accepts context.message_id alongside text/media/interactive.
  if (msg.context_wamid) {
    payload.context = { message_id: msg.context_wamid };
  }

  console.log(`sendToMeta: type=${msg.type} mime=${msg.mime_type ?? 'none'} media_url=${msg.media_url ?? 'none'}`);
  console.log(`sendToMeta: payload=${JSON.stringify(payload)}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Meta API error (${res.status}) for ${msg.type} to ${to}: ${err}`);
    return { error: `Meta ${res.status}: ${err}` };
  }

  const data = await res.json();
  const wamid = data.messages?.[0]?.id ?? null;
  console.log(`sendToMeta: result wamid=${wamid} data=${JSON.stringify(data)}`);
  return wamid ? { wamid } : null;
}

// ── Humanizer delay ───────────────────────────────────────────────────────────
// Only applied between text messages (media delivery is instant on WA)

function humanDelay(text: string): Promise<void> {
  const ms = Math.min(2500, Math.max(300, text.length * 25));
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Delivery log recorder ────────────────────────────────────────────────────
// Append a delivery attempt to messages.metadata.delivery_log WITHOUT overwriting
// existing metadata (template_name, components, send_id, etc). Earlier code did
// `update({ metadata: { error_reason } })` which wiped all other metadata fields
// — making it impossible to debug WHY a campaign template failed mid-flight.
async function recordDeliveryAttempt(
  supabase: ReturnType<typeof createClient>,
  msgId: number,
  attempt: {
    success: boolean;
    error?: string;
    wamid?: string;
    meta_payload_type?: string | null;
  },
): Promise<void> {
  try {
    const { data } = await supabase
      .from('messages')
      .select('metadata')
      .eq('id', msgId)
      .maybeSingle();
    const existing = ((data as { metadata?: Record<string, unknown> } | null)?.metadata ?? {}) as Record<string, unknown>;
    const log = Array.isArray(existing.delivery_log) ? (existing.delivery_log as unknown[]) : [];
    const entry: Record<string, unknown> = {
      attempt: log.length + 1,
      timestamp: new Date().toISOString(),
      success: attempt.success,
    };
    if (attempt.wamid) entry.wamid = attempt.wamid;
    if (attempt.meta_payload_type) entry.meta_payload_type = attempt.meta_payload_type;
    if (attempt.error) {
      const errStr = String(attempt.error);
      entry.error = errStr.substring(0, 500);
      const httpMatch = errStr.match(/Meta (\d{3}):/);
      if (httpMatch) entry.http_status = parseInt(httpMatch[1], 10);
    }
    const merged: Record<string, unknown> = {
      ...existing,
      delivery_log: [...log, entry],
    };
    if (!attempt.success && attempt.error) {
      merged.error_reason = String(attempt.error).substring(0, 500);
    }
    await supabase
      .from('messages')
      .update({ metadata: merged } as Record<string, unknown>)
      .eq('id', msgId);
  } catch (e) {
    console.error('recordDeliveryAttempt failed:', (e as Error).message);
  }
}

// ── Template sender ───────────────────────────────────────────────────────────
// Sends a WhatsApp Template message via Meta Graph API.
// Required outside the 24-hour customer-initiated conversation window.

function toFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

async function sendTemplateToMeta(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  msg: TemplateMessageObj,
  personName?: string,
): Promise<MetaResult> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  // Prefer full components array (header+body+buttons) over legacy body-only variable_values
  let components: Record<string, unknown>[] = [];

  if (msg.components && msg.components.length > 0) {
    // Full components array built by buildMetaTemplateComponents on the frontend or lp-submit.
    // When pessoa data was unavailable (form lead, backend trigger), text params arrive as ''.
    // Replace empty text params with the real person name (passed from DB lookup) or 'Cliente'
    // as last resort — stripping causes "localizable_params (0) does not match expected (N)".
    const emptyFallback = toFirstName(personName || 'Cliente');
    components = (msg.components as Array<Record<string, unknown>>)
      .map((comp) => {
        const params = comp.parameters as Array<Record<string, unknown>> | undefined;
        if (!Array.isArray(params)) return comp;
        const isHeader = (comp.type as string)?.toLowerCase() === 'header';
        const validParams = params
          .filter((p) => p.type !== 'text' || (p.text !== null && p.text !== undefined))
          .map((p) => {
            if (p.type === 'text' && typeof p.text === 'string') {
              if (p.text.trim() === '') return { ...p, text: emptyFallback };
              if (isHeader) return { ...p, text: toFirstName(p.text) };
            }
            return p;
          });
        return validParams.length > 0 ? { ...comp, parameters: validParams } : null;
      })
      .filter((c): c is Record<string, unknown> => c !== null);
  } else if (msg.variable_values && msg.variable_values.length > 0) {
    // Legacy fallback: body-only ordered values
    // Always include parameter_name — Meta v22+ requires it for NAMED templates
    const hasNames = msg.variable_names && msg.variable_names.length > 0;
    components = [{
      type: 'body',
      parameters: msg.variable_values.map((value, idx) => {
        const param: Record<string, string> = { type: 'text', text: value };
        const varName = hasNames ? msg.variable_names![idx] : String(idx + 1);
        param.parameter_name = varName;
        return param;
      }),
    }];
  }

  // Guard: reject empty/UUID-shaped template names before calling Meta
  const tplName = (msg.template_name || '').trim();
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!tplName || UUID_RE.test(tplName)) {
    const reason = !tplName ? 'empty' : `UUID (${tplName})`;
    console.error(`sendTemplateToMeta: BLOCKED — template_name is ${reason} for ${to}`);
    return { error: `template_name is ${reason} — cannot send to Meta` };
  }

  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: tplName,
      language: { code: msg.language_code || 'pt_BR' },
      ...(components.length > 0 ? { components } : {}),
    },
  };

  console.log(`sendTemplateToMeta: payload=${JSON.stringify(payload)}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Meta API template error (${res.status}) to ${to}: ${err}`);
    return { error: `Meta ${res.status}: ${err}` };
  }

  const data = await res.json();
  const wamid = data.messages?.[0]?.id ?? null;
  return wamid ? { wamid } : null;
}

// ── Evolution API (WhatsApp não-oficial, self-hosted, engine Baileys) ─────────
// Mesmo shape de retorno de sendToMeta/sendTemplateToMeta ({wamid}|{error}|null)
// pra reusar o loop de envio + write-back de wa_message_id sem duplicar nada.

interface EvolutionSendCreds {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}

async function sendToEvolution(creds: EvolutionSendCreds, to: string, msg: NormMsg): Promise<MetaResult> {
  const client = createEvolutionClient({ baseUrl: creds.baseUrl, apiKey: creds.apiKey });
  const recipient = formatEvolutionRecipient(to);

  if (msg.type === 'text') {
    const res = await client.messages.sendText({ instance: creds.instanceName, to: recipient, text: msg.text });
    if (res.ok) return res.data.key?.id ? { wamid: res.data.key.id } : { error: 'Evolution sendText sem key.id na resposta' };
    return { error: `Evolution ${res.status}: ${res.message ?? res.error}` };
  }

  if (!msg.media_url) return { error: 'Evolution: media_url ausente pra mensagem de mídia' };

  if (msg.type === 'audio') {
    const res = await client.messages.sendAudio({ instance: creds.instanceName, to: recipient, audio: msg.media_url });
    if (res.ok) return res.data.key?.id ? { wamid: res.data.key.id } : { error: 'Evolution sendAudio sem key.id na resposta' };
    return { error: `Evolution ${res.status}: ${res.message ?? res.error}` };
  }

  const mediatype = msg.type === 'document' ? 'document' : msg.type === 'video' ? 'video' : 'image';
  const res = await client.messages.sendMedia({
    instance: creds.instanceName,
    to: recipient,
    mediatype,
    media: msg.media_url,
    caption: msg.text || undefined,
    fileName: msg.filename || undefined,
  });
  if (res.ok) return res.data.key?.id ? { wamid: res.data.key.id } : { error: 'Evolution sendMedia sem key.id na resposta' };
  return { error: `Evolution ${res.status}: ${res.message ?? res.error}` };
}

async function sendInteractiveToEvolution(
  creds: EvolutionSendCreds,
  to: string,
  body: string,
  buttons: string[],
): Promise<MetaResult> {
  const text = buildInteractiveFallbackText(body, buttons);
  return sendToEvolution(creds, to, { type: 'text', text, media_url: null, filename: null, mime_type: null, context_wamid: null });
}

/**
 * Templates Evolution não passam por aprovação Meta — são texto livre.
 * `msg.components`/`msg.variable_values` já chegam com os valores das
 * variáveis HIDRATADOS (o caller resolve `{{n}}` → valor real antes de montar
 * o payload, igual já faz pro Meta). Aqui só busca o corpo bruto do template
 * (`whatsapp_templates.json_data`, componente BODY) e substitui `{{n}}`
 * posicionalmente pelos mesmos valores já resolvidos.
 */
async function sendTemplateToEvolution(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, // ReturnType<typeof createClient> mismatches its own call-site type here (pre-existing quirk, see recordDeliveryAttempt)
  creds: EvolutionSendCreds,
  to: string,
  msg: TemplateMessageObj,
): Promise<MetaResult> {
  const tplName = (msg.template_name || '').trim();
  if (!tplName) return { error: 'template_name vazio — não é possível resolver o corpo do template' };

  // provider='evolution' é obrigatório aqui — templates Meta e Evolution podem
  // compartilhar o mesmo `name` (réplica 1:1 entre providers), então sem esse
  // filtro .maybeSingle() erroraria com "multiple rows returned" nesse caso.
  const { data: tplRow } = await supabase
    .from('whatsapp_templates')
    .select('json_data')
    .eq('name', tplName)
    .eq('provider', 'evolution')
    .maybeSingle() as unknown as { data: { json_data: Record<string, unknown> } | null };

  const components = ((tplRow?.json_data as Record<string, unknown>)?.components as Array<{ type: string; text?: string }>) ?? [];
  const bodyText = resolveTemplateBodyText(components);

  if (!bodyText) {
    return { error: `template '${tplName}' não encontrado ou sem corpo BODY em whatsapp_templates` };
  }

  const params = resolveTemplateParams(msg.components, msg.variable_values);
  const text = substituteTemplateVars(bodyText, params);

  return sendToEvolution(creds, to, { type: 'text', text, media_url: null, filename: null, mime_type: null, context_wamid: null });
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const envAccessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '';

  // Require a Bearer token (service role key from edge functions, or user JWT from frontend).
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? '';
  const incomingToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!incomingToken) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const log = createLogger('whatsapp-outbound');

  try {
    const body = await req.json();
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    log.info('start', { action: body.action ?? 'send', people_id: body.people_id ?? undefined, to: body.to ?? undefined });

    // ── Typing indicator action ────────────────────────────────────────────────
    // { action: 'typing', people_id } — marks last client message as read +
    // shows "typing..." on the client's WhatsApp for ~25 seconds.
    if (body.action === 'typing' && body.people_id) {
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('wa_message_id, wa_phone_number_id')
        .eq('people_id', body.people_id)
        .eq('from_contact', 'cliente')
        .not('wa_message_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as unknown as { data: { wa_message_id: string; wa_phone_number_id: string } | null };

      if (!lastMsg?.wa_message_id) {
        // No inbound message yet — nothing to mark read, skip silently
        return new Response(JSON.stringify({ ok: true, skipped: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Resolve channel credentials from wa_phone_number_id of last inbound message
      const { data: channel } = await supabase
        .from('settings_whatsapp_channels')
        .select('access_token, phone_number_id')
        .eq('phone_number_id', lastMsg.wa_phone_number_id)
        .eq('active', true)
        .maybeSingle() as unknown as { data: { access_token: string; phone_number_id: string } | null };

      const token = channel?.access_token || envAccessToken;
      const phoneNumId = channel?.phone_number_id || lastMsg.wa_phone_number_id;

      if (!token || !phoneNumId) {
        return new Response(JSON.stringify({ ok: true, skipped: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: lastMsg.wa_message_id,
          typing_indicator: { type: 'text' },
        }),
      }).catch(e => console.error('typing indicator error:', e));

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Normal send flow ──────────────────────────────────────────────────────
    const {
      to,
      phone_number_id: bodyPhoneNumberId,
      channel_id,
      messages,
      people_id,
      lead_id,
      execution_id,
      message_ids,
    } = body as {
      to: string;
      phone_number_id?: string;
      channel_id?: string;
      messages: Array<string | OutboundMessageObj | TemplateMessageObj>;
      people_id: string;
      lead_id?: string;
      execution_id?: string;
      message_ids?: number[];
    };

    if (!to || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'to and messages[] are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Resolve credentials: channel_id > legacy phone_number_id (resolved via lookup,
    // never trusted directly — ver comentário abaixo) > canal atual da pessoa >
    // canal padrão > canal da última mensagem recebida > qualquer canal ativo.
    let accessToken = envAccessToken;
    let phoneNumberId = '';

    // Evolution (WhatsApp não-oficial): resolvido em paralelo a phoneNumberId/accessToken.
    // Quando resolvedProvider==='evolution', phoneNumberId guarda o id (uuid) do canal —
    // não um phone_number_id real — só pra reusar os mesmos guards de "resolvido?" abaixo.
    let resolvedProvider: string = 'meta';
    let evolutionCreds: EvolutionSendCreds | null = null;

    const CHANNEL_SELECT = 'id, phone_number_id, access_token, provider, evolution_base_url, evolution_api_key, evolution_instance_name';
    const applyChannel = (channel: ChannelRow) => {
      const dispatch = resolveChannelDispatch(channel, envAccessToken);
      resolvedProvider = dispatch.provider;
      if (dispatch.provider === 'evolution') {
        evolutionCreds = dispatch.evolutionCreds;
        accessToken = 'evolution'; // sentinel truthy — guards abaixo só checam presença
        phoneNumberId = dispatch.phoneNumberId;
        return;
      }
      accessToken = dispatch.accessToken;
      phoneNumberId = dispatch.phoneNumberId;
    };

    if (channel_id) {
      // Explicit channel_id — look up credentials for this specific channel
      const { data: channel } = await supabase
        .from('settings_whatsapp_channels')
        .select(CHANNEL_SELECT)
        .eq('id', channel_id)
        .eq('active', true)
        .single();

      if (channel) {
        applyChannel(channel as unknown as ChannelRow);
        if (resolvedProvider === 'meta' && !(channel as unknown as ChannelRow).access_token) {
          console.warn(`whatsapp-outbound: channel_id ${channel_id} has no access_token, using env fallback`);
        }
      } else {
        console.warn(`whatsapp-outbound: channel_id ${channel_id} not found or inactive, falling back to default`);
      }
    }

    // Legacy phone_number_id param — resolvido via o MESMO lookup .or() usado nos
    // passos abaixo, nunca confiado diretamente. Antes, um phone_number_id cru
    // (+ envAccessToken já truthy) pulava toda detecção de provider e mandava via
    // Meta mesmo quando o id era, na real, de um canal Evolution.
    if ((!phoneNumberId || !accessToken) && bodyPhoneNumberId) {
      const { data: channel } = await supabase
        .from('settings_whatsapp_channels')
        .select(CHANNEL_SELECT)
        .or(`phone_number_id.eq.${bodyPhoneNumberId},id.eq.${bodyPhoneNumberId}`)
        .eq('active', true)
        .maybeSingle();

      if (channel) {
        applyChannel(channel as unknown as ChannelRow);
        console.log(`whatsapp-outbound: resolved channel from legacy phone_number_id param provider=${resolvedProvider}`);
      } else {
        console.warn(`whatsapp-outbound: legacy phone_number_id param ${bodyPhoneNumberId} matched no active channel`);
      }
    }

    // Canal "atual" da pessoa (clients_people.active_channel_id) — fonte de verdade
    // de "que canal esse lead está usando agora", mantida em sincronia automaticamente
    // (trg_sync_active_channel) e sobrescrevível manualmente na UI (Kanban/Omni).
    // Prioridade ANTES do canal padrão: senão, com qualquer canal padrão configurado,
    // toda resposta de IA/FUP/Sends PRO iria por ele, nunca pelo canal real do cliente
    // (esse era o bug — Meta+Evolution coexistindo tornava isso incorreto na prática).
    if ((!phoneNumberId || !accessToken) && people_id) {
      const { data: person } = await supabase
        .from('clients_people')
        .select('active_channel_id')
        .eq('id', people_id)
        .maybeSingle();

      const activeChannelId = (person as { active_channel_id?: string | null } | null)?.active_channel_id;
      if (activeChannelId) {
        const { data: channel } = await supabase
          .from('settings_whatsapp_channels')
          .select(CHANNEL_SELECT)
          .eq('id', activeChannelId)
          .eq('active', true)
          .maybeSingle();

        if (channel) {
          applyChannel(channel as unknown as ChannelRow);
          console.log(`whatsapp-outbound: resolved channel from person's active_channel_id provider=${resolvedProvider}`);
        }
      }
    }

    // No channel_id, no phone_number_id, or token not yet resolved → try to resolve automatically (3 fallbacks)
    if (!phoneNumberId || !accessToken) {
      // 1. Default channel (is_default = true)
      const { data: defaultChannel } = await supabase
        .from('settings_whatsapp_channels')
        .select(CHANNEL_SELECT)
        .eq('is_default', true)
        .eq('active', true)
        .maybeSingle();

      if (defaultChannel) {
        applyChannel(defaultChannel as unknown as ChannelRow);
        console.log(`whatsapp-outbound: using default channel provider=${resolvedProvider} phone_number_id=${phoneNumberId}`);
      }
    }

    // 2. Rede de segurança: canal da última mensagem recebida da pessoa
    // (wa_phone_number_id). Normalmente redundante com active_channel_id (o trigger
    // mantém os dois em sincronia), mas cobre o caso de uma pessoa cujo
    // active_channel_id ainda não foi resolvido/backfilled. Mensagens vindas de canal
    // Evolution guardam o id (uuid) do canal nesta MESMA coluna (não um phone_number_id
    // Meta) — por isso o match é por phone_number_id OU id.
    if ((!phoneNumberId || !accessToken) && people_id) {
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('wa_phone_number_id')
        .eq('people_id', people_id)
        .eq('from_contact', 'cliente')
        .not('wa_phone_number_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastPhoneId = (lastMsg as any)?.wa_phone_number_id as string | null;
      if (lastPhoneId) {
        const { data: channel } = await supabase
          .from('settings_whatsapp_channels')
          .select(CHANNEL_SELECT)
          .or(`phone_number_id.eq.${lastPhoneId},id.eq.${lastPhoneId}`)
          .eq('active', true)
          .maybeSingle();

        if (channel) {
          applyChannel(channel as unknown as ChannelRow);
          console.log(`whatsapp-outbound: resolved channel from last inbound msg provider=${resolvedProvider} phone_number_id=${phoneNumberId}`);
        }
      }
    }

    // 3. Any active channel as last resort
    if (!phoneNumberId || !accessToken) {
      const { data: anyChannel } = await supabase
        .from('settings_whatsapp_channels')
        .select(CHANNEL_SELECT)
        .eq('active', true)
        .limit(1)
        .maybeSingle();

      if (anyChannel) {
        applyChannel(anyChannel as unknown as ChannelRow);
        console.log(`whatsapp-outbound: using fallback channel provider=${resolvedProvider} phone_number_id=${phoneNumberId}`);
      }
    }

    if (resolvedProvider === 'evolution' && !evolutionCreds) {
      return new Response(
        JSON.stringify({ error: 'Canal Evolution resolvido sem credenciais completas (base_url/api_key/instance_name).' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'No access token available. Configure a WhatsApp channel or set WHATSAPP_ACCESS_TOKEN env var.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!phoneNumberId) {
      return new Response(
        JSON.stringify({ error: 'phone_number_id not resolved. No active WhatsApp channel found.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    // Fetch person name once for template param hydration (used when components arrive with text='')
    let resolvedPersonName: string | undefined;
    if (people_id) {
      const { data: personRow } = await supabase
        .from('clients_people')
        .select('name')
        .eq('id', people_id)
        .maybeSingle();
      resolvedPersonName = (personRow as { name?: string } | null)?.name || undefined;
    }

    const wamids: string[] = [];
    const failed: number[] = [];
    const errors: string[] = [];
    const diagAll: Diag[] = [];

    for (let i = 0; i < messages.length; i++) {
      const rawItem = messages[i];

      // Template message — bypass normalise, use dedicated sender
      if (typeof rawItem === 'object' && rawItem.type === 'template') {
        const result = resolvedProvider === 'evolution'
          ? await sendTemplateToEvolution(supabase, evolutionCreds!, to, rawItem as TemplateMessageObj)
          : await sendTemplateToMeta(accessToken, phoneNumberId, to, rawItem as TemplateMessageObj, resolvedPersonName);

        if (result && 'wamid' in result) {
          wamids.push(result.wamid);
          const msgId = message_ids?.[i];
          if (msgId) {
            await supabase.from('messages').update({ wa_message_id: result.wamid, status: 'sent', sent_at: new Date().toISOString() }).eq('id', msgId);
            await recordDeliveryAttempt(supabase, msgId, { success: true, wamid: result.wamid });
          }
        } else {
          const errReason = (result && 'error' in result) ? result.error : 'Erro desconhecido ao enviar template';
          errors.push(errReason);
          failed.push(i);
          console.error(`Template send failed: ${errReason}`);
          const msgId = message_ids?.[i];
          if (msgId) {
            // Update status first (critical) — then merge delivery log into metadata (preserves template_name/components/etc)
            await supabase.from('messages').update({ status: 'error' }).eq('id', msgId);
            await recordDeliveryAttempt(supabase, msgId, { success: false, error: errReason });
          }
        }
        continue;
      }

      // Interactive button message — handle before normalise (different payload shape)
      if (typeof rawItem === 'object' && (rawItem as any).type === 'interactive') {
        const item = rawItem as { type: 'interactive'; body: string; buttons: string[] };
        const iResult = resolvedProvider === 'evolution'
          ? await sendInteractiveToEvolution(evolutionCreds!, to, item.body, item.buttons ?? [])
          : await sendInteractiveToMeta(accessToken, phoneNumberId, to, item.body, item.buttons ?? []);
        if (iResult && 'wamid' in iResult) wamids.push(iResult.wamid);
        else if (iResult && 'error' in iResult) errors.push(iResult.error);
        continue;
      }

      const msg = normalise(rawItem as string | OutboundMessageObj);

      // Skip fully empty text messages (e.g. media-only with no caption)
      if (msg.type === 'text' && !msg.text.trim()) continue;

      // Humanizer delay between text messages only (skip on first, skip for media)
      if (i > 0 && msg.type === 'text') await humanDelay(msg.text);

      const msgDiag: Diag = {
        download_bytes: null, download_error: null, upload_mime: null,
        upload_media_id: null, upload_error: null, signed_url_ok: null,
        meta_payload_type: null, meta_payload_link_or_id: null,
      };
      const result = resolvedProvider === 'evolution'
        ? await sendToEvolution(evolutionCreds!, to, msg)
        : await sendToMeta(accessToken, phoneNumberId, to, msg, supabaseUrl, serviceRoleKey, msgDiag);
      diagAll.push(msgDiag);

      if (result && 'wamid' in result) {
        wamids.push(result.wamid);

        // Update the message row: prefer direct ID, fall back to fuzzy match for AI messages
        const msgId = message_ids?.[i];
        if (msgId) {
          await supabase
            .from('messages')
            .update({ wa_message_id: result.wamid, status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', msgId);
          await recordDeliveryAttempt(supabase, msgId, {
            success: true,
            wamid: result.wamid,
            meta_payload_type: msgDiag.meta_payload_type,
          });
        } else if (people_id) {
          await supabase
            .from('messages')
            .update({ wa_message_id: result.wamid })
            .eq('people_id', people_id)
            .eq('content', msg.text)
            .eq('from_contact', 'ia')
            .is('wa_message_id', null)
            .order('created_at', { ascending: false })
            .limit(1);
        }
      } else {
        const errReason = (result && 'error' in result) ? result.error : 'Meta API returned no wamid';
        if (result && 'error' in result) errors.push(result.error);
        else errors.push(errReason);
        failed.push(i);

        const msgId = message_ids?.[i];
        if (msgId) {
          await supabase.from('messages').update({ status: 'error' }).eq('id', msgId);
          await recordDeliveryAttempt(supabase, msgId, {
            success: false,
            error: errReason,
            meta_payload_type: msgDiag.meta_payload_type,
          });
        } else if (people_id) {
          // Fuzzy match: find the row by people_id+content, set status, then merge delivery log
          const { data: targetRow } = await supabase
            .from('messages')
            .select('id')
            .eq('people_id', people_id)
            .eq('content', msg.text)
            .eq('from_contact', 'ia')
            .is('wa_message_id', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          const targetId = (targetRow as { id?: number } | null)?.id;
          if (targetId) {
            await supabase.from('messages').update({ status: 'error' }).eq('id', targetId);
            await recordDeliveryAttempt(supabase, targetId, {
              success: false,
              error: errReason,
              meta_payload_type: msgDiag.meta_payload_type,
            });
          }
        }
      }
    }

    const response = {
      sent: wamids.length,
      failed: failed.length,
      wamids,
      errors,
      diag: diagAll,
    };

    console.log(
      `whatsapp-outbound: sent=${wamids.length} failed=${failed.length} to=${to} phone_number_id=${phoneNumberId} channel_id=${channel_id ?? 'env'}`,
    );

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errorMessage = (err as Error).message;
    console.error('whatsapp-outbound error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
