import { useState, useMemo, useEffect } from 'react';
import {
  History, Eye, RotateCcw, Clock, CheckCircle2, XCircle, Zap, AlertCircle,
  Loader2, ChevronRight, User, MessageSquare, Terminal, Coins,
  TrendingUp, Timer, BarChart2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VersionRestoreModal } from './VersionRestoreModal';
import { VersionPreviewModal } from './VersionPreviewModal';
import { ChangelogDisplay } from './ChangelogDisplay';
import { useHistoricoAgente, useRestaurarVersao, useAgentExecutionLog } from '@/hooks/useAgentesIA';
import type { AgentExecution } from '@/hooks/useAgentesIAReal';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface HistoricoTabProps {
  agentId: string;
}

// ── Versões sub-tab ───────────────────────────────────────────────────────────

const VersoesTab = ({ agentId }: { agentId: string }) => {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);

  const { data: historico, isLoading, isError } = useHistoricoAgente(agentId);
  const restaurarVersao = useRestaurarVersao();

  const handleRestore = async (versionId: string) => {
    try {
      await restaurarVersao.mutateAsync({ agentId, historyId: versionId });
      setShowRestoreModal(false);
      setSelectedVersion(null);
    } catch (error) {
      console.error('Erro ao restaurar versão:', error);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: ptBR });
    } catch {
      return '—';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground/50">
        <Clock className="h-4 w-4 animate-pulse mr-2" />
        <span className="text-sm">Carregando histórico...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <AlertCircle className="h-8 w-8 text-destructive/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground mb-1">Erro ao carregar histórico</p>
        <p className="text-xs text-muted-foreground/60 max-w-xs">
          Verifique as permissões ou tente novamente mais tarde.
        </p>
      </div>
    );
  }

  if (!historico?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <History className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground mb-1">Nenhuma versão anterior</p>
        <p className="text-xs text-muted-foreground/60 max-w-xs">
          O histórico é criado automaticamente sempre que você salvar alterações no agente.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Histórico de Versões
        </p>
        <span className="text-[10px] text-muted-foreground/50">
          {historico.length} versão{historico.length !== 1 ? 'ões' : ''}
        </span>
      </div>

      <div className="border border-white/[0.06] rounded-[4px] overflow-hidden divide-y divide-white/[0.06]">
        {historico.map((versao, index) => (
          <div
            key={versao.id}
            className={cn(
              'flex gap-4 px-4 py-3',
              index === 0 ? 'bg-primary/5' : 'bg-card hover:bg-card transition-all duration-300'
            )}
          >
            {/* Version badge */}
            <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0 w-14 text-center">
              <span className={cn(
                'text-[11px] font-bold px-1.5 py-0.5 rounded-full border',
                index === 0
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-muted border-white/[0.06] text-muted-foreground'
              )}>
                {index === 0 ? 'Atual' : `v${versao.versao}`}
              </span>
              <span className="text-[9px] text-muted-foreground/50 leading-tight">
                {formatDate(versao.created_at)}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-2">
              {versao.changelog && (
                <ChangelogDisplay
                  changelog={typeof versao.changelog === 'string' ? versao.changelog : JSON.stringify(versao.changelog)}
                  compact={true}
                />
              )}

              {/* Fields status */}
              <div className="flex flex-wrap gap-3">
                {[
                  { label: `Etapas${versao.steps?.length ? ` (${versao.steps.length})` : ''}`, ok: !!versao.usa_etapas },
                  { label: 'Dados entrada', ok: !!versao.dados_entrada },
                  { label: 'Identidade', ok: !!versao.identidade },
                  { label: 'Regras gerais', ok: !!versao.regras_gerais },
                ].map(({ label, ok }) => (
                  <div key={label} className="flex items-center gap-1">
                    {ok
                      ? <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />
                      : <XCircle className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                ))}
                {versao.llm_model && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-muted-foreground/60 bg-muted px-1 rounded">
                      {versao.llm_model}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {index !== 0 && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPreviewVersion(versao.versao);
                    setShowPreviewModal(true);
                  }}
                  className="h-[30px] w-[30px] p-0 text-muted-foreground hover:text-foreground rounded-[4px] transition-colors duration-300"
                  title="Visualizar"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedVersion(versao.id);
                    setShowRestoreModal(true);
                  }}
                  className="h-[30px] w-[30px] p-0 text-muted-foreground hover:text-foreground rounded-[4px] transition-colors duration-300"
                  title="Restaurar esta versão"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <VersionRestoreModal
        open={showRestoreModal}
        onClose={() => { setShowRestoreModal(false); setSelectedVersion(null); }}
        onConfirm={() => selectedVersion && handleRestore(selectedVersion)}
        versao={historico?.find(v => v.id === selectedVersion)?.versao || null}
        isLoading={restaurarVersao.isPending}
      />

      <VersionPreviewModal
        agentId={agentId}
        version={previewVersion || 1}
        open={showPreviewModal}
        onClose={() => { setShowPreviewModal(false); setPreviewVersion(null); }}
      />
    </>
  );
};

// ── Execuções sub-tab ─────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; className: string; icon: typeof Zap }> = {
  running:   { label: 'Executando', className: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400', icon: Loader2 },
  completed: { label: 'Concluído',  className: 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400', icon: CheckCircle2 },
  error:     { label: 'Erro',       className: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400', icon: AlertCircle },
};

// ── Full Execution Detail Modal ───────────────────────────────────────────────

// Safely extract response_data fields — handles both object and double-encoded JSON string
const parseResponseData = (raw: AgentExecution['response_data']): {
  text?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  tool_call_details?: Array<{ name: string; args: Record<string, unknown>; result: string }>;
} => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
};

// Safely extract tools_used — handles null, string (JSON), and actual array
const parseToolsUsed = (raw: AgentExecution['tools_used']): string[] => {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  if (Array.isArray(raw)) return raw;
  return [];
};

const ExecucaoDetailModal = ({
  exec,
  open,
  onClose,
}: {
  exec: AgentExecution | null;
  open: boolean;
  onClose: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<'prompt' | 'resposta' | 'ferramentas'>('prompt');

  // Reset to first tab every time a new execution is opened
  useEffect(() => {
    if (open) setActiveTab('prompt');
  }, [open, exec?.id]);

  if (!exec) return null;

  const responseData = parseResponseData(exec.response_data);
  const usage = responseData.usage;
  const responseText = responseData.text;
  const toolDetails = responseData.tool_call_details;
  const tools = parseToolsUsed(exec.tools_used);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b border-white/[0.06] shrink-0">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            Detalhe da Execução
          </DialogTitle>

          {/* Meta row */}
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {exec.person_name && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <User className="h-3 w-3" />
                {exec.person_name}
              </div>
            )}
            {exec.lead_title && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                {exec.lead_title}
              </div>
            )}
            {exec.execution_duration_ms != null && (
              <span className="text-[11px] text-muted-foreground">
                {exec.execution_duration_ms < 1000
                  ? `${exec.execution_duration_ms}ms`
                  : `${(exec.execution_duration_ms / 1000).toFixed(1)}s`}
              </span>
            )}
            {usage && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Coins className="h-3 w-3" />
                <span>{usage.total_tokens} tokens</span>
                <span className="text-muted-foreground/40">({usage.prompt_tokens}↑ {usage.completion_tokens}↓)</span>
              </div>
            )}
            <span className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded border ml-auto',
              (statusConfig[exec.execution_status] ?? statusConfig.error).className
            )}>
              {(statusConfig[exec.execution_status] ?? statusConfig.error).label}
            </span>
          </div>

          {exec.error_message && (
            <div className="mt-2 text-[11px] text-red-600 dark:text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2.5 py-1.5 font-mono">
              {exec.error_message}
            </div>
          )}
        </DialogHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)} className="flex flex-col flex-1 overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 shrink-0">
            <TabsList className="h-8 bg-transparent p-0 gap-0 rounded-none">
              {(['prompt', 'resposta', 'ferramentas'] as const).map(tab => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="h-8 rounded-none text-xs px-4 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground"
                >
                  {tab === 'prompt' ? 'Prompt entregue' : tab === 'resposta' ? 'Resposta da IA' : 'Ferramentas'}
                  {tab === 'ferramentas' && tools.length > 0
                    ? <span className="ml-1.5 text-[10px] text-muted-foreground/60">({new Set(tools).size})</span>
                    : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <TabsContent value="prompt" className="mt-0 absolute inset-0">
              <ScrollArea className="h-full">
                <pre className="p-5 text-[11px] font-mono text-foreground whitespace-pre-wrap leading-relaxed">
                  {exec.prompt_rendered || '(prompt não disponível)'}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="resposta" className="mt-0 absolute inset-0">
              <ScrollArea className="h-full">
                {responseText ? (
                  <div className="p-5 space-y-4">
                    <pre className="text-[12px] font-sans text-foreground whitespace-pre-wrap leading-relaxed">
                      {responseText}
                    </pre>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/40">
                    <MessageSquare className="h-6 w-6 mb-2" />
                    <span className="text-xs">Sem resposta registrada</span>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="ferramentas" className="mt-0 absolute inset-0">
              <ScrollArea className="h-full">
                {toolDetails && toolDetails.length > 0 ? (
                  <div className="p-5 space-y-3">
                    {toolDetails.map((tc, i) => {
                      const isError = tc.result?.startsWith('Error:') || tc.result?.startsWith('Tool execution error:');
                      const isSkipped = tc.result?.startsWith('Skipped:');
                      return (
                        <div key={i} className={cn(
                          'rounded-[4px] border overflow-hidden',
                          isError ? 'border-red-500/30 bg-red-500/5' : isSkipped ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/[0.06] bg-card'
                        )}>
                          <div className="flex items-center gap-2 px-3 py-2">
                            <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                            <span className="text-xs font-mono font-semibold text-foreground">{tc.name}</span>
                            <span className={cn(
                              'text-[9px] px-1.5 py-0.5 rounded ml-auto shrink-0 font-medium',
                              isError ? 'bg-red-500/10 text-red-600 dark:text-red-400' : isSkipped ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-green-500/10 text-green-700 dark:text-green-400'
                            )}>
                              {isError ? 'erro' : isSkipped ? 'pulado' : 'ok'}
                            </span>
                          </div>
                          {tc.args && Object.keys(tc.args).length > 0 && (
                            <div className="px-3 py-1.5 border-t border-white/[0.06]">
                              <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold">args</span>
                              <pre className="text-[10px] font-mono text-muted-foreground mt-0.5 whitespace-pre-wrap break-all">
                                {JSON.stringify(tc.args, null, 2)}
                              </pre>
                            </div>
                          )}
                          <div className="px-3 py-1.5 border-t border-white/[0.06]">
                            <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold">resultado</span>
                            <pre className={cn(
                              'text-[10px] font-mono mt-0.5 whitespace-pre-wrap break-all',
                              isError ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                            )}>
                              {tc.result || '(vazio)'}
                            </pre>
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-[10px] text-muted-foreground/50 pt-1">
                      {toolDetails.length} chamadas · {new Set(toolDetails.map(t => t.name)).size} ferramentas únicas
                    </p>
                  </div>
                ) : tools.length > 0 ? (() => {
                  const counts: Record<string, number> = {};
                  tools.forEach(t => { counts[t] = (counts[t] ?? 0) + 1; });
                  const unique = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                  return (
                    <div className="p-5 space-y-2">
                      {unique.map(([tool, count]) => (
                        <div key={tool} className="flex items-center gap-2 px-3 py-2 rounded-[4px] bg-card border border-white/[0.06]">
                          <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                          <span className="text-xs font-mono text-foreground flex-1">{tool}</span>
                          {count > 1 && (
                            <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                              ×{count}
                            </span>
                          )}
                        </div>
                      ))}
                      <p className="text-[10px] text-muted-foreground/50 pt-1">
                        {tools.length} chamadas · {unique.length} ferramentas únicas
                      </p>
                    </div>
                  );
                })() : (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/40">
                    <Zap className="h-6 w-6 mb-2" />
                    <span className="text-xs">Nenhuma ferramenta utilizada</span>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// ── ExecucoesTab ──────────────────────────────────────────────────────────────

export const ExecucoesTab = ({ agentId }: { agentId: string }) => {
  const { data: execucoes = [], isLoading, isError } = useAgentExecutionLog(agentId);
  const [selectedExec, setSelectedExec] = useState<AgentExecution | null>(null);

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: ptBR });
    } catch {
      return '—';
    }
  };

  const formatDuration = (ms: number | null) => {
    if (ms == null) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground/50">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">Carregando execuções...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <AlertCircle className="h-8 w-8 text-destructive/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground mb-1">Erro ao carregar execuções</p>
        <p className="text-xs text-muted-foreground/60 max-w-xs">
          Verifique as permissões ou tente novamente mais tarde.
        </p>
      </div>
    );
  }

  if (!execucoes.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <Zap className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground mb-1">Nenhuma execução registrada</p>
        <p className="text-xs text-muted-foreground/60 max-w-xs">
          As execuções aparecem aqui quando o agente processa mensagens via WhatsApp ou Central de Testes.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Execuções recentes
        </p>
        <span className="text-[10px] text-muted-foreground/50">{execucoes.length} registros</span>
      </div>

      <div className="border border-white/[0.06] rounded-[4px] overflow-hidden divide-y divide-white/[0.06]">
        {execucoes.map((exec) => {
          const cfg = statusConfig[exec.execution_status] ?? statusConfig.error;
          const Icon = cfg.icon;
          const rd = parseResponseData(exec.response_data);
          const usage = rd.usage;
          const responseText = rd.text;
          const tools = parseToolsUsed(exec.tools_used);

          return (
            <div
              key={exec.id}
              className="flex gap-3 px-4 py-3 bg-card hover:bg-muted transition-all duration-300 cursor-pointer"
              onClick={() => setSelectedExec(exec)}
            >
              {/* Status icon */}
              <div className="pt-0.5 shrink-0">
                <Icon className={cn(
                  'h-3.5 w-3.5',
                  exec.execution_status === 'running' ? 'animate-spin text-blue-500' :
                  exec.execution_status === 'completed' ? 'text-green-600 dark:text-green-400' :
                  'text-red-600 dark:text-red-400'
                )} />
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0 space-y-1.5">
                {/* Status + person + duration + time */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0',
                    cfg.className
                  )}>
                    {cfg.label}
                  </span>
                  {exec.person_name && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <User className="h-2.5 w-2.5" />
                      {exec.person_name}
                    </span>
                  )}
                  {exec.execution_duration_ms != null && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatDuration(exec.execution_duration_ms)}
                    </span>
                  )}
                  {usage && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Coins className="h-2.5 w-2.5" />
                      {usage.total_tokens}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/50 ml-auto">
                    {formatDate(exec.created_at)}
                  </span>
                </div>

                {/* Response preview */}
                {responseText && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {responseText.slice(0, 160)}
                    {responseText.length > 160 && '…'}
                  </p>
                )}

                {/* Tools used */}
                {tools.length > 0 && (() => {
                  const counts: Record<string, number> = {};
                  tools.forEach(t => { counts[t] = (counts[t] ?? 0) + 1; });
                  const unique = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                  return (
                    <div className="flex flex-wrap gap-1">
                      {unique.slice(0, 4).map(([tool, count]) => (
                        <span
                          key={tool}
                          className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted border border-white/[0.06] text-muted-foreground"
                        >
                          <ChevronRight className="h-2.5 w-2.5" />
                          {tool}
                          {count > 1 && <span className="font-semibold">×{count}</span>}
                        </span>
                      ))}
                      {unique.length > 4 && (
                        <span className="text-[9px] text-muted-foreground/60">
                          +{unique.length - 4}
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Error */}
                {exec.error_message && (
                  <p className="text-[10px] text-red-600 dark:text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2 py-1 font-mono line-clamp-1">
                    {exec.error_message}
                  </p>
                )}
              </div>

              {/* View button */}
              <div className="shrink-0 flex items-start pt-0.5">
                <Eye className="h-3.5 w-3.5 text-muted-foreground/30" />
              </div>
            </div>
          );
        })}
      </div>

      <ExecucaoDetailModal
        exec={selectedExec}
        open={!!selectedExec}
        onClose={() => setSelectedExec(null)}
      />
    </>
  );
};

// ── AnalyticsTab ──────────────────────────────────────────────────────────────

export const AnalyticsTab = ({ agentId }: { agentId: string }) => {
  const { data: execucoes = [], isLoading } = useAgentExecutionLog(agentId);

  const stats = useMemo(() => {
    if (!execucoes.length) return null;

    const total = execucoes.length;
    const completed = execucoes.filter(e => e.execution_status === 'completed').length;
    const errors = execucoes.filter(e => e.execution_status === 'error').length;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const durationsMs = execucoes
      .filter(e => e.execution_duration_ms != null)
      .map(e => e.execution_duration_ms as number);
    const avgDuration = durationsMs.length
      ? Math.round(durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length)
      : null;

    const totalTokens = execucoes.reduce((sum, e) => sum + (parseResponseData(e.response_data).usage?.total_tokens ?? 0), 0);

    // Tool frequency
    const toolCount: Record<string, number> = {};
    execucoes.forEach(e => {
      parseToolsUsed(e.tools_used).forEach(t => {
        toolCount[t] = (toolCount[t] ?? 0) + 1;
      });
    });
    const topTools = Object.entries(toolCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    // Last 7 days success/error
    const now = Date.now();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now - i * 86_400_000);
      return d.toISOString().slice(0, 10);
    }).reverse();
    const byDay = days.map(day => {
      const dayExecs = execucoes.filter(e => e.created_at.startsWith(day));
      return {
        day: day.slice(5), // MM-DD
        ok: dayExecs.filter(e => e.execution_status === 'completed').length,
        err: dayExecs.filter(e => e.execution_status === 'error').length,
      };
    });
    const maxDayCount = Math.max(...byDay.map(d => d.ok + d.err), 1);

    return { total, completed, errors, successRate, avgDuration, totalTokens, topTools, byDay, maxDayCount };
  }, [execucoes]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground/50">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">Carregando analytics...</span>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <BarChart2 className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground mb-1">Sem dados ainda</p>
        <p className="text-xs text-muted-foreground/60">Analytics aparece após as primeiras execuções do agente.</p>
      </div>
    );
  }

  const formatDuration = (ms: number | null) => {
    if (ms == null) return '—';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Execuções', value: String(stats.total), icon: Zap, color: 'text-blue-500' },
          { label: 'Taxa de sucesso', value: `${stats.successRate}%`, icon: TrendingUp, color: stats.successRate >= 80 ? 'text-green-500' : stats.successRate >= 50 ? 'text-amber-500' : 'text-red-500' },
          { label: 'Duração média', value: formatDuration(stats.avgDuration), icon: Timer, color: 'text-purple-500' },
          { label: 'Tokens totais', value: stats.totalTokens.toLocaleString('pt-BR'), icon: Coins, color: 'text-orange-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="border border-white/[0.06] rounded-[4px] bg-card px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Icon className={`h-3.5 w-3.5 ${color}`} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
            <p className="text-lg font-bold text-foreground leading-none">{value}</p>
          </div>
        ))}
      </div>

      {/* Last 7 days mini chart */}
      <div className="border border-white/[0.06] rounded-[4px] bg-card p-4">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
          Últimos 7 dias
        </p>
        <div className="flex items-end gap-1.5 h-16">
          {stats.byDay.map(({ day, ok, err }) => {
            const total = ok + err;
            const heightPct = total > 0 ? Math.round((total / stats.maxDayCount) * 100) : 0;
            const okPct = total > 0 ? Math.round((ok / total) * 100) : 0;
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm overflow-hidden flex flex-col-reverse"
                  style={{ height: `${Math.max(heightPct, total > 0 ? 8 : 0)}%`, minHeight: total > 0 ? '4px' : '0' }}
                  title={`${day}: ${ok} ok, ${err} erros`}
                >
                  {err > 0 && (
                    <div className="bg-red-500/60 shrink-0" style={{ height: `${100 - okPct}%`, minHeight: '2px' }} />
                  )}
                  {ok > 0 && (
                    <div className="bg-green-500/60 flex-1" />
                  )}
                </div>
                <span className="text-[8px] text-muted-foreground/50 font-mono">{day}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500/60" />
            <span className="text-[10px] text-muted-foreground">Sucesso ({stats.completed})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500/60" />
            <span className="text-[10px] text-muted-foreground">Erro ({stats.errors})</span>
          </div>
        </div>
      </div>

      {/* Top tools */}
      {stats.topTools.length > 0 && (
        <div className="border border-white/[0.06] rounded-[4px] bg-card p-4">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Ferramentas mais usadas
          </p>
          <div className="space-y-2">
            {stats.topTools.map(([tool, count]) => {
              const maxCount = stats.topTools[0][1];
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={tool} className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-foreground w-44 truncate shrink-0">{tool}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-6 text-right shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main HistoricoTab — versões only (execuções + analytics are top-level tabs) ─

export const HistoricoTab = ({ agentId }: HistoricoTabProps) => {
  return (
    <div className="h-full relative">
      <div className="absolute inset-0 overflow-auto px-6 py-5">
        <VersoesTab agentId={agentId} />
      </div>
    </div>
  );
};
