import { describe, expect, it } from 'vitest';
import { buildStageTimeline, formatTempo, labelPlacement, minToParts, offsetOf, snapOffset, templateStatusOf, type VariantLite } from './timeline';

describe('offsetOf', () => {
  it('soma dias/horas/minutos em minutos', () => {
    expect(offsetOf({ dias: 1, horas: 2, minutos: 30 })).toBe(1 * 1440 + 2 * 60 + 30);
  });
});

describe('minToParts', () => {
  it('1470 → 1 dia e 30 minutos', () => {
    expect(minToParts(1470)).toEqual({ dias: 1, horas: 0, minutos: 30 });
  });
});

describe('snapOffset', () => {
  it('escala curta (≤360) → grade de 5', () => {
    expect(snapOffset(37, 300)).toBe(35);
  });

  it('escala média (≤2880) → grade de 15', () => {
    expect(snapOffset(1000, 2000)).toBe(1005);
  });

  it('escala longa (>2880) → grade de 60', () => {
    expect(snapOffset(5000, 9000)).toBe(5040);
  });
});

describe('formatTempo', () => {
  it('igual ao StageFollowupsCard', () => {
    expect(formatTempo(0, 0, 0)).toBe('Imediato');
    expect(formatTempo(1, 2, 30)).toBe('1d 2h 30min');
    expect(formatTempo(0, 0, 30)).toBe('30min');
  });
});

describe('labelPlacement', () => {
  it('alterna quando os marcadores ficam a menos de 6% de distância', () => {
    expect(labelPlacement([0, 30, 1440], 1440)).toEqual(['above', 'below', 'above']);
  });
});

const tpl = [
  { id_template: '111', nome: 'minimal_esteira_wa01', meta_template_name: 'minimal_esteira_wa01', status: 'APPROVED' },
  { id_template: '222', nome: 'minimal_esteira_wa02', meta_template_name: null, status: 'PENDING' },
] as never[];

const base = {
  leads_stages_id: 's1', score_matrix_id: null, target_stage_id: null, mensagem: null, assunto: null,
  arquivo_audio: null, template_id: null, whatsapp_template_id: null, whatsapp_template_name: null,
  email_template_id: null, email_template_name: null, as_queue_id: null, ativo: true, control: null,
  business_hours_only: false, bh_only_last: false, created_at: '', updated_at: '', vars: null, ab_variant_id: null,
};

const rules = [
  { ...base, id: 'e1', dias: 0, horas: 0, minutos: 30, tipo: 'email', email_template_name: 'E1 · Esqueceu algo?', mensagem: '<a href="{{link_checkout}}">voltar</a>' },
  { ...base, id: 'w1', dias: 0, horas: 2, minutos: 0, tipo: 'whatsapp_template', whatsapp_template_id: '111', whatsapp_template_name: 'minimal_esteira_wa01', vars: { wa_button_url: true, wa_header_mode: 'fixa' } },
  { ...base, id: 'w2', dias: 1, horas: 0, minutos: 0, tipo: 'whatsapp_template', whatsapp_template_id: '222', vars: {} },
  { ...base, id: 'x', dias: 2, horas: 0, minutos: 0, tipo: 'whatsapp_template', whatsapp_template_id: '999', ab_variant_id: 'vB' },
] as never[];

const variants: VariantLite[] = [
  { id: 'vA', key: 'A', name: 'A', position: 0 },
  { id: 'vB', key: 'B', name: 'B', position: 1 },
];

describe('templateStatusOf', () => {
  it('aprovado / em análise / sem template / não se aplica', () => {
    expect(templateStatusOf(rules[1], tpl)).toBe('aprovado');
    expect(templateStatusOf(rules[2], tpl)).toBe('em_analise');
    expect(templateStatusOf(rules[3], tpl)).toBe('sem_template');
    expect(templateStatusOf(rules[0], tpl)).toBe('nao_aplica');
  });
});

describe('buildStageTimeline', () => {
  it('agrupa em lanes comum/A/B, ordena por offset e casa CTR por template', () => {
    const [s] = buildStageTimeline(rules, tpl, [{ key: 'esteira_whatsapp|minimal_esteira_wa01', source: 'esteira_whatsapp', label: '', enviados: 10, clicados: 4, cliques: 5, ctr: 0.4 }], variants);

    expect(s.stageId).toBe('s1');
    expect(s.lanes.map((l) => l.key)).toEqual(['comum', 'A', 'B']);
    expect(s.lanes[0].rules).toHaveLength(3);
    expect(s.lanes[1].rules).toHaveLength(0);
    expect(s.lanes[2].rules).toHaveLength(1);

    expect(s.lanes[0].rules.map((r) => r.id)).toEqual(['e1', 'w1', 'w2']);
    expect(s.lanes[0].rules[0]).toMatchObject({ offsetMin: 30, canal: 'email', tracked: true, label: 'E1 · Esqueceu algo?' });
    expect(s.lanes[0].rules[1]).toMatchObject({ offsetMin: 120, canal: 'whatsapp', tracked: true, templateStatus: 'aprovado', headerImage: true, ctr: { enviados: 10, clicados: 4, ctr: 0.4 } });
    expect(s.lanes[0].rules[2].tracked).toBe(false);
    expect(s.lanes[0].rules[2].headerImage).toBe(false);

    expect(s.lanes[2].rules[0]).toMatchObject({ id: 'x', variantId: 'vB', templateStatus: 'sem_template' });

    expect(s.maxOffsetMin).toBe(2880);
  });

  it('calcula a colocação do rótulo (above/below) por lane', () => {
    const [s] = buildStageTimeline(rules, tpl, [], variants);
    expect(s.lanes[0].rules.map((r) => r.placement)).toEqual(['above', 'below', 'above']);
    expect(s.lanes[2].rules.map((r) => r.placement)).toEqual(['above']);
  });
});
