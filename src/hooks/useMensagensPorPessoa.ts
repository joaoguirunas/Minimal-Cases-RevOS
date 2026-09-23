import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolvePersonMergeChain } from '@/lib/personMerge';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';

export interface MensagemDetalhada {
  id: number;
  lead_id: string;
  pessoa_id?: string;
  from_message: string;
  message: string;
  tipo_mensagem?: string;
  status: string;
  whatsapp_template_id?: string;
  channel?: string;
  created_at: string;
  sent_at?: string | null;
  user_id?: string;
  user_name?: string | null;
  media_url?: string | null;
  media_metadata?: {
    file_name?: string;
    mime_type?: string;
    file_size?: number;
    comment_id?: string;
    post_id?: string;
    parent_comment_id?: string;
    reply_to_comment_id?: string;
    [key: string]: unknown;
  } | null;
  source_type?: string | null;
  metadata?: { error_reason?: string; template_name?: string; form_name?: string; form_fields?: { label: string; value: string }[]; [key: string]: any } | null;
  parent_message_id?: number | null;
  wa_message_id?: string | null;
}

/** Raiz da query key — quem precisar forçar atualização invalida `[MENSAGENS_KEY, pessoaId]`. */
export const MENSAGENS_KEY = 'mensagens-por-pessoa-v3';
const PAGE = 50;

interface Cursor { at: string; id: number }

/** Ordem estável: data, e o id desempata mensagens do mesmo instante. */
export function compareMensagens(a: { created_at: string; id: number | string }, b: { created_at: string; id: number | string }): number {
  const dt = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  if (dt !== 0) return dt;
  return Number(a.id) - Number(b.id);
}

function mapRow(m: any): MensagemDetalhada {
  return {
    id: Number(m.id),
    lead_id: m.lead_id,
    pessoa_id: m.people_id,
    from_message: m.from_contact,
    message: m.content,
    tipo_mensagem: m.message_type,
    status: m.status || 'sent',
    whatsapp_template_id: m.whatsapp_template_id,
    channel: m.channel || 'whatsapp',
    created_at: m.created_at,
    sent_at: m.sent_at ?? null,
    user_id: m.user_id,
    user_name: m.user_name ?? null,
    media_url: m.media_url || null,
    media_metadata: m.media_metadata || null,
    source_type: m.source_type || null,
    metadata: m.metadata || null,
    parent_message_id: m.parent_message_id ?? null,
    wa_message_id: m.wa_message_id ?? null,
  };
}

/** Uma página (50) da conversa, da mais nova para a mais antiga. Uma consulta só. */
async function fetchPage(pessoaId: string, cursor: Cursor | null): Promise<MensagemDetalhada[]> {
  const { data, error } = await (supabase.rpc as any)('get_person_messages', {
    p_people_id: pessoaId,
    p_before_at: cursor?.at ?? null,
    p_before_id: cursor?.id ?? null,
    p_limit: PAGE,
  });
  if (error) throw error;
  return ((data ?? []) as any[]).map(mapRow);
}

type Pages = InfiniteData<MensagemDetalhada[], Cursor | null>;

// tenantId é mantido por compatibilidade — a RLS isola os dados.
export const useMensagensPorPessoa = (pessoaId?: string, _tenantId?: string) => {
  const queryClient = useQueryClient();
  const lastErrorToastRef = useRef<number>(0);
  const queryKey = useMemo(() => [MENSAGENS_KEY, pessoaId], [pessoaId]);

  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      try {
        return await fetchPage(pessoaId!, pageParam as Cursor | null);
      } catch (error: any) {
        const now = Date.now();
        if (now - lastErrorToastRef.current > 15000) {
          lastErrorToastRef.current = now;
          toast.error('Erro ao carregar mensagens', { description: error?.message || 'Verifique sua conexão e tente novamente.' });
        }
        throw error;
      }
    },
    initialPageParam: null as Cursor | null,
    getNextPageParam: (last) => {
      if (last.length < PAGE) return undefined;
      const oldest = last[last.length - 1];
      return { at: oldest.created_at, id: oldest.id };
    },
    enabled: !!pessoaId,
    // Voltar para uma conversa já aberta mostra o cache na hora; o tempo real
    // e o refresh da página mais nova mantêm tudo em dia sem rebaixar tudo.
    staleTime: 30_000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  /**
   * Busca só as 50 mais novas e funde no cache por id (novas entram, as que
   * mudaram — status, ticks — são atualizadas). Nada some da tela no meio.
   */
  const refreshingRef = useRef(false);
  const refreshLatest = useCallback(async () => {
    if (!pessoaId || refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const fresh = await fetchPage(pessoaId, null);
      queryClient.setQueryData<Pages>([MENSAGENS_KEY, pessoaId], (old) => {
        if (!old || old.pages.length === 0) return { pages: [fresh], pageParams: [null] };
        const freshById = new Map(fresh.map((m) => [m.id, m]));
        const pages = old.pages.map((p) => p.map((m) => freshById.get(m.id) ?? m));
        const known = new Set(pages.flat().map((m) => m.id));
        const novas = fresh.filter((m) => !known.has(m.id));
        pages[0] = [...novas, ...pages[0]];
        return { ...old, pages };
      });
    } catch {
      // silencioso: a checagem periódica tenta de novo
    } finally {
      refreshingRef.current = false;
    }
  }, [pessoaId, queryClient]);

  // Tempo real: evento em messages da pessoa (ou da cadeia de merge) → busca só
  // as novidades. Rajadas (várias mensagens seguidas) viram uma busca só.
  useEffect(() => {
    if (!pessoaId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channels: ReturnType<typeof supabase.channel>[] = [];
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void refreshLatest(); }, 250);
    };

    resolvePersonMergeChain(pessoaId).then((ids) => {
      if (cancelled) return;
      ids.forEach((watchId) => {
        const channel = supabase
          .channel(`messages-pessoa-${watchId}-${Math.random().toString(36).slice(2, 8)}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `people_id=eq.${watchId}` }, schedule)
          .subscribe((status, err) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.warn(`⚠️ MENSAGENS: realtime ${status} para ${watchId}`, err?.message || '');
            }
          });
        channels.push(channel);
      });
    }).catch((err) => console.error('❌ MENSAGENS: realtime setup falhou', err));

    // Rede de segurança (mensagem gravada só com lead_id, queda do realtime):
    // a cada 60 s, só com a aba visível, busca a página mais nova.
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') void refreshLatest();
    }, 60_000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [pessoaId, refreshLatest]);

  const mensagens = useMemo(() => {
    const byId = new Map<number, MensagemDetalhada>();
    for (const page of query.data?.pages ?? []) for (const m of page) if (!byId.has(m.id)) byId.set(m.id, m);
    return Array.from(byId.values()).sort(compareMensagens);
  }, [query.data]);

  return {
    ...query,
    data: mensagens,
    /** Carrega a página anterior (mensagens mais antigas). */
    fetchOlder: query.fetchNextPage,
    hasOlder: !!query.hasNextPage,
    isFetchingOlder: query.isFetchingNextPage,
    refreshLatest,
  };
};
