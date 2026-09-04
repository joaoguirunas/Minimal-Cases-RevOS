// supabase/functions/_shared/tracked-links-url.test.ts
// Run: deno test --allow-env supabase/functions/_shared/tracked-links-url.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildTrackedUrl, trackedLinkBaseUrl } from './tracked-links.ts';

Deno.test('base terminada em /r usa query ?t= (compatível com os templates Meta aprovados)', () => {
  assertEquals(buildTrackedUrl('https://x.supabase.co/functions/v1/r', 'abc123XYZ0'), 'https://x.supabase.co/functions/v1/r?t=abc123XYZ0');
});
Deno.test('domínio curto usa path /<token>', () => {
  assertEquals(buildTrackedUrl('https://link.minimalcases.com.br', 'abc123XYZ0'), 'https://link.minimalcases.com.br/abc123XYZ0');
  assertEquals(buildTrackedUrl('https://link.minimalcases.com.br/', 'abc'), 'https://link.minimalcases.com.br/abc');
});
Deno.test('trackedLinkBaseUrl: default a partir de SUPABASE_URL; TRACKED_LINK_BASE_URL sobrepõe sem barra final', () => {
  const prevCustom = Deno.env.get('TRACKED_LINK_BASE_URL');
  const prevSupabase = Deno.env.get('SUPABASE_URL');
  try {
    Deno.env.delete('TRACKED_LINK_BASE_URL');
    Deno.env.set('SUPABASE_URL', 'https://x.supabase.co/');
    assertEquals(trackedLinkBaseUrl(), 'https://x.supabase.co/functions/v1/r');

    Deno.env.set('TRACKED_LINK_BASE_URL', 'https://link.minimalcases.com.br/');
    assertEquals(trackedLinkBaseUrl(), 'https://link.minimalcases.com.br');
  } finally {
    if (prevCustom === undefined) Deno.env.delete('TRACKED_LINK_BASE_URL'); else Deno.env.set('TRACKED_LINK_BASE_URL', prevCustom);
    if (prevSupabase === undefined) Deno.env.delete('SUPABASE_URL'); else Deno.env.set('SUPABASE_URL', prevSupabase);
  }
});
