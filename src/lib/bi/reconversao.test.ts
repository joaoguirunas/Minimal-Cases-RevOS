import { describe, expect, it } from 'vitest';
import { aggregateReconversao, delta, kpis } from './reconversao';

const r = (over: Partial<Parameters<typeof kpis>[0][number]> = {}) => ({
  order_total: 100, paid_at: '2026-09-02T12:00:00Z', attributed: true, attribution_level: 'cupom' as const,
  people_id: 'p1', hours_since_last_touch: 10, touches_email: 2, touches_whatsapp: 0, touches_sms: 1, coupon_code: 'VOLTA10', ...over,
});
const t = (person_id: string, channel = 'email') => ({ channel, person_id, fired_at: '2026-09-01T10:00:00Z' });

describe('kpis', () => {
  it('separa atribuídos de orgânicos e calcula taxa sobre tocados', () => {
    const k = kpis([r(), r({ attributed: false, attribution_level: null, people_id: 'p9' })], [t('p1'), t('p2'), t('p2', 'sms')]);
    expect(k.reconvertidos).toBe(1); expect(k.organicos).toBe(1);
    expect(k.leadsTocados).toBe(2); expect(k.taxa).toBeCloseTo(0.5);
    expect(k.toques).toEqual({ email: 2, whatsapp: 0, sms: 1, total: 3 });
    expect(k.receita).toBe(100); expect(k.ticketMedio).toBe(100);
  });
});

describe('delta', () => {
  it('fração com sinal; null sem base', () => {
    expect(delta(120, 100)).toBeCloseTo(0.2); expect(delta(80, 100)).toBeCloseTo(-0.2);
    expect(delta(10, 0)).toBeNull(); expect(delta(10, null)).toBeNull();
  });
});

describe('aggregateReconversao', () => {
  it('funil, níveis, receita por nível e top cupons', () => {
    const a = aggregateReconversao({
      rows: [r(), r({ attribution_level: 'clique', coupon_code: null, people_id: 'p2', order_total: 50 }), r({ attributed: false, attribution_level: null, people_id: 'p9', order_total: 30 })],
      touches: [t('p1'), t('p2'), t('p3')],
      clicks: [{ people_id: 'p2', first_clicked_at: '2026-09-01T11:00:00Z' }, { people_id: 'p7', first_clicked_at: null }],
      prevRows: [r({ order_total: 200 })], prevTouches: [t('p1')],
    });
    expect(a.funil).toEqual({ tocados: 3, clicaram: 1, pagaram: 2 });
    expect(a.porNivel).toEqual({ cupom: 1, clique: 1, janela: 0 });
    expect(a.porNivelReceita).toEqual({ cupom: 100, clique: 50, janela: 0, organico: 30 });
    expect(a.topCupons).toEqual([{ code: 'VOLTA10', pedidos: 1, receita: 100 }]);
    expect(a.deltas.receita).toBeCloseTo((150 - 200) / 200);
    expect(a.porCanalUltimoToque.email).toBe(2);
  });
});
