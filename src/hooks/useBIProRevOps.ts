import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildDateFilter } from '@/hooks/bipro-date-utils';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface RevOpsFunnelStep {
  key: 'lead' | 'mql' | 'sql' | 'sal' | 'win' | 'commit';
  label: string;
  count: number;
  cr: number;          // conversion rate from previous step (%)
  dropCount: number;   // lost between previous → this step
  dropRate: number;    // % dropped
}

export interface RevOpsCRBenchmark {
  cr: number;
  status: 'good' | 'medium' | 'bad';
  diagnosis: string[];
}

export interface RevOpsByCloser {
  userId: string;
  name: string;
  sal: number;
  win: number;
  cr4: number;
  ticketMedio: number;
  cicloMedioSalWin: number | null;
}

export interface RevOpsByCampaign {
  campaign: string;
  leads: number;
  mql: number;
  sql: number;
  sal: number;
  win: number;
  cr1: number;
  cr2: number;
  cr4: number;
}

export interface RevOpsEvolutionPoint {
  week: string;   // ISO week label "YYYY-WNN"
  cr1: number;
  cr2: number;
  cr3: number;
  cr4: number;
  leads: number;
}

export interface BIProRevOpsData {
  funnel: RevOpsFunnelStep[];
  crs: {
    cr1: number; cr2: number; cr3: number; cr4: number; cr5: number;
  };
  benchmarks: {
    cr1: RevOpsCRBenchmark;
    cr2: RevOpsCRBenchmark;
    cr3: RevOpsCRBenchmark;
    cr4: RevOpsCRBenchmark;
    cr5: RevOpsCRBenchmark;
  };
  byCloser: RevOpsByCloser[];
  byCampaign: RevOpsByCampaign[];
  evolution: RevOpsEvolutionPoint[];
}

export interface CRBenchmarkOverrides {
  cr1?: number;
  cr2?: number;
  cr3?: number;
  cr4?: number;
  cr5?: number;
}

export interface UseBIProRevOpsOptions {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  pipelineId?: string;
  scoreFilter?: number[];
  crBenchmarkOverrides?: CRBenchmarkOverrides;
}

// ─── Benchmark thresholds & diagnosis (from CEREBRO sheet) ───────────────────

const BENCHMARKS = {
  cr1: { good: 20, medium: 10 },  // Lead → MQL
  cr2: { good: 40, medium: 20 },  // MQL → SQL
  cr3: { good: 65, medium: 40 },  // SQL → SAL (show rate)
  cr4: { good: 25, medium: 12 },  // SAL → WIN
  cr5: { good: 80, medium: 50 },  // WIN → COMMIT
};

const DIAGNOSIS: Record<string, Record<'bad' | 'medium', string[]>> = {
  cr1: {
    bad: [
      'Critério MQL muito exigente? Score threshold alto demais?',
      'UTMs atraindo curiosos (promessa/sonho) em vez de intenção real (dor/ação)?',
      'Segmentação/ICP frouxa — público amplo ou lookalike errado?',
      'Formulário/CTA com fricção alta — taxa de drop no formulário?',
    ],
    medium: [
      'Criativos alinhados com o ICP? Revisar oferta vs público.',
      'Tracking correto? MQL carimbado sem duplicidade ou eventos faltando?',
    ],
  },
  cr2: {
    bad: [
      'SLA de primeiro contato estourado — contato chegou tarde demais?',
      'Mensagem/roteiro fraco — não converte intenção em conversa?',
      'SDR qualificando em demasia e perdendo timing de ação?',
      'Cadência de follow-up muito curta ou inexistente?',
    ],
    medium: [
      'MQL é "curioso" — definição de MQL está frouxa?',
      'Score vs métricas: qual subscore responde mais?',
    ],
  },
  cr3: {
    bad: [
      'Closer premium não está abastecido? Slots abertos para a semana?',
      'Critério SAL confuso — vendas rejeita por agenda, não por qualidade?',
      'Desalinhamento de ICP entre Marketing, SDR e Vendas?',
      'SQL está virando só "reunião marcada" sem intenção real?',
    ],
    medium: [
      'Quantos avançaram para R2 ou Proposta? Closer precisa de apoio?',
      'Closer mais tempo sem agendamento — rotatividade de leads?',
    ],
  },
  cr4: {
    bad: [
      'Script de objeções não padronizado entre closers?',
      'Follow-up pós-reunião fraco — closer sumiu após SAL?',
      'Preço/ancoragem errada ou descontos caóticos sem governança?',
      'Qualificação SAL fraca — closer está aceitando lead ruim?',
    ],
    medium: [
      'Pipeline coverage vs meta: cobertura suficiente para atingir a meta?',
      'Perdas por motivo: qual o motivo de perda mais recorrente?',
    ],
  },
  cr5: {
    bad: [
      'Contrato assinado mas receita não realizada — o que falta para pagar?',
      'Mix de produto mudou? Muitas vendas pequenas (ICP errado)?',
      'Desconto aplicado corroendo a receita comprometida?',
    ],
    medium: [
      'Acompanhar ticket médio vs valor tabela — desconto médio está subindo?',
    ],
  },
};

function buildBenchmark(
  key: 'cr1' | 'cr2' | 'cr3' | 'cr4' | 'cr5',
  value: number
): RevOpsCRBenchmark {
  const { good, medium } = BENCHMARKS[key];
  const status = value >= good ? 'good' : value >= medium ? 'medium' : 'bad';
  const diagnosis =
    status === 'bad'
      ? DIAGNOSIS[key].bad
      : status === 'medium'
      ? DIAGNOSIS[key].medium
      : [];
  return { cr: value, status, diagnosis };
}

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7
  );
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBIProRevOps(options: UseBIProRevOpsOptions = {}) {
  const { period = 'month', dateFrom, dateTo, pipelineId, scoreFilter, crBenchmarkOverrides } = options;

  const dateFilter = useMemo(
    () => buildDateFilter(period, dateFrom, dateTo),
    [period, dateFrom, dateTo]
  );

  const queryKey = ['bi-pro-revops', period, dateFrom, dateTo, pipelineId, scoreFilter, crBenchmarkOverrides];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<BIProRevOpsData> => {
      let leadsQ = supabase
        .from('leads')
        .select(
          'id, value, status, created_at, updated_at, won_at, user_id, utm_campaign, utm_source, leads_stages_id, leads_stages(id, leads_pipelines_id)'
        );
      if (scoreFilter && scoreFilter.length > 0) {
        leadsQ = leadsQ
          .select('id, value, status, created_at, updated_at, won_at, user_id, utm_campaign, utm_source, leads_stages_id, leads_stages(id, leads_pipelines_id), clients_people!inner(score)')
          .in('clients_people.score', scoreFilter);
      }
      if (dateFilter) {
        leadsQ = leadsQ
          .gte('created_at', dateFilter.from)
          .lte('created_at', dateFilter.to);
      }

      // Meetings: SQL = any meeting (not cancelled), SAL = compareceu
      let meetingsQ = supabase
        .from('meetings')
        .select('id, lead_id, user_id, status, created_at');
      if (dateFilter) {
        meetingsQ = meetingsQ
          .gte('created_at', dateFilter.from)
          .lte('created_at', dateFilter.to);
      }

      const usersQ = supabase.from('settings_users').select('id, name');

      const [leadsResult, meetingsResult, usersResult] = await Promise.all([
        leadsQ, meetingsQ, usersQ,
      ]);

      type LeadRow = {
        id: string;
        value: number | null;
        status: string | null;
        created_at: string | null;
        updated_at: string | null;
        won_at: string | null;
        user_id: string | null;
        utm_campaign: string | null;
        utm_source: string | null;
        leads_stages_id: string | null;
        leads_stages: { id: string; leads_pipelines_id: string } | null;
      };

      type MeetingRow = {
        id: string;
        lead_id: string | null;
        user_id: string | null;
        status: string | null;
        created_at: string | null;
      };

      let leads: LeadRow[] = leadsResult.data ?? [];
      const meetings: MeetingRow[] = meetingsResult.data ?? [];
      const users: Array<{ id: string; name: string }> = usersResult.data ?? [];
      const userMap = new Map(users.map(u => [u.id, u.name]));

      // Pipeline filter (JS side)
      if (pipelineId && pipelineId !== 'all') {
        leads = leads.filter(
          l => l.leads_stages?.leads_pipelines_id === pipelineId
        );
      }

      // ── RevOps funnel definitions ────────────────────────────────────────
      //
      // LEAD    = all leads in period
      // MQL     = leads with utm_source OR fbclid/gclid (marketing attributed)
      //           Note: full MQL (score-based) requires score config. V1 uses attribution as proxy.
      // SQL     = leads with any meeting created (≠ cancelado)
      // SAL     = leads with meeting status = 'compareceu' (showed up)
      // WIN     = leads.status = 'won'
      // COMMIT  = leads.status = 'won' AND value > 0
      //
      const leadIds = new Set(leads.map(l => l.id));
      const validMeetings = meetings.filter(m => m.lead_id && leadIds.has(m.lead_id) && m.status !== 'cancelado');
      const shownMeetings = meetings.filter(m => m.lead_id && leadIds.has(m.lead_id) && m.status === 'compareceu');

      const leadsWithMeeting = new Set(validMeetings.map(m => m.lead_id!));
      const leadsWithSAL = new Set(shownMeetings.map(m => m.lead_id!));

      const totalLeads = leads.length;
      const totalMQL = leads.filter(l => l.utm_source || l.utm_campaign).length;
      const totalSQL = leadsWithMeeting.size;
      const totalSAL = leadsWithSAL.size;
      const totalWin = leads.filter(l => l.status === 'won').length;
      const totalCommit = leads.filter(l => l.status === 'won' && Number(l.value) > 0).length;

      const cr1 = totalLeads > 0 ? (totalMQL / totalLeads) * 100 : 0;
      const cr2 = totalMQL > 0 ? (totalSQL / totalMQL) * 100 : 0;
      const cr3 = totalSQL > 0 ? (totalSAL / totalSQL) * 100 : 0;
      const cr4 = totalSAL > 0 ? (totalWin / totalSAL) * 100 : 0;
      const cr5 = totalWin > 0 ? (totalCommit / totalWin) * 100 : 0;

      // Funnel steps
      const funnel: RevOpsFunnelStep[] = [
        { key: 'lead',   label: 'Leads',   count: totalLeads,  cr: 100,  dropCount: 0,                    dropRate: 0 },
        { key: 'mql',    label: 'MQL',     count: totalMQL,   cr: cr1,  dropCount: totalLeads - totalMQL,  dropRate: totalLeads > 0 ? ((totalLeads - totalMQL) / totalLeads) * 100 : 0 },
        { key: 'sql',    label: 'SQL',     count: totalSQL,   cr: cr2,  dropCount: totalMQL - totalSQL,    dropRate: totalMQL > 0 ? ((totalMQL - totalSQL) / totalMQL) * 100 : 0 },
        { key: 'sal',    label: 'SAL',     count: totalSAL,   cr: cr3,  dropCount: totalSQL - totalSAL,    dropRate: totalSQL > 0 ? ((totalSQL - totalSAL) / totalSQL) * 100 : 0 },
        { key: 'win',    label: 'WIN',     count: totalWin,   cr: cr4,  dropCount: totalSAL - totalWin,    dropRate: totalSAL > 0 ? ((totalSAL - totalWin) / totalSAL) * 100 : 0 },
        { key: 'commit', label: 'COMMIT',  count: totalCommit, cr: cr5, dropCount: totalWin - totalCommit, dropRate: totalWin > 0 ? ((totalWin - totalCommit) / totalWin) * 100 : 0 },
      ];

      // ── By Closer (CR4 focus) ─────────────────────────────────────────────
      const closerMap = new Map<string, { sal: Set<string>; win: LeadRow[]; cycles: number[] }>();
      for (const m of shownMeetings) {
        const uid = m.user_id ?? '__none__';
        if (!closerMap.has(uid)) closerMap.set(uid, { sal: new Set(), win: [], cycles: [] });
        closerMap.get(uid)!.sal.add(m.lead_id!);
      }
      for (const lead of leads) {
        if (lead.status !== 'won') continue;
        const uid = lead.user_id ?? '__none__';
        if (!closerMap.has(uid)) closerMap.set(uid, { sal: new Set(), win: [], cycles: [] });
        const c = closerMap.get(uid)!;
        c.win.push(lead);
        const closeTime = lead.won_at ? new Date(lead.won_at).getTime() : new Date(lead.updated_at ?? '').getTime();
        const salMeeting = shownMeetings.find(m => m.lead_id === lead.id && m.user_id === uid);
        if (salMeeting?.created_at) {
          const d = (closeTime - new Date(salMeeting.created_at).getTime()) / (1000 * 60 * 60 * 24);
          if (d > 0 && d < 730) c.cycles.push(d);
        }
      }

      const byCloser: RevOpsByCloser[] = [...closerMap.entries()]
        .map(([uid, d]) => {
          const winRevenue = d.win.reduce((s, l) => s + (Number(l.value) || 0), 0);
          return {
            userId: uid,
            name: userMap.get(uid) ?? (uid === '__none__' ? 'Sem responsável' : uid.slice(0, 8)),
            sal: d.sal.size,
            win: d.win.length,
            cr4: d.sal.size > 0 ? (d.win.length / d.sal.size) * 100 : 0,
            ticketMedio: d.win.length > 0 ? winRevenue / d.win.length : 0,
            cicloMedioSalWin: d.cycles.length > 0 ? d.cycles.reduce((a, b) => a + b) / d.cycles.length : null,
          };
        })
        .filter(c => c.sal > 0 || c.win > 0)
        .sort((a, b) => b.win - a.win);

      // ── By Campaign (CR1 and CR4 focus) ──────────────────────────────────
      const campaignMap = new Map<string, { leads: LeadRow[] }>();
      for (const lead of leads) {
        const key = lead.utm_campaign || '(sem campanha)';
        if (!campaignMap.has(key)) campaignMap.set(key, { leads: [] });
        campaignMap.get(key)!.leads.push(lead);
      }

      const byCampaign: RevOpsByCampaign[] = [...campaignMap.entries()]
        .map(([campaign, { leads: cl }]) => {
          const mql = cl.filter(l => l.utm_source || l.utm_campaign).length;
          const sql = cl.filter(l => leadsWithMeeting.has(l.id)).length;
          const sal = cl.filter(l => leadsWithSAL.has(l.id)).length;
          const win = cl.filter(l => l.status === 'won').length;
          return {
            campaign,
            leads: cl.length,
            mql,
            sql,
            sal,
            win,
            cr1: cl.length > 0 ? (mql / cl.length) * 100 : 0,
            cr2: mql > 0 ? (sql / mql) * 100 : 0,
            cr4: sal > 0 ? (win / sal) * 100 : 0,
          };
        })
        .filter(c => c.leads >= 3)
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 12);

      // ── Weekly evolution ──────────────────────────────────────────────────
      const weekMap = new Map<string, { leads: number; mql: number; sql: number; sal: number; win: number }>();
      for (const lead of leads) {
        if (!lead.created_at) continue;
        const week = isoWeek(lead.created_at);
        if (!weekMap.has(week)) weekMap.set(week, { leads: 0, mql: 0, sql: 0, sal: 0, win: 0 });
        const w = weekMap.get(week)!;
        w.leads++;
        if (lead.utm_source || lead.utm_campaign) w.mql++;
        if (leadsWithMeeting.has(lead.id)) w.sql++;
        if (leadsWithSAL.has(lead.id)) w.sal++;
        if (lead.status === 'won') w.win++;
      }

      const evolution: RevOpsEvolutionPoint[] = [...weekMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12)
        .map(([week, d]) => ({
          week,
          leads: d.leads,
          cr1: d.leads > 0 ? (d.mql / d.leads) * 100 : 0,
          cr2: d.mql > 0 ? (d.sql / d.mql) * 100 : 0,
          cr3: d.sql > 0 ? (d.sal / d.sql) * 100 : 0,
          cr4: d.sal > 0 ? (d.win / d.sal) * 100 : 0,
        }));

      // Apply benchmark overrides if provided
      const effectiveBenchmarks = {
        cr1: { good: crBenchmarkOverrides?.cr1 ?? BENCHMARKS.cr1.good, medium: Math.round((crBenchmarkOverrides?.cr1 ?? BENCHMARKS.cr1.good) * 0.5) },
        cr2: { good: crBenchmarkOverrides?.cr2 ?? BENCHMARKS.cr2.good, medium: Math.round((crBenchmarkOverrides?.cr2 ?? BENCHMARKS.cr2.good) * 0.5) },
        cr3: { good: crBenchmarkOverrides?.cr3 ?? BENCHMARKS.cr3.good, medium: Math.round((crBenchmarkOverrides?.cr3 ?? BENCHMARKS.cr3.good) * 0.5) },
        cr4: { good: crBenchmarkOverrides?.cr4 ?? BENCHMARKS.cr4.good, medium: Math.round((crBenchmarkOverrides?.cr4 ?? BENCHMARKS.cr4.good) * 0.5) },
        cr5: { good: crBenchmarkOverrides?.cr5 ?? BENCHMARKS.cr5.good, medium: Math.round((crBenchmarkOverrides?.cr5 ?? BENCHMARKS.cr5.good) * 0.5) },
      };

      const buildBenchmarkWithOverrides = (
        key: 'cr1' | 'cr2' | 'cr3' | 'cr4' | 'cr5',
        value: number
      ): RevOpsCRBenchmark => {
        const { good, medium } = effectiveBenchmarks[key];
        const status = value >= good ? 'good' : value >= medium ? 'medium' : 'bad';
        const diagnosis =
          status === 'bad' ? DIAGNOSIS[key].bad
          : status === 'medium' ? DIAGNOSIS[key].medium
          : [];
        return { cr: value, status, diagnosis };
      };

      return {
        funnel,
        crs: { cr1, cr2, cr3, cr4, cr5 },
        benchmarks: {
          cr1: buildBenchmarkWithOverrides('cr1', cr1),
          cr2: buildBenchmarkWithOverrides('cr2', cr2),
          cr3: buildBenchmarkWithOverrides('cr3', cr3),
          cr4: buildBenchmarkWithOverrides('cr4', cr4),
          cr5: buildBenchmarkWithOverrides('cr5', cr5),
        },
        byCloser,
        byCampaign,
        evolution,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
