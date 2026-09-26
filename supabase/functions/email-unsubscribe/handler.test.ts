// supabase/functions/email-unsubscribe/handler.test.ts
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { handleUnsubscribe } from './handler.ts';
import { makeUnsubToken } from '../_shared/email-unsub-token.ts';

const secret = 's3';
function deps() {
  const calls: string[] = [];
  return { calls, d: { secret, unsubscribe: async (e: string, r: string) => { calls.push(`${e}|${r}`); return 'unsubscribed'; }, status: async () => 'subscribed' } };
}
const U = 'https://x.supabase.co/functions/v1/email-unsubscribe';

Deno.test('one-click do Gmail (form-urlencoded) descadastra e responde 200', async () => {
  const t = await makeUnsubToken('joao@gmail.com', secret); const { calls, d } = deps();
  const res = await handleUnsubscribe(new Request(`${U}?t=${t}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' }), d);
  assertEquals(res.status, 200);
  assertEquals(calls, ['joao@gmail.com|one_click']);
});
Deno.test('peek mostra e-mail mascarado sem mudar nada', async () => {
  const t = await makeUnsubToken('joao@gmail.com', secret); const { calls, d } = deps();
  const res = await handleUnsubscribe(new Request(U, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: t, action: 'peek' }) }), d);
  const j = await res.json();
  assertEquals(j, { ok: true, email: 'jo***@gmail.com', status: 'subscribed' });
  assertEquals(calls.length, 0);
});
Deno.test('botão da página (JSON unsubscribe) descadastra com motivo link', async () => {
  const t = await makeUnsubToken('joao@gmail.com', secret); const { calls, d } = deps();
  const res = await handleUnsubscribe(new Request(U, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: t, action: 'unsubscribe' }) }), d);
  assertEquals((await res.json()).ok, true);
  assertEquals(calls, ['joao@gmail.com|link']);
});
Deno.test('token inválido: nada muda e resposta neutra', async () => {
  const { calls, d } = deps();
  const res = await handleUnsubscribe(new Request(U, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'lixo.xx', action: 'unsubscribe' }) }), d);
  assertEquals(res.status, 400);
  assertEquals(await res.json(), { ok: false });
  assertEquals(calls.length, 0);
});
Deno.test('GET redireciona para a página no domínio da Minimal', async () => {
  const { d } = deps();
  const res = await handleUnsubscribe(new Request(`${U}?t=abc.def`), d);
  assertEquals(res.status, 302);
  assert(res.headers.get('location')!.startsWith('https://link.minimalcases.com.br/sair/abc.def'));
});
