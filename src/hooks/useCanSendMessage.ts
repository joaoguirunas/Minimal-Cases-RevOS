import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from './useSettings';

interface CanSendMessageResult {
  canSend: boolean;
  reason?: string;
  needsTemplate: boolean;
  isAIActive?: boolean;
  /** Set when canSend=true via private_reply path (commentator with no DM history).
   *  Contains the most recent comment_id — the frontend must pass this as reply_to_comment_id. */
  commentId?: string;
}

export const useCanSendMessage = (leadId?: string, canal?: 'whatsapp' | 'instagram' | 'email' | 'sms' | 'telefone' | 'tiktok', pessoaId?: string) => {
  const { data: settings } = useSettings();
  const isWhatsappOficial = settings?.whatsapp_provider === 'whatsapp-oficial';
  const canalEfetivo = canal || 'whatsapp';

  return useQuery({
    queryKey: ['can-send-message', leadId, pessoaId, isWhatsappOficial, canalEfetivo],
    queryFn: async (): Promise<CanSendMessageResult> => {
      console.log('🔍 useCanSendMessage: Verificando permissões', { leadId, pessoaId, canalEfetivo });

      if (!leadId && !pessoaId) {
        return { canSend: false, reason: 'Lead não encontrado', needsTemplate: false };
      }

      // Canais totalmente livres: email, SMS, telefone sem restrição
      if (canalEfetivo === 'email' || canalEfetivo === 'sms' || canalEfetivo === 'telefone') {
        return { canSend: true, needsTemplate: false };
      }

      // Buscar lead com dados da pessoa associada (para checar IA ativa)
      // Aceita lead_id OU people_id — busca pela pessoa quando lead não disponível
      let lead: Record<string, unknown> | null = null;
      let leadError: Error | null = null;

      if (leadId) {
        const res = await supabase
          .from('leads')
          .select(`id, people_id, clients_people!leads_people_id_fkey(id, ai_enabled, active_channel_id)`)
          .eq('id', leadId)
          .maybeSingle();
        lead = res.data;
        leadError = res.error;
      } else if (pessoaId) {
        // Sem lead_id: buscar dados da pessoa diretamente
        const res = await supabase
          .from('clients_people')
          .select('id, ai_enabled, active_channel_id')
          .eq('id', pessoaId)
          .maybeSingle();
        if (res.data) {
          lead = { people_id: pessoaId, clients_people: res.data };
        }
        leadError = res.error;
      }

      console.log('🔍 useCanSendMessage: Lead verificado', {
        leadId,
        pessoaId,
        aiEnabled: lead?.clients_people?.ai_enabled,
        error: leadError
      });

      // Instagram: janela de 7 dias — apenas DM direto ou resposta de Story abre a janela.
      // Comentários em posts NÃO abrem a janela de DM na API do Meta (só abrem a API de Comentários).
      if (canalEfetivo === 'instagram') {
        const igQuery = supabase
          .from('messages')
          .select('created_at')
          .eq('from_contact', 'cliente')
          .eq('channel', 'instagram')
          .neq('message_type', 'comentario')
          .order('created_at', { ascending: false })
          .limit(1);
        if (pessoaId) igQuery.eq('people_id', pessoaId);
        else if (leadId) igQuery.eq('lead_id', leadId);
        const { data: lastInteraction } = await igQuery.maybeSingle();

        if (!lastInteraction) {
          // No DM/story interaction — check if person commented on a post.
          // If they did, we can send a private reply to that comment (POST /{comment_id}/private_replies)
          // which does NOT require IGSID or a prior DM session.
          const commentQuery = supabase
            .from('messages')
            .select('media_metadata')
            .eq('from_contact', 'cliente')
            .eq('channel', 'instagram')
            .eq('message_type', 'comentario')
            .order('created_at', { ascending: false })
            .limit(1);
          if (pessoaId) commentQuery.eq('people_id', pessoaId);
          else if (leadId) commentQuery.eq('lead_id', leadId);
          const { data: lastComment } = await commentQuery.maybeSingle();

          const commentId = (lastComment?.media_metadata as Record<string, string> | null)?.comment_id;

          if (commentId) {
            // Allow send via private_reply path — frontend will set tipo_mensagem='private_reply'
            return { canSend: true, needsTemplate: false, isAIActive: false, commentId };
          }

          return {
            canSend: false,
            reason: 'Aguardando DM ou resposta de Story do cliente. Comentários em posts não abrem a janela de mensagens diretas do Instagram.',
            needsTemplate: false,
            isAIActive: false,
          };
        }

        const hoursDiff = (Date.now() - new Date(lastInteraction.created_at).getTime()) / (1000 * 60 * 60);
        if (hoursDiff > 168) { // 7 dias = 168h
          return {
            canSend: false,
            reason: 'Janela de 7 dias expirada. Aguarde uma nova DM ou resposta de Story do cliente.',
            needsTemplate: false,
            isAIActive: false,
          };
        }

        return { canSend: true, needsTemplate: false, isAIActive: false };
      }

      // TikTok: janela de 7 dias — mesmo modelo do Instagram
      if (canalEfetivo === 'tiktok') {
        const ttQuery = supabase
          .from('messages')
          .select('created_at')
          .eq('from_contact', 'cliente')
          .eq('channel', 'tiktok')
          .order('created_at', { ascending: false })
          .limit(1);
        if (pessoaId) ttQuery.eq('people_id', pessoaId);
        else if (leadId) ttQuery.eq('lead_id', leadId);
        const { data: lastTTMessage } = await ttQuery.maybeSingle();

        if (!lastTTMessage) {
          return {
            canSend: false,
            reason: 'Aguardando mensagem do cliente via TikTok DM para abrir a janela de 7 dias.',
            needsTemplate: false,
            isAIActive: false,
          };
        }

        const hoursDiff = (Date.now() - new Date(lastTTMessage.created_at).getTime()) / (1000 * 60 * 60);
        if (hoursDiff > 168) { // 7 dias = 168h
          return {
            canSend: false,
            reason: 'Janela TikTok expirada (7 dias). Aguarde nova mensagem do cliente.',
            needsTemplate: false,
            isAIActive: false,
          };
        }

        return { canSend: true, needsTemplate: false, isAIActive: false };
      }

      // VERIFICAÇÃO DE IA: bloqueia apenas WhatsApp (único canal com restrições de janela)
      if (lead?.clients_people?.ai_enabled === true) {
        console.log('🤖 useCanSendMessage: IA está ativa - bloqueando envio WhatsApp');
        return {
          canSend: false,
          reason: 'O atendimento está sendo realizado pela IA. Desative o controle de IA para enviar mensagens manualmente.',
          needsTemplate: false,
          isAIActive: true
        };
      }

      // Janela de 24h + exigência de template é uma regra do WhatsApp Cloud API
      // (Meta), não do WhatsApp não-oficial (Evolution/Baileys — sessão comum
      // do WhatsApp Web, sem restrição de horário nem necessidade de template
      // pra reabrir conversa). Resolve o provider do canal atual do lead
      // (active_channel_id) e, se ainda não sincronizado, cai pro canal padrão.
      const activeChannelId = (lead?.clients_people as { active_channel_id?: string | null } | undefined)?.active_channel_id;
      let effectiveProvider: 'meta' | 'evolution' = 'meta';
      if (activeChannelId) {
        const { data: chan } = await supabase
          .from('settings_whatsapp_channels')
          .select('provider')
          .eq('id', activeChannelId)
          .maybeSingle();
        if (chan?.provider) effectiveProvider = chan.provider as 'meta' | 'evolution';
      } else {
        const { data: defaultChan } = await supabase
          .from('settings_whatsapp_channels')
          .select('provider')
          .eq('is_default', true)
          .eq('active', true)
          .maybeSingle();
        if (defaultChan?.provider) effectiveProvider = defaultChan.provider as 'meta' | 'evolution';
      }

      if (effectiveProvider === 'evolution') {
        return { canSend: true, needsTemplate: false, isAIActive: false };
      }

      // Verificar última mensagem do cliente via WhatsApp para calcular janela de 24h
      // CRÍTICO: filtrar channel='whatsapp' E excluir source_type='form' —
      // notificações de formulário são inseridas com from_contact='cliente' + channel='whatsapp'
      // mas NÃO representam uma mensagem inbound real do WhatsApp Business.
      const msgQuery = supabase
        .from('messages')
        .select('created_at')
        .eq('from_contact', 'cliente')
        .eq('channel', 'whatsapp')
        .or('source_type.is.null,source_type.neq.form')
        .order('created_at', { ascending: false })
        .limit(1);

      if (pessoaId) {
        msgQuery.eq('people_id', pessoaId);
      } else if (leadId) {
        msgQuery.eq('lead_id', leadId);
      }

      const { data: lastClientMessage, error: messageError } = await msgQuery.maybeSingle();

      if (messageError) {
        console.error('Erro ao buscar última mensagem:', messageError);
        return { canSend: true, needsTemplate: false, isAIActive: false };
      }

      if (!lastClientMessage) {
        // Sem mensagens do cliente - precisa usar template
        return {
          canSend: false,
          reason: 'Não há mensagens do cliente. Use um template para iniciar a conversa.',
          needsTemplate: true,
          isAIActive: false
        };
      }

      // Verificar se passou 24 horas
      const lastMessageDate = new Date(lastClientMessage.created_at);
      const now = new Date();
      const hoursDiff = (now.getTime() - lastMessageDate.getTime()) / (1000 * 60 * 60);

      console.log('⏰ useCanSendMessage: Verificando janela de 24h', {
        hoursDiff,
        lastMessageDate,
        canSend: hoursDiff <= 24
      });

      if (hoursDiff > 24) {
        return {
          canSend: false,
          reason: 'A última mensagem do cliente foi enviada há mais de 24 horas. Use um template do WhatsApp.',
          needsTemplate: true,
          isAIActive: false
        };
      }

      console.log('✅ useCanSendMessage: Pode enviar mensagem');
      return { canSend: true, needsTemplate: false, isAIActive: false };
    },
    enabled: !!leadId || !!pessoaId,
    refetchInterval: 60000, // Revalidar a cada minuto
    staleTime: 0, // CRÍTICO: Sempre considerar dados como stale para revalidar imediatamente
  });
};
