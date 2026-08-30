import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CRBenchmarkValues {
  cr1: number;
  cr2: number;
  cr3: number;
  cr4: number;
  cr5: number;
}

const DEFAULT_BENCHMARKS: CRBenchmarkValues = {
  cr1: 20,
  cr2: 40,
  cr3: 65,
  cr4: 25,
  cr5: 80,
};

const QUERY_KEY = ['cr-benchmarks'];

export function useCRBenchmarks() {
  const queryClient = useQueryClient();

  const { data: benchmarks, isLoading } = useQuery<CRBenchmarkValues>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bi_settings')
        .select('cr_benchmarks')
        .eq('singleton', true)
        .maybeSingle();
      if (error) {
        console.error('[cr_benchmarks] SELECT error:', error);
        return DEFAULT_BENCHMARKS;
      }
      if (!data?.cr_benchmarks || typeof data.cr_benchmarks !== 'object') {
        return DEFAULT_BENCHMARKS;
      }
      const raw = data.cr_benchmarks as Record<string, unknown>;
      return {
        cr1: typeof raw.cr1 === 'number' ? raw.cr1 : DEFAULT_BENCHMARKS.cr1,
        cr2: typeof raw.cr2 === 'number' ? raw.cr2 : DEFAULT_BENCHMARKS.cr2,
        cr3: typeof raw.cr3 === 'number' ? raw.cr3 : DEFAULT_BENCHMARKS.cr3,
        cr4: typeof raw.cr4 === 'number' ? raw.cr4 : DEFAULT_BENCHMARKS.cr4,
        cr5: typeof raw.cr5 === 'number' ? raw.cr5 : DEFAULT_BENCHMARKS.cr5,
      };
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const saveBenchmarks = useMutation({
    mutationFn: async (values: CRBenchmarkValues) => {
      const { error } = await supabase
        .from('bi_settings')
        .update({
          cr_benchmarks: values as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq('singleton', true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['bi-pro-revops'] });
      toast.success('Benchmarks atualizados');
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string })?.message ?? 'Erro desconhecido';
      toast.error(`Erro ao salvar benchmarks: ${msg}`);
    },
  });

  return {
    benchmarks: benchmarks ?? DEFAULT_BENCHMARKS,
    isLoading,
    saveBenchmarks,
    DEFAULT_BENCHMARKS,
  };
}
