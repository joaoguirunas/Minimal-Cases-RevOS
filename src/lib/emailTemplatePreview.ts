/**
 * Pure helpers for the email-template live preview (EMAIL-1.4).
 *
 * Token grammar is aligned with the render token used by the send path
 * (`_shared/email-provider.ts`, EMAIL-1.3): {{ dotted.word }} with optional
 * surrounding whitespace.
 */

export const VARIABLE_TOKEN_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Sample values used to fill variables in the preview. Keyed by full token path. */
const SAMPLE_VALUES: Record<string, string> = {
  'nome': 'João',
  'pessoa.nome': 'João Silva',
  'pessoa.email': 'joao@email.com',
  'pessoa.telefone': '(11) 99999-0000',
  'pessoa.whatsapp': '(11) 99999-0000',
  'empresa.nome_fantasia': 'Acme Ltda',
  'empresa.razao_social': 'Acme Comércio Ltda',
  'lead.titulo': 'Negócio de exemplo',
  'lead.valor': 'R$ 1.200,00',
  'pipeline.nome': 'Vendas',
  'etapa.nome': 'Compra Aprovada',
  'agendamento.inicio': '10/07/2026 14:00',
  'agendamento.link_reuniao': 'https://meet.google.com/abc-defg-hij',
};

/** Returns the deduplicated list of variable names referenced in the given text. */
export const detectVariables = (...texts: string[]): string[] => {
  const found = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(VARIABLE_TOKEN_RE)) {
      found.add(match[1]);
    }
  }
  return [...found];
};

/** Escapes a lead-supplied value so it cannot break the surrounding markup. */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Human-readable fallback sample for a variable that has no configured default. */
export const sampleValueFor = (name: string): string => {
  if (SAMPLE_VALUES[name] !== undefined) return SAMPLE_VALUES[name];
  const leaf = name.split('.').pop() ?? name;
  return `[${leaf}]`;
};

/**
 * Substitutes every {{var}} token with its (escaped) sample value.
 * Used both for the subject line and the HTML body preview.
 */
export const renderPreview = (
  template: string,
  overrides: Record<string, string> = {},
): string => {
  if (!template) return '';
  return template.replace(VARIABLE_TOKEN_RE, (_full, name: string) => {
    const raw = overrides[name] ?? sampleValueFor(name);
    return escapeHtml(raw);
  });
};

/** Wraps the rendered body in a minimal HTML document for the sandboxed iframe. */
export const buildPreviewDocument = (renderedBody: string): string =>
  `<!doctype html><html><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width, initial-scale=1">` +
  `<style>body{margin:0;padding:16px;background:#fff;color:#111;` +
  `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;` +
  `font-size:14px;line-height:1.5;} img{max-width:100%;}</style></head>` +
  `<body>${renderedBody}</body></html>`;
