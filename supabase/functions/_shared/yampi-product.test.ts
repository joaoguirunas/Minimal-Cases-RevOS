/**
 * Unit tests — yampi-product pure helpers (resumo do produto pro agente).
 * Run: deno test --allow-env --allow-net supabase/functions/_shared/yampi-product.test.ts
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { describeProductForAgent, stripHtml, summarizeProduct, truncateAtSentence } from './yampi-product.ts';

const FIXTURE_WRAPPED = {
  data: {
    id: 1,
    name: 'Case Couro Porta Cartões',
    brand: { data: { name: 'Minimal' } },
    texts: { data: { description: '<p>Couro <b>legítimo</b>…</p><img src=x>' } },
    categories: { data: [{ name: 'Couro' }, { name: 'Modelos iPhone 17' }] },
    images: { data: [{ medium: { url: 'https://cdn/x.jpg' } }] },
    skus: {
      data: [
        {
          id: 11,
          title: 'Case Couro Preto iPhone 17',
          price_sale: 149.9,
          price_discount: 142.9,
          total_in_stock: 3,
          variations: [{ name: 'Cor', value: 'Preto' }, { name: 'Modelo', value: 'iPhone 17' }],
        },
        {
          id: 12,
          title: '…Marrom iPhone 17 Pro',
          price_sale: 149.9,
          total_in_stock: 0,
          variations: { data: [{ name: 'Cor', value: 'Marrom' }, { name: 'Modelo', value: 'iPhone 17 Pro' }] },
        },
      ],
    },
  },
};

// Mesmo produto, mas com arrays diretos (sem `.data`) — a Yampi tem as duas formas.
const FIXTURE_DIRECT = {
  id: 1,
  name: 'Case Couro Porta Cartões',
  brand: { name: 'Minimal' },
  texts: { description: '<p>Couro <b>legítimo</b>…</p><img src=x>' },
  categories: [{ name: 'Couro' }, { name: 'Modelos iPhone 17' }],
  images: [{ medium: { url: 'https://cdn/x.jpg' } }],
  skus: [
    {
      id: 11,
      title: 'Case Couro Preto iPhone 17',
      price_sale: 149.9,
      price_discount: 142.9,
      total_in_stock: 3,
      variations: [{ name: 'Cor', value: 'Preto' }, { name: 'Modelo', value: 'iPhone 17' }],
    },
    {
      id: 12,
      title: '…Marrom iPhone 17 Pro',
      price_sale: 149.9,
      total_in_stock: 0,
      variations: [{ name: 'Cor', value: 'Marrom' }, { name: 'Modelo', value: 'iPhone 17 Pro' }],
    },
  ],
};

function assertSummary(s: ReturnType<typeof summarizeProduct>) {
  if (!s) throw new Error('summary null');
  assertEquals(s.nome, 'Case Couro Porta Cartões');
  assertEquals(s.marca, 'Minimal');
  assertEquals(s.categorias, ['Couro', 'Modelos iPhone 17']);
  assertEquals(s.cores, ['Preto', 'Marrom']);
  assertEquals(s.modelos, ['iPhone 17', 'iPhone 17 Pro']);
  assertEquals(s.precoMin, 142.9);
  assertEquals(s.precoMax, 149.9);
  assertEquals(s.variantes, 2);
  assertEquals(s.semEstoque, ['Marrom / iPhone 17 Pro']);
  assertEquals(s.imagem, 'https://cdn/x.jpg');
  const desc = s.descricao;
  assertEquals(desc.includes('<'), false);
  assertEquals(desc.length <= 600, true);
}

Deno.test('summarizeProduct: formato Yampi com wrappers .data', () => {
  assertSummary(summarizeProduct(FIXTURE_WRAPPED));
});

Deno.test('summarizeProduct: mesmo produto com arrays diretos (sem .data)', () => {
  assertSummary(summarizeProduct(FIXTURE_DIRECT));
});

Deno.test('summarizeProduct: null/undefined → null, sem lançar', () => {
  assertEquals(summarizeProduct(null), null);
  assertEquals(summarizeProduct(undefined), null);
  assertEquals(summarizeProduct({}), null);
});

Deno.test('stripHtml remove tags', () => {
  assertEquals(stripHtml('<p>Couro <b>legítimo</b>…</p><img src=x>'), 'Couro legítimo…');
});

Deno.test('truncateAtSentence corta na última frase que cabe', () => {
  assertEquals(truncateAtSentence('A b. C d. E', 8), 'A b.');
});

Deno.test('describeProductForAgent monta o bloco de contexto', () => {
  const s = summarizeProduct(FIXTURE_WRAPPED);
  if (!s) throw new Error('summary null');
  const out = describeProductForAgent(s);
  assertStringIncludes(out, 'Produto do carrinho: Case Couro Porta Cartões (Minimal)');
  assertStringIncludes(out, 'Cores disponíveis: Preto, Marrom');
  assertStringIncludes(out, 'Modelos: iPhone 17, iPhone 17 Pro');
  assertStringIncludes(out, 'Preço: R$ 142,90 a R$ 149,90');
  assertStringIncludes(out, 'Sem estoque: Marrom / iPhone 17 Pro');
});
