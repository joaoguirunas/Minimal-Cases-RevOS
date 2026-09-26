// supabase/functions/_shared/email-split.test.ts
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { emailBucket, chooseProvider } from './email-split.ts';

Deno.test('bucket estável e normalizado', () => {
  assertEquals(emailBucket('Joao@Gmail.com '), emailBucket('joao@gmail.com'));
  const b = emailBucket('x@y.com'); assert(b >= 0 && b < 100);
});
Deno.test('0% nunca Resend, 100% sempre Resend', () => {
  for (let i = 0; i < 500; i++) {
    assertEquals(chooseProvider(`p${i}@t.com`, 0), 'klaviyo');
    assertEquals(chooseProvider(`p${i}@t.com`, 100), 'resend');
  }
});
Deno.test('~25% vai para o Resend e quem estava no Resend continua ao subir', () => {
  const emails = Array.from({ length: 10000 }, (_, i) => `pessoa${i}@exemplo.com.br`);
  const r25 = emails.filter((e) => chooseProvider(e, 25) === 'resend');
  assert(r25.length > 2200 && r25.length < 2800, `r25=${r25.length}`);
  for (const e of r25) assertEquals(chooseProvider(e, 50), 'resend');
});
