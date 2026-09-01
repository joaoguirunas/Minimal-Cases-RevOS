/**
 * ZoppyIntegrationConfig — conexão Zoppy + import da base antiga (ZPY-2).
 *
 * Credenciais (Bearer token da plataforma + chave zoppy-access do time Zoppy),
 * e três imports com progresso: clientes → clients_people (a base para e-mail),
 * pedidos e carrinhos abandonados (staging para segmentação; a esteira em si
 * vem do Yampi).
 */

import { useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Download, Eye, EyeOff, KeyRound, Link2,
  Loader2, RefreshCw, Unplug, Users, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ── Data shapes ────────────────────────────────────────────────────────────────

type SyncStatus = 'idle' | 'running' | 'done' | 'error';

interface SyncRow {
  resource: 'customers' | 'orders' | 'abandoned-carts';
  status: SyncStatus;
  next_page: number;
  total_synced: number;
  contacts_created: number;
  contacts_matched: number;
  last_error: string | null;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

interface ZoppyStatus {
  status: 'connected' | 'disconnected' | 'error';
  connected: boolean;
  last_error?: string | null;
  sync: SyncRow[];
}

const RESOURCES: { key: SyncRow['resource']; label: string; desc: string }[] = [
  { key: 'customers', label: 'Clientes', desc: 'Cria/atualiza contatos no CRM (e-mail e WhatsApp prontos pra trabalhar). Importe este primeiro.' },
  { key: 'orders', label: 'Pedidos', desc: 'Histórico de compras com itens, cupom e totais — base para segmentação.' },
  { key: 'abandoned-carts', label: 'Carrinhos abandonados', desc: 'Carrinhos com itens e URL de recuperação (a esteira ativa usa o Yampi; aqui é histórico).' },
];

async function invokeZoppy<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('zoppy-connect', { body });
  if (error) throw new Error(error.message);
  const res = data as { ok?: boolean; error?: string } & T;
  if (!res?.ok) throw new Error(res?.error ?? 'Erro ao contactar a Zoppy');
  return res;
}

function useZoppyStatus(pollWhileRunning: boolean) {
  return useQuery({
    queryKey: ['zoppy', 'status'],
    queryFn: () => invokeZoppy<ZoppyStatus>({ action: 'status' }),
    staleTime: 10_000,
    refetchInterval: pollWhileRunning ? 4000 : false,
  });
}

// ── UI bits ────────────────────────────────────────────────────────────────────

function ConnBadge({ status }: { status: ZoppyStatus['status'] }) {
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

function SyncBadge({ status }: { status: SyncStatus }) {
  const map: Record<SyncStatus, [string, string]> = {
    idle: ['Nunca importado', 'bg-muted text-muted-foreground border-border'],
    running: ['Importando…', 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'],
    done: ['Concluído', 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'],
    error: ['Erro', 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'],
  };
  const [label, cls] = map[status];
  return <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border', cls)}>{label}</span>;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ZoppyIntegrationConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [apiToken, setApiToken] = useState('');
  const [zoppyAccess, setZoppyAccess] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<null | { ok: boolean; message: string }>(null);

  const statusQuery = useZoppyStatus(true);
  const statusData = statusQuery.data;
  const anyRunning = (statusData?.sync ?? []).some((s) => s.status === 'running');
  // Re-poll only while something is importing.
  useZoppyStatus(anyRunning);

  const connected = statusData?.connected ?? false;
  const credsFilled = useMemo(() => apiToken.trim() !== '' && zoppyAccess.trim() !== '', [apiToken, zoppyAccess]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['zoppy'] });

  const run = async (label: string, body: Record<string, unknown>, okMsg: string) => {
    setBusy(label);
    try {
      await invokeZoppy(body);
      toast({ title: okMsg });
      refresh();
    } catch (e) {
      toast({ title: 'Falha', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    setBusy('test');
    setTestResult(null);
    try {
      await invokeZoppy({ action: 'test', api_token: apiToken, zoppy_access: zoppyAccess });
      setTestResult({ ok: true, message: 'Credenciais válidas — a Zoppy respondeu.' });
    } catch (e) {
      setTestResult({ ok: false, message: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const syncFor = (key: SyncRow['resource']): SyncRow | undefined =>
    (statusData?.sync ?? []).find((s) => s.resource === key);

  return (
    <div className="space-y-6">
      {/* ── Conexão ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-[13px] font-medium text-foreground">Conexão com a Zoppy</span>
          </div>
          <div className="flex items-center gap-2">
            {statusQuery.isLoading
              ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              : <ConnBadge status={statusData?.status ?? 'disconnected'} />}
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={refresh}>
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Button>
          </div>
        </div>

        <p className="text-[12px] text-muted-foreground">
          O token fica no menu <span className="font-medium text-foreground">Chave de API</span> da
          plataforma Zoppy; a chave <span className="font-mono text-[11px]">zoppy-access</span> é
          fornecida pelo time de tecnologia da Zoppy.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[11px]">Chave de API (Bearer token)</Label>
            <Input
              value={apiToken} onChange={(e) => setApiToken(e.target.value)}
              placeholder="token" className="h-9 text-[13px]" autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">zoppy-access</Label>
            <div className="relative">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={zoppyAccess} onChange={(e) => setZoppyAccess(e.target.value)}
                placeholder="chave" className="h-9 text-[13px] pr-9" autoComplete="off"
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
            disabled={!credsFilled || busy !== null}
            onClick={() => run('connect', { action: 'connect', api_token: apiToken, zoppy_access: zoppyAccess }, 'Zoppy conectada')}
          >
            {busy === 'connect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
            {connected ? 'Reconectar' : 'Conectar'}
          </Button>
          {connected && (
            <Button
              variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]"
              disabled={busy !== null}
              onClick={() => run('disconnect', { action: 'disconnect' }, 'Zoppy desconectada')}
            >
              {busy === 'disconnect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" strokeWidth={1.5} />}
              Desconectar
            </Button>
          )}
        </div>

        {statusData?.last_error && (
          <div className="flex items-start gap-2 text-[12px] text-red-600 dark:text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={1.5} />
            {statusData.last_error}
          </div>
        )}
      </div>

      {/* ── Imports ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <Users className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <div>
            <span className="text-[13px] font-medium text-foreground">Importar a base da Zoppy</span>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Roda em background (páginas de 100). Importe <span className="font-medium text-foreground">Clientes</span> primeiro —
              pedidos e carrinhos vinculam contatos pela base de clientes.
            </p>
          </div>
        </div>

        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {RESOURCES.map(({ key, label, desc }) => {
            const s = syncFor(key);
            const running = s?.status === 'running';
            const btnLabel = s?.status === 'error' ? 'Retomar' : s?.status === 'done' ? 'Reimportar' : 'Importar';
            return (
              <div key={key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-foreground">{label}</span>
                    <SyncBadge status={s?.status ?? 'idle'} />
                  </div>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">{desc}</p>
                  {s && s.status !== 'idle' && (
                    <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                      {s.total_synced} registros
                      {key === 'customers' && ` · ${s.contacts_created} contatos novos · ${s.contacts_matched} já existiam`}
                      {s.status === 'running' && ` · página ${s.next_page}`}
                      {s.last_error ? ` · ${s.last_error}` : ''}
                    </p>
                  )}
                </div>
                <Button
                  size="sm" variant={s?.status === 'done' ? 'outline' : 'default'}
                  className="h-8 gap-1.5 text-[12px]"
                  disabled={!connected || running || busy !== null}
                  onClick={() => run(`sync-${key}`, { action: 'start_sync', resource: key }, `Import de ${label.toLowerCase()} iniciado`)}
                >
                  {running || busy === `sync-${key}`
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Download className="w-3.5 h-3.5" strokeWidth={1.5} />}
                  {running ? 'Rodando…' : btnLabel}
                </Button>
              </div>
            );
          })}
        </div>

        {!connected && (
          <p className="text-[11.5px] text-muted-foreground">Conecte a Zoppy acima para liberar os imports.</p>
        )}
      </div>
    </div>
  );
}
