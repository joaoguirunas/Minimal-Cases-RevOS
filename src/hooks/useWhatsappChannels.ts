import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WhatsappChannel {
  id: string;
  label: string;
  phone_number_id: string;
  waba_id?: string | null;
  provider: 'meta' | 'evolution';
  is_default: boolean;
  active: boolean;
}

export const useWhatsappChannels = () => {
  return useQuery({
    queryKey: ['whatsapp-channels', 'active'],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('settings_whatsapp_channels')
        .select('id, label, phone_number_id, waba_id, provider, is_default, active')
        .eq('active', true)
        .order('is_default', { ascending: false });

      if (error) throw error;
      return (data ?? []) as WhatsappChannel[];
    },
  });
};

/**
 * Marca um canal (Meta OU Evolution) como padrão. Desliga o default anterior
 * primeiro — a constraint `whatsapp_channels_one_default` já garante
 * unicidade cross-provider no banco, isso só evita o erro de violação.
 * Usado pela config da Evolution (que não passa pelo save genérico do canal
 * Meta em `useUpdateWhatsappChannel`, que já faz esse mesmo passo).
 */
export const useSetDefaultWhatsappChannel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId, isDefault }: { channelId: string; isDefault: boolean }) => {
      if (isDefault) {
        await supabase.from('settings_whatsapp_channels').update({ is_default: false }).eq('is_default', true);
      }
      const { error } = await supabase.from('settings_whatsapp_channels').update({ is_default: isDefault }).eq('id', channelId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-channels'] });
      queryClient.invalidateQueries({ queryKey: ['evolution-channel'] });
    },
  });
};

/**
 * Canal "atual" de um lead (`clients_people.active_channel_id`) — trocável
 * manualmente na UI (Kanban/Omni). Normalmente mantido em sincronia automática
 * pelo trigger `trg_sync_active_channel` a cada mensagem de conversa real;
 * essa mutation é só pro override manual.
 */
export const useSetPersonActiveChannel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ peopleId, channelId }: { peopleId: string; channelId: string | null }) => {
      const { error } = await supabase
        .from('clients_people')
        .update({ active_channel_id: channelId })
        .eq('id', peopleId);
      if (error) throw error;
    },
    onSuccess: () => {
      // Prefix match (React Query default) — cobre todas as variantes de
      // key (['negocios-pipeline', pipelineId, filters], ['conversas', tenantId], etc.)
      // sem precisar do tenantId/pipelineId aqui.
      queryClient.invalidateQueries({ queryKey: ['negocios-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['conversas'] });
      queryClient.invalidateQueries({ queryKey: ['pessoas-com-conversas'] });
      queryClient.invalidateQueries({ queryKey: ['conversas-por-pessoa'] });
      queryClient.invalidateQueries({ queryKey: ['conversas-simples'] });
      // ['conversas-simples-v5', ...] é a key real usada hoje pela página Omni
      // (useConversasSimples.ts) — 'conversas-simples' acima é de um hook
      // legado diferente (useConversas.ts), não cobre o Select de canal ali.
      queryClient.invalidateQueries({ queryKey: ['conversas-simples-v5'] });
      // ['negocio', negocioId] é a key do Kanban/NegocioSingle — sem isso o
      // <Select> de canal na sidebar volta pro valor antigo após escolher,
      // parecendo que a troca não salvou.
      queryClient.invalidateQueries({ queryKey: ['negocio'] });
      // Reavalia na hora o aviso de "janela 24h / enviar template", que
      // depende do canal ativo da pessoa.
      queryClient.invalidateQueries({ queryKey: ['can-send-message'] });
    },
  });
};
