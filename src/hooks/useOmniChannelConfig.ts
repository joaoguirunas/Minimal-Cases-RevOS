import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type OmniChannel = 'whatsapp' | 'instagram' | 'email' | 'sms' | 'telefone';

export interface OmniChannelConfig {
  id: string;
  channel: OmniChannel;
  is_active: boolean;
  display_name: string;
  credentials: Record<string, unknown>;
  settings: Record<string, unknown>;
  webhook_fallback: {
    enabled: boolean;
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    payload_template?: string;
  };
  business_hours: {
    enabled: boolean;
    timezone?: string;
    start?: string;
    end?: string;
    days?: number[];
    outside_hours_reply?: string;
  };
  created_at: string | null;
  updated_at: string | null;
}

type ChannelConfigUpdate = Partial<Omit<OmniChannelConfig, 'id' | 'channel' | 'created_at' | 'updated_at'>>;

// ── All channels ──────────────────────────────────────────────────────────────

export function useOmniChannelConfigs() {
  return useQuery({
    queryKey: ['omni-channel-configs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('omni_channel_configs')
        .select('*')
        .order('channel');
      if (error) throw error;
      return data as OmniChannelConfig[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── Single channel ────────────────────────────────────────────────────────────

export function useOmniChannelConfig(channel: OmniChannel) {
  return useQuery({
    queryKey: ['omni-channel-config', channel],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('omni_channel_configs')
        .select('*')
        .eq('channel', channel)
        .single();
      if (error) throw error;
      return data as OmniChannelConfig;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── Update channel config ─────────────────────────────────────────────────────

export function useUpdateOmniChannelConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ channel, updates }: { channel: OmniChannel; updates: ChannelConfigUpdate }) => {
      const { data, error } = await (supabase as any)
        .from('omni_channel_configs')
        .update(updates)
        .eq('channel', channel)
        .select()
        .single();
      if (error) throw error;
      return data as OmniChannelConfig;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['omni-channel-configs'] });
      queryClient.invalidateQueries({ queryKey: ['omni-channel-config', data.channel] });
    },
  });
}
