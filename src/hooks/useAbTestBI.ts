/**
 * useAbTestBI — card "Teste A/B" do BI da esteira (Task 14).
 *
 * Experimentos em andamento/pausados ou encerrados há menos de 90 dias
 * (janela em que o resultado ainda é relevante pro card), com as tabelas
 * relacionadas (assignments/toques/cliques/reconversões) agregadas por
 * `aggregateAbTest` (Task 9b) — uma leitura por experimento, não por variante.
 */

import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { aggregateAbTest, type AbConfidence, type AbVariantStats } from '@/lib/bi/abTest';
import type { AbExperiment } from './useAbExperiments';

const db = supabase as unknown as SupabaseClient;

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_EXPERIMENTS = 3;

export interface AbTestBIEntry {
  experiment: AbExperiment;
  stats: AbVariantStats[];
  confidence: AbConfidence;
}

export function useAbTestBI() {
  return useQuery({
    queryKey: ['bi-ab'],
    staleTime: 60_000,
    queryFn: async (): Promise<AbTestBIEntry[]> => {
      const cutoff = new Date(Date.now() - NINETY_DAYS_MS).toISOString();
      const { data: expData, error: expErr } = await db
        .from('esteira_ab_experiments')
        .select('*, variants:esteira_ab_variants(*)')
        .in('status', ['running', 'paused', 'finished'])
        .or(`finished_at.is.null,finished_at.gte.${cutoff}`)
        .order('created_at', { ascending: false })
        .limit(MAX_EXPERIMENTS);
      if (expErr) throw expErr;

      const experiments = ((expData ?? []) as AbExperiment[]).map((exp) => ({
        ...exp,
        variants: [...(exp.variants ?? [])].sort((a, b) => a.position - b.position),
      }));

      return Promise.all(experiments.map(async (experiment): Promise<AbTestBIEntry> => {
        const variantIds = experiment.variants.map((v) => v.id);

        const [assignmentsRes, touchesRes, linksRes, reconversionsRes] = await Promise.all([
          db.from('esteira_ab_assignments').select('variant_id, lead_id').eq('experiment_id', experiment.id).limit(10000),
          variantIds.length
            ? db.from('followup_queue').select('ab_variant_id, person_id').eq('status', 'sent').in('ab_variant_id', variantIds)
            : Promise.resolve({ data: [], error: null }),
          variantIds.length
            ? db.from('tracked_links').select('ab_variant_id, clicks').in('ab_variant_id', variantIds)
            : Promise.resolve({ data: [], error: null }),
          db.from('esteira_reconversions').select('ab_variant_id, order_total, attributed').eq('ab_experiment_id', experiment.id),
        ]);
        if (assignmentsRes.error) throw assignmentsRes.error;
        if (touchesRes.error) throw touchesRes.error;
        if (linksRes.error) throw linksRes.error;
        if (reconversionsRes.error) throw reconversionsRes.error;

        const { variants: stats, confidence } = aggregateAbTest({
          variants: experiment.variants.map((v) => ({ id: v.id, key: v.key, name: v.name, is_control: v.is_control, weight: v.weight })),
          assignments: (assignmentsRes.data ?? []) as Array<{ variant_id: string; lead_id: string }>,
          touches: (touchesRes.data ?? []) as Array<{ ab_variant_id: string | null; person_id: string | null }>,
          links: (linksRes.data ?? []) as Array<{ ab_variant_id: string | null; clicks: number }>,
          reconversions: (reconversionsRes.data ?? []) as Array<{ ab_variant_id: string | null; order_total: number | null; attributed: boolean }>,
        });

        return { experiment, stats, confidence };
      }));
    },
  });
}
