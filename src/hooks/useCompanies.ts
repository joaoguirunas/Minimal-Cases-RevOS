import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Company {
  id: string;
  trade_name: string;
  legal_name?: string;
  tax_id?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCompanyData {
  trade_name: string;
  legal_name?: string;
  tax_id?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
}

export interface UpdateCompanyData extends Partial<CreateCompanyData> {
  id: string;
}

export const useCompanies = (searchTerm?: string) => {
  return useQuery({
    queryKey: ['companies', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('clients_companies')
        .select('*')
        .order('trade_name', { ascending: true });

      if (searchTerm && searchTerm.trim()) {
        const search = searchTerm.trim().toLowerCase();
        query = query.or(`trade_name.ilike.%${search}%,legal_name.ilike.%${search}%,tax_id.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Company[];
    },
    staleTime: 30 * 1000,
  });
};

export const useCompany = (companyId: string) => {
  return useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const { data, error } = await supabase
        .from('clients_companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (error) throw error;
      return data as Company;
    },
    enabled: !!companyId,
  });
};

// Helper to convert empty strings to null (for unique constraints)
const emptyToNull = (value?: string) => value?.trim() || null;

export const useCreateCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCompanyData) => {
      const { data: result, error } = await supabase
        .from('clients_companies')
        .insert({
          trade_name: data.trade_name,
          legal_name: emptyToNull(data.legal_name),
          tax_id: emptyToNull(data.tax_id),
          email: emptyToNull(data.email),
          phone: emptyToNull(data.phone),
          website: emptyToNull(data.website),
          address: emptyToNull(data.address),
        })
        .select()
        .single();

      if (error) throw error;
      return result as Company;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Empresa criada com sucesso!');
    },
    onError: (error: any) => {
      console.error('Error creating company:', error);
      toast.error('Erro ao criar empresa');
    },
  });
};

export const useUpdateCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateCompanyData) => {
      const { data: result, error } = await supabase
        .from('clients_companies')
        .update({
          trade_name: data.trade_name,
          legal_name: emptyToNull(data.legal_name),
          tax_id: emptyToNull(data.tax_id),
          email: emptyToNull(data.email),
          phone: emptyToNull(data.phone),
          website: emptyToNull(data.website),
          address: emptyToNull(data.address),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result as Company;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['company', variables.id] });
      toast.success('Empresa atualizada com sucesso!');
    },
    onError: (error: any) => {
      console.error('Error updating company:', error);
      toast.error('Erro ao atualizar empresa');
    },
  });
};

export const useDeleteCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (companyId: string) => {
      const { error } = await supabase
        .from('clients_companies')
        .delete()
        .eq('id', companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Empresa excluída com sucesso!');
    },
    onError: (error: any) => {
      console.error('Error deleting company:', error);
      toast.error('Erro ao excluir empresa');
    },
  });
};
