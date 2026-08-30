import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useAgendamentosSimples = (pessoaId: string | null) => {
  return useQuery({
    queryKey: ['agendamentos-simples', pessoaId],
    queryFn: async () => {
      if (!pessoaId) return [];

      const { data, error } = await supabase
        .from('meetings')
        .select('id, title, description, start_time, end_time, location, status, user_id, settings_users:user_id(name)')
        .eq('people_id', pessoaId)
        .order('start_time', { ascending: false })
        .limit(10);

      if (error) {
        console.error('[useAgendamentosSimples] error:', error);
        throw error;
      }

      return (data || []).map((m: any) => ({
        id: m.id,
        titulo: m.title,
        descricao: m.description,
        data_inicio: m.start_time,
        data_fim: m.end_time,
        local: m.location,
        status: m.status,
        responsavel: m.settings_users?.name || 'N/A',
      }));
    },
    enabled: !!pessoaId,
    staleTime: 30000,
  });
};
