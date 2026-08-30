import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getActiveProvider, callLLM } from '../_shared/llm-provider.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Block Router (RAG-lite) ─────────────────────────────────────────────────
const BLOCK_KEYWORDS: Record<string, string[]> = {
  funnel:    ['funil', 'pipeline', 'lead', 'leads', 'etapa', 'conversão', 'conversao', 'ganho', 'perdido', 'ticket', 'ciclo', 'stage', 'venda', 'vendas', 'receita', 'deal', 'negócio', 'negocio', 'negocios'],
  people:    ['contato', 'contatos', 'pessoa', 'pessoas', 'empresa', 'empresas', 'score', 'fonte', 'cliente', 'clientes', 'companhia'],
  messages:  ['mensagem', 'mensagens', 'whatsapp', 'email', 'sms', 'canal', 'conversa', 'conversas', 'abandonad', 'resposta'],
  meetings:  ['reunião', 'reuniões', 'reuniao', 'reunioes', 'agendamento', 'agendamentos', 'show rate', 'closer', 'meeting', 'meetings', 'agenda', 'schedule', 'marcad'],
  calls:     ['chamada', 'chamadas', 'call', 'calls', 'ligação', 'ligações', 'ligacao', 'operador', 'atendimento', 'telefone'],
  marketing: ['marketing', 'campanha', 'campanhas', 'utm', 'formulário', 'formulario', 'disparo', 'disparos', 'meta', 'form', 'landing', 'anúncio', 'anuncio', 'ads', 'investimento', 'invest', 'gasto', 'spend', 'roi', 'cpl', 'cac', 'custo por', 'custo de'],
  prospect:  ['prospecção', 'prospeccao', 'prospect', 'enrichment', 'ai score', 'campanha prospect', 'prospectar'],
};

const ALL_BLOCKS = Object.keys(BLOCK_KEYWORDS);

// ── Temporal intent parser ────────────────────────────────────────────────────
// Extracts date range from user message + recent history
function parseTemporalIntent(message: string, history: Array<{ role: string; content: string }>): { from: string; to: string } | null {
  const text = [message, ...history.slice(-3).map(h => h.content)].join(' ').toLowerCase();
  const now = new Date();
  const startOf = (d: Date) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };
  const endOf = (d: Date) => { const c = new Date(d); c.setHours(23, 59, 59, 999); return c; };
  const fmt = (d: Date) => d.toISOString();

  // "hoje"
  if (/\bhoje\b/.test(text)) {
    return { from: fmt(startOf(now)), to: fmt(endOf(now)) };
  }
  // "ontem"
  if (/\bontem\b/.test(text)) {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { from: fmt(startOf(y)), to: fmt(endOf(y)) };
  }
  // "essa/nessa/esta semana"
  if (/\b(n?ess[ae]|esta)\s+semana\b/.test(text)) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Sunday start
    return { from: fmt(startOf(weekStart)), to: fmt(endOf(now)) };
  }
  // "semana passada" / "última semana"
  if (/\b(semana\s+passada|[uú]ltima\s+semana)\b/.test(text)) {
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() - now.getDay() - 1); // last Saturday
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    return { from: fmt(startOf(weekStart)), to: fmt(endOf(weekEnd)) };
  }
  // "esse/nesse/este mês" / "mês atual"
  if (/\b(n?ess[ae]|este?)\s+m[eê]s\b|\bm[eê]s\s+atual\b/.test(text)) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: fmt(startOf(monthStart)), to: fmt(endOf(now)) };
  }
  // "mês passado" / "último mês"
  if (/\b(m[eê]s\s+passado|[uú]ltimo\s+m[eê]s)\b/.test(text)) {
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);
    return { from: fmt(startOf(prevMonthStart)), to: fmt(endOf(prevMonthEnd)) };
  }
  // "últimos N dias"
  const daysMatch = text.match(/[uú]ltimos?\s+(\d+)\s+dias?/);
  if (daysMatch) {
    const n = parseInt(daysMatch[1], 10);
    const start = new Date(now); start.setDate(now.getDate() - n + 1);
    return { from: fmt(startOf(start)), to: fmt(endOf(now)) };
  }
  // "março", "fevereiro", etc — specific month name
  const months: Record<string, number> = {
    janeiro: 0, fevereiro: 1, 'março': 2, marco: 2, abril: 3, maio: 4, junho: 5,
    julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
  };
  for (const [name, idx] of Object.entries(months)) {
    if (text.includes(name)) {
      const year = idx > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
      const monthStart = new Date(year, idx, 1);
      const monthEnd = idx === now.getMonth() && year === now.getFullYear()
        ? endOf(now)
        : endOf(new Date(year, idx + 1, 0));
      return { from: fmt(startOf(monthStart)), to: fmt(monthEnd) };
    }
  }

  // No temporal intent detected → return null (will use default)
  return null;
}

function selectBlocks(message: string, history: Array<{ role: string; content: string }>): string[] {
  const recentHistory = history.slice(-3).map(h => h.content);
  const text = [message, ...recentHistory].join(' ').toLowerCase();

  const matched = Object.entries(BLOCK_KEYWORDS)
    .filter(([_, kws]) => kws.some(kw => text.includes(kw)))
    .map(([block]) => block);

  if (matched.length === 0) return ALL_BLOCKS;
  if (!matched.includes('funnel')) matched.unshift('funnel');
  // "campanhas" needs both marketing (UTM/ads) and meetings (by_campaign funnel)
  if (matched.includes('marketing') && !matched.includes('meetings')) matched.push('meetings');
  return matched;
}

function filterContextByBlocks(ctx: Record<string, any>, blocks: string[]): Record<string, any> {
  const filtered: Record<string, any> = {};
  for (const b of blocks) {
    if (ctx[b] !== undefined) filtered[b] = ctx[b];
  }
  return filtered;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

function delta(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+∞' : '0%';
  const d = ((current - previous) / previous) * 100;
  return `${d > 0 ? '+' : ''}${d.toFixed(1)}%`;
}

// ── Structured context builder ──────────────────────────────────────────────
function buildStructuredContext(
  current: Record<string, any>,
  today: Record<string, any>,
  yesterday: Record<string, any>,
  adsData: { current: any; today: any; yesterday: any },
  periodLabel: string,
): string {
  const sections: string[] = [];

  // ── EXECUTIVE SUMMARY ──
  const fSum = current.funnel ?? {};
  const adsSum = adsData.current;
  const totalUtmLeadsSum = (current.marketing?.utm_attribution ?? []).reduce((s: number, u: any) => s + (u.leads ?? 0), 0);
  const cplSum = totalUtmLeadsSum > 0 && adsSum.total > 0 ? adsSum.total / totalUtmLeadsSum : null;
  sections.push(`## 🏢 RESUMO EXECUTIVO (${periodLabel})
- **Leads totais**: ${fSum.total ?? 0} | **Ganhos**: ${fSum.won ?? 0} | **Conversão**: ${fmtPct(fSum.conversion_pct ?? 0)}
- **Receita**: ${fmtBRL(fSum.revenue ?? 0)} | **Ticket médio**: ${fmtBRL(fSum.avg_deal ?? 0)}
- **Investimento Ads**: ${fmtBRL(adsSum.total)} | **CPL**: ${cplSum ? fmtBRL(cplSum) : 'N/A'}
- **Reuniões**: ${(current.meetings ?? {}).total ?? 0} | **Show rate**: ${fmtPct((current.meetings ?? {}).show_rate ?? 0)}
---`);

  // ── FUNNEL ──
  const fc = current.funnel ?? {};
  const ft = today.funnel ?? {};
  const fy = yesterday.funnel ?? {};

  sections.push(`## 📊 FUNIL DE VENDAS
**Período completo** (${periodLabel}):
- Total leads: **${fc.total ?? 0}** | Ganhos: **${fc.won ?? 0}** | Perdidos: ${fc.lost ?? 0} | Em andamento: ${fc.active ?? 0}
- Conversão: **${fmtPct(fc.conversion_pct ?? 0)}** | Receita: **${fmtBRL(fc.revenue ?? 0)}** | Ticket médio: ${fmtBRL(fc.avg_deal ?? 0)}
- Ciclo médio: ${fc.avg_cycle_days ?? 0} dias

**Hoje**: ${ft.total ?? 0} leads | ${ft.won ?? 0} ganhos | ${fmtBRL(ft.revenue ?? 0)} receita
**Ontem**: ${fy.total ?? 0} leads | ${fy.won ?? 0} ganhos | ${fmtBRL(fy.revenue ?? 0)} receita
**Δ hoje vs ontem**: leads ${delta(ft.total ?? 0, fy.total ?? 0)} | receita ${delta(ft.revenue ?? 0, fy.revenue ?? 0)}`);

  const stages = fc.stages ?? [];
  if (stages.length > 0) {
    sections.push(`\nEtapas do funil (JSON para gráfico):
\`\`\`json
${JSON.stringify(stages.map((s: any) => ({ etapa: s.name, leads: s.leads, valor: s.value, dias_medio: s.avg_days })))}
\`\`\``);
  }

  const losses = fc.loss_reasons ?? [];
  if (losses.length > 0) {
    sections.push(`\nMotivos de perda (JSON para gráfico):
\`\`\`json
${JSON.stringify(losses.map((lr: any) => ({ motivo: lr.reason, quantidade: lr.count })))}
\`\`\``);
  }

  const leadsByDay = fc.leads_by_day ?? [];
  if (leadsByDay.length > 0) {
    sections.push(`\nLeads por dia (JSON para gráfico de linha/área):
\`\`\`json
${JSON.stringify(leadsByDay)}
\`\`\``);
  }

  const salesByDay = fc.sales_by_day ?? [];
  if (salesByDay.length > 0) {
    sections.push(`\nVendas por dia (JSON para gráfico de linha/área):
\`\`\`json
${JSON.stringify(salesByDay)}
\`\`\``);
  }

  // ── PEOPLE ──
  const p = current.people ?? {};
  const sd = p.score_distribution ?? {};
  sections.push(`\n## 👥 PESSOAS & EMPRESAS
- Contatos: ${p.people_total ?? 0} (${p.people_active ?? 0} ativos)
- Score: 76-100: ${sd['76_100'] ?? 0} | 51-75: ${sd['51_75'] ?? 0} | 26-50: ${sd['26_50'] ?? 0} | 0-25: ${sd['0_25'] ?? 0}
- Empresas: ${p.companies_total ?? 0} (${p.companies_active ?? 0} ativas)
- Top fontes: ${(p.top_sources ?? []).map((s: any) => `${s.source}(${s.count})`).join(', ') || 'Nenhuma'}`);

  // ── MESSAGES ──
  const msg = current.messages ?? {};
  sections.push(`\n## 💬 MENSAGENS / CONVERSAS
- Total: ${msg.total ?? 0}
- Por canal: ${(msg.by_channel ?? []).map((c: any) => `${c.channel}(${c.count})`).join(', ') || 'Nenhuma'}
- Conversas abandonadas (sem resposta 24h): ${msg.abandoned_conversations ?? 0}`);

  const trend = msg.daily_trend ?? [];
  if (trend.length > 0) {
    sections.push(`Trend diário (JSON para gráfico):
\`\`\`json
${JSON.stringify(trend.map((d: any) => ({ dia: d.day, mensagens: d.count })))}
\`\`\``);
  }

  // ── MEETINGS ──
  const mtg = current.meetings ?? {};
  const mtgT = today.meetings ?? {};
  const mtgY = yesterday.meetings ?? {};
  sections.push(`\n## 📅 REUNIÕES / AGENDAMENTOS
**NOTA**: Apenas reuniões marcadas pelo sistema (CRM). Eventos pessoais do Google Calendar são excluídos.
**Período**: ${mtg.total ?? 0} total | Status: ${(mtg.by_status ?? []).map((s: any) => `${s.status}(${s.count})`).join(', ') || 'Nenhum'}
**Hoje**: ${mtgT.total ?? 0} | **Ontem**: ${mtgY.total ?? 0}
**Δ hoje vs ontem**: ${delta(mtgT.total ?? 0, mtgY.total ?? 0)}
- Tempo lead→reunião: ${mtg.avg_lead_to_meeting_days ?? 0}d | reunião→fechamento: ${mtg.avg_meeting_to_close_days ?? 0}d`);

  const closers = mtg.show_rate_by_closer ?? [];
  if (closers.length > 0) {
    sections.push(`Show rate por closer (JSON para gráfico):
\`\`\`json
${JSON.stringify(closers.map((c: any) => ({ closer: c.name, total: c.total, presentes: c.attended, show_rate: c.show_rate })))}
\`\`\``);
  }

  const meetingsByCampaign = mtg.by_campaign ?? [];
  if (meetingsByCampaign.length > 0) {
    sections.push(`Funil por campanha: campanha → leads → reuniões → vendas (JSON para gráfico):
\`\`\`json
${JSON.stringify(meetingsByCampaign.map((mc: any) => ({ campanha: mc.campaign, leads: mc.leads, reunioes: mc.meetings, presentes: mc.attended, ausentes: mc.no_show, ganhos: mc.won })))}
\`\`\``);
  }

  // ── CALLS ──
  const calls = current.calls ?? {};
  sections.push(`\n## 📞 CHAMADAS
- Total: ${calls.total ?? 0} | Inbound: ${calls.inbound ?? 0} | Outbound: ${calls.outbound ?? 0}
- Atendidas: ${calls.answered ?? 0} (${fmtPct(calls.answer_rate ?? 0)}) | Duração média: ${calls.avg_duration_sec ?? 0}s
- Operadores: ${(calls.top_operators ?? []).map((o: any) => `${o.name}(${o.answered}/${o.total})`).join(', ') || 'Nenhum'}`);

  // ── MARKETING (disparos + formulários) ──
  const mkt = current.marketing ?? {};
  const sends = mkt.sends ?? {};
  const lps = mkt.landing_pages ?? [];
  const utms = mkt.utm_attribution ?? [];
  const mForms = mkt.meta_forms ?? [];
  sections.push(`\n## 📣 MARKETING
**Disparos de mensagem** (WhatsApp/Email — NÃO são campanhas de ads):
- ${sends.total_campaigns ?? 0} disparos, ${sends.total_sent ?? 0} enviados, delivery ${fmtPct(sends.delivery_rate ?? 0)}, leitura ${fmtPct(sends.read_rate ?? 0)}
**Formulários**:
- FormPro: ${lps.map((lp: any) => `${lp.form}(${lp.submissions})`).join(', ') || 'Nenhum'}
- Meta Lead Forms: ${mForms.map((f: any) => `${f.form}(${f.leads})`).join(', ') || 'Nenhum'}`);

  // ── CAMPANHAS DE ADS (UTM + Investimento) ──
  const adsCurrent = adsData.current;
  const adsToday = adsData.today;
  const adsYesterday = adsData.yesterday;

  // Total de leads de campanhas (UTM tracked)
  const totalUtmLeads = utms.reduce((s: number, u: any) => s + (u.leads ?? 0), 0);
  const totalUtmWon = utms.reduce((s: number, u: any) => s + (u.won ?? 0), 0);
  const cplCalc = totalUtmLeads > 0 && adsCurrent.total > 0 ? adsCurrent.total / totalUtmLeads : null;

  sections.push(`\n## 💰 CAMPANHAS DE ADS (Investimento + Performance)
**IMPORTANTE**: "Campanhas" aqui = campanhas de anúncios (Meta Ads, Google Ads) rastreadas via UTM.
**Investimento total no período**: ${fmtBRL(adsCurrent.total)}${adsCurrent.cac ? ` | CAC: ${fmtBRL(adsCurrent.cac)}` : ''}
**Hoje**: ${fmtBRL(adsToday.total)} | **Ontem**: ${fmtBRL(adsYesterday.total)} | **Δ**: ${delta(adsToday.total, adsYesterday.total)}

**Leads gerados por campanhas (UTM)**: ${totalUtmLeads} leads | ${totalUtmWon} ganhos
**CPL (Custo por Lead)**: ${cplCalc ? fmtBRL(cplCalc) : 'N/A (sem leads ou sem spend)'}

Atribuição UTM por fonte (campanhas → leads):
${utms.map((u: any) => `- ${u.source}/${u.medium}: ${u.leads} leads, ${u.won} ganhos`).join('\n') || '- Nenhuma campanha com UTM no período'}`);

  if (adsCurrent.byPlatform.length > 0) {
    sections.push(`Por plataforma: ${adsCurrent.byPlatform.map((p: any) => `${p.platform}: ${fmtBRL(p.spend)}`).join(' | ')}`);
  }

  if (adsCurrent.byDay.length > 0) {
    sections.push(`Investimento por dia (JSON para gráfico):
\`\`\`json
${JSON.stringify(adsCurrent.byDay)}
\`\`\``);
  }

  if (adsCurrent.topCampaigns.length > 0) {
    sections.push(`Top campanhas por investimento (JSON para gráfico):
\`\`\`json
${JSON.stringify(adsCurrent.topCampaigns)}
\`\`\``);
  }

  // ── PROSPECT ──
  const prosp = current.prospect ?? {};
  sections.push(`\n## 🎯 PROSPECÇÃO
- Campanhas: ${prosp.campaigns_total ?? 0} (${prosp.campaigns_running ?? 0} ativas)
- Contatos: ${prosp.contacts_total ?? 0} | Aprovados: ${(prosp.contacts_by_status ?? {}).approved ?? 0}
- AI Score médio: ${prosp.avg_ai_score ?? 0} | Aprovação: ${fmtPct(prosp.approval_rate ?? 0)}`);

  return sections.join('\n');
}

// ── Ads data fetcher (returns structured object, not text) ──────────────────
async function getAdsData(
  supabase: any,
  dateFilter: { from: string; to: string } | null,
  wonLeads: number,
): Promise<{ total: number; cac: number | null; byPlatform: any[]; byDay: any[]; topCampaigns: any[] }> {
  let spendQuery = supabase.from('bi_ad_spend').select('spend, date, campaign_id, platform');
  const campaignsQuery = supabase.from('bi_ad_campaigns').select('id, campaign_name, platform, status');

  if (dateFilter) {
    spendQuery = spendQuery.gte('date', dateFilter.from.split('T')[0]).lte('date', dateFilter.to.split('T')[0]);
  }

  const [spendResult, campaignsResult] = await Promise.all([spendQuery, campaignsQuery]);
  const adSpend: Array<{ spend: number; date: string; campaign_id: string; platform: string }> = spendResult.data ?? [];
  const campaigns: Array<{ id: string; campaign_name: string; platform: string; status: string }> = campaignsResult.data ?? [];

  const total = adSpend.reduce((s, r) => s + (Number(r.spend) || 0), 0);
  const cac = wonLeads > 0 && total > 0 ? total / wonLeads : null;

  // By platform
  const platformMap: Record<string, number> = {};
  for (const r of adSpend) {
    const p = r.platform || 'other';
    platformMap[p] = (platformMap[p] || 0) + (Number(r.spend) || 0);
  }
  const byPlatform = Object.entries(platformMap).map(([platform, spend]) => ({ platform, spend })).sort((a, b) => b.spend - a.spend);

  // By day
  const dayMap: Record<string, number> = {};
  for (const r of adSpend) {
    dayMap[r.date] = (dayMap[r.date] || 0) + (Number(r.spend) || 0);
  }
  const byDay = Object.entries(dayMap).map(([dia, valor]) => ({ dia, valor })).sort((a, b) => a.dia.localeCompare(b.dia));

  // Top campaigns
  const campSpend: Record<string, number> = {};
  for (const r of adSpend) {
    campSpend[r.campaign_id] = (campSpend[r.campaign_id] || 0) + (Number(r.spend) || 0);
  }
  const topCampaigns = campaigns
    .map(c => ({ campanha: c.campaign_name, plataforma: c.platform, valor: campSpend[c.id] || 0 }))
    .filter(c => c.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  return { total, cac, byPlatform, byDay, topCampaigns };
}

// ── System prompt ───────────────────────────────────────────────────────────
function buildSystemPrompt(contextText: string): string {
  return `Você é o Insights AI, assistente de BI conversacional do Growthsales CRM.
Data atual: ${new Date().toLocaleDateString('pt-BR')}.

# CAPACIDADES
Acesso completo a 8 áreas de dados do CRM:
1. **Leads/Funil** — leads por etapa, conversão, motivos de perda, receita, ciclo
2. **Pessoas & Empresas** — contatos, scoring, fontes de aquisição
3. **Mensagens/Conversas** — WhatsApp, email, SMS, conversas abandonadas
4. **Reuniões/Agendamentos** — reuniões marcadas, show rate por closer, tempo médio
5. **Chamadas** — inbound/outbound, taxa de atendimento, operadores
6. **Marketing** — disparos de mensagem (WhatsApp/Email), formulários, Meta Lead Forms
7. **Campanhas de Ads** — campanhas de anúncios (Meta/Google), investimento, CPL, CAC, UTM attribution, performance por campanha
8. **Prospecção** — campanhas, contatos, AI scoring

# DISTINÇÃO IMPORTANTE
- "Campanhas" = campanhas de ANÚNCIOS (Meta Ads, Google Ads) rastreadas via UTM. Dados em "CAMPANHAS DE ADS".
- "Disparos" = envios de mensagem (WhatsApp, Email, SMS). Dados em "MARKETING". NÃO confundir com campanhas de ads.
- Quando o usuário perguntar sobre "campanhas", SEMPRE responda com dados de CAMPANHAS DE ADS (investimento, CPL, leads por UTM), NÃO com dados de disparos.

# CONTEXTO CONVERSACIONAL
- Você está em uma CONVERSA contínua. Preste muita atenção ao histórico.
- Quando o usuário pedir refinamentos ("inclua X", "agora mostre Y", "mude para..."), use os dados da resposta anterior como base.
- Se o usuário pedir mudanças em gráficos anteriores, gere o novo gráfico com os ajustes pedidos — não recomeçe do zero.
- Mensagens marcadas como [gráfico gerado] no histórico indicam que um chart foi renderizado — o usuário pode estar se referindo a ele.

# INSTRUÇÕES GERAIS
- Sempre português brasileiro. Respostas diretas e objetivas.
- Formatação brasileira (ponto para milhares, vírgula para decimais).
- Seja específico com números. Cite a área/fonte dos dados.
- Se uma métrica estiver zerada HOJE, NUNCA responda só "sem dados". Mostre o valor do período completo e destaque que hoje ainda não houve movimentação. Exemplo: "Hoje ainda sem leads novos, mas no período você tem 142 leads com 23% de conversão."
- Quando o usuário perguntar sobre "investimento", "quanto gastei", "campanhas" ou "ads", SEMPRE consulte a seção CAMPANHAS DE ADS primeiro. Se não houver dados de ads, informe e sugira verificar a integração Meta/Google.
- Se não souber, diga claramente.
- Use **negrito** para métricas-chave. Use listas com - para organizar.
- Use tabelas markdown quando comparar 3+ itens.
- Foque no INSIGHT, não na descrição dos dados.

# GRÁFICOS — OBRIGATÓRIO
Quando a resposta incluir dados numéricos comparativos (temporais, ranking, distribuição), SEMPRE inclua um bloco de gráfico no formato abaixo. Isso é renderizado automaticamente como chart interativo.

Formato:
\`\`\`chart
{"type":"bar","title":"Título","data":[{"campo_x":"Label","campo_y":123}],"xKey":"campo_x","yKey":"campo_y","format":"brl"}
\`\`\`

Tipos disponíveis: bar, line, area, horizontal-bar, donut
Formatos: brl (R$), pct (%), number (inteiro)

Regras de gráfico:
- Dados temporais (por dia, semana, mês) → use "line" ou "area". Use os arrays "Leads por dia" e "Vendas por dia" do contexto — eles já estão prontos com campos {dia, leads} e {dia, vendas, receita}
- Rankings (top campanhas, closers, fontes) → use "horizontal-bar"
- Distribuição (por plataforma, canal, status) → use "donut"
- Comparações simples → use "bar"
- SEMPRE inclua title descritivo e format correto
- Dados no array devem ser objetos simples {campo_x, campo_y}
- Use nomes em português nos campos
- Para "leads por dia": xKey="dia", yKey="leads", type="area"
- Para "vendas por dia" (contagem): xKey="dia", yKey="vendas", type="line"
- Para "receita por dia": xKey="dia", yKey="receita", type="area", format="brl"
- Para gráfico combinado leads+vendas: inclua yKey2="vendas" se os dados tiverem ambos os campos

# ANÁLISE CRUZADA
Sempre cruze dados entre áreas quando relevante:
- Investimento (ads) + Leads (funil) = CPL real
- Leads + Reuniões = taxa de agendamento
- Reuniões + Show rate = eficiência de conversão
- Leads ganhos + Receita = ticket médio
- Campanhas (utm_campaign/utm_source nos leads) → Reuniões agendadas = quais campanhas geram mais reuniões
- Campanha → Lead → Reunião → Venda = funil completo por campanha
- Calcule e mostre essas métricas derivadas automaticamente.
- O campo "by_campaign" em reuniões mostra quais campanhas/fontes de marketing geraram reuniões (via lead UTM).

# DETECÇÃO DE ANOMALIAS
Compare dados de hoje vs ontem. Se houver variação > ±20% em qualquer métrica-chave (leads, receita, investimento, show rate), destaque com:
- 🔺 para aumento significativo
- 🔻 para queda significativa

# INSIGHT ACIONÁVEL
Quando identificar problemas, sugira ações concretas:
- CPL > 2x a média → "Considere pausar campanha X ou revisar público"
- Show rate < 50% → "Revise lembretes de agendamento"
- Conversão < 10% → "Analise motivos de perda na etapa Y"
- Receita caindo → "Foque em leads com score > 7"

# DADOS DO SISTEMA
${contextText}`;
}

// ── Main ─────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { message, history = [], context_hint = {} } = await req.json();

    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Mensagem não pode ser vazia.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 1. Get active AI provider
    let provider: Awaited<ReturnType<typeof getActiveProvider>>;
    try {
      provider = await getActiveProvider(supabase);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Nenhum provider de IA configurado. Acesse Configurações → Provedores IA.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 2. Build date ranges
    // Priority: explicit context_hint > parsed from message > default (current month)
    const hint: { date_from?: string; date_to?: string; pipeline_id?: string } = context_hint ?? {};
    const hasExplicitDates = !!(hint.date_from || hint.date_to);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Parse temporal intent from user message if no explicit dates
    if (!hasExplicitDates) {
      const temporal = parseTemporalIntent(message, history);
      if (temporal) {
        hint.date_from = temporal.from;
        hint.date_to = temporal.to;
      } else {
        // Default: current month
        const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        hint.date_from = monthStart.toISOString();
        hint.date_to = new Date().toISOString();
      }
    }

    const hasHint = true; // Always has dates now
    const periodSource = hasExplicitDates ? 'explicit' : 'parsed';

    const rpcParams: Record<string, any> = {};
    if (hint.date_from) rpcParams.p_date_from = hint.date_from;
    if (hint.date_to) rpcParams.p_date_to = hint.date_to;
    if (hint.pipeline_id) rpcParams.p_pipeline_id = hint.pipeline_id;
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayStart);
    yesterdayEnd.setMilliseconds(-1);

    const todayFilter = { from: todayStart.toISOString(), to: todayEnd.toISOString() };
    const yesterdayFilter = { from: yesterdayStart.toISOString(), to: yesterdayEnd.toISOString() };
    const adsDateFilter = hasHint && hint.date_from && hint.date_to
      ? { from: hint.date_from, to: hint.date_to } : null;

    // 3. Fetch all data in parallel
    const [rpcAll, rpcToday, rpcYesterday, adsCurrent, adsToday, adsYesterday] = await Promise.all([
      supabase.rpc('get_insights_context', hasHint ? rpcParams : {}),
      supabase.rpc('get_insights_context', {
        p_date_from: todayStart.toISOString(),
        p_date_to: todayEnd.toISOString(),
      }),
      supabase.rpc('get_insights_context', {
        p_date_from: yesterdayStart.toISOString(),
        p_date_to: yesterdayEnd.toISOString(),
      }),
      getAdsData(supabase, adsDateFilter, 0),
      getAdsData(supabase, todayFilter, 0),
      getAdsData(supabase, yesterdayFilter, 0),
    ]);

    if (rpcAll.error) console.error('[bi-insights-chat] RPC (all) error:', JSON.stringify(rpcAll.error));
    if (rpcToday.error) console.error('[bi-insights-chat] RPC (today) error:', JSON.stringify(rpcToday.error));

    const insightsData = rpcAll.data ?? {};
    const todayData = rpcToday.data ?? {};
    const yesterdayData = rpcYesterday.data ?? {};

    // Recalculate CAC with actual won count
    const wonCount = insightsData.funnel?.won ?? 0;
    if (wonCount > 0) {
      adsCurrent.cac = adsCurrent.total > 0 ? adsCurrent.total / wonCount : null;
    }

    // 4. RAG-lite block selection
    const relevantBlocks = selectBlocks(message, history);
    const filteredInsights = filterContextByBlocks(insightsData, relevantBlocks);
    const filteredToday = filterContextByBlocks(todayData, relevantBlocks);
    const filteredYesterday = filterContextByBlocks(yesterdayData, relevantBlocks);

    const periodLabel = `${hint.date_from?.split('T')[0] ?? '∞'} → ${hint.date_to?.split('T')[0] ?? '∞'}`;

    // 5. Build structured context
    const contextText = buildStructuredContext(
      filteredInsights, filteredToday, filteredYesterday,
      { current: adsCurrent, today: adsToday, yesterday: adsYesterday },
      periodLabel,
    );

    const systemPrompt = buildSystemPrompt(contextText);

    // 6. Build messages
    const messages = [
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // 7. Call provider via shared helper
    const llmResult = await callLLM(provider, {
      system: systemPrompt,
      messages,
      maxTokens: 3072,
    });
    const responseText = llmResult.text || 'Erro ao processar resposta.';

    return new Response(
      JSON.stringify({ response: responseText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[bi-insights-chat] error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
