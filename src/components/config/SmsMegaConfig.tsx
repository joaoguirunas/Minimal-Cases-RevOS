import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOmniChannelConfig, useUpdateOmniChannelConfig } from '@/hooks/useOmniChannelConfig';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import NewContactSection from '@/components/config/NewContactSection';
import ChannelHealthBadge from './ChannelHealthBadge';

type SmsProvider = 'twilio' | 'webhook';

export default function SmsMegaConfig() {
  const { data: config, isLoading } = useOmniChannelConfig('sms');
  const { mutate: update, isPending: saving } = useUpdateOmniChannelConfig();
  const { toast } = useToast();

  const [isActive, setIsActive] = useState(false);
  const [provider, setProvider] = useState<SmsProvider>('webhook');
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [webhookFallback, setWebhookFallback] = useState({ enabled: false, url: '', method: 'POST', payload_template: '' });
  const [showSecret, setShowSecret] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!config) return;
    setIsActive(config.is_active ?? false);
    setProvider(((config.credentials as any)?.provider as SmsProvider) ?? 'webhook');
    setCredentials((config.credentials as Record<string, string>) ?? {});
    setSettings((config.settings as Record<string, unknown>) ?? {});
    setWebhookFallback({
      enabled: config.webhook_fallback?.enabled ?? false,
      url: config.webhook_fallback?.url ?? '',
      method: config.webhook_fallback?.method ?? 'POST',
      payload_template: config.webhook_fallback?.payload_template ?? '',
    });
  }, [config]);

  const handleSave = () => {
    update({
      channel: 'sms',
      updates: {
        is_active: isActive,
        credentials: { ...credentials, provider },
        settings,
        webhook_fallback: webhookFallback,
      },
    }, {
      onSuccess: () => toast({ title: 'SMS Config salva' }),
      onError: (err: any) => toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' }),
    });
  };

  const handleTest = async () => {
    if (!testPhone) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('channel-test-send', {
        body: { channel: 'sms', test_to: testPhone },
      });
      if (error || !data?.success) {
        toast({ title: 'Erro no teste', description: data?.error || error?.message || 'Falha ao enviar SMS de teste', variant: 'destructive' });
      } else {
        toast({ title: 'SMS de teste enviado', description: data.message });
      }
    } catch (e) {
      toast({ title: 'Erro no teste', description: (e as Error).message, variant: 'destructive' });
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
          <p className="text-[15px] font-semibold text-foreground leading-tight">SMS</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">Envio de SMS via Twilio ou webhook</p>
        </div>
        <div className="flex items-center gap-3">
          <ChannelHealthBadge channel="sms" />
          <span className="text-[12px] text-muted-foreground">{isActive ? 'Ativo' : 'Inativo'}</span>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      {/* Provider tabs */}
      <Tabs value={provider} onValueChange={(v) => setProvider(v as SmsProvider)} className="space-y-5">
        <TabsList className="h-auto w-full justify-start gap-0 bg-muted border border-border rounded-[2px] p-1">
          {([
            { value: 'twilio',  label: 'Twilio' },
            { value: 'webhook', label: 'Webhook' },
          ] as const).map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="text-[11px] h-[26px] px-3 data-[state=active]:bg-background data-[state=active]:rounded-[3px]"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="twilio" className="space-y-5 mt-0">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Credenciais Twilio</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Account SID</Label>
                <Input placeholder="ACxxxxx..." value={credentials.account_sid ?? ''} onChange={e => setCredentials(c => ({ ...c, account_sid: e.target.value }))} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Auth Token</Label>
                <div className="relative">
                  <Input type={showSecret ? 'text' : 'password'} placeholder="••••••••••••••••" value={credentials.auth_token ?? ''} onChange={e => setCredentials(c => ({ ...c, auth_token: e.target.value }))} className="font-mono pr-8" />
                  <button onClick={() => setShowSecret(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-[13px]">Número de origem</Label>
                <Input placeholder="+5511999999999" value={credentials.from_number ?? ''} onChange={e => setCredentials(c => ({ ...c, from_number: e.target.value }))} />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="webhook" className="space-y-5 mt-0">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Webhook</p>
            <div className="space-y-1.5">
              <Label className="text-[13px]">URL do Webhook</Label>
              <Input placeholder="https://n8n.suaempresa.com/webhook/sms" value={webhookFallback.url} onChange={e => setWebhookFallback(w => ({ ...w, url: e.target.value, enabled: !!e.target.value }))} className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Payload Template</Label>
              <Textarea
                placeholder={`{"to":"{{to}}","message":"{{content}}"}`}
                value={webhookFallback.payload_template}
                onChange={e => setWebhookFallback(w => ({ ...w, payload_template: e.target.value }))}
                className="font-mono resize-none text-[12px]"
              />
              <p className="text-[12px] text-muted-foreground">
                Variáveis: {'{{to}}'} {'{{content}}'} {'{{people_name}}'} {'{{source_type}}'}
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Comportamento */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Comportamento</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[13px]">Rate limit / hora</Label>
            <Input type="number" placeholder="50" value={(settings.rate_limit_per_hour as string) ?? ''} onChange={e => setSettings(s => ({ ...s, rate_limit_per_hour: parseInt(e.target.value) || 50 }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Tentativas de retry</Label>
            <Input type="number" placeholder="2" value={(settings.retry_attempts as string) ?? ''} onChange={e => setSettings(s => ({ ...s, retry_attempts: parseInt(e.target.value) || 2 }))} />
          </div>
        </div>
      </div>

      {/* Teste */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Teste</p>
        <div className="flex gap-2">
          <Input placeholder="+5511999999999" value={testPhone} onChange={e => setTestPhone(e.target.value)} />
          <Button variant="outline" size="sm" onClick={handleTest} disabled={!testPhone || testing} className="shrink-0 gap-1.5">
            {testing && <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
            {testing ? 'Enviando...' : 'Enviar SMS'}
          </Button>
        </div>
      </div>

      {/* Status badge */}
      {isActive
        ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            Canal ativo — SMS serão entregues
          </span>
        : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
            <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
            Canal inativo — configure e ative para usar
          </span>
      }

      {/* Novo Contato */}
      <NewContactSection channels={['sms']} />

      {/* Salvar */}
      <div className="flex items-center justify-between">
        <span />
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 min-w-[140px]">
          {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </Button>
      </div>
    </div>
  );
}
