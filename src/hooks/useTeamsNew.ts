import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export interface Team {
  id: string;
  nome: string;
  descricao?: string;
  tipo: string;
  prioridade: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  // English compatibility
  name?: string;
  description?: string;
  type?: string;
  priority?: number;
  active?: boolean;
}

export const useTeams = () => {
  return useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_teams')
        .select('*')
        .eq('active', true)
        .order('priority');
      
      if (error) throw error;
      
      // Add Portuguese compatibility aliases
      const mappedData = (data || []).map(item => ({
        ...item,
        nome: item.name,
        descricao: item.description,
        tipo: item.team_type,
        prioridade: item.priority,
        ativo: item.active
      }));
      
      return mappedData as Team[];
    },
  });
};

export const useTeam = (id: string) => {
  return useQuery({
    queryKey: ['team', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_teams')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Team;
    },
    enabled: !!id,
  });
};

export const useCreateTeam = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (team: { nome: string; descricao?: string; tipo: string; prioridade: number }) => {
      // Map Portuguese field names to English database column names
      const dbTeam = {
        name: team.nome,
        description: team.descricao,
        team_type: team.tipo,
        priority: team.prioridade
      };
      
      const { data, error } = await supabase
        .from('settings_teams')
        .insert([dbTeam])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Time criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar time: ' + error.message);
    },
  });
};

export const useUpdateTeam = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<{ nome: string; descricao: string; tipo: string; prioridade: number; name: string; description: string; team_type: string; priority: number }> & { id: string }) => {
      // Map Portuguese field names to English database column names if present
      const dbUpdates: Record<string, unknown> = {};
      if (updates.nome !== undefined) dbUpdates.name = updates.nome;
      if (updates.descricao !== undefined) dbUpdates.description = updates.descricao;
      if (updates.tipo !== undefined) dbUpdates.team_type = updates.tipo;
      if (updates.prioridade !== undefined) dbUpdates.priority = updates.prioridade;
      // Keep English names as well for compatibility
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.team_type !== undefined) dbUpdates.team_type = updates.team_type;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      
      const { data, error } = await supabase
        .from('settings_teams')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Time atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar time: ' + error.message);
    },
  });
};

/** Pipelines atendidos por uma equipe. Vazio = atende TODOS os pipelines
 * (default) — só quando há pelo menos 1 vínculo a equipe fica restrita. */
export const useTeamPipelines = (teamId: string) => {
  return useQuery({
    queryKey: ['team-pipelines', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_teams_pipelines')
        .select('pipeline_id')
        .eq('team_id', teamId);

      if (error) throw error;
      return (data || []).map((r) => r.pipeline_id);
    },
    enabled: !!teamId,
  });
};

export const useSetTeamPipelines = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, pipelineIds }: { teamId: string; pipelineIds: string[] }) => {
      const { error: deleteError } = await supabase
        .from('settings_teams_pipelines')
        .delete()
        .eq('team_id', teamId);
      if (deleteError) throw deleteError;

      if (pipelineIds.length > 0) {
        const { error: insertError } = await supabase
          .from('settings_teams_pipelines')
          .insert(pipelineIds.map((pipeline_id) => ({ team_id: teamId, pipeline_id })));
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_data, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['team-pipelines', teamId] });
      toast.success('Pipelines da equipe atualizados!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar pipelines: ' + error.message);
    },
  });
};

/** Tags visíveis por uma equipe. Vazio = enxerga TODAS as tags (default) — só
 * quando há pelo menos 1 vínculo a equipe fica restrita. Mesma semântica de
 * useTeamPipelines. */
export const useTeamTags = (teamId: string) => {
  return useQuery({
    queryKey: ['team-tags', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_teams_tags')
        .select('tag_id')
        .eq('team_id', teamId);

      if (error) throw error;
      return (data || []).map((r) => r.tag_id);
    },
    enabled: !!teamId,
  });
};

export const useSetTeamTags = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, tagIds }: { teamId: string; tagIds: string[] }) => {
      const { error: deleteError } = await supabase
        .from('settings_teams_tags')
        .delete()
        .eq('team_id', teamId);
      if (deleteError) throw deleteError;

      if (tagIds.length > 0) {
        const { error: insertError } = await supabase
          .from('settings_teams_tags')
          .insert(tagIds.map((tag_id) => ({ team_id: teamId, tag_id })));
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_data, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['team-tags', teamId] });
      toast.success('Tags da equipe atualizadas!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar tags: ' + error.message);
    },
  });
};

/** Pipelines que o usuário LOGADO pode ver, resolvido pelas equipes dele.
 * `null` = sem restrição (vê todos — admin/manager/user, ou comercial sem
 * equipe, ou comercial numa equipe universal). Array = restrito a esses ids
 * (união de todas as equipes do usuário; se qualquer uma delas for
 * universal, o resultado inteiro vira null — a equipe mais aberta vence). */
export const useMyAllowedPipelineIds = () => {
  const { user } = useAuth();
  const userId = user?.profile?.id;
  const userType = user?.profile?.user_type;
  const isComercial = userType === 'comercial';

  return useQuery({
    queryKey: ['my-allowed-pipeline-ids', userId, isComercial],
    queryFn: async (): Promise<string[] | null> => {
      if (!isComercial || !userId) return null;

      const { data: memberships, error: membershipsError } = await supabase
        .from('settings_users_teams')
        .select('team_id')
        .eq('user_id', userId);
      if (membershipsError) throw membershipsError;

      const teamIds = (memberships || []).map((m) => m.team_id);
      if (teamIds.length === 0) return null; // sem equipe = sem restrição

      const { data: links, error: linksError } = await supabase
        .from('settings_teams_pipelines')
        .select('team_id, pipeline_id')
        .in('team_id', teamIds);
      if (linksError) throw linksError;

      const restrictedTeamIds = new Set((links || []).map((l) => l.team_id));
      const hasUniversalTeam = teamIds.some((id) => !restrictedTeamIds.has(id));
      if (hasUniversalTeam) return null; // qualquer equipe sem vínculo = atende tudo

      return [...new Set((links || []).map((l) => l.pipeline_id))];
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
};

export const useDeleteTeam = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('settings_teams')
        .update({ active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Time desativado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao desativar time: ' + error.message);
    },
  });
};
