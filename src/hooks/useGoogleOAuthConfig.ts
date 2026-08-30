import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useGoogleOAuthConfig() {
  return useQuery<{ google_client_id: string | null } | null>({
    queryKey: ['google-oauth-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('settings')
        .select('google_client_id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return data ?? null;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
