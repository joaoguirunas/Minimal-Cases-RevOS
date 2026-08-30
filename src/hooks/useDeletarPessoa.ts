import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useDeletarPessoa = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; tenantId?: string }) => {
      console.log('🗑️ Deletando pessoa e dependências:', id);

      // ── 1. Buscar leads da pessoa ──────────────────────────────────────────
      const { data: leads, error: leadsQueryError } = await supabase
        .from('leads')
        .select('id')
        .eq('people_id', id);

      if (leadsQueryError) {
        console.error('❌ Erro ao buscar leads:', leadsQueryError);
        throw leadsQueryError;
      }

      const leadIds = leads?.map(l => l.id) ?? [];
      console.log('📋 Leads encontrados:', leadIds.length);

      // ── 2. Limpar filhos dos leads (pela coluna lead_id) ───────────────────
      if (leadIds.length > 0) {
        const leadChildTables = [
          { table: 'ai_agents_steps_history', col: 'lead_id' },
          { table: 'lead_field_values',        col: 'lead_id' },
          { table: 'form_pro_submissions',      col: 'lead_id' },
          { table: 'leads_files',              col: 'lead_id' },
          { table: 'leads_notes',              col: 'lead_id' },
          { table: 'leads_updates',            col: 'lead_id' },
        ] as const;

        for (const { table, col } of leadChildTables) {
          const { error } = await supabase.from(table).delete().in(col, leadIds);
          if (error) console.warn(`⚠️ Erro ao deletar ${table}:`, error);
          else console.log(`✅ ${table} deletado`);
        }
      }

      // ── 2b. Q-fields diretos da pessoa (entity_type='pessoa', entity_id=id) ──
      {
        const { error } = await supabase
          .from('lead_field_values')
          .delete()
          .eq('entity_type', 'pessoa')
          .eq('entity_id', id);
        if (error) console.warn('⚠️ Erro ao deletar lead_field_values (pessoa):', error);
        else console.log('✅ lead_field_values (pessoa) deletado');
      }

      // ── 3. Limpar tabelas com FK dupla (lead_id + people_id) ──────────────
      //    Deletar pela pessoa garante cobertura total independente de lead
      const personChildTables = [
        { table: 'ai_agents_execution_log', col: 'people_id' },
        { table: 'form_pro_submissions',     col: 'lead_id' },
      ] as const;

      for (const { table, col } of personChildTables) {
        const { error } = await supabase.from(table).delete().eq(col, id);
        if (error) console.warn(`⚠️ Erro ao deletar ${table}:`, error);
        else console.log(`✅ ${table} deletado`);
      }

      // ── 4. Reuniões: limpar filas de follow-up + meeting_records + meetings ──
      // meeting_followup_queue tem FK para meetings — deve ser deletada antes
      {
        const { error } = await supabase
          .from('meeting_followup_queue')
          .delete()
          .eq('person_id', id);
        if (error) console.warn('⚠️ Erro ao deletar meeting_followup_queue:', error);
        else console.log('✅ meeting_followup_queue deletado');
      }

      if (leadIds.length > 0) {
        // Buscar IDs das reuniões ligadas aos leads
        const { data: meetingsByLead } = await supabase
          .from('meetings')
          .select('id')
          .in('lead_id', leadIds);

        const meetingIdsByLead = meetingsByLead?.map(m => m.id) ?? [];

        if (meetingIdsByLead.length > 0) {
          const { error } = await supabase
            .from('meeting_records')
            .delete()
            .in('meeting_id', meetingIdsByLead);
          if (error) console.warn('⚠️ Erro ao deletar meeting_records (lead):', error);
          else console.log('✅ meeting_records (lead) deletados');
        }

        const { error: meetingsLeadErr } = await supabase
          .from('meetings')
          .delete()
          .in('lead_id', leadIds);
        if (meetingsLeadErr) console.warn('⚠️ Erro ao deletar meetings (lead_id):', meetingsLeadErr);
        else console.log('✅ Meetings (lead_id) deletadas');
      }

      // Reuniões sem lead mas vinculadas à pessoa (ex: agendamento direto)
      const { data: meetingsByPerson } = await supabase
        .from('meetings')
        .select('id')
        .eq('people_id', id);

      const meetingIdsByPerson = meetingsByPerson?.map(m => m.id) ?? [];

      if (meetingIdsByPerson.length > 0) {
        const { error: mrErr } = await supabase
          .from('meeting_records')
          .delete()
          .in('meeting_id', meetingIdsByPerson);
        if (mrErr) console.warn('⚠️ Erro ao deletar meeting_records (person):', mrErr);

        const { error: mErr } = await supabase
          .from('meetings')
          .delete()
          .in('id', meetingIdsByPerson);
        if (mErr) console.warn('⚠️ Erro ao deletar meetings (people_id):', mErr);
        else console.log('✅ Meetings (people_id) deletadas');
      }

      // ── 5. Buffer de mensagens + mensagens da pessoa ───────────────────────
      {
        const { error } = await supabase.from('message_buffer').delete().eq('people_id', id);
        if (error) console.warn('⚠️ Erro ao deletar message_buffer:', error);
        else console.log('✅ message_buffer deletado');
      }

      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('people_id', id);
      if (messagesError) console.warn('⚠️ Erro ao deletar mensagens:', messagesError);
      else console.log('✅ Mensagens deletadas');

      // ── 6. Deletar leads ───────────────────────────────────────────────────
      if (leadIds.length > 0) {
        const { error: leadsDeleteError } = await supabase
          .from('leads')
          .delete()
          .in('id', leadIds);

        if (leadsDeleteError) {
          console.error('❌ Erro ao deletar leads:', leadsDeleteError);
          throw leadsDeleteError;
        }
        console.log('✅ Leads deletados');
      }

      // ── 7. Limpar restantes da pessoa antes de deletá-la ──────────────────
      const finalPersonTables = [
        { table: 'clients_people_companies', col: 'people_id' },
        { table: 'sends_contacts',           col: 'people_id' },
        { table: 'clients_people_updates',   col: 'people_id' },
      ] as const;

      for (const { table, col } of finalPersonTables) {
        const { error } = await supabase.from(table).delete().eq(col, id);
        if (error) console.warn(`⚠️ Erro ao deletar ${table}:`, error);
        else console.log(`✅ ${table} deletado`);
      }

      // followup_queue (stage-based): person_id — não está nos types.ts
      {
        const db = supabase as unknown as { from: (t: string) => any };
        const { error } = await db.from('followup_queue').delete().eq('person_id', id);
        if (error) console.warn('⚠️ Erro ao deletar followup_queue:', error);
        else console.log('✅ followup_queue deletado');
      }

      // sends_people: people_id — não está nos types.ts
      {
        const db = supabase as unknown as { from: (t: string) => any };
        const { error } = await db.from('sends_people').delete().eq('people_id', id);
        if (error) console.warn('⚠️ Erro ao deletar sends_people:', error);
        else console.log('✅ sends_people deletado');
      }

      // ── 8. Deletar a pessoa ────────────────────────────────────────────────
      const { error: personError } = await supabase
        .from('clients_people')
        .delete()
        .eq('id', id);

      if (personError) {
        console.error('❌ Erro ao deletar pessoa:', personError);
        throw personError;
      }

      console.log('✅ Pessoa deletada com sucesso');
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pessoas'] });
      queryClient.invalidateQueries({ queryKey: ['pessoas-paginadas'] });
      queryClient.invalidateQueries({ queryKey: ['conversas'] });
      queryClient.invalidateQueries({ queryKey: ['negocios'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Pessoa excluída com sucesso!');
    },
    onError: (error: any) => {
      console.error('💥 Erro ao deletar pessoa:', error);
      toast.error(error.message || 'Erro ao excluir pessoa');
    },
  });
};

export default useDeletarPessoa;
