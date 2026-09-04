/**
 * Tests for meta-media-upload (Resumable Upload API da Meta — header de imagem em templates).
 *
 * Run: deno test --allow-env supabase/functions/_shared/meta-media-upload.test.ts
 *
 * No real network: `fetchImpl` é injetado como fake com respostas em sequência.
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { guessImageMime, uploadHeaderHandle } from './meta-media-upload.ts';

// ── guessImageMime ───────────────────────────────────────────────────────────

Deno.test('guessImageMime: por extensão quando não há content-type', () => {
  assertEquals(guessImageMime('https://x/a.png'), 'image/png');
  assertEquals(guessImageMime('https://x/a.jpg'), 'image/jpeg');
  assertEquals(guessImageMime('https://x/a.jpeg'), 'image/jpeg');
  assertEquals(guessImageMime('https://x/a.gif'), null);
  assertEquals(guessImageMime('https://x/a'), null);
});

Deno.test('guessImageMime: content-type prevalece sobre extensão', () => {
  assertEquals(guessImageMime('https://x/a.png', 'image/jpeg'), 'image/jpeg');
  assertEquals(guessImageMime('https://x/a.jpg', 'image/png'), 'image/png');
  assertEquals(guessImageMime('https://x/a.jpg', 'image/gif'), null);
});

// ── uploadHeaderHandle ───────────────────────────────────────────────────────

function makeFakeFetch(calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []) {
  const responses: Response[] = [
    // 1. GET imagem
    new Response(new Uint8Array(10), { headers: { 'content-type': 'image/jpeg' } }),
    // 2. POST /v23.0/APP/uploads
    new Response(JSON.stringify({ id: 'upload:XYZ' }), { status: 200 }),
    // 3. POST /v23.0/upload:XYZ
    new Response(JSON.stringify({ h: '2:abc' }), { status: 200 }),
  ];
  let i = 0;
  const fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    const res = responses[i];
    i++;
    return Promise.resolve(res);
  }) as typeof fetch;
  return fetchImpl;
}

Deno.test('uploadHeaderHandle: caminho feliz — 3 fetches na sequência correta, com Authorization OAuth', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fetchImpl = makeFakeFetch(calls);

  const result = await uploadHeaderHandle(
    { appId: 'APP', accessToken: 'TOKEN', imageUrl: 'https://x/a.jpg' },
    { fetchImpl },
  );

  assertEquals(result, { handle: '2:abc', bytes: 10, mime: 'image/jpeg' });
  assertEquals(calls.length, 3);

  // Call 1: GET da imagem
  assertEquals(calls[0].input, 'https://x/a.jpg');

  // Call 2: POST de início de upload
  const url2 = String(calls[1].input);
  assertEquals(url2, 'https://graph.facebook.com/v23.0/APP/uploads?file_length=10&file_type=image%2Fjpeg');
  assertEquals(calls[1].init?.method, 'POST');
  const headers2 = new Headers(calls[1].init?.headers);
  assertEquals(headers2.get('Authorization'), 'OAuth TOKEN');

  // Call 3: POST de upload dos bytes
  const url3 = String(calls[2].input);
  assertEquals(url3, 'https://graph.facebook.com/v23.0/upload:XYZ');
  assertEquals(calls[2].init?.method, 'POST');
  const headers3 = new Headers(calls[2].init?.headers);
  assertEquals(headers3.get('Authorization'), 'OAuth TOKEN');
  assertEquals(headers3.get('file_offset'), '0');
  assertEquals(headers3.get('Content-Type'), 'application/octet-stream');
  const body3 = calls[2].init?.body as Uint8Array;
  assertEquals(body3.length, 10);
});

Deno.test('uploadHeaderHandle: formato não suportado (gif) — throw legível', async () => {
  const fetchImpl = ((_input: RequestInfo | URL) =>
    Promise.resolve(new Response(new Uint8Array(10), { headers: { 'content-type': 'image/gif' } }))) as typeof fetch;

  await assertRejects(
    () => uploadHeaderHandle({ appId: 'APP', accessToken: 'TOKEN', imageUrl: 'https://x/a.gif' }, { fetchImpl }),
    Error,
    'Formato não suportado (use JPEG ou PNG)',
  );
});

Deno.test('uploadHeaderHandle: imagem grande demais (> maxBytes) — throw', async () => {
  const bigBytes = new Uint8Array(20);
  const fetchImpl = ((_input: RequestInfo | URL) =>
    Promise.resolve(new Response(bigBytes, { headers: { 'content-type': 'image/jpeg' } }))) as typeof fetch;

  await assertRejects(
    () =>
      uploadHeaderHandle(
        { appId: 'APP', accessToken: 'TOKEN', imageUrl: 'https://x/a.jpg' },
        { fetchImpl, maxBytes: 10 },
      ),
    Error,
  );
});

Deno.test('uploadHeaderHandle: Meta retorna 400 no início do upload — throw com error.message da Meta', async () => {
  const responses: Response[] = [
    new Response(new Uint8Array(10), { headers: { 'content-type': 'image/jpeg' } }),
    new Response(JSON.stringify({ error: { message: 'Invalid OAuth access token' } }), { status: 400 }),
  ];
  let i = 0;
  const fetchImpl = ((_input: RequestInfo | URL) => {
    const res = responses[i];
    i++;
    return Promise.resolve(res);
  }) as typeof fetch;

  await assertRejects(
    () => uploadHeaderHandle({ appId: 'APP', accessToken: 'TOKEN', imageUrl: 'https://x/a.jpg' }, { fetchImpl }),
    Error,
    'Invalid OAuth access token',
  );
});

Deno.test('uploadHeaderHandle: Meta retorna 400 no segundo passo (upload dos bytes) — throw com error.message da Meta', async () => {
  const responses: Response[] = [
    new Response(new Uint8Array(10), { headers: { 'content-type': 'image/jpeg' } }),
    new Response(JSON.stringify({ id: 'upload:XYZ' }), { status: 200 }),
    new Response(JSON.stringify({ error: { message: 'Session has expired' } }), { status: 400 }),
  ];
  let i = 0;
  const fetchImpl = ((_input: RequestInfo | URL) => {
    const res = responses[i];
    i++;
    return Promise.resolve(res);
  }) as typeof fetch;

  await assertRejects(
    () => uploadHeaderHandle({ appId: 'APP', accessToken: 'TOKEN', imageUrl: 'https://x/a.jpg' }, { fetchImpl }),
    Error,
    'Session has expired',
  );
});

Deno.test('uploadHeaderHandle: mime default do MEME veio da resposta da imagem, não da URL', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fetchImpl = makeFakeFetch(calls);

  const result = await uploadHeaderHandle(
    { appId: 'APP', accessToken: 'TOKEN', imageUrl: 'https://x/imagem-sem-extensao' },
    { fetchImpl },
  );

  assertEquals(result.mime, 'image/jpeg');
});
