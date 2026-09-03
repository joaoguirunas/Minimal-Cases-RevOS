import { describe, expect, it } from 'vitest';
import { groupByDay } from './timeline';

describe('groupByDay', () => {
  it('agrupa por dia com rótulos relativos', () => {
    const now = new Date('2026-09-03T15:00:00-03:00');
    const g = groupByDay([
      { id: '1', at: '2026-09-03T10:00:00-03:00', kind: 'toque', type: 'email', title: 'E1' },
      { id: '2', at: '2026-09-02T10:00:00-03:00', kind: 'evento', type: 'carrinho_abandonado', title: 'Carrinho' },
      { id: '3', at: '2026-08-30T10:00:00-03:00', kind: 'toque', type: 'sms', title: 'SMS' },
    ], now);
    expect(g.map((x) => x.label)).toEqual(['Hoje', 'Ontem', '30/08']);
    expect(g[0].items[0].id).toBe('1');
  });
});
