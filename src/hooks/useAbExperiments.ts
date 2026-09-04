/**
 * useAbExperiments — testes A/B de regras de follow-up por pipeline (AB-1).
 *
 * Tabelas novas (Task 0): esteira_ab_experiments, esteira_ab_variants.
 * Ainda não estão em src/integrations/supabase/types.ts — usa o client
 * "untyped" (`db`), como useReconversaoBI.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const db = supabase as unknown as SupabaseClient;

export type AbStatus = 'draft' | 'running' | 'paused' | 'finished';

export interface AbVariant {
  id: string;
  experiment_id: string;
  key: string;
  name: string;
  weight: number;
  is_control: boolean;
  position: number;
}

export interface AbExperiment {
  id: string;
  pipeline_id: string;
  name: string;
  hypothesis: string | null;
  status: AbStatus;
  started_at: string | null;
  paused_at: string | null;
  finished_at: string | null;
  winner_variant_id: string | null;
  created_at: string;
  variants: AbVariant[];
}

const invalidateAbExperiments = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['ab-experiments'] });
};

// ── Queries ────────────────────────────────────────────────────────────────

export function useAbExperiments(pipelineId?: string) {
  return useQuery({
    queryKey: ['ab-experiments', pipelineId],
    queryFn: async (): Promise<AbExperiment[]> => {
      if (!pipelineId) return [];
      const { data, error } = await db
        .from('esteira_ab_experiments')
        .select('*, variants:esteira_ab_variants(*)')
        .eq('pipeline_id', pipelineId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as AbExperiment[]).map((exp) => ({
        ...exp,
        variants: [...(exp.variants ?? [])].sort((a, b) => a.position - b.position),
      }));
    },
    enabled: !!pipelineId,
    staleTime: 60 * 1000,
  });
}

export function useLiveAbExperiment(pipelineId?: string) {
  const { data: experiments, ...rest } = useAbExperiments(pipelineId);
  const live = (experiments ?? []).find((e) => e.status === 'running' || e.status === 'paused') ?? null;
  return { ...rest, data: live };
}

export function useAbAssignmentCounts(experimentId?: string) {
  return useQuery({
    queryKey: ['ab-assignment-counts', experimentId],
    queryFn: async (): Promise<Record<string, number>> => {
      if (!experimentId) return {};
      const { data, error } = await db
        .from('esteira_ab_assignments')
        .select('variant_id')
        .eq('experiment_id', experimentId)
        .limit(10000);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as Array<{ variant_id: string }>) {
        counts[row.variant_id] = (counts[row.variant_id] ?? 0) + 1;
      }
      return counts;
    },
    enabled: !!experimentId,
    staleTime: 30 * 1000,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

interface CreateAbExperimentInput {
  pipeline_id: string;
  name: string;
  hypothesis?: string | null;
  variants: Array<{ key: string; name: string; weight: number; is_control: boolean }>;
}

export function useCreateAbExperiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAbExperimentInput) => {
      const { data: experiment, error: expError } = await db
        .from('esteira_ab_experiments')
        .insert({
          pipeline_id: input.pipeline_id,
          name: input.name,
          hypothesis: input.hypothesis ?? null,
          status: 'draft',
        })
        .select()
        .single();
      if (expError) throw expError;

      const variantsPayload = input.variants.map((v, index) => ({
        experiment_id: (experiment as { id: string }).id,
        key: v.key,
        name: v.name,
        weight: v.weight,
        is_control: v.is_control,
        position: index,
      }));
      const { error: varError } = await db.from('esteira_ab_variants').insert(variantsPayload);
      if (varError) throw varError;

      return experiment;
    },
    onSuccess: () => { invalidateAbExperiments(qc); toast.success('Teste criado'); },
    onError: () => toast.error('Erro ao criar teste'),
  });
}

interface UpdateAbExperimentInput {
  id: string;
  name?: string;
  hypothesis?: string | null;
  status?: AbStatus;
}

export function useUpdateAbExperiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, ...rest }: UpdateAbExperimentInput) => {
      const patch: Record<string, unknown> = { ...rest };
      if (status !== undefined) {
        patch.status = status;
        if (status === 'running') {
          const { data: current } = await db.from('esteira_ab_experiments').select('started_at').eq('id', id).single();
          if (!(current as { started_at: string | null } | null)?.started_at) patch.started_at = new Date().toISOString();
          patch.paused_at = null;
        } else if (status === 'paused') {
          patch.paused_at = new Date().toISOString();
        }
      }
      const { error } = await db.from('esteira_ab_experiments').update(patch).eq('id', id);
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      invalidateAbExperiments(qc);
      if (status === 'running') toast.success('Teste iniciado');
      else if (status === 'paused') toast.success('Teste pausado');
    },
    onError: () => toast.error('Erro ao atualizar teste'),
  });
}

interface UpdateAbVariantInput {
  id: string;
  name?: string;
  weight?: number;
}

export function useUpdateAbVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateAbVariantInput) => {
      const { error } = await db.from('esteira_ab_variants').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAbExperiments(qc),
    onError: () => toast.error('Erro ao atualizar variante'),
  });
}

export function usePromoteAbWinner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ experimentId, winnerVariantId }: { experimentId: string; winnerVariantId: string }) => {
      const { error } = await db.rpc('promote_ab_winner', { p_experiment_id: experimentId, p_winner: winnerVariantId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ab-experiments'] });
      qc.invalidateQueries({ queryKey: ['all-followups'] });
      qc.invalidateQueries({ queryKey: ['stage-followups'] });
      toast.success('Vencedora promovida — regras da variante viraram comuns');
    },
    onError: () => toast.error('Erro ao promover vencedora'),
  });
}

export function useFinishAbExperiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (experimentId: string) => {
      const { error } = await db.rpc('finish_ab_experiment', { p_experiment_id: experimentId });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAbExperiments(qc); toast.success('Teste encerrado'); },
    onError: () => toast.error('Erro ao encerrar teste'),
  });
}
