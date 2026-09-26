// supabase/functions/_shared/flows/runner.ts
/** Anda uma execução de fluxo a partir do nó atual até a próxima espera (ou fim). Sem banco: tudo via deps. */
import { nextNode, stableVariant, waitMinutes, type FlowGraph, type FlowNode } from './graph.ts';

export interface RunState { id: string; flowId: string; peopleId: string; leadId: string | null; mode: 'live' | 'simulation'; currentNodeId: string | null; context: Record<string, unknown>; startedAt: string }
export interface RunnerDeps {
  now(): Date;
  purchasedSince(peopleId: string, sinceIso: string): Promise<boolean>;
  leadActive(leadId: string): Promise<boolean>;
  clickedSince(peopleId: string, sinceIso: string, channel: 'whatsapp' | 'email' | null): Promise<boolean>;
  contact(peopleId: string): Promise<{ whatsapp: boolean; email: boolean; tags: string[] }>;
  nextBusinessOpen(from: Date): Promise<Date>;
  enqueueSend(p: { run: RunState; node: FlowNode; channel: 'whatsapp_template' | 'email'; vars: Record<string, unknown> }): Promise<string>;
  moveStage(leadId: string, stageId: string): Promise<void>;
  addTag(peopleId: string, leadId: string | null, tag: string): Promise<void>;
}
export interface StepLog { nodeId: string; nodeType: string; action: string; detail?: Record<string, unknown> }
export interface StepResult { status: 'active' | 'completed' | 'exited'; currentNodeId: string | null; wakeAt: string | null; context: Record<string, unknown>; logs: StepLog[]; exitReason?: string }

const MAX_NODES = 50;

export async function advanceRun(run: RunState, graph: FlowGraph, flow: { exitOnPurchase: boolean }, deps: RunnerDeps): Promise<StepResult> {
  const logs: StepLog[] = [];
  const ctx: Record<string, unknown> = { ...run.context };
  const now = deps.now();
  const exit = (reason: string, nodeId: string | null): StepResult => {
    logs.push({ nodeId: nodeId ?? '-', nodeType: 'exit', action: 'exited', detail: { reason } });
    return { status: 'exited', currentNodeId: nodeId, wakeAt: null, context: ctx, logs, exitReason: reason };
  };
  if (flow.exitOnPurchase && await deps.purchasedSince(run.peopleId, run.startedAt)) return exit('purchased', run.currentNodeId);
  if (run.leadId && !(await deps.leadActive(run.leadId))) return exit('lead_inativo', run.currentNodeId);

  let node: FlowNode | null = run.currentNodeId
    ? graph.nodes.find((n) => n.id === run.currentNodeId) ?? null
    : graph.nodes.find((n) => n.type === 'trigger') ?? null;
  let contact: { whatsapp: boolean; email: boolean; tags: string[] } | null = null;
  const getContact = async () => (contact ??= await deps.contact(run.peopleId));

  for (let i = 0; i < MAX_NODES; i++) {
    if (!node) {
      logs.push({ nodeId: run.currentNodeId ?? '-', nodeType: 'exit', action: 'completed' });
      return { status: 'completed', currentNodeId: null, wakeAt: null, context: ctx, logs };
    }
    const n = node;
    let handle = 'out';
    switch (n.type) {
      case 'trigger':
        logs.push({ nodeId: n.id, nodeType: n.type, action: 'entered' });
        break;
      case 'wait': {
        if (ctx.waitingOn === n.id) {
          delete ctx.waitingOn;
          logs.push({ nodeId: n.id, nodeType: n.type, action: 'waited' });
          break;
        }
        const wake = n.data.until === 'business_hours' ? await deps.nextBusinessOpen(now) : new Date(now.getTime() + waitMinutes(n) * 60_000);
        if (wake.getTime() <= now.getTime()) { logs.push({ nodeId: n.id, nodeType: n.type, action: 'waited' }); break; }
        ctx.waitingOn = n.id;
        return { status: 'active', currentNodeId: n.id, wakeAt: wake.toISOString(), context: ctx, logs };
      }
      case 'condition': {
        const check = String(n.data.check ?? '');
        let yes = false;
        if (check === 'clicked_since_start') yes = await deps.clickedSince(run.peopleId, run.startedAt, null);
        else if (check === 'clicked_channel') yes = await deps.clickedSince(run.peopleId, run.startedAt, (n.data.channel as 'whatsapp' | 'email') ?? null);
        else if (check === 'purchased') yes = await deps.purchasedSince(run.peopleId, run.startedAt);
        else if (check === 'has_whatsapp') yes = (await getContact()).whatsapp;
        else if (check === 'has_email') yes = (await getContact()).email;
        else if (check === 'has_tag') yes = (await getContact()).tags.includes(String(n.data.tag ?? ''));
        handle = yes ? 'yes' : 'no';
        logs.push({ nodeId: n.id, nodeType: n.type, action: 'branch', detail: { check, branch: handle } });
        break;
      }
      case 'split': {
        const variants = (n.data.variants as { key: string; pct: number }[]) ?? [];
        const chosen = (ctx.variants as Record<string, string> | undefined)?.[n.id] ?? stableVariant(`${run.peopleId}:${n.id}`, variants);
        ctx.variants = { ...(ctx.variants as Record<string, string> | undefined), [n.id]: chosen };
        handle = chosen;
        logs.push({ nodeId: n.id, nodeType: n.type, action: 'branch', detail: { branch: chosen } });
        break;
      }
      case 'send_whatsapp':
      case 'send_email': {
        const isWa = n.type === 'send_whatsapp';
        const c = await getContact();
        if (isWa ? !c.whatsapp : !c.email) { logs.push({ nodeId: n.id, nodeType: n.type, action: 'skipped', detail: { reason: isWa ? 'sem WhatsApp' : 'sem e-mail' } }); break; }
        const key = String(isWa ? n.data.template_id : n.data.email_template_id);
        const vars: Record<string, unknown> = { ...((n.data.vars as Record<string, unknown>) ?? {}) };
        if (n.data.use_personal_coupon === true) vars.cupom_pessoal = true;
        if (!isWa) vars.email_template_id = n.data.email_template_id;
        if (ctx.variants) vars.flow_variants = ctx.variants;
        if (run.mode === 'simulation') { logs.push({ nodeId: n.id, nodeType: n.type, action: 'would_send', detail: { key, channel: isWa ? 'whatsapp' : 'email' } }); break; }
        const qid = await deps.enqueueSend({ run, node: n, channel: isWa ? 'whatsapp_template' : 'email', vars });
        logs.push({ nodeId: n.id, nodeType: n.type, action: 'enqueued', detail: { key, followup_queue_id: qid } });
        break;
      }
      case 'move_stage':
        if (run.mode === 'live' && run.leadId) await deps.moveStage(run.leadId, String(n.data.stage_id));
        logs.push({ nodeId: n.id, nodeType: n.type, action: 'moved_stage', detail: { stage_id: n.data.stage_id, simulated: run.mode === 'simulation' } });
        break;
      case 'add_tag':
        if (run.mode === 'live') await deps.addTag(run.peopleId, run.leadId, String(n.data.tag));
        logs.push({ nodeId: n.id, nodeType: n.type, action: 'tagged', detail: { tag: n.data.tag, simulated: run.mode === 'simulation' } });
        break;
      case 'exit':
        logs.push({ nodeId: n.id, nodeType: n.type, action: 'completed' });
        return { status: 'completed', currentNodeId: n.id, wakeAt: null, context: ctx, logs };
    }
    node = nextNode(graph, n.id, handle);
    run = { ...run, currentNodeId: n.id };
  }
  // limite de proteção: continua na próxima rodada a partir do último nó visitado
  return { status: 'active', currentNodeId: node?.id ?? run.currentNodeId, wakeAt: now.toISOString(), context: ctx, logs };
}
