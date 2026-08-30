import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useBulkDeletarNegocios = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadIds: string[]) => {
      if (leadIds.length === 0) return;

      // Sequential deletes — order matters due to FK constraints
      // Each step throws on error to halt the process
      const steps: Array<{ table: string; field: string }> = [
        { table: 'ai_agents_steps_history', field: 'lead_id' },
        { table: 'lead_field_values', field: 'lead_id' },
        { table: 'form_pro_submissions', field: 'lead_id' },
        { table: 'leads_files', field: 'lead_id' },
        { table: 'leads_notes', field: 'lead_id' },
        { table: 'leads_updates', field: 'lead_id' },
        { table: 'ai_agents_execution_log', field: 'lead_id' },
      ];

      for (const { table, field } of steps) {
        const { error } = await supabase.from(table).delete().in(field, leadIds);
        if (error) throw new Error(`Falha ao deletar ${table}: ${error.message}`);
      }

      // Meeting records require fetching meeting IDs first
      const { data: meetings, error: meetErr } = await supabase
        .from('meetings')
        .select('id')
        .in('lead_id', leadIds);
      if (meetErr) throw new Error(`Falha ao buscar meetings: ${meetErr.message}`);

      if (meetings && meetings.length > 0) {
        const meetingIds = meetings.map((m) => m.id);
        const { error } = await supabase.from('meeting_records').delete().in('meeting_id', meetingIds);
        if (error) throw new Error(`Falha ao deletar meeting_records: ${error.message}`);
      }

      // Delete meetings, messages, then leads (final)
      const finalSteps: Array<{ table: string; field: string }> = [
        { table: 'meetings', field: 'lead_id' },
        { table: 'messages', field: 'lead_id' },
        { table: 'leads', field: 'id' },
      ];

      for (const { table, field } of finalSteps) {
        const { error } = await supabase.from(table).delete().in(field, leadIds);
        if (error) throw new Error(`Falha ao deletar ${table}: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['negocios-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['negocios'] });
      queryClient.invalidateQueries({ queryKey: ['negocios-por-etapa'] });
      queryClient.invalidateQueries({ queryKey: ['negocio'] });
      toast.success('Negócios deletados com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao deletar negócios: ${error.message}`);
      console.error('[useBulkDeletarNegocios]', error);
    },
  });
};
