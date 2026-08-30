import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type FollowupCanal =
  | 'whatsapp_template'
  | 'whatsapp_texto'
  | 'email'
  | 'sms'
  | 'ligacao';

export interface StageFollowup {
  id: string;
  leads_stages_id: string | null;
  score_matrix_id: string | null;
  target_stage_id: string | null;
  dias: number;
  horas: number;
  minutos: number;
  tipo: FollowupCanal;
  mensagem: string | null;
  assunto: string | null;
  arquivo_audio: string | null;
  template_id: string | null;
  whatsapp_template_id: string | null;
  whatsapp_template_name: string | null;
  as_queue_id: string | null;
  ativo: boolean;
  control: number | null;
  business_hours_only: boolean;
  bh_only_last: boolean;
  created_at: string;
  updated_at: string;
}

// Tipo do banco (inglês)
interface DbFollowup {
  id: string;
  leads_stages_id: string | null;
  score_matrix_id: string | null;
  target_stage_id: string | null;
  days: number;
  hours: number;
  minutes: number;
  type: string;
  message: string | null;
  subject: string | null;
  audio_file: string | null;
  template_id: string | null;
  whatsapp_template_id: string | null;
  whatsapp_template?: { name: string } | null; // not joined — always null
  as_queue_id: string | null;
  active: boolean;
  control: number | null;
  business_hours_only: boolean;
  bh_only_last: boolean;
  created_at: string;
  updated_at: string;
}

const mapDbToFollowup = (d: DbFollowup): StageFollowup => ({
  id:                     d.id,
  leads_stages_id:        d.leads_stages_id,
  score_matrix_id:        d.score_matrix_id,
  target_stage_id:        d.target_stage_id,
  dias:                   d.days,
  horas:                  d.hours,
  minutos:                d.minutes,
  tipo:                   d.type as FollowupCanal,
  mensagem:               d.message,
  assunto:                d.subject,
  arquivo_audio:          d.audio_file,
  template_id:            d.template_id,
  whatsapp_template_id:   d.whatsapp_template_id,
  whatsapp_template_name: d.whatsapp_template?.name ?? null,
  as_queue_id:            d.as_queue_id,
  ativo:                  d.active,
  control:                d.control,
  business_hours_only:    d.business_hours_only ?? false,
  bh_only_last:           d.bh_only_last ?? true,
  created_at:             d.created_at,
  updated_at:             d.updated_at,
});

// ── Queries ────────────────────────────────────────────────────────────────

export const useStageFollowups = (stageId?: string) => {
  return useQuery({
    queryKey: ['stage-followups', stageId],
    queryFn: async () => {
      if (!stageId) return [];
      const { data, error } = await (supabase as any)
        .from('leads_stages_followups')
        .select('*')
        .eq('leads_stages_id', stageId)
        .order('days', { ascending: true })
        .order('hours', { ascending: true });
      if (error) throw error;
      return (data as DbFollowup[]).map(mapDbToFollowup);
    },
    enabled: !!stageId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useAllFollowups = (filters?: { stageId?: string; scoreMatrixId?: string; active?: boolean }) => {
  return useQuery({
    queryKey: ['all-followups', filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from('leads_stages_followups')
        .select('*')
        .order('days', { ascending: true })
        .order('hours', { ascending: true });
      if (filters?.stageId)       query = query.eq('leads_stages_id', filters.stageId);
      if (filters?.scoreMatrixId) query = query.eq('score_matrix_id', filters.scoreMatrixId);
      if (filters?.active !== undefined) query = query.eq('active', filters.active);
      const { data, error } = await query;
      if (error) throw error;
      return (data as DbFollowup[]).map(mapDbToFollowup);
    },
    staleTime: 5 * 60 * 1000,
  });
};

// ── Mutations ──────────────────────────────────────────────────────────────

interface FollowupMutationInput {
  stage_id?: string;
  score_matrix_id?: string;
  dias: number;
  horas: number;
  minutos: number;
  tipo: FollowupCanal;
  mensagem?: string | null;
  assunto?: string | null;
  arquivo_audio?: string | null;
  template_id?: string | null;
  whatsapp_template_id?: string | null;
  as_queue_id?: string | null;
  ativo: boolean;
  target_stage_id?: string | null;
  control?: number | null;
  business_hours_only?: boolean;
  bh_only_last?: boolean;
}

const buildInsert = (d: FollowupMutationInput) => ({
  leads_stages_id:      d.stage_id ?? null,
  score_matrix_id:      d.score_matrix_id ?? null,
  target_stage_id:      d.target_stage_id ?? null,
  days:                 d.dias,
  hours:                d.horas,
  minutes:              d.minutos,
  type:                 d.tipo,
  message:              d.mensagem ?? null,
  subject:              d.assunto ?? null,
  audio_file:           d.arquivo_audio ?? null,
  template_id:          d.template_id ?? null,
  whatsapp_template_id: d.whatsapp_template_id ?? null,
  as_queue_id:          d.as_queue_id ?? null,
  active:               d.ativo,
  control:              d.control ?? null,
  business_hours_only:  d.business_hours_only ?? false,
  bh_only_last:         d.bh_only_last ?? true,
});

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['stage-followups'] });
  qc.invalidateQueries({ queryKey: ['all-followups'] });
};

export const useCreateFollowup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: FollowupMutationInput) => {
      const { data, error } = await (supabase as any)
        .from('leads_stages_followups')
        .insert(buildInsert(input))
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidateAll(queryClient); toast.success('Follow-up criado!'); },
    onError:   () => toast.error('Erro ao criar follow-up'),
  });
};

export const useUpdateFollowup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: FollowupMutationInput & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('leads_stages_followups')
        .update(buildInsert(input))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidateAll(queryClient); toast.success('Follow-up atualizado!'); },
    onError:   () => toast.error('Erro ao atualizar follow-up'),
  });
};

export const useDeleteFollowup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await (supabase as any)
        .from('leads_stages_followups')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(queryClient); toast.success('Follow-up excluído!'); },
    onError:   () => toast.error('Erro ao excluir follow-up'),
  });
};
