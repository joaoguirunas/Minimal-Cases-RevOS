/**
 * _shared/esteira-progress.ts — progressão automática da esteira (YMP-7).
 *
 * Move o lead para um stage de progressão DO PRÓPRIO pipeline dele, achado por
 * nome ('Em recuperação' quando o 1º toque sai, 'Engajou' quando clica em link
 * rastreado). Só avança (order_index maior que o atual) — nunca regride um lead
 * que já está em "Pagamento pendente"/"Recuperado". Pipeline sem um stage com
 * esse nome (ex.: RFM de clientes) = no-op silencioso.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function progressEsteiraStage(
  supabase: SupabaseClient,
  leadId: string,
  targetStageName: string,
): Promise<boolean> {
  const { data: leadRaw } = await supabase
    .from('leads')
    .select('id, leads_stages_id, leads_pipelines_id, status')
    .eq('id', leadId)
    .maybeSingle();
  const lead = leadRaw as {
    id: string; leads_stages_id: string | null; leads_pipelines_id: string | null; status: string;
  } | null;
  if (!lead?.leads_pipelines_id || !lead.leads_stages_id) return false;
  if (['lost', 'archived', 'won'].includes(lead.status)) return false;

  const { data: stagesRaw } = await supabase
    .from('leads_stages')
    .select('id, name, order_index')
    .eq('leads_pipelines_id', lead.leads_pipelines_id)
    .eq('active', true);
  const stages = (stagesRaw ?? []) as Array<{ id: string; name: string; order_index: number }>;

  const target = stages.find((s) => s.name === targetStageName);
  const current = stages.find((s) => s.id === lead.leads_stages_id);
  if (!target || !current || current.order_index >= target.order_index) return false;

  const { error } = await supabase
    .from('leads')
    .update({ leads_stages_id: target.id })
    .eq('id', leadId);
  return !error;
}

/**
 * Um lead ASSUMIDO por um comercial (claimed_at) nunca volta pra trás no funil.
 * O webhook `carrinho_abandonado` da Yampi repete a cada novo carrinho da mesma
 * pessoa; sem isso, o segundo evento arrancaria o lead de "Em negociação" e o
 * jogaria de volta em "Carrinho abandonado" — sumindo da mesa do comercial e
 * voltando pro pool.
 *
 * Lead sem dono segue com o comportamento de hoje (a esteira manda). Ordem
 * desconhecida (stage fora do pipeline, sem order_index) também: preferimos o
 * comportamento antigo a travar o movimento por falta de informação.
 */
export function shouldMoveStage(args: {
  claimedAt: string | null;
  currentOrder: number | null;
  targetOrder: number | null;
}): boolean {
  const { claimedAt, currentOrder, targetOrder } = args;
  if (!claimedAt) return true;
  if (currentOrder === null || targetOrder === null) return true;
  return targetOrder >= currentOrder;
}
