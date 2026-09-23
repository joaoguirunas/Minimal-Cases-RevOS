// src/components/bi/csv.test.ts
import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';
describe('csv', () => {
  it('escapa aspas, ponto e vírgula e quebra de linha; separador ;', () => {
    const s = toCsv([{ a: 'x;y', b: 'diz "oi"\nok', c: 1.5 }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { key: 'c', label: 'C' }]);
    expect(s).toBe('﻿A;B;C\n"x;y";"diz ""oi""\nok";1,5');
  });
});
