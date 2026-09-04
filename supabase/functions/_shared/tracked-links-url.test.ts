// supabase/functions/_shared/tracked-links-url.test.ts
// Run: deno test --allow-env supabase/functions/_shared/tracked-links-url.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildTrackedUrl } from './tracked-links.ts';

Deno.test('base terminada em /r usa query ?t= (compatível com os templates Meta aprovados)', () => {
  assertEquals(buildTrackedUrl('https://x.supabase.co/functions/v1/r', 'abc123XYZ0'), 'https://x.supabase.co/functions/v1/r?t=abc123XYZ0');
});
Deno.test('domínio curto usa path /<token>', () => {
  assertEquals(buildTrackedUrl('https://link.minimalcases.com.br', 'abc123XYZ0'), 'https://link.minimalcases.com.br/abc123XYZ0');
  assertEquals(buildTrackedUrl('https://link.minimalcases.com.br/', 'abc'), 'https://link.minimalcases.com.br/abc');
});
