import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useCompanyPeople = (companyId?: string) => {
  return useQuery({
    queryKey: ['company-people', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase.from('clients_people_companies').select('*').eq('company_id', companyId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });
};

export const useCompanyLeads = (companyId?: string) => {
  return useQuery({
    queryKey: ['company-leads', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase.from('leads').select('id, title, people_id, clients_people(name)').eq('company_id', companyId);
      if (error) throw error;
      return (data || []).map((l: any) => ({ ...l, person: l.clients_people }));
    },
    enabled: !!companyId,
  });
};

export const useAllPeople = () => {
  return useQuery({
    queryKey: ['all-people-select'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients_people').select('id, name, email').order('name').limit(500);
      if (error) throw error;
      return data || [];
    },
  });
};

export const useAllLeads = () => {
  return useQuery({
    queryKey: ['all-leads-select'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('id, title, people_id, clients_people(name)').order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      return (data || []).map((l: any) => ({ ...l, person: l.clients_people }));
    },
  });
};

export const useUpdateCompanyPeople = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ companyId, peopleIds }: { companyId: string; peopleIds: string[] }) => {
      await supabase.from('clients_people_companies').delete().eq('company_id', companyId);
      if (peopleIds.length > 0) {
        const { error } = await supabase.from('clients_people_companies').insert(
          peopleIds.map(pid => ({ company_id: companyId, people_id: pid }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company-people'] }); },
  });
};

export const useUpdateCompanyLeads = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ companyId, leadIds }: { companyId: string; leadIds: string[] }) => {
      // Remove company from leads not in list
      await supabase.from('leads').update({ company_id: null }).eq('company_id', companyId);
      // Add company to selected leads
      if (leadIds.length > 0) {
        const { error } = await supabase.from('leads').update({ company_id: companyId }).in('id', leadIds);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company-leads'] }); },
  });
};
