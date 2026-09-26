// supabase/functions/_shared/email-sender.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { planSend, listUnsubscribeHeaders, resendSend } from './email-sender.ts';

Deno.test('suprimidos nunca saem, por qualquer provedor', () => {
  for (const s of ['unsubscribed', 'bounced', 'complained'])
    for (const pct of [0, 50, 100])
      assertEquals(planSend({ contactStatus: s, email: 'a@b.com', sharePct: pct }).action, 'suppress');
});
Deno.test('0% → klaviyo; 100% → resend; forçar vence o percentual', () => {
  assertEquals(planSend({ contactStatus: 'subscribed', email: 'a@b.com', sharePct: 0 }).action, 'klaviyo');
  assertEquals(planSend({ contactStatus: 'subscribed', email: 'a@b.com', sharePct: 100 }).action, 'resend');
  assertEquals(planSend({ contactStatus: 'subscribed', email: 'a@b.com', sharePct: 0, forceProvider: 'resend' }).action, 'resend');
});
Deno.test('cabeçalhos de descadastro de um clique', () => {
  const h = listUnsubscribeHeaders('https://link.minimalcases.com.br/u/tok', 'contato@minimalcases.com.br');
  assertEquals(h['List-Unsubscribe'], '<https://link.minimalcases.com.br/u/tok>, <mailto:contato@minimalcases.com.br?subject=Descadastro>');
  assertEquals(h['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
});
Deno.test('resendSend manda Idempotency-Key e devolve id; 429 devolve retryAfter', async () => {
  let seen: Request | null = null;
  const ok = await resendSend('re_x', { from: 'A <a@b.com>', to: 'c@d.com', subject: 's', html: 'h', headers: {}, tags: [], idempotencyKey: 'k1' },
    (async (input: RequestInfo | URL, init?: RequestInit) => { seen = new Request(input, init); return new Response('{"id":"em_1"}', { status: 200 }); }) as typeof fetch);
  assertEquals(ok, { ok: true, id: 'em_1' });
  assertEquals(seen!.headers.get('Idempotency-Key'), 'k1');
  assertEquals(seen!.headers.get('Authorization'), 'Bearer re_x');
  const lim = await resendSend('re_x', { from: 'a', to: 'b', subject: 's', html: 'h', headers: {}, tags: [], idempotencyKey: 'k2' },
    (async () => new Response('{"message":"rate"}', { status: 429, headers: { 'retry-after': '2' } })) as typeof fetch);
  assertEquals(lim.ok, false);
  assertEquals((lim as { retryAfter?: number }).retryAfter, 2);
});
Deno.test('e-mail com maiúsculas/espaços é tratado igual (supressão por e-mail normalizado)', () => {
  assertEquals(planSend({ contactStatus: 'unsubscribed', email: ' Joao@Gmail.com ', sharePct: 100 }).action, 'suppress');
});

import { sendTrackedEmail, idempotencyKey } from './email-sender.ts';

// Supabase falso mínimo: rpc(), from().insert().select().single(), from().insert(), from().update().eq()
function fakeSb(opts: { rpcError?: boolean; insertError?: boolean }) {
  const inserted: unknown[] = [];
  const sb = {
    rpc: async () => opts.rpcError ? { data: null, error: { message: 'timeout' } } : { data: 'subscribed', error: null },
    from: () => ({
      insert: (row: unknown) => {
        inserted.push(row);
        const res = opts.insertError ? { data: null, error: { message: 'insert falhou' } } : { data: { id: 'msg-1' }, error: null };
        return Object.assign(Promise.resolve(res), { select: () => ({ single: async () => res }) });
      },
      update: () => ({ eq: async () => ({ data: null, error: null }) }),
    }),
  };
  return { sb, inserted };
}
const cfg = { is_active: true, credentials: { provider: 'klaviyo', resend_share_pct: '0', from_email: 'contato@minimalcases.com.br' } };

Deno.test('erro ao consultar supressão → falha (retry), nunca envia', async () => {
  Deno.env.set('EMAIL_UNSUBSCRIBE_SECRET', 's');
  const { sb } = fakeSb({ rpcError: true });
  const r = await sendTrackedEmail(sb as never, { config: cfg as never, to: 'a@b.com', subject: 's', html: 'h', vars: {}, kind: 'esteira' });
  assertEquals(r.status, 'failed');
  assertEquals(r.success, false);
});
Deno.test('falha ao gravar o registro → devolve falha em vez de derrubar o worker', async () => {
  Deno.env.set('EMAIL_UNSUBSCRIBE_SECRET', 's');
  const { sb } = fakeSb({ insertError: true });
  const r = await sendTrackedEmail(sb as never, { config: cfg as never, to: 'a@b.com', subject: 's', html: 'h', vars: {}, kind: 'esteira' });
  assertEquals(r.status, 'failed');
});
Deno.test('chave anti-duplicidade é a do toque (igual em toda tentativa)', () => {
  assertEquals(idempotencyKey('fq-1', 'msg-a'), idempotencyKey('fq-1', 'msg-b'));
  assertEquals(idempotencyKey(null, 'msg-a'), 'msg:msg-a');
});
Deno.test('Resend 409 de idempotência = já enviado antes (não conta como falha)', async () => {
  const r = await resendSend('re_x', { from: 'a', to: 'b', subject: 's', html: 'h', headers: {}, tags: [], idempotencyKey: 'k' },
    (async () => new Response('{"name":"invalid_idempotent_request"}', { status: 409 })) as typeof fetch);
  assertEquals(r.ok, true);
});
