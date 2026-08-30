import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { MeetingStatus } from '@/types/meeting';

export type { MeetingStatus };

export interface AgendamentoFollowup {
  id: string;
  meeting_status: MeetingStatus;
  tipo: string;
  mensagem: string | null;
  assunto: string | null;
  template_id: string | null;
  audio_file: string | null;
  dias: number;
  horas: number;
  minutos: number;
  ativo: boolean;
  control: number | null;
  as_queue_id: string | null;
  whatsapp_template_id: string | null;
  whatsapp_template_name: string | null;
  business_hours_only: boolean;
  bh_only_last: boolean;
  created_at: string;
  updated_at: string;
}

// DB row type (inglês)
interface DbMeetingsFollowup {
  id: string;
  source: 'channel' | 'webhook';
  meeting_status: string;
  type: string;
  message: string | null;
  subject: string | null;
  template_id: string | null;
  audio_file: string | null;
  days: number;
  hours: number;
  minutes: number;
  active: boolean;
  control: number | null;
  as_queue_id: string | null;
  whatsapp_template_id: string | null;
  whatsapp_template: { name: string } | null;
  business_hours_only: boolean;
  bh_only_last: boolean;
  created_at: string;
  updated_at: string;
}

const normalizeStatus = (s: string): MeetingStatus => s as MeetingStatus;

const denormalizeStatus = (s: MeetingStatus): string => s;

/** Map UI tipo → DB channel (used by the trigger for routing) */
const tipoToChannel = (tipo: string): string => {
  switch (tipo) {
    case 'whatsapp_template':
    case 'whatsapp_texto':
    case 'whatsapp_audio':
      return 'whatsapp';
    case 'email':
    case 'email_texto':
      return 'email';
    case 'sms':
      return 'sms';
    case 'ligacao':
      return 'ligacao';
    default:
      return 'whatsapp';
  }
};

const mapDb = (r: DbMeetingsFollowup): AgendamentoFollowup => ({
  id:             r.id,
  meeting_status: normalizeStatus(r.meeting_status),
  tipo:           r.type === 'whatsapp' ? 'whatsapp_template' : r.type,
  mensagem:       r.message,
  assunto:        r.subject,
  template_id:    r.template_id,
  audio_file:     r.audio_file,
  dias:           r.days,
  horas:          r.hours,
  minutos:        r.minutes,
  ativo:          r.active,
  control:        r.control ?? null,
  as_queue_id:    r.as_queue_id ?? null,
  whatsapp_template_id:   r.whatsapp_template_id ?? null,
  whatsapp_template_name: r.whatsapp_template?.name ?? null,
  business_hours_only:    r.business_hours_only ?? false,
  bh_only_last:           r.bh_only_last ?? true,
  created_at:     r.created_at,
  updated_at:     r.updated_at,
});

export const useAgendamentosFollowups = () => {
  return useQuery({
    queryKey: ['agendamentos-followups'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('meetings_followups')
        .select('*, whatsapp_template:whatsapp_templates!whatsapp_template_id(name)')
        .eq('source', 'channel')
        .order('meeting_status', { ascending: true })
        .order('days', { ascending: true })
        .order('hours', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as DbMeetingsFollowup[]).map(mapDb);
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateAgendamentoFollowup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<AgendamentoFollowup, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await (supabase as any)
        .from('meetings_followups')
        .insert({
          source:               'channel',
          meeting_status:       denormalizeStatus(payload.meeting_status),
          type:                 payload.tipo,
          channel:              tipoToChannel(payload.tipo),
          message:              payload.mensagem,
          subject:              payload.assunto,
          template_id:          payload.template_id,
          whatsapp_template_id: payload.whatsapp_template_id || null,
          audio_file:           payload.audio_file,
          days:                 payload.dias,
          hours:                payload.horas,
          minutes:              payload.minutos,
          active:               payload.ativo,
          control:              payload.control,
          as_queue_id:          payload.as_queue_id,
          business_hours_only:  payload.business_hours_only,
          bh_only_last:         payload.bh_only_last,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos-followups'] });
      toast.success('Follow-up de agendamento criado!');
    },
    onError: () => toast.error('Erro ao criar follow-up de agendamento'),
  });
};

export const useUpdateAgendamentoFollowup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: AgendamentoFollowup) => {
      const { data, error } = await (supabase as any)
        .from('meetings_followups')
        .update({
          meeting_status:       denormalizeStatus(payload.meeting_status),
          type:                 payload.tipo,
          channel:              tipoToChannel(payload.tipo),
          message:              payload.mensagem,
          subject:              payload.assunto,
          template_id:          payload.template_id,
          whatsapp_template_id: payload.whatsapp_template_id || null,
          audio_file:           payload.audio_file,
          days:                 payload.dias,
          hours:                payload.horas,
          minutes:              payload.minutos,
          active:               payload.ativo,
          control:              payload.control,
          as_queue_id:          payload.as_queue_id,
          business_hours_only:  payload.business_hours_only,
          bh_only_last:         payload.bh_only_last,
        })
        .eq('id', id)
        .eq('source', 'channel')
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos-followups'] });
      toast.success('Follow-up de agendamento atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar follow-up de agendamento'),
  });
};

export const useDeleteAgendamentoFollowup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; tenant_id?: string }) => {
      const { error } = await (supabase as any)
        .from('meetings_followups')
        .delete()
        .eq('id', id)
        .eq('source', 'channel');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos-followups'] });
      toast.success('Follow-up de agendamento excluído!');
    },
    onError: () => toast.error('Erro ao excluir follow-up de agendamento'),
  });
};
