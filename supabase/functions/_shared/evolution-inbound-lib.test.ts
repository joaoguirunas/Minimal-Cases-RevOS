/**
 * Tests for evolution-inbound-lib (parsing + ACK, pure logic used by evolution-webhook).
 *
 * Run: deno test supabase/functions/_shared/evolution-inbound-lib.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildStatusUpdate,
  extractMessageText,
  extractRemoteJidPhone,
  isGroupOrBroadcastJid,
  mapAckStatus,
  normalizeBRPhone,
  resolveMediaInfo,
  shouldAdvanceStatus,
  shouldSyncFromMeMessage,
} from './evolution-inbound-lib.ts';

// ── normalizeBRPhone ─────────────────────────────────────────────────────────

Deno.test('normalizeBRPhone: 12 digits (BR legacy, no 9th digit) gets the 9 injected', () => {
  assertEquals(normalizeBRPhone('554832121234'), '5548932121234');
});

Deno.test('normalizeBRPhone: 13 digits (already has the 9) passes through unchanged', () => {
  assertEquals(normalizeBRPhone('5548991898486'), '5548991898486');
});

Deno.test('normalizeBRPhone: strips non-digit characters before checking length', () => {
  assertEquals(normalizeBRPhone('+55 (48) 3212-1234'), '5548932121234');
});

Deno.test('normalizeBRPhone: non-BR / other lengths pass through unchanged', () => {
  assertEquals(normalizeBRPhone('12025550123'), '12025550123'); // US, 11 digits
});

// ── extractRemoteJidPhone ────────────────────────────────────────────────────

Deno.test('extractRemoteJidPhone: strips @s.whatsapp.net and normalizes', () => {
  assertEquals(extractRemoteJidPhone('554832121234@s.whatsapp.net'), '5548932121234');
});

Deno.test('extractRemoteJidPhone: already-9-digit number passes through', () => {
  assertEquals(extractRemoteJidPhone('5548991898486@s.whatsapp.net'), '5548991898486');
});

Deno.test('extractRemoteJidPhone: undefined remoteJid returns empty string', () => {
  assertEquals(extractRemoteJidPhone(undefined), '');
});

Deno.test('extractRemoteJidPhone: empty string remoteJid returns empty string', () => {
  assertEquals(extractRemoteJidPhone(''), '');
});

// ── isGroupOrBroadcastJid ────────────────────────────────────────────────────

Deno.test('isGroupOrBroadcastJid: @g.us is a group', () => {
  assertEquals(isGroupOrBroadcastJid('123456-789@g.us'), true);
});

Deno.test('isGroupOrBroadcastJid: @broadcast is a broadcast list', () => {
  assertEquals(isGroupOrBroadcastJid('status@broadcast'), true);
});

Deno.test('isGroupOrBroadcastJid: @s.whatsapp.net (1:1 contact) is not group/broadcast', () => {
  assertEquals(isGroupOrBroadcastJid('5548991898486@s.whatsapp.net'), false);
});

Deno.test('isGroupOrBroadcastJid: undefined returns false', () => {
  assertEquals(isGroupOrBroadcastJid(undefined), false);
});

// ── shouldSyncFromMeMessage ──────────────────────────────────────────────────

Deno.test('shouldSyncFromMeMessage: fromMe on a 1:1 contact -> syncs (phone-native send)', () => {
  assertEquals(shouldSyncFromMeMessage(true, '5548991898486@s.whatsapp.net'), true);
});

Deno.test('shouldSyncFromMeMessage: fromMe on a group -> never syncs', () => {
  assertEquals(shouldSyncFromMeMessage(true, '123456-789@g.us'), false);
});

Deno.test('shouldSyncFromMeMessage: fromMe on a broadcast list -> never syncs', () => {
  assertEquals(shouldSyncFromMeMessage(true, 'status@broadcast'), false);
});

Deno.test('shouldSyncFromMeMessage: not fromMe -> never syncs (this fn is only for the fromMe branch)', () => {
  assertEquals(shouldSyncFromMeMessage(false, '5548991898486@s.whatsapp.net'), false);
});

// ── extractMessageText ───────────────────────────────────────────────────────

Deno.test('extractMessageText: conversation (plain text)', () => {
  const result = extractMessageText({ message: { conversation: 'Oi, tudo bem?' } });
  assertEquals(result, { text: 'Oi, tudo bem?', msgType: 'texto' });
});

Deno.test('extractMessageText: extendedTextMessage (text with link preview/reply)', () => {
  const result = extractMessageText({ message: { extendedTextMessage: { text: 'com preview' } } });
  assertEquals(result, { text: 'com preview', msgType: 'texto' });
});

Deno.test('extractMessageText: conversation takes priority over extendedTextMessage when both present', () => {
  const result = extractMessageText({
    message: { conversation: 'principal', extendedTextMessage: { text: 'nao deveria aparecer' } },
  });
  assertEquals(result.text, 'principal');
});

Deno.test('extractMessageText: imageMessage with caption', () => {
  const result = extractMessageText({ message: { imageMessage: { caption: 'olha essa foto' } } });
  assertEquals(result, { text: 'olha essa foto', msgType: 'imagem' });
});

Deno.test('extractMessageText: imageMessage without caption falls back to placeholder', () => {
  const result = extractMessageText({ message: { imageMessage: {} } });
  assertEquals(result, { text: '[Imagem recebida]', msgType: 'imagem' });
});

Deno.test('extractMessageText: videoMessage without caption falls back to placeholder', () => {
  const result = extractMessageText({ message: { videoMessage: {} } });
  assertEquals(result, { text: '[Vídeo recebido]', msgType: 'video' });
});

Deno.test('extractMessageText: documentMessage prefers caption, then fileName, then placeholder', () => {
  assertEquals(
    extractMessageText({ message: { documentMessage: { caption: 'contrato', fileName: 'doc.pdf' } } }).text,
    'contrato',
  );
  assertEquals(
    extractMessageText({ message: { documentMessage: { fileName: 'doc.pdf' } } }).text,
    'doc.pdf',
  );
  assertEquals(
    extractMessageText({ message: { documentMessage: {} } }).text,
    '[Arquivo recebido]',
  );
});

Deno.test('extractMessageText: audioMessage always returns placeholder (no transcription in v1)', () => {
  const result = extractMessageText({ message: { audioMessage: {} } });
  assertEquals(result, { text: '[Áudio recebido]', msgType: 'audio' });
});

Deno.test('extractMessageText: stickerMessage returns placeholder, msgType imagem', () => {
  const result = extractMessageText({ message: { stickerMessage: {} } });
  assertEquals(result, { text: '[Sticker recebido]', msgType: 'imagem' });
});

Deno.test('extractMessageText: no message field at all returns empty text', () => {
  const result = extractMessageText({});
  assertEquals(result, { text: '', msgType: 'texto' });
});

Deno.test('extractMessageText: unrecognized message shape falls back to generic placeholder', () => {
  // deno-lint-ignore no-explicit-any
  const result = extractMessageText({ message: { pollCreationMessage: {} } as any });
  assertEquals(result, { text: '[Mensagem recebida]', msgType: 'texto' });
});

// ── resolveMediaInfo ──────────────────────────────────────────────────────────

Deno.test('resolveMediaInfo: no message -> null', () => {
  assertEquals(resolveMediaInfo({}), null);
});

Deno.test('resolveMediaInfo: text-only message -> null (nothing to download)', () => {
  assertEquals(resolveMediaInfo({ message: { conversation: 'oi' } }), null);
});

Deno.test('resolveMediaInfo: media type present but no base64 -> null (Evolution did not decrypt it)', () => {
  assertEquals(resolveMediaInfo({ message: { imageMessage: { mimetype: 'image/png' } } }), null);
});

Deno.test('resolveMediaInfo: sticker (real payload shape confirmed against production server)', () => {
  const result = resolveMediaInfo({
    message: { base64: 'UklGRg==', stickerMessage: { mimetype: 'image/webp' } },
  });
  assertEquals(result, { mediaCategory: 'imagem', mimetype: 'image/webp', fileName: 'sticker.webp' });
});

Deno.test('resolveMediaInfo: sticker with no mimetype falls back to image/webp', () => {
  const result = resolveMediaInfo({ message: { base64: 'AAAA', stickerMessage: {} } });
  assertEquals(result?.mimetype, 'image/webp');
});

Deno.test('resolveMediaInfo: image uses its own mimetype', () => {
  const result = resolveMediaInfo({
    message: { base64: 'AAAA', imageMessage: { mimetype: 'image/png', caption: 'foto' } },
  });
  assertEquals(result, { mediaCategory: 'imagem', mimetype: 'image/png', fileName: 'image.jpg' });
});

Deno.test('resolveMediaInfo: video', () => {
  const result = resolveMediaInfo({ message: { base64: 'AAAA', videoMessage: { mimetype: 'video/mp4' } } });
  assertEquals(result, { mediaCategory: 'video', mimetype: 'video/mp4', fileName: 'video.mp4' });
});

Deno.test('resolveMediaInfo: audio', () => {
  const result = resolveMediaInfo({ message: { base64: 'AAAA', audioMessage: { mimetype: 'audio/ogg; codecs=opus' } } });
  assertEquals(result, { mediaCategory: 'audio', mimetype: 'audio/ogg; codecs=opus', fileName: 'audio.ogg' });
});

Deno.test('resolveMediaInfo: document uses its real fileName when present', () => {
  const result = resolveMediaInfo({
    message: { base64: 'AAAA', documentMessage: { mimetype: 'application/pdf', fileName: 'contrato.pdf' } },
  });
  assertEquals(result, { mediaCategory: 'arquivo', mimetype: 'application/pdf', fileName: 'contrato.pdf' });
});

Deno.test('resolveMediaInfo: document with no fileName falls back to "document"', () => {
  const result = resolveMediaInfo({ message: { base64: 'AAAA', documentMessage: { mimetype: 'application/pdf' } } });
  assertEquals(result?.fileName, 'document');
});

Deno.test('resolveMediaInfo: missing mimetype on any type falls back to a sane default', () => {
  assertEquals(resolveMediaInfo({ message: { base64: 'AAAA', audioMessage: {} } })?.mimetype, 'audio/ogg');
  assertEquals(resolveMediaInfo({ message: { base64: 'AAAA', imageMessage: {} } })?.mimetype, 'image/jpeg');
  assertEquals(resolveMediaInfo({ message: { base64: 'AAAA', videoMessage: {} } })?.mimetype, 'video/mp4');
  assertEquals(resolveMediaInfo({ message: { base64: 'AAAA', documentMessage: {} } })?.mimetype, 'application/octet-stream');
});

// ── mapAckStatus ─────────────────────────────────────────────────────────────

Deno.test('mapAckStatus: maps the 4 known Evolution ACK strings', () => {
  assertEquals(mapAckStatus('SERVER_ACK'), 'sent');
  assertEquals(mapAckStatus('DELIVERY_ACK'), 'delivered');
  assertEquals(mapAckStatus('READ'), 'read');
  assertEquals(mapAckStatus('PLAYED'), 'read');
});

Deno.test('mapAckStatus: is case-insensitive (server sends lowercase in some versions)', () => {
  assertEquals(mapAckStatus('read'), 'read');
  assertEquals(mapAckStatus('server_ack'), 'sent');
});

Deno.test('mapAckStatus: PENDING and unknown values return null (ignored, not a delivery signal)', () => {
  assertEquals(mapAckStatus('PENDING'), null);
  assertEquals(mapAckStatus('SOMETHING_ELSE'), null);
  assertEquals(mapAckStatus(''), null);
});

// ── shouldAdvanceStatus ──────────────────────────────────────────────────────

Deno.test('shouldAdvanceStatus: sent -> delivered -> read is a valid forward progression', () => {
  assertEquals(shouldAdvanceStatus('sent', 'delivered'), true);
  assertEquals(shouldAdvanceStatus('delivered', 'read'), true);
  assertEquals(shouldAdvanceStatus('sent', 'read'), true); // skipping delivered is fine
});

Deno.test('shouldAdvanceStatus: never regresses (read -> delivered, delivered -> sent)', () => {
  assertEquals(shouldAdvanceStatus('read', 'delivered'), false);
  assertEquals(shouldAdvanceStatus('delivered', 'sent'), false);
});

Deno.test('shouldAdvanceStatus: same status twice (duplicate webhook) does not re-advance', () => {
  assertEquals(shouldAdvanceStatus('delivered', 'delivered'), false);
});

Deno.test('shouldAdvanceStatus: a row already marked error never advances (terminal state)', () => {
  assertEquals(shouldAdvanceStatus('error', 'read'), false);
  assertEquals(shouldAdvanceStatus('error', 'sent'), false);
});

Deno.test('shouldAdvanceStatus: unknown current status ranks as 0 (below sent), so any known status advances', () => {
  assertEquals(shouldAdvanceStatus('pending', 'sent'), true);
});

// ── buildStatusUpdate ────────────────────────────────────────────────────────

Deno.test('buildStatusUpdate: "sent" only sets status, no timestamps', () => {
  const update = buildStatusUpdate('sent', false, '2026-08-10T12:00:00.000Z');
  assertEquals(update, { status: 'sent' });
});

Deno.test('buildStatusUpdate: "delivered" sets delivered_at', () => {
  const update = buildStatusUpdate('delivered', false, '2026-08-10T12:00:00.000Z');
  assertEquals(update, { status: 'delivered', delivered_at: '2026-08-10T12:00:00.000Z' });
});

Deno.test('buildStatusUpdate: "read" without a prior delivered_at backfills it (out-of-order ACK)', () => {
  const update = buildStatusUpdate('read', false, '2026-08-10T12:00:00.000Z');
  assertEquals(update, {
    status: 'read',
    read_at: '2026-08-10T12:00:00.000Z',
    delivered_at: '2026-08-10T12:00:00.000Z',
  });
});

Deno.test('buildStatusUpdate: "read" with an existing delivered_at does NOT overwrite it', () => {
  const update = buildStatusUpdate('read', true, '2026-08-10T12:00:00.000Z');
  assertEquals(update, { status: 'read', read_at: '2026-08-10T12:00:00.000Z' });
});
