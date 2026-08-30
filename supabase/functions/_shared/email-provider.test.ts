import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.190.0/testing/asserts.ts';
import {
  renderTemplate,
  hasDirectEmailProvider,
  sendEmailWithConfig,
  escapeHtml,
} from './email-provider.ts';

// ── renderTemplate ──────────────────────────────────────────────────────────

Deno.test('renderTemplate substitui tokens simples', () => {
  assertEquals(renderTemplate('Olá {{nome}}', { nome: 'Ana' }), 'Olá Ana');
});

Deno.test('renderTemplate substitui tokens com ponto (VariablePicker)', () => {
  assertEquals(
    renderTemplate('Oi {{pessoa.nome}}, negócio {{lead.titulo}}', {
      'pessoa.nome': 'João',
      'lead.titulo': 'Plano Pro',
    }),
    'Oi João, negócio Plano Pro',
  );
});

Deno.test('renderTemplate token ausente vira string vazia', () => {
  assertEquals(renderTemplate('valor: {{lead.valor}}', {}), 'valor: ');
});

Deno.test('renderTemplate escapa o valor no modo html (default), não o template', () => {
  const out = renderTemplate('<p>{{pessoa.nome}}</p>', { 'pessoa.nome': '<b>x</b> & "y"' });
  // O <p> do template permanece; o valor do lead é escapado.
  assertStringIncludes(out, '<p>');
  assertStringIncludes(out, '&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;');
});

Deno.test('renderTemplate NÃO escapa quando escape:false (subject)', () => {
  assertEquals(
    renderTemplate('Bem-vindo {{pessoa.nome}}', { 'pessoa.nome': 'A & B' }, { escape: false }),
    'Bem-vindo A & B',
  );
});

Deno.test('renderTemplate tolera espaços dentro das chaves', () => {
  assertEquals(renderTemplate('{{ nome }}', { nome: 'Z' }), 'Z');
});

// ── escapeHtml ──────────────────────────────────────────────────────────────

Deno.test('escapeHtml cobre os 5 caracteres', () => {
  assertEquals(escapeHtml(`<>&"'`), '&lt;&gt;&amp;&quot;&#039;');
});

// ── hasDirectEmailProvider ──────────────────────────────────────────────────

Deno.test('hasDirectEmailProvider: providers diretos', () => {
  assertEquals(hasDirectEmailProvider({ provider: 'resend' }), true);
  assertEquals(hasDirectEmailProvider({ provider: 'smtp' }), true);
  assertEquals(hasDirectEmailProvider({ provider: 'sendgrid' }), true);
});

Deno.test('hasDirectEmailProvider: webhook/ausente/desconhecido → false', () => {
  assertEquals(hasDirectEmailProvider({ provider: 'webhook' }), false);
  assertEquals(hasDirectEmailProvider({}), false);
  assertEquals(hasDirectEmailProvider(null), false);
  assertEquals(hasDirectEmailProvider({ provider: 'mailchimp' }), false);
});

// ── sendEmailWithConfig — caminhos de erro (sem rede) ───────────────────────

Deno.test('sendEmailWithConfig: sem provider direto → erro claro', async () => {
  const r = await sendEmailWithConfig(
    { credentials: { provider: 'webhook' } },
    { to: 'a@b.com', subject: 's', html: '<p>x</p>' },
  );
  assertEquals(r.success, false);
  assertStringIncludes(r.error ?? '', 'sem provider');
});

Deno.test('sendEmailWithConfig: destinatário vazio → erro', async () => {
  const r = await sendEmailWithConfig(
    { credentials: { provider: 'resend', api_key: 'k', from_email: 'f@x.com' } },
    { to: '', subject: 's', html: '<p>x</p>' },
  );
  assertEquals(r.success, false);
  assertStringIncludes(r.error ?? '', 'to');
});

Deno.test('sendEmailWithConfig: resend sem api_key → erro de credencial', async () => {
  const r = await sendEmailWithConfig(
    { credentials: { provider: 'resend', from_email: 'f@x.com' } },
    { to: 'a@b.com', subject: 's', html: '<p>x</p>' },
  );
  assertEquals(r.success, false);
  assertStringIncludes(r.error ?? '', 'api_key');
});

Deno.test('sendEmailWithConfig: sendgrid sem from_email → erro de credencial', async () => {
  const r = await sendEmailWithConfig(
    { credentials: { provider: 'sendgrid', api_key: 'k' } },
    { to: 'a@b.com', subject: 's', html: '<p>x</p>' },
  );
  assertEquals(r.success, false);
  assertStringIncludes(r.error ?? '', 'from_email');
});

Deno.test('sendEmailWithConfig: smtp sem host → erro de credencial', async () => {
  const r = await sendEmailWithConfig(
    { credentials: { provider: 'smtp', user: 'u', pass: 'p', from_email: 'f@x.com' } },
    { to: 'a@b.com', subject: 's', html: '<p>x</p>' },
  );
  assertEquals(r.success, false);
  assertStringIncludes(r.error ?? '', 'host');
});
