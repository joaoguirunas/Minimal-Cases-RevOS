import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOmniChannelConfig } from '@/hooks/useOmniChannelConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2, Fingerprint } from 'lucide-react';
import { toast } from 'sonner';

interface IdentityCollectionSettings {
  wa_to_ig_enabled: boolean;
  wa_to_ig_message_count: number;
  wa_to_ig_message: string;
  ig_to_wa_enabled: boolean;
  ig_to_wa_message: string;
  email_collection_enabled: boolean;
}

const DEFAULTS: IdentityCollectionSettings = {
  wa_to_ig_enabled: true,
  wa_to_ig_message_count: 3,
  wa_to_ig_message: 'Para te identificarmos em outros canais, qual é o seu @ do Instagram? (Opcional, responda "não" para pular)',
  ig_to_wa_enabled: true,
  ig_to_wa_message: 'Para te atendermos melhor, qual é o seu WhatsApp? (Opcional, responda "não" para pular)',
  email_collection_enabled: true,
};

export default function OmniIdentityCollectionConfig() {
  const qc = useQueryClient();
  const { data: config, isLoading } = useOmniChannelConfig('identity_collection' as any);
  const [settings, setSettings] = useState<IdentityCollectionSettings>(DEFAULTS);
  const [globalEnabled, setGlobalEnabled] = useState(true);

  useEffect(() => {
    if (config) {
      setGlobalEnabled(config.is_active);
      const s = config.settings as Record<string, unknown>;
      setSettings({
        wa_to_ig_enabled: (s.wa_to_ig_enabled as boolean) ?? DEFAULTS.wa_to_ig_enabled,
        wa_to_ig_message_count: (s.wa_to_ig_message_count as number) ?? DEFAULTS.wa_to_ig_message_count,
        wa_to_ig_message: (s.wa_to_ig_message as string) ?? DEFAULTS.wa_to_ig_message,
        ig_to_wa_enabled: (s.ig_to_wa_enabled as boolean) ?? DEFAULTS.ig_to_wa_enabled,
        ig_to_wa_message: (s.ig_to_wa_message as string) ?? DEFAULTS.ig_to_wa_message,
        email_collection_enabled: (s.email_collection_enabled as boolean) ?? DEFAULTS.email_collection_enabled,
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from('omni_channel_configs')
        .update({
          is_active: globalEnabled,
          settings,
        })
        .eq('channel', 'identity_collection');
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configurações de coleta de identidade salvas');
      qc.invalidateQueries({ queryKey: ['omni-channel-config', 'identity_collection'] });
    },
    onError: (err: Error) => toast.error(`Erro ao salvar: ${err.message}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Coleta Proativa de Identidade</h3>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="global-toggle" className="text-sm text-muted-foreground">
            {globalEnabled ? 'Ativado' : 'Desativado'}
          </Label>
          <Switch
            id="global-toggle"
            checked={globalEnabled}
            onCheckedChange={setGlobalEnabled}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Quando ativado, o agente IA pergunta proativamente por dados de identidade cross-channel durante conversas.
        Contatos que recusarem (opt-out) nunca serão perguntados novamente.
      </p>

      {globalEnabled && (
        <div className="space-y-6">
          {/* WhatsApp → Instagram */}
          <div className="rounded-[2px] border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-medium">WhatsApp → Instagram</Label>
              <Switch
                checked={settings.wa_to_ig_enabled}
                onCheckedChange={(v) => setSettings(s => ({ ...s, wa_to_ig_enabled: v }))}
              />
            </div>
            {settings.wa_to_ig_enabled && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Perguntar após quantas mensagens do cliente
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={settings.wa_to_ig_message_count}
                    onChange={(e) => setSettings(s => ({ ...s, wa_to_ig_message_count: parseInt(e.target.value) || 3 }))}
                    className="w-24"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Mensagem</Label>
                  <Textarea
                    value={settings.wa_to_ig_message}
                    onChange={(e) => setSettings(s => ({ ...s, wa_to_ig_message: e.target.value }))}
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>

          {/* Instagram → WhatsApp */}
          <div className="rounded-[2px] border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-medium">Instagram → WhatsApp</Label>
              <Switch
                checked={settings.ig_to_wa_enabled}
                onCheckedChange={(v) => setSettings(s => ({ ...s, ig_to_wa_enabled: v }))}
              />
            </div>
            {settings.ig_to_wa_enabled && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Mensagem</Label>
                <Textarea
                  value={settings.ig_to_wa_message}
                  onChange={(e) => setSettings(s => ({ ...s, ig_to_wa_message: e.target.value }))}
                  rows={2}
                />
              </div>
            )}
          </div>

          {/* Email collection */}
          <div className="rounded-[2px] border p-4">
            <div className="flex items-center justify-between">
              <Label className="font-medium">Coleta de Email (qualquer canal)</Label>
              <Switch
                checked={settings.email_collection_enabled}
                onCheckedChange={(v) => setSettings(s => ({ ...s, email_collection_enabled: v }))}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              O agente salva automaticamente emails mencionados na conversa.
            </p>
          </div>
        </div>
      )}

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full"
      >
        {saveMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        Salvar Configurações
      </Button>
    </div>
  );
}
