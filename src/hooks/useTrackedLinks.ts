/**
 * useTrackedLinks — links rastreados por pessoa (indicador "link aberto" na bolha do
 * inbox) e realtime dos cliques (kanban/timeline/inbox/BI atualizam sem F5).
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { TrackedLinkRow } from '@/lib/esteira/clicks';

const db = supabase as unknown as SupabaseClient;

/** Map<messages.id, link> — só links ligados a uma mensagem. Uma query por pessoa. */
export function useTrackedLinksByPerson(peopleId?: string | null) {
  return useQuery({
    queryKey: ['tracked-links', 'person', peopleId],
    enabled: !!peopleId,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<number, TrackedLinkRow>> => {
      const { data, error } = await db
        .from('tracked_links')
        .select('id, lead_id, people_id, source, label, template_name, channel, clicks, first_clicked_at, last_clicked_at, message_id, created_at')
        .eq('people_id', peopleId)
        .not('message_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const map = new Map<number, TrackedLinkRow>();
      for (const l of (data ?? []) as TrackedLinkRow[]) if (l.message_id != null) map.set(Number(l.message_id), l);
      return map;
    },
  });
}

/** Assina INSERT em tracked_link_clicks (RLS filtra) e invalida as queries que mostram clique. */
export function useTrackedClicksRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`tracked-link-clicks-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tracked_link_clicks' }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          qc.invalidateQueries({ queryKey: ['esteira'] });
          qc.invalidateQueries({ queryKey: ['tracked-links'] });
          qc.invalidateQueries({ queryKey: ['bi-reconversao'] });
        }, 1500);
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('[tracked-link-clicks] realtime', status, err?.message ?? '');
      });
    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(channel); };
  }, [qc]);
}
