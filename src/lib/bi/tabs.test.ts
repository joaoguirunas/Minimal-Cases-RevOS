import { describe, expect, it } from 'vitest';
import { firstAllowedTab } from './tabs';
describe('aba inicial', () => {
  it('mantém a aba se permitida; senão vai para a primeira permitida', () => {
    expect(firstAllowedTab('visao', ['visao', 'esteira'])).toBe('visao');
    expect(firstAllowedTab('visao', ['recuperacao', 'reconversao'])).toBe('recuperacao');
  });
});
