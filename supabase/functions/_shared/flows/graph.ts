// supabase/functions/_shared/flows/graph.ts
/** Fluxos em nós: formato do grafo, navegação e validação para publicar. */
export type NodeType = 'trigger' | 'wait' | 'condition' | 'split' | 'send_whatsapp' | 'send_email' | 'move_stage' | 'add_tag' | 'exit';
export interface FlowNode { id: string; type: NodeType; position?: { x: number; y: number }; data: Record<string, unknown> }
export interface FlowEdge { id: string; source: string; sourceHandle?: string | null; target: string }
export interface FlowGraph { nodes: FlowNode[]; edges: FlowEdge[] }
type Err = { nodeId?: string; message: string };

const handleOf = (e: FlowEdge) => e.sourceHandle || 'out';

export function nextNode(g: FlowGraph, nodeId: string, handle = 'out'): FlowNode | null {
  const e = g.edges.find((x) => x.source === nodeId && handleOf(x) === handle);
  return e ? g.nodes.find((n) => n.id === e.target) ?? null : null;
}

export function waitMinutes(n: FlowNode): number {
  if (n.type !== 'wait' || n.data.until === 'business_hours') return 0;
  const amount = Number(n.data.amount ?? 0);
  const mult = n.data.unit === 'days' ? 1440 : n.data.unit === 'hours' ? 60 : 1;
  return Math.max(0, amount * mult);
}

export function stableVariant(seed: string, variants: { key: string; pct: number }[]): string {
  let h = 0x811c9dc5;
  for (const ch of seed) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 0x01000193) >>> 0; }
  const b = h % 100; let acc = 0;
  for (const v of variants) { acc += Number(v.pct); if (b < acc) return v.key; }
  return variants[variants.length - 1]?.key ?? '';
}

function requiredHandles(n: FlowNode): string[] {
  switch (n.type) {
    case 'exit': return [];
    case 'condition': return ['yes', 'no'];
    case 'split': return ((n.data.variants as { key: string }[]) ?? []).map((v) => v.key);
    default: return ['out'];
  }
}

export function validateGraph(g: FlowGraph, ctx: { approvedWaTemplates: Set<string>; activeEmailTemplates: Set<string> }): { ok: boolean; errors: Err[] } {
  const errors: Err[] = [];
  const triggers = g.nodes.filter((n) => n.type === 'trigger');
  if (triggers.length !== 1) errors.push({ message: `o fluxo precisa de exatamente 1 gatilho (tem ${triggers.length})` });
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  for (const e of g.edges) if (!byId.has(e.source) || !byId.has(e.target)) errors.push({ message: `ligação ${e.id} aponta para nó inexistente` });

  for (const n of g.nodes) {
    const have = new Set(g.edges.filter((e) => e.source === n.id).map(handleOf));
    for (const h of requiredHandles(n)) {
      if (!have.has(h)) errors.push({ nodeId: n.id, message: n.type === 'condition' ? `condição sem o caminho "${h === 'yes' ? 'sim' : 'não'}"` : n.type === 'split' ? `variante "${h}" sem ligação` : 'nó sem saída ligada' });
    }
    if (n.type === 'split') {
      const sum = ((n.data.variants as { pct: number }[]) ?? []).reduce((s, v) => s + Number(v.pct), 0);
      if (sum !== 100) errors.push({ nodeId: n.id, message: `as variantes somam ${sum}%, precisam somar 100%` });
    }
    if (n.type === 'send_whatsapp' && !ctx.approvedWaTemplates.has(String(n.data.template_id ?? ''))) errors.push({ nodeId: n.id, message: 'template de WhatsApp não aprovado na Meta' });
    if (n.type === 'send_email' && !ctx.activeEmailTemplates.has(String(n.data.email_template_id ?? ''))) errors.push({ nodeId: n.id, message: 'template de e-mail inexistente ou inativo' });
    if (n.type === 'wait' && n.data.until !== 'business_hours' && !(Number(n.data.amount) > 0)) errors.push({ nodeId: n.id, message: 'espera sem tempo definido' });
    if (n.type === 'move_stage' && !n.data.stage_id) errors.push({ nodeId: n.id, message: 'escolha a etapa' });
    if (n.type === 'add_tag' && !String(n.data.tag ?? '').trim()) errors.push({ nodeId: n.id, message: 'informe a tag' });
  }

  if (triggers.length === 1) {
    // alcance + ciclo + espaçamento de WhatsApp (DFS com minutos desde o último WhatsApp)
    const reached = new Set<string>();
    const reportedCycle = { v: false };
    const walk = (id: string, stack: Set<string>, sinceWa: number | null) => {
      if (stack.has(id)) { if (!reportedCycle.v) { errors.push({ nodeId: id, message: 'o fluxo tem um ciclo (volta para um nó anterior)' }); reportedCycle.v = true; } return; }
      reached.add(id);
      const n = byId.get(id); if (!n) return;
      let since = sinceWa;
      if (n.type === 'wait' && since !== null) since += n.data.until === 'business_hours' ? 5 : waitMinutes(n);
      if (n.type === 'send_whatsapp') {
        if (since !== null && since < 5) errors.push({ nodeId: n.id, message: 'dois WhatsApp com menos de 5 min de espera entre eles' });
        since = 0;
      }
      stack.add(id);
      for (const e of g.edges.filter((x) => x.source === id)) walk(e.target, stack, since);
      stack.delete(id);
    };
    walk(triggers[0].id, new Set(), null);
    for (const n of g.nodes) if (!reached.has(n.id)) errors.push({ nodeId: n.id, message: 'nó solto (não é alcançado a partir do gatilho)' });
  }
  const seen = new Set<string>();
  const uniq = errors.filter((e) => { const k = `${e.nodeId}|${e.message}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return { ok: uniq.length === 0, errors: uniq };
}

// ── Gatilho: validação da configuração, quando o envio é real e que checagem de lead usar ──
export const TRIGGER_TYPES = ['cart_abandoned', 'payment_pending', 'payment_refused', 'purchased', 'stage_entered', 'link_clicked', 'manual'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** null = ok; string = motivo do erro. */
export function validateTriggerConfig(type: string, cfg: Record<string, unknown>): string | null {
  if (!(TRIGGER_TYPES as readonly string[]).includes(type)) return `gatilho desconhecido: ${type}`;
  if ('pipeline' in cfg && (typeof cfg.pipeline !== 'string' || !cfg.pipeline.trim())) return 'funil inválido';
  if ('stage_id' in cfg && !UUID.test(String(cfg.stage_id))) return 'etapa inválida';
  if ('require_active_flow' in cfg && !UUID.test(String(cfg.require_active_flow))) return 'fluxo de referência inválido';
  if ('channel' in cfg && !['whatsapp', 'email', 'any'].includes(String(cfg.channel))) return 'canal inválido';
  if ('methods' in cfg && (!Array.isArray(cfg.methods) || !(cfg.methods as unknown[]).every((m) => m === 'pix' || m === 'billet'))) return 'formas de pagamento inválidas';
  return null;
}

/** Mesma regra do flow_trigger: sem funil só manual/compra enviam de verdade. */
export function liveAllowed(f: { status: string; trigger_type: string; trigger_config: Record<string, unknown> }, engineFor: (pipeline: string) => string): boolean {
  if (f.status !== 'live') return false;
  const pipe = f.trigger_config?.pipeline;
  if (typeof pipe === 'string' && pipe) return engineFor(pipe) === 'flows';
  return f.trigger_type === 'manual' || f.trigger_type === 'purchased';
}

/** esteira = lead aberto numa etapa da esteira; open = lead aberto; none = não checa. */
export function leadCheckFor(triggerType: string): 'esteira' | 'open' | 'none' {
  if (triggerType === 'cart_abandoned' || triggerType === 'link_clicked') return 'esteira';
  if (triggerType === 'purchased' || triggerType === 'manual') return 'none';
  return 'open';
}
