import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type SupabaseClient = any;
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { useMessageSendingMonitor } from './useMessageSendingMonitor';
import { auditLogger } from '@/utils/auditLogger';
import { useDispararWebhook } from '@/hooks/useWebhooks';

interface Conversa {
  id: string;
  lead_id: string;
  pessoa_id?: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  pessoa?: {
    id: string;
    nome: string;
    whatsapp?: string;
  };
}

interface ConversaDetalhada {
  id: number;
  lead_id: string;
  pessoa_id?: string;
  from_message: string;
  message: string;
  tipo_mensagem?: string;
  duracao_audio?: number;
  transcricao?: string;
  created_at: string;
  lead?: {
    pessoa?: {
      nome: string;
      whatsapp?: string;
    };
  };
}

interface PessoaComConversa {
  pessoa_id: string;
  pessoa_nome: string;
  pessoa_whatsapp?: string;
  has_messages: boolean;
  ultima_mensagem?: string;
  ultima_data?: string;
}

// Função utilitária para ordenação precisa por data/hora incluindo segundos e milissegundos
const sortByCreatedAt = (a: any, b: any) => {
  const dateA = new Date(a.created_at);
  const dateB = new Date(b.created_at);
  return dateA.getTime() - dateB.getTime();
};

export const useConversas = (tenantId?: string) => {
  return useQuery({
    queryKey: ['conversas', tenantId],
    queryFn: async () => {
      if (!tenantId) {
        return [];
      }
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          lead_id,
          people_id,
          created_at,
          updated_at,
          pessoa:clients_people(id, name, whatsapp)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('useConversas: Error fetching conversas:', error);
        throw error;
      }

      // Agrupar mensagens por lead_id para criar conversas únicas
      const conversasMap = new Map();
      
      data?.forEach((message: any) => {
        if (!conversasMap.has(message.lead_id)) {
          conversasMap.set(message.lead_id, {
            id: message.id,
            lead_id: message.lead_id,
            pessoa_id: message.people_id,
            tenant_id: message.tenant_id,
            created_at: message.created_at,
            updated_at: message.updated_at,
            pessoa: message.pessoa ? {
              id: message.pessoa.id,
              nome: message.pessoa.name,
              whatsapp: message.pessoa.whatsapp
            } : null
          });
        }
      });

      const conversas = Array.from(conversasMap.values());
      return conversas as Conversa[];
    },
    enabled: !!tenantId,
    retry: 1,
    retryDelay: 500,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
};

export const usePessoasComConversas = (tenantId?: string) => {
  return useQuery({
    queryKey: ['pessoas-com-conversas', tenantId],
    queryFn: async () => {
      if (!tenantId) {
        return [];
      }
      
      const { data, error } = await supabase
        .from('clients_people')
        .select('id, name, whatsapp')
        .not('status', 'in', '("archived","merged")')
        .order('name', { ascending: true});

      if (error) {
        console.error('usePessoasComConversas: Error fetching pessoas:', error);
        throw error;
      }

      // Para cada pessoa, verificar se tem mensagens
      const pessoasComConversas: PessoaComConversa[] = [];
      
      for (const pessoa of data || []) {
        const { data: mensagens } = await supabase
          .from('messages')
          .select('content, created_at')
          .eq('people_id', pessoa.id)
          .order('created_at', { ascending: false })
          .limit(1);

        pessoasComConversas.push({
          pessoa_id: pessoa.id,
          pessoa_nome: pessoa.name,
          pessoa_whatsapp: pessoa.whatsapp,
          has_messages: (mensagens?.length || 0) > 0,
          ultima_mensagem: mensagens?.[0]?.content,
          ultima_data: mensagens?.[0]?.created_at
        });
      }
      
      return pessoasComConversas;
    },
    enabled: !!tenantId,
    retry: 1,
    retryDelay: 500,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
};

export const useConversasPorPessoa = (pessoaId?: string, tenantId?: string) => {
  return useQuery({
    queryKey: ['conversas-por-pessoa', pessoaId, tenantId],
    queryFn: async () => {
      if (!pessoaId || !tenantId) {
        return [];
      }
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          lead:leads(
            pessoa:clients_people(name, whatsapp)
          )
        `)
        .eq('people_id', pessoaId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('useConversasPorPessoa: Error fetching conversas:', error);
        throw error;
      }

      // Ordenação precisa e mapear para estrutura legada
      const sortedData = (data || []).sort(sortByCreatedAt).map((msg: any) => ({
        id: msg.id,
        lead_id: msg.lead_id,
        pessoa_id: msg.people_id,
        from_message: msg.from_contact,
        message: msg.content,
        tipo_mensagem: msg.message_type,
        duracao_audio: msg.audio_duration,
        transcricao: msg.transcription,
        created_at: msg.created_at,
        lead: msg.lead ? {
          pessoa: msg.lead.pessoa ? {
            nome: msg.lead.pessoa.name,
            whatsapp: msg.lead.pessoa.whatsapp
          } : undefined
        } : undefined
      }));

      return sortedData as ConversaDetalhada[];
    },
    enabled: !!pessoaId && !!tenantId,
    retry: 1,
    retryDelay: 500,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
};

// Função para processar webhook em background com timeout
const processWebhookInBackground = async (webhookUrl: string, mensagem: any, tenantId: string) => {
  try {
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message_id: mensagem.id
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    await webhookResponse.text();
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('⏰ WEBHOOK: Timeout após 10 segundos - mensagem mantida no banco');
    } else {
      console.warn('⚠️ WEBHOOK: Falha no processamento (mensagem mantida):', error);
    }
  }
};

export const useEnviarMensagem = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const dispararWebhook = useDispararWebhook();

  return useMutation({
    mutationFn: async (data: {
      from_message: string;
      message: string;
      tipo_mensagem?: string;
      lead_id: string;
      tenant_id: string;
      pessoa_id: string;
      canal?: 'whatsapp' | 'instagram' | 'email' | 'sms' | 'telefone' | 'tiktok';
      whatsapp_template_id?: string;
      template_language_code?: string;       // e.g. 'pt_BR' — required for Meta Template API
      template_variable_values?: string[];   // ordered params for {{1}}, {{2}}, ...
      template_variable_names?: string[];    // variable names for parameter_format=NAMED
      template_parameter_format?: string;    // 'NAMED' | 'POSITIONAL'
      template_components?: Array<Record<string, unknown>>; // full Meta components array (header+body+buttons)
      media_url?: string | null;
      media_metadata?: { file_name: string; mime_type: string; file_size: number } | null;
      phone_number?: string; // WhatsApp destination — needed to call whatsapp-outbound
      reply_to_message_id?: number | null;    // messages.id being quoted — stored for our own UI
      reply_to_wa_message_id?: string | null; // wa_message_id being quoted — sent to Meta as context.message_id
      onIgDeliveryError?: (msg: string) => void; // called when omni-delivery-engine reports IG failure
      onWaDeliveryError?: (msg: string) => void; // called when whatsapp-outbound reports WA failure
    }) => {
      // Buscar o ID do usuário na tabela settings_users usando o auth_user_id
      let usuarioId = null;
      if (user?.id) {
        const { data: usuario, error: usuarioError } = await supabase
          .from('settings_users')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();

        if (!usuarioError && usuario) {
          usuarioId = usuario.id;
        }
      }

      // Verificação de duplicatas
      const agora = new Date();
      const trintaSegundosAtras = new Date(agora.getTime() - 30000);
      
      const { data: mensagensRecentes } = await supabase
        .from('messages')
        .select('id, content, created_at, from_contact, user_id, people_id')
        .eq('lead_id', data.lead_id)
        .gte('created_at', trintaSegundosAtras.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (mensagensRecentes && mensagensRecentes.length > 0) {
        const mensagemTrimmed = data.message.trim();

        // Duplicate / spam checks only apply to non-empty text messages.
        // Media-only messages (audio, video, image without caption) always have
        // content = '' and must NOT be blocked — every recording is a unique file.
        if (mensagemTrimmed !== '') {
          // Verificação de duplicatas EXATAS
          const duplicatasExatas = mensagensRecentes.filter(msg => {
            const msgTrimmed = msg.content.trim();
            const mesmaOrigem = msg.from_contact === data.from_message;
            const mesmoConteudo = msgTrimmed === mensagemTrimmed;
            const mesmoUsuario = (data.from_message === 'humano' && msg.user_id === usuarioId) ||
                                 (data.from_message !== 'humano' && msg.from_contact === data.from_message);

            return mesmaOrigem && mesmoConteudo && mesmoUsuario;
          });

          if (duplicatasExatas.length > 0) {
            console.warn('🚫 DUPLICATA EXATA:', duplicatasExatas[0]);
            throw new Error('Esta mensagem já foi enviada. Aguarde alguns segundos antes de enviar novamente.');
          }

          // Rate limiting para usuários humanos (texto repetido)
          if (data.from_message === 'humano') {
            const mensagensDoUsuario = mensagensRecentes.filter(msg =>
              msg.from_contact === 'humano' &&
              msg.user_id === usuarioId
            );

            if (mensagensDoUsuario.length >= 6) {
              console.warn('🚫 RATE LIMIT:', {
                usuario: usuarioId,
                quantidade: mensagensDoUsuario.length
              });
              throw new Error('Muitas mensagens enviadas rapidamente. Aguarde alguns segundos.');
            }

            const mensagensIdenticas = mensagensDoUsuario.filter(msg =>
              msg.content.trim() === mensagemTrimmed
            );

            if (mensagensIdenticas.length >= 2) {
              console.warn('🚫 SPAM DETECTADO:', mensagensIdenticas);
              throw new Error('Mensagem repetida detectada. Evite enviar a mesma mensagem múltiplas vezes.');
            }
          }
        }

      }

      const messageData = {
        from_contact: data.from_message,
        source_type: 'manual',
        content: data.message.trim(),
        message_type: data.tipo_mensagem || 'texto',
        lead_id: data.lead_id,
        people_id: data.pessoa_id,
        user_id: usuarioId,
        status: 'pending',
        channel: data.canal || 'whatsapp',
        whatsapp_template_id: data.whatsapp_template_id || null,
        media_url: data.media_url || null,
        media_metadata: data.media_metadata || null,
        parent_message_id: data.reply_to_message_id || null,
      };
      
      const { data: insertedMessage, error: insertError } = await supabase
        .from('messages')
        .insert([messageData])
        .select()
        .single();

      if (insertError) {
        console.error('❌ ENVIO: Erro ao inserir mensagem:', insertError);
        
        if (insertError.message?.includes('Duplicate message detected')) {
          throw new Error('Mensagem já foi enviada anteriormente');
        }
        
        throw insertError;
      }

      // Audit log
      await auditLogger.log({
        action: 'message_sent',
        resource_type: 'message',
        resource_id: insertedMessage.id.toString(),
        details: {
          content_preview: data.message.substring(0, 50),
          message_type: data.tipo_mensagem || 'texto',
          from_contact: data.from_message,
          lead_id: data.lead_id,
          people_id: data.pessoa_id,
          length: data.message.length,
          whatsapp_template_id: data.whatsapp_template_id
        }
      });

      // Disparar webhook de conversa (em background, não bloqueia)
      if (data.lead_id) {
        dispararWebhook.mutate({
          tipo: 'conversa',
          lead_id: data.lead_id
        });
      }

      // Dispatch imediato para Instagram — sem esperar cron
      if (data.canal === 'instagram' && data.from_message !== 'cliente') {
        supabase.functions.invoke('omni-delivery-engine', {
          body: { trigger: 'manual', channel: 'instagram', people_id: data.pessoa_id },
        }).then(({ data: igResult, error: igErr }) => {
          if (igErr) {
            const msg = `Erro ao enviar: ${igErr.message}`;
            console.error('ig-delivery-engine invoke error:', igErr);
            toast({ title: 'Instagram não entregue', description: msg, variant: 'destructive' });
            data.onIgDeliveryError?.(msg);
          } else if ((igResult as { failed?: number })?.failed > 0) {
            const errors = (igResult as { errors?: string[] })?.errors ?? [];
            const errMsg = errors[0] ?? 'Falha ao enviar via Instagram';
            console.error('ig-delivery-engine failed:', errMsg);
            toast({ title: 'Instagram não entregue', description: errMsg, variant: 'destructive' });
            data.onIgDeliveryError?.(errMsg);
          }
        }).catch((e: unknown) => {
          const msg = 'Erro de conexão ao enviar mensagem.';
          console.error('ig-delivery-engine invoke error:', e);
          toast({ title: 'Instagram não entregue', description: msg, variant: 'destructive' });
          data.onIgDeliveryError?.(msg);
        });
      }

      // Dispatch imediato para TikTok DMs — fire-and-forget via tiktok-outbound
      if (data.canal === 'tiktok' && data.from_message !== 'cliente') {
        supabase.functions.invoke('tiktok-outbound', {
          body: {
            people_id:  data.pessoa_id,
            message:    data.message,
            message_id: insertedMessage.id,
          },
        }).then(({ error: ttErr }) => {
          if (ttErr) {
            console.error('tiktok-outbound invoke error:', ttErr);
            toast({ title: 'TikTok não entregue', description: `Erro ao enviar: ${ttErr.message}`, variant: 'destructive' });
          }
        }).catch((e: unknown) => {
          console.error('tiktok-outbound invoke exception:', e);
          toast({ title: 'TikTok não entregue', description: 'Erro de conexão ao enviar mensagem.', variant: 'destructive' });
        });
      }

      // Enviar via Meta API para canal WhatsApp (fire-and-forget)
      // The edge function looks up the default channel server-side (service_role bypasses RLS)
      // Defensive fallback: if phone_number was not passed by the caller (e.g. paginated list
      // hasn't loaded the person yet), fetch it directly from the DB to avoid silent drop.
      let phoneNumber = data.phone_number;
      if (!phoneNumber && data.canal === 'whatsapp' && data.pessoa_id) {
        const { data: p } = await supabase
          .from('clients_people')
          .select('whatsapp')
          .eq('id', data.pessoa_id)
          .single();
        phoneNumber = p?.whatsapp ?? undefined;
      }
      if (data.canal === 'whatsapp' && data.from_message !== 'cliente' && phoneNumber) {
        // Determine Meta API type from actual MIME type to handle format compatibility.
        // Meta audio: aac, mp4/m4a, mpeg, amr, ogg+opus — NOT webm
        // Meta video: mp4, 3gpp — NOT mov/quicktime/webm
        // Unsupported formats fall back to 'document' so the message still delivers.
        const mime: string = (data.media_metadata as any)?.mime_type || '';
        let metaType: string;
        if (data.media_url && mime) {
          if (mime.startsWith('audio/')) {
            // All audio types go as 'audio'. The edge function handles audio/webm specially:
            // it converts WebM→OGG (same Opus packets, different container) and uploads to
            // Meta Media Upload API, returning a media_id used in place of a link.
            metaType = 'audio';
          } else if (mime === 'video/mp4' || mime === 'video/3gpp' || mime === 'video/3gp2') {
            metaType = 'video';
          } else if (mime.startsWith('video/')) {
            metaType = 'document'; // mov/webm/avi → send as downloadable file
          } else if (mime.startsWith('image/')) {
            metaType = 'image';
          } else {
            const tipoMap: Record<string, string> = { texto: 'text', imagem: 'image', audio: 'audio', video: 'video', arquivo: 'document' };
            metaType = tipoMap[data.tipo_mensagem || 'texto'] ?? 'text';
          }
        } else {
          const metaTypeMap: Record<string, string> = { texto: 'text', imagem: 'image', audio: 'audio', video: 'video', arquivo: 'document' };
          metaType = metaTypeMap[data.tipo_mensagem || 'texto'] ?? 'text';
        }

        // Template messages (fora da janela de 24h) usam formato específico da Meta Template API
        const outboundMsg = data.whatsapp_template_id
          ? {
              type: 'template' as const,
              template_name: data.whatsapp_template_id,
              language_code: data.template_language_code || 'pt_BR',
              components: data.template_components,         // full header+body+buttons
              variable_values: data.template_variable_values || [],
              variable_names: data.template_variable_names,
              parameter_format: data.template_parameter_format,
            }
          : data.media_url
          ? {
              type: metaType,
              media_url: data.media_url,
              text: data.message.trim() || undefined,   // caption / legenda
              filename: (data.media_metadata as any)?.file_name || undefined,
              mime_type: mime || undefined,              // needed for Meta Media Upload API
              context_wamid: data.reply_to_wa_message_id || undefined,
            }
          : {
              type: 'text',
              text: data.message.trim(),
              context_wamid: data.reply_to_wa_message_id || undefined,
            };

        supabase.functions.invoke('whatsapp-outbound', {
          body: {
            to: phoneNumber,
            messages: [outboundMsg],
            people_id: data.pessoa_id,
            message_ids: [insertedMessage.id],
          },
        }).then(({ data: outboundData, error: outboundErr }) => {
          if (outboundErr) {
            const msg = `Erro ao enviar: ${outboundErr.message}`;
            console.error('whatsapp-outbound invoke error:', outboundErr);
            toast({ title: 'WhatsApp não entregue', description: msg, variant: 'destructive' });
            data.onWaDeliveryError?.(msg);
          } else if (outboundData?.failed > 0) {
            const msg = outboundData.errors?.[0] || 'A mensagem não chegou ao WhatsApp.';
            console.error('whatsapp-outbound delivery failed:', outboundData);
            toast({ title: 'WhatsApp não entregue', description: msg, variant: 'destructive' });
            data.onWaDeliveryError?.(msg);
          } else {
            // Check if audio fell back to document link (upload failed) — Meta won't deliver
            const diagArr: Array<{ meta_payload_type?: string; upload_error?: string }> = outboundData?.diag ?? [];
            const audioFallback = diagArr.find(d => d.meta_payload_type === 'link_fallback_doc');
            if (audioFallback) {
              const msg = `Falha no upload do áudio: ${audioFallback.upload_error || 'erro desconhecido'}. Tente novamente.`;
              console.error('whatsapp-outbound: audio upload failed, fell back to document link', audioFallback);
              toast({ title: 'Áudio não entregue', description: msg, variant: 'destructive' });
              data.onWaDeliveryError?.(msg);
            }
          }
        });
      }

      return insertedMessage;
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Sucesso",
        description: "Mensagem enviada com sucesso!",
      });

      setTimeout(() => {
        queryClient.invalidateQueries({ 
          queryKey: ['mensagens-por-pessoa-v2', variables.pessoa_id, variables.tenant_id],
          exact: true,
          refetchType: 'active'
        });
        queryClient.invalidateQueries({ 
          queryKey: ['conversas-simples'],
          exact: false,
          refetchType: 'active'
        });
      }, 500);
    },
    onError: (error: any) => {
      console.error('❌ ENVIO: Erro na mutation:', error);
      
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar mensagem",
        variant: "destructive",
      });
    },
  });
};
