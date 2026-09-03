import { describe, expect, it } from 'vitest';
import { toCsv } from './ReconversionsTable';

describe('toCsv', () => {
  it('escapa aspas e usa ; como separador', () => {
    const csv = toCsv([{ id: '1', order_id: '10', people_id: null, lead_id: null, order_total: 99.9, paid_at: '2026-09-02T12:00:00Z', last_touch_at: null, touches_email: 1, touches_whatsapp: 0, touches_sms: 0, touches_total: 1, hours_since_last_touch: 2, attributed: true, attribution_level: 'cupom', coupon_code: 'VOLTA10', pessoa: { name: 'Ana "A"' } } as never]);
    expect(csv.split('\n')[0]).toBe('cliente;pedido;valor;pago_em;atribuicao;cupom;toques_email;toques_whatsapp;toques_sms;horas_ultimo_toque');
    expect(csv.split('\n')[1]).toContain('"Ana ""A""";10;99.9;');
  });

  it('neutraliza injeção de fórmula no nome do cliente', () => {
    const csv = toCsv([{ id: '1', order_id: '10', people_id: null, lead_id: null, order_total: 99.9, paid_at: '2026-09-02T12:00:00Z', last_touch_at: null, touches_email: 1, touches_whatsapp: 0, touches_sms: 0, touches_total: 1, hours_since_last_touch: 2, attributed: true, attribution_level: 'cupom', coupon_code: 'VOLTA10', pessoa: { name: '=HYPERLINK("http://x","y")' } } as never]);
    const line = csv.split('\n')[1];
    const cliente = line.split(';')[0];
    // envolvido em aspas por causa do "; o conteúdo interno deve começar com a aspa simples neutralizante antes do '='
    expect(cliente.startsWith('"\'=HYPERLINK')).toBe(true);
  });

  it('neutraliza injeção de fórmula no cupom', () => {
    const csv = toCsv([{ id: '1', order_id: '10', people_id: null, lead_id: null, order_total: 99.9, paid_at: '2026-09-02T12:00:00Z', last_touch_at: null, touches_email: 1, touches_whatsapp: 0, touches_sms: 0, touches_total: 1, hours_since_last_touch: 2, attributed: true, attribution_level: 'cupom', coupon_code: '+CMD', pessoa: { name: 'Cliente Normal' } } as never]);
    const line = csv.split('\n')[1];
    expect(line).toContain(";'+CMD;");
  });

  it('não prefixa nome benigno com acento', () => {
    const csv = toCsv([{ id: '1', order_id: '10', people_id: null, lead_id: null, order_total: 99.9, paid_at: '2026-09-02T12:00:00Z', last_touch_at: null, touches_email: 1, touches_whatsapp: 0, touches_sms: 0, touches_total: 1, hours_since_last_touch: 2, attributed: true, attribution_level: 'cupom', coupon_code: 'VOLTA10', pessoa: { name: 'Ana Preçoso' } } as never]);
    const line = csv.split('\n')[1];
    expect(line.startsWith('Ana Preçoso;')).toBe(true);
  });
});
