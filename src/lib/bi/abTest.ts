/** BI do teste A/B da esteira: agregação por variante + significância estatística. Puro. */

export interface AbVariantRow { id: string; key: string; name: string; is_control: boolean; weight: number }
export interface AbInput {
  variants: AbVariantRow[];
  assignments: Array<{ variant_id: string; lead_id: string }>;
  touches: Array<{ ab_variant_id: string | null; person_id: string | null }>; // followup_queue status=sent
  links: Array<{ ab_variant_id: string | null; clicks: number }>;
  reconversions: Array<{ ab_variant_id: string | null; order_total: number | null; attributed: boolean }>;
}
export interface AbVariantStats {
  id: string; key: string; name: string; isControl: boolean;
  leads: number; tocados: number; enviados: number; clicados: number; ctr: number | null;
  reconvertidos: number; taxa: number | null; receita: number; ticket: number | null;
}
export interface AbConfidence { nivel: 'insuficiente' | 'baixa' | 'media' | 'alta'; z: number | null; p: number | null; lift: number | null; melhor: string | null }

const DEFAULT_MIN_LEADS = 30;

/** Two-proportion Z test (pooled variance). Null se alguma amostra vazia ou proporção pooled em 0/1. */
export function twoProportionZ(s1: number, n1: number, s2: number, n2: number): { z: number; p: number } | null {
  if (n1 < 1 || n2 < 1) return null;
  const pooled = (s1 + s2) / (n1 + n2);
  if (pooled <= 0 || pooled >= 1) return null;
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (se === 0) return null;
  const p1 = s1 / n1;
  const p2 = s2 / n2;
  const z = (p1 - p2) / se;
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  return { z, p };
}

/** erf via aproximação Abramowitz–Stegun 7.1.26 (erro máx. ~1.5e-7). */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const q = 0.3275911;
  const t = 1 / (1 + q * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

/** CDF da normal padrão em z, via erf. */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function aggregateAbTest(i: AbInput, minLeads: number = DEFAULT_MIN_LEADS): { variants: AbVariantStats[]; confidence: AbConfidence } {
  const variants: AbVariantStats[] = i.variants.map((v) => {
    const leads = new Set(i.assignments.filter((a) => a.variant_id === v.id).map((a) => a.lead_id)).size;
    const tocados = new Set(
      i.touches.filter((t) => t.ab_variant_id === v.id && t.person_id).map((t) => t.person_id),
    ).size;
    const variantLinks = i.links.filter((l) => l.ab_variant_id === v.id);
    const enviados = variantLinks.length;
    const clicados = variantLinks.filter((l) => l.clicks > 0).length;
    const ctr = enviados ? clicados / enviados : null;
    const attributed = i.reconversions.filter((r) => r.ab_variant_id === v.id && r.attributed);
    const reconvertidos = attributed.length;
    const receita = attributed.reduce((a, r) => a + (r.order_total ?? 0), 0);
    const taxa = leads ? reconvertidos / leads : null;
    const ticket = reconvertidos ? receita / reconvertidos : null;
    return { id: v.id, key: v.key, name: v.name, isControl: v.is_control, leads, tocados, enviados, clicados, ctr, reconvertidos, taxa, receita, ticket };
  });

  const controle = variants.find((v) => v.isControl) ?? variants[0] ?? null;
  const desafiantes = variants.filter((v) => v !== controle && v.taxa !== null);
  const desafiante = desafiantes.length
    ? desafiantes.reduce((best, v) => ((v.taxa as number) > (best.taxa as number) ? v : best))
    : null;

  let melhor: AbVariantStats | null = controle;
  if (desafiante && controle && desafiante.taxa !== null && (controle.taxa === null || desafiante.taxa > controle.taxa)) {
    melhor = desafiante;
  }

  const lift = melhor && controle && melhor !== controle && controle.taxa
    ? ((melhor.taxa as number) - controle.taxa) / controle.taxa
    : melhor && controle && melhor === controle
    ? 0
    : null;

  const insuficiente = variants.some((v) => v.leads < minLeads);

  let z: number | null = null;
  let p: number | null = null;
  if (!insuficiente && controle && desafiante) {
    const teste = twoProportionZ(controle.reconvertidos, controle.leads, desafiante.reconvertidos, desafiante.leads);
    if (teste) { z = teste.z; p = teste.p; }
  }

  let nivel: AbConfidence['nivel'];
  if (insuficiente) nivel = 'insuficiente';
  else if (p === null) nivel = 'baixa';
  else if (p < 0.05) nivel = 'alta';
  else if (p < 0.2) nivel = 'media';
  else nivel = 'baixa';

  return {
    variants,
    confidence: { nivel, z, p, lift, melhor: melhor ? melhor.key : null },
  };
}
