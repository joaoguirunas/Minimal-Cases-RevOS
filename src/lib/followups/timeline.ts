import type { StageFollowup } from '@/hooks/useFollowups';
import type { WhatsappTemplate } from '@/hooks/useWhatsappTemplates';
import type { ClickRateRow } from '@/lib/bi/clicks';

export type TemplateStatus = 'aprovado' | 'em_analise' | 'rejeitado' | 'sem_template' | 'nao_aplica';
export type Canal = 'email' | 'whatsapp' | 'sms' | 'outro';

export interface TimelineRule {
  id: string;
  offsetMin: number;
  label: string;
  canal: Canal;
  ativo: boolean;
  templateStatus: TemplateStatus;
  templateName: string | null;
  tracked: boolean;
  headerImage: boolean;
  variantId: string | null;
  ctr: { enviados: number; clicados: number; ctr: number | null } | null;
  placement: 'above' | 'below';
}

export interface Lane {
  variantId: string | null;
  key: string; // 'comum' | 'A' | 'B' | ...
  name: string;
  rules: TimelineRule[];
}

export interface StageTimeline {
  stageId: string;
  lanes: Lane[];
  maxOffsetMin: number;
}

export interface VariantLite {
  id: string;
  key: string;
  name: string;
  position: number;
}

type Tpl = Pick<WhatsappTemplate, 'id_template' | 'nome' | 'meta_template_name' | 'status'>;

const canalOf = (tipo: string): Canal =>
  tipo === 'email' ? 'email' : tipo === 'sms' ? 'sms' : tipo.startsWith('whatsapp') ? 'whatsapp' : 'outro';

export function offsetOf(r: { dias: number; horas: number; minutos: number }): number {
  return r.dias * 1440 + r.horas * 60 + r.minutos;
}

export function minToParts(min: number): { dias: number; horas: number; minutos: number } {
  const total = Math.max(0, Math.trunc(min));
  const dias = Math.floor(total / 1440);
  const rest = total % 1440;
  const horas = Math.floor(rest / 60);
  const minutos = rest % 60;
  return { dias, horas, minutos };
}

/**
 * Arredonda um offset (em minutos) para a granularidade da escala visual.
 * Escalas curtas (≤360min) usam grade de 5min; médias (≤2880min) grade de 15min;
 * escalas longas usam grade de 60min arredondada para cima (evita que o toque
 * "recue" no tempo ao ser posicionado numa grade grossa). Nunca < 5, nunca negativo.
 */
export function snapOffset(min: number, scaleMax: number): number {
  const step = scaleMax <= 360 ? 5 : scaleMax <= 2880 ? 15 : 60;
  const clamped = Math.max(0, min);
  const snapped = step >= 60 ? Math.ceil(clamped / step) * step : Math.round(clamped / step) * step;
  return Math.max(5, snapped);
}

export function formatTempo(dias: number, horas: number, minutos: number): string {
  const parts: string[] = [];
  if (dias > 0) parts.push(`${dias}d`);
  if (horas > 0) parts.push(`${horas}h`);
  if (minutos > 0) parts.push(`${minutos}min`);
  return parts.length > 0 ? parts.join(' ') : 'Imediato';
}

/**
 * Decide, para uma lista de offsets JÁ ORDENADA, se o rótulo de cada marcador
 * fica acima ou abaixo do trilho. Quando dois marcadores consecutivos ficam a
 * menos de `minGapPct`% de distância na escala, alterna o lado do segundo em
 * relação ao primeiro; caso contrário, volta ao padrão ('above').
 */
export function labelPlacement(offsets: number[], scaleMax: number, minGapPct = 6): Array<'above' | 'below'> {
  const result: Array<'above' | 'below'> = [];
  let prevOffset: number | null = null;
  let prevPlacement: 'above' | 'below' = 'above';
  const scale = Math.max(scaleMax, 1);
  offsets.forEach((o, i) => {
    if (i === 0) {
      prevPlacement = 'above';
    } else {
      const gapPct = ((o - (prevOffset as number)) / scale) * 100;
      prevPlacement = gapPct < minGapPct ? (prevPlacement === 'above' ? 'below' : 'above') : 'above';
    }
    result.push(prevPlacement);
    prevOffset = o;
  });
  return result;
}

export function templateStatusOf(
  rule: Pick<StageFollowup, 'tipo' | 'whatsapp_template_id' | 'whatsapp_template_name'>,
  templates: Tpl[],
): TemplateStatus {
  if (rule.tipo !== 'whatsapp_template') return 'nao_aplica';
  const t = templates.find(
    (x) =>
      (rule.whatsapp_template_id && x.id_template === rule.whatsapp_template_id) ||
      (rule.whatsapp_template_name && (x.nome === rule.whatsapp_template_name || x.meta_template_name === rule.whatsapp_template_name)),
  );
  if (!t) return 'sem_template';
  const s = String(t.status ?? '').toLowerCase();
  if (s === 'approved') return 'aprovado';
  if (s === 'rejected') return 'rejeitado';
  return 'em_analise';
}

export function buildStageTimeline(
  followups: StageFollowup[],
  templates: WhatsappTemplate[],
  clickRates: ClickRateRow[],
  variants: VariantLite[],
): StageTimeline[] {
  const ctrByTemplate = new Map(clickRates.map((r) => [r.key.split('|')[1], r]));
  const laneDefs: Array<{ key: string; name: string; variantId: string | null }> = [
    { key: 'comum', name: 'Comum', variantId: null },
    ...[...variants].sort((a, b) => a.position - b.position).map((v) => ({ key: v.key, name: v.name, variantId: v.id })),
  ];

  const byStage = new Map<string, TimelineRule[]>();
  for (const f of followups) {
    if (!f.leads_stages_id) continue;
    const templateName =
      f.tipo === 'whatsapp_template'
        ? (templates.find((t) => t.id_template === f.whatsapp_template_id)?.nome ?? f.whatsapp_template_name ?? null)
        : (f.email_template_name ?? null);
    const label = f.email_template_name ?? f.whatsapp_template_name ?? templateName ?? f.assunto ?? 'Follow-up';
    const body = `${f.mensagem ?? ''} ${f.assunto ?? ''}`;
    const vars = f.vars ?? null;
    const tracked = vars?.wa_button_url === true || /\{\{link_(novo_)?checkout\}\}/.test(body);
    const rate = templateName ? ctrByTemplate.get(templateName) : undefined;

    const list = byStage.get(f.leads_stages_id) ?? [];
    list.push({
      id: f.id,
      offsetMin: offsetOf({ dias: f.dias, horas: f.horas, minutos: f.minutos }),
      label,
      canal: canalOf(f.tipo),
      ativo: f.ativo,
      templateStatus: templateStatusOf(f, templates),
      templateName,
      tracked,
      headerImage: Boolean(vars?.wa_header_mode),
      variantId: f.ab_variant_id ?? null,
      ctr: rate ? { enviados: rate.enviados, clicados: rate.clicados, ctr: rate.ctr } : null,
      placement: 'above',
    });
    byStage.set(f.leads_stages_id, list);
  }

  return [...byStage.entries()].map(([stageId, rules]) => {
    const maxOffsetMin = rules.reduce((max, r) => Math.max(max, r.offsetMin), 0);
    const lanes: Lane[] = laneDefs.map((ld) => {
      const laneRules = rules.filter((r) => r.variantId === ld.variantId).sort((a, b) => a.offsetMin - b.offsetMin);
      const placements = labelPlacement(
        laneRules.map((r) => r.offsetMin),
        maxOffsetMin,
      );
      laneRules.forEach((r, i) => {
        r.placement = placements[i];
      });
      return { variantId: ld.variantId, key: ld.key, name: ld.name, rules: laneRules };
    });
    return { stageId, lanes, maxOffsetMin };
  });
}
