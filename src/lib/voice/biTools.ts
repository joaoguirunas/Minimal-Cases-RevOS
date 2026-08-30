import type { SupabaseClient } from '@supabase/supabase-js';

// Gemini Live tool declaration shape (gemini-2.5-flash-native-audio-preview-12-2025)
export interface GeminiToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
  behavior?: 'BLOCKING' | 'NON_BLOCKING';
  scheduling?: 'INTERRUPT' | 'WHEN_IDLE' | 'SILENT';
}

export interface GeminiTool {
  functionDeclarations: GeminiToolDeclaration[];
}

export interface ToolResponse {
  functionResponses: Array<{
    name: string;
    response: { result?: unknown; error?: string };
  }>;
}

// ─── Tool declarations ────────────────────────────────────────────────────────

const GET_INSIGHTS_CONTEXT: GeminiToolDeclaration = {
  name: 'get_insights_context',
  description:
    'Retorna métricas agregadas do BI PRO: funil de vendas (leads por etapa, conversão, receita), ' +
    'pessoas e empresas (total, score distribution, fontes), mensagens (volume por canal, tendência diária), ' +
    'reuniões (show rate por closer, tempo médio lead→reunião), ' +
    'marketing (disparos, landing pages, UTM attribution, Meta forms) e Prospect PRO (campanhas, contatos, AI score). ' +
    'Use quando o usuário perguntar sobre métricas gerais, funil, receita, conversão ou desempenho geral do CRM.',
  parameters: {
    type: 'object',
    properties: {
      date_from: {
        type: 'string',
        description: 'Data início no formato ISO 8601 (ex: 2026-04-01T00:00:00Z). Omitir para buscar todo o histórico.',
      },
      date_to: {
        type: 'string',
        description: 'Data fim no formato ISO 8601 (ex: 2026-04-30T23:59:59Z). Omitir para buscar até agora.',
      },
      pipeline_id: {
        type: 'string',
        description: 'UUID do pipeline para filtrar métricas de funil. Omitir para retornar todos os pipelines.',
      },
    },
    required: [],
  },
  behavior: 'NON_BLOCKING',
  scheduling: 'WHEN_IDLE',
};

const GET_FUNNEL_SUMMARY: GeminiToolDeclaration = {
  name: 'get_funnel_summary',
  description:
    'Retorna um resumo focado no funil de vendas: leads por etapa, taxa de conversão, receita, ' +
    'ticket médio, ciclo médio de vendas em dias e principais motivos de perda. ' +
    'Use quando o usuário perguntar especificamente sobre funil, pipeline, etapas, conversão ou por que perdeu leads. ' +
    'Mais focado que get_insights_context — use quando a pergunta for sobre vendas/CRM, não sobre BI geral.',
  parameters: {
    type: 'object',
    properties: {
      date_from: {
        type: 'string',
        description: 'Data início no formato ISO 8601. Omitir para todo o histórico.',
      },
      date_to: {
        type: 'string',
        description: 'Data fim no formato ISO 8601. Omitir para até agora.',
      },
      pipeline_id: {
        type: 'string',
        description: 'UUID do pipeline para filtrar. Omitir para todos os pipelines.',
      },
    },
    required: [],
  },
  behavior: 'NON_BLOCKING',
  scheduling: 'WHEN_IDLE',
};

// ─── Phase 1 tools ────────────────────────────────────────────────────────────

const GET_MEETINGS_OVERVIEW: GeminiToolDeclaration = {
  name: 'get_meetings_overview',
  description:
    'Retorna overview de reuniões: show rate por closer, próximas reuniões agendadas, ' +
    'breakdown por status (agendado, compareceu, não compareceu, cancelado) e tempo médio lead→reunião. ' +
    'Use quando o usuário perguntar sobre reuniões, show rate, agendamentos, quem compareceu ou próximos compromissos.',
  parameters: {
    type: 'object',
    properties: {
      date_from: { type: 'string', description: 'Data início ISO 8601. Omitir para 30 dias atrás.' },
      date_to:   { type: 'string', description: 'Data fim ISO 8601. Omitir para hoje.' },
    },
    required: [],
  },
  behavior: 'NON_BLOCKING',
  scheduling: 'WHEN_IDLE',
};

const GET_CAMPAIGNS_PERFORMANCE: GeminiToolDeclaration = {
  name: 'get_campaigns_performance',
  description:
    'Retorna performance de campanhas de mídia paga: gasto total, CPL (custo por lead), CAC (custo por venda), ' +
    'impressões, cliques, CTR, leads gerados e ROI por campanha e por plataforma (Meta, Google, TikTok). ' +
    'Use quando o usuário perguntar sobre anúncios, campanhas, investimento em marketing, CPL, CAC ou ROAS.',
  parameters: {
    type: 'object',
    properties: {
      date_from:    { type: 'string', description: 'Data início ISO 8601 (ex: 2026-04-01). Omitir para 30 dias atrás.' },
      date_to:      { type: 'string', description: 'Data fim ISO 8601. Omitir para hoje.' },
      platform:     { type: 'string', description: 'Filtrar por plataforma: "meta", "google" ou "tiktok". Omitir para todas.', enum: ['meta', 'google', 'tiktok'] },
    },
    required: [],
  },
  behavior: 'NON_BLOCKING',
  scheduling: 'WHEN_IDLE',
};

// ─── Phase 2 tools ────────────────────────────────────────────────────────────

const GET_SENDS_STATUS: GeminiToolDeclaration = {
  name: 'get_sends_status',
  description:
    'Retorna status dos disparos (campanhas de mensagem): disparos em andamento, recentes, ' +
    'taxa de entrega, taxa de falha, volume por canal (WhatsApp, Email, SMS). ' +
    'Use quando o usuário perguntar sobre disparos, envios em massa, campanhas de WhatsApp ou status de envio.',
  parameters: {
    type: 'object',
    properties: {
      limit: { type: 'string', description: 'Número de disparos recentes a retornar. Padrão: 10.' },
    },
    required: [],
  },
  behavior: 'NON_BLOCKING',
  scheduling: 'WHEN_IDLE',
};

const GET_PIPELINE_STAGE_DRILLDOWN: GeminiToolDeclaration = {
  name: 'get_pipeline_stage_drilldown',
  description:
    'Retorna leads agrupados por etapa do pipeline: quantidade, valor total, dias médios na etapa, ' +
    'leads parados (sem movimentação há mais de X dias). ' +
    'Use quando o usuário perguntar sobre gargalos, leads parados, tempo em cada etapa ou distribuição no funil.',
  parameters: {
    type: 'object',
    properties: {
      pipeline_id: { type: 'string', description: 'UUID do pipeline. Omitir para todos.' },
      stuck_days:  { type: 'string', description: 'Dias sem movimentação para considerar "parado". Padrão: 7.' },
    },
    required: [],
  },
  behavior: 'NON_BLOCKING',
  scheduling: 'WHEN_IDLE',
};

// ─── Tool array (exported for Gemini Live session setup) ─────────────────────

export const BI_VOICE_TOOLS: GeminiTool = {
  functionDeclarations: [
    GET_INSIGHTS_CONTEXT,
    GET_FUNNEL_SUMMARY,
    GET_MEETINGS_OVERVIEW,
    GET_CAMPAIGNS_PERFORMANCE,
    GET_SENDS_STATUS,
    GET_PIPELINE_STAGE_DRILLDOWN,
  ],
};

// ─── Tool executor ────────────────────────────────────────────────────────────

export async function executeBiTool(
  callName: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  tenantId?: string,
): Promise<ToolResponse> {
  const startMs = Date.now();

  try {
    let result: unknown;

    switch (callName) {
      case 'get_insights_context': {
        const { data, error } = await supabase.rpc('get_insights_context', {
          p_date_from: args.date_from ?? null,
          p_date_to: args.date_to ?? null,
          p_pipeline_id: args.pipeline_id ?? null,
        });
        if (error) throw error;
        result = data;
        break;
      }

      case 'get_funnel_summary': {
        // Backed by get_insights_context — extracts only the funnel block
        const { data, error } = await supabase.rpc('get_insights_context', {
          p_date_from: args.date_from ?? null,
          p_date_to: args.date_to ?? null,
          p_pipeline_id: args.pipeline_id ?? null,
        });
        if (error) throw error;
        result = (data as Record<string, unknown>)?.funnel ?? data;
        break;
      }

      case 'get_meetings_overview': {
        const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const defaultTo   = new Date().toISOString().split('T')[0];
        const fromDate = args.date_from ? String(args.date_from).split('T')[0] : defaultFrom;
        const toDate   = args.date_to   ? String(args.date_to).split('T')[0]   : defaultTo;
        const todayStr = new Date().toISOString().split('T')[0];

        const [historyRes, upcomingRes, usersRes] = await Promise.all([
          supabase
            .from('meetings')
            .select('id, user_id, status, date, start_time, lead_id')
            .gte('date', fromDate)
            .lte('date', toDate)
            .order('date', { ascending: false }),
          supabase
            .from('meetings')
            .select('id, user_id, status, date, start_time, title')
            .eq('status', 'agendado')
            .gte('date', todayStr)
            .order('date', { ascending: true })
            .limit(10),
          supabase
            .from('settings_users')
            .select('id, name')
            .eq('active', true),
        ]);

        const meetings = (historyRes.data ?? []) as Array<{ id: string; user_id: string | null; status: string; date: string; start_time: string | null; lead_id: string | null }>;
        const upcoming = (upcomingRes.data ?? []) as Array<{ id: string; user_id: string | null; status: string; date: string; start_time: string | null; title: string | null }>;
        const users    = (usersRes.data ?? []) as Array<{ id: string; name: string }>;
        const userMap  = new Map(users.map(u => [u.id, u.name]));

        const total      = meetings.length;
        const compareceu = meetings.filter(m => m.status === 'compareceu').length;
        const naoComp    = meetings.filter(m => m.status === 'nao_compareceu').length;
        const cancelado  = meetings.filter(m => m.status === 'cancelado').length;
        const showRate   = total > 0 ? Math.round((compareceu / total) * 1000) / 10 : null;

        const byCloser = new Map<string, { name: string; total: number; compareceu: number }>();
        for (const m of meetings) {
          if (!m.user_id) continue;
          if (!byCloser.has(m.user_id)) byCloser.set(m.user_id, { name: userMap.get(m.user_id) ?? m.user_id, total: 0, compareceu: 0 });
          const entry = byCloser.get(m.user_id)!;
          entry.total++;
          if (m.status === 'compareceu') entry.compareceu++;
        }

        const closerRanking = [...byCloser.values()]
          .map(c => ({ ...c, show_rate: c.total > 0 ? Math.round((c.compareceu / c.total) * 1000) / 10 : null }))
          .sort((a, b) => (b.show_rate ?? 0) - (a.show_rate ?? 0));

        result = {
          period: { from: fromDate, to: toDate },
          summary: { total, compareceu, nao_compareceu: naoComp, cancelado, show_rate_pct: showRate },
          closer_ranking: closerRanking,
          upcoming_meetings: upcoming.map(m => ({
            date: m.date,
            time: m.start_time,
            title: m.title,
            closer: m.user_id ? (userMap.get(m.user_id) ?? m.user_id) : null,
          })),
        };
        break;
      }

      case 'get_campaigns_performance': {
        const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const defaultTo   = new Date().toISOString().split('T')[0];
        const fromDate = args.date_from ? String(args.date_from).split('T')[0] : defaultFrom;
        const toDate   = args.date_to   ? String(args.date_to).split('T')[0]   : defaultTo;

        let spendQ = supabase
          .from('bi_ad_spend')
          .select('spend, platform, campaign_id, date, impressions, clicks, leads')
          .gte('date', fromDate)
          .lte('date', toDate);
        if (args.platform) spendQ = spendQ.eq('platform', String(args.platform));

        const [spendRes, campaignsRes, wonLeadsRes] = await Promise.all([
          spendQ,
          supabase.from('bi_ad_campaigns').select('id, campaign_name, utm_campaign, platform'),
          supabase
            .from('leads')
            .select('utm_campaign, value')
            .eq('status', 'won')
            .gte('won_at', `${fromDate}T00:00:00Z`)
            .lte('won_at', `${toDate}T23:59:59Z`),
        ]);

        const spendRows  = (spendRes.data ?? []) as Array<{ spend: number; platform: string; campaign_id: string | null; date: string; impressions: number; clicks: number; leads: number }>;
        const campaigns  = (campaignsRes.data ?? []) as Array<{ id: string; campaign_name: string; utm_campaign: string | null; platform: string }>;
        const wonLeads   = (wonLeadsRes.data ?? []) as Array<{ utm_campaign: string | null; value: number | null }>;
        const campaignMap = new Map(campaigns.map(c => [c.id, c]));

        type PlatformAgg = { spend: number; impressions: number; clicks: number; leads: number; won_leads: number; won_value: number };
        const byPlatform = new Map<string, PlatformAgg>();
        type CampaignAgg = { name: string; platform: string; spend: number; impressions: number; clicks: number; leads: number; won_leads: number; won_value: number };
        const byCampaign = new Map<string, CampaignAgg>();

        for (const row of spendRows) {
          if (!byPlatform.has(row.platform)) byPlatform.set(row.platform, { spend: 0, impressions: 0, clicks: 0, leads: 0, won_leads: 0, won_value: 0 });
          const p = byPlatform.get(row.platform)!;
          p.spend += row.spend ?? 0; p.impressions += row.impressions ?? 0;
          p.clicks += row.clicks ?? 0; p.leads += row.leads ?? 0;

          const camp = row.campaign_id ? campaignMap.get(row.campaign_id) : null;
          const campKey = camp?.campaign_name ?? row.campaign_id ?? 'unknown';
          if (!byCampaign.has(campKey)) byCampaign.set(campKey, { name: campKey, platform: row.platform, spend: 0, impressions: 0, clicks: 0, leads: 0, won_leads: 0, won_value: 0 });
          const c = byCampaign.get(campKey)!;
          c.spend += row.spend ?? 0; c.impressions += row.impressions ?? 0;
          c.clicks += row.clicks ?? 0; c.leads += row.leads ?? 0;
        }

        for (const wl of wonLeads) {
          if (!wl.utm_campaign) continue;
          const entry = [...byCampaign.entries()].find(([k]) =>
            k.toLowerCase().includes(wl.utm_campaign!.toLowerCase()) ||
            wl.utm_campaign!.toLowerCase().includes(k.toLowerCase())
          );
          if (entry) {
            const campAgg = byCampaign.get(entry[0])!;
            campAgg.won_leads++;
            campAgg.won_value += wl.value ?? 0;
            const platAgg = byPlatform.get(campAgg.platform);
            if (platAgg) { platAgg.won_leads++; platAgg.won_value += wl.value ?? 0; }
          }
        }

        const totalSpend       = [...byPlatform.values()].reduce((s, p) => s + p.spend, 0);
        const totalLeads       = [...byPlatform.values()].reduce((s, p) => s + p.leads, 0);
        const totalImpressions = [...byPlatform.values()].reduce((s, p) => s + p.impressions, 0);
        const totalClicks      = [...byPlatform.values()].reduce((s, p) => s + p.clicks, 0);
        const totalWonLeads    = [...byPlatform.values()].reduce((s, p) => s + p.won_leads, 0);
        const totalWonValue    = [...byPlatform.values()].reduce((s, p) => s + p.won_value, 0);

        const allCampaignsArr = [...byCampaign.values()];

        const topCampaigns = allCampaignsArr
          .sort((a, b) => b.spend - a.spend)
          .slice(0, 5)
          .map(c => ({
            name: c.name,
            platform: c.platform,
            spend: Math.round(c.spend * 100) / 100,
            leads: c.leads,
            won_leads: c.won_leads,
            won_value: Math.round(c.won_value * 100) / 100,
            cpl: c.leads > 0 ? Math.round((c.spend / c.leads) * 100) / 100 : null,
            cac: c.won_leads > 0 ? Math.round((c.spend / c.won_leads) * 100) / 100 : null,
            ctr_pct: c.impressions > 0 ? Math.round((c.clicks / c.impressions) * 10000) / 100 : null,
          }));

        const bestBySales = allCampaignsArr
          .filter(c => c.won_leads > 0)
          .sort((a, b) => b.won_value - a.won_value)[0] ?? null;

        result = {
          period: { from: fromDate, to: toDate },
          summary: {
            total_spend: Math.round(totalSpend * 100) / 100,
            total_leads: totalLeads,
            total_won_leads: totalWonLeads,
            total_won_value: Math.round(totalWonValue * 100) / 100,
            total_impressions: totalImpressions,
            total_clicks: totalClicks,
            cpl: totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : null,
            cac: totalWonLeads > 0 ? Math.round((totalSpend / totalWonLeads) * 100) / 100 : null,
            ctr_pct: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : null,
          },
          by_platform: [...byPlatform.entries()].map(([platform, p]) => ({
            platform,
            spend: Math.round(p.spend * 100) / 100,
            leads: p.leads,
            won_leads: p.won_leads,
            won_value: Math.round(p.won_value * 100) / 100,
            cpl: p.leads > 0 ? Math.round((p.spend / p.leads) * 100) / 100 : null,
            cac: p.won_leads > 0 ? Math.round((p.spend / p.won_leads) * 100) / 100 : null,
          })),
          top_campaigns_by_spend: topCampaigns,
          best_campaign_by_sales: bestBySales ? {
            name: bestBySales.name,
            platform: bestBySales.platform,
            won_leads: bestBySales.won_leads,
            won_value: Math.round(bestBySales.won_value * 100) / 100,
            spend: Math.round(bestBySales.spend * 100) / 100,
            cac: Math.round((bestBySales.spend / bestBySales.won_leads) * 100) / 100,
          } : null,
        };
        break;
      }

      case 'get_sends_status': {
        const limit = parseInt(String(args.limit ?? '10'), 10);
        const { data } = await supabase
          .from('sends')
          .select('id, name, channel, status, total_contacts, sent_count, failed_count, created_at, started_at, completed_at')
          .order('created_at', { ascending: false })
          .limit(limit);

        const sends = (data ?? []) as Array<{ id: string; name: string; channel: string; status: string; total_contacts: number; sent_count: number; failed_count: number; created_at: string; started_at: string | null; completed_at: string | null }>;

        const running   = sends.filter(s => s.status === 'running');
        const completed = sends.filter(s => s.status === 'completed');
        const scheduled = sends.filter(s => s.status === 'scheduled');

        result = {
          summary: {
            total_recent: sends.length,
            running: running.length,
            completed: completed.length,
            scheduled: scheduled.length,
          },
          sends: sends.map(s => ({
            name: s.name,
            channel: s.channel,
            status: s.status,
            total_contacts: s.total_contacts,
            sent_count: s.sent_count,
            failed_count: s.failed_count,
            delivery_rate_pct: s.total_contacts > 0 ? Math.round(((s.sent_count) / s.total_contacts) * 1000) / 10 : null,
            created_at: s.created_at,
          })),
        };
        break;
      }

      case 'get_pipeline_stage_drilldown': {
        const stuckDays = parseInt(String(args.stuck_days ?? '7'), 10);
        const stuckCutoff = new Date(Date.now() - stuckDays * 24 * 60 * 60 * 1000).toISOString();

        let stagesQ = supabase.from('leads_stages').select('id, name, order_index, color, leads_pipelines_id, leads_pipelines(name)').order('order_index', { ascending: true });
        if (args.pipeline_id) stagesQ = stagesQ.eq('leads_pipelines_id', String(args.pipeline_id));

        const { data: stagesData } = await stagesQ;
        const stages = (stagesData ?? []) as Array<{ id: string; name: string; order_index: number; color: string | null; leads_pipelines_id: string; leads_pipelines: { name: string } | null }>;

        if (stages.length === 0) { result = { stages: [] }; break; }

        const stageIds = stages.map(s => s.id);
        const { data: leadsData } = await supabase
          .from('leads')
          .select('id, value, status, created_at, updated_at, leads_stages_id')
          .in('leads_stages_id', stageIds)
          .eq('status', 'in_progress');

        const leads = (leadsData ?? []) as Array<{ id: string; value: number | null; status: string; created_at: string; updated_at: string; leads_stages_id: string | null }>;

        const result_stages = stages.map(stage => {
          const stageLeads = leads.filter(l => l.leads_stages_id === stage.id);
          const stuckLeads = stageLeads.filter(l => l.updated_at < stuckCutoff);
          const totalValue = stageLeads.reduce((s, l) => s + (l.value ?? 0), 0);
          const avgDays    = stageLeads.length > 0
            ? Math.round(stageLeads.reduce((s, l) => s + (Date.now() - new Date(l.created_at).getTime()) / 86400000, 0) / stageLeads.length * 10) / 10
            : null;

          return {
            stage: stage.name,
            pipeline: stage.leads_pipelines?.name ?? null,
            leads_count: stageLeads.length,
            stuck_count: stuckLeads.length,
            total_value: Math.round(totalValue * 100) / 100,
            avg_days_in_stage: avgDays,
          };
        });

        result = { stuck_threshold_days: stuckDays, stages: result_stages };
        break;
      }

      default:
        return {
          functionResponses: [
            { name: callName, response: { error: `Tool desconhecida: ${callName}` } },
          ],
        };
    }

    void logToolInvocation(supabase, callName, args, Date.now() - startMs, true, undefined, tenantId);

    return {
      functionResponses: [{ name: callName, response: { result } }],
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    void logToolInvocation(supabase, callName, args, Date.now() - startMs, false, errorMessage, tenantId);

    return {
      functionResponses: [{ name: callName, response: { error: errorMessage } }],
    };
  }
}

// ─── Telemetry (fire-and-forget) ──────────────────────────────────────────────

async function logToolInvocation(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
  latencyMs: number,
  success: boolean,
  errorMessage?: string,
  tenantId?: string,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    // Resolve tenant_id if not provided — required by RLS policy
    let resolvedTenantId = tenantId;
    if (!resolvedTenantId) {
      const { data: s } = await supabase.from('settings').select('id').limit(1).maybeSingle();
      resolvedTenantId = s?.id ?? undefined;
    }
    if (!resolvedTenantId) return; // RLS would reject anyway
    await supabase.from('bi_voice_tool_invocations').insert({
      tenant_id: resolvedTenantId,
      tool_name: toolName,
      args,
      latency_ms: latencyMs,
      success,
      error_message: errorMessage ?? null,
      user_id: user?.id ?? null,
    });
  } catch {
    // telemetry is non-critical — silently ignore failures
  }
}
