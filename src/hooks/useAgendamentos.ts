import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAgendamentosSimple } from './useAgendamentosSimple';
import { auditLogger } from '@/utils/auditLogger';

interface CreateAgendamentoData {
  lead_id?: string | null;
  people_id?: string | null;
  title?: string;
  user_id?: string;
  date: string;
  start_time: string;
  end_time: string;
  location?: string;
  notes?: string;
  google_meet_link?: string | null;
  status?: string;
  sendConfirmation?: boolean;
}

interface UpdateAgendamentoData {
  id: string;
  lead_id?: string;
  user_id?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  notes?: string;
  google_meet_link?: string | null;
  status?: string;
}

// Main hook - alias to useAgendamentosSimple for backwards compatibility
export const useAgendamentos = (tenantId?: string) => {
  return useAgendamentosSimple();
};

// Enhanced hook - alias to useAgendamentosSimple for backwards compatibility
export const useAgendamentosEnhanced = () => {
  return useAgendamentosSimple();
};

export const useCriarAgendamento = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAgendamentoData) => {
      // Combinar date + time e converter para UTC respeitando o fuso local do browser
      const startTimestamp = new Date(`${data.date}T${data.start_time}`).toISOString();
      const endTimestamp   = new Date(`${data.date}T${data.end_time}`).toISOString();
      
      const { data: meeting, error } = await supabase
        .from('meetings')
        .insert({
          lead_id: data.lead_id || null,
          people_id: data.people_id || null,
          user_id: data.user_id || null,
          start_time: startTimestamp,
          end_time: endTimestamp,
          location: data.location || null,
          notes: data.notes || null,
          meeting_link: data.google_meet_link || null,
          status: data.status || 'agendado',
          title: data.title || 'Reunião',
        })
        .select()
        .single();

      if (error) throw error;

      // Audit log
      await auditLogger.log({
        action: 'meeting_created',
        resource_type: 'meeting',
        resource_id: meeting.id,
        details: {
          lead_id: data.lead_id,
          user_id: data.user_id,
          start_time: startTimestamp,
          end_time: endTimestamp,
          status: data.status || 'agendado'
        }
      });
      
      return meeting;
    },
    onSuccess: (meeting, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos-simple'] });
      toast.success('Meeting scheduled successfully!');
      // Sync to Google Calendar — chain confirmation after sync to have meet link
      supabase.functions
        .invoke('google-cal-upsert-event', { body: { meeting_id: meeting.id, action: 'create' } })
        .then(({ data, error }) => {
          if (error) {
            console.warn('[GCal] upsert error:', error);
            toast.warning('Agendamento criado, mas falhou ao sincronizar com Google Calendar.');
            return;
          }
          const d = data as { skipped?: boolean; reason?: string; success?: boolean; google_event_id?: string; detail?: string } | null;
          if (d?.skipped) {
            console.info('[GCal] skipped:', d.reason);
            const reasonMessages: Record<string, string> = {
              no_consultant: 'Agendamento criado, mas sem sync com Google Calendar — consultor não definido.',
              no_calendar_connection: 'Agendamento criado, mas sem sync com Google Calendar — consultor sem conexão Google. Configure em Integrações.',
              token_refresh_failed: 'Agendamento criado, mas a conexão Google do consultor expirou. Reconecte em Integrações.',
              create_failed: 'Agendamento criado, mas o Google Calendar rejeitou o evento.',
              meeting_not_found: 'Agendamento criado, mas não foi possível sincronizar (meeting não encontrado).',
            };
            const msg = (d.reason && reasonMessages[d.reason]) || `Agendamento criado, mas sem sync com Google Calendar (${d.reason ?? 'motivo desconhecido'}).`;
            toast.warning(msg);
          }
          else if (d?.success) {
            console.info('[GCal] synced to Google Calendar:', d.google_event_id);
            queryClient.invalidateQueries({ queryKey: ['agendamentos-simple'] });
          }
          // Send WhatsApp confirmation after GCal sync (meet link now available)
          if (variables.sendConfirmation) {
            supabase.functions
              .invoke('send-meeting-confirmation', { body: { meeting_id: meeting.id } })
              .then(({ data: confirmData, error: confirmErr }) => {
                const cd = confirmData as { sent?: boolean; error?: string } | null;
                if (confirmErr) console.warn('[MeetConfirm] error:', confirmErr.message);
                else if (cd?.sent) toast.success('Confirmação enviada por WhatsApp');
                else if (cd?.error) console.warn('[MeetConfirm]', cd.error);
              })
              .catch((err) => console.warn('[MeetConfirm] invoke error:', err));
          }
        })
        .catch((err) => console.warn('[GCal] upsert-event exception:', err));
      // Sync to Microsoft Teams (fire-and-forget — skips if provider != microsoft)
      supabase.functions
        .invoke('ms-teams-upsert-event', { body: { meeting_id: meeting.id, action: 'create' } })
        .then(({ data, error }) => {
          if (error) { console.warn('[Teams] upsert error:', error); return; }
          const d = data as { skipped?: boolean; reason?: string; success?: boolean; ms_meeting_id?: string } | null;
          if (d?.skipped) console.info('[Teams] skipped:', d.reason);
          else if (d?.success) {
            console.info('[Teams] synced to Microsoft Teams:', d.ms_meeting_id);
            queryClient.invalidateQueries({ queryKey: ['agendamentos-simple'] });
          }
        })
        .catch((err) => console.warn('[Teams] upsert-event exception:', err));
    },
    onError: (error: Error) => {
      console.error('Error creating meeting:', error);
      toast.error(error.message || 'Error creating meeting');
    },
  });
};

export const useUpdateAgendamento = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateAgendamentoData) => {
      const { data: meeting, error } = await supabase
        .from('meetings')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // Audit log
      await auditLogger.log({
        action: 'meeting_updated',
        resource_type: 'meeting',
        resource_id: id,
        details: {
          fields_changed: Object.keys(data),
          updates: data
        }
      });
      
      return meeting;
    },
    onSuccess: (meeting, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos-simple'] });
      toast.success('Meeting updated successfully!');
      // Sync to Google Calendar (fire-and-forget)
      supabase.functions
        .invoke('google-cal-upsert-event', { body: { meeting_id: meeting.id, action: 'update' } })
        .catch((err) => console.warn('google-cal-upsert-event (update) error:', err));
      // Sync to Microsoft Teams (fire-and-forget — skips if provider != microsoft)
      supabase.functions
        .invoke('ms-teams-upsert-event', { body: { meeting_id: meeting.id, action: 'update' } })
        .catch((err) => console.warn('ms-teams-upsert-event (update) error:', err));
      // Trigger meeting follow-ups when status changes (fire-and-forget)
      const meetingRecord = meeting as { id: string; lead_id?: string | null; google_event_id?: string; ms_meeting_id?: string };
      if ('status' in variables && variables.status && meetingRecord.lead_id) {
        supabase.functions
          .invoke('followup-enqueue', {
            body: {
              lead_id:        meetingRecord.lead_id,
              source_type:    'meeting',
              meeting_status: variables.status,
            },
          })
          .then(({ data }) => {
            const enqData = data as { enqueued?: number } | null;
            if (enqData?.enqueued && enqData.enqueued > 0) {
              console.log(`[followup-enqueue] ${enqData.enqueued} follow-up(s) de reunião agendado(s) — status=${variables.status}`);
            }
          })
          .catch((err) => console.warn('[followup-enqueue meeting] erro:', err));
      }
    },
    onError: (error: Error) => {
      console.error('Error updating meeting:', error);
      toast.error(error.message || 'Error updating meeting');
    },
  });
};

export const useDeleteAgendamento = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get meeting data before deleting (need google_event_id + user_id for calendar sync)
      const { data: meetingToDelete } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .single();

      // Sync deletion to Google Calendar / Microsoft Teams before deleting from DB
      if (meetingToDelete?.google_event_id) {
        await supabase.functions
          .invoke('google-cal-upsert-event', { body: { meeting_id: id, action: 'delete' } })
          .catch((err) => console.warn('google-cal-upsert-event (delete) error:', err));
      }
      if ((meetingToDelete as { ms_meeting_id?: string } | null)?.ms_meeting_id) {
        await supabase.functions
          .invoke('ms-teams-upsert-event', { body: { meeting_id: id, action: 'delete' } })
          .catch((err) => console.warn('ms-teams-upsert-event (delete) error:', err));
      }

      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Audit log
      await auditLogger.log({
        action: 'meeting_deleted',
        resource_type: 'meeting',
        resource_id: id,
        details: {
          lead_id: meetingToDelete?.lead_id,
          date: meetingToDelete?.date,
          status: meetingToDelete?.status
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos-simple'] });
      toast.success('Meeting deleted successfully!');
    },
    onError: (error: Error) => {
      console.error('Error deleting meeting:', error);
      toast.error(error.message || 'Error deleting meeting');
    },
  });
};
