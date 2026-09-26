// supabase/functions/_shared/flows/runner.test.ts
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { advanceRun, type RunnerDeps, type RunState } from './runner.ts';
import type { FlowGraph } from './graph.ts';

const T0 = new Date('2026-09-27T12:00:00Z');
const g: FlowGraph = {
  nodes: [
    { id: 't', type: 'trigger', data: {} },
    { id: 'w1', type: 'wait', data: { amount: 30, unit: 'minutes' } },
    { id: 'wa', type: 'send_whatsapp', data: { template_id: 'wa1', use_personal_coupon: true, vars: { wa_button_url: true } } },
    { id: 'c', type: 'condition', data: { check: 'clicked_since_start' } },
    { id: 'em', type: 'send_email', data: { email_template_id: 'em1' } },
    { id: 'e', type: 'exit', data: {} },
  ],
  edges: [
    { id: '1', source: 't', target: 'w1' }, { id: '2', source: 'w1', target: 'wa' }, { id: '3', source: 'wa', target: 'c' },
    { id: '4', source: 'c', sourceHandle: 'yes', target: 'em' }, { id: '5', source: 'c', sourceHandle: 'no', target: 'e' },
    { id: '6', source: 'em', target: 'e' },
  ],
};
function deps(over: Partial<RunnerDeps> = {}, now = T0) {
  const sent: { node: string; vars: Record<string, unknown> }[] = [];
  const d: RunnerDeps = {
    now: () => now, purchasedSince: async () => false, leadActive: async () => true, clickedSince: async () => true,
    contact: async () => ({ whatsapp: true, email: true, tags: [] }), nextBusinessOpen: async (f) => f,
    enqueueSend: async (p) => { sent.push({ node: p.node.id, vars: p.vars }); return `q-${p.node.id}`; },
    moveStage: async () => {}, addTag: async () => {}, ...over,
  };
  return { d, sent };
}
const run = (over: Partial<RunState> = {}): RunState => ({ id: 'r', flowId: 'f', peopleId: 'p', leadId: 'l', mode: 'live', currentNodeId: null, context: {}, startedAt: T0.toISOString(), ...over });

Deno.test('entra, para na espera e marca a hora de acordar', async () => {
  const { d, sent } = deps();
  const r = await advanceRun(run(), g, { exitOnPurchase: true }, d);
  assertEquals(r.status, 'active'); assertEquals(r.currentNodeId, 'w1');
  assertEquals(r.wakeAt, new Date(T0.getTime() + 30 * 60_000).toISOString()); assertEquals(sent.length, 0);
});
Deno.test('ao acordar: envia com cupom, condição sim, e-mail, termina', async () => {
  const later = new Date(T0.getTime() + 31 * 60_000);
  const { d, sent } = deps({}, later);
  const first = await advanceRun(run(), g, { exitOnPurchase: true }, deps().d);
  const r = await advanceRun(run({ currentNodeId: first.currentNodeId, context: first.context }), g, { exitOnPurchase: true }, d);
  assertEquals(r.status, 'completed');
  assertEquals(sent.map((s) => s.node), ['wa', 'em']);
  assertEquals(sent[0].vars.cupom_pessoal, true); assertEquals(sent[0].vars.wa_button_url, true);
  assertEquals(sent[1].vars.email_template_id, 'em1'); assertEquals(sent[1].vars.cupom_pessoal, undefined);
  assert(r.logs.some((l) => l.nodeId === 'c' && l.detail?.branch === 'yes'));
});
Deno.test('condição não → sai sem e-mail', async () => {
  const { d, sent } = deps({ clickedSince: async () => false }, new Date(T0.getTime() + 31 * 60_000));
  const r = await advanceRun(run({ currentNodeId: 'w1', context: { waitingOn: 'w1' } }), g, { exitOnPurchase: true }, d);
  assertEquals(r.status, 'completed'); assertEquals(sent.map((s) => s.node), ['wa']);
});
Deno.test('comprou → sai antes de qualquer nó', async () => {
  const { d, sent } = deps({ purchasedSince: async () => true });
  const r = await advanceRun(run({ currentNodeId: 'w1', context: { waitingOn: 'w1' } }), g, { exitOnPurchase: true }, d);
  assertEquals(r.status, 'exited'); assertEquals(r.exitReason, 'purchased'); assertEquals(sent.length, 0);
});
Deno.test('lead saiu da esteira → sai', async () => {
  const { d } = deps({ leadActive: async () => false });
  const r = await advanceRun(run(), g, { exitOnPurchase: true }, d);
  assertEquals(r.status, 'exited'); assertEquals(r.exitReason, 'lead_inativo');
});
Deno.test('simulação não enfileira: registra would_send com a chave do template', async () => {
  const { d, sent } = deps({}, new Date(T0.getTime() + 31 * 60_000));
  const r = await advanceRun(run({ mode: 'simulation', currentNodeId: 'w1', context: { waitingOn: 'w1' } }), g, { exitOnPurchase: true }, d);
  assertEquals(sent.length, 0);
  assertEquals(r.logs.filter((l) => l.action === 'would_send').map((l) => l.detail?.key), ['wa1', 'em1']);
});
Deno.test('sem WhatsApp → pula o envio e segue', async () => {
  const { d, sent } = deps({ contact: async () => ({ whatsapp: false, email: true, tags: [] }) }, new Date(T0.getTime() + 31 * 60_000));
  const r = await advanceRun(run({ currentNodeId: 'w1', context: { waitingOn: 'w1' } }), g, { exitOnPurchase: true }, d);
  assert(r.logs.some((l) => l.nodeId === 'wa' && l.action === 'skipped'));
  assertEquals(sent.map((s) => s.node), ['em']);
});
Deno.test('proteção: no máximo 50 nós por rodada', async () => {
  const nodes = [{ id: 't', type: 'trigger' as const, data: {} }, ...Array.from({ length: 80 }, (_, i) => ({ id: `g${i}`, type: 'add_tag' as const, data: { tag: 'x' } }))];
  const edges = nodes.slice(0, -1).map((n, i) => ({ id: `e${i}`, source: n.id, target: nodes[i + 1].id }));
  const { d } = deps();
  const r = await advanceRun(run(), { nodes, edges }, { exitOnPurchase: true }, d);
  assertEquals(r.status, 'active'); assert(r.logs.length <= 51);
});

Deno.test('fluxo de Pix/recusado não exige etapa da esteira; fluxo de compra não checa lead', async () => {
  const calls: string[] = [];
  const { d } = deps({ leadActive: async (_l: string, mode: string) => { calls.push(mode); return mode !== 'esteira'; } });
  const r1 = await advanceRun(run(), g, { exitOnPurchase: true, leadCheck: 'open' }, d);
  assertEquals(r1.status, 'active'); assertEquals(calls, ['open']);
  const r2 = await advanceRun(run(), g, { exitOnPurchase: false, leadCheck: 'none' }, d);
  assertEquals(r2.status, 'active'); assertEquals(calls, ['open']);
  const r3 = await advanceRun(run(), g, { exitOnPurchase: true, leadCheck: 'esteira' }, d);
  assertEquals(r3.status, 'exited');
});
