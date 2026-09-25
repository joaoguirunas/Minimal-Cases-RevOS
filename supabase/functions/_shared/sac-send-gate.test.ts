import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { sacBypassReason } from './sac-send-gate.ts';
import { SAC_WA_URL } from './sac-redirect.ts';

const now = new Date('2026-09-25T15:00:00Z');
const ok = {
  callerIsService: true,
  row: { status: 'approved', people_id: 'p1', proposed_text: 'Oi! Aqui é da Minimal…' },
  bodyPeopleId: 'p1',
  messages: [{ type: 'text', text: 'Oi! Aqui é da Minimal…' }],
  personPhone: '5561981703286',
  to: '+55 61 98170-3286',
  lastInboundAt: new Date('2026-09-25T14:50:00Z'),
  now,
};

Deno.test('resposta SAC aprovada, para quem escreveu há < 24 h, passa', () => {
  assertEquals(sacBypassReason(ok), null);
});
Deno.test('chamada do front (não service role) nunca passa', () => {
  assert(sacBypassReason({ ...ok, callerIsService: false }));
});
Deno.test('só registro aprovado passa (pendente/rejeitado/enviado não)', () => {
  for (const status of ['awaiting_approval', 'rejected', 'sent', 'failed']) assert(sacBypassReason({ ...ok, row: { ...ok.row, status } }));
  assert(sacBypassReason({ ...ok, row: null }));
});
Deno.test('texto diferente do aprovado ou mais de uma mensagem não passa', () => {
  assert(sacBypassReason({ ...ok, messages: [{ type: 'text', text: 'outra coisa' }] }));
  assert(sacBypassReason({ ...ok, messages: [...ok.messages, ...ok.messages] }));
  assert(sacBypassReason({ ...ok, messages: [{ type: 'template', text: ok.row.proposed_text }] }));
});
Deno.test('outra pessoa ou outro número não passa', () => {
  assert(sacBypassReason({ ...ok, bodyPeopleId: 'p2' }));
  assert(sacBypassReason({ ...ok, to: '5511999990000' }));
});
Deno.test('fora da janela de 24 h (ou sem mensagem do cliente) não passa', () => {
  assert(sacBypassReason({ ...ok, lastInboundAt: new Date('2026-09-24T14:00:00Z') }));
  assert(sacBypassReason({ ...ok, lastInboundAt: null }));
});
Deno.test('tolera o nono dígito', () => {
  assertEquals(sacBypassReason({ ...ok, personPhone: '556181703286' }), null);
});
Deno.test('cadastro sem o 55 bate com o número enviado com 55', () => {
  assertEquals(sacBypassReason({ ...ok, personPhone: '(61) 98170-3286' }), null);
});

Deno.test('botão do SAC passa só com o texto aprovado e o link do atendimento', () => {
  const btn = { type: 'cta_url', text: ok.row.proposed_text, url: SAC_WA_URL, button_text: 'Falar no WhatsApp' };
  assertEquals(sacBypassReason({ ...ok, messages: [btn] }), null);
  assert(sacBypassReason({ ...ok, messages: [{ ...btn, url: 'https://golpe.example' }] }));
  assert(sacBypassReason({ ...ok, messages: [{ ...btn, text: 'outro texto' }] }));
});
