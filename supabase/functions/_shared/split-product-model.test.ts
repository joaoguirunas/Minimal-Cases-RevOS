// Run: deno test --allow-env supabase/functions/_shared/split-product-model.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { splitProductModel } from './tracked-links.ts';

Deno.test('splitProductModel: marca repetida — pega o modelo do FIM, não o primeiro', () => {
  assertEquals(splitProductModel('Case iPhone em Tecido Woven com MagSafe Marrom iPhone 16 Pro'),
    { produto: 'Case iPhone em Tecido Woven com MagSafe Marrom', modelo: 'iPhone 16 Pro' });
  assertEquals(splitProductModel('Case Samsung com Acabamento em Carbono e Carregamento MagSafe Prata Samsung S22 Ultra'),
    { produto: 'Case Samsung com Acabamento em Carbono e Carregamento MagSafe Prata', modelo: 'Samsung S22 Ultra' });
  assertEquals(splitProductModel('Case para iPhone 17 em Couro Aveludado Premium MagSafe Preto iPhone 17 Pro'),
    { produto: 'Case para iPhone 17 em Couro Aveludado Premium MagSafe Preto', modelo: 'iPhone 17 Pro' });
});

Deno.test('splitProductModel: título sem modelo fica inteiro no produto', () => {
  assertEquals(splitProductModel('Capa AirPods Couro Genuíno Textura Lisa Preto'),
    { produto: 'Capa AirPods Couro Genuíno Textura Lisa Preto', modelo: null });
  assertEquals(splitProductModel('Case iPhone em Tecido Woven'),
    { produto: 'Case iPhone em Tecido Woven', modelo: null });
});

Deno.test('splitProductModel: modelo simples e traço final', () => {
  assertEquals(splitProductModel('Case Minimal Preta - iPhone 14'), { produto: 'Case Minimal Preta', modelo: 'iPhone 14' });
  assertEquals(splitProductModel(''), { produto: '', modelo: null });
});
