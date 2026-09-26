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
