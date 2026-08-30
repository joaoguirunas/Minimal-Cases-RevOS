import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ZoomConnection {
  id: string;
  user_id: string;
  zoom_user_id: string;
  zoom_email: string;
  zoom_token_expires_at: string;
  provider: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = (userId: string) => ['zoom-connection', userId] as const;

export function useZoomConnection(userId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY(userId ?? ''),
    queryFn: async (): Promise<ZoomConnection | null> => {
      if (!userId) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('user_calendar_connections')
        .select('id, user_id, zoom_user_id, zoom_email, zoom_token_expires_at, provider, is_active, created_at, updated_at')
        .eq('user_id', userId)
        .eq('provider', 'zoom')
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Usuário não encontrado');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('user_calendar_connections')
        .delete()
        .eq('user_id', userId)
        .eq('provider', 'zoom');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY(userId ?? '') });
    },
  });

  return { ...query, disconnect };
}
