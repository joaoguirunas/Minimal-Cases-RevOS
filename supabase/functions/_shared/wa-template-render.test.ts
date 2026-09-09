import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  templateHeaderKind,
  bodyPlaceholders,
  buttonHasDynamicUrl,
  resolveHeaderImage,
  buildEsteiraWaComponents,
  type TplComponent,
} from './wa-template-render.ts';

// ---------------------------------------------------------------------------
// templateHeaderKind
// ---------------------------------------------------------------------------

Deno.test('templateHeaderKind - HEADER format IMAGE -> image', () => {
  const components: TplComponent[] = [{ type: 'HEADER', format: 'IMAGE' }];
  assertEquals(templateHeaderKind(components), 'image');
});

Deno.test('templateHeaderKind - no HEADER (only BODY) -> none', () => {
  const components: TplComponent[] = [{ type: 'BODY' }];
  assertEquals(templateHeaderKind(components), 'none');
});

Deno.test('templateHeaderKind - format absent but text present -> text', () => {
  const components: TplComponent[] = [{ type: 'HEADER', text: 'Oi {{nome}}' }];
  assertEquals(templateHeaderKind(components), 'text');
});

Deno.test('templateHeaderKind - format VIDEO -> video', () => {
  const components: TplComponent[] = [{ type: 'HEADER', format: 'VIDEO' }];
  assertEquals(templateHeaderKind(components), 'video');
});

Deno.test('templateHeaderKind - format DOCUMENT -> document', () => {
  const components: TplComponent[] = [{ type: 'HEADER', format: 'DOCUMENT' }];
  assertEquals(templateHeaderKind(components), 'document');
});

Deno.test('templateHeaderKind - HEADER with no format and no text -> none', () => {
  const components: TplComponent[] = [{ type: 'HEADER' }];
  assertEquals(templateHeaderKind(components), 'none');
});

Deno.test('templateHeaderKind - lowercase type still matched (case-insensitive)', () => {
  const components: TplComponent[] = [{ type: 'header', format: 'image' }];
  assertEquals(templateHeaderKind(components), 'image');
});

// ---------------------------------------------------------------------------
// bodyPlaceholders
// ---------------------------------------------------------------------------

Deno.test('bodyPlaceholders - extracts positionals in order of appearance', () => {
  const components: TplComponent[] = [{ type: 'BODY', text: 'Oi {{1}}, sua {{2}}' }];
  assertEquals(bodyPlaceholders(components), [1, 2]);
});

Deno.test('bodyPlaceholders - no BODY component -> []', () => {
  const components: TplComponent[] = [{ type: 'HEADER', format: 'IMAGE' }];
  assertEquals(bodyPlaceholders(components), []);
});

Deno.test('bodyPlaceholders - BODY without text -> []', () => {
  const components: TplComponent[] = [{ type: 'BODY' }];
  assertEquals(bodyPlaceholders(components), []);
});

// ---------------------------------------------------------------------------
// buttonHasDynamicUrl
// ---------------------------------------------------------------------------

Deno.test('buttonHasDynamicUrl - URL button with {{1}} -> true', () => {
  const components: TplComponent[] = [{
    type: 'BUTTONS',
    buttons: [{ type: 'URL', url: 'https://x/r?t={{1}}' }],
  }];
  assertEquals(buttonHasDynamicUrl(components), true);
});

Deno.test('buttonHasDynamicUrl - URL button without placeholder -> false', () => {
  const components: TplComponent[] = [{
    type: 'BUTTONS',
    buttons: [{ type: 'URL', url: 'https://x/static' }],
  }];
  assertEquals(buttonHasDynamicUrl(components), false);
});

Deno.test('buttonHasDynamicUrl - no BUTTONS component -> false', () => {
  const components: TplComponent[] = [{ type: 'BODY', text: 'oi' }];
  assertEquals(buttonHasDynamicUrl(components), false);
});

Deno.test('buttonHasDynamicUrl - QUICK_REPLY button (non-URL) -> false', () => {
  const components: TplComponent[] = [{
    type: 'BUTTONS',
    buttons: [{ type: 'QUICK_REPLY', text: 'Sim' }],
  }];
  assertEquals(buttonHasDynamicUrl(components), false);
});

// ---------------------------------------------------------------------------
// resolveHeaderImage
// ---------------------------------------------------------------------------

Deno.test('resolveHeaderImage - modo sku com foto -> foto', () => {
  const result = resolveHeaderImage(
    { wa_header_mode: 'sku' },
    { imagemProduto: 'https://cdn/foto-produto.jpg' },
    'https://cdn/fallback.jpg',
  );
  assertEquals(result, 'https://cdn/foto-produto.jpg');
});

Deno.test('resolveHeaderImage - modo sku sem foto e com wa_header_image -> fixa', () => {
  const result = resolveHeaderImage(
    { wa_header_mode: 'sku', wa_header_image: 'https://cdn/fixa.jpg' },
    { imagemProduto: null },
    'https://cdn/fallback.jpg',
  );
  assertEquals(result, 'https://cdn/fixa.jpg');
});

Deno.test('resolveHeaderImage - modo sku sem foto e sem wa_header_image -> fallback', () => {
  const result = resolveHeaderImage(
    { wa_header_mode: 'sku' },
    { imagemProduto: null },
    'https://cdn/fallback.jpg',
  );
  assertEquals(result, 'https://cdn/fallback.jpg');
});

Deno.test('resolveHeaderImage - modo sku sem carrinho (cart null) -> fallback', () => {
  const result = resolveHeaderImage(
    { wa_header_mode: 'sku' },
    null,
    'https://cdn/fallback.jpg',
  );
  assertEquals(result, 'https://cdn/fallback.jpg');
});

Deno.test('resolveHeaderImage - modo fixa com wa_header_image -> fixa (ignora foto do carrinho)', () => {
  const result = resolveHeaderImage(
    { wa_header_mode: 'fixa', wa_header_image: 'https://cdn/fixa.jpg' },
    { imagemProduto: 'https://cdn/foto-produto.jpg' },
    'https://cdn/fallback.jpg',
  );
  assertEquals(result, 'https://cdn/fixa.jpg');
});

Deno.test('resolveHeaderImage - modo fixa sem wa_header_image -> fallback', () => {
  const result = resolveHeaderImage(
    { wa_header_mode: 'fixa' },
    { imagemProduto: 'https://cdn/foto-produto.jpg' },
    'https://cdn/fallback.jpg',
  );
  assertEquals(result, 'https://cdn/fallback.jpg');
});

Deno.test('resolveHeaderImage - sem modo (undefined) -> igual a sku, com foto', () => {
  const result = resolveHeaderImage(
    {},
    { imagemProduto: 'https://cdn/foto-produto.jpg' },
    'https://cdn/fallback.jpg',
  );
  assertEquals(result, 'https://cdn/foto-produto.jpg');
});

Deno.test('resolveHeaderImage - sem modo (undefined), sem foto, com wa_header_image -> fixa', () => {
  const result = resolveHeaderImage(
    { wa_header_image: 'https://cdn/fixa.jpg' },
    { imagemProduto: null },
    'https://cdn/fallback.jpg',
  );
  assertEquals(result, 'https://cdn/fixa.jpg');
});

Deno.test('resolveHeaderImage - wa_header_image inválido (não http) é ignorado -> fallback', () => {
  const result = resolveHeaderImage(
    { wa_header_mode: 'fixa', wa_header_image: 'not-a-url' },
    null,
    'https://cdn/fallback.jpg',
  );
  assertEquals(result, 'https://cdn/fallback.jpg');
});

// ---------------------------------------------------------------------------
// buildEsteiraWaComponents
// ---------------------------------------------------------------------------

Deno.test('buildEsteiraWaComponents - (a) header TEXT com {{nome}}', () => {
  const result = buildEsteiraWaComponents({
    templateComponents: [{ type: 'HEADER', format: 'TEXT', text: 'Oi {{nome}}' }],
    waParams: [],
    waVars: {},
    ruleVars: {},
    buttonToken: null,
    headerImageUrl: null,
  });
  assertEquals(result, [
    { type: 'header', parameters: [{ type: 'text', text: '', parameter_name: 'nome' }] },
  ]);
});

Deno.test('buildEsteiraWaComponents - (b) header IMAGE sempre primeiro, mesmo sem waParams', () => {
  const result = buildEsteiraWaComponents({
    templateComponents: [{ type: 'HEADER', format: 'IMAGE' }],
    waParams: [],
    waVars: {},
    ruleVars: {},
    buttonToken: null,
    headerImageUrl: 'https://cdn/foto.jpg',
  });
  assertEquals(result, [
    { type: 'header', parameters: [{ type: 'image', image: { link: 'https://cdn/foto.jpg' } }] },
  ]);
});

Deno.test('buildEsteiraWaComponents - (c) waParams com 2 itens, ordem preservada', () => {
  const result = buildEsteiraWaComponents({
    templateComponents: [{ type: 'BODY', text: 'Oi {{nome}}, seu {{produto}}' }],
    waParams: ['nome', 'produto'],
    waVars: { nome: 'Gabriella' },
    ruleVars: { produto: 'Curso X' },
    buttonToken: null,
    headerImageUrl: null,
  });
  assertEquals(result, [
    { type: 'body', parameters: [{ type: 'text', text: 'Gabriella' }, { type: 'text', text: 'Curso X' }] },
  ]);
});

Deno.test('buildEsteiraWaComponents - (d) buttonToken gera botao url index 0', () => {
  const result = buildEsteiraWaComponents({
    templateComponents: [],
    waParams: [],
    waVars: {},
    ruleVars: {},
    buttonToken: 'abc',
    headerImageUrl: null,
  });
  assertEquals(result, [
    { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 'abc' }] },
  ]);
});

Deno.test('buildEsteiraWaComponents - (e) sem header, sem params, sem token -> []', () => {
  const result = buildEsteiraWaComponents({
    templateComponents: [{ type: 'BODY', text: 'sem placeholders' }],
    waParams: [],
    waVars: {},
    ruleVars: {},
    buttonToken: null,
    headerImageUrl: null,
  });
  assertEquals(result, []);
});

Deno.test('buildEsteiraWaComponents - header IMAGE + body + button juntos, na ordem correta', () => {
  const result = buildEsteiraWaComponents({
    templateComponents: [
      { type: 'HEADER', format: 'IMAGE' },
      { type: 'BODY', text: 'Oi {{nome}}' },
    ],
    waParams: ['nome'],
    waVars: { nome: 'Gabriella' },
    ruleVars: {},
    buttonToken: 'tok123',
    headerImageUrl: 'https://cdn/foto.jpg',
  });
  assertEquals(result, [
    { type: 'header', parameters: [{ type: 'image', image: { link: 'https://cdn/foto.jpg' } }] },
    { type: 'body', parameters: [{ type: 'text', text: 'Gabriella' }] },
    { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 'tok123' }] },
  ]);
});

Deno.test('buildEsteiraWaComponents - header IMAGE sem headerImageUrl -> nao emite header', () => {
  const result = buildEsteiraWaComponents({
    templateComponents: [{ type: 'HEADER', format: 'IMAGE' }],
    waParams: [],
    waVars: {},
    ruleVars: {},
    buttonToken: null,
    headerImageUrl: null,
  });
  assertEquals(result, []);
});

Deno.test('buildEsteiraWaComponents - header TEXT sem placeholder nomeado -> nao emite header', () => {
  const result = buildEsteiraWaComponents({
    templateComponents: [{ type: 'HEADER', format: 'TEXT', text: 'Oi fixo' }],
    waParams: [],
    waVars: {},
    ruleVars: {},
    buttonToken: null,
    headerImageUrl: null,
  });
  assertEquals(result, []);
});

Deno.test('buildEsteiraWaComponents - waVars ausente cai no ruleVars convertido pra string', () => {
  const result = buildEsteiraWaComponents({
    templateComponents: [{ type: 'BODY', text: 'Valor {{1}}' }],
    waParams: ['1'],
    waVars: {},
    ruleVars: { '1': 42 },
    buttonToken: null,
    headerImageUrl: null,
  });
  assertEquals(result, [
    { type: 'body', parameters: [{ type: 'text', text: '42' }] },
  ]);
});
