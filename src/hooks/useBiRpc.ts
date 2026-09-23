// src/hooks/useBiRpc.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
export function useBiRpc<T>(fn: 'bi_overview' | 'bi_recuperacao' | 'bi_esteira', args: Record<string, string>) {
  return useQuery({
    queryKey: ['bi', fn, args],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(fn, args);
      if (error) throw error;
      return data as T;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev, // troca de período não pisca
  });
}
