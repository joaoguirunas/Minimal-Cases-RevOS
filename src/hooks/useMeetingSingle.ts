import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MeetingPerson {
  id: string;
  name: string;
  whatsapp?: string | null;
  email?: string | null;
  score?: number | null;
}

export interface MeetingLead {
  id: string;
  title?: string | null;
  value?: number | null;
  status?: string | null;
  people_id?: string | null;
  clients_people?: MeetingPerson | null;
}

export interface MeetingConsultor {
  id: string;
  name: string;
  email?: string | null;
}

export interface MeetingWithRelations {
  id: string;
  lead_id: string;
  user_id?: string | null;
  start_time: string;
  end_time: string;
  status?: string | null;
  title?: string | null;
  notes?: string | null;
  location?: string | null;
  meeting_link?: string | null;
  google_event_id?: string | null;
  ms_meeting_id?: string | null;
  source?: string | null;
  quantity?: number | null;
  outcome?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  leads?: MeetingLead | null;
  settings_users?: MeetingConsultor | null;
}

export const useMeetingSingle = (id: string) =>
  useQuery({
    queryKey: ['meeting-single', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select(`
          *,
          leads (
            id,
            title,
            value,
            status,
            people_id,
            clients_people (
              id,
              name,
              whatsapp,
              email,
              score
            )
          ),
          settings_users (
            id,
            name,
            email
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as MeetingWithRelations;
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
