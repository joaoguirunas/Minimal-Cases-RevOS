import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeams, useCreateTeam, useUpdateTeam, useDeleteTeam } from './useTeamsNew';
import { toast } from 'sonner';

export const useTimesWithMethods = () => {
  const { data: times = [], isLoading, error, refetch } = useTeams();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const queryClient = useQueryClient();

  const adicionarUsuarioAoTime = useMutation({
    mutationFn: async ({ userId, teamId }: { userId: string; teamId: string }) => {
      const { error } = await supabase
        .from('settings_users_teams')
        .insert([{ user_id: userId, team_id: teamId }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-teams'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });

  const removerUsuarioDoTime = useMutation({
    mutationFn: async ({ userId, teamId }: { userId: string; teamId: string }) => {
      const { error } = await supabase
        .from('settings_users_teams')
        .delete()
        .eq('user_id', userId)
        .eq('team_id', teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-teams'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });

  return {
    times,
    loading: isLoading,
    error,
    fetchTimes: refetch,
    criarTime: createTeam,
    atualizarTime: updateTeam,
    deletarTime: deleteTeam,
    adicionarUsuarioAoTime,
    removerUsuarioDoTime,
  };
};
