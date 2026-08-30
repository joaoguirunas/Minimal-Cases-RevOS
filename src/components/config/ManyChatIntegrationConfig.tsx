import { useState, useEffect } from 'react';
import { RefreshCw, Eye, EyeOff, Webhook, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase, supabaseUrl } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CopyableField } from '@/components/common/CopyableField';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const CHANNELS = ['tiktok-manychat', 'instagram-manychat'] as const;
type ManyChatChannelId = typeof CHANNELS[number];

const DISPLAY_NAMES: Record<ManyChatChannelId, string> = {
  'tiktok-manychat':    'TikTok (ManyChat)',
  'instagram-manychat': 'Instagram (ManyChat)',
};

interface ManyChatCredentials {
  api_key?: string;
  webhook_secret?: string;
}

interface ManyChatConfigRow {
  channel: ManyChatChannelId;
  is_active: boolean;
  credentials: ManyChatCredentials;
}

function useManyChatConfigs() {
  return useQuery({
    queryKey: ['omni-channel-config', 'manychat-all'],
    queryFn: async (): Promise<Record<ManyChatChannelId, ManyChatConfigRow>> => {
      const { data, error } = await supabase
        .from('omni_channel_configs')
        .select('channel, is_active, credentials')
        .in('channel', CHANNELS as unknown as string[]);
      if (error) throw error;

      const result = {} as Record<ManyChatChannelId, ManyChatConfigRow>;
      for (const ch of CHANNELS) {
        const row = (data ?? []).find(r => r.channel === ch);
        result[ch] = {
          channel: ch,
          is_active: row?.is_active ?? false,
          credentials: (row?.credentials as ManyChatCredentials) ?? {},
        };
      }
      return result;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export default function ManyChatIntegrationConfig() {
  const { data: configs, isLoading } = useManyChatConfigs();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [tiktokActive, setTiktokActive] = useState(false);
  const [instagramActive, setInstagramActive] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!configs) return;
    // api_key and webhook_secret are shared — read from either channel, prefer tiktok
    const creds = configs['tiktok-manychat'].credentials.api_key
      ? configs['tiktok-manychat'].credentials
      : configs['instagram-manychat'].credentials;
    setApiKey(creds.api_key ?? '');
    setWebhookSecret(creds.webhook_secret ?? '');
    setTiktokActive(configs['tiktok-manychat'].is_active);
    setInstagramActive(configs['instagram-manychat'].is_active);
  }, [configs]);

  const tiktokWebhookUrl    = `${supabaseUrl}/functions/v1/tiktok-manychat-inbound`;
  const instagramWebhookUrl = `${supabaseUrl}/functions/v1/instagram-manychat-inbound`;
  const isConnected = !!apiKey.trim() && (tiktokActive || instagramActive);

  const handleRegenerateSecret = () => setWebhookSecret(crypto.randomUUID());

  const handleSave = async () => {
    setSaving(true);
    try {
      const sharedCredentials = { api_key: apiKey.trim(), webhook_secret: webhookSecret };

      const upserts = [
        {
          channel:      'tiktok-manychat',
          display_name: DISPLAY_NAMES['tiktok-manychat'],
          is_active:    tiktokActive,
          credentials:  sharedCredentials,
        },
        {
          channel:      'instagram-manychat',
          display_name: DISPLAY_NAMES['instagram-manychat'],
          is_active:    instagramActive,
          credentials:  sharedCredentials,
        },
      ];

      const { error } = await supabase
        .from('omni_channel_configs')
        .upsert(upserts, { onConflict: 'channel' });

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['omni-channel-config', 'manychat-all'] });
      toast({ title: 'Configuração salva' });
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logos/manychat.png"
            alt="ManyChat"
            className="w-10 h-10 rounded-lg object-contain shrink-0"
            onError={e => {
              const t = e.currentTarget;
              t.style.display = 'none';
              (t.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex');
            }}
          />
          <div className="w-10 h-10 rounded-lg bg-muted items-center justify-center shrink-0 text-[13px] font-bold text-muted-foreground hidden">
            MC
          </div>
          <div>
            <p className="text-[15px] font-semibold text-foreground leading-tight">ManyChat</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">TikTok DM e Instagram DM via ManyChat</p>
          </div>
        </div>
        {isConnected ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Conectado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
            Desconectado
          </span>
        )}
      </div>

      {/* Conexão */}
      <div className="rounded-[4px] border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
          <div>
            <p className="text-[13px] font-medium text-foreground">Conexão</p>
            <p className="text-[12px] text-muted-foreground">
              ManyChat → Settings → API → copie a API Key (formato <code className="font-mono bg-muted px-1 rounded text-[11px]">user_id:token</code>)
            </p>
          </div>
        </div>
        <div className="space-y-1.5 pt-1 border-t border-border">
          <div className="flex items-center justify-between">
            <Label className="text-[13px]">API Key</Label>
            <button
              type="button"
              onClick={() => setShowApiKey(v => !v)}
              className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showApiKey ? <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />}
              {showApiKey ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          <Input
            type={showApiKey ? 'text' : 'password'}
            placeholder="123456:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            className="font-mono text-[12px]"
          />
        </div>
      </div>

      {/* Webhook */}
      <div className="rounded-[4px] border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
          <div>
            <p className="text-[13px] font-medium text-foreground">Webhook de inbound</p>
            <p className="text-[12px] text-muted-foreground">
              URLs separadas por plataforma. Configure em cada Flow Builder do ManyChat.
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-1 border-t border-border">
          <CopyableField
            label="Webhook TikTok DM"
            value={tiktokWebhookUrl}
            hint="Flow Builder TikTok → Action → External Request (POST) → cole esta URL."
          />
          <CopyableField
            label="Webhook Instagram DM"
            value={instagramWebhookUrl}
            hint="Flow Builder Instagram → Action → External Request (POST) → cole esta URL."
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[13px]">Webhook Secret</Label>
              <button
                type="button"
                onClick={handleRegenerateSecret}
                className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
                {webhookSecret ? 'Regenerar' : 'Gerar'}
              </button>
            </div>
            <Input
              value={webhookSecret}
              readOnly
              placeholder="Clique em Gerar para criar um segredo"
              className="font-mono text-[12px] bg-muted"
            />
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              No External Request do ManyChat, adicione o header{' '}
              <code className="font-mono bg-muted px-1 rounded text-[11px]">X-Webhook-Secret</code>{' '}
              com este valor. Use o mesmo secret em todos os flows.
            </p>
          </div>
        </div>
      </div>

      {/* Canais */}
      <div className="rounded-[4px] border border-border bg-card p-5 space-y-0">
        <p className="text-[13px] font-medium text-foreground mb-3">Canais ativos</p>
        <div className="divide-y divide-border">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-[13px] text-foreground">TikTok DM</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">Mensagens recebidas via TikTok no ManyChat</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground">{tiktokActive ? 'Ativo' : 'Inativo'}</span>
              <Switch checked={tiktokActive} onCheckedChange={setTiktokActive} />
            </div>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-[13px] text-foreground">Instagram DM</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">Mensagens recebidas via Instagram no ManyChat</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground">{instagramActive ? 'Ativo' : 'Inativo'}</span>
              <Switch checked={instagramActive} onCheckedChange={setInstagramActive} />
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving} className={cn('gap-1.5 min-w-[140px]')}>
          {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}
