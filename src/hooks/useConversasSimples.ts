import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// PostgREST `.or()` interpreta `,` como separador e `()` como agrupamento — se o
// usuário digitar esses chars no searchTerm cai em "PostgREST filter injection"
// que quebra a query (não é SQLi, mas equivalente: muda a semântica do filtro).
// Sanitização: remove os metacaracteres do dialeto PostgREST e trim length.
function sanitizeSearchTerm(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().slice(0, 100);
  if (!trimmed) return null;
  // Remove `,` `(` `)` `*` `\` `:` que têm semântica especial em .or()/ilike()
  return trimmed.replace(/[,()*\\:]/g, '').trim() || null;
}

interface ConversasSimplesParams {
  tenantId: string;
  searchTerm?: string;
  statusAtendimento?: string;
  filtroData?: string | null;
  filtroResponsavel?: string;
  filtroPipeline?: string;
  filtroEtapa?: string;
  atendimentoIA?: string;
  filtroTime?: string;
  filtroTag?: string;
  filtroChannel?: string;
  limit?: number;
  offset?: number;
}

/** Try the get_omni_contacts RPC; return null on any error so the caller falls back. */
async function tryRpc(params: ConversasSimplesParams): Promise<{ data: any[]; count: number } | null> {
  try {
    const { data: rpcData, error } = await (supabase.rpc as any)('get_omni_contacts', {
      p_search_term:  sanitizeSearchTerm(params.searchTerm),
      p_status_atend: (params.statusAtendimento && params.statusAtendimento !== 'todos') ? params.statusAtendimento : null,
      p_atend_ia:     (params.atendimentoIA     && params.atendimentoIA     !== 'todos') ? params.atendimentoIA     : null,
      p_filtro_data:  params.filtroData || null,
      p_responsavel:  (params.filtroResponsavel && params.filtroResponsavel !== 'todos') ? params.filtroResponsavel : null,
      p_pipeline:     (params.filtroPipeline    && params.filtroPipeline    !== 'todos') ? params.filtroPipeline    : null,
      p_etapa:        (params.filtroEtapa       && params.filtroEtapa       !== 'todos') ? params.filtroEtapa       : null,
      p_time:         (params.filtroTime        && params.filtroTime        !== 'todos') ? params.filtroTime        : null,
      p_limit:        params.limit  ?? 20,
      p_offset:       params.offset ?? 0,
      p_tag:          (params.filtroTag         && params.filtroTag         !== 'todos') ? params.filtroTag         : null,
      p_channel:      (params.filtroChannel     && params.filtroChannel     !== 'todos') ? params.filtroChannel     : null,
    });

    if (error) {
      console.warn('[useConversasSimples] rpc unavailable, using fallback:', error.message);
      return null;
    }

    const rows = (rpcData as any[]) || [];
    const count = rows.length > 0 ? Number(rows[0].total_count) : 0;
    const contacts = rows.map((r: any) => r.contact);
    return { data: contacts, count };
  } catch (e) {
    console.warn('[useConversasSimples] rpc exception, using fallback:', (e as Error).message);
    return null;
  }
}

/** Direct PostgREST fallback — shows all WA/IG/TikTok/email contacts ordered by updated_at. */
async function directQuery(params: ConversasSimplesParams): Promise<{ data: any[]; count: number }> {
  // When a responsável filter is active, resolve the allowed people_ids first
  let allowedPeopleIds: string[] | null = null;
  if (params.filtroResponsavel && params.filtroResponsavel !== 'todos') {
    const { data: leadsData } = await supabase
      .from('leads')
      .select('people_id')
      .eq('user_id', params.filtroResponsavel)
      .not('people_id', 'is', null)
      .not('status', 'in', '("lost","archived")');
    allowedPeopleIds = [...new Set((leadsData ?? []).map((l: any) => l.people_id).filter(Boolean))];
    if (allowedPeopleIds.length === 0) return { data: [], count: 0 };
  }

  let tagPeopleIds: string[] | null = null;
  if (params.filtroTag && params.filtroTag !== 'todos') {
    const { data: taggedLeads } = await supabase
      .from('leads_tags')
      .select('lead:leads(people_id)')
      .eq('tag_id', params.filtroTag);
    tagPeopleIds = [...new Set((taggedLeads ?? []).map((r: any) => r.lead?.people_id).filter(Boolean))];
    if (tagPeopleIds.length === 0) return { data: [], count: 0 };
  }

  let query = supabase
    .from('clients_people')
    .select('*', { count: 'exact' })
    .or('whatsapp.not.is.null,instagram_id.not.is.null,tiktok_open_id.not.is.null,email.not.is.null')
    .neq('status', 'merged')
    .order('updated_at', { ascending: false });

  if (allowedPeopleIds) query = (query as any).in('id', allowedPeopleIds);
  if (tagPeopleIds) query = (query as any).in('id', tagPeopleIds);
  // active_channel_id é coluna direta em clients_people — sem precisar de lookup em 2 passos.
  if (params.filtroChannel && params.filtroChannel !== 'todos') {
    query = (query as any).eq('active_channel_id', params.filtroChannel);
  }

  const sanitizedSearch = sanitizeSearchTerm(params.searchTerm);
  if (sanitizedSearch) {
    query = query.or(`name.ilike.%${sanitizedSearch}%,whatsapp.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%`);
  }
  if (params.statusAtendimento && params.statusAtendimento !== 'todos') {
    // Include null service_status when filtering 'open': contacts that predate
    // the p10 migration may still have service_status=null, which semantically
    // means "open" (never explicitly closed).
    if (params.statusAtendimento === 'open') {
      query = query.or('service_status.eq.open,service_status.is.null');
    } else {
      query = query.eq('service_status', params.statusAtendimento);
    }
  }
  if (params.atendimentoIA === 'ia_ativa') query = query.eq('ai_enabled', true);
  if (params.atendimentoIA === 'humano')   query = query.eq('ai_enabled', false);
  if (params.filtroData) {
    const [from, to] = params.filtroData.split('_');
    // Valida formato YYYY-MM-DD pra evitar passar lixo (espaços, sql-ish) pro Postgres.
    const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (from && to && isoDateRe.test(from) && isoDateRe.test(to)) {
      query = query.gte('updated_at', `${from}T00:00:00`).lte('updated_at', `${to}T23:59:59`);
    }
  }
  if (params.limit)  query = query.limit(params.limit);
  if (params.offset) query = query.range(params.offset, params.offset + (params.limit || 20) - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error('[useConversasSimples] fallback query error:', error);
    throw error;
  }
  return { data: data || [], count: count || 0 };
}

export const useConversasSimples = (params: ConversasSimplesParams) => {
  return useQuery({
    queryKey: ['conversas-simples-v5', params],
    queryFn: async () => {
      const rpc = await tryRpc(params);
      const raw = rpc ?? await directQuery(params);

      return {
        data: raw.data.map((p: any) => ({
          ...p,
          leads: undefined,
          nome: p.name,
          data_ultima_mensagem: p.updated_at,
          ultima_mensagem: null,
          total_mensagens: 0,
          resumo_conversa: p.conversation_summary,
          disc_resumo: p.disc_summary,
        })),
        count: raw.count,
      };
    },
    enabled: !!params.tenantId,
    staleTime: 10000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
};
