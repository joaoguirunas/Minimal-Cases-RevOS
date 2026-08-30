import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useOmniChannelConfig, useUpdateOmniChannelConfig } from '@/hooks/useOmniChannelConfig';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import NewContactSection from '@/components/config/NewContactSection';
import ChannelHealthBadge from './ChannelHealthBadge';

export default function CallMegaConfig() {
  const { data: config, isLoading } = useOmniChannelConfig('telefone');
  const { mutate: updateOmni, isPending: savingOmni } = useUpdateOmniChannelConfig();
  const { toast: uiToast } = useToast();

  const [isActive, setIsActive] = useState(false);
  const [twilioCredentials, setTwilioCredentials] = useState<Record<string, string>>({});
  const [twilioSettings, setTwilioSettings] = useState<Record<string, unknown>>({});
  const [showTwilioSecret, setShowTwilioSecret] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!config) return;
    setIsActive(config.is_active ?? false);
    setTwilioCredentials((config.credentials as Record<string, string>) ?? {});
    setTwilioSettings((config.settings as Record<string, unknown>) ?? {});
  }, [config]);

  const handleSaveTwilio = () => {
    updateOmni({
      channel: 'telefone',
      updates: {
        is_active: isActive,
        credentials: { ...twilioCredentials, provider: 'twilio' },
        settings: twilioSettings,
      },
    }, {
      onSuccess: () => uiToast({ title: 'Configuração Twilio salva' }),
      onError: (err: any) => uiToast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' }),
    });
  };

  const handleTest = async () => {
    if (!testPhone) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('channel-test-send', {
        body: { channel: 'phone', test_to: testPhone },
      });
      if (error || !data?.success) {
        uiToast({ title: 'Erro no teste', description: data?.error || error?.message || 'Falha ao iniciar chamada', variant: 'destructive' });
      } else {
        uiToast({ title: 'Chamada de teste iniciada', description: data.message });
      }
    } catch (e) {
      uiToast({ title: 'Erro no teste', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Status row */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[15px] font-semibold text-foreground leading-tight">Telefonia</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">Chamadas e voz via Twilio</p>
        </div>
        <div className="flex items-center gap-3">
          <ChannelHealthBadge channel="telefone" />
          <span className="text-[12px] text-muted-foreground">{isActive ? 'Ativo' : 'Inativo'}</span>
          <Switch checked={isActive} onCheckedChange={(v) => {
            setIsActive(v);
            updateOmni({ channel: 'telefone', updates: { is_active: v } });
          }} />
        </div>
      </div>

      {/* Credenciais Twilio */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Credenciais Twilio</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[13px]">Account SID</Label>
            <Input
              placeholder="ACxxxxx..."
              value={twilioCredentials.account_sid ?? ''}
              onChange={e => setTwilioCredentials(c => ({ ...c, account_sid: e.target.value }))}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Auth Token</Label>
            <div className="relative">
              <Input
                type={showTwilioSecret ? 'text' : 'password'}
                placeholder="••••••••••••••••"
                value={twilioCredentials.auth_token ?? ''}
                onChange={e => setTwilioCredentials(c => ({ ...c, auth_token: e.target.value }))}
                className="font-mono pr-8"
              />
              <button onClick={() => setShowTwilioSecret(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showTwilioSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-[13px]">Número de origem</Label>
            <Input
              placeholder="+5511999999999"
              value={twilioCredentials.from_number ?? ''}
              onChange={e => setTwilioCredentials(c => ({ ...c, from_number: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Comportamento */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Comportamento</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[13px]">Tentativas de retry</Label>
            <Input
              type="number"
              placeholder="1"
              value={(twilioSettings.retry_attempts as string) ?? ''}
              onChange={e => setTwilioSettings(s => ({ ...s, retry_attempts: parseInt(e.target.value) || 1 }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Delay entre retries (ms)</Label>
            <Input
              type="number"
              placeholder="30000"
              value={(twilioSettings.retry_delay_ms as string) ?? ''}
              onChange={e => setTwilioSettings(s => ({ ...s, retry_delay_ms: parseInt(e.target.value) || 30000 }))}
            />
          </div>
        </div>
      </div>

      {/* Teste */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Teste</p>
        <div className="flex gap-2">
          <Input
            placeholder="+5511999999999"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
          />
          <Button variant="outline" size="sm" onClick={handleTest} disabled={!testPhone || testing} className="shrink-0 gap-1.5">
            {testing && <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
            {testing ? 'Ligando...' : 'Ligar'}
          </Button>
        </div>
      </div>

      {/* Status badge */}
      {isActive
        ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            Canal ativo — provedor: Twilio
          </span>
        : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
            <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
            Canal inativo — configure e ative para usar
          </span>
      }

      {/* Novo Contato */}
      <NewContactSection channels={['telefone']} />

      {/* Salvar */}
      <div className="flex items-center justify-between">
        <span />
        <Button size="sm" onClick={handleSaveTwilio} disabled={savingOmni} className="gap-1.5 min-w-[140px]">
          {savingOmni && <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
          {savingOmni ? 'Salvando...' : 'Salvar configurações'}
        </Button>
      </div>
    </div>
  );
}
