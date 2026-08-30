import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ContactStatus } from '@/types/sends';

interface UseSendContactsFilters {
  status?: ContactStatus;
  search?: string;
}

export const useSendContacts = (sendId: string, filters?: UseSendContactsFilters) => {
  return useQuery({
    queryKey: ['send-contacts', sendId, filters],
    queryFn: async () => {
      let query = supabase
        .from('sends_contacts')
        .select(`
          id, send_id, people_id, whatsapp, status, error_message, sent_at, delivered_at, read_at, created_at,
          person:clients_people!people_id(id, name, email, status)
        `)
        .eq('send_id', sendId)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.search) {
        query = query.or(`whatsapp.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      // Normalise rows where person is null (RLS block or deleted person)
      return (data ?? []).map((row: any) => ({
        ...row,
        person: row.person ?? {
          id: null,
          name: row.whatsapp || row.people_id || '—',
          email: null,
          status: null,
        },
      }));
    },
    enabled: !!sendId,
  });
};
