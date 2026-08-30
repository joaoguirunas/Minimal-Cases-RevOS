import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BIProSettings {
  id: string;
  meta_app_id: string | null;
  meta_app_secret: string | null;
  google_developer_token: string | null;
  updated_at: string;
}

const QUERY_KEY = ['bi-pro-settings'];

export function useBIProSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error: queryError } = useQuery<BIProSettings | null>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bi_settings')
        .select('*')
        .eq('singleton', true)
        .maybeSingle();
      if (error) {
        console.error('[bi_settings] SELECT error:', error);
        throw error;
      }
      return (data as unknown as BIProSettings) ?? null;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const saveSettings = useMutation({
    mutationFn: async (input: Partial<Omit<BIProSettings, 'id' | 'updated_at'>>) => {
      const payload = {
        ...input,
        singleton: true as const,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('bi_settings')
        .upsert(payload, { onConflict: 'singleton' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['google-oauth-config'] });
      toast.success('Configurações salvas');
    },
    onError: (err: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.message ?? (err as any)?.details ?? 'Erro desconhecido';
      toast.error(`Erro ao salvar: ${msg}`);
    },
  });

  return { settings, isLoading, queryError, saveSettings };
}
