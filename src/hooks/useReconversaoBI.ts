/**
 * useReconversaoBI — números exatos da esteira de recuperação (BI-REC-2).
 *
 * Fonte da verdade: esteira_reconversions (gravada pelo yampi-process-event no
 * pedido pago, com a foto dos toques). Complementos: followup_queue (toques
 * enviados no período) e leads da esteira (base tocável).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

const db = supabase as unknown as SupabaseClient;

export interface ReconversionRow {
  id: string;
  order_id: string;
  people_id: string | null;
  lead_id: string | null;
  order_total: number | null;
  paid_at: string;
  last_touch_at: string | null;
  touches_email: number;
  touches_whatsapp: number;
  touches_sms: number;
  touches_total: number;
  hours_since_last_touch: number | null;
  attributed: boolean;
  attribution_level: 'cupom' | 'clique' | 'janela' | null;
  coupon_code: string | null;
  pessoa?: { name: string | null } | null;
}

export interface ReconversaoBI {
  // KPIs
  leadsTocados: number;
  touchesSent: { email: number; whatsapp: number; sms: number; total: number };
  reconvertidos: number;
  organicos: number;
  porNivel: { cupom: number; clique: number; janela: number };
  provaForte: number; // cupom + clique
  taxaReconversao: number | null; // attributed / leads tocados
  receitaRecuperada: number;
  ticketMedio: number | null;
  horasMediasAteConverter: number | null;
  // Série diária
  porDia: Array<{ dia: string; reconversoes: number; receita: number }>;
  // Tabela
  rows: ReconversionRow[];
}

function isoDay(d: string): string {
  return d.slice(0, 10);
}

export function useReconversaoBI(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['bi-reconversao', dateFrom, dateTo],
    staleTime: 60_000,
    queryFn: async (): Promise<ReconversaoBI> => {
      const from = dateFrom ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
      const to = dateTo ?? new Date().toISOString();

      // ── Reconversões do período ──────────────────────────────────────────
      const { data: recData, error: recErr } = await db
        .from('esteira_reconversions')
        .select('*, pessoa:clients_people(name)')
        .gte('paid_at', from)
        .lte('paid_at', to)
        .order('paid_at', { ascending: false })
        .limit(500);
      if (recErr) throw recErr;
      const all = (recData ?? []) as ReconversionRow[];
      const attributed = all.filter((r) => r.attributed);
      const organicos = all.length - attributed.length;
      const porNivel = {
        cupom: attributed.filter((r) => r.attribution_level === 'cupom').length,
        clique: attributed.filter((r) => r.attribution_level === 'clique').length,
        janela: attributed.filter((r) => r.attribution_level === 'janela').length,
      };

      // ── Toques enviados no período (por canal) + leads tocados ───────────
      const { data: touchData, error: tErr } = await db
        .from('followup_queue')
        .select('channel, person_id')
        .eq('status', 'sent')
        .gte('fired_at', from)
        .lte('fired_at', to)
        .limit(10000);
      if (tErr) throw tErr;
      const touches = { email: 0, whatsapp: 0, sms: 0, total: 0 };
      const pessoasTocadas = new Set<string>();
      for (const t of (touchData ?? []) as Array<{ channel: string; person_id: string | null }>) {
        if (t.channel === 'email') touches.email++;
        else if (t.channel === 'sms') touches.sms++;
        else touches.whatsapp++;
        touches.total++;
        if (t.person_id) pessoasTocadas.add(t.person_id);
      }

      // ── Agregados ────────────────────────────────────────────────────────
      const receita = attributed.reduce((acc, r) => acc + (r.order_total ?? 0), 0);
      const comHoras = attributed.filter((r) => r.hours_since_last_touch !== null);
      const horasMedias = comHoras.length > 0
        ? comHoras.reduce((a, r) => a + (r.hours_since_last_touch ?? 0), 0) / comHoras.length
        : null;

      const porDiaMap = new Map<string, { reconversoes: number; receita: number }>();
      for (const r of attributed) {
        const d = isoDay(r.paid_at);
        const cur = porDiaMap.get(d) ?? { reconversoes: 0, receita: 0 };
        cur.reconversoes++;
        cur.receita += r.order_total ?? 0;
        porDiaMap.set(d, cur);
      }
      const porDia = [...porDiaMap.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([dia, v]) => ({ dia, ...v }));

      return {
        leadsTocados: pessoasTocadas.size,
        touchesSent: touches,
        reconvertidos: attributed.length,
        organicos,
        porNivel,
        provaForte: porNivel.cupom + porNivel.clique,
        taxaReconversao: pessoasTocadas.size > 0 ? attributed.length / pessoasTocadas.size : null,
        receitaRecuperada: receita,
        ticketMedio: attributed.length > 0 ? receita / attributed.length : null,
        horasMediasAteConverter: horasMedias,
        porDia,
        rows: all,
      };
    },
  });
}
