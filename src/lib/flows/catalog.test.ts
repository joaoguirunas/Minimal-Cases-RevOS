// src/lib/flows/catalog.test.ts
import { describe, it, expect } from 'vitest';
import { NODE_CATALOG, newNode } from './catalog';

describe('catálogo de nós', () => {
  it('condição tem saídas sim/não; split uma por variante; saída padrão out', () => {
    expect(NODE_CATALOG.condition.handles({}).map((h) => h.id)).toEqual(['yes', 'no']);
    expect(NODE_CATALOG.split.handles({ variants: [{ key: 'a', pct: 50 }, { key: 'b', pct: 50 }] }).map((h) => h.id)).toEqual(['a', 'b']);
    expect(NODE_CATALOG.wait.handles({}).map((h) => h.id)).toEqual(['out']);
    expect(NODE_CATALOG.exit.handles({})).toEqual([]);
  });
  it('resumo legível', () => {
    expect(NODE_CATALOG.wait.summary({ amount: 30, unit: 'minutes' }, {})).toBe('Esperar 30 min');
    expect(NODE_CATALOG.wait.summary({ amount: 3, unit: 'days' }, {})).toBe('Esperar 3 dias');
    expect(NODE_CATALOG.wait.summary({ until: 'business_hours' }, {})).toBe('Esperar horário comercial');
    expect(NODE_CATALOG.send_whatsapp.summary({ template_id: '1' }, { waName: (id: string) => (id === '1' ? 'mc_v2_cupom_30min_lk' : '') })).toBe('mc_v2_cupom_30min_lk');
  });
  it('novo nó com id único e dados padrão', () => {
    const a = newNode('wait', { x: 0, y: 0 }); const b = newNode('wait', { x: 0, y: 0 });
    expect(a.id).not.toBe(b.id); expect(a.data).toEqual({ amount: 1, unit: 'hours' });
  });
});
