import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, Eye, EyeOff, KeyRound, Webhook, Loader2, Plus, Pencil, Trash2,
  X, ChevronDown, CheckCircle2, XCircle, AlertTriangle, Link2, Unplug,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase, supabaseUrl } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CopyableField } from '@/components/common/CopyableField';
import { useToast } from '@/hooks/use-toast';
import { usePipelines, useStages } from '@/hooks/usePipelinesReal';
import { useWhatsappTemplates } from '@/hooks/useWhatsappTemplates';
import { productColor } from '@/components/negocios/CursoBadges';
import {
  invokeKiwify, useKiwifyStatus, useKiwifyProducts, useManualProducts, mergeProducts,
  type KiwifyProduct, type KiwifyConnectionStatus,
} from '@/hooks/useKiwifyProductsCatalog';
import { cn } from '@/lib/utils';

// ── Domain constants (mirror supabase/functions/_shared/kiwify-client.ts) ──────

const KIWIFY_TRIGGERS = [
  'boleto_gerado',
  'pix_gerado',
  'carrinho_abandonado',
  'compra_recusada',
  'compra_aprovada',
  'compra_reembolsada',
  'chargeback',
  'subscription_canceled',
  'subscription_late',
  'subscription_renewed',
] as const;
type KiwifyTrigger = (typeof KIWIFY_TRIGGERS)[number];

const TRIGGER_LABELS: Record<KiwifyTrigger, string> = {
  boleto_gerado:         'Boleto gerado',
  pix_gerado:            'PIX gerado',
  carrinho_abandonado:   'Carrinho abandonado',
  compra_recusada:       'Compra recusada',
  compra_aprovada:       'Compra aprovada',
  compra_reembolsada:    'Compra reembolsada',
  chargeback:            'Chargeback',
  subscription_canceled: 'Assinatura cancelada',
  subscription_late:     'Assinatura atrasada',
  subscription_renewed:  'Assinatura renovada',
};

const triggerLabel = (t: string) => TRIGGER_LABELS[t as KiwifyTrigger] ?? t;

const EVENT_STATUSES = ['received', 'processing', 'processed', 'failed', 'ignored'] as const;
type EventStatus = (typeof EVENT_STATUSES)[number];

const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  received:   'Recebido',
  processing: 'Processando',
  processed:  'Processado',
  failed:     'Falhou',
  ignored:    'Ignorado',
};

// ── Data shapes ────────────────────────────────────────────────────────────────

interface EventMapping {
  id: string;
  product_id: string | null;
  trigger: string;
  target_pipeline_id: string;
  target_stage_id: string;
  tags_to_add: string[];
  tags_to_remove: string[];
  active: boolean;
}

interface AutomationStep {
  delay_minutes: number;
  template_id: string | null;
  variables: Record<string, unknown>;
}

interface MessageAutomation {
  id: string;
  product_id: string | null;
  trigger: string;
  steps: AutomationStep[];
  cancel_on_triggers: string[];
  active: boolean;
}

interface WebhookEvent {
  id: string;
  trigger: string | null;
  event_type: string;
  order_id: string | null;
  subscription_id: string | null;
  status: EventStatus;
  signature_valid: boolean;
  raw_payload: unknown;
  error: string | null;
  processed_at: string | null;
  created_at: string;
}

// The kiwify_* tables (migration KFY-1.1) are not yet in the generated Supabase
// types, so table calls go through an untyped view of the client; every result is
// re-cast to a concrete interface at the call site.
const kdb = supabase as unknown as SupabaseClient;

// ── Queries ────────────────────────────────────────────────────────────────────

function useEventMappings() {
  return useQuery({
    queryKey: ['kiwify', 'event_mappings'],
    queryFn: async (): Promise<EventMapping[]> => {
      const { data, error } = await kdb
        .from('kiwify_event_mappings')
        .select('id, product_id, trigger, target_pipeline_id, target_stage_id, tags_to_add, tags_to_remove, active')
        .order('trigger', { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventMapping[];
    },
    staleTime: 60_000,
  });
}

function useAutomations() {
  return useQuery({
    queryKey: ['kiwify', 'automations'],
    queryFn: async (): Promise<MessageAutomation[]> => {
      const { data, error } = await kdb
        .from('kiwify_message_automations')
        .select('id, product_id, trigger, steps, cancel_on_triggers, active')
        .order('trigger', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as MessageAutomation[]).map((r) => ({
        ...r,
        steps: Array.isArray(r.steps) ? (r.steps as AutomationStep[]) : [],
        cancel_on_triggers: r.cancel_on_triggers ?? [],
      })) as MessageAutomation[];
    },
    staleTime: 60_000,
  });
}

interface EventFilters {
  trigger: string;
  status: string;
  period: '24h' | '7d' | '30d' | 'all';
}

function periodSince(period: EventFilters['period']): string | null {
  if (period === 'all') return null;
  const hours = period === '24h' ? 24 : period === '7d' ? 168 : 720;
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

function useWebhookEvents(filters: EventFilters) {
  return useQuery({
    queryKey: ['kiwify', 'events', filters],
    queryFn: async (): Promise<WebhookEvent[]> => {
      let query = kdb
        .from('kiwify_webhook_events')
        .select('id, trigger, event_type, order_id, subscription_id, status, signature_valid, raw_payload, error, processed_at, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (filters.trigger !== 'all') query = query.eq('trigger', filters.trigger);
      if (filters.status !== 'all') query = query.eq('status', filters.status);
      const since = periodSince(filters.period);
      if (since) query = query.gte('created_at', since);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as WebhookEvent[];
    },
    staleTime: 15_000,
  });
}

// ── Shared UI bits ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: KiwifyConnectionStatus['status'] }) {
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Conectado
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Erro
      </span>
    );
  }
  if (status === 'pending_webhook') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Aguardando webhook
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
      Desconectado
    </span>
  );
}

function TagInput({ value, onChange, placeholder }: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  };
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[11px] bg-muted border border-border text-foreground">
            {tag}
            <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </span>
        ))}
      </div>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={placeholder ?? 'Digite e pressione Enter'}
        className="h-8 text-[12px]"
      />
    </div>
  );
}

function productLabel(products: KiwifyProduct[], productId: string | null): string {
  if (!productId) return 'Padrão — todos os produtos';
  return products.find((p) => p.id === productId)?.name ?? productId;
}

function ManualProductEntry({ productsEmpty, productsLoading, onAdd, onSelect }: {
  productsEmpty: boolean;
  productsLoading: boolean;
  onAdd: (p: KiwifyProduct) => void;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState('');
  const [name, setName] = useState('');

  const add = () => {
    const pid = id.trim();
    const pname = name.trim();
    if (!pid || !pname) return;
    onAdd({ id: pid, name: pname });
    onSelect(pid);
    setId('');
    setName('');
    setOpen(false);
  };

  return (
    <div className="space-y-1.5">
      {productsEmpty && !productsLoading && (
        <p className="text-[11px] text-muted-foreground">
          Nenhum produto retornado pela API (credencial sem escopo <code className="font-mono bg-muted px-1 rounded text-[10px]">products</code>). Insira manualmente.
        </p>
      )}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="w-3 h-3" strokeWidth={1.5} /> Inserir produto manualmente
        </button>
      ) : (
        <div className="rounded-[4px] border border-border p-2.5 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="product_id" className="h-8 text-[12px] font-mono" />
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do produto" className="h-8 text-[12px]" />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-7 text-[12px]" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" size="sm" className="h-7 text-[12px]" onClick={add} disabled={!id.trim() || !name.trim()}>Adicionar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section 1: Conectar ─────────────────────────────────────────────────────────

function ConnectSection() {
  const { data: status, isLoading } = useKiwifyStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [accountId, setAccountId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testResult, setTestResult] = useState<{ scope: string | null; missing: string[] } | null>(null);

  // Manual webhook flow (KFY-4.1): save credentials → paste the inbound URL on
  // Kiwify → register the token Kiwify generated back here.
  const [manualOpen, setManualOpen] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [manualInboundUrl, setManualInboundUrl] = useState<string | null>(null);
  const [manualConnectionId, setManualConnectionId] = useState<string | null>(null);
  const [webhookToken, setWebhookToken] = useState('');
  const [registeringToken, setRegisteringToken] = useState(false);

  useEffect(() => {
    if (status?.account_id) setAccountId((prev) => prev || status.account_id!);
  }, [status?.account_id]);

  useEffect(() => {
    if (status?.client_id) setClientId((prev) => prev || status.client_id!);
  }, [status?.client_id]);

  // Rehydrate the manual flow after a page reload: any existing connection can
  // receive a manually-created webhook token, so the URL + token field must not
  // depend on having clicked "Salvar" in this same session.
  useEffect(() => {
    if (status?.connection_id) setManualConnectionId((prev) => prev ?? status.connection_id!);
    if (status?.inbound_url) setManualInboundUrl((prev) => prev ?? status.inbound_url!);
  }, [status?.connection_id, status?.inbound_url]);

  const webhookUrl = `${supabaseUrl}/functions/v1/kiwify-inbound`;
  const connected = status?.status === 'connected';

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['kiwify', 'status'] });

  const handleTest = async () => {
    if (!accountId.trim() || !clientId.trim() || !clientSecret.trim()) {
      toast({ title: 'Preencha Account ID, Client ID e Client Secret', variant: 'destructive' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await invokeKiwify<{ scope: string | null; missing_scopes: string[] }>({
        action: 'test', account_id: accountId.trim(), client_id: clientId.trim(), client_secret: clientSecret.trim(),
      });
      setTestResult({ scope: res.scope, missing: res.missing_scopes ?? [] });
      toast({ title: 'Credenciais válidas' });
    } catch (err) {
      setTestResult(null);
      toast({ title: 'Falha no teste', description: err instanceof Error ? err.message : 'Erro', variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    if (!accountId.trim() || !clientId.trim() || !clientSecret.trim()) {
      toast({ title: 'Preencha Account ID, Client ID e Client Secret', variant: 'destructive' });
      return;
    }
    setConnecting(true);
    try {
      await invokeKiwify({ action: 'connect', account_id: accountId.trim(), client_id: clientId.trim(), client_secret: clientSecret.trim() });
      toast({ title: connected ? 'Conexão atualizada' : 'Conta conectada' });
      setClientSecret('');
      refresh();
    } catch (err) {
      toast({ title: 'Falha ao conectar', description: err instanceof Error ? err.message : 'Erro', variant: 'destructive' });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await invokeKiwify({ action: 'disconnect', account_id: accountId.trim() || undefined });
      toast({ title: 'Conta desconectada' });
      refresh();
    } catch (err) {
      toast({ title: 'Falha ao desconectar', description: err instanceof Error ? err.message : 'Erro', variant: 'destructive' });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!accountId.trim() || !clientId.trim() || !clientSecret.trim()) {
      toast({ title: 'Preencha Account ID, Client ID e Client Secret', variant: 'destructive' });
      return;
    }
    setSavingCreds(true);
    try {
      const res = await invokeKiwify<{ id: string; inbound_url: string }>({
        action: 'save_credentials', account_id: accountId.trim(), client_id: clientId.trim(), client_secret: clientSecret.trim(),
      });
      setManualConnectionId(res.id);
      setManualInboundUrl(res.inbound_url);
      toast({ title: 'Credenciais salvas', description: 'Copie a URL do webhook abaixo.' });
      refresh();
    } catch (err) {
      toast({ title: 'Falha ao salvar credenciais', description: err instanceof Error ? err.message : 'Erro', variant: 'destructive' });
    } finally {
      setSavingCreds(false);
    }
  };

  const handleRegisterToken = async () => {
    if (!webhookToken.trim()) {
      toast({ title: 'Cole o token gerado pela Kiwify', variant: 'destructive' });
      return;
    }
    setRegisteringToken(true);
    try {
      await invokeKiwify({
        action: 'register_manual_webhook_token',
        connection_id: manualConnectionId ?? undefined,
        account_id: manualConnectionId ? undefined : accountId.trim() || undefined,
        webhook_token: webhookToken.trim(),
      });
      toast({ title: 'Token registrado', description: 'Conexão ativada.' });
      setWebhookToken('');
      refresh();
    } catch (err) {
      toast({ title: 'Falha ao registrar token', description: err instanceof Error ? err.message : 'Erro', variant: 'destructive' });
    } finally {
      setRegisteringToken(false);
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
      {/* Status card */}
      <div className="rounded-[4px] border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Conexão Kiwify</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">Autenticação OAuth + webhook de vendas</p>
          </div>
          <StatusBadge status={status?.status ?? 'disconnected'} />
        </div>
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-[12px]">
            {status?.webhook_registered
              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.5} />
              : <XCircle className="w-3.5 h-3.5 text-muted-foreground/50" strokeWidth={1.5} />}
            <span className={status?.webhook_registered ? 'text-foreground' : 'text-muted-foreground'}>
              Webhook {status?.webhook_registered ? 'registrado' : 'não registrado'}
            </span>
          </span>
        </div>
        {status?.last_error && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-[4px] border border-red-500/20 bg-red-500/10">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-[12px] text-red-600 dark:text-red-400">{status.last_error}</p>
          </div>
        )}
      </div>

      {/* Credentials */}
      <div className="rounded-[4px] border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
          <div>
            <p className="text-[13px] font-medium text-foreground">Credenciais OAuth</p>
            <p className="text-[12px] text-muted-foreground">
              Kiwify → Apps → API de Integração → copie o <code className="font-mono bg-muted px-1 rounded text-[11px]">Account ID</code>, o <code className="font-mono bg-muted px-1 rounded text-[11px]">Client ID</code> e o <code className="font-mono bg-muted px-1 rounded text-[11px]">Client Secret</code>
            </p>
          </div>
        </div>
        <div className="space-y-4 pt-1 border-t border-border">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Account ID</Label>
              <Input
                placeholder="store-id"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="font-mono text-[12px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Client ID</Label>
              <Input
                placeholder="00000000-0000-0000-0000-000000000000"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="font-mono text-[12px]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[13px]">Client Secret</Label>
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {showSecret ? <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />}
                {showSecret ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <Input
              type={showSecret ? 'text' : 'password'}
              placeholder={connected ? '•••••••• (preencha para substituir)' : '••••••••'}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              className="font-mono text-[12px]"
            />
          </div>
        </div>

        {testResult && (
          <div className="border border-border rounded-[4px] p-4 space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Resultado do teste</p>
            <div className="flex items-start gap-2 text-[12px]">
              {testResult.missing.length === 0
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" strokeWidth={1.5} />
                : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" strokeWidth={1.5} />}
              <div>
                <span className={testResult.missing.length === 0 ? 'text-foreground' : 'text-amber-500'}>
                  Escopos concedidos: {testResult.scope || '—'}
                </span>
                {testResult.missing.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {testResult.missing.map((s) => (
                      <li key={s} className="text-[11px] text-amber-500 font-mono">falta: {s}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={testing} className="gap-1.5">
            {testing && <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
            {testing ? 'Testando...' : 'Testar conexão'}
          </Button>
          <div className="flex items-center gap-2">
            {connected && (
              <Button type="button" variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting} className="gap-1.5">
                {disconnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} /> : <Unplug className="w-3.5 h-3.5" strokeWidth={1.5} />}
                Desconectar
              </Button>
            )}
            <Button type="button" size="sm" onClick={handleConnect} disabled={connecting} className="gap-1.5 min-w-[130px]">
              {connecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} /> : <Link2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
              {connecting ? 'Salvando...' : connected ? 'Reconectar' : 'Conectar'}
            </Button>
          </div>
        </div>
      </div>

      {/* Manual webhook configuration (KFY-4.1) — alternative to auto-create */}
      <Collapsible open={manualOpen} onOpenChange={setManualOpen} className="rounded-[4px] border border-border bg-card">
        <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 p-5 text-left">
          <div className="flex items-center gap-2">
            <Webhook className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-[13px] font-medium text-foreground">Configuração manual</p>
              <p className="text-[12px] text-muted-foreground">Crie o webhook você mesmo no painel da Kiwify e cole o token aqui.</p>
            </div>
          </div>
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform', manualOpen && 'rotate-180')} strokeWidth={1.5} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
            {/* Step 1 */}
            <div className="space-y-2.5">
              <p className="text-[12px] font-medium text-foreground">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-[10px] font-semibold mr-1.5">1</span>
                Salve as credenciais (Account ID, Client ID e Client Secret acima) e gere a URL do webhook. Se a conta já está conectada, pule direto para o passo 2.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveCredentials}
                disabled={savingCreds}
                className="gap-1.5"
              >
                {savingCreds ? <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} /> : <KeyRound className="w-3.5 h-3.5" strokeWidth={1.5} />}
                {savingCreds ? 'Salvando...' : 'Salvar e gerar URL do webhook'}
              </Button>
            </div>

            {manualInboundUrl && (
              <div className="space-y-2.5 pt-1 border-t border-border">
                <p className="text-[12px] font-medium text-foreground">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-[10px] font-semibold mr-1.5">2</span>
                  Cole essa URL ao criar o webhook manualmente na Kiwify (Apps → Webhooks → Criar), depois cole aqui o token que a Kiwify gerar.
                </p>
                <CopyableField
                  label="URL do webhook (com identificador da conexão)"
                  value={manualInboundUrl}
                  hint="Use exatamente esta URL — o ?cid= identifica sua conexão."
                />
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Token gerado pela Kiwify</Label>
                  <Input
                    placeholder="cole o token aqui"
                    value={webhookToken}
                    onChange={(e) => setWebhookToken(e.target.value)}
                    className="font-mono text-[12px]"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleRegisterToken}
                    disabled={registeringToken || !webhookToken.trim()}
                    className="gap-1.5 min-w-[130px]"
                  >
                    {registeringToken ? <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} /> : <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
                    {registeringToken ? 'Registrando...' : 'Registrar token'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Webhook URL (reference) */}
      <div className="rounded-[4px] border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
          <div>
            <p className="text-[13px] font-medium text-foreground">Webhook de inbound</p>
            <p className="text-[12px] text-muted-foreground">Registrado automaticamente ao conectar. URL para referência:</p>
          </div>
        </div>
        <div className="pt-1 border-t border-border">
          <CopyableField
            label="URL do Webhook Kiwify"
            value={webhookUrl}
            hint="Registrado na Kiwify pela ação Conectar (10 triggers, products: all)."
          />
        </div>
      </div>
    </div>
  );
}

// ── Section 2: Mapeamentos ──────────────────────────────────────────────────────

const emptyMapping = (): EventMapping => ({
  id: '', product_id: null, trigger: 'compra_aprovada',
  target_pipeline_id: '', target_stage_id: '', tags_to_add: [], tags_to_remove: [], active: true,
});

function MappingDialog({ open, onOpenChange, initial, products, productsLoading, onAddManualProduct, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: EventMapping | null;
  products: KiwifyProduct[];
  productsLoading: boolean;
  onAddManualProduct: (p: KiwifyProduct) => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { data: pipelines = [] } = usePipelines();
  const { data: stages = [] } = useStages();
  const [form, setForm] = useState<EventMapping>(emptyMapping());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initial ? { ...initial } : emptyMapping());
  }, [open, initial]);

  const stagesForPipeline = useMemo(
    () => stages.filter((s) => s.leads_pipelines_id === form.target_pipeline_id || s.pipeline_id === form.target_pipeline_id),
    [stages, form.target_pipeline_id],
  );

  const save = async () => {
    if (!form.trigger || !form.target_pipeline_id || !form.target_stage_id) {
      toast({ title: 'Preencha trigger, pipeline e etapa', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        product_id: form.product_id,
        trigger: form.trigger,
        target_pipeline_id: form.target_pipeline_id,
        target_stage_id: form.target_stage_id,
        tags_to_add: form.tags_to_add,
        tags_to_remove: form.tags_to_remove,
        active: form.active,
      };
      const res = initial
        ? await kdb.from('kiwify_event_mappings').update(payload).eq('id', initial.id)
        : await kdb.from('kiwify_event_mappings').insert(payload);
      if (res.error) throw res.error;
      toast({ title: initial ? 'Mapeamento atualizado' : 'Mapeamento criado' });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Falha ao salvar', description: err instanceof Error ? err.message : 'Erro', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[15px]">{initial ? 'Editar mapeamento' : 'Novo mapeamento'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Trigger</Label>
              <Select value={form.trigger} onValueChange={(v) => setForm((f) => ({ ...f, trigger: v }))}>
                <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KIWIFY_TRIGGERS.map((t) => <SelectItem key={t} value={t}>{TRIGGER_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Produto</Label>
              <Select
                value={form.product_id ?? '__default__'}
                onValueChange={(v) => setForm((f) => ({ ...f, product_id: v === '__default__' ? null : v }))}
              >
                <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Padrão — todos</SelectItem>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ManualProductEntry
            productsEmpty={products.length === 0}
            productsLoading={productsLoading}
            onAdd={onAddManualProduct}
            onSelect={(id) => setForm((f) => ({ ...f, product_id: id }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Pipeline destino</Label>
              <Select
                value={form.target_pipeline_id}
                onValueChange={(v) => setForm((f) => ({ ...f, target_pipeline_id: v, target_stage_id: '' }))}
              >
                <SelectTrigger className="h-8 text-[13px]"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Etapa destino</Label>
              <Select
                value={form.target_stage_id}
                onValueChange={(v) => setForm((f) => ({ ...f, target_stage_id: v }))}
                disabled={!form.target_pipeline_id}
              >
                <SelectTrigger className="h-8 text-[13px]"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {stagesForPipeline.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px]">Tags a adicionar</Label>
            <TagInput value={form.tags_to_add} onChange={(v) => setForm((f) => ({ ...f, tags_to_add: v }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Tags a remover</Label>
            <TagInput value={form.tags_to_remove} onChange={(v) => setForm((f) => ({ ...f, tags_to_remove: v }))} />
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-border">
            <span className="text-[13px] text-foreground">Ativo</span>
            <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={save} disabled={saving} className="gap-1.5 min-w-[100px]">
            {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Section: Produtos ────────────────────────────────────────────────────────────

function ProductsSection({ connected }: { connected: boolean }) {
  const { data: apiProducts = [], isLoading, refetch, isFetching } = useKiwifyProducts(connected);
  const { manualProducts, addManualProduct } = useManualProducts();
  const products = useMemo(() => mergeProducts(apiProducts, manualProducts), [apiProducts, manualProducts]);

  if (!connected) {
    return (
      <div className="rounded-[4px] border border-dashed border-border bg-card p-8 text-center">
        <p className="text-[13px] text-muted-foreground">Conecte a Kiwify na aba "Conectar" para ver os produtos da conta.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-foreground">Produtos cadastrados na Kiwify</p>
          <p className="text-[12px] text-muted-foreground">
            A cor de cada produto é a mesma usada nos badges de lead no Kanban e nos detalhes do negócio.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
          <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} strokeWidth={1.5} />
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : products.length === 0 ? (
        <div className="rounded-[4px] border border-dashed border-border bg-card p-8 text-center space-y-2">
          <p className="text-[13px] text-muted-foreground">Nenhum produto retornado pela API.</p>
          <ManualProductEntry
            productsEmpty
            productsLoading={false}
            onAdd={addManualProduct}
            onSelect={() => {}}
          />
        </div>
      ) : (
        <>
          <div className="rounded-[4px] border border-border bg-card divide-y divide-border">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3">
                <span className={cn('w-2 h-2 rounded-full shrink-0', productColor(p.id).dot)} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-foreground truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">{p.id}</p>
                </div>
                {manualProducts.some((mp) => mp.id === p.id) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0">manual</span>
                )}
              </div>
            ))}
          </div>
          <ManualProductEntry
            productsEmpty={false}
            productsLoading={false}
            onAdd={addManualProduct}
            onSelect={() => {}}
          />
        </>
      )}
    </div>
  );
}

// ── Section 2: Mapeamentos ───────────────────────────────────────────────────────

function MappingsSection({ connected }: { connected: boolean }) {
  const { data: mappings = [], isLoading, refetch } = useEventMappings();
  const { data: apiProducts = [], isLoading: productsLoading } = useKiwifyProducts(connected);
  const { manualProducts, addManualProduct } = useManualProducts();
  const products = useMemo(() => mergeProducts(apiProducts, manualProducts), [apiProducts, manualProducts]);
  const { data: pipelines = [] } = usePipelines();
  const { data: stages = [] } = useStages();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventMapping | null>(null);

  const pipelineName = (id: string) => pipelines.find((p) => p.id === id)?.name ?? '—';
  const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? '—';

  const handleDelete = async (id: string) => {
    const { error } = await kdb.from('kiwify_event_mappings').delete().eq('id', id);
    if (error) {
      toast({ title: 'Falha ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Mapeamento excluído' });
    refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-foreground">Mapeamentos de evento</p>
          <p className="text-[12px] text-muted-foreground">Trigger da Kiwify → pipeline/etapa e tags.</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} /> Novo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : mappings.length === 0 ? (
        <div className="rounded-[4px] border border-dashed border-border bg-card p-8 text-center">
          <p className="text-[13px] text-muted-foreground">Nenhum mapeamento configurado.</p>
        </div>
      ) : (
        <div className="rounded-[4px] border border-border bg-card divide-y divide-border">
          {mappings.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-medium text-foreground">{triggerLabel(m.trigger)}</span>
                  {!m.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">inativo</span>}
                  <span className="text-[11px] text-muted-foreground">· {productLabel(products, m.product_id)}</span>
                </div>
                <p className="text-[12px] text-muted-foreground">
                  {pipelineName(m.target_pipeline_id)} → {stageName(m.target_stage_id)}
                </p>
                {(m.tags_to_add.length > 0 || m.tags_to_remove.length > 0) && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {m.tags_to_add.map((t) => (
                      <span key={`a-${t}`} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">+{t}</span>
                    ))}
                    {m.tags_to_remove.map((t) => (
                      <span key={`r-${t}`} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">−{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(m); setDialogOpen(true); }}>
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(m.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <MappingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        products={products}
        productsLoading={productsLoading}
        onAddManualProduct={addManualProduct}
        onSaved={() => refetch()}
      />
    </div>
  );
}

// ── Section 3: Automações ───────────────────────────────────────────────────────

const emptyAutomation = (): MessageAutomation => ({
  id: '', product_id: null, trigger: 'pix_gerado',
  steps: [{ delay_minutes: 0, template_id: null, variables: {} }],
  cancel_on_triggers: [], active: true,
});

function AutomationDialog({ open, onOpenChange, initial, products, productsLoading, onAddManualProduct, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: MessageAutomation | null;
  products: KiwifyProduct[];
  productsLoading: boolean;
  onAddManualProduct: (p: KiwifyProduct) => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { data: templates = [] } = useWhatsappTemplates();
  const [form, setForm] = useState<MessageAutomation>(emptyAutomation());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initial ? { ...initial, steps: initial.steps.map((s) => ({ ...s })) } : emptyAutomation());
  }, [open, initial]);

  const setStep = (idx: number, patch: Partial<AutomationStep>) =>
    setForm((f) => ({ ...f, steps: f.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)) }));
  const addStep = () => setForm((f) => ({ ...f, steps: [...f.steps, { delay_minutes: 0, template_id: null, variables: {} }] }));
  const removeStep = (idx: number) => setForm((f) => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) }));

  const toggleCancel = (t: string) =>
    setForm((f) => ({
      ...f,
      cancel_on_triggers: f.cancel_on_triggers.includes(t)
        ? f.cancel_on_triggers.filter((x) => x !== t)
        : [...f.cancel_on_triggers, t],
    }));

  const save = async () => {
    if (!form.trigger || form.steps.length === 0) {
      toast({ title: 'Defina o trigger e ao menos um passo', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        product_id: form.product_id,
        trigger: form.trigger,
        steps: form.steps,
        cancel_on_triggers: form.cancel_on_triggers,
        active: form.active,
      };
      const res = initial
        ? await kdb.from('kiwify_message_automations').update(payload).eq('id', initial.id)
        : await kdb.from('kiwify_message_automations').insert(payload);
      if (res.error) throw res.error;
      toast({ title: initial ? 'Automação atualizada' : 'Automação criada' });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Falha ao salvar', description: err instanceof Error ? err.message : 'Erro', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[15px]">{initial ? 'Editar automação' : 'Nova automação'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Trigger</Label>
              <Select value={form.trigger} onValueChange={(v) => setForm((f) => ({ ...f, trigger: v }))}>
                <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KIWIFY_TRIGGERS.map((t) => <SelectItem key={t} value={t}>{TRIGGER_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Produto</Label>
              <Select
                value={form.product_id ?? '__default__'}
                onValueChange={(v) => setForm((f) => ({ ...f, product_id: v === '__default__' ? null : v }))}
              >
                <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Padrão — todos</SelectItem>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ManualProductEntry
            productsEmpty={products.length === 0}
            productsLoading={productsLoading}
            onAdd={onAddManualProduct}
            onSelect={(id) => setForm((f) => ({ ...f, product_id: id }))}
          />

          {/* Steps */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[12px]">Passos (delay + template WhatsApp)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addStep} className="h-7 gap-1 text-[12px]">
                <Plus className="w-3 h-3" strokeWidth={1.5} /> Passo
              </Button>
            </div>
            {form.steps.map((step, idx) => (
              <div key={idx} className="rounded-[4px] border border-border p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">Passo {idx + 1}</span>
                  {form.steps.length > 1 && (
                    <button type="button" onClick={() => removeStep(idx)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Delay (minutos)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={step.delay_minutes}
                      onChange={(e) => setStep(idx, { delay_minutes: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="h-8 text-[13px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Template</Label>
                    <Select
                      value={step.template_id ?? '__none__'}
                      onValueChange={(v) => setStep(idx, { template_id: v === '__none__' ? null : v })}
                    >
                      <SelectTrigger className="h-8 text-[13px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— nenhum</SelectItem>
                        {templates.map((t) => <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Cancel-on triggers */}
          <div className="space-y-1.5">
            <Label className="text-[12px]">Cancelar quando ocorrer</Label>
            <div className="flex flex-wrap gap-1.5">
              {KIWIFY_TRIGGERS.map((t) => {
                const on = form.cancel_on_triggers.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleCancel(t)}
                    className={cn(
                      'text-[11px] px-2 py-1 rounded-[3px] border transition-colors',
                      on
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-muted text-muted-foreground border-border hover:text-foreground',
                    )}
                  >
                    {TRIGGER_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-border">
            <span className="text-[13px] text-foreground">Ativo</span>
            <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={save} disabled={saving} className="gap-1.5 min-w-[100px]">
            {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />}
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AutomationsSection({ connected }: { connected: boolean }) {
  const { data: automations = [], isLoading, refetch } = useAutomations();
  const { data: apiProducts = [], isLoading: productsLoading } = useKiwifyProducts(connected);
  const { manualProducts, addManualProduct } = useManualProducts();
  const products = useMemo(() => mergeProducts(apiProducts, manualProducts), [apiProducts, manualProducts]);
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MessageAutomation | null>(null);

  const handleDelete = async (id: string) => {
    const { error } = await kdb.from('kiwify_message_automations').delete().eq('id', id);
    if (error) {
      toast({ title: 'Falha ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Automação excluída' });
    refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-foreground">Automações de WhatsApp</p>
          <p className="text-[12px] text-muted-foreground">Fluxos de mensagens por trigger, com delays e cancelamento.</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} /> Nova
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : automations.length === 0 ? (
        <div className="rounded-[4px] border border-dashed border-border bg-card p-8 text-center">
          <p className="text-[13px] text-muted-foreground">Nenhuma automação configurada.</p>
        </div>
      ) : (
        <div className="rounded-[4px] border border-border bg-card divide-y divide-border">
          {automations.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-medium text-foreground">{triggerLabel(a.trigger)}</span>
                  {!a.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">inativo</span>}
                  <span className="text-[11px] text-muted-foreground">· {productLabel(products, a.product_id)}</span>
                </div>
                <p className="text-[12px] text-muted-foreground">
                  {a.steps.length} passo(s): {a.steps.map((s) => `${s.delay_minutes}min`).join(' → ')}
                </p>
                {a.cancel_on_triggers.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    cancela em: {a.cancel_on_triggers.map(triggerLabel).join(', ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(a); setDialogOpen(true); }}>
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(a.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AutomationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        products={products}
        productsLoading={productsLoading}
        onAddManualProduct={addManualProduct}
        onSaved={() => refetch()}
      />
    </div>
  );
}

// ── Section 4: Log de eventos ───────────────────────────────────────────────────

function EventStatusBadge({ status }: { status: EventStatus }) {
  const cls: Record<EventStatus, string> = {
    received:   'bg-muted text-muted-foreground border-border',
    processing: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    processed:  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    failed:     'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    ignored:    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  };
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', cls[status])}>
      {EVENT_STATUS_LABELS[status]}
    </span>
  );
}

function EventRow({ event, onReprocess, reprocessing }: {
  event: WebhookEvent;
  onReprocess: (id: string) => void;
  reprocessing: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <CollapsibleTrigger className="flex items-start gap-2 min-w-0 text-left">
          <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0 transition-transform', open && 'rotate-180')} strokeWidth={1.5} />
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-medium text-foreground">{triggerLabel(event.trigger ?? event.event_type)}</span>
              <EventStatusBadge status={event.status} />
              {!event.signature_valid && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">assinatura?</span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              {event.order_id ? `order ${event.order_id}` : event.subscription_id ? `sub ${event.subscription_id}` : event.event_type}
              {' · '}
              {new Date(event.created_at).toLocaleString('pt-BR')}
            </p>
          </div>
        </CollapsibleTrigger>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-[12px] shrink-0"
          onClick={() => onReprocess(event.id)}
          disabled={reprocessing}
        >
          {reprocessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} /> : <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />}
          Reprocessar
        </Button>
      </div>
      <CollapsibleContent>
        {event.error && (
          <div className="mt-2 ml-5 flex items-start gap-2 px-3 py-2 rounded-[4px] border border-red-500/20 bg-red-500/10">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-[12px] text-red-600 dark:text-red-400">{event.error}</p>
          </div>
        )}
        <pre className="mt-2 ml-5 p-3 rounded-[4px] bg-muted border border-border text-[11px] font-mono overflow-x-auto max-h-64">
          {JSON.stringify(event.raw_payload, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function EventLogSection() {
  const [filters, setFilters] = useState<EventFilters>({ trigger: 'all', status: 'all', period: '7d' });
  const { data: events = [], isLoading, refetch } = useWebhookEvents(filters);
  const { toast } = useToast();
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  const handleReprocess = async (id: string) => {
    setReprocessingId(id);
    try {
      await invokeKiwify({ action: 'reprocess', event_id: id });
      toast({ title: 'Evento reenfileirado para reprocessamento' });
      refetch();
    } catch (err) {
      toast({ title: 'Falha ao reprocessar', description: err instanceof Error ? err.message : 'Erro', variant: 'destructive' });
    } finally {
      setReprocessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filters.trigger} onValueChange={(v) => setFilters((f) => ({ ...f, trigger: v }))}>
          <SelectTrigger className="h-8 w-[190px] text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os triggers</SelectItem>
            {KIWIFY_TRIGGERS.map((t) => <SelectItem key={t} value={t}>{TRIGGER_LABELS[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
          <SelectTrigger className="h-8 w-[150px] text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {EVENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{EVENT_STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.period} onValueChange={(v) => setFilters((f) => ({ ...f, period: v as EventFilters['period'] }))}>
          <SelectTrigger className="h-8 w-[130px] text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Últimas 24h</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : events.length === 0 ? (
        <div className="rounded-[4px] border border-dashed border-border bg-card p-8 text-center">
          <p className="text-[13px] text-muted-foreground">Nenhum evento no período/filtro selecionado.</p>
        </div>
      ) : (
        <div className="rounded-[4px] border border-border bg-card divide-y divide-border">
          {events.map((e) => (
            <EventRow key={e.id} event={e} onReprocess={handleReprocess} reprocessing={reprocessingId === e.id} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────────────────────────

type KiwifyTab = 'conectar' | 'produtos' | 'mapeamentos' | 'automacoes' | 'log';

export default function KiwifyIntegrationConfig() {
  const { data: status } = useKiwifyStatus();
  const [tab, setTab] = useState<KiwifyTab>('conectar');
  const connected = status?.status === 'connected';

  const tabs: { value: KiwifyTab; label: string }[] = [
    { value: 'conectar',    label: 'Conectar' },
    { value: 'produtos',    label: 'Produtos' },
    { value: 'mapeamentos', label: 'Mapeamentos' },
    { value: 'automacoes',  label: 'Automações' },
    { value: 'log',         label: 'Log de eventos' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logos/kiwify.png"
            alt="Kiwify"
            className="w-10 h-10 rounded-lg object-contain shrink-0"
            onError={(e) => {
              const t = e.currentTarget;
              t.style.display = 'none';
              (t.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex');
            }}
          />
          <div className="w-10 h-10 rounded-lg bg-muted items-center justify-center shrink-0 text-[13px] font-bold text-muted-foreground hidden">
            KW
          </div>
          <div>
            <p className="text-[15px] font-semibold text-foreground leading-tight">Kiwify</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">Vendas, carrinho e assinaturas via webhook</p>
          </div>
        </div>
        <StatusBadge status={status?.status ?? 'disconnected'} />
      </div>

      {/* Tabs */}
      <div className="h-8 flex justify-start gap-0 border-b border-border w-full">
        {tabs.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              'h-8 px-4 text-xs border-b-2 -mb-px transition-colors',
              tab === value
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'conectar'    && <ConnectSection />}
      {tab === 'produtos'    && <ProductsSection connected={connected} />}
      {tab === 'mapeamentos' && <MappingsSection connected={connected} />}
      {tab === 'automacoes'  && <AutomationsSection connected={connected} />}
      {tab === 'log'         && <EventLogSection />}
    </div>
  );
}
