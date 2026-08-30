import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Múltiplos canais Evolution podem coexistir (cada um = um número/servidor
// distinto) — CHANNEL_KEY é uma LISTA, e toda ação além do setup inicial
// precisa de um channel_id explícito pra saber sobre qual canal operar.
const CHANNEL_KEY = ['evolution-channels'] as const;

export interface EvolutionChannel {
  id: string;
  label: string | null;
  evolution_base_url: string | null;
  evolution_instance_name: string | null;
  evolution_status: string | null;
  evolution_last_seen_at: string | null;
  active: boolean;
  is_default: boolean;
}

export function useEvolutionChannels() {
  return useQuery({
    queryKey: CHANNEL_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_whatsapp_channels')
        .select('id, label, evolution_base_url, evolution_instance_name, evolution_status, evolution_last_seen_at, active, is_default')
        .eq('provider', 'evolution')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as EvolutionChannel[];
    },
    staleTime: 15 * 1000,
  });
}

interface SetupInput {
  base_url: string;
  api_key: string;
  instance_name: string;
  label?: string;
  /** Omitido = cria um canal novo. Presente = atualiza esse canal existente. */
  channel_id?: string;
}

export function useEvolutionSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetupInput) => {
      const { data, error } = await supabase.functions.invoke('evolution-session-manage', {
        body: { action: 'setup', ...input },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { ok: true; channel_id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEY });
      toast.success('WhatsApp (Evolution) configurado. Agora conecte escaneando o QR code.');
    },
    onError: (e: Error) => toast.error('Erro ao configurar: ' + e.message),
  });
}

export interface ConnectResult {
  status: string;
  qr_data_url: string | null;
  pairing_code: string | null;
}

export function useEvolutionConnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (channelId: string): Promise<ConnectResult> => {
      const { data, error } = await supabase.functions.invoke('evolution-session-manage', {
        body: { action: 'connect', channel_id: channelId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as ConnectResult;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHANNEL_KEY }),
    onError: (e: Error) => toast.error('Erro ao gerar QR code: ' + e.message),
  });
}

export function useEvolutionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (channelId: string): Promise<{ status: string }> => {
      const { data, error } = await supabase.functions.invoke('evolution-session-manage', {
        body: { action: 'status', channel_id: channelId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { status: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHANNEL_KEY }),
  });
}

export function useEvolutionLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (channelId: string) => {
      const { data, error } = await supabase.functions.invoke('evolution-session-manage', {
        body: { action: 'logout', channel_id: channelId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEY });
      toast.success('WhatsApp desconectado.');
    },
    onError: (e: Error) => toast.error('Erro ao desconectar: ' + e.message),
  });
}

export function useEvolutionDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (channelId: string) => {
      const { data, error } = await supabase.functions.invoke('evolution-session-manage', {
        body: { action: 'delete', channel_id: channelId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEY });
      toast.success('Canal Evolution removido.');
    },
    onError: (e: Error) => toast.error('Erro ao remover canal: ' + e.message),
  });
}
