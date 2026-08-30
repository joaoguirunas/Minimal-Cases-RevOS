import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ALL_MODULE_KEYS } from '@/utils/modules';

interface SystemModule {
  id: string;
  module_key: string;
  module_name: string;
  is_active: boolean;
  order_index: number;
  icon?: string;
}

export const useSystemModules = () => {
  const queryClient = useQueryClient();

  const { data: modules = [], isLoading, error, refetch } = useQuery({
    queryKey: ['system-modules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_system_modules')
        .select('*')
        .order('order_index');

      if (error) throw error;
      return data as SystemModule[];
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'stale',
  });

  const toggleModule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('settings_system_modules')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['system-modules'] });
      await refetch();
      toast.success('Módulo atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar módulo: ' + error.message);
    },
  });

  const activeModules = modules.filter(
    m => m.is_active && ALL_MODULE_KEYS.has(m.module_key)
  );

  return {
    modules,
    activeModules,
    isLoading,
    error,
    toggleModule: toggleModule.mutate,
    isToggling: toggleModule.isPending,
    refetch,
  };
};
