import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useDesarquivarPessoa = () => {
  const qc = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id }: { id: string; tenantId?: string }) => {
      const { error } = await supabase
        .from('clients_people')
        .update({ archived: false, archived_at: null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pessoas'] });
      qc.invalidateQueries({ queryKey: ['pessoas-paginadas'] });
      toast.success('Pessoa desarquivada!');
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });
};
