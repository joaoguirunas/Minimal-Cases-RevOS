import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { UsuarioBasico } from '@/types/usuarios';

export interface Time {
  id: string;
  nome: string;
  ativo: boolean;
  tipo: string;
  prioridade: number;
}

// Fetch all active teams
export const useTimesDisponiveis = () => {
  return useQuery({
    queryKey: ['times-disponiveis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_teams')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      
      // Map English fields to Portuguese for compatibility
      const mappedData = (data || []).map(team => ({
        ...team,
        nome: team.name,
        ativo: team.active,
        tipo: team.team_type,
        prioridade: team.priority
      }));
      
      return mappedData as Time[];
    },
  });
};

// Fetch users by team ID
export const useUsuariosPorTime = (timeId?: string | null) => {
  return useQuery({
    queryKey: ['usuarios-por-time', timeId],
    queryFn: async () => {
      // Avoid querying when there's no valid team selected
      if (!timeId || timeId === 'none') return [] as UsuarioBasico[];

      const { data, error } = await supabase
        .from('settings_users_teams')
        .select(`
          id,
          user_id,
          team_id,
          usuario:settings_users!settings_users_teams_user_id_fkey (
            id,
            name,
            email,
            active,
            user_type,
            super_admin
          )
        `)
        .eq('team_id', timeId)
        .eq('usuario.active', true);

      if (error) throw error;

      // Extract and map users to expected interface
      const usuarios = (data || [])
        .map((ut: { usuario: { id: string; name: string; email: string; active: boolean; user_type: string; super_admin: boolean } | null }) => ut.usuario)
        .filter((u): u is NonNullable<typeof u> => !!u && u.active)
        .map((u) => ({
          id: u.id,
          nome: u.name,
          email: u.email,
          ativo: u.active,
          gestor: u.user_type === 'manager' || u.user_type === 'admin' || u.super_admin
        })) as UsuarioBasico[];

      return usuarios;
    },
    enabled: !!timeId && timeId !== 'none',
  });
};

// Update deal assignment (team and/or responsible)
export const useAtualizarAtribuicao = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      negocioId,
      timeId,
      usuarioId,
    }: {
      negocioId: string;
      timeId?: string | null;
      usuarioId?: string | null;
    }) => {
      const updates: { teams_id?: string | null; user_id?: string | null } = {};

      if (timeId !== undefined) {
        updates.teams_id = timeId;
      }

      if (usuarioId !== undefined) {
        updates.user_id = usuarioId;
      }

      console.log('🔄 Atualizando atribuição:', { negocioId, updates });

      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', negocioId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['negocio'] });
      queryClient.invalidateQueries({ queryKey: ['negocios'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['conversas-simples-v4'] });
      queryClient.invalidateQueries({ queryKey: ['conversas-paginadas'] });
    },
    onError: (error: Error) => {
      console.error('❌ Erro ao atualizar atribuição:', error);
      toast.error('Error updating assignment');
    },
  });
};

// Validate that a user belongs to a team
export const validateUserInTeam = async (
  userId: string,
  teamId: string
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('settings_users_teams')
    .select('id')
    .eq('user_id', userId)
    .eq('team_id', teamId)
    .maybeSingle();

  if (error) {
    console.error('Error validating user in team:', error);
    return false;
  }

  return !!data;
};
