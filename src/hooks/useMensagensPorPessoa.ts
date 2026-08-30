import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMessageStabilizer } from './useMessageStabilizer';
import { resolveCanonicalPersonId, resolvePersonMergeChain } from '@/lib/personMerge';
import { useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface MensagemDetalhada {
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
  user_id?: string;
  user_name?: string;
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
  lead?: {
    pessoa?: {
      nome: string;
      whatsapp?: string;
    };
  };
}

// tenantId is kept for backward compat but not used — RLS handles isolation
export const useMensagensPorPessoa = (pessoaId?: string, tenantId?: string) => {
  const queryClient = useQueryClient();
  const lastErrorToastRef = useRef<number>(0);

  const queryResult = useQuery({
    queryKey: ['mensagens-por-pessoa-v2', pessoaId],
    queryFn: async (): Promise<MensagemDetalhada[]> => {
      if (!pessoaId) {
        return [];
      }

      // Se a pessoa selecionada foi merged em outra, o histórico está atrelado ao
      // canonical — buscamos nele para garantir histórico completo.
      const effectivePessoaId = await resolveCanonicalPersonId(pessoaId);

      // Fetch all lead IDs for this person — needed to also catch messages that were
      // stored with only lead_id (people_id = null), which is common for older records
      // and for inbound webhooks that predate the people_id backfill.
      const { data: personLeads } = await supabase
        .from('leads')
        .select('id')
        .eq('people_id', effectivePessoaId)
        .limit(50);
      const leadIds = (personLeads || []).map((l: any) => String(l.id)).filter(Boolean);

      // OR filter: messages linked directly to this person, OR to any of their leads
      const orFilter = leadIds.length > 0
        ? `people_id.eq.${effectivePessoaId},lead_id.in.(${leadIds.join(',')})`
        : `people_id.eq.${effectivePessoaId}`;

      // Paginação automática com safety limit para prevenir memory exhaustion
      const allMensagens: MensagemDetalhada[] = [];
      let start = 0;
      const limit = 50000;
      const MAX_MESSAGES = 100000;
      let hasMore = true;

      while (hasMore && allMensagens.length < MAX_MESSAGES) {

        const { data, error } = await supabase
          .from('messages')
          .select(`
            *,
            lead:leads(
              pessoa:clients_people(name, whatsapp)
            ),
            user:settings_users!messages_users_id_fkey(id, name)
          `)
          .or(orFilter)
          .order('created_at', { ascending: true })
          .range(start, start + limit - 1);

        if (error) {
          console.error('❌ MENSAGENS: Erro ao buscar:', error);
          // Toast visível mas throttled — usuário precisa saber, mas não pode spammar
          const now = Date.now();
          if (now - lastErrorToastRef.current > 15000) {
            lastErrorToastRef.current = now;
            toast.error('Erro ao carregar mensagens', {
              description: error.message || 'Verifique sua conexão e tente novamente.',
            });
          }
          throw error;
        }

        if (data && data.length > 0) {
          const mapped = data.map((msg: any) => ({
            id: msg.id,
            lead_id: msg.lead_id,
            pessoa_id: msg.people_id,
            from_message: msg.from_contact,
            message: msg.content,
            tipo_mensagem: msg.message_type,
            status: msg.status || 'sent',
            whatsapp_template_id: msg.whatsapp_template_id,
            channel: msg.channel || 'whatsapp',
            created_at: msg.created_at,
            user_id: msg.user_id,
            user_name: msg.user?.name || null,
            media_url: msg.media_url || null,
            media_metadata: msg.media_metadata || null,
            source_type: msg.source_type || null,
            metadata: msg.metadata || null,
            lead: msg.lead ? {
              pessoa: msg.lead.pessoa ? {
                nome: msg.lead.pessoa.name,
                whatsapp: msg.lead.pessoa.whatsapp
              } : undefined
            } : undefined
          }));
          allMensagens.push(...mapped);
          start += limit;
          hasMore = data.length === limit;
        } else {
          hasMore = false;
        }

      }

      return allMensagens;
    },
    enabled: !!pessoaId,
    staleTime: 0, // Sempre considerar stale para permitir refetch imediato
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false, // Desativado para evitar fechamento de modais
    refetchOnReconnect: true,
    // Polling exponential backoff: 5s normal; após falhas, dobra até teto de 60s.
    // Evita drenagem de bateria/CPU/RLS-flood quando há erro persistente (ex: JWT expirado).
    refetchInterval: (query) => {
      const failures = query.state.fetchFailureCount;
      if (failures === 0) return 5 * 1000;
      const backoff = Math.min(5 * 1000 * Math.pow(2, failures), 60 * 1000);
      return backoff;
    },
    refetchIntervalInBackground: true,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  // Sistema de deduplicação avançado com cache local
  const processedMessages = useMemo(() => {
    const rawMessages = queryResult.data || [];
    
    if (rawMessages.length === 0) {
      return [];
    }

    // Processamento direto sem throttling

    // Etapa 1: Deduplicação estrita por ID
    const uniqueById = new Map<number, MensagemDetalhada>();
    rawMessages.forEach(message => {
      const id = Number(message.id);
      if (!uniqueById.has(id)) {
        uniqueById.set(id, message);
      }
    });

    const afterIdDedup = Array.from(uniqueById.values());

    // Etapa 2: Deduplicação temporal por conteúdo
    const finalMessages: MensagemDetalhada[] = [];
    const seenSignatures = new Set<string>();

    for (const message of afterIdDedup) {
      const timestamp = new Date(message.created_at).getTime();
      const roundedTime = Math.floor(timestamp / 3000) * 3000; // 3 segundos
      const signature = `${(message.message || '').trim()}_${message.from_message}_${roundedTime}`;

      if (!seenSignatures.has(signature)) {
        seenSignatures.add(signature);
        finalMessages.push(message);
      }
    }

    // Etapa 3: Ordenação final
    finalMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return finalMessages;
  }, [queryResult.data]);

  // Aplicar estabilização final
  const stabilizedMessages = useMessageStabilizer(processedMessages);

  // Setup realtime subscription
  // Inscreve tanto o pessoaId selecionado quanto o canonical (merged_into) caso aplique,
  // porque inbound webhooks podem gravar em qualquer um dos dois em janelas de merge.
  useEffect(() => {
    if (!pessoaId) return;

    let cancelled = false;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    const setup = async () => {
      // Inbound pode gravar em qualquer id da cadeia durante uma janela de merge.
      const idsToWatch = await resolvePersonMergeChain(pessoaId);

      if (cancelled) return;

      idsToWatch.forEach((watchId) => {
        const channel = supabase
          .channel(`messages-pessoa-${watchId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages',
              filter: `people_id=eq.${watchId}`,
            },
            () => {
              queryClient.invalidateQueries({
                queryKey: ['mensagens-por-pessoa-v2', pessoaId],
              });
            }
          )
          .subscribe((status, err) => {
            // CHANNEL_ERROR / TIMED_OUT são silenciosos por padrão. Polling de 5s
            // cobre o caso, mas logamos para diagnóstico de queda de realtime.
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              console.warn(`⚠️ MENSAGENS: realtime channel ${status} para ${watchId}`, err?.message || '');
            }
          });
        channels.push(channel);
      });
    };

    setup().catch((err) => {
      // setup() não pode falhar silenciosamente — polling sobrevive mas é bom logar.
      console.error('❌ MENSAGENS: realtime setup falhou', err);
    });

    return () => {
      cancelled = true;
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [pessoaId, queryClient]);
  
  return {
    ...queryResult,
    data: stabilizedMessages
  };
};