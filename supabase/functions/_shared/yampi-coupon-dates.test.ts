// Run: deno test --allow-env supabase/functions/_shared/yampi-coupon-dates.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

/** Mesma formatação usada em createPersonalCoupon (fuso da loja, sem offset). */
const SP_FMT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});
const fmtYampi = (d: Date) => SP_FMT.format(d).replace('T', ' ');

Deno.test('fmtYampi: converte para o horário de Brasília, não UTC', () => {
  // 14:14 UTC = 11:14 em São Paulo — era esse o cupom que nascia válido só 3h depois.
  assertEquals(fmtYampi(new Date('2026-09-10T14:14:06Z')), '2026-09-10 11:14:06');
  assertEquals(fmtYampi(new Date('2026-09-13T14:14:06Z')), '2026-09-13 11:14:06');
});

Deno.test('fmtYampi: vira o dia corretamente na madrugada', () => {
  // 02:30 UTC ainda é o dia anterior às 23:30 em São Paulo.
  assertEquals(fmtYampi(new Date('2026-09-11T02:30:00Z')), '2026-09-10 23:30:00');
});
