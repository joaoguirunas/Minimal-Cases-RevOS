// supabase/functions/_shared/email-unsub-token.test.ts
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { makeUnsubToken, readUnsubToken, unsubLinks, maskEmail } from './email-unsub-token.ts';

const S = 'segredo-de-teste';
Deno.test('token volta para o e-mail normalizado', async () => {
  const t = await makeUnsubToken('  Joao@Gmail.COM ', S);
  assertEquals(await readUnsubToken(t, S), 'joao@gmail.com');
});
Deno.test('token adulterado, de outro segredo ou lixo → null', async () => {
  const t = await makeUnsubToken('joao@gmail.com', S);
  const [a, b] = t.split('.');
  const outro = await makeUnsubToken('maria@gmail.com', S);
  assertEquals(await readUnsubToken(`${outro.split('.')[0]}.${b}`, S), null); // e-mail trocado
  assertEquals(await readUnsubToken(`${a}.${b.slice(0, -1)}x`, S), null);
  assertEquals(await readUnsubToken(t, 'outro-segredo'), null);
  assertEquals(await readUnsubToken('lixo', S), null);
  assertEquals(await readUnsubToken('', S), null);
});
Deno.test('links no domínio da Minimal', async () => {
  const l = unsubLinks('abc.def');
  assertEquals(l.page, 'https://link.minimalcases.com.br/sair/abc.def');
  assertEquals(l.oneClick, 'https://link.minimalcases.com.br/u/abc.def');
});
Deno.test('máscara não expõe o e-mail', () => {
  assertEquals(maskEmail('joao@gmail.com'), 'jo***@gmail.com');
  assertEquals(maskEmail('a@b.com'), 'a***@b.com');
  assert(!maskEmail('joaosilva@gmail.com').includes('silva'));
});
