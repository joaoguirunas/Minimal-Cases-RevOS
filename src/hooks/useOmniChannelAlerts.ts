import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OmniChannel } from '@/hooks/useOmniChannelConfig';

export interface OmniChannelAlert {
  id: string;
  channel: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  details: Record<string, unknown>;
  resolved_at: string | null;
  created_at: string;
}

/**
 * Fetch recent alerts for a specific channel.
 * Used by MegaConfig components to show health badges.
 */
export function useOmniChannelAlerts(channel: OmniChannel, limit = 5) {
  return useQuery({
    queryKey: ['omni-channel-alerts', channel, limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('omni_channel_alerts')
        .select('*')
        .eq('channel', channel)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as OmniChannelAlert[];
    },
    staleTime: 2 * 60 * 1000, // 2 min — alerts change infrequently
  });
}

/**
 * Derive token status from Instagram channel alerts + config.
 * Returns a status object for the token health badge.
 */
export function useInstagramTokenStatus() {
  return useQuery({
    queryKey: ['instagram-token-status'],
    queryFn: async () => {
      // Get current config for token_expires_at
      const { data: config } = await (supabase as any)
        .from('omni_channel_configs')
        .select('credentials')
        .eq('channel', 'instagram')
        .single();

      const credentials = (config?.credentials ?? {}) as Record<string, string>;
      const tokenExpiresAt = credentials.token_expires_at
        ? new Date(credentials.token_expires_at)
        : null;

      // Get latest token-related alert
      const { data: alerts } = await (supabase as any)
        .from('omni_channel_alerts')
        .select('*')
        .eq('channel', 'instagram')
        .in('alert_type', ['token_refreshed', 'token_refresh_failed', 'token_missing'])
        .order('created_at', { ascending: false })
        .limit(1);

      const latestAlert = (alerts as OmniChannelAlert[] | null)?.[0] ?? null;
      const now = new Date();

      // Determine status
      if (!credentials.access_token) {
        return { status: 'missing' as const, label: 'Token não configurado', color: 'red' as const, expiresAt: null, latestAlert };
      }

      if (tokenExpiresAt && tokenExpiresAt < now) {
        return { status: 'expired' as const, label: 'Token expirado', color: 'red' as const, expiresAt: tokenExpiresAt, latestAlert };
      }

      const daysRemaining = tokenExpiresAt
        ? Math.round((tokenExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      if (daysRemaining !== null && daysRemaining <= 7) {
        return { status: 'expiring' as const, label: `Expira em ${daysRemaining}d`, color: 'yellow' as const, expiresAt: tokenExpiresAt, latestAlert };
      }

      if (latestAlert?.alert_type === 'token_refresh_failed') {
        return { status: 'error' as const, label: 'Erro na renovação', color: 'red' as const, expiresAt: tokenExpiresAt, latestAlert };
      }

      return {
        status: 'healthy' as const,
        label: daysRemaining ? `Válido (${daysRemaining}d)` : 'Conectado',
        color: 'green' as const,
        expiresAt: tokenExpiresAt,
        latestAlert,
      };
    },
    staleTime: 2 * 60 * 1000,
  });
}
