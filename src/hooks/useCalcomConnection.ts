import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CalcomConnection {
  id: string;
  user_id: string;
  calcom_username: string | null;
  default_event_type_id: number | null;
  default_event_type_slug: string | null;
  default_booking_url: string | null;
  use_calcom_booking_link: boolean;
  sync_booking: boolean;
  is_active: boolean;
  created_at: string;
}

const calcomKey = (uid?: string) => ['calcom-connection', uid] as const;

export const useCalcomConnection = () => {
  const { user } = useAuth();
  const crmUserId = user?.profile?.id;

  return useQuery({
    queryKey: calcomKey(crmUserId),
    queryFn: async (): Promise<CalcomConnection | null> => {
      if (!crmUserId) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('user_calcom_connections')
        .select('id, user_id, calcom_username, default_event_type_id, default_event_type_slug, default_booking_url, use_calcom_booking_link, sync_booking, is_active, created_at')
        .eq('user_id', crmUserId)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!crmUserId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useDisconnectCalcom = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const crmUserId = user?.profile?.id;

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('calcom-disconnect');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calcomKey(crmUserId) });
    },
  });
};

export const usePatchCalcomSettings = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const crmUserId = user?.profile?.id;
  const key = calcomKey(crmUserId);

  return useMutation({
    mutationFn: async (patch: { use_calcom_booking_link?: boolean; sync_booking?: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('user_calcom_connections')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('user_id', crmUserId);
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<CalcomConnection | null>(key);
      queryClient.setQueryData<CalcomConnection | null>(key, old => old ? { ...old, ...patch } : old);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(key, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
};
