import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OmniMensagemRow {
  id: number;
  sent_at: string | null;
  created_at: string | null;
  channel: string | null;
  message_type: string | null;
  from_contact: string | null;
  source_type: string | null;
  module_ref_id: string | null;
  content: string | null;
  status: string | null;
  people_id: string | null;
  lead_id: string | null;
  pessoa_nome: string | null;
  // computed for display
  ts: string | null; // sent_at ?? created_at
}

export interface OmniMensagensFilters {
  channel?: string;       // '' = todos
  direction?: string;     // '' | 'entrada' | 'saida'
  source_type?: string;   // '' = todos
  dateFrom?: string;      // ISO
  dateTo?: string;        // ISO
  search?: string;        // busca no content
  responsavelId?: string; // settings_users.id — limita às pessoas/leads do usuário
  _refreshKey?: number;   // força nova query ao incrementar (cache-bust via queryKey)
}

const PAGE_SIZE = 50;

export function useOmniMensagens(filters: OmniMensagensFilters = {}) {
  const { channel, direction, source_type, dateFrom, dateTo, search, responsavelId } = filters;

  return useInfiniteQuery({
    queryKey: ['omni-mensagens', filters],
    queryFn: async ({ pageParam = null }: { pageParam: string | null }) => {
      // Restrict to people assigned to this user via leads.user_id
      let allowedPeopleIds: string[] | null = null;
      if (responsavelId) {
        const { data: leadsData } = await supabase
          .from('leads')
          .select('people_id')
          .eq('user_id', responsavelId)
          .not('people_id', 'is', null);
        allowedPeopleIds = [...new Set((leadsData ?? []).map((l: { people_id: string }) => l.people_id))];
        if (allowedPeopleIds.length === 0) return { rows: [], nextCursor: null };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from('messages')
        .select(`
          id, sent_at, created_at, channel, message_type, from_contact,
          source_type, module_ref_id, content, status,
          people_id, lead_id,
          person:clients_people(name)
        `)
        // Order by created_at DESC — sempre populado (NOT NULL DEFAULT now()).
        // sent_at fica NULL em mensagens inbound (webhook não preenche), então
        // ordenar por sent_at jogaria toda conversa recebida pro final.
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      // Cursor pagination keyset em created_at (sempre presente).
      if (pageParam) q = q.lt('created_at', pageParam);

      // Ownership filter
      if (allowedPeopleIds) q = q.in('people_id', allowedPeopleIds);

      // Filters
      if (channel)     q = q.eq('channel', channel);
      if (source_type) q = q.eq('source_type', source_type);
      if (dateFrom)    q = q.gte('created_at', dateFrom);
      if (dateTo)      q = q.lte('created_at', dateTo);

      if (direction === 'entrada') {
        q = q.eq('from_contact', 'cliente');
      } else if (direction === 'saida') {
        q = q.neq('from_contact', 'cliente');
      }

      if (search) {
        q = q.ilike('content', `%${search}%`);
      }

      const { data, error } = await q;
      if (error) throw error;

      const rows: OmniMensagemRow[] = (data ?? []).map((r: Record<string, unknown>) => {
        const sentAt    = r.sent_at    as string | null;
        const createdAt = r.created_at as string | null;
        return {
          id:            r.id as number,
          sent_at:       sentAt,
          created_at:    createdAt,
          ts:            sentAt ?? createdAt,
          channel:       r.channel       as string | null,
          message_type:  r.message_type  as string | null,
          from_contact:  r.from_contact  as string | null,
          source_type:   r.source_type   as string | null,
          module_ref_id: r.module_ref_id as string | null,
          content:       r.content       as string | null,
          status:        r.status        as string | null,
          people_id:     r.people_id     as string | null,
          lead_id:       r.lead_id       as string | null,
          pessoa_nome:   (r.person as Record<string, unknown> | null)?.name as string | null ?? null,
        };
      });

      const lastItem = rows[rows.length - 1];
      const nextCursor = rows.length === PAGE_SIZE ? lastItem?.created_at ?? null : null;

      return { rows, nextCursor };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
