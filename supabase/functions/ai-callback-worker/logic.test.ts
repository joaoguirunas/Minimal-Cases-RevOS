/**
 * Unit tests da lógica pura do ai-callback-worker (RETORNO-03, AC11).
 *
 * Run: deno test supabase/functions/ai-callback-worker/logic.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  AGENT_RETRY_MINUTES,
  BUSY_RETRY_MINUTES,
  buildAgentDirectMessage,
  computeRetry,
  decideDispatch,
  isOutsideWhatsappWindow,
  isServiceRoleJwt,
  resolveContent,
  type CallbackConfigRow,
} from './logic.ts';

const NOW = new Date('2026-07-22T12:00:00Z');

function cfg(patch: Partial<CallbackConfigRow> = {}): CallbackConfigRow {
  return {
    id: 'cfg-1',
    agent_id: 'agent-1',
    step_id: null,
    enabled: true,
    default_mode: 'direct',
    templates: [
      { id: 'retorno_padrao', label: 'Retorno padrão', body: 'Oi! Voltando como combinamos.', whatsapp_template_name: 'retorno_agendado_v1' },
      { id: 'sem_wa', label: 'Sem template WA', body: 'Texto sem template aprovado.' },
    ],
    free_prompt: 'Retome a conversa de onde parou.',
    whatsapp_template_fallback: 'fallback_retorno',
    ...patch,
  };
}

const jwt = (payload: Record<string, unknown>) =>
  `h.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.s`;

// ── Auth ──────────────────────────────────────────────────────────────────────

Deno.test('isServiceRoleJwt aceita apenas role=service_role', () => {
  assertEquals(isServiceRoleJwt(jwt({ role: 'service_role' })), true);
  assertEquals(isServiceRoleJwt(jwt({ role: 'anon' })), false);
  assertEquals(isServiceRoleJwt(jwt({ sub: 'x' })), false);
  assertEquals(isServiceRoleJwt('sb_secret_alguma_api_key_nova'), false); // não é JWT → 401
  assertEquals(isServiceRoleJwt(''), false);
  assertEquals(isServiceRoleJwt(null), false);
});

// ── Seleção de conteúdo ───────────────────────────────────────────────────────

Deno.test('resolveContent prioriza message_text (texto livre) da linha', () => {
  const c = resolveContent(
    { template_id: null, message_text: 'texto livre do agente', whatsapp_template_name: null },
    cfg(),
  );
  assertEquals(c.text, 'texto livre do agente');
  assertEquals(c.templateName, 'fallback_retorno'); // cai no fallback da config
  assertEquals(c.freePrompt, 'Retome a conversa de onde parou.');
});

Deno.test('resolveContent resolve body e template do template escolhido', () => {
  const c = resolveContent(
    { template_id: 'retorno_padrao', message_text: null, whatsapp_template_name: null },
    cfg(),
  );
  assertEquals(c.text, 'Oi! Voltando como combinamos.');
  assertEquals(c.templateName, 'retorno_agendado_v1');
});

Deno.test('resolveContent cai no whatsapp_template_fallback quando o template não tem um', () => {
  const c = resolveContent(
    { template_id: 'sem_wa', message_text: null, whatsapp_template_name: null },
    cfg(),
  );
  assertEquals(c.text, 'Texto sem template aprovado.');
  assertEquals(c.templateName, 'fallback_retorno');
});

Deno.test('resolveContent sem config e sem conteúdo devolve nulos', () => {
  const c = resolveContent({ template_id: 'x', message_text: null, whatsapp_template_name: null }, null);
  assertEquals(c.text, null);
  assertEquals(c.templateName, null);
  assertEquals(c.freePrompt, null);
});

// ── Janela de 24h ─────────────────────────────────────────────────────────────

Deno.test('isOutsideWhatsappWindow: 22h dentro, 24h fora, instagram nunca gatilhado', () => {
  const h22 = new Date(NOW.getTime() - 22 * 3_600_000).toISOString();
  const h24 = new Date(NOW.getTime() - 24 * 3_600_000).toISOString();
  assertEquals(isOutsideWhatsappWindow('whatsapp', h22, NOW), false);
  assertEquals(isOutsideWhatsappWindow('whatsapp', h24, NOW), true);
  assertEquals(isOutsideWhatsappWindow('whatsapp', null, NOW), true);
  assertEquals(isOutsideWhatsappWindow('instagram', h24, NOW), false);
});

Deno.test('decideDispatch: 22h → texto', () => {
  const d = decideDispatch({
    channel: 'whatsapp', mode: 'direct', now: NOW,
    lastInboundAt: new Date(NOW.getTime() - 22 * 3_600_000).toISOString(),
    text: 'Oi!', templateName: 'retorno_agendado_v1',
  });
  assertEquals(d, { kind: 'text', text: 'Oi!' });
});

Deno.test('decideDispatch: 24h → template', () => {
  const d = decideDispatch({
    channel: 'whatsapp', mode: 'direct', now: NOW,
    lastInboundAt: new Date(NOW.getTime() - 24 * 3_600_000).toISOString(),
    text: 'Oi!', templateName: 'retorno_agendado_v1',
  });
  assertEquals(d, { kind: 'template', templateName: 'retorno_agendado_v1' });
});

Deno.test('decideDispatch: 24h sem template → failed (nunca texto livre)', () => {
  const d = decideDispatch({
    channel: 'whatsapp', mode: 'direct', now: NOW,
    lastInboundAt: new Date(NOW.getTime() - 24 * 3_600_000).toISOString(),
    text: 'Oi!', templateName: null,
  });
  assertEquals(d.kind, 'fail');
});

Deno.test('decideDispatch: modo agent fora da janela degrada para template', () => {
  const d = decideDispatch({
    channel: 'whatsapp', mode: 'agent', now: NOW,
    lastInboundAt: new Date(NOW.getTime() - 30 * 3_600_000).toISOString(),
    text: null, templateName: 'fallback_retorno',
  });
  assertEquals(d, { kind: 'template', templateName: 'fallback_retorno', degradedFrom: 'agent' });
});

Deno.test('decideDispatch: modo agent dentro da janela reinvoca o agente', () => {
  const d = decideDispatch({
    channel: 'whatsapp', mode: 'agent', now: NOW,
    lastInboundAt: new Date(NOW.getTime() - 1 * 3_600_000).toISOString(),
    text: null, templateName: null,
  });
  assertEquals(d, { kind: 'agent' });
});

Deno.test('decideDispatch: instagram sem inbound recente segue como texto', () => {
  const d = decideDispatch({
    channel: 'instagram', mode: 'direct', now: NOW,
    lastInboundAt: new Date(NOW.getTime() - 72 * 3_600_000).toISOString(),
    text: 'Oi!', templateName: null,
  });
  assertEquals(d, { kind: 'text', text: 'Oi!' });
});

Deno.test('decideDispatch: direct sem conteúdo → failed', () => {
  const d = decideDispatch({
    channel: 'whatsapp', mode: 'direct', now: NOW,
    lastInboundAt: NOW.toISOString(), text: '   ', templateName: null,
  });
  assertEquals(d.kind, 'fail');
});

// ── Retry / reagendamento ─────────────────────────────────────────────────────

Deno.test('computeRetry: lock de conversa adia +2min e esgota em skipped', () => {
  const r1 = computeRetry(0, NOW, BUSY_RETRY_MINUTES, 'skipped');
  assertEquals(r1.status, 'pending');
  assertEquals(r1.retryCount, 1);
  assertEquals((r1 as { scheduledFor: string }).scheduledFor, new Date(NOW.getTime() + 2 * 60_000).toISOString());

  assertEquals(computeRetry(1, NOW, BUSY_RETRY_MINUTES, 'skipped').status, 'pending');
  assertEquals(computeRetry(2, NOW, BUSY_RETRY_MINUTES, 'skipped').status, 'skipped');
});

Deno.test('computeRetry: falha no modo agent adia +3min e esgota em failed', () => {
  const r = computeRetry(0, NOW, AGENT_RETRY_MINUTES, 'failed');
  assertEquals((r as { scheduledFor: string }).scheduledFor, new Date(NOW.getTime() + 3 * 60_000).toISOString());
  assertEquals(computeRetry(2, NOW, AGENT_RETRY_MINUTES, 'failed').status, 'failed');
});

// ── Prompt de reinvocação ─────────────────────────────────────────────────────

Deno.test('buildAgentDirectMessage combina motivo e free_prompt', () => {
  assertEquals(
    buildAgentDirectMessage('pediu retorno após reunião', 'Retome a conversa de onde parou.'),
    '[RETORNO AGENDADO] motivo: pediu retorno após reunião. Retome a conversa de onde parou.',
  );
  assertEquals(
    buildAgentDirectMessage('pediu retorno', null),
    '[RETORNO AGENDADO] motivo: pediu retorno.',
  );
});
