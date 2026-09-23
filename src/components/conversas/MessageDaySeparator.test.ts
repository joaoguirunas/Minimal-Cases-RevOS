import { describe, expect, it } from 'vitest';
import { dayLabel, sameDay } from './MessageDaySeparator';

describe('linha do tempo', () => {
  const now = new Date(2026, 8, 23, 15, 0);
  it('hoje, ontem, dia da semana e data', () => {
    expect(dayLabel(new Date(2026, 8, 23, 9).toISOString(), now)).toBe('Hoje');
    expect(dayLabel(new Date(2026, 8, 22, 23).toISOString(), now)).toBe('Ontem');
    expect(dayLabel(new Date(2026, 8, 19, 10).toISOString(), now)).toBe('sábado');
    expect(dayLabel(new Date(2026, 8, 2, 10).toISOString(), now)).toBe('2 de setembro');
    expect(dayLabel(new Date(2025, 11, 31, 10).toISOString(), now)).toBe('31 de dezembro de 2025');
  });
  it('sameDay compara o calendário local', () => {
    expect(sameDay(new Date(2026, 8, 23, 0, 1).toISOString(), new Date(2026, 8, 23, 23, 59).toISOString())).toBe(true);
    expect(sameDay(new Date(2026, 8, 22, 23, 59).toISOString(), new Date(2026, 8, 23, 0, 1).toISOString())).toBe(false);
  });
});
