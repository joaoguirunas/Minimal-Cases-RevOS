import { describe, expect, it } from 'vitest';
import { aggregateClickRates, overallClickRate } from './clicks';

const links = [
  { source: 'esteira_whatsapp', label: 'wa_button_url', template_name: 'minimal_esteira_wa01', channel: 'whatsapp', clicks: 2 },
  { source: 'esteira_whatsapp', label: 'wa_button_url', template_name: 'minimal_esteira_wa01', channel: 'whatsapp', clicks: 0 },
  { source: 'esteira_whatsapp', label: 'wa_button_url', template_name: 'minimal_esteira_wa01', channel: 'whatsapp', clicks: 1 },
  { source: 'esteira_email', label: 'link_checkout', template_name: 'E1', channel: 'email', clicks: 0 },
  { source: 'agente', label: 'yampi_enviar_link_carrinho', template_name: null, channel: 'whatsapp', clicks: 1 },
];

describe('aggregateClickRates', () => {
  it('agrupa por origem+template, ordena por enviados, calcula CTR', () => {
    const r = aggregateClickRates(links);
    expect(r[0]).toEqual({ key: 'esteira_whatsapp|minimal_esteira_wa01', source: 'esteira_whatsapp', label: 'WhatsApp · minimal_esteira_wa01', enviados: 3, clicados: 2, cliques: 3, ctr: 2 / 3 });
    expect(r.find((x) => x.source === 'esteira_email')?.ctr).toBe(0);
    expect(r.find((x) => x.source === 'agente')?.label).toBe('Agente · link do carrinho');
  });
  it('lista vazia → [] e CTR geral null', () => {
    expect(aggregateClickRates([])).toEqual([]);
    expect(overallClickRate([])).toEqual({ enviados: 0, clicados: 0, ctr: null });
    expect(overallClickRate(links)).toEqual({ enviados: 5, clicados: 3, ctr: 0.6 });
  });
});
