import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Trash2, Copy, Save, Loader2, Check, Mic, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useAgenteById, usePassosAgente, useSalvarAgente, useExcluirAgente } from '@/hooks/useAgentesIA';
import { usePipelines } from '@/hooks/usePipelines';
import { useScoreMatrices } from '@/hooks/useAgentesIAReal';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import RestrictedRouteComponent from '@/components/auth/RestrictedRoute';
import type { AgenteIA } from '@/hooks/useAgentesIA';
import { ConfiguracaoTab } from '@/components/agentes-ia/ConfiguracaoTab';
import { ContextoTab } from '@/components/agentes-ia/ContextoTab';
import { PromptsTab } from '@/components/agentes-ia/PromptsTab';
import { HistoricoTab, ExecucoesTab, AnalyticsTab } from '@/components/agentes-ia/HistoricoTab';
import { VoiceAgentConfigTab } from '@/components/agentes-ia/VoiceAgentConfigTab';
import { ConfirmarExclusaoModal } from '@/components/modals/ConfirmarExclusaoModal';
import type { Etapa } from '@/components/agentes-ia/PromptEtapaEditor';

// Flatten any nested edge-function error payload into a readable single line.
// Mirrors the edge function's own flattenDetail so { detail: { message } },
// { detail: [{ msg }] }, etc. never reach the toast as [object Object].
const flattenDetail = (d: unknown): string => {
  if (d == null) return '';
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map(flattenDetail).filter(Boolean).join('; ');
  if (typeof d === 'object') {
    const obj = d as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.msg === 'string') return obj.msg;
    if (typeof obj.detail === 'string') return obj.detail;
    if (obj.detail !== undefined) return flattenDetail(obj.detail);
    if (typeof obj.error === 'string') return obj.error;
    return JSON.stringify(d);
  }
  return String(d);
};

const composeDesc = (top: unknown, detail: unknown): string => {
  const a = flattenDetail(top);
  const b = flattenDetail(detail);
  if (a && b && a !== b) return `${a} — ${b}`;
  return a || b;
};

// Shallow diff that ignores key order and treats undefined === missing.
// Compares arrays by JSON value (order-sensitive — matches user intent for
// channel_types/stage_ids etc.) and primitives by ===. The union of keys from
// both sides is checked so newly added fields on either side count as a diff.
const hasShallowDiff = (
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const av = a[k];
    const bv = b[k];
    if (av === bv) continue;
    if (av == null && bv == null) continue;
    if (Array.isArray(av) && Array.isArray(bv)) {
      if (JSON.stringify(av) !== JSON.stringify(bv)) return true;
      continue;
    }
    return true;
  }
  return false;
};

const AgenteSingleContent = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showExcluir, setShowExcluir] = useState(false);
  const [editedAgent, setEditedAgent] = useState<Partial<AgenteIA>>({});
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [serverEtapas, setServerEtapas] = useState<Etapa[]>([]);
  const [activeTab, setActiveTab] = useState<'config' | 'contexto' | 'prompts' | 'historico' | 'execucoes' | 'analytics'>('config');
  const [savedRecently, setSavedRecently] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the updated_at timestamp of the last server state synced into editedAgent.
  // Background refetches that return the same data (same updated_at) are ignored,
  // preventing them from clobbering unsaved user edits when the window regains focus.
  const lastSyncedAtRef = useRef<string | null>(null);
  // Serialized fingerprint of the last passos array synced into etapas state.
  const lastSyncedPassosRef = useRef<string | null>(null);

  const { data: agente, isLoading: loadingAgente } = useAgenteById(id || '');
  const { data: passos, isLoading: loadingPassos } = usePassosAgente(id || '');
  const { data: scoreMatrices = [] } = useScoreMatrices();
  const { pipelines = [], stages = [] } = usePipelines();

  const salvarMutation = useSalvarAgente();
  const excluirMutation = useExcluirAgente();

  const isLoading = loadingAgente || loadingPassos;

  // Detect unsaved changes — shallow per-key comparison instead of JSON.stringify
  // because key insertion order differs between the server-mapped object and
  // the spread-merged user edits, producing false positives.
  const isDirty = agente
    ? hasShallowDiff(agente as Record<string, unknown>, editedAgent as Record<string, unknown>) ||
      JSON.stringify(etapas) !== JSON.stringify(serverEtapas)
    : false;

  useEffect(() => {
    if (!agente) return;
    // Skip overwrite while save is in flight — onSuccess will invalidate the
    // query and this effect will re-run with fresh server data.
    if (salvarMutation.isPending) return;
    // Only sync on initial load or when the server record genuinely changed
    // (updated_at advances). This prevents background refetches (e.g. on
    // window focus) from clobbering unsaved edits with stale server data.
    if (lastSyncedAtRef.current === agente.updated_at) return;
    lastSyncedAtRef.current = agente.updated_at;
    setEditedAgent(agente);
  }, [agente, salvarMutation.isPending]);

  useEffect(() => {
    // Skip overwrite while save is in flight to avoid clobbering local edits.
    if (salvarMutation.isPending) return;
    if (!passos) return;

    const fingerprint = JSON.stringify(passos.map(p => ({ id: p.id, updated_at: p.updated_at })));
    if (lastSyncedPassosRef.current === fingerprint) return;
    lastSyncedPassosRef.current = fingerprint;

    if (passos.length > 0) {
      const mapped = passos.map(p => ({
        id: p.id,
        controle: Number(p.controle ?? p.ordem ?? 1),
        prompt: p.prompt,
        nome: p.nome,
      }));
      setEtapas(mapped);
      setServerEtapas(mapped);
    } else {
      const init = [{ id: `etapa-${Date.now()}`, controle: 1, prompt: '', nome: 'Etapa 1' }];
      setEtapas(init);
      setServerEtapas(init);
    }
  }, [passos, salvarMutation.isPending]);

  const performSync = useCallback(async (agentId: string) => {
    setIsSyncing(true);
    setLastSyncError(null);
    try {
      const { data: syncResult, error: syncError } = await supabase.functions.invoke(
        'elevenlabs-agent-sync',
        { body: { ai_agent_id: agentId } },
      );

      // Edge function returned non-2xx — supabase-js wraps the response in
      // FunctionsHttpError. The actual JSON body (with `error` + `details`)
      // lives on `error.context` and must be parsed to surface the real cause.
      if (syncError) {
        let desc = syncError.message || 'Erro desconhecido';
        if (syncError instanceof FunctionsHttpError) {
          try {
            const body = await syncError.context.json();
            const composed = composeDesc(body?.error, body?.details);
            if (composed) desc = composed;
          } catch {
            // body wasn't JSON — keep the generic supabase message
          }
        }
        setEditedAgent(prev => ({ ...prev, el_sync_status: 'error' }));
        setLastSyncError(desc);
        toast({ title: 'Sync com ElevenLabs falhou', description: desc, variant: 'destructive' });
        return false;
      }

      // 2xx path — but defensive: edge could still return { error } in body
      const remoteError = (syncResult && typeof syncResult === 'object' && 'error' in syncResult)
        ? flattenDetail((syncResult as { error?: unknown }).error)
        : '';
      if (remoteError) {
        const detail = (syncResult as { details?: unknown })?.details;
        const desc = composeDesc(remoteError, detail) || 'Erro desconhecido';
        setEditedAgent(prev => ({ ...prev, el_sync_status: 'error' }));
        setLastSyncError(desc);
        toast({
          title: 'Sync com ElevenLabs falhou',
          description: desc,
          variant: 'destructive',
        });
        return false;
      }

      setEditedAgent(prev => ({
        ...prev,
        el_sync_status: syncResult?.sync_status || 'synced',
        el_last_synced_at: new Date().toISOString(),
        elevenlabs_agent_id: syncResult?.elevenlabs_agent_id || prev.elevenlabs_agent_id,
      }));
      setLastSyncError(null);
      queryClient.invalidateQueries({ queryKey: ['ai-agent', id] });
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-agents'] });
      toast({ title: 'Sincronizado com ElevenLabs' });
      return true;
    } catch (syncErr) {
      const desc = (syncErr as Error).message || 'Erro desconhecido';
      setEditedAgent(prev => ({ ...prev, el_sync_status: 'error' }));
      setLastSyncError(desc);
      toast({ title: 'Sync com ElevenLabs falhou', description: desc, variant: 'destructive' });
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [queryClient, id, toast]);

  // Pull voice agent config from ElevenLabs and stage it locally for review.
  // Does NOT persist — user must save afterwards. Errors mirror performSync.
  const handleImport = useCallback(async () => {
    if (!agente?.id) return;
    if ((editedAgent.agent_type ?? agente.agent_type) !== 'voice') {
      toast({ title: 'Apenas agentes de voz podem ser importados', variant: 'destructive' });
      return;
    }

    setIsImporting(true);
    try {
      const { data: pullResult, error: pullError } = await supabase.functions.invoke(
        'elevenlabs-agent-pull',
        { body: { ai_agent_id: agente.id } },
      );

      if (pullError) {
        let desc = pullError.message || 'Erro desconhecido';
        if (pullError instanceof FunctionsHttpError) {
          try {
            const body = await pullError.context.json();
            const composed = composeDesc(body?.error, body?.details);
            if (composed) desc = composed;
          } catch {
            // body wasn't JSON — keep the generic supabase message
          }
        }
        toast({ title: 'Importar do ElevenLabs falhou', description: desc, variant: 'destructive' });
        return;
      }

      const remoteError = (pullResult && typeof pullResult === 'object' && 'error' in pullResult)
        ? flattenDetail((pullResult as { error?: unknown }).error)
        : '';
      if (remoteError) {
        const detail = (pullResult as { details?: unknown })?.details;
        const desc = composeDesc(remoteError, detail) || 'Erro desconhecido';
        toast({ title: 'Importar do ElevenLabs falhou', description: desc, variant: 'destructive' });
        return;
      }

      const mapped = (pullResult as { mapped?: Record<string, unknown> })?.mapped;
      if (!mapped || typeof mapped !== 'object') {
        toast({
          title: 'Resposta inesperada da ElevenLabs',
          description: 'O payload retornado não tem o campo `mapped`.',
          variant: 'destructive',
        });
        return;
      }

      // Translate DB column names → AgenteIA UI keys (only for fields that
      // diverge between the two — voice_* fields share the same name).
      const uiPatch: Partial<AgenteIA> = {
        nome: typeof mapped.name === 'string' ? mapped.name : undefined,
        identidade: typeof mapped.identity === 'string' ? mapped.identity : undefined,
        regras_gerais: typeof mapped.general_rules === 'string' ? mapped.general_rules : undefined,
        voice_first_message: typeof mapped.voice_first_message === 'string' ? mapped.voice_first_message : undefined,
        voice_language: typeof mapped.voice_language === 'string' ? mapped.voice_language : undefined,
        voice_id: typeof mapped.voice_id === 'string' ? mapped.voice_id : null,
        voice_model_id: typeof mapped.voice_model_id === 'string' ? mapped.voice_model_id : undefined,
        voice_stability: typeof mapped.voice_stability === 'number' ? mapped.voice_stability : undefined,
        voice_similarity: typeof mapped.voice_similarity === 'number' ? mapped.voice_similarity : undefined,
        voice_speed: typeof mapped.voice_speed === 'number' ? mapped.voice_speed : undefined,
        el_sync_status: 'synced',
        el_last_synced_at: typeof mapped.el_last_synced_at === 'string' ? mapped.el_last_synced_at : new Date().toISOString(),
      };

      const applyImport = () => {
        setEditedAgent(prev => ({ ...prev, ...uiPatch }));
        setLastSyncError(null);
        toast({ title: 'Configuração importada', description: 'Revise os campos e clique em Salvar para persistir.' });
      };

      toast({
        title: 'Importar do ElevenLabs?',
        description: 'Os campos locais serão sobrescritos. Você precisa salvar depois para persistir.',
        action: (
          <ToastAction altText="Aplicar importação" onClick={applyImport}>
            Aplicar
          </ToastAction>
        ),
      });
    } catch (err) {
      const desc = (err as Error).message || 'Erro desconhecido';
      toast({ title: 'Importar do ElevenLabs falhou', description: desc, variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  }, [agente, editedAgent.agent_type, toast]);

  const handleSave = useCallback(async () => {
    if (!agente) return;
    if (!editedAgent.nome?.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    try {
      await salvarMutation.mutateAsync({
        id: agente.id,
        etapas: etapas.length > 0 ? etapas : undefined,
        nome: editedAgent.nome,
        descricao: editedAgent.descricao,
        ativo: editedAgent.ativo,
        identidade: editedAgent.identidade,
        regras_gerais: editedAgent.regras_gerais,
        input_data: editedAgent.input_data,
        usa_etapas: editedAgent.usa_etapas,
        pipeline_id: editedAgent.pipeline_id,
        leads_stages_id: editedAgent.leads_stages_id,
        channel_types: editedAgent.channel_types,
        stage_ids: editedAgent.stage_ids,
        pipeline_ids: editedAgent.pipeline_ids,
        origem_lista_filters: editedAgent.origem_lista_filters,
        score_matrix_ids: editedAgent.score_matrix_ids,
        llm_provider: editedAgent.llm_provider,
        llm_model: editedAgent.llm_model,
        llm_temperature: editedAgent.llm_temperature,
        llm_max_tokens: editedAgent.llm_max_tokens,
        llm_provider_id: editedAgent.llm_provider_id,
        memory_window: editedAgent.memory_window,
        wa_phone_number_id: editedAgent.wa_phone_number_id,
        wa_channel_id: editedAgent.wa_channel_id,
        buffer_ms: editedAgent.buffer_ms,
        humanizacao: editedAgent.humanizacao,
        // Voice Agent fields
        agent_type: editedAgent.agent_type,
        voice_enabled: editedAgent.voice_enabled,
        voice_response_mode: editedAgent.voice_response_mode,
        voice_id: editedAgent.voice_id,
        voice_first_message: editedAgent.voice_first_message,
        voice_language: editedAgent.voice_language,
        voice_model_id: editedAgent.voice_model_id,
        voice_stability: editedAgent.voice_stability,
        voice_similarity: editedAgent.voice_similarity,
        voice_speed: editedAgent.voice_speed,
        el_sync_status: editedAgent.agent_type === 'voice' ? 'pending' : 'not_applicable',
      });

      // Snapshot current etapas so isDirty goes false immediately (refetch will normalize IDs)
      setServerEtapas(etapas);
      toast({ title: 'Agente salvo com sucesso' });
      // Flash "Salvo ✓" for 2.5s
      setSavedRecently(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedRecently(false), 2500);

      // Voice agent: trigger ElevenLabs sync after save. Fallback to the
      // server-side agent_type so a transient editedAgent without the field
      // (e.g. mid-load) still routes correctly.
      const effectiveAgentType = editedAgent.agent_type ?? agente.agent_type;
      if (effectiveAgentType === 'voice' && agente.id) {
        await performSync(agente.id);
      }
    } catch (e) {
      const msg = (e as Error)?.message || 'Erro desconhecido';
      toast({ title: 'Erro ao salvar', description: msg, variant: 'destructive' });
    }
  }, [agente, editedAgent, etapas, salvarMutation, performSync, toast]);

  const handleSync = useCallback(async () => {
    if (!agente?.id || (editedAgent.agent_type ?? agente.agent_type) !== 'voice') return;
    if (isDirty) {
      // Save persists pending edits + handleSave triggers performSync internally for voice agents
      await handleSave();
      return;
    }
    await performSync(agente.id);
  }, [agente, editedAgent.agent_type, isDirty, handleSave, performSync]);

  // Ctrl+S shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty && !salvarMutation.isPending) handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDirty, salvarMutation.isPending, handleSave]);

  const handleExcluir = async () => {
    if (!agente) return;
    try {
      await excluirMutation.mutateAsync(agente.id);
      toast({ title: 'Agente excluído' });
      navigate('/settings/crm/aiagents');
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const handleCopyContext = async () => {
    if (!agente) return;
    let ctx = `# ${agente.nome}\n\n`;
    if (agente.identidade) ctx += `## Identidade\n${agente.identidade}\n\n`;
    if (agente.input_data) ctx += `## Dados de Entrada\n${agente.input_data}\n\n`;
    if (etapas.length > 0) {
      ctx += `## Etapas\n`;
      etapas.forEach(e => { ctx += `\n### ${e.nome || `Etapa ${e.controle}`}\n${e.prompt}\n`; });
    }
    try {
      await navigator.clipboard.writeText(ctx);
      toast({ title: 'Copiado!' });
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="px-6 py-3 border-b border-border flex items-center gap-3">
          <Skeleton className="h-7 w-7 rounded" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex-1 p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!agente) {
    return (
      <div className="h-screen flex items-center justify-center flex-col gap-4">
        <Bot className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Agente não encontrado</p>
        <Button size="sm" variant="outline" onClick={() => navigate('/settings/crm/aiagents')}>
          Voltar
        </Button>
      </div>
    );
  }

  // ── Voice agent: layout simplificado ────────────────────────────────────────
  if ((editedAgent.agent_type ?? agente.agent_type) === 'voice') {
    const syncStatus = editedAgent.el_sync_status ?? 'not_applicable';
    const syncBadge = (() => {
      switch (syncStatus) {
        case 'synced':
          return { label: 'Sincronizado', cls: 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400', dot: 'bg-green-500' };
        case 'pending':
          return { label: 'Pendente', cls: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' };
        case 'error':
          return { label: 'Erro', cls: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400', dot: 'bg-red-500' };
        default:
          return { label: 'Não sincronizado', cls: 'bg-muted border-border text-muted-foreground', dot: 'bg-muted-foreground/40' };
      }
    })();

    return (
      <div className="h-screen flex flex-col bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card dark:bg-zinc-950 shrink-0">
          <div className="px-5 h-[45px] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/settings/crm/aiagents')}
                className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <div className="flex items-center gap-1.5 text-sm min-w-0">
                <span className="text-muted-foreground/60 shrink-0 text-xs">Agentes IA</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="font-medium text-foreground truncate text-sm">
                  {editedAgent.nome || agente.nome}
                </span>
                {isDirty && !salvarMutation.isPending && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Alterações não salvas" />
                )}
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-[10px] font-medium text-purple-700 dark:text-purple-400 shrink-0 flex items-center gap-1">
                  <Mic className="h-2.5 w-2.5" />
                  Voz
                </span>
                <span className={cn(
                  'ml-1 inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-full border text-[10px] font-medium shrink-0',
                  syncBadge.cls,
                )}>
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    syncBadge.dot,
                    syncStatus === 'pending' && 'animate-pulse',
                  )} />
                  {syncBadge.label}
                </span>
                {isSyncing && (
                  <span className="ml-1 flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                    <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                    Sincronizando...
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                onClick={handleSync}
                disabled={isSyncing}
                size="sm"
                variant="default"
                className="h-[30px] rounded-[4px] gap-1.5 text-xs px-3 bg-purple-600 hover:bg-purple-500 text-white"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
                {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExcluir(true)}
                className="h-[30px] rounded-[4px] gap-1.5 text-xs text-muted-foreground hover:text-destructive px-2"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </Button>
              <Button
                onClick={handleSave}
                disabled={salvarMutation.isPending}
                size="sm"
                variant={savedRecently && !isDirty ? 'outline' : 'default'}
                className={[
                  'h-[30px] rounded-[4px] gap-1.5 text-xs px-3 transition-all duration-200',
                  savedRecently && !isDirty && !salvarMutation.isPending
                    ? 'border-green-500/40 text-green-600 dark:text-green-400 bg-green-500/5 hover:bg-green-500/10'
                    : '',
                ].join(' ')}
              >
                {salvarMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : savedRecently && !isDirty ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {salvarMutation.isPending
                  ? 'Salvando...'
                  : savedRecently && !isDirty
                    ? 'Salvo'
                    : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>

        {/* Voice agent — sem tabs (apenas configuração) */}
        <div className="flex-1 overflow-hidden">
          <VoiceAgentConfigTab
            agente={editedAgent}
            onAgentChange={(data) => setEditedAgent(prev => ({ ...prev, ...data }))}
            onSync={handleSync}
            isSyncing={isSyncing}
            lastSyncError={lastSyncError}
            onImport={handleImport}
            isImporting={isImporting}
          />
        </div>

        <ConfirmarExclusaoModal
          open={showExcluir}
          onClose={() => setShowExcluir(false)}
          onConfirm={handleExcluir}
          title="Excluir Agente"
          description={`Tem certeza que deseja excluir "${agente.nome}"? Esta ação é irreversível.`}
          isLoading={excluirMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card dark:bg-zinc-950 shrink-0">
        <div className="px-5 h-[45px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/settings/crm/aiagents')}
              className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <div className="flex items-center gap-1.5 text-sm min-w-0">
              <span className="text-muted-foreground/60 shrink-0 text-xs">Agentes IA</span>
              <span className="text-muted-foreground/40">/</span>
              <span className="font-medium text-foreground truncate text-sm">
                {editedAgent.nome || agente.nome}
              </span>
              {isDirty && !salvarMutation.isPending && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Alterações não salvas" />
              )}
              <span className={
                agente.ativo
                  ? 'ml-1 px-1.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/25 text-[10px] font-medium text-green-700 dark:text-green-400 shrink-0'
                  : 'ml-1 px-1.5 py-0.5 rounded-full bg-muted border border-border text-[10px] font-medium text-muted-foreground shrink-0'
              }>
                {agente.ativo ? 'Ativo' : 'Inativo'}
              </span>
              {editedAgent.agent_type === 'voice' && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-[10px] font-medium text-purple-700 dark:text-purple-400 shrink-0 flex items-center gap-1">
                  <Mic className="h-2.5 w-2.5" />
                  Voz
                </span>
              )}
              {isSyncing && (
                <span className="ml-1 flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                  Sincronizando...
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyContext}
              className="h-[30px] rounded-[4px] gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </Button>
            {editedAgent.agent_type === 'voice' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing}
                className="h-[30px] rounded-[4px] gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
                {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowExcluir(true)}
              className="h-[30px] rounded-[4px] gap-1.5 text-xs text-muted-foreground hover:text-destructive px-2"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </Button>
            <Button
              onClick={handleSave}
              disabled={salvarMutation.isPending}
              size="sm"
              variant={savedRecently && !isDirty ? 'outline' : 'default'}
              className={[
                'h-[30px] rounded-[4px] gap-1.5 text-xs px-3 transition-all duration-200',
                savedRecently && !isDirty && !salvarMutation.isPending
                  ? 'border-green-500/40 text-green-600 dark:text-green-400 bg-green-500/5 hover:bg-green-500/10'
                  : '',
              ].join(' ')}
            >
              {salvarMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : savedRecently && !isDirty ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {salvarMutation.isPending
                ? 'Salvando...'
                : savedRecently && !isDirty
                  ? 'Salvo'
                  : 'Salvar'}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs + Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex items-center px-4 h-[45px] border-b border-border bg-card dark:bg-zinc-950 shrink-0">
            <TabsList className="h-full bg-transparent gap-1">
              {[
                { value: 'config' as const, label: 'Configurações' },
                { value: 'contexto' as const, label: 'Contexto' },
                ...(editedAgent.agent_type !== 'voice'
                  ? [{ value: 'prompts' as const, label: 'Prompts' }]
                  : []),
                { value: 'historico' as const, label: 'Versões' },
                { value: 'execucoes' as const, label: 'Execuções' },
                { value: 'analytics' as const, label: 'Analytics' },
              ].map(({ value, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none text-[13px] text-muted-foreground"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="config" className="mt-0 h-full">
              <ConfiguracaoTab
                agente={editedAgent as AgenteIA}
                onAgentChange={(data) => setEditedAgent(prev => ({ ...prev, ...data }))}
                onSync={handleSync}
                isSyncing={isSyncing}
                pipelines={pipelines}
                stages={stages}
                scoreMatrices={scoreMatrices}
              />
            </TabsContent>

            <TabsContent value="contexto" className="mt-0 h-full">
              <ContextoTab
                agente={editedAgent as AgenteIA}
                onAgentChange={(data) => setEditedAgent(prev => ({ ...prev, ...data }))}
              />
            </TabsContent>

            <TabsContent value="prompts" className="mt-0 h-full">
              <PromptsTab
                agente={editedAgent as AgenteIA}
                etapas={etapas}
                onAgentChange={(data) => setEditedAgent(prev => ({ ...prev, ...data }))}
                onEtapasChange={setEtapas}
                pipelines={pipelines}
                stages={stages}
              />
            </TabsContent>

            <TabsContent value="historico" className="mt-0 h-full">
              <HistoricoTab agentId={agente.id} />
            </TabsContent>

            <TabsContent value="execucoes" className="mt-0 h-full relative">
              <div className="absolute inset-0 overflow-auto px-6 py-5">
                <ExecucoesTab agentId={agente.id} />
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="mt-0 h-full relative">
              <div className="absolute inset-0 overflow-auto px-6 py-5">
                <AnalyticsTab agentId={agente.id} />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <ConfirmarExclusaoModal
        open={showExcluir}
        onClose={() => setShowExcluir(false)}
        onConfirm={handleExcluir}
        title="Excluir Agente"
        description={`Tem certeza que deseja excluir "${agente.nome}"? Esta ação é irreversível.`}
        isLoading={excluirMutation.isPending}
      />
    </div>
  );
};

const AgenteSingle = () => (
  <RestrictedRouteComponent moduleKey="crm_pro">
    <AgenteSingleContent />
  </RestrictedRouteComponent>
);

export default AgenteSingle;
