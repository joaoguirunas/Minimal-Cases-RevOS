// supabase/functions/_shared/click-context.test.ts
// Run: deno test --allow-env supabase/functions/_shared/click-context.test.ts
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { describeClicksForAgent, describeLinkOrigin, relativePt } from './click-context.ts';

const now = new Date('2026-09-04T01:00:00Z');

Deno.test('relativePt', () => {
  assertEquals(relativePt(new Date('2026-09-04T00:59:40Z'), now), 'agora');
  assertEquals(relativePt(new Date('2026-09-04T00:48:00Z'), now), 'há 12 min');
  assertEquals(relativePt(new Date('2026-09-03T22:00:00Z'), now), 'há 3 h');
  assertEquals(relativePt(new Date('2026-09-02T01:00:00Z'), now), 'há 2 dias');
});

Deno.test('describeLinkOrigin', () => {
  assertEquals(describeLinkOrigin({ source: 'esteira_whatsapp', label: 'wa_button_url', template_name: 'minimal_esteira_wa01', channel: 'whatsapp' }), 'WhatsApp · minimal_esteira_wa01');
  assertEquals(describeLinkOrigin({ source: 'esteira_email', label: 'link_checkout', template_name: 'E2 · Celular voando', channel: 'email' }), 'e-mail · E2 · Celular voando');
  assertEquals(describeLinkOrigin({ source: 'agente', label: 'yampi_enviar_link_pagamento', template_name: null, channel: 'whatsapp' }), 'agente · link de pagamento');
  assertEquals(describeLinkOrigin({ source: 'outro', label: null, template_name: null, channel: 'sms' }), 'SMS');
});

Deno.test('describeClicksForAgent: sem cliques', () => {
  assertEquals(describeClicksForAgent([], now), 'Cliques em links nossos: nenhum até agora.');
});

Deno.test('describeClicksForAgent: lista do mais recente, com contagem e tempo relativo', () => {
  const s = describeClicksForAgent([
    { source: 'esteira_whatsapp', label: 'wa_button_url', template_name: 'minimal_esteira_wa01', channel: 'whatsapp', clicks: 2, first_clicked_at: '2026-09-03T22:00:00Z', last_clicked_at: '2026-09-04T00:48:00Z' },
    { source: 'esteira_email', label: 'link_checkout', template_name: 'E1', channel: 'email', clicks: 1, first_clicked_at: '2026-09-02T01:00:00Z', last_clicked_at: '2026-09-02T01:00:00Z' },
  ], now);
  assertStringIncludes(s, 'abriu o link (WhatsApp · minimal_esteira_wa01) 2x, último há 12 min');
  assertStringIncludes(s, 'abriu o link (e-mail · E1) 1x há 2 dias');
  assertStringIncludes(s, 'já viu o carrinho');
});
