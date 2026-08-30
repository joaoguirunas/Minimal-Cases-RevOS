import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface UserTeam {
  id: string;
  user_id: string;
  team_id: string;
  is_priority: boolean;
  created_at?: string;
  usuario?: {
    id: string;
    name: string;
    email?: string;
    active?: boolean;
    super_admin?: boolean;
    user_type?: string;
  } | null;
}

export const useUsersTeams = () => {
  return useQuery({
    queryKey: ['users-teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_users_teams')
        .select(`
          *,
          usuario:settings_users(id, name, email, active, super_admin, user_type)
        `);

      if (error) throw error;
      return (data || []) as UserTeam[];
    },
  });
};

/** Marca/desmarca um membro como prioritário dentro da equipe. Prioritário
 * livre no horário pedido ganha o agendamento antes do load-balance normal
 * (ver RPC book_meeting). */
export const useSetUserTeamPriority = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, teamId, isPriority }: { userId: string; teamId: string; isPriority: boolean }) => {
      const { error } = await supabase
        .from('settings_users_teams')
        .update({ is_priority: isPriority })
        .eq('user_id', userId)
        .eq('team_id', teamId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-teams'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar prioridade: ' + error.message);
    },
  });
};
