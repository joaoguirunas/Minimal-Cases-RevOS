// supabase/functions/_shared/flows/graph.test.ts
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { nextNode, stableVariant, validateGraph, waitMinutes, type FlowGraph } from './graph.ts';

const ctx = { approvedWaTemplates: new Set(['wa1', 'wa2']), activeEmailTemplates: new Set(['em1']) };
const base: FlowGraph = {
  nodes: [
    { id: 't', type: 'trigger', data: {} },
    { id: 'w1', type: 'wait', data: { amount: 30, unit: 'minutes' } },
    { id: 's1', type: 'send_whatsapp', data: { template_id: 'wa1' } },
    { id: 'c', type: 'condition', data: { check: 'clicked_since_start' } },
    { id: 'w2', type: 'wait', data: { amount: 1, unit: 'days' } },
    { id: 's2', type: 'send_whatsapp', data: { template_id: 'wa2' } },
    { id: 'e', type: 'exit', data: {} },
  ],
  edges: [
    { id: '1', source: 't', target: 'w1' }, { id: '2', source: 'w1', target: 's1' }, { id: '3', source: 's1', target: 'c' },
    { id: '4', source: 'c', sourceHandle: 'yes', target: 'w2' }, { id: '5', source: 'c', sourceHandle: 'no', target: 'e' },
    { id: '6', source: 'w2', target: 's2' }, { id: '7', source: 's2', target: 'e' },
  ],
};

Deno.test('grafo válido passa', () => { assertEquals(validateGraph(base, ctx), { ok: true, errors: [] }); });
Deno.test('navegação por handle; sem handle = out', () => {
  assertEquals(nextNode(base, 'c', 'yes')?.id, 'w2');
  assertEquals(nextNode(base, 'c', 'no')?.id, 'e');
  assertEquals(nextNode(base, 't')?.id, 'w1');
  assertEquals(nextNode(base, 'e'), null);
});
Deno.test('espera em minutos', () => {
  assertEquals(waitMinutes(base.nodes[1]), 30);
  assertEquals(waitMinutes({ id: 'x', type: 'wait', data: { amount: 2, unit: 'days' } }), 2880);
  assertEquals(waitMinutes({ id: 'x', type: 'wait', data: { until: 'business_hours' } }), 0);
});
Deno.test('variante estável por pessoa e ~proporcional', () => {
  const v = [{ key: 'a', pct: 30 }, { key: 'b', pct: 70 }];
  assertEquals(stableVariant('p1:n', v), stableVariant('p1:n', v));
  const a = Array.from({ length: 5000 }, (_, i) => stableVariant(`p${i}:n`, v)).filter((x) => x === 'a').length;
  assert(a > 1300 && a < 1700, `a=${a}`);
});
Deno.test('erros apontam o nó', () => {
  const semNo: FlowGraph = { ...base, edges: base.edges.filter((e) => e.id !== '5') };
  assert(validateGraph(semNo, ctx).errors.some((e) => e.nodeId === 'c' && /não/.test(e.message)));
  const solto: FlowGraph = { ...base, nodes: [...base.nodes, { id: 'z', type: 'add_tag', data: { tag: 'x' } }] };
  assert(validateGraph(solto, ctx).errors.some((e) => e.nodeId === 'z'));
  const tplRuim: FlowGraph = { ...base, nodes: base.nodes.map((n) => n.id === 's2' ? { ...n, data: { template_id: 'naoaprovado' } } : n) };
  assert(validateGraph(tplRuim, ctx).errors.some((e) => e.nodeId === 's2'));
  const colados: FlowGraph = { ...base, nodes: base.nodes.map((n) => n.id === 'w2' ? { ...n, data: { amount: 2, unit: 'minutes' } } : n) };
  assert(validateGraph(colados, ctx).errors.some((e) => e.nodeId === 's2' && /5 min/.test(e.message)));
  const doisGatilhos: FlowGraph = { ...base, nodes: [...base.nodes, { id: 't2', type: 'trigger', data: {} }] };
  assert(!validateGraph(doisGatilhos, ctx).ok);
  const ciclo: FlowGraph = { ...base, edges: [...base.edges.filter((e) => e.id !== '7'), { id: '8', source: 's2', target: 'w1' }] };
  assert(validateGraph(ciclo, ctx).errors.some((e) => /ciclo/.test(e.message)));
  const split: FlowGraph = { nodes: [{ id: 't', type: 'trigger', data: {} }, { id: 'sp', type: 'split', data: { variants: [{ key: 'a', pct: 50 }, { key: 'b', pct: 40 }] } }, { id: 'e', type: 'exit', data: {} }],
    edges: [{ id: '1', source: 't', target: 'sp' }, { id: '2', source: 'sp', sourceHandle: 'a', target: 'e' }, { id: '3', source: 'sp', sourceHandle: 'b', target: 'e' }] };
  assert(validateGraph(split, ctx).errors.some((e) => e.nodeId === 'sp' && /100/.test(e.message)));
});
