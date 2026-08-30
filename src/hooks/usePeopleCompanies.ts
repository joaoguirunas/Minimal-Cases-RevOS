import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PeopleCompany {
  id: string;
  people_id: string;
  company_id: string;
  role?: string;
  is_primary: boolean;
  created_at?: string;
  company?: {
    id: string;
    trade_name: string;
    legal_name?: string;
  };
}

export const usePeopleCompanies = (peopleId?: string) => {
  return useQuery({
    queryKey: ['people-companies', peopleId],
    queryFn: async () => {
      if (!peopleId) return [];

      const { data, error } = await supabase
        .from('clients_people_companies')
        .select(`
          *,
          company:company_id(
            id,
            trade_name,
            legal_name
          )
        `)
        .eq('people_id', peopleId)
        .order('is_primary', { ascending: false });

      if (error) throw error;
      return (data || []) as PeopleCompany[];
    },
    enabled: !!peopleId,
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const useAddPeopleCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ peopleId, companyId, role, isPrimary }: { 
      peopleId: string; 
      companyId: string; 
      role?: string;
      isPrimary?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('clients_people_companies')
        .insert({
          people_id: peopleId,
          company_id: companyId,
          role: role,
          is_primary: isPrimary || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['people-companies', variables.peopleId] });
      toast.success('Empresa vinculada com sucesso!');
    },
    onError: (error: any) => {
      console.error('Error adding company to person:', error);
      if (error.code === '23505') {
        toast.error('Esta empresa já está vinculada');
      } else {
        toast.error('Erro ao vincular empresa');
      }
    },
  });
};

export const useRemovePeopleCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, peopleId }: { id: string; peopleId: string }) => {
      const { error } = await supabase
        .from('clients_people_companies')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['people-companies', variables.peopleId] });
      toast.success('Empresa desvinculada com sucesso!');
    },
    onError: (error: any) => {
      console.error('Error removing company from person:', error);
      toast.error('Erro ao desvincular empresa');
    },
  });
};

export const useUpdatePeopleCompanies = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ peopleId, companyIds }: { 
      peopleId: string; 
      companyIds: string[];
    }) => {
      // First, delete all existing relationships
      const { error: deleteError } = await supabase
        .from('clients_people_companies')
        .delete()
        .eq('people_id', peopleId);

      if (deleteError) throw deleteError;

      // Then, insert new relationships
      if (companyIds.length > 0) {
        const insertData = companyIds.map((companyId, index) => ({
          people_id: peopleId,
          company_id: companyId,
          is_primary: index === 0, // First company is primary
        }));

        const { error: insertError } = await supabase
          .from('clients_people_companies')
          .insert(insertData);

        if (insertError) throw insertError;
      }

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['people-companies', variables.peopleId] });
      queryClient.invalidateQueries({ queryKey: ['company-people'] });
      queryClient.invalidateQueries({ queryKey: ['negocios'] });
      queryClient.invalidateQueries({ queryKey: ['negocio'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
      console.error('Error updating people companies:', error);
      toast.error('Erro ao atualizar empresas');
    },
  });
};
