/**
 * `vars` da regra de follow-up WhatsApp — parse/serialize para o formulário,
 * e leitura pura dos `components` de um template Meta (espelho front-end dos
 * helpers de supabase/functions/_shared/wa-template-render.ts).
 */

export const WA_VAR_OPTIONS = ['nome', 'remetente', 'produto', 'modelo_celular', 'preco', 'cupom', 'expira_em'] as const;

export interface RuleVars {
  waParams: string[];
  waButtonUrl: boolean;
  waHeaderMode: 'sku' | 'fixa' | null;
  waHeaderImage: string | null;
  cupom: string;
  cupomPct: string;
  expiraHoras: string;
}

export function parseRuleVars(vars: Record<string, unknown> | null | undefined): RuleVars {
  const v = vars ?? {};
  const waParams = Array.isArray(v.wa_params) ? (v.wa_params as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  const waHeaderMode = v.wa_header_mode === 'sku' || v.wa_header_mode === 'fixa' ? v.wa_header_mode : null;
  return {
    waParams,
    waButtonUrl: v.wa_button_url === true,
    waHeaderMode,
    waHeaderImage: typeof v.wa_header_image === 'string' && v.wa_header_image.length > 0 ? v.wa_header_image : null,
    cupom: typeof v.cupom === 'string' ? v.cupom : '',
    cupomPct: v.cupom_pct !== undefined && v.cupom_pct !== null ? String(v.cupom_pct) : '',
    expiraHoras: v.expira_horas !== undefined && v.expira_horas !== null ? String(v.expira_horas) : '',
  };
}

/** Merge: preserva chaves desconhecidas de `prev`, remove chaves cujo valor ficou vazio. */
export function serializeRuleVars(rv: RuleVars, prev?: Record<string, unknown> | null): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(prev ?? {}) };
  const set = (key: string, value: unknown, isEmpty: boolean) => {
    if (isEmpty) delete out[key];
    else out[key] = value;
  };
  set('wa_params', rv.waParams, rv.waParams.length === 0);
  set('wa_button_url', true, !rv.waButtonUrl);
  set('wa_header_mode', rv.waHeaderMode, rv.waHeaderMode === null);
  set('wa_header_image', rv.waHeaderImage, !rv.waHeaderImage);
  set('cupom', rv.cupom, rv.cupom === '');
  set('cupom_pct', rv.cupomPct, rv.cupomPct === '');
  set('expira_horas', rv.expiraHoras, rv.expiraHoras === '');
  return out;
}

function asComponents(components: unknown): Array<Record<string, unknown>> {
  return Array.isArray(components) ? (components as Array<Record<string, unknown>>) : [];
}

/** Números de placeholder {{N}} do BODY, em ordem de aparição (sem duplicatas). */
export function bodyPlaceholders(components: unknown): number[] {
  const body = asComponents(components).find((c) => String(c.type).toUpperCase() === 'BODY');
  const text = typeof body?.text === 'string' ? body.text : '';
  const seen = new Set<number>();
  const nums: number[] = [];
  for (const m of text.matchAll(/\{\{(\d+)\}\}/g)) {
    const n = Number(m[1]);
    if (!seen.has(n)) {
      seen.add(n);
      nums.push(n);
    }
  }
  return nums;
}

export function templateHeaderKind(components: unknown): 'none' | 'text' | 'image' | 'video' | 'document' {
  const header = asComponents(components).find((c) => String(c.type).toUpperCase() === 'HEADER');
  const format = String(header?.format ?? '').toUpperCase();
  if (format === 'TEXT') return 'text';
  if (format === 'IMAGE') return 'image';
  if (format === 'VIDEO') return 'video';
  if (format === 'DOCUMENT') return 'document';
  return 'none';
}

export function buttonHasDynamicUrl(components: unknown): boolean {
  const buttons = asComponents(components).find((c) => String(c.type).toUpperCase() === 'BUTTONS');
  const list = Array.isArray(buttons?.buttons) ? (buttons.buttons as Array<Record<string, unknown>>) : [];
  return list.some((btn) => String(btn.type).toUpperCase() === 'URL' && typeof btn.url === 'string' && /\{\{\w+\}\}/.test(btn.url));
}
