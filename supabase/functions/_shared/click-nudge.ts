/**
 * click-nudge — "clicou e não comprou em X min → agente puxa conversa".
 *
 * NÃO envia nada. Só agenda uma linha em ai_scheduled_callbacks (mode 'agent',
 * reason 'clique_sem_compra'). Quem dispara é o ai-callback-worker, que já aplica:
 * ai_enabled, lead won/lost, conversa em andamento, janela de 24h do WhatsApp
 * (fora dela só template aprovado) e chama ai-agent-execute → whatsapp-outbound
 * (gate agent_requires_outreach, trava sends_locked, allowlist). Nenhuma trava
 * é lida ou alterada aqui.
 *
 * Config em omni_channel_configs.settings (channel='whatsapp'):
 *   click_nudge_enabled         false (padrão)  → nada é agendado
 *   click_nudge_delay_minutes   30
 *   click_nudge_template_name   null → fora da janela de 24h o worker marca 'failed'
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ClickNudgeSettings { enabled: boolean; delayMinutes: number; templateName: string | null }

export function parseClickNudgeSettings(settings: unknown): ClickNudgeSettings {
  const s = (settings && typeof settings === 'object' ? settings : {}) as Record<string, unknown>;
  const enabled = s.click_nudge_enabled === true || s.click_nudge_enabled === 'true';
  const delayRaw = Number(s.click_nudge_delay_minutes ?? 30);
  const delayMinutes = Number.isFinite(delayRaw) && delayRaw >= 5 ? Math.floor(delayRaw) : 30;
  const tn = s.click_nudge_template_name;
  const templateName = typeof tn === 'string' && tn.trim() ? tn.trim() : null;
  return { enabled, delayMinutes, templateName };
}

export const NUDGE_BLOCKED_STAGES: readonly string[] = ['Pagamento pendente', 'Recuperado', 'Perdido'];

export interface NudgeDecisionInput {
  settings: ClickNudgeSettings; leadId: string | null; peopleId: string | null;
  leadStatus: string | null; stageName: string | null; agentActive: boolean; lastNudgeAt: string | null; now: Date;
}

export function decideNudge(i: NudgeDecisionInput): { ok: true } | { ok: false; reason: string } {
  if (!i.settings.enabled) return { ok: false, reason: 'click_nudge_enabled=false' };
  if (!i.leadId || !i.peopleId) return { ok: false, reason: 'link sem lead/pessoa' };
  if (['won', 'lost', 'archived'].includes(i.leadStatus ?? '')) return { ok: false, reason: `lead ${i.leadStatus}` };
  if (i.stageName && NUDGE_BLOCKED_STAGES.includes(i.stageName)) return { ok: false, reason: `stage ${i.stageName}` };
  if (!i.agentActive) return { ok: false, reason: 'sem agente ativo no pipeline' };
  if (i.lastNudgeAt && i.now.getTime() - new Date(i.lastNudgeAt).getTime() < 24 * 3_600_000) return { ok: false, reason: 'já houve nudge nas últimas 24h' };
  return { ok: true };
}

export function buildNudgeInstruction(delayMinutes: number): string {
  return `O cliente abriu o link do carrinho há ${delayMinutes} min e ainda não finalizou a compra. Puxe a conversa em 1 frase curta e humana, SEM reenviar o link de cara: pergunte se ficou alguma dúvida (encaixe no modelo, cor, frete, forma de pagamento). Se ele já escreveu depois do clique, só continue a conversa normalmente.`;
}

export async function scheduleClickNudge(
  supabase: SupabaseClient,
  p: { linkId: string; leadId: string | null; peopleId: string | null },
): Promise<{ scheduled: boolean; reason: string }> {
  const { data: cfg } = await supabase.from('omni_channel_configs').select('settings').eq('channel', 'whatsapp').maybeSingle();
  const settings = parseClickNudgeSettings((cfg as { settings?: unknown } | null)?.settings);
  if (!settings.enabled) return { scheduled: false, reason: 'click_nudge_enabled=false' };
  if (!p.leadId || !p.peopleId) return { scheduled: false, reason: 'link sem lead/pessoa' };

  const { data: leadRaw } = await supabase.from('leads').select('id, status, leads_stages_id, leads_pipelines_id').eq('id', p.leadId).maybeSingle();
  const lead = leadRaw as { status: string | null; leads_stages_id: string | null; leads_pipelines_id: string | null } | null;
  if (!lead) return { scheduled: false, reason: 'lead não encontrado' };

  let stageName: string | null = null;
  if (lead.leads_stages_id) {
    const { data: st } = await supabase.from('leads_stages').select('name').eq('id', lead.leads_stages_id).maybeSingle();
    stageName = (st as { name?: string } | null)?.name ?? null;
  }

  let agentActive = false;
  if (lead.leads_pipelines_id) {
    const { data: agents } = await supabase.from('ai_agents').select('id')
      .eq('active', true)
      .contains('channel_types', ['whatsapp'])
      .or(`pipeline_id.eq.${lead.leads_pipelines_id},pipeline_ids.cs.{${lead.leads_pipelines_id}}`)
      .limit(1);
    agentActive = ((agents ?? []) as unknown[]).length > 0;
  }

  const { data: lastNudge } = await supabase.from('tracked_links').select('nudge_scheduled_at')
    .eq('lead_id', p.leadId).not('nudge_scheduled_at', 'is', null)
    .order('nudge_scheduled_at', { ascending: false }).limit(1).maybeSingle();

  const now = new Date();
  const decision = decideNudge({
    settings, leadId: p.leadId, peopleId: p.peopleId, leadStatus: lead.status, stageName, agentActive,
    lastNudgeAt: (lastNudge as { nudge_scheduled_at?: string } | null)?.nudge_scheduled_at ?? null, now,
  });
  if (!decision.ok) return { scheduled: false, reason: decision.reason };

  const scheduledFor = new Date(now.getTime() + settings.delayMinutes * 60_000).toISOString();
  const { error } = await supabase.from('ai_scheduled_callbacks').insert({
    lead_id: p.leadId,
    people_id: p.peopleId,
    scheduled_for: scheduledFor,
    mode: 'agent',
    reason: 'clique_sem_compra',
    message_text: buildNudgeInstruction(settings.delayMinutes),
    whatsapp_template_name: settings.templateName,
    channel: 'whatsapp',
    status: 'pending',
  });
  // Índice único "1 pendente por lead": se o agente já agendou um retorno, deixamos o dele.
  if (error) return { scheduled: false, reason: `insert: ${error.message.slice(0, 120)}` };
  await supabase.from('tracked_links').update({ nudge_scheduled_at: now.toISOString() }).eq('id', p.linkId);
  return { scheduled: true, reason: `agendado para ${scheduledFor}` };
}
