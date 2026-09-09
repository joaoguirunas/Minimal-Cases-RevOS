/**
 * Primeiro WhatsApp humano de um COMERCIAL para uma pessoa (spec §5.2):
 * cancela só os toques de WhatsApp pendentes dos leads dela e desliga o agente (ai_enabled=false).
 * E-mail e SMS seguem. Idempotente: a partir da 2ª mensagem não faz nada.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function shouldHandoffToHuman(i: { senderUserType: string | null; priorHumanSentByUser: number }): boolean {
  return i.senderUserType === 'comercial' && i.priorHumanSentByUser === 0;
}

export async function handoffToHumanAfterFirstContact(
  supabase: SupabaseClient, o: { peopleId: string; userId: string },
): Promise<{ cancelled: number }> {
  const { data: leads } = await supabase.from('leads').select('id').eq('people_id', o.peopleId);
  const ids = ((leads ?? []) as Array<{ id: string }>).map((l) => l.id);
  let cancelled = 0;
  if (ids.length > 0) {
    const { data: upd } = await supabase.from('followup_queue')
      .update({ status: 'cancelled', error_message: 'comercial assumiu o WhatsApp' })
      .in('lead_id', ids).eq('channel', 'whatsapp').eq('status', 'pending').select('id');
    cancelled = (upd ?? []).length;
  }
  await supabase.from('clients_people').update({ ai_enabled: false }).eq('id', o.peopleId);
  return { cancelled };
}
