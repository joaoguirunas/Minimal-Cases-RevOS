/**
 * Tests for whatsapp-templates-sync (WAT-SYNC-03)
 *
 * Run: deno test --allow-net --allow-env \
 *   supabase/functions/whatsapp-templates-sync/index.test.ts
 *
 * These exercise the pure core in ../_shared/template-sync-lib.ts, which the
 * HTTP handler (index.ts) wraps. `fetch` is injected so no real network is hit;
 * the Supabase lookups are mocked via a small in-memory fake.
 */

import {
  assertEquals,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildTemplateRow,
  fetchAllMetaTemplates,
  type LocalTemplateRef,
  type MetaApiError,
  type MetaPageResponse,
  type MetaTemplate,
  resolveTemplateMatch,
  shouldSoftDelete,
  type TemplateLookupClient,
} from '../_shared/template-sync-lib.ts';

// ── Test helpers ─────────────────────────────────────────────────────────────

const silentLog = {
  fn: 'test',
  rid: 'test',
  debug() {},
  info() {},
  warn() {},
  error() {},
  silent() {},
  elapsed() {
    return 0;
  },
  // deno-lint-ignore no-explicit-any
} as any;

function metaTpl(partial: Partial<MetaTemplate> & { name: string; id: string }): MetaTemplate {
  return {
    status: 'APPROVED',
    category: 'MARKETING',
    language: 'pt_BR',
    components: [],
    ...partial,
  };
}

/** Build a fake `fetch` that replays a queue of Responses keyed by call order. */
function queuedFetch(responses: Response[]): typeof fetch {
  let i = 0;
  return ((_url: string | URL | Request, _init?: RequestInit) => {
    const res = responses[i];
    i++;
    if (!res) throw new Error(`unexpected fetch call #${i}`);
    return Promise.resolve(res);
  }) as typeof fetch;
}

function jsonResponse(body: MetaPageResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** In-memory fake of the lookup surface used by resolveTemplateMatch. */
function fakeLookup(rows: Array<LocalTemplateRef>): TemplateLookupClient {
  return {
    matchByIdTemplate(idTemplate) {
      const r = rows.find((x) => x.id_template === idTemplate);
      return Promise.resolve(r ? { id: r.id, slug: r.slug } : null);
    },
    matchBySlug(slug) {
      const r = rows.find((x) => x.slug === slug);
      return Promise.resolve(r ? { id: r.id } : null);
    },
    matchByName(name) {
      const r = rows.find((x) => x.name === name);
      return Promise.resolve(r ? { id: r.id, id_template: r.id_template } : null);
    },
  };
}

// ── AC1: status pending → approved ──────────────────────────────────────────

Deno.test('sync: atualiza status de pending para approved', async () => {
  // DB has the same id_template at status 'pending'; Meta now returns APPROVED.
  const tpl = metaTpl({ id: '12345678', name: 'start_curso_online_v2', status: 'APPROVED' });

  const local: LocalTemplateRef = {
    id: 'row-1',
    slug: 'start_curso_online_v2|pt_BR',
    id_template: '12345678',
    name: 'start_curso_online_v2',
  };

  const match = await resolveTemplateMatch(fakeLookup([local]), tpl);
  assertEquals(match.kind, 'id_template');
  assertEquals(match.id, 'row-1');

  // The row that would be written carries the fresh lowercased status.
  const row = buildTemplateRow(tpl, '2026-06-10T00:00:00.000Z');
  assertEquals(row.status, 'approved');
  assertEquals(row.id_template, '12345678');
});

// ── AC2: corrige id_template fake (pending_*) via match por nome ─────────────

Deno.test('sync: corrige id_template fake (pending_*) via match por nome', async () => {
  // Meta returns the real id; DB row has a placeholder id and a stale slug,
  // so only the name match can find it.
  const tpl = metaTpl({ id: '12345678', name: 'start_curso_online_v2', status: 'APPROVED' });

  const local: LocalTemplateRef = {
    id: 'row-1',
    slug: 'start_curso_online_v2|pt', // stale language — slug won't match
    id_template: 'pending_start_curso_online_v2',
    name: 'start_curso_online_v2',
  };

  const match = await resolveTemplateMatch(fakeLookup([local]), tpl);
  assertEquals(match.kind, 'name');
  assertEquals(match.id, 'row-1');
  assertEquals(match.previousIdTemplate, 'pending_start_curso_online_v2');

  // After update, the row carries the real Meta id.
  const row = buildTemplateRow(tpl, '2026-06-10T00:00:00.000Z');
  assertEquals(row.id_template, '12345678');
  assertEquals(row.status, 'approved');
});

// ── AC3: soft-delete template com id real ausente da Meta ────────────────────

Deno.test('sync: soft-delete template com id real ausente da Meta', () => {
  const metaIds = new Set<string>(['11111111']); // Meta no longer returns 99999999

  const local: LocalTemplateRef = {
    id: 'row-9',
    slug: 'old_template|pt_BR',
    id_template: '99999999',
    name: 'old_template',
  };

  assertEquals(shouldSoftDelete(local, metaIds), true);
});

// ── AC4: NÃO deleta template com id_template fake (pending_*) ─────────────────

Deno.test('sync: não deleta template com id_template fake (pending_*)', () => {
  const metaIds = new Set<string>(['11111111']); // 'start_mentoria' not yet approved

  const local: LocalTemplateRef = {
    id: 'row-5',
    slug: 'start_mentoria|pt_BR',
    id_template: 'pending_start_mentoria',
    name: 'start_mentoria',
  };

  assertEquals(shouldSoftDelete(local, metaIds), false);

  // Sanity: a null id_template (local-only, never submitted) is also untouched.
  assertEquals(
    shouldSoftDelete(
      { id: 'row-6', slug: 'local_only|pt_BR', id_template: null, name: 'local_only' },
      metaIds,
    ),
    false,
  );
});

// ── AC5: paginação — busca múltiplas páginas da Meta ─────────────────────────

Deno.test('sync: busca múltiplas páginas da Meta', async () => {
  const page1: MetaPageResponse = {
    data: [
      metaTpl({ id: '1', name: 't1' }),
      metaTpl({ id: '2', name: 't2' }),
    ],
    paging: { next: 'https://graph.facebook.com/v23.0/WABA/message_templates?after=CURSOR2' },
  };
  const page2: MetaPageResponse = {
    data: [
      metaTpl({ id: '3', name: 't3' }),
      metaTpl({ id: '4', name: 't4' }),
    ],
    // no paging.next → loop stops
  };

  const fetchImpl = queuedFetch([jsonResponse(page1), jsonResponse(page2)]);

  const all = await fetchAllMetaTemplates('WABA', 'token', silentLog, fetchImpl);
  assertEquals(all.length, 4);
  assertEquals(all.map((t) => t.id), ['1', '2', '3', '4']);
});

// ── AC6: erro 403 da Meta retorna erro descritivo ────────────────────────────

Deno.test('sync: erro 403 da Meta retorna erro descritivo', async () => {
  const fetchImpl = queuedFetch([
    new Response('forbidden', { status: 403 }),
  ]);

  const err = (await assertRejects(
    () => fetchAllMetaTemplates('WABA', 'token', silentLog, fetchImpl),
  )) as MetaApiError;

  assertEquals(err.status, 403);
  assertEquals(
    err.message,
    'Token sem permissão para gerenciar templates. Verifique as permissões no Meta Business Manager.',
  );
});

// ── Adversarial extras (not in the 6 mandatory, but cheap and high-value) ─────

Deno.test('sync: erro 400 (WABA inválido) retorna mensagem específica', async () => {
  const fetchImpl = queuedFetch([new Response('bad waba', { status: 400 })]);

  const err = (await assertRejects(
    () => fetchAllMetaTemplates('WABA', 'token', silentLog, fetchImpl),
  )) as MetaApiError;

  assertEquals(err.status, 400);
  assertEquals(
    err.message,
    'WABA ID inválido ou não encontrado. Verifique a configuração do canal.',
  );
});

Deno.test('sync: erro 500 da Meta propaga status original', async () => {
  const fetchImpl = queuedFetch([new Response('boom', { status: 500 })]);

  const err = (await assertRejects(
    () => fetchAllMetaTemplates('WABA', 'token', silentLog, fetchImpl),
  )) as MetaApiError;

  assertEquals(err.status, 500);
  assertEquals(err.message, 'Meta API error: 500');
});

Deno.test('sync: página sem data não quebra (data ausente)', async () => {
  // Meta returning a page without `data` must not throw.
  const fetchImpl = queuedFetch([jsonResponse({ data: [] } as MetaPageResponse)]);
  const all = await fetchAllMetaTemplates('WABA', 'token', silentLog, fetchImpl);
  assertEquals(all.length, 0);
});

Deno.test('match: prioridade id_template > slug > name', async () => {
  // A row matching all three keys must resolve as id_template (highest priority).
  const tpl = metaTpl({ id: 'ID1', name: 'shared', status: 'APPROVED' });
  const rows: LocalTemplateRef[] = [
    { id: 'by-id', slug: 'shared|pt_BR', id_template: 'ID1', name: 'shared' },
  ];
  const match = await resolveTemplateMatch(fakeLookup(rows), tpl);
  assertEquals(match.kind, 'id_template');
  assertEquals(match.id, 'by-id');
});

Deno.test('match: sem correspondência retorna none (insert path)', async () => {
  const tpl = metaTpl({ id: 'NEW', name: 'brand_new', status: 'PENDING' });
  const match = await resolveTemplateMatch(fakeLookup([]), tpl);
  assertEquals(match.kind, 'none');
  assertEquals(match.id, null);
});
