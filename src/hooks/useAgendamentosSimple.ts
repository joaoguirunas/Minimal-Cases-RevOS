import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AgendamentoSimple {
  id: string;
  date?: string; // backward compatibility
  start_time: string;
  end_time: string;
  lead_id: string;
  user_id?: string;
  status?: string;
  notes?: string;
  location?: string;
  quantity?: number;
  created_at: string;
  source?: string;            // 'app' | 'google' | 'manual'
  google_event_id?: string;
  google_last_synced_at?: string;
  attendees?: string[];
  google_meet_link?: string;
  calendar_id?: string;
  gcal_sync_error?: string | null;
  // Backward compatibility
  data?: string;
  hora_inicio?: string;
  hora_fim?: string;
  negocio_id?: string;
  usuario_id?: string;
  observacoes?: string;
  local?: string;
  quantidade?: number;
  criado_em?: string;
  origem?: string;
  convidados?: string[];
  // Joins
  negocio?: any;
  consultor?: {
    id: string;
    nome: string;
  };
}

export const useAgendamentosSimple = (userId?: string | null, enabled = true) => {
  return useQuery({
    queryKey: ['agendamentos-simple', userId ?? 'all'],
    enabled,
    queryFn: async () => {
      let query = supabase
        .from('meetings')
        .select(`
          *,
          leads (
            id,
            title,
            people_id,
            clients_people (
              id,
              name,
              whatsapp,
              email
            )
          ),
          settings_users (
            id,
            name,
            email
          )
        `)
        .order('start_time', { ascending: true });

      if (userId) query = query.eq('user_id', userId);

      const { data, error } = await query;

      if (error) throw error;
      
      // Extrai HH:MM:SS no fuso LOCAL do browser (não UTC raw)
      const toLocalTimeStr = (iso: string): string => {
        const d = new Date(iso);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      };

      // Map to AgendamentoSimple with backward compatibility
      const mappedData = (data || []).map((item: any) => {
        // Data local (sv = YYYY-MM-DD via Intl, respeita fuso do browser)
        const startDate = item.start_time ? new Date(item.start_time).toLocaleDateString('sv') : '';

        return {
          id: item.id,
          start_time: item.start_time,
          end_time: item.end_time,
          lead_id: item.lead_id,
          user_id: item.user_id,
          status: item.status,
          notes: item.notes,
          location: item.location,
          quantity: item.quantity,
          created_at: item.created_at,
          source: item.source,
          google_event_id: item.google_event_id,
          google_last_synced_at: item.google_last_synced_at,
          attendees: item.attendees,
          google_meet_link: item.meeting_link,
          calendar_id: item.calendar_id,
          gcal_sync_error: item.gcal_sync_error ?? null,
          negocio: item.leads ? {
            id: item.leads.id,
            titulo: item.leads.title,
            title: item.leads.title,
            people_id: item.leads.people_id,
            pessoa: item.leads.clients_people,
            person: item.leads.clients_people ? {
              ...item.leads.clients_people,
              nome: item.leads.clients_people.name
            } : null
          } : null,
          consultor: item.settings_users ? {
            id: item.settings_users.id,
            nome: item.settings_users.name,
            email: item.settings_users.email
          } : null,
          // Backward compatibility — hora local, não UTC
          date: startDate,
          data: startDate,
          hora_inicio: item.start_time ? toLocalTimeStr(item.start_time) : '',
          hora_fim:    item.end_time   ? toLocalTimeStr(item.end_time)   : '',
          negocio_id: item.lead_id,
          usuario_id: item.user_id,
          observacoes: item.notes,
          local: item.location,
          quantidade: item.quantity,
          criado_em: item.created_at,
          origem: item.source,
          convidados: item.attendees,
        };
      });
      
      return mappedData as unknown as AgendamentoSimple[];
    },
    staleTime: 60 * 1000,      // 1 min — fresh enough for calendar navigation
    gcTime: 10 * 60 * 1000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  });
};
