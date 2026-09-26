// src/lib/flows/catalog.ts
import { Zap, Clock, GitBranch, Split, MessageCircle, Mail, ArrowRightLeft, Tag, CircleStop, type LucideIcon } from 'lucide-react';

export type NodeType = 'trigger' | 'wait' | 'condition' | 'split' | 'send_whatsapp' | 'send_email' | 'move_stage' | 'add_tag' | 'exit';
export interface FlowNodeData { [k: string]: unknown }
export interface SummaryCtx { waName?: (id: string) => string; emailName?: (id: string) => string; stageName?: (id: string) => string }
type Variant = { key: string; pct: number };

const unitLabel = (n: number, u: string) => (u === 'days' ? `${n} ${n === 1 ? 'dia' : 'dias'}` : u === 'hours' ? `${n} h` : `${n} min`);
const CHECKS: Record<string, string> = {
  clicked_since_start: 'Clicou em algum link?', clicked_channel: 'Clicou no canal?', purchased: 'Comprou?',
  has_whatsapp: 'Tem WhatsApp?', has_email: 'Tem e-mail (inscrito)?', has_tag: 'Tem a tag?',
};

export const NODE_CATALOG: Record<NodeType, {
  label: string; icon: LucideIcon; tone: string; defaults: FlowNodeData;
  handles: (d: FlowNodeData) => { id: string; label: string }[];
  summary: (d: FlowNodeData, ctx: SummaryCtx) => string;
}> = {
  trigger: { label: 'Gatilho', icon: Zap, tone: '#111111', defaults: {}, handles: () => [{ id: 'out', label: '' }], summary: () => 'Início do fluxo' },
  wait: { label: 'Esperar', icon: Clock, tone: '#64748b', defaults: { amount: 1, unit: 'hours' }, handles: () => [{ id: 'out', label: '' }],
    summary: (d) => (d.until === 'business_hours' ? 'Esperar horário comercial' : `Esperar ${unitLabel(Number(d.amount ?? 0), String(d.unit ?? 'minutes'))}`) },
  condition: { label: 'Condição', icon: GitBranch, tone: '#7c3aed', defaults: { check: 'clicked_since_start' },
    handles: () => [{ id: 'yes', label: 'Sim' }, { id: 'no', label: 'Não' }], summary: (d) => CHECKS[String(d.check)] ?? 'Condição' },
  split: { label: 'Teste A/B', icon: Split, tone: '#0891b2', defaults: { variants: [{ key: 'a', pct: 50 }, { key: 'b', pct: 50 }] },
    handles: (d) => ((d.variants as Variant[]) ?? []).map((v) => ({ id: v.key, label: `${v.key.toUpperCase()} · ${v.pct}%` })),
    summary: (d) => ((d.variants as Variant[]) ?? []).map((v) => `${v.key.toUpperCase()} ${v.pct}%`).join(' / ') },
  send_whatsapp: { label: 'WhatsApp', icon: MessageCircle, tone: '#16a34a', defaults: { template_id: '', use_personal_coupon: false, vars: {} },
    handles: () => [{ id: 'out', label: '' }], summary: (d, c) => c.waName?.(String(d.template_id)) || 'Escolha o template' },
  send_email: { label: 'E-mail', icon: Mail, tone: '#2563eb', defaults: { email_template_id: '', use_personal_coupon: false, vars: {} },
    handles: () => [{ id: 'out', label: '' }], summary: (d, c) => c.emailName?.(String(d.email_template_id)) || 'Escolha o template' },
  move_stage: { label: 'Mover etapa', icon: ArrowRightLeft, tone: '#ea580c', defaults: { stage_id: '' }, handles: () => [{ id: 'out', label: '' }],
    summary: (d, c) => c.stageName?.(String(d.stage_id)) || 'Escolha a etapa' },
  add_tag: { label: 'Tag', icon: Tag, tone: '#db2777', defaults: { tag: '' }, handles: () => [{ id: 'out', label: '' }], summary: (d) => (d.tag ? `+ ${d.tag}` : 'Informe a tag') },
  exit: { label: 'Sair', icon: CircleStop, tone: '#475569', defaults: {}, handles: () => [], summary: () => 'Fim' },
};

/** Quantos {{n}} distintos o corpo do template tem. */
export function templateParamCount(body: string): number {
  return new Set([...(body ?? '').matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])).size;
}
/** Variáveis que o worker sabe preencher (mesmos nomes das regras da esteira). */
export const WA_VAR_OPTIONS: { value: string; label: string }[] = [
  { value: 'nome', label: 'Primeiro nome' }, { value: 'produto', label: 'Produto do carrinho' }, { value: 'cupom', label: 'Cupom' },
  { value: 'expira_em', label: 'Validade do cupom' }, { value: 'modelo_celular', label: 'Modelo do celular' },
  { value: 'preco', label: 'Preço' }, { value: 'preco_com_cupom', label: 'Preço com cupom' }, { value: 'link_checkout', label: 'Link do carrinho' },
];
const DEFAULT_ORDER = ['nome', 'produto', 'cupom', 'expira_em'];
export function defaultWaParams(n: number): string[] {
  return Array.from({ length: n }, (_, i) => DEFAULT_ORDER[i] ?? 'nome');
}

let seq = 0;
export function newNode(type: NodeType, position: { x: number; y: number }) {
  seq += 1;
  return { id: `${type}-${Date.now().toString(36)}-${seq}`, type, position, data: structuredClone(NODE_CATALOG[type].defaults) };
}
export const TRIGGER_LABEL: Record<string, string> = {
  cart_abandoned: 'Carrinho abandonado', payment_pending: 'Pix/boleto pendente', payment_refused: 'Pagamento recusado',
  purchased: 'Comprou', stage_entered: 'Entrou na etapa', link_clicked: 'Clicou num link', manual: 'Manual (teste)',
};
export const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Rascunho', cls: 'bg-muted text-muted-foreground' }, simulation: { label: 'Simulação', cls: 'bg-amber-500/15 text-amber-600' },
  live: { label: 'Ativo', cls: 'bg-emerald-500/15 text-emerald-600' }, paused: { label: 'Pausado', cls: 'bg-slate-500/15 text-slate-500' },
  archived: { label: 'Arquivado', cls: 'bg-muted text-muted-foreground' },
};
