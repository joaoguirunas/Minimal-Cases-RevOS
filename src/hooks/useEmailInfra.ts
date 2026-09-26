// src/hooks/useEmailInfra.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmailStats { sent: number; delivered: number; opened: number; bounced: number; complained: number; failed: number; suppressed: number }
export interface DnsRecord { record: string; name: string; type: string; value: string; status: string }
export interface EmailInfraStatus {
  ok: boolean; has_key: boolean; share_pct: number;
  domain: { name: string; status: string; records: DnsRecord[] } | null;
  guard: { tripped_at: string; reason: string } | null;
  stats24: Record<string, EmailStats>; stats7d: Record<string, EmailStats>;
}
async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('email-infra', { body });
  if (error) throw error;
  return data as T;
}
export function useEmailInfra() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['email-infra'], queryFn: () => call<EmailInfraStatus>({ action: 'status' }), staleTime: 30_000 });
  const refresh = () => qc.invalidateQueries({ queryKey: ['email-infra'] });
  return {
    ...q,
    setShare: async (pct: number) => { const r = await call<{ ok: boolean; error?: string }>({ action: 'set_share', pct }); await refresh(); return r; },
    testSend: (to: string, templateId: string) => call<{ ok: boolean; status: string; error?: string }>({ action: 'test_send', to, template_id: templateId }),
    resubscribe: async (email: string, reason: string) => { const r = await call<{ ok: boolean }>({ action: 'resubscribe', email, reason }); await refresh(); return r; },
  };
}
