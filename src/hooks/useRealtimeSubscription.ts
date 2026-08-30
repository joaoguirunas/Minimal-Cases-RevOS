// Minimal realtime subscription hook
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RealtimeSubscriptionConfig {
  tenantId: string;
  type: string;
  enabled?: boolean;
}

export const useRealtimeSubscription = (config: RealtimeSubscriptionConfig) => {
  // No-op in single-tenant mode - realtime is handled per-component
  return { isConnected: true };
};
