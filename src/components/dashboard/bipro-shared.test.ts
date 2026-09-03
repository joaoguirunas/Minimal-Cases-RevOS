import { describe, expect, it } from 'vitest';
import { fmtBRL, fmtDays } from './bipro-shared';

describe('bipro-shared formatters', () => {
  it('formata BRL sem centavos', () => {
    // \u00a0 = NBSP que o Intl pt-BR insere entre "R$" e o número
    expect(fmtBRL(1234.5).replace(/\u00a0/g, ' ')).toBe('R$ 1.235');
  });
  it('fmtDays trata null', () => {
    expect(fmtDays(null)).toBe('—');
    expect(fmtDays(2.4)).toBe('2d');
  });
});
