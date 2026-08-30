/**
 * Tests for evolution-client (REST wrapper for the self-hosted Evolution API).
 *
 * Run: deno test --allow-net --allow-env \
 *   supabase/functions/_shared/evolution-client.test.ts
 *
 * No real network: `globalThis.fetch` is swapped for a stub around each test
 * (evolution-client.ts calls global `fetch` directly — there's no injectable
 * `fetchImpl` seam like kiwify-client.ts has). Retry-backoff delays (500ms
 * fixed step) are real `setTimeout`s in the source, so the 2 tests that
 * exercise a transient-error retry incur a real ~500ms wait each — kept to
 * the minimum needed to prove the behavior once.
 */

import {
  assertEquals,
  assertExists,
  assertThrows,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildEvolutionWebhookConfig,
  createEvolutionClient,
  formatRecipient,
  qrToDataUrl,
  toCanonicalStatus,
  verifyEvolutionWebhookAuth,
  EVOLUTION_WEBHOOK_EVENTS,
  type EvolutionConnectResult,
} from './evolution-client.ts';

// ── Fakes ────────────────────────────────────────────────────────────────────

interface StubResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

/** Builds a fetch stub that returns queued responses in order (replays the last one) and records calls. */
function stubFetch(responses: StubResponse[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let i = 0;
  const impl = ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    const noBody = r.status === 204 || r.status === 205;
    const res = new Response(noBody ? null : JSON.stringify(r.body), {
      status: r.status,
      headers: { 'Content-Type': 'application/json', ...(r.headers ?? {}) },
    });
    return Promise.resolve(res);
  }) as unknown as typeof fetch;
  return { impl, calls, count: () => i };
}

/** Rejects immediately with a plain (non-abort) error — simulates DNS/connection-refused. */
function rejectFetch(message: string): typeof fetch {
  return (() => Promise.reject(new Error(message))) as unknown as typeof fetch;
}

/** Never settles until the AbortSignal fires, then rejects like real fetch does on abort. */
function hangingFetch(): typeof fetch {
  return ((_url: string | URL | Request, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  }) as unknown as typeof fetch;
}

async function withFetch<T>(impl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const orig = globalThis.fetch;
  // deno-lint-ignore no-explicit-any
  (globalThis as any).fetch = impl;
  try {
    return await fn();
  } finally {
    // deno-lint-ignore no-explicit-any
    (globalThis as any).fetch = orig;
  }
}

const CFG = { baseUrl: 'https://evo.test', apiKey: 'k_123' };

// ── toCanonicalStatus ─────────────────────────────────────────────────────────

Deno.test('toCanonicalStatus: open -> WORKING', () => {
  assertEquals(toCanonicalStatus('open'), 'WORKING');
});

Deno.test('toCanonicalStatus: connecting + hasPendingQr=true -> SCAN_QR_CODE', () => {
  assertEquals(toCanonicalStatus('connecting', true), 'SCAN_QR_CODE');
});

Deno.test('toCanonicalStatus: connecting + hasPendingQr=false (default) -> STARTING', () => {
  assertEquals(toCanonicalStatus('connecting'), 'STARTING');
  assertEquals(toCanonicalStatus('connecting', false), 'STARTING');
});

Deno.test('toCanonicalStatus: close -> STOPPED', () => {
  assertEquals(toCanonicalStatus('close'), 'STOPPED');
});

Deno.test('toCanonicalStatus: unknown string -> FAILED', () => {
  assertEquals(toCanonicalStatus('whatever'), 'FAILED');
});

Deno.test(
  'toCanonicalStatus: undefined/null -> FAILED (documents the connect-without-"state" bug; ' +
    'the real fix is a hasQr short-circuit in evolution-session-manage/index.ts, NOT in this pure fn)',
  () => {
    assertEquals(toCanonicalStatus(undefined), 'FAILED');
    assertEquals(toCanonicalStatus(null), 'FAILED');
    assertEquals(toCanonicalStatus(undefined, true), 'FAILED'); // hasPendingQr only affects the "connecting" branch
  },
);

// ── formatRecipient ───────────────────────────────────────────────────────────

Deno.test('formatRecipient: 10-digit BR local number gets 55 prepended AND the 9 injected', () => {
  assertEquals(formatRecipient('4832121234'), '5548932121234');
});

Deno.test('formatRecipient: 11-digit BR local number (already has the 9) just gets 55 prepended', () => {
  assertEquals(formatRecipient('48991898486'), '5548991898486');
});

Deno.test('formatRecipient: 12-digit with 55 already present (legacy, no 9) gets the 9 injected', () => {
  assertEquals(formatRecipient('554832121234'), '5548932121234');
});

Deno.test('formatRecipient: 13-digit already-correct number passes through unchanged', () => {
  assertEquals(formatRecipient('5548991898486'), '5548991898486');
});

Deno.test('formatRecipient: strips non-digit formatting before checking length', () => {
  assertEquals(formatRecipient('+55 (48) 99189-8486'), '5548991898486');
});

Deno.test('formatRecipient: empty / non-numeric input returns empty string', () => {
  assertEquals(formatRecipient(''), '');
  assertEquals(formatRecipient('abc'), '');
});

Deno.test('formatRecipient: 11-digit non-BR number still gets 55 prepended (BR-only heuristic, no country detection)', () => {
  // '12025550123' (US, 11 digits) is indistinguishable from a BR 11-digit local
  // number to this function — it always prepends 55 for 10/11-digit inputs.
  assertEquals(formatRecipient('12025550123'), '5512025550123');
});

Deno.test('formatRecipient: already has a non-55 country code (>11 digits) passes through unchanged', () => {
  assertEquals(formatRecipient('12025550123999'), '12025550123999'); // 14 digits, not 10/11/12
});

// ── verifyEvolutionWebhookAuth ────────────────────────────────────────────────

Deno.test('verifyEvolutionWebhookAuth: exact match (no Bearer prefix) succeeds', () => {
  assertEquals(verifyEvolutionWebhookAuth({ headerToken: 'tok123', expectedToken: 'tok123' }), true);
});

Deno.test('verifyEvolutionWebhookAuth: strips "Bearer " prefix before comparing', () => {
  assertEquals(verifyEvolutionWebhookAuth({ headerToken: 'Bearer tok123', expectedToken: 'tok123' }), true);
});

Deno.test('verifyEvolutionWebhookAuth: wrong token, same length -> false', () => {
  assertEquals(verifyEvolutionWebhookAuth({ headerToken: 'tok124', expectedToken: 'tok123' }), false);
});

Deno.test('verifyEvolutionWebhookAuth: different length -> false (no substring/prefix match)', () => {
  assertEquals(verifyEvolutionWebhookAuth({ headerToken: 'tok12', expectedToken: 'tok123' }), false);
  assertEquals(verifyEvolutionWebhookAuth({ headerToken: 'tok12345', expectedToken: 'tok123' }), false);
});

Deno.test('verifyEvolutionWebhookAuth: missing/empty header or expected token -> false', () => {
  assertEquals(verifyEvolutionWebhookAuth({ headerToken: null, expectedToken: 'tok123' }), false);
  assertEquals(verifyEvolutionWebhookAuth({ headerToken: undefined, expectedToken: 'tok123' }), false);
  assertEquals(verifyEvolutionWebhookAuth({ headerToken: '', expectedToken: 'tok123' }), false);
  assertEquals(verifyEvolutionWebhookAuth({ headerToken: 'tok123', expectedToken: '' }), false);
  assertEquals(verifyEvolutionWebhookAuth({ headerToken: null, expectedToken: null }), false);
});

// ── qrToDataUrl ───────────────────────────────────────────────────────────────

Deno.test('qrToDataUrl: null/undefined connect -> null', () => {
  assertEquals(qrToDataUrl(null), null);
  assertEquals(qrToDataUrl(undefined), null);
});

Deno.test('qrToDataUrl: connect with no base64 field -> null', () => {
  assertEquals(qrToDataUrl({ pairingCode: '123-456' } as EvolutionConnectResult), null);
});

Deno.test('qrToDataUrl: already-prefixed data URL passes through unchanged', () => {
  const input = 'data:image/png;base64,AAAA';
  assertEquals(qrToDataUrl({ base64: input }), input);
});

Deno.test('qrToDataUrl: raw base64 (no prefix) gets the data:image/png prefix added', () => {
  assertEquals(qrToDataUrl({ base64: 'AAAA' }), 'data:image/png;base64,AAAA');
});

Deno.test('qrToDataUrl: base64 with a stray literal "base64," prefix (no "data:") has it stripped first', () => {
  assertEquals(qrToDataUrl({ base64: 'base64,AAAA' }), 'data:image/png;base64,AAAA');
});

// ── buildEvolutionWebhookConfig ───────────────────────────────────────────────

Deno.test('buildEvolutionWebhookConfig: default events, byEvents=false, base64=true, no path secret', () => {
  const cfg = buildEvolutionWebhookConfig({ supabaseUrl: 'https://proj.supabase.co', webhookToken: 'tok' });
  assertEquals(cfg.url, 'https://proj.supabase.co/functions/v1/evolution-webhook');
  assertEquals(cfg.byEvents, false);
  assertEquals(cfg.base64, true);
  assertEquals(cfg.events, [...EVOLUTION_WEBHOOK_EVENTS]);
  assertEquals(cfg.headers, { authorization: 'Bearer tok' });
});

Deno.test('buildEvolutionWebhookConfig: pathSecret appends /:secret to the URL (URL-encoded)', () => {
  const cfg = buildEvolutionWebhookConfig({
    supabaseUrl: 'https://proj.supabase.co',
    webhookToken: 'tok',
    pathSecret: 'a/b c',
  });
  assertEquals(cfg.url, 'https://proj.supabase.co/functions/v1/evolution-webhook/a%2Fb%20c');
});

Deno.test('buildEvolutionWebhookConfig: strips trailing slash(es) from supabaseUrl', () => {
  const cfg = buildEvolutionWebhookConfig({ supabaseUrl: 'https://proj.supabase.co///', webhookToken: 'tok' });
  assertEquals(cfg.url, 'https://proj.supabase.co/functions/v1/evolution-webhook');
});

Deno.test('buildEvolutionWebhookConfig: honors custom events + base64 override', () => {
  const cfg = buildEvolutionWebhookConfig({
    supabaseUrl: 'https://proj.supabase.co',
    webhookToken: 'tok',
    events: ['MESSAGES_UPSERT'],
    base64: false,
  });
  assertEquals(cfg.events, ['MESSAGES_UPSERT']);
  assertEquals(cfg.base64, false);
});

// ── createEvolutionClient: construction guards ────────────────────────────────

Deno.test('createEvolutionClient: throws without baseUrl', () => {
  assertThrows(() => createEvolutionClient({ baseUrl: '', apiKey: 'k' }));
});

Deno.test('createEvolutionClient: throws without apiKey', () => {
  assertThrows(() => createEvolutionClient({ baseUrl: 'https://evo.test', apiKey: '' }));
});

// ── HTTP plumbing: headers, URL building, trailing slash ──────────────────────

Deno.test('request: sends apikey header (not Authorization) and Accept: application/json', async () => {
  const f = stubFetch([{ status: 200, body: { instance: { state: 'open' } } }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    await client.instances.connectionState('crm-principal');
  });
  const headers = f.calls[0].init!.headers as Record<string, string>;
  assertEquals(headers['apikey'], 'k_123');
  assertEquals(headers['Accept'], 'application/json');
  assertEquals(headers['Authorization'], undefined);
});

Deno.test('request: GET without a body omits Content-Type', async () => {
  const f = stubFetch([{ status: 200, body: {} }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    await client.instances.connectionState('i1');
  });
  const headers = f.calls[0].init!.headers as Record<string, string>;
  assertEquals(headers['Content-Type'], undefined);
});

Deno.test('request: POST with a body sets Content-Type: application/json and JSON-serializes it', async () => {
  const f = stubFetch([{ status: 200, body: { key: { id: 'wamid1' } } }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    await client.messages.sendText({ instance: 'i1', to: '5548991898486', text: 'oi' });
  });
  const init = f.calls[0].init!;
  assertEquals((init.headers as Record<string, string>)['Content-Type'], 'application/json');
  assertEquals(JSON.parse(init.body as string), { number: '5548991898486', text: 'oi' });
});

Deno.test('createEvolutionClient: strips trailing slash(es) from baseUrl (no double slash in requests)', async () => {
  const f = stubFetch([{ status: 200, body: {} }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient({ baseUrl: 'https://evo.test///', apiKey: 'k' });
    await client.instances.connectionState('i1');
  });
  assertEquals(f.calls[0].url, 'https://evo.test/instance/connectionState/i1');
});

Deno.test('request: URL-encodes instance names with special characters', async () => {
  const f = stubFetch([{ status: 200, body: {} }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    await client.instances.connectionState('crm principal/2');
  });
  assertEquals(f.calls[0].url, 'https://evo.test/instance/connectionState/crm%20principal%2F2');
});

// ── instances.create ──────────────────────────────────────────────────────────

Deno.test('instances.create: default body (integration WHATSAPP-BAILEYS, qrcode:true), no token/webhook', async () => {
  const f = stubFetch([{ status: 200, body: { instanceName: 'i1' } }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    const res = await client.instances.create('i1');
    assertEquals(res.ok, true);
  });
  assertEquals(f.calls[0].url, 'https://evo.test/instance/create');
  assertEquals(f.calls[0].init!.method, 'POST');
  const body = JSON.parse(f.calls[0].init!.body as string);
  assertEquals(body, { instanceName: 'i1', integration: 'WHATSAPP-BAILEYS', qrcode: true });
});

Deno.test('instances.create: custom integration + token are included when provided', async () => {
  const f = stubFetch([{ status: 200, body: {} }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    await client.instances.create('i1', { integration: 'WHATSAPP-BUSINESS', token: 'inst-tok' });
  });
  const body = JSON.parse(f.calls[0].init!.body as string);
  assertEquals(body.integration, 'WHATSAPP-BUSINESS');
  assertEquals(body.token, 'inst-tok');
});

Deno.test('instances.create: webhook config is translated to the create-time webhook shape', async () => {
  const f = stubFetch([{ status: 200, body: {} }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    const webhook = buildEvolutionWebhookConfig({ supabaseUrl: 'https://proj.supabase.co', webhookToken: 'wtok' });
    await client.instances.create('i1', { webhook });
  });
  const body = JSON.parse(f.calls[0].init!.body as string);
  assertEquals(body.webhook, {
    enabled: true,
    url: 'https://proj.supabase.co/functions/v1/evolution-webhook',
    byEvents: false,
    base64: true,
    events: [...EVOLUTION_WEBHOOK_EVENTS],
    headers: { authorization: 'Bearer wtok' },
  });
});

Deno.test('instances.create: is a WRITE — a 400 (instance already exists) does NOT retry', async () => {
  const f = stubFetch([{ status: 400, body: { message: 'instance already exists' } }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    const res = await client.instances.create('i1');
    assertEquals(res.ok, false);
    if (!res.ok) {
      assertEquals(res.error, 'EVO_VALIDATION');
      assertEquals(res.message, 'instance already exists');
    }
  });
  assertEquals(f.count(), 1);
});

// ── instances.connect / connectionState ───────────────────────────────────────

Deno.test('instances.connect: GET /instance/connect/{instance}, returns QR result on success', async () => {
  const f = stubFetch([{ status: 200, body: { base64: 'AAAA', pairingCode: '123-456' } }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    const res = await client.instances.connect('i1');
    assertEquals(res.ok, true);
    if (res.ok) {
      assertEquals(res.data.base64, 'AAAA');
      assertEquals(res.data.pairingCode, '123-456');
    }
  });
  assertEquals(f.calls[0].url, 'https://evo.test/instance/connect/i1');
  assertEquals(f.calls[0].init!.method, 'GET');
});

Deno.test('instances.connect: real server never returns a "state" field (only pairingCode/code/base64/count)', async () => {
  // Regression fixture: mirrors the exact real-server shape that exposed the FAILED-despite-QR bug.
  const f = stubFetch([{ status: 200, body: { pairingCode: '123-456', code: 'abc', base64: 'AAAA', count: 1 } }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    const res = await client.instances.connect('i1');
    assertEquals(res.ok, true);
    if (res.ok) assertEquals((res.data as { state?: string }).state, undefined);
  });
});

Deno.test('instances.connectionState: GET /instance/connectionState/{instance}, surfaces instance.state', async () => {
  const f = stubFetch([{ status: 200, body: { instance: { instanceName: 'i1', state: 'open' } } }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    const res = await client.instances.connectionState('i1');
    assertEquals(res.ok, true);
    if (res.ok) assertEquals(res.data.instance?.state, 'open');
  });
  assertEquals(f.calls[0].url, 'https://evo.test/instance/connectionState/i1');
});

// ── instances.logout / delete / restart ───────────────────────────────────────

Deno.test('instances.logout: DELETE /instance/logout/{instance} (not POST — v2.3.7 quirk)', async () => {
  const f = stubFetch([{ status: 200, body: {} }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    await client.instances.logout('i1');
  });
  assertEquals(f.calls[0].init!.method, 'DELETE');
  assertEquals(f.calls[0].url, 'https://evo.test/instance/logout/i1');
});

Deno.test('instances.delete: DELETE /instance/delete/{instance}', async () => {
  const f = stubFetch([{ status: 200, body: {} }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    await client.instances.delete('i1');
  });
  assertEquals(f.calls[0].init!.method, 'DELETE');
  assertEquals(f.calls[0].url, 'https://evo.test/instance/delete/i1');
});

Deno.test('instances.restart: POST /instance/restart/{instance}', async () => {
  const f = stubFetch([{ status: 200, body: {} }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    await client.instances.restart('i1');
  });
  assertEquals(f.calls[0].init!.method, 'POST');
  assertEquals(f.calls[0].url, 'https://evo.test/instance/restart/i1');
});

// ── webhook.set / find ────────────────────────────────────────────────────────

Deno.test('webhook.set: POST /webhook/set/{instance} with the webhookBody shape', async () => {
  const f = stubFetch([{ status: 200, body: {} }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    const webhook = buildEvolutionWebhookConfig({ supabaseUrl: 'https://proj.supabase.co', webhookToken: 'wtok' });
    await client.webhook.set('i1', webhook);
  });
  assertEquals(f.calls[0].url, 'https://evo.test/webhook/set/i1');
  assertEquals(f.calls[0].init!.method, 'POST');
  const body = JSON.parse(f.calls[0].init!.body as string);
  assertEquals(body, {
    enabled: true,
    url: 'https://proj.supabase.co/functions/v1/evolution-webhook',
    byEvents: false,
    base64: true,
    events: [...EVOLUTION_WEBHOOK_EVENTS],
    headers: { authorization: 'Bearer wtok' },
  });
});

Deno.test('webhook.find: GET /webhook/find/{instance}', async () => {
  const f = stubFetch([{ status: 200, body: { url: 'https://proj.supabase.co/functions/v1/evolution-webhook' } }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    await client.webhook.find('i1');
  });
  assertEquals(f.calls[0].url, 'https://evo.test/webhook/find/i1');
  assertEquals(f.calls[0].init!.method, 'GET');
});

// ── messages.sendText ─────────────────────────────────────────────────────────

Deno.test('messages.sendText: minimal body is flat {number, text} — NOT nested {textMessage:{text}}', async () => {
  // Confirmed empirically against the real v2.3.7 server: nested shape gets an
  // immediate 400 ("instance requires property \"text\""); flat shape validates.
  const f = stubFetch([{ status: 200, body: { key: { id: 'wamid1' } } }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    await client.messages.sendText({ instance: 'i1', to: '5548991898486', text: 'oi' });
  });
  const body = JSON.parse(f.calls[0].init!.body as string);
  assertEquals(body, { number: '5548991898486', text: 'oi' });
  assertEquals(f.calls[0].url, 'https://evo.test/message/sendText/i1');
});

Deno.test('messages.sendText: optional delay/linkPreview/quoted are included only when provided', async () => {
  const f = stubFetch([{ status: 200, body: {} }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    await client.messages.sendText({
      instance: 'i1',
      to: '5548991898486',
      text: 'oi',
      delay: 1200,
      linkPreview: false,
      quoted: 'wamid_prev',
    });
  });
  const body = JSON.parse(f.calls[0].init!.body as string);
  assertEquals(body, {
    number: '5548991898486',
    text: 'oi',
    delay: 1200,
    linkPreview: false,
    quoted: { key: { id: 'wamid_prev' } },
  });
});

Deno.test('messages.sendText: extracts key.id from the response as wa_message_id', async () => {
  const f = stubFetch([{ status: 200, body: { key: { id: 'wamid_abc', remoteJid: '5548991898486@s.whatsapp.net', fromMe: true } } }]);
  const res = await withFetch(f.impl, () => {
    const client = createEvolutionClient(CFG);
    return client.messages.sendText({ instance: 'i1', to: '5548991898486', text: 'oi' });
  });
  assertEquals(res.ok, true);
  if (res.ok) assertEquals(res.data.key?.id, 'wamid_abc');
});

// ── messages.sendMedia / sendAudio ────────────────────────────────────────────

Deno.test('messages.sendMedia: body includes mediatype/media, caption+fileName only when provided', async () => {
  const f = stubFetch([{ status: 200, body: {} }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    await client.messages.sendMedia({
      instance: 'i1',
      to: '5548991898486',
      mediatype: 'image',
      media: 'https://cdn.test/img.jpg',
      caption: 'olha isso',
      fileName: 'img.jpg',
    });
  });
  assertEquals(f.calls[0].url, 'https://evo.test/message/sendMedia/i1');
  const body = JSON.parse(f.calls[0].init!.body as string);
  assertEquals(body, {
    number: '5548991898486',
    mediatype: 'image',
    media: 'https://cdn.test/img.jpg',
    caption: 'olha isso',
    fileName: 'img.jpg',
  });
});

Deno.test('messages.sendMedia: omits caption/fileName/delay when not given', async () => {
  const f = stubFetch([{ status: 200, body: {} }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    await client.messages.sendMedia({ instance: 'i1', to: '5548991898486', mediatype: 'document', media: 'aGVsbG8=' });
  });
  const body = JSON.parse(f.calls[0].init!.body as string);
  assertEquals(body, { number: '5548991898486', mediatype: 'document', media: 'aGVsbG8=' });
});

Deno.test('messages.sendAudio: POST /message/sendWhatsAppAudio/{instance} with {number, audio}', async () => {
  const f = stubFetch([{ status: 200, body: {} }]);
  await withFetch(f.impl, async () => {
    const client = createEvolutionClient(CFG);
    await client.messages.sendAudio({ instance: 'i1', to: '5548991898486', audio: 'https://cdn.test/a.ogg' });
  });
  assertEquals(f.calls[0].url, 'https://evo.test/message/sendWhatsAppAudio/i1');
  const body = JSON.parse(f.calls[0].init!.body as string);
  assertEquals(body, { number: '5548991898486', audio: 'https://cdn.test/a.ogg' });
});

// ── Error classification by HTTP status ───────────────────────────────────────

const CLASSIFICATION_CASES: Array<[number, string]> = [
  [401, 'EVO_AUTH'],
  [403, 'EVO_AUTH'],
  [404, 'EVO_NOT_FOUND'],
  [400, 'EVO_VALIDATION'],
  [422, 'EVO_VALIDATION'],
  [429, 'EVO_RATE_LIMIT'],
  [418, 'EVO_UNKNOWN'],
];

for (const [status, expected] of CLASSIFICATION_CASES) {
  Deno.test(`error classification: HTTP ${status} -> ${expected} (non-transient, no retry)`, async () => {
    const f = stubFetch([{ status, body: { message: `boom ${status}` } }]);
    const res = await withFetch(f.impl, () => {
      const client = createEvolutionClient(CFG);
      return client.instances.connectionState('i1'); // retryable=true, but non-transient codes short-circuit
    });
    assertEquals(res.ok, false);
    if (!res.ok) {
      assertEquals(res.error, expected);
      assertEquals(res.status, status);
      assertEquals(res.message, `boom ${status}`);
    }
    assertEquals(f.count(), 1);
  });
}

Deno.test('error classification: message falls back to raw body text (sliced) when there is no JSON "message" field', async () => {
  const f = stubFetch([{ status: 400, body: { errors: ['x'] } }]); // no top-level "message"
  const res = await withFetch(f.impl, () => {
    const client = createEvolutionClient(CFG);
    return client.instances.connectionState('i1');
  });
  assertEquals(res.ok, false);
  if (!res.ok) assertExists(res.message);
});

Deno.test('response parsing: non-JSON success body is returned as raw text instead of throwing', async () => {
  const impl = (() => Promise.resolve(new Response('not-json{body', { status: 200 }))) as unknown as typeof fetch;
  const res = await withFetch(impl, () => {
    const client = createEvolutionClient(CFG);
    return client.instances.connectionState('i1');
  });
  assertEquals(res.ok, true);
  if (res.ok) assertEquals(res.data as unknown as string, 'not-json{body');
});

Deno.test('response parsing: empty body (e.g. 204-shaped DELETE) parses to undefined data, not a throw', async () => {
  const f = stubFetch([{ status: 204, body: {} }]);
  const res = await withFetch(f.impl, () => {
    const client = createEvolutionClient(CFG);
    return client.instances.logout('i1');
  });
  assertEquals(res.ok, true);
  if (res.ok) assertEquals(res.data, undefined);
});

// ── Retry behavior (real short waits — kept to the minimum needed) ────────────

Deno.test('retry: a READ retries on 5xx and succeeds once a later attempt returns 200', async () => {
  const f = stubFetch([
    { status: 500, body: { message: 'server error' } },
    { status: 200, body: { instance: { state: 'open' } } },
  ]);
  const res = await withFetch(f.impl, () => {
    const client = createEvolutionClient({ ...CFG, maxReadRetries: 3 });
    return client.instances.connectionState('i1');
  });
  assertEquals(res.ok, true);
  assertEquals(f.count(), 2);
});

Deno.test('retry: a READ exhausts maxReadRetries on persistent 5xx and returns the last failure', async () => {
  const f = stubFetch([{ status: 503, body: { message: 'still down' } }]);
  const res = await withFetch(f.impl, () => {
    const client = createEvolutionClient({ ...CFG, maxReadRetries: 2 });
    return client.instances.connectionState('i1');
  });
  assertEquals(res.ok, false);
  if (!res.ok) assertEquals(res.error, 'EVO_SERVER');
  assertEquals(f.count(), 2);
});

Deno.test('retry: a WRITE never retries, even on a transient 5xx', async () => {
  const f = stubFetch([{ status: 500, body: { message: 'server error' } }]);
  const res = await withFetch(f.impl, () => {
    const client = createEvolutionClient({ ...CFG, maxReadRetries: 5 });
    return client.messages.sendText({ instance: 'i1', to: '5548991898486', text: 'oi' });
  });
  assertEquals(res.ok, false);
  assertEquals(f.count(), 1);
});

// ── Network errors + timeout ──────────────────────────────────────────────────

Deno.test('network error: fetch rejecting with a plain error classifies as EVO_NETWORK', async () => {
  const res = await withFetch(rejectFetch('getaddrinfo ENOTFOUND evo.test'), () => {
    const client = createEvolutionClient({ ...CFG, maxReadRetries: 1 });
    return client.instances.connectionState('i1');
  });
  assertEquals(res.ok, false);
  if (!res.ok) {
    assertEquals(res.error, 'EVO_NETWORK');
    assertEquals(res.status, 0);
    assertExists(res.message);
  }
});

Deno.test('timeout: an AbortController firing past timeoutMs classifies as EVO_TIMEOUT', async () => {
  const res = await withFetch(hangingFetch(), () => {
    const client = createEvolutionClient({ ...CFG, timeoutMs: 20, maxReadRetries: 1 });
    return client.instances.connectionState('i1');
  });
  assertEquals(res.ok, false);
  if (!res.ok) {
    assertEquals(res.error, 'EVO_TIMEOUT');
    assertEquals(res.status, 0);
  }
});
