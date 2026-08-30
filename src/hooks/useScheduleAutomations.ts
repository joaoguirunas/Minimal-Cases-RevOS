import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TriggerStatus = 'criado' | 'confirmado' | 'cancelado' | 'reagendado' | 'realizado' | 'no_show';

export interface ScheduleAutomation {
  id: string;
  trigger_status: TriggerStatus;
  pipeline_id: string;
  target_pipeline_id: string;
  target_stage_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ScheduleAutomationUpsert = Omit<ScheduleAutomation, 'id' | 'created_at' | 'updated_at'>;

// ── Queries ───────────────────────────────────────────────────────────────────

const QK = 'schedule_automations';

export function useScheduleAutomations() {
  return useQuery({
    queryKey: [QK],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('schedule_automations')
        .select('*')
        .order('pipeline_id')
        .order('trigger_status');
      if (error) throw error;
      return data as ScheduleAutomation[];
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateScheduleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ScheduleAutomationUpsert) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('schedule_automations')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as ScheduleAutomation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useUpdateScheduleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScheduleAutomation> & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('schedule_automations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ScheduleAutomation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useDeleteScheduleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('schedule_automations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}
