import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface OmniChannelSetting {
  id: string;
  channel: 'whatsapp' | 'email' | 'instagram_dm' | 'instagram_comment' | 'sms' | 'telefone';
  auto_create_negocio: boolean;
  pipeline_id: string | null;
  stage_id: string | null;
  title_template: string;
  on_first_reply_enabled: boolean;
  on_first_reply_stage_id: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useOmniNewContactSettings() {
  const qc = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['omni-new-contact-settings'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('settings_omni_new_contact')
        .select('*')
        .order('channel');
      if (error) {
        console.error('[useOmniNewContactSettings] query error:', error.message);
        return [] as OmniChannelSetting[];
      }
      return (data ?? []) as OmniChannelSetting[];
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: Partial<OmniChannelSetting> & { channel: string }) => {
      const { error } = await sb
        .from('settings_omni_new_contact')
        .upsert({ ...patch, updated_at: new Date().toISOString() }, { onConflict: 'channel' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['omni-new-contact-settings'] }),
    onError: (error: Error) => {
      toast.error('Erro ao salvar configuração: ' + (error.message ?? 'sem permissão'));
    },
  });

  return {
    settings,
    isLoading,
    updateSetting: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
