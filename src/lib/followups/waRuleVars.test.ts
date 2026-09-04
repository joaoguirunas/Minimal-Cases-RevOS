import { describe, expect, it } from 'vitest';
import { bodyPlaceholders, buttonHasDynamicUrl, parseRuleVars, serializeRuleVars, templateHeaderKind, type RuleVars } from './waRuleVars';

describe('parseRuleVars', () => {
  it('lê os campos conhecidos e ignora os desconhecidos', () => {
    const rv = parseRuleVars({ wa_params: ['nome'], wa_button_url: true, cupom: 'VOLTA10', x: 1 });
    expect(rv).toEqual({
      waParams: ['nome'],
      waButtonUrl: true,
      waHeaderMode: null,
      waHeaderImage: null,
      cupom: 'VOLTA10',
      cupomPct: '',
      expiraHoras: '',
    });
  });

  it('null/undefined vira RuleVars vazio', () => {
    expect(parseRuleVars(null)).toEqual({
      waParams: [],
      waButtonUrl: false,
      waHeaderMode: null,
      waHeaderImage: null,
      cupom: '',
      cupomPct: '',
      expiraHoras: '',
    });
    expect(parseRuleVars(undefined).waParams).toEqual([]);
  });
});

describe('serializeRuleVars', () => {
  const rv: RuleVars = {
    waParams: ['nome'],
    waButtonUrl: true,
    waHeaderMode: null,
    waHeaderImage: '',
    cupom: 'VOLTA10',
    cupomPct: '10',
    expiraHoras: '48',
  };

  it('mantém chaves desconhecidas de prev, omite wa_header_image vazio e converte cupom_pct', () => {
    const out = serializeRuleVars(rv, { x: 1 });
    expect(out.x).toBe(1);
    expect(out.wa_header_image).toBeUndefined();
    expect(out.wa_header_mode).toBeUndefined();
    expect(out.cupom_pct).toBe('10');
    expect(out.wa_params).toEqual(['nome']);
    expect(out.wa_button_url).toBe(true);
    expect(out.cupom).toBe('VOLTA10');
    expect(out.expira_horas).toBe('48');
  });

  it('sem prev, começa de um objeto vazio', () => {
    const out = serializeRuleVars(rv);
    expect(out.x).toBeUndefined();
    expect(out.cupom).toBe('VOLTA10');
  });

  it('omite wa_button_url quando false e wa_params quando vazio', () => {
    const empty: RuleVars = { waParams: [], waButtonUrl: false, waHeaderMode: null, waHeaderImage: null, cupom: '', cupomPct: '', expiraHoras: '' };
    const out = serializeRuleVars(empty, { x: 1 });
    expect(out).toEqual({ x: 1 });
  });
});

describe('bodyPlaceholders', () => {
  it('extrai os números {{N}} do BODY, na ordem de aparição', () => {
    expect(bodyPlaceholders([{ type: 'BODY', text: '{{2}} {{1}}' }])).toEqual([2, 1]);
  });

  it('sem BODY → []', () => {
    expect(bodyPlaceholders([{ type: 'HEADER', format: 'TEXT', text: '{{1}}' }])).toEqual([]);
  });

  it('components inválido → []', () => {
    expect(bodyPlaceholders(null)).toEqual([]);
    expect(bodyPlaceholders(undefined)).toEqual([]);
  });
});

describe('templateHeaderKind', () => {
  it('mapeia o format do HEADER', () => {
    expect(templateHeaderKind([{ type: 'HEADER', format: 'TEXT', text: 'Oi' }])).toBe('text');
    expect(templateHeaderKind([{ type: 'HEADER', format: 'IMAGE' }])).toBe('image');
    expect(templateHeaderKind([{ type: 'HEADER', format: 'VIDEO' }])).toBe('video');
    expect(templateHeaderKind([{ type: 'HEADER', format: 'DOCUMENT' }])).toBe('document');
  });

  it('sem HEADER → none', () => {
    expect(templateHeaderKind([{ type: 'BODY', text: 'Oi' }])).toBe('none');
    expect(templateHeaderKind(null)).toBe('none');
  });
});

describe('buttonHasDynamicUrl', () => {
  it('true quando o botão URL tem {{n}}', () => {
    expect(
      buttonHasDynamicUrl([{ type: 'BUTTONS', buttons: [{ type: 'URL', url: 'https://x.com/{{1}}' }] }]),
    ).toBe(true);
  });

  it('false quando a URL é fixa ou não há botão URL', () => {
    expect(buttonHasDynamicUrl([{ type: 'BUTTONS', buttons: [{ type: 'URL', url: 'https://x.com' }] }])).toBe(false);
    expect(buttonHasDynamicUrl([{ type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Ok' }] }])).toBe(false);
    expect(buttonHasDynamicUrl(null)).toBe(false);
  });
});
