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
