/**
 * YampiIntegrationConfig — painel de conexão da loja Yampi (YMP-3.1).
 *
 * Espelha o padrão do KiwifyIntegrationConfig:
 *   - Credenciais (alias + User-Token + User-Secret-Key) → yampi-connect {test|connect}
 *   - Status da conexão + webhook registrado + URL de inbound
 *   - Log dos últimos eventos de webhook (yampi_webhook_events) com reprocesso
 *
 * As credenciais ficam em Perfil → Credenciais de API no painel Yampi.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, Eye, EyeOff, GitBranch, KeyRound, Link2,
  Loader2, RefreshCw, Save, Send, ShieldCheck, Ticket, Unplug, Webhook, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CopyableField } from '@/components/common/CopyableField';
import { useToast } from '@/hooks/use-toast';
import { usePipelines, useStages } from '@/hooks/usePipelinesReal';
import { cn } from '@/lib/utils';

// ── Domain constants (mirror supabase/functions/_shared/yampi-events.ts) ───────

const YAMPI_TRIGGERS = [
  'checkout_iniciado',
  'carrinho_abandonado',
  'pix_gerado',
  'boleto_gerado',
  'pedido_criado',
  'pagamento_recusado',
  'pedido_pago',
  'pedido_cancelado',
  'pedido_status_atualizado',
] as const;
type YampiTrigger = (typeof YAMPI_TRIGGERS)[number];

const TRIGGER_LABELS: Record<YampiTrigger, string> = {
  checkout_iniciado:        'Entrou no checkout',
  carrinho_abandonado:      'Carrinho abandonado',
  pix_gerado:               'PIX gerado',
  boleto_gerado:            'Boleto gerado',
  pedido_criado:            'Pedido criado',
  pagamento_recusado:       'Pagamento recusado',
  pedido_pago:              'Compra finalizada',
  pedido_cancelado:         'Pedido cancelado',
  pedido_status_atualizado: 'Status atualizado',
};

const TRIGGER_HINTS: Partial<Record<YampiTrigger, string>> = {
  checkout_iniciado: 'Sintetizado a cada 5 min a partir dos carrinhos da loja (a Yampi não tem webhook para isso).',
  pedido_status_atualizado: 'Informativo — mapeie apenas se quiser mover o lead em toda mudança de status.',
};
const triggerLabel = (t: string | null) => (t && TRIGGER_LABELS[t as YampiTrigger]) || t || '—';

const EVENT_STATUSES = ['received', 'processing', 'processed', 'failed', 'ignored'] as const;
type EventStatus = (typeof EVENT_STATUSES)[number];
const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  received: 'Recebido', processing: 'Processando', processed: 'Processado',
  failed: 'Falhou', ignored: 'Ignorado',
};

// ── Data shapes ────────────────────────────────────────────────────────────────

interface YampiStatus {
  status: 'connected' | 'disconnected' | 'error';
  connected: boolean;
  alias?: string;
  connection_id?: string;
  inbound_url?: string;
  webhook_registered: boolean;
  last_error?: string | null;
  lead_intake_enabled?: boolean;
}

interface WebhookEvent {
  id: string;
  trigger: string | null;
  event_type: string;
  order_id: string | null;
  cart_token: string | null;
  status: EventStatus;
  signature_valid: boolean;
  error: string | null;
  processed_at: string | null;
  created_at: string;
}

// yampi_* tables are not yet in the generated Supabase types (YMP-1.1);
// same untyped-view pattern as KiwifyIntegrationConfig.
const ydb = supabase as unknown as SupabaseClient;

async function invokeYampi<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('yampi-connect', { body });
  if (error) throw new Error(error.message);
  const res = data as { ok?: boolean; error?: string } & T;
  if (!res?.ok) throw new Error(res?.error ?? 'Erro ao contactar a Yampi');
  return res;
}

function useYampiStatus() {
  return useQuery({
    queryKey: ['yampi', 'status'],
    queryFn: () => invokeYampi<YampiStatus>({ action: 'status' }),
    staleTime: 30_000,
  });
}

interface EventMapping {
  id: string;
  trigger: string;
  target_pipeline_id: string;
  target_stage_id: string;
  active: boolean;
}

function useYampiMappings() {
  return useQuery({
    queryKey: ['yampi', 'mappings'],
    queryFn: async (): Promise<EventMapping[]> => {
      const { data, error } = await ydb
        .from('yampi_event_mappings')
        .select('id, trigger, target_pipeline_id, target_stage_id, active');
      if (error) throw error;
      return (data ?? []) as EventMapping[];
    },
    staleTime: 30_000,
  });
}

function useYampiEvents(trigger: string, status: string) {
  return useQuery({
    queryKey: ['yampi', 'events', trigger, status],
    queryFn: async (): Promise<WebhookEvent[]> => {
      let query = ydb
        .from('yampi_webhook_events')
        .select('id, trigger, event_type, order_id, cart_token, status, signature_valid, error, processed_at, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (trigger !== 'all') query = query.eq('trigger', trigger);
      if (status !== 'all') query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as WebhookEvent[];
    },
    staleTime: 15_000,
  });
}

// ── UI bits ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: YampiStatus['status'] }) {
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
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
      Desconectado
    </span>
  );
}

function EventStatusBadge({ status }: { status: EventStatus }) {
  const cls = status === 'processed'
    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    : status === 'failed'
      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
      : status === 'ignored'
        ? 'bg-muted text-muted-foreground border-border'
        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border', cls)}>
      {EVENT_STATUS_LABELS[status]}
    </span>
  );
}

// ── Esteira: mapeamento evento Yampi → pipeline/stage ──────────────────────────
//
// Uma linha por trigger. A migration YMP-4 já cria o pipeline "Esteira Minimal —
// Loja" com os stages e mappings default; aqui o gestor pode redirecionar cada
// evento para outro pipeline/stage ou desativar o movimento.

type MappingDraft = { pipelineId: string; stageId: string; active: boolean };

function EsteiraMappingSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: mappings, isLoading } = useYampiMappings();
  const { data: pipelines = [] } = usePipelines();
  const { data: stages = [] } = useStages();

  const [drafts, setDrafts] = useState<Record<string, MappingDraft>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mappings) return;
    const next: Record<string, MappingDraft> = {};
    for (const t of YAMPI_TRIGGERS) {
      const m = mappings.find((x) => x.trigger === t);
      next[t] = m
        ? { pipelineId: m.target_pipeline_id, stageId: m.target_stage_id, active: m.active }
        : { pipelineId: '', stageId: '', active: false };
    }
    setDrafts(next);
  }, [mappings]);

  const stagesFor = (pipelineId: string) =>
    stages.filter((s) => s.leads_pipelines_id === pipelineId || s.pipeline_id === pipelineId);

  const dirty = useMemo(() => {
    if (!mappings) return false;
    return YAMPI_TRIGGERS.some((t) => {
      const d = drafts[t];
      if (!d) return false;
      const m = mappings.find((x) => x.trigger === t);
      const base: MappingDraft = m
        ? { pipelineId: m.target_pipeline_id, stageId: m.target_stage_id, active: m.active }
        : { pipelineId: '', stageId: '', active: false };
      return d.pipelineId !== base.pipelineId || d.stageId !== base.stageId || d.active !== base.active;
    });
  }, [drafts, mappings]);

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const t of YAMPI_TRIGGERS) {
        const d = drafts[t];
        if (!d) continue;
        const existing = (mappings ?? []).find((x) => x.trigger === t);
        if (d.pipelineId && d.stageId) {
          const payload = {
            trigger: t,
            target_pipeline_id: d.pipelineId,
            target_stage_id: d.stageId,
            active: d.active,
          };
          const res = existing
            ? await ydb.from('yampi_event_mappings').update(payload).eq('id', existing.id)
            : await ydb.from('yampi_event_mappings').insert(payload);
          if (res.error) throw res.error;
        } else if (existing) {
          const res = await ydb.from('yampi_event_mappings').delete().eq('id', existing.id);
          if (res.error) throw res.error;
        }
      }
      toast({ title: 'Esteira atualizada', description: 'Mapeamentos de eventos salvos.' });
      queryClient.invalidateQueries({ queryKey: ['yampi', 'mappings'] });
    } catch (e) {
      toast({ title: 'Falha ao salvar mapeamentos', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <GitBranch className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <div>
            <span className="text-[13px] font-medium text-foreground">Esteira — evento → etapa do pipeline</span>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Cada evento da loja move (ou cria) o lead do cliente para a etapa mapeada.
              O pipeline “Esteira Minimal — Loja” já vem criado com os mapeamentos padrão.
            </p>
          </div>
        </div>
        <Button size="sm" className="h-8 gap-1.5 text-[12px]" disabled={!dirty || saving} onClick={saveAll}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={1.5} />}
          Salvar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando mapeamentos…
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {YAMPI_TRIGGERS.map((t) => {
            const d = drafts[t] ?? { pipelineId: '', stageId: '', active: false };
            const hint = TRIGGER_HINTS[t];
            return (
              <div key={t} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="w-[190px] min-w-[160px]">
                  <span className="text-[12.5px] font-medium text-foreground">{TRIGGER_LABELS[t]}</span>
                  {hint && <p className="text-[10.5px] text-muted-foreground leading-tight mt-0.5">{hint}</p>}
                </div>
                <Select
                  value={d.pipelineId || '__none__'}
                  onValueChange={(v) => setDrafts((prev) => ({
                    ...prev,
                    [t]: { pipelineId: v === '__none__' ? '' : v, stageId: '', active: v !== '__none__' },
                  }))}
                >
                  <SelectTrigger className="h-8 w-[200px] text-[12px]"><SelectValue placeholder="Pipeline" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— sem movimento —</SelectItem>
                    {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select
                  value={d.stageId || '__none__'}
                  onValueChange={(v) => setDrafts((prev) => ({
                    ...prev,
                    [t]: { ...prev[t], stageId: v === '__none__' ? '' : v },
                  }))}
                  disabled={!d.pipelineId}
                >
                  <SelectTrigger className="h-8 w-[200px] text-[12px]"><SelectValue placeholder="Etapa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— etapa —</SelectItem>
                    {stagesFor(d.pipelineId).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Ativo</span>
                  <Switch
                    checked={d.active}
                    disabled={!d.pipelineId || !d.stageId}
                    onCheckedChange={(v) => setDrafts((prev) => ({ ...prev, [t]: { ...prev[t], active: v } }))}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Prontidão da esteira: um painel, todas as travas e ações de go-live ────────

interface Readiness {
  yampi: { connected: boolean; intake_enabled: boolean };
  pipeline: { found: boolean; stages: number; leads_waiting: number; pending_queue: number };
  rules: Array<{ stage: string; type: string; subject: string | null; active: boolean; wa_template_name: string | null; template_id: string | null }>;
  coupons: Record<string, boolean | null>;
  email: { configured: boolean; active: boolean; provider: string | null; locked: boolean; from_email: string | null };
  sms: { configured: boolean; active: boolean; provider: string | null; locked: boolean };
  whatsapp: { channels: number; active_channel: { id: string; label: string; has_waba: boolean; provider: string | null } | null };
  wa_templates: Array<{ name: string; status: string }>;
  agent: { id: string; name: string; active: boolean; llm_provider: string; llm_model: string; llm_key: boolean } | null;
  business_hours: { enabled: boolean; start_hour: number; end_hour: number } | null;
  api_scopes?: Record<string, 'ok' | 'forbidden' | 'error' | null>;
  native_recovery?: { active?: boolean; email_frequency?: number; email_hours_delay?: number; promocode_in_first_email?: boolean } | null;
}

type Tone = 'ok' | 'warn' | 'off';
function ReadyRow({ tone, label, detail, action }: { tone: Tone; label: string; detail?: string; action?: React.ReactNode }) {
  const dot = tone === 'ok' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : 'bg-muted-foreground/40';
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className={cn('w-2 h-2 rounded-full shrink-0', dot)} />
      <div className="flex-1 min-w-0">
        <span className="text-[12.5px] font-medium text-foreground">{label}</span>
        {detail && <p className="text-[11px] text-muted-foreground leading-snug truncate">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

function EsteiraReadinessCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['yampi', 'readiness'],
    queryFn: () => invokeYampi<Readiness>({ action: 'esteira_readiness' }),
    staleTime: 20_000,
  });

  const run = async (key: string, body: Record<string, unknown>, okTitle: string, fmt: (r: Record<string, unknown>) => string) => {
    setBusy(key);
    try {
      const r = await invokeYampi<Record<string, unknown>>(body);
      toast({ title: okTitle, description: fmt(r) });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['yampi'] });
    } catch (e) {
      toast({ title: 'Falhou', description: (e as Error).message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  if (isLoading || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-2 text-[12px] text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verificando prontidão da esteira…
      </div>
    );
  }

  const r = data;
  const rulesActive = r.rules.filter((x) => x.active).length;
  const emailRules = r.rules.filter((x) => x.type === 'email' && x.active).length;
  const smsRules = r.rules.filter((x) => x.type === 'sms' && x.active).length;
  const waRules = r.rules.filter((x) => x.type === 'whatsapp_template');
  const waApproved = r.wa_templates.filter((t) => /approved/i.test(t.status)).length;
  const couponsOk = r.coupons.VOLTA10 === true && r.coupons.ULTIMA15 === true;
  const emailTone: Tone = !r.email.configured ? 'off' : (!r.email.active || r.email.locked) ? 'warn' : 'ok';
  const smsTone: Tone = smsRules === 0 ? 'off' : !r.sms.configured ? 'warn' : (!r.sms.active || r.sms.locked) ? 'warn' : 'ok';
  const waTone: Tone = !r.whatsapp.active_channel ? 'off' : !r.whatsapp.active_channel.has_waba ? 'warn' : waRules.length > 0 && waApproved === 0 ? 'warn' : 'ok';
  const agentTone: Tone = !r.agent ? 'off' : (!r.agent.active || !r.agent.llm_key) ? 'warn' : 'ok';
  const readyToFire = emailTone === 'ok' && couponsOk && r.pipeline.leads_waiting > 0;

  const btn = (key: string, label: string, onClick: () => void, variant: 'outline' | 'default' = 'outline') => (
    <Button variant={variant} size="sm" className="h-7 gap-1.5 text-[11.5px] shrink-0" disabled={busy !== null} onClick={onClick}>
      {busy === key ? <Loader2 className="w-3 h-3 animate-spin" /> : null}{label}
    </Button>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <div>
            <span className="text-[13px] font-medium text-foreground">Prontidão da esteira</span>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {readyToFire
                ? 'Tudo verde no essencial — pode disparar pelos leads parados abaixo.'
                : 'Cada linha é uma trava do go-live. Verde = pronto · âmbar = falta ação · cinza = não configurado.'}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} /></Button>
      </div>

      <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
        <ReadyRow tone={r.yampi.connected ? 'ok' : 'off'} label="Yampi conectada"
          detail={r.yampi.connected ? (r.yampi.intake_enabled ? 'Entrada de novos leads LIGADA' : 'Entrada de novos leads desligada (recorte congelado)') : 'Conecte a loja'} />
        {r.api_scopes && (() => {
          const forbidden = Object.entries(r.api_scopes).filter(([, v]) => v === 'forbidden').map(([k]) => k);
          return (
            <ReadyRow tone={forbidden.length === 0 ? 'ok' : 'warn'} label="Permissões da credencial de API (Yampi)"
              detail={forbidden.length === 0
                ? 'Pedidos, carrinhos, clientes, catálogo e cupons acessíveis'
                : `Sem acesso a: ${forbidden.join(', ')} — no painel Yampi, dê permissão ao usuário da credencial (Perfil → Usuários → módulo ${forbidden.includes('pedidos') ? '“Pedidos”' : forbidden[0]}). Sem “Pedidos” o agente não consulta pedido/rastreio e a atribuição por cupom fica sem fallback.`} />
          );
        })()}
        {r.native_recovery && (
          <ReadyRow tone={r.native_recovery.active ? 'warn' : 'ok'} label="Recuperação nativa da Yampi (e-mails da própria loja)"
            detail={r.native_recovery.active
              ? `ATIVA: ${r.native_recovery.email_frequency} e-mail(s), o 1º ${r.native_recovery.email_hours_delay}h após o abandono${r.native_recovery.promocode_in_first_email ? ', JÁ COM CUPOM' : ''} — compete com a esteira e entrega desconto antes do dia 3. Desligue em Yampi → Checkout → Recuperação de carrinho (a API não permite desligar).`
              : 'Desligada — só a esteira do CRM fala com o cliente'} />
        )}
        <ReadyRow tone={r.pipeline.found && rulesActive > 0 ? 'ok' : 'warn'} label={`Pipeline e regras da esteira · ${rulesActive} regras ativas`}
          detail={`${r.pipeline.leads_waiting} leads parados em Carrinho abandonado · ${r.pipeline.pending_queue} toques na fila · janela ${r.business_hours?.enabled ? `${r.business_hours.start_hour}h–${r.business_hours.end_hour}h` : 'desligada'}`} />
        <ReadyRow tone={couponsOk ? 'ok' : r.coupons.VOLTA10 === null ? 'warn' : 'warn'} label="Cupons VOLTA10 / ULTIMA15 na Yampi"
          detail={couponsOk ? 'Existem na loja' : r.coupons.VOLTA10 === null ? 'Não verificado (loja desconectada?)' : 'Faltando na loja'}
          action={!couponsOk ? btn('coupons', 'Criar cupons', () => run('coupons', { action: 'ensure_coupons' }, 'Cupons', (x) => (x.coupons as Array<{ code: string; status: string }>).map((c) => `${c.code}: ${c.status}`).join(' · '))) : undefined} />
        <ReadyRow tone={emailTone} label={`E-mail · ${emailRules} regras ativas`}
          detail={!r.email.configured ? 'Canal E-mail sem provider — Configurações → Canais → E-mail (aba Klaviyo)'
            : !r.email.active ? `Provider ${r.email.provider} configurado, canal INATIVO — ative e salve`
            : r.email.locked ? `Klaviyo configurado (${r.email.from_email ?? 'sem From Email'}) — trava de envios FECHADA`
            : `${r.email.provider}${r.email.from_email ? ` · ${r.email.from_email}` : ''} · envios liberados`} />
        <ReadyRow tone={smsTone} label={`SMS · ${smsRules} regras ativas`}
          detail={smsRules === 0 ? 'Sem regras de SMS ativas' : !r.sms.configured ? 'Sem provider de SMS — use Twilio (Klaviyo não envia SMS pro Brasil) ou desative as regras SMS'
            : r.sms.locked ? 'Trava de envios fechada' : !r.sms.active ? 'Canal inativo' : `${r.sms.provider} · liberado`} />
        <ReadyRow tone={waTone} label={`WhatsApp · ${waRules.filter((x) => x.active).length}/${waRules.length} regras ativas · ${waApproved}/${r.wa_templates.length} templates aprovados`}
          detail={!r.whatsapp.active_channel ? 'Sem canal WhatsApp ativo — Canais → WhatsApp (API oficial da Meta, com WABA ID)'
            : !r.whatsapp.active_channel.has_waba ? `Canal "${r.whatsapp.active_channel.label}" sem WABA ID — necessário pra criar templates`
            : r.wa_templates.length === 0 ? `Canal "${r.whatsapp.active_channel.label}" pronto — crie os templates da esteira na Meta`
            : waApproved < r.wa_templates.length ? `Aguardando aprovação da Meta (${r.wa_templates.map((t) => `${t.name.replace('minimal_esteira_', '')}: ${t.status}`).join(', ')})`
            : 'Templates aprovados — regras ativam sozinhas na sincronização'}
          action={r.whatsapp.active_channel?.has_waba && r.wa_templates.length < waRules.length
            ? btn('wa', 'Criar templates na Meta', () => run('wa', { action: 'bootstrap_wa_templates' }, 'Templates enviados à Meta', (x) => (x.templates as Array<{ template: string; status: string; detail?: string }>).map((t) => `${t.template.replace('minimal_esteira_', '')}: ${t.status}${t.detail ? ` (${t.detail})` : ''}`).join(' · ')))
            : undefined} />
        <ReadyRow tone={agentTone} label={r.agent ? `Agente "${r.agent.name}"` : 'Agente de WhatsApp'}
          detail={!r.agent ? 'Nenhum agente da esteira encontrado'
            : !r.agent.active ? 'Agente inativo — ative em Agentes IA'
            : !r.agent.llm_key ? `Falta a API key do provider ${r.agent.llm_provider} — Agentes IA → Provedores`
            : `${r.agent.llm_provider} · ${r.agent.llm_model} · responde leads da esteira no WhatsApp`} />
      </div>
    </div>
  );
}

// ── Disparar esteira: enfileira os follow-ups pros leads JÁ parados num stage ──
//
// A fila só é alimentada na troca de stage — quem já estava lá (backfill dos 297)
// precisa deste disparo. Simular conta sem gravar; Disparar grava e respeita
// as guardas do backend (canal ativo, trava Klaviyo aberta).

function EsteiraDispatchSection() {
  const { toast } = useToast();
  const { data: pipelines = [] } = usePipelines();
  const { data: stages = [] } = useStages();
  const esteira = pipelines.find((p) => /esteira/i.test(p.name)) ?? pipelines[0];
  const esteiraStages = stages.filter((s) => s.leads_pipelines_id === esteira?.id || s.pipeline_id === esteira?.id);
  const [stageId, setStageId] = useState('');
  const [busy, setBusy] = useState<'sim' | 'go' | 'coupons' | null>(null);
  const [sim, setSim] = useState<{ leads: number; entries: number } | null>(null);

  useEffect(() => {
    if (!stageId && esteiraStages.length > 0) setStageId(esteiraStages[0].id);
  }, [esteiraStages, stageId]);

  const simulate = async () => {
    setBusy('sim');
    try {
      const r = await invokeYampi<{ leads: number; entries: number }>({ action: 'enqueue_stage', stage_id: stageId, dry_run: true });
      setSim({ leads: r.leads, entries: r.entries });
    } catch (e) {
      toast({ title: 'Falha na simulação', description: (e as Error).message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const dispatch = async () => {
    const stageName = esteiraStages.find((s) => s.id === stageId)?.name ?? 'stage';
    if (!window.confirm(`Disparar a esteira pros leads parados em "${stageName}"?\n\nIsso agenda TODOS os toques ativos do stage (e-mail/SMS) com os horários da proposta. Os envios saem pelo canal configurado.`)) return;
    setBusy('go');
    try {
      const r = await invokeYampi<{ leads: number; inserted: number }>({ action: 'enqueue_stage', stage_id: stageId, dry_run: false });
      toast({ title: 'Esteira disparada', description: `${r.inserted} toques agendados para ${r.leads} leads. O worker envia cada um no horário (09h–20h).` });
      setSim(null);
    } catch (e) {
      toast({ title: 'Não disparei', description: (e as Error).message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const ensureCoupons = async () => {
    setBusy('coupons');
    try {
      const r = await invokeYampi<{ coupons: Array<{ code: string; status: string; detail?: string }> }>({ action: 'ensure_coupons' });
      toast({ title: 'Cupons na Yampi', description: r.coupons.map((c) => `${c.code}: ${c.status}${c.detail ? ` (${c.detail})` : ''}`).join(' · ') });
    } catch (e) {
      toast({ title: 'Falha nos cupons', description: (e as Error).message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <Send className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
        <div>
          <span className="text-[13px] font-medium text-foreground">Disparar esteira</span>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Agenda os follow-ups do stage pros leads que <span className="font-medium text-foreground">já estão parados</span> nele
            (quem entra depois já recebe automaticamente). Simule antes: nada é gravado.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={stageId} onValueChange={(v) => { setStageId(v); setSim(null); }}>
          <SelectTrigger className="h-8 w-[240px] text-[12px]"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            {esteiraStages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]" disabled={!stageId || busy !== null} onClick={simulate}>
          {busy === 'sim' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />}
          Simular
        </Button>
        <Button size="sm" className="h-8 gap-1.5 text-[12px]" disabled={!stageId || busy !== null || !sim || sim.entries === 0} onClick={dispatch}>
          {busy === 'go' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" strokeWidth={1.5} />}
          Disparar agora
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px] ml-auto" disabled={busy !== null} onClick={ensureCoupons}>
          {busy === 'coupons' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ticket className="w-3.5 h-3.5" strokeWidth={1.5} />}
          Garantir cupons VOLTA10 / ULTIMA15 na Yampi
        </Button>
      </div>
      {sim && (
        <p className={cn('text-[12px]', sim.entries === 0 ? 'text-muted-foreground' : 'text-foreground')}>
          {sim.entries === 0
            ? 'Nada a agendar — sem leads elegíveis ou já enfileirados.'
            : <>Simulação: <span className="font-medium">{sim.leads} leads</span> · <span className="font-medium">{sim.entries} toques</span> seriam agendados. O botão “Disparar agora” grava de verdade.</>}
        </p>
      )}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function YampiIntegrationConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: statusData, isLoading: statusLoading } = useYampiStatus();

  const [alias, setAlias] = useState('');
  const [userToken, setUserToken] = useState('');
  const [userSecret, setUserSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<null | { ok: boolean; message: string }>(null);

  const [backfillDays, setBackfillDays] = useState('7');
  const [eventTrigger, setEventTrigger] = useState('all');
  const [eventStatus, setEventStatus] = useState('all');
  const connected = statusData?.connected ?? false;
  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = useYampiEvents(eventTrigger, eventStatus);

  const refreshStatus = () => queryClient.invalidateQueries({ queryKey: ['yampi'] });
  const credsFilled = useMemo(
    () => alias.trim() !== '' && userToken.trim() !== '' && userSecret.trim() !== '',
    [alias, userToken, userSecret],
  );

  const runTest = async () => {
    setBusy('test');
    setTestResult(null);
    try {
      await invokeYampi({ action: 'test', alias, user_token: userToken, user_secret: userSecret });
      setTestResult({ ok: true, message: 'Credenciais válidas — a loja respondeu.' });
    } catch (e) {
      setTestResult({ ok: false, message: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const runConnect = async () => {
    setBusy('connect');
    try {
      const res = await invokeYampi<{ signature_enforced?: boolean }>({
        action: 'connect', alias, user_token: userToken, user_secret: userSecret,
      });
      toast({
        title: 'Yampi conectada',
        description: res.signature_enforced
          ? 'Webhook registrado com validação de assinatura ativa.'
          : 'Webhook registrado (sem secret de assinatura — verifique no painel Yampi).',
      });
      setUserToken('');
      setUserSecret('');
      refreshStatus();
    } catch (e) {
      toast({ title: 'Falha ao conectar', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const intakeEnabled = statusData?.lead_intake_enabled ?? true;

  const setLeadIntake = async (enabled: boolean) => {
    setBusy('intake');
    try {
      await invokeYampi({ action: 'set_lead_intake', enabled });
      toast({
        title: enabled ? 'Entrada de novos leads ligada' : 'Entrada de novos leads desligada',
        description: enabled
          ? 'Carrinhos e pedidos novos voltam a criar leads na esteira.'
          : 'Eventos novos não criam mais leads — quem já está na esteira continua se movendo.',
      });
      refreshStatus();
    } catch (e) {
      toast({ title: 'Falha ao alterar', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const runBackfill = async () => {
    setBusy('backfill');
    try {
      const res = await invokeYampi<{ scanned: number; synthesized: number; skipped_existing: number; no_identity: number }>(
        { action: 'backfill_carts', days: Number(backfillDays) || 7 },
      );
      toast({
        title: 'Backfill concluído',
        description: `${res.scanned} carrinhos varridos · ${res.synthesized} entraram na esteira · ${res.skipped_existing} já existiam · ${res.no_identity} sem contato`,
      });
      setTimeout(() => refetchEvents(), 2000);
    } catch (e) {
      toast({ title: 'Falha no backfill', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const runDisconnect = async () => {
    setBusy('disconnect');
    try {
      await invokeYampi({ action: 'disconnect' });
      toast({ title: 'Yampi desconectada', description: 'Webhook removido da loja.' });
      refreshStatus();
    } catch (e) {
      toast({ title: 'Falha ao desconectar', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const reprocess = async (eventId: string) => {
    try {
      await invokeYampi({ action: 'reprocess', event_id: eventId });
      toast({ title: 'Evento reenfileirado' });
      setTimeout(() => refetchEvents(), 1500);
    } catch (e) {
      toast({ title: 'Falha ao reprocessar', description: (e as Error).message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Status ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Webhook className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-[13px] font-medium text-foreground">Conexão com a loja</span>
          </div>
          <div className="flex items-center gap-2">
            {statusLoading
              ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              : <StatusBadge status={statusData?.status ?? 'disconnected'} />}
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={refreshStatus}>
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Button>
          </div>
        </div>

        {connected && (
          <div className="space-y-2 text-[12px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.5} />
              Loja <span className="font-medium text-foreground">{statusData?.alias}</span>
              {statusData?.webhook_registered ? ' · webhook registrado' : ' · webhook pendente'}
            </div>
            {statusData?.inbound_url && (
              <CopyableField label="URL de inbound (registrada na Yampi)" value={statusData.inbound_url} />
            )}

            {/* ── Entrada de novos leads ── */}
            <div className={cn(
              'flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3',
              intakeEnabled ? 'border-border bg-muted/30' : 'border-amber-500/30 bg-amber-500/5',
            )}>
              <div className="min-w-0">
                <span className="text-[12.5px] font-medium text-foreground">Entrada de novos leads</span>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  {intakeEnabled
                    ? 'Carrinhos e pedidos novos criam leads na esteira automaticamente.'
                    : 'Desligada — eventos novos não criam leads; quem já está na esteira continua se movendo e a reconversão continua sendo medida.'}
                </p>
              </div>
              <Switch
                checked={intakeEnabled}
                disabled={busy !== null}
                onCheckedChange={setLeadIntake}
              />
            </div>

            <div className="pt-1 flex flex-wrap items-center gap-2">
              <Button
                variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]"
                disabled={busy !== null} onClick={runDisconnect}
              >
                {busy === 'disconnect'
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Unplug className="w-3.5 h-3.5" strokeWidth={1.5} />}
                Desconectar
              </Button>
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-[11px] text-muted-foreground">Backfill: últimos</span>
                <Input
                  value={backfillDays}
                  onChange={(e) => setBackfillDays(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  className="h-8 w-12 text-[12px] text-center"
                />
                <span className="text-[11px] text-muted-foreground">dias</span>
                <Button
                  size="sm" className="h-8 gap-1.5 text-[12px]"
                  disabled={busy !== null}
                  onClick={runBackfill}
                >
                  {busy === 'backfill' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />}
                  Puxar carrinhos abandonados
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              O backfill traz carrinhos abandonados retroativos da Yampi para a esteira — cada um vira lead
              no stage "Carrinho abandonado" e os follow-ups do stage disparam. Idempotente (não duplica).
            </p>
          </div>
        )}

        {statusData?.last_error && (
          <div className="flex items-start gap-2 text-[12px] text-red-600 dark:text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={1.5} />
            {statusData.last_error}
          </div>
        )}
      </div>

      {/* ── Credenciais ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <KeyRound className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <span className="text-[13px] font-medium text-foreground">
            {connected ? 'Substituir credenciais' : 'Conectar a loja'}
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground">
          No painel Yampi: <span className="font-medium text-foreground">Perfil → Credenciais de API</span>.
          O alias é o identificador da loja (aparece na URL do painel).
          Ao conectar, o CRM registra um webhook com os eventos de carrinho abandonado, pedido criado/pago,
          status e pagamento recusado.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-[11px]">Alias da loja</Label>
            <Input
              value={alias} onChange={(e) => setAlias(e.target.value)}
              placeholder="minimal-cases" className="h-9 text-[13px]" autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">User-Token</Label>
            <Input
              value={userToken} onChange={(e) => setUserToken(e.target.value)}
              placeholder="token" className="h-9 text-[13px]" autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">User-Secret-Key</Label>
            <div className="relative">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={userSecret} onChange={(e) => setUserSecret(e.target.value)}
                placeholder="secret" className="h-9 text-[13px] pr-9" autoComplete="off"
              />
              <button
                type="button" onClick={() => setShowSecret((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {testResult && (
          <div className={cn(
            'flex items-start gap-2 text-[12px]',
            testResult.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
          )}>
            {testResult.ok
              ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={1.5} />
              : <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={1.5} />}
            {testResult.message}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]"
            disabled={!credsFilled || busy !== null} onClick={runTest}
          >
            {busy === 'test' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />}
            Testar
          </Button>
          <Button
            size="sm" className="h-8 gap-1.5 text-[12px]"
            disabled={!credsFilled || busy !== null} onClick={runConnect}
          >
            {busy === 'connect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
            {connected ? 'Reconectar' : 'Conectar e registrar webhook'}
          </Button>
        </div>
      </div>

      {/* ── Esteira (mapeamento evento → stage) ───────────────────────────── */}
      <EsteiraMappingSection />

      {/* ── Prontidão + disparo da esteira ───────────────────────────────── */}
      {connected && <EsteiraReadinessCard />}
      {connected && <EsteiraDispatchSection />}

      {/* ── Eventos ────────────────────────────────────────────────────────── */}
      <Collapsible defaultOpen={connected}>
        <div className="rounded-xl border border-border bg-card">
          <CollapsibleTrigger className="w-full flex items-center justify-between p-5">
            <div className="flex items-center gap-2.5">
              <Webhook className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
              <span className="text-[13px] font-medium text-foreground">Eventos recebidos</span>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-5 pb-5 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={eventTrigger} onValueChange={setEventTrigger}>
                  <SelectTrigger className="h-8 w-[210px] text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os gatilhos</SelectItem>
                    {YAMPI_TRIGGERS.map((t) => (
                      <SelectItem key={t} value={t}>{TRIGGER_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={eventStatus} onValueChange={setEventStatus}>
                  <SelectTrigger className="h-8 w-[160px] text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {EVENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{EVENT_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => refetchEvents()}>
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
                </Button>
              </div>

              {eventsLoading ? (
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-4">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando eventos…
                </div>
              ) : (events ?? []).length === 0 ? (
                <p className="text-[12px] text-muted-foreground py-4">
                  Nenhum evento ainda. Assim que a Yampi disparar um webhook, ele aparece aqui.
                </p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {(events ?? []).map((ev) => (
                    <div key={ev.id} className="flex items-center gap-3 px-3 py-2.5 text-[12px]">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{triggerLabel(ev.trigger)}</span>
                          <span className="text-muted-foreground truncate">{ev.event_type}</span>
                          {!ev.signature_valid && (
                            <span title="Assinatura HMAC não validada">
                              <AlertTriangle className="w-3 h-3 text-amber-500" strokeWidth={1.5} />
                            </span>
                          )}
                        </div>
                        <div className="text-muted-foreground truncate">
                          {ev.order_id ? `pedido ${ev.order_id}` : ev.cart_token ? `carrinho ${ev.cart_token.slice(0, 12)}…` : '—'}
                          {' · '}{new Date(ev.created_at).toLocaleString('pt-BR')}
                          {ev.error ? ` · ${ev.error}` : ''}
                        </div>
                      </div>
                      <EventStatusBadge status={ev.status} />
                      {ev.status === 'failed' && (
                        <Button
                          variant="ghost" size="sm" className="h-7 px-2 text-[11px]"
                          onClick={() => reprocess(ev.id)}
                        >
                          Reprocessar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
