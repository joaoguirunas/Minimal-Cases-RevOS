/**
 * Tests for meta-media-upload (Resumable Upload API da Meta — header de imagem em templates).
 *
 * Run: deno test --allow-env supabase/functions/_shared/meta-media-upload.test.ts
 *
 * No real network: `fetchImpl` é injetado como fake com respostas em sequência.
 * Todos os testes de `uploadHeaderHandle` passam `allowedHosts` explicitamente
 * (host `x`, das URLs de teste) para não depender de SUPABASE_URL do ambiente.
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { defaultAllowedHosts, guessImageMime, uploadHeaderHandle } from './meta-media-upload.ts';

const ALLOWED = { allowedHosts: ['x'] };

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

Deno.test('guessImageMime: normaliza charset e caixa do content-type', () => {
  assertEquals(guessImageMime('https://x/a', 'image/jpeg; charset=binary'), 'image/jpeg');
  assertEquals(guessImageMime('https://x/a', 'Image/PNG'), 'image/png');
  assertEquals(guessImageMime('https://x/a', 'IMAGE/JPG'), 'image/jpeg');
});

Deno.test('guessImageMime: content-type que não é image/* cai pra extensão', () => {
  assertEquals(guessImageMime('https://x/a.jpg', 'application/octet-stream'), 'image/jpeg');
  assertEquals(guessImageMime('https://x/a.png', 'binary/octet-stream'), 'image/png');
  assertEquals(guessImageMime('https://x/a.gif', 'application/octet-stream'), null);
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
    { fetchImpl, ...ALLOWED },
  );

  assertEquals(result, { handle: '2:abc', bytes: 10, mime: 'image/jpeg' });
  assertEquals(calls.length, 3);

  // Call 1: GET da imagem
  assertEquals(calls[0].input, 'https://x/a.jpg');
  assertEquals(calls[0].init?.redirect, 'manual');

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
    () => uploadHeaderHandle({ appId: 'APP', accessToken: 'TOKEN', imageUrl: 'https://x/a.gif' }, { fetchImpl, ...ALLOWED }),
    Error,
    'Formato não suportado (use JPEG ou PNG)',
  );
});

Deno.test('uploadHeaderHandle: imagem grande demais (> maxBytes, detectado no stream) — throw', async () => {
  const bigBytes = new Uint8Array(20);
  const fetchImpl = ((_input: RequestInfo | URL) =>
    Promise.resolve(new Response(bigBytes, { headers: { 'content-type': 'image/jpeg' } }))) as typeof fetch;

  await assertRejects(
    () =>
      uploadHeaderHandle(
        { appId: 'APP', accessToken: 'TOKEN', imageUrl: 'https://x/a.jpg' },
        { fetchImpl, maxBytes: 10, ...ALLOWED },
      ),
    Error,
  );
});

Deno.test('uploadHeaderHandle: content-length declarado acima do limite — rejeita SEM ler o corpo', async () => {
  let bodyAccessed = false;
  const fetchImpl = ((_input: RequestInfo | URL) => {
    const res = new Response(new Uint8Array(10), {
      headers: { 'content-type': 'image/jpeg', 'content-length': String(6 * 1024 * 1024) },
    });
    const realBody = res.body;
    Object.defineProperty(res, 'body', {
      get() {
        bodyAccessed = true;
        return realBody;
      },
    });
    return Promise.resolve(res);
  }) as typeof fetch;

  await assertRejects(
    () => uploadHeaderHandle({ appId: 'APP', accessToken: 'TOKEN', imageUrl: 'https://x/a.jpg' }, { fetchImpl, ...ALLOWED }),
    Error,
  );
  assertEquals(bodyAccessed, false);
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
    () => uploadHeaderHandle({ appId: 'APP', accessToken: 'TOKEN', imageUrl: 'https://x/a.jpg' }, { fetchImpl, ...ALLOWED }),
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
    () => uploadHeaderHandle({ appId: 'APP', accessToken: 'TOKEN', imageUrl: 'https://x/a.jpg' }, { fetchImpl, ...ALLOWED }),
    Error,
    'Session has expired',
  );
});

Deno.test('uploadHeaderHandle: mime default do MEME veio da resposta da imagem, não da URL', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fetchImpl = makeFakeFetch(calls);

  const result = await uploadHeaderHandle(
    { appId: 'APP', accessToken: 'TOKEN', imageUrl: 'https://x/imagem-sem-extensao' },
    { fetchImpl, ...ALLOWED },
  );

  assertEquals(result.mime, 'image/jpeg');
});

// ── SSRF: protocolo, allowlist de host, redirect ─────────────────────────────

Deno.test('uploadHeaderHandle: rejeita URL http:// (não https)', async () => {
  let called = false;
  const fetchImpl = (() => {
    called = true;
    return Promise.resolve(new Response(new Uint8Array(10)));
  }) as typeof fetch;

  await assertRejects(
    () => uploadHeaderHandle({ appId: 'APP', accessToken: 'TOKEN', imageUrl: 'http://x/a.jpg' }, { fetchImpl, ...ALLOWED }),
    Error,
  );
  assertEquals(called, false);
});

Deno.test('uploadHeaderHandle: host fora da allowlist é rejeitado ANTES de qualquer fetch', async () => {
  let called = false;
  const fetchImpl = (() => {
    called = true;
    return Promise.resolve(new Response(new Uint8Array(10)));
  }) as typeof fetch;

  await assertRejects(
    () =>
      uploadHeaderHandle(
        { appId: 'APP', accessToken: 'TOKEN', imageUrl: 'https://attacker.example/a.jpg' },
        { fetchImpl, allowedHosts: ['x'] },
      ),
    Error,
    'URL da imagem fora dos domínios permitidos',
  );
  assertEquals(called, false);
});

Deno.test('uploadHeaderHandle: host permitido passa a validação de allowlist', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fetchImpl = makeFakeFetch(calls);

  const result = await uploadHeaderHandle(
    { appId: 'APP', accessToken: 'TOKEN', imageUrl: 'https://x/a.jpg' },
    { fetchImpl, allowedHosts: ['x'] },
  );

  assertEquals(result.handle, '2:abc');
});

Deno.test('uploadHeaderHandle: resposta 302 (redirect) é rejeitada, não seguida', async () => {
  const fetchImpl = ((_input: RequestInfo | URL, init?: RequestInit) => {
    assertEquals(init?.redirect, 'manual');
    return Promise.resolve(
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } }),
    );
  }) as typeof fetch;

  await assertRejects(
    () => uploadHeaderHandle({ appId: 'APP', accessToken: 'TOKEN', imageUrl: 'https://x/a.jpg' }, { fetchImpl, ...ALLOWED }),
    Error,
    'não pode redirecionar',
  );
});

Deno.test('uploadHeaderHandle: falha de download não vaza o status HTTP upstream na mensagem', async () => {
  const fetchImpl = (() => Promise.resolve(new Response('forbidden', { status: 403 }))) as typeof fetch;

  await assertRejects(
    () => uploadHeaderHandle({ appId: 'APP', accessToken: 'TOKEN', imageUrl: 'https://x/a.jpg' }, { fetchImpl, ...ALLOWED }),
    Error,
    'Não foi possível baixar a imagem do header.',
  );
});

Deno.test('uploadHeaderHandle: allowlist vazia falha FECHADA (rejeita antes de qualquer fetch)', async () => {
  let called = false;
  const fetchImpl = (() => {
    called = true;
    return Promise.resolve(new Response(new Uint8Array(10)));
  }) as typeof fetch;

  await assertRejects(
    () =>
      uploadHeaderHandle(
        { appId: 'APP', accessToken: 'TOKEN', imageUrl: 'https://x/a.jpg' },
        { fetchImpl, allowedHosts: [] },
      ),
    Error,
    'Allowlist de hosts do header vazia',
  );
  assertEquals(called, false);
});

// ── defaultAllowedHosts ──────────────────────────────────────────────────────

Deno.test('defaultAllowedHosts: combina host do SUPABASE_URL (lowercased pelo parser) com WA_HEADER_IMAGE_HOSTS (lowercased explicitamente)', () => {
  const prevSupabaseUrl = Deno.env.get('SUPABASE_URL');
  const prevExtraHosts = Deno.env.get('WA_HEADER_IMAGE_HOSTS');
  try {
    Deno.env.set('SUPABASE_URL', 'https://Abc.Supabase.co');
    Deno.env.set('WA_HEADER_IMAGE_HOSTS', 'CDN.Shopify.com, x.y');
    assertEquals(defaultAllowedHosts(), ['abc.supabase.co', 'cdn.shopify.com', 'x.y']);
  } finally {
    if (prevSupabaseUrl === undefined) Deno.env.delete('SUPABASE_URL');
    else Deno.env.set('SUPABASE_URL', prevSupabaseUrl);
    if (prevExtraHosts === undefined) Deno.env.delete('WA_HEADER_IMAGE_HOSTS');
    else Deno.env.set('WA_HEADER_IMAGE_HOSTS', prevExtraHosts);
  }
});

Deno.test('defaultAllowedHosts: sem SUPABASE_URL nem WA_HEADER_IMAGE_HOSTS retorna lista vazia', () => {
  const prevSupabaseUrl = Deno.env.get('SUPABASE_URL');
  const prevExtraHosts = Deno.env.get('WA_HEADER_IMAGE_HOSTS');
  try {
    Deno.env.delete('SUPABASE_URL');
    Deno.env.delete('WA_HEADER_IMAGE_HOSTS');
    assertEquals(defaultAllowedHosts(), []);
  } finally {
    if (prevSupabaseUrl === undefined) Deno.env.delete('SUPABASE_URL');
    else Deno.env.set('SUPABASE_URL', prevSupabaseUrl);
    if (prevExtraHosts === undefined) Deno.env.delete('WA_HEADER_IMAGE_HOSTS');
    else Deno.env.set('WA_HEADER_IMAGE_HOSTS', prevExtraHosts);
  }
});
