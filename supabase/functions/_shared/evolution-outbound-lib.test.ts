/**
 * Tests for evolution-outbound-lib (channel dispatch decision + Evolution
 * template `{{n}}` substitution, pure logic used by whatsapp-outbound).
 *
 * Run: deno test supabase/functions/_shared/evolution-outbound-lib.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildInteractiveFallbackText,
  resolveChannelDispatch,
  resolveTemplateBodyText,
  resolveTemplateParams,
  substituteTemplateVars,
  type ChannelRow,
} from './evolution-outbound-lib.ts';

function metaChannel(overrides: Partial<ChannelRow> = {}): ChannelRow {
  return {
    id: 'chan_meta_1',
    phone_number_id: '1234567890',
    access_token: 'meta_tok',
    provider: 'meta',
    evolution_base_url: null,
    evolution_api_key: null,
    evolution_instance_name: null,
    ...overrides,
  };
}

function evolutionChannel(overrides: Partial<ChannelRow> = {}): ChannelRow {
  return {
    id: 'chan_evo_1',
    phone_number_id: null,
    access_token: null,
    provider: 'evolution',
    evolution_base_url: 'https://evo.growthsales.ai',
    evolution_api_key: 'evo_key',
    evolution_instance_name: 'growthsales-crm',
    ...overrides,
  };
}

// ── resolveChannelDispatch ────────────────────────────────────────────────────

Deno.test('resolveChannelDispatch: meta channel with its own access_token', () => {
  const dispatch = resolveChannelDispatch(metaChannel(), 'env_fallback_tok');
  assertEquals(dispatch, { provider: 'meta', accessToken: 'meta_tok', phoneNumberId: '1234567890' });
});

Deno.test('resolveChannelDispatch: meta channel with no access_token falls back to the env token', () => {
  const dispatch = resolveChannelDispatch(metaChannel({ access_token: null }), 'env_fallback_tok');
  assertEquals(dispatch, { provider: 'meta', accessToken: 'env_fallback_tok', phoneNumberId: '1234567890' });
});

Deno.test('resolveChannelDispatch: meta channel with no phone_number_id resolves to an empty string (caller guards on it)', () => {
  const dispatch = resolveChannelDispatch(metaChannel({ phone_number_id: null }), 'env_tok');
  assertEquals(dispatch.phoneNumberId, '');
});

Deno.test('resolveChannelDispatch: evolution channel with complete creds', () => {
  const dispatch = resolveChannelDispatch(evolutionChannel(), 'env_fallback_tok');
  assertEquals(dispatch, {
    provider: 'evolution',
    evolutionCreds: { baseUrl: 'https://evo.growthsales.ai', apiKey: 'evo_key', instanceName: 'growthsales-crm' },
    phoneNumberId: 'chan_evo_1',
  });
});

Deno.test('resolveChannelDispatch: evolution channel uses the channel row id as phoneNumberId, never a real phone_number_id', () => {
  const dispatch = resolveChannelDispatch(evolutionChannel({ id: 'row-uuid-xyz' }), 'env_tok');
  assertEquals(dispatch.phoneNumberId, 'row-uuid-xyz');
});

Deno.test('resolveChannelDispatch: evolution channel missing evolution_base_url -> evolutionCreds is null (incomplete row)', () => {
  const dispatch = resolveChannelDispatch(evolutionChannel({ evolution_base_url: null }), 'env_tok');
  assertEquals(dispatch.provider, 'evolution');
  if (dispatch.provider === 'evolution') assertEquals(dispatch.evolutionCreds, null);
});

Deno.test('resolveChannelDispatch: evolution channel missing evolution_api_key -> evolutionCreds is null', () => {
  const dispatch = resolveChannelDispatch(evolutionChannel({ evolution_api_key: null }), 'env_tok');
  if (dispatch.provider === 'evolution') assertEquals(dispatch.evolutionCreds, null);
});

Deno.test('resolveChannelDispatch: evolution channel missing evolution_instance_name -> evolutionCreds is null', () => {
  const dispatch = resolveChannelDispatch(evolutionChannel({ evolution_instance_name: null }), 'env_tok');
  if (dispatch.provider === 'evolution') assertEquals(dispatch.evolutionCreds, null);
});

Deno.test('resolveChannelDispatch: unrecognized/null provider value falls through to the meta branch', () => {
  const dispatch = resolveChannelDispatch(metaChannel({ provider: null }), 'env_tok');
  assertEquals(dispatch.provider, 'meta');
});

// ── buildInteractiveFallbackText ──────────────────────────────────────────────

Deno.test('buildInteractiveFallbackText: no buttons returns the body unchanged', () => {
  assertEquals(buildInteractiveFallbackText('Escolha uma opção', []), 'Escolha uma opção');
});

Deno.test('buildInteractiveFallbackText: numbers the buttons below the body, 1-indexed', () => {
  const result = buildInteractiveFallbackText('Escolha uma opção', ['Sim', 'Não', 'Talvez']);
  assertEquals(result, 'Escolha uma opção\n\n1. Sim\n2. Não\n3. Talvez');
});

// ── resolveTemplateBodyText ───────────────────────────────────────────────────

Deno.test('resolveTemplateBodyText: finds the BODY component among header/body/footer/buttons', () => {
  const text = resolveTemplateBodyText([
    { type: 'HEADER', text: 'Bem-vindo' },
    { type: 'BODY', text: 'Olá {{1}}, seu pedido {{2}} foi confirmado.' },
    { type: 'FOOTER', text: 'Growth Sales' },
  ]);
  assertEquals(text, 'Olá {{1}}, seu pedido {{2}} foi confirmado.');
});

Deno.test('resolveTemplateBodyText: no BODY component -> empty string', () => {
  assertEquals(resolveTemplateBodyText([{ type: 'HEADER', text: 'x' }]), '');
});

Deno.test('resolveTemplateBodyText: empty components array -> empty string', () => {
  assertEquals(resolveTemplateBodyText([]), '');
});

// ── resolveTemplateParams ─────────────────────────────────────────────────────

Deno.test('resolveTemplateParams: positional format (no parameter_name) -> name is the 1-based index', () => {
  const params = resolveTemplateParams(
    [{ type: 'body', parameters: [{ text: 'João' }, { text: '#123' }] }],
    ['legacy_should_not_be_used'],
  );
  assertEquals(params, [{ name: '1', text: 'João' }, { name: '2', text: '#123' }]);
});

Deno.test('resolveTemplateParams: named format (Sends PRO / buildTemplateComponents) -> name is parameter_name', () => {
  const params = resolveTemplateParams(
    [{ type: 'body', parameters: [
      { type: 'text', text: 'João', parameter_name: 'nome' },
      { type: 'text', text: 'Maria', parameter_name: 'recomendante' },
    ] }],
    undefined,
  );
  assertEquals(params, [{ name: 'nome', text: 'João' }, { name: 'recomendante', text: 'Maria' }]);
});

Deno.test('resolveTemplateParams: component type match is case-insensitive ("BODY" vs "body")', () => {
  const params = resolveTemplateParams([{ type: 'BODY', parameters: [{ text: 'x' }] }], undefined);
  assertEquals(params, [{ name: '1', text: 'x' }]);
});

Deno.test('resolveTemplateParams: falls back to legacy variable_values (positional) when no components[] body params exist', () => {
  const params = resolveTemplateParams(undefined, ['a', 'b']);
  assertEquals(params, [{ name: '1', text: 'a' }, { name: '2', text: 'b' }]);
});

Deno.test('resolveTemplateParams: components present but no BODY entry -> falls back to legacy', () => {
  const params = resolveTemplateParams([{ type: 'header', parameters: [{ text: 'nope' }] }], ['a']);
  assertEquals(params, [{ name: '1', text: 'a' }]);
});

Deno.test('resolveTemplateParams: neither source present -> empty array', () => {
  assertEquals(resolveTemplateParams(undefined, undefined), []);
});

Deno.test('resolveTemplateParams: a parameter with no text field maps to empty string, not undefined', () => {
  const params = resolveTemplateParams([{ type: 'body', parameters: [{}, { text: 'ok' }] }], undefined);
  assertEquals(params, [{ name: '1', text: '' }, { name: '2', text: 'ok' }]);
});

// ── substituteTemplateVars ────────────────────────────────────────────────────

Deno.test('substituteTemplateVars: replaces {{1}}, {{2}}, ... positionally', () => {
  const result = substituteTemplateVars(
    'Olá {{1}}, seu pedido {{2}} foi confirmado.',
    [{ name: '1', text: 'João' }, { name: '2', text: '#123' }],
  );
  assertEquals(result, 'Olá João, seu pedido #123 foi confirmado.');
});

Deno.test('substituteTemplateVars: named params (real Sends PRO shape) replace {{varName}} placeholders', () => {
  const result = substituteTemplateVars(
    'Olá {{nome}}, recomendado por {{recomendante}}.',
    [{ name: 'nome', text: 'João' }, { name: 'recomendante', text: 'Maria' }],
  );
  assertEquals(result, 'Olá João, recomendado por Maria.');
});

Deno.test('substituteTemplateVars: missing param for a placeholder leaves it untouched', () => {
  const result = substituteTemplateVars('Olá {{1}}, código {{2}}.', [{ name: '1', text: 'João' }]);
  assertEquals(result, 'Olá João, código {{2}}.');
});

Deno.test('substituteTemplateVars: repeated placeholder is replaced at every occurrence (replaceAll)', () => {
  const result = substituteTemplateVars('{{1}} e {{1}} de novo', [{ name: '1', text: 'X' }]);
  assertEquals(result, 'X e X de novo');
});

Deno.test('substituteTemplateVars: no params -> text passes through unchanged', () => {
  assertEquals(substituteTemplateVars('sem variáveis aqui', []), 'sem variáveis aqui');
});

Deno.test('substituteTemplateVars: text with no placeholders is unaffected by extra params', () => {
  assertEquals(substituteTemplateVars('texto fixo', [{ name: '1', text: 'a' }, { name: '2', text: 'b' }]), 'texto fixo');
});

Deno.test('substituteTemplateVars: end-to-end with resolveTemplateParams, named Sends PRO shape', () => {
  const components = [{ type: 'body', parameters: [
    { type: 'text', text: 'João', parameter_name: 'nome' },
    { type: 'text', text: 'Pedro', parameter_name: 'recomendante' },
  ] }];
  const params = resolveTemplateParams(components, undefined);
  const result = substituteTemplateVars('Oi {{nome}}! {{recomendante}} te recomendou.', params);
  assertEquals(result, 'Oi João! Pedro te recomendou.');
});
