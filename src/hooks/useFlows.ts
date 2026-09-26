// src/hooks/useFlows.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export async function flowApi<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('flow-admin', { body });
  if (error) throw error;
  return data as T;
}
export interface FlowRow { id: string; name: string; status: string; trigger_type: string; trigger_config: Record<string, unknown>; updated_at: string; active_runs: number; sent_7d: number; sales_7d: number }
export interface NodeStats { entered: number; waiting: number; enqueued: number; would_send: number; sent: number; clicks: number; sales: number; revenue: number }
export interface FlowFull { id: string; name: string; status: string; trigger_type: string; trigger_config: Record<string, unknown>; exit_on_purchase: boolean; reentry: string; live_version_id: string | null; draft_graph: { nodes: unknown[]; edges: unknown[] } }
export interface Catalog { wa_templates: { id_template: string; name: string; status: string; body: string }[]; email_templates: { id: string; name: string; subject: string }[]; stages: { id: string; name: string; pipeline: string }[] }

export const useFlows = () => useQuery({ queryKey: ['flows'], queryFn: async () => (await flowApi<{ flows: FlowRow[] }>({ action: 'list' })).flows, staleTime: 30_000 });
export const useFlow = (id?: string) => useQuery({
  queryKey: ['flow', id], enabled: !!id, staleTime: 15_000,
  queryFn: () => flowApi<{ flow: FlowFull; versions: { id: string; version: number; published_at: string }[]; stats: Record<string, NodeStats> }>({ action: 'get', id }),
});
export const useFlowCatalog = () => useQuery({ queryKey: ['flow-catalog'], staleTime: 300_000, queryFn: () => flowApi<Catalog>({ action: 'catalog' }) });
export function useFlowInvalidate() { const qc = useQueryClient(); return (id?: string) => { qc.invalidateQueries({ queryKey: ['flows'] }); if (id) qc.invalidateQueries({ queryKey: ['flow', id] }); }; }
