import { describe, expect, it } from 'vitest';
import { clicksToTimeline, describeLinkOrigin, summarizeLinkClicks, type TrackedLinkRow } from './clicks';

const links: TrackedLinkRow[] = [
  { id: 'L1', lead_id: 'a', source: 'esteira_whatsapp', label: 'wa_button_url', template_name: 'minimal_esteira_wa01', channel: 'whatsapp', clicks: 2, first_clicked_at: '2026-09-03T22:31:00Z', last_clicked_at: '2026-09-04T00:48:00Z' },
  { id: 'L2', lead_id: 'a', source: 'esteira_email', label: 'link_checkout', template_name: 'E1', channel: 'email', clicks: 0, first_clicked_at: null, last_clicked_at: null },
  { id: 'L3', lead_id: 'b', source: 'agente', label: 'yampi_enviar_link_pagamento', template_name: null, channel: 'whatsapp', clicks: 1, first_clicked_at: '2026-09-01T10:00:00Z', last_clicked_at: '2026-09-01T10:00:00Z' },
];

describe('summarizeLinkClicks', () => {
  it('soma cliques humanos por lead e acha primeiro/último', () => {
    const s = summarizeLinkClicks(links);
    expect(s['a']).toEqual({ total: 2, links: 1, firstAt: '2026-09-03T22:31:00Z', lastAt: '2026-09-04T00:48:00Z' });
    expect(s['b'].total).toBe(1);
  });
  it('lead sem clique não aparece', () => {
    expect(summarizeLinkClicks(links.filter((l) => l.id === 'L2'))).toEqual({});
  });
});

describe('describeLinkOrigin', () => {
  it('nomeia canal e template', () => {
    expect(describeLinkOrigin(links[0])).toBe('WhatsApp · minimal_esteira_wa01');
    expect(describeLinkOrigin(links[2])).toBe('Agente · link de pagamento');
  });
});

describe('clicksToTimeline', () => {
  it('uma entrada por clique humano, com ordinal e dispositivo', () => {
    const t = clicksToTimeline(links, [
      { id: 1, tracked_link_id: 'L1', lead_id: 'a', clicked_at: '2026-09-03T22:31:00Z', device: 'mobile' },
      { id: 2, tracked_link_id: 'L1', lead_id: 'a', clicked_at: '2026-09-04T00:48:00Z', device: 'desktop' },
    ]);
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ id: 'click-1', kind: 'clique', type: 'whatsapp', title: 'Abriu o link · WhatsApp · minimal_esteira_wa01', detail: 'celular' });
    expect(t[1].detail).toBe('2º clique · computador');
  });
  it('link legado com clicks>0 e sem eventos vira uma entrada em first_clicked_at', () => {
    const t = clicksToTimeline(links, []);
    expect(t.map((e) => e.id).sort()).toEqual(['click-legacy-L1', 'click-legacy-L3']);
    expect(t.find((e) => e.id === 'click-legacy-L1')?.detail).toBe('2 cliques');
  });
});
