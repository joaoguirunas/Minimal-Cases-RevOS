import { useState, useEffect } from 'react';
import {
  CheckCircle2, XCircle, RefreshCw, Copy, Check, Eye, EyeOff, Video,
  Webhook, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase, supabaseUrl } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAgendamentosSimple } from '@/hooks/useAgendamentosSimple';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TldvCredentials {
  api_key?: string;
  webhook_header_name?: string;
  webhook_header_value?: string;
  is_active?: boolean;
}

interface UnmatchedMeeting {
  tldv_id: string;
  title: string;
  date: string;
  participants: string[];
}

interface SyncResult {
  synced?: number;
  unmatched_count?: number;
  unmatched_meetings?: UnmatchedMeeting[];
}

// ── Query ─────────────────────────────────────────────────────────────────────

function useTldvConfig() {
  return useQuery({
    queryKey: ['omni_channel_configs', 'tldv'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('omni_channel_configs')
        .select('credentials')
        .eq('channel', 'tldv')
        .maybeSingle();
      if (error) throw error;
      return (data?.credentials as TldvCredentials) ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── CopyRow (local, same pattern as MetaIntegrationConfig) ────────────────────

function CopyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input value={value} readOnly className="h-[30px] text-xs font-mono bg-muted flex-1" />
        <Button size="icon" variant="ghost" onClick={copy} className="h-[30px] w-8 shrink-0">
          {copied
            ? <Check className="w-3.5 h-3.5 text-green-500" />
            : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
        </Button>
      </div>
      {hint && <p className="text-[10px] text-muted-foreground leading-relaxed">{hint}</p>}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-[4px] p-4 space-y-3">
      <p className="text-[12px] font-semibold text-foreground">{title}</p>
      {children}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function TldvIntegrationConfig() {
  const queryClient = useQueryClient();
  const { data: credentials, isLoading } = useTldvConfig();
  const { data: agendamentos } = useAgendamentosSimple();

  // Section 1 — API Key
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  // Section 2 — Webhook header
  const [headerName, setHeaderName] = useState('');
  const [headerValue, setHeaderValue] = useState('');
  const [savingHeader, setSavingHeader] = useState(false);

  // Section 3 — Sync
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Section 4 — Unmatched association
  const [associations, setAssociations] = useState<Record<string, string>>({});
  const [associating, setAssociating] = useState<Record<string, boolean>>({});

  const webhookUrl = `${supabaseUrl}/functions/v1/tldv-webhook`;

  // Populate fields from saved credentials
  useEffect(() => {
    if (!credentials) return;
    setApiKey(credentials.api_key ? '••••••••' : '');
    setHeaderName(credentials.webhook_header_name ?? '');
    setHeaderValue(credentials.webhook_header_value ?? '');
    setIsConnected(credentials.is_active ?? null);
  }, [credentials]);

  const isMasked = (v: string) => v === '••••••••';

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function upsertCredentials(patch: Partial<TldvCredentials>) {
    const merged: TldvCredentials = {
      ...(credentials ?? {}),
      ...patch,
    };

    const { error } = await supabase
      .from('omni_channel_configs')
      .upsert(
        { channel: 'tldv', display_name: 'tl;dv', credentials: merged as Record<string, unknown> },
        { onConflict: 'channel' },
      );

    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['omni_channel_configs', 'tldv'] });
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSaveKey = async () => {
    if (!apiKey || isMasked(apiKey)) {
      toast.error('Preencha a API Key');
      return;
    }
    setSavingKey(true);
    try {
      await upsertCredentials({ api_key: apiKey });
      setApiKey('••••••••');
      toast.success('API Key guardada');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar API Key');
    } finally {
      setSavingKey(false);
    }
  };

  const handleTestConnection = () => {
    // Simple local check: key present = configured
    const hasKey = credentials?.api_key || (!isMasked(apiKey) && apiKey.trim().length > 0);
    setIsConnected(!!hasKey);
    if (hasKey) {
      toast.success('API Key configurada');
    } else {
      toast.error('API Key não configurada');
    }
  };

  const handleSaveHeader = async () => {
    setSavingHeader(true);
    try {
      await upsertCredentials({
        webhook_header_name: headerName,
        webhook_header_value: headerValue,
      });
      toast.success('Header guardado');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar header');
    } finally {
      setSavingHeader(false);
    }
  };

  const handleSync = async (days: number) => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('tldv-sync', {
        body: { days },
      });
      if (error) throw error;
      const result = data as SyncResult;
      setSyncResult(result);
      toast.success(
        `${result.synced ?? 0} reuniões sincronizadas, ${result.unmatched_count ?? 0} sem correspondência`,
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const handleAssociate = async (tldvId: string) => {
    const meetingId = associations[tldvId];
    if (!meetingId) {
      toast.error('Selecciona uma reunião do CRM');
      return;
    }
    setAssociating(prev => ({ ...prev, [tldvId]: true }));
    try {
      const { error } = await supabase
        .from('meeting_records')
        .insert({
          meeting_id: meetingId,
          record_type: 'note',
          source: 'tldv',
          title: `tl;dv — ${tldvId}`,
          content: `Associado manualmente via painel de configuração.`,
        });
      if (error) throw error;
      toast.success('Reunião associada');
      // Remove from unmatched list locally
      setSyncResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          unmatched_meetings: (prev.unmatched_meetings ?? []).filter(m => m.tldv_id !== tldvId),
        };
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao associar');
    } finally {
      setAssociating(prev => ({ ...prev, [tldvId]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    );
  }

  const unmatchedList = syncResult?.unmatched_meetings ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border border-border rounded-[4px] p-4 flex items-center gap-3">
        <div className="w-7 h-7 rounded-[4px] bg-violet-500/10 flex items-center justify-center shrink-0">
          <Video className="w-4 h-4 text-violet-500" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground">tl;dv</p>
          <p className="text-[11px] text-muted-foreground/60">
            Sincroniza gravações e transcrições de reuniões automaticamente
          </p>
        </div>
        {isConnected === true && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 border border-emerald-200/30 px-1.5 py-0.5 rounded-full leading-none shrink-0">
            <CheckCircle2 className="w-2.5 h-2.5" strokeWidth={1.5} /> Conectado
          </span>
        )}
        {isConnected === false && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-500/8 border border-red-200/30 px-1.5 py-0.5 rounded-full leading-none shrink-0">
            <XCircle className="w-2.5 h-2.5" strokeWidth={1.5} /> Não configurado
          </span>
        )}
      </div>

      {/* Section 1 — API Key */}
      <Section title="API Key">
        <div className="space-y-1.5">
          <Label className="text-[12px] text-muted-foreground">API Key do tl;dv</Label>
          <div className="flex items-center gap-2">
            <Input
              type={showKey ? 'text' : 'password'}
              placeholder="••••••••"
              value={apiKey}
              onFocus={(e) => { if (isMasked(e.target.value)) setApiKey(''); }}
              onChange={(e) => setApiKey(e.target.value)}
              className="h-[30px] text-[13px] font-mono flex-1"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setShowKey(v => !v)}
              className="h-[30px] w-8 shrink-0"
            >
              {showKey
                ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={handleSaveKey}
            disabled={savingKey || !apiKey || isMasked(apiKey)}
            className="h-[30px] px-3 text-[12px] gap-1.5"
          >
            {savingKey && <RefreshCw className="w-3 h-3 animate-spin" strokeWidth={1.5} />}
            Guardar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestConnection}
            className="h-[30px] px-3 text-[12px]"
          >
            Testar ligação
          </Button>
        </div>
        <a
          href="https://tldv.io/app/settings/personal-settings/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          Obter API Key em tldv.io
        </a>
      </Section>

      {/* Section 2 — Webhook */}
      <Section title="Configurar Webhook no tl;dv">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Cole este URL nas configurações de Webhook do tl;dv (Settings &rarr; Webhooks).
          Ative os eventos <code className="font-mono bg-muted px-1 rounded text-[10px]">MeetingReady</code>{' '}
          e <code className="font-mono bg-muted px-1 rounded text-[10px]">TranscriptReady</code>.
        </p>
        <div className="flex items-center gap-2 mb-1">
          <Webhook className="w-3.5 h-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
          <p className="text-[11px] font-medium text-foreground">URL do Webhook</p>
        </div>
        <CopyRow
          label="Endpoint"
          value={webhookUrl}
          hint="Cole em: Settings → Webhooks → URL"
        />

        <div className="pt-2 space-y-3">
          <p className="text-[11px] font-medium text-foreground">Header de segurança (opcional)</p>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Nome do header</Label>
            <Input
              placeholder="x-tldv-secret"
              value={headerName}
              onChange={(e) => setHeaderName(e.target.value)}
              className="h-[30px] text-[13px] font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Valor do header</Label>
            <Input
              placeholder="Secret aleatório..."
              value={headerValue}
              onChange={(e) => setHeaderValue(e.target.value)}
              className="h-[30px] text-[13px] font-mono"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveHeader}
            disabled={savingHeader}
            className="h-[30px] px-3 text-[12px] gap-1.5"
          >
            {savingHeader && <RefreshCw className="w-3 h-3 animate-spin" strokeWidth={1.5} />}
            Guardar header
          </Button>
        </div>
      </Section>

      {/* Section 3 — Sync */}
      <Section title="Sincronização">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSync(7)}
            disabled={syncing}
            className="h-[30px] px-3 text-[12px] gap-1.5"
          >
            {syncing
              ? <><RefreshCw className="w-3 h-3 animate-spin" strokeWidth={1.5} />A sincronizar...</>
              : 'Sincronizar últimos 7 dias'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSync(1)}
            disabled={syncing}
            className="h-[30px] px-3 text-[12px] gap-1.5"
          >
            {syncing
              ? <><RefreshCw className="w-3 h-3 animate-spin" strokeWidth={1.5} />A sincronizar...</>
              : 'Sincronizar últimas 24h'}
          </Button>
        </div>
        {syncResult && (
          <p className="text-[11px] text-muted-foreground">
            {syncResult.synced ?? 0} reuniões sincronizadas
            {(syncResult.unmatched_count ?? 0) > 0
              ? `, ${syncResult.unmatched_count} sem correspondência`
              : ''}
            .
          </p>
        )}
      </Section>

      {/* Section 4 — Unmatched meetings */}
      {unmatchedList.length > 0 && (
        <Section title="Reuniões sem correspondência">
          <p className="text-[11px] text-muted-foreground">
            Estas reuniões do tl;dv não foram associadas automaticamente a nenhuma reunião do CRM.
          </p>
          <div className="space-y-3">
            {unmatchedList.map((meeting) => (
              <div key={meeting.tldv_id} className="border border-border rounded-[4px] p-3 space-y-2">
                <div className="space-y-0.5">
                  <p className="text-[12px] font-medium text-foreground">{meeting.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(meeting.date).toLocaleString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                  {meeting.participants.length > 0 && (
                    <p className="text-[11px] text-muted-foreground/70">
                      {meeting.participants.join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={associations[meeting.tldv_id] ?? ''}
                    onValueChange={(v) =>
                      setAssociations(prev => ({ ...prev, [meeting.tldv_id]: v }))
                    }
                  >
                    <SelectTrigger className="h-[28px] text-xs flex-1">
                      <SelectValue placeholder="Seleccionar reunião do CRM..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(agendamentos ?? []).map((ag) => {
                        const label =
                          (ag.negocio as { titulo?: string; title?: string } | null)?.titulo
                          ?? (ag.negocio as { titulo?: string; title?: string } | null)?.title
                          ?? ag.id;
                        const dateStr = ag.start_time
                          ? new Date(ag.start_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                          : '';
                        return (
                          <SelectItem key={ag.id} value={ag.id} className="text-xs">
                            {dateStr ? `${dateStr} — ` : ''}{label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => handleAssociate(meeting.tldv_id)}
                    disabled={associating[meeting.tldv_id] || !associations[meeting.tldv_id]}
                    className="h-[28px] px-2.5 text-xs shrink-0 gap-1"
                  >
                    {associating[meeting.tldv_id] && (
                      <RefreshCw className="w-3 h-3 animate-spin" strokeWidth={1.5} />
                    )}
                    Associar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
