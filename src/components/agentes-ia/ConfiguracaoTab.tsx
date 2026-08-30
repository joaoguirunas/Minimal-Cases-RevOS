import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Bot,
  GitMerge,
  Hash,
  MessageCircle,
  MessageSquare,
  Image,
  Mail,
  Smartphone,
  Radio,
  Cpu,
  Sparkles,
  Clock,
  CalendarClock,
  CalendarDays,
  Fingerprint,
  CheckCircle2,
  Layers,
  Volume2,
  Play,
  Mic,
  Phone,
  RefreshCw,
  ExternalLink,
  Globe,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIProviders, useCheckAgentConflict } from '@/hooks/useAgentesIA';
import type { AgenteIA } from '@/hooks/useAgentesIA';
import { useElevenLabsConfig, useElevenLabsVoices, useElevenLabsAgents } from '@/hooks/useElevenLabsConfig';
import { useLeadTypes } from '@/hooks/useLeadTypes';
import { CallbackConfigSection } from './CallbackConfigSection';

// ── Constants ──────────────────────────────────────────────────────────────────

const LLM_PROVIDERS = [
  { value: 'openai',    label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'groq',      label: 'Groq' },
  { value: 'gemini',    label: 'Google Gemini' },
];

const LLM_MODELS: Record<string, { value: string; label: string; badge?: string }[]> = {
  openai: [
    // GPT-5.4 family (current flagship — mar 2026)
    { value: 'gpt-5.4',      label: 'GPT-5.4',        badge: 'latest' },
    { value: 'gpt-5.4-mini', label: 'GPT-5.4 mini',   badge: 'fast' },
    { value: 'gpt-5.4-nano', label: 'GPT-5.4 nano',   badge: 'cheap' },
    { value: 'gpt-5.4-pro',  label: 'GPT-5.4 Pro',    badge: 'powerful' },
    // GPT-5 family
    { value: 'gpt-5-mini',   label: 'GPT-5 mini',     badge: 'balanced' },
    // Reasoning (active)
    { value: 'o3',            label: 'o3',              badge: 'reasoning' },
    { value: 'o3-mini',       label: 'o3 mini',         badge: 'reasoning' },
    // Legacy (deprecated feb 2026 — kept for existing agents)
    { value: 'gpt-4.1',      label: 'GPT-4.1',        badge: 'legacy' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini',   badge: 'legacy' },
    { value: 'gpt-4o-mini',  label: 'GPT-4o mini',    badge: 'legacy' },
  ],
  anthropic: [
    { value: 'claude-opus-4-6',           label: 'Claude Opus 4.6',   badge: 'powerful' },
    { value: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6', badge: 'balanced' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',  badge: 'fast' },
  ],
  groq: [
    // Llama 4
    { value: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick 17B', badge: 'new' },
    { value: 'meta-llama/llama-4-scout-17b-16e-instruct',     label: 'Llama 4 Scout 17B',    badge: 'new' },
    // Llama 3
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { value: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B',  badge: 'fast' },
    // Reasoning / outros
    { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B', badge: 'reasoning' },
    { value: 'qwen-qwq-32b',                  label: 'Qwen QwQ 32B',   badge: 'reasoning' },
    { value: 'mixtral-8x7b-32768',            label: 'Mixtral 8x7B' },
    { value: 'gemma2-9b-it',                  label: 'Gemma 2 9B' },
  ],
  gemini: [
    { value: 'gemini-2.5-pro-preview-05-06', label: 'Gemini 2.5 Pro',        badge: 'latest' },
    { value: 'gemini-2.5-flash-preview-04-17', label: 'Gemini 2.5 Flash',    badge: 'fast' },
    { value: 'gemini-2.0-flash',             label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.0-flash-lite',        label: 'Gemini 2.0 Flash Lite', badge: 'cheap' },
    { value: 'gemini-1.5-pro',               label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash',             label: 'Gemini 1.5 Flash' },
  ],
};

const CHANNEL_OPTIONS = [
  {
    value: 'whatsapp',
    label: 'WhatsApp',
    Icon: MessageCircle,
    activeClass: 'bg-green-500/10 border-green-500/35 text-green-700 dark:text-green-400',
    idleClass: 'hover:border-green-500/20 hover:text-green-600 dark:hover:text-green-500',
  },
  {
    value: 'instagram_dm',
    label: 'Instagram DM',
    Icon: MessageSquare,
    activeClass: 'bg-purple-500/10 border-purple-500/35 text-purple-700 dark:text-purple-400',
    idleClass: 'hover:border-purple-500/20 hover:text-purple-600 dark:hover:text-purple-500',
  },
  {
    value: 'instagram_post',
    label: 'Instagram Post',
    Icon: Image,
    activeClass: 'bg-pink-500/10 border-pink-500/35 text-pink-700 dark:text-pink-400',
    idleClass: 'hover:border-pink-500/20 hover:text-pink-600 dark:hover:text-pink-500',
  },
  {
    value: 'email',
    label: 'E-mail',
    Icon: Mail,
    activeClass: 'bg-blue-500/10 border-blue-500/35 text-blue-700 dark:text-blue-400',
    idleClass: 'hover:border-blue-500/20 hover:text-blue-600 dark:hover:text-blue-500',
  },
  {
    value: 'sms',
    label: 'SMS',
    Icon: Smartphone,
    activeClass: 'bg-orange-500/10 border-orange-500/35 text-orange-700 dark:text-orange-400',
    idleClass: 'hover:border-orange-500/20 hover:text-orange-600 dark:hover:text-orange-500',
  },
];

const VOICE_LANGUAGES = [
  { value: 'pt', label: 'Português (BR)' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
];

const SYNC_STATUS_MAP: Record<string, { label: string; color: string }> = {
  synced:         { label: 'Sincronizado',   color: 'text-green-600 dark:text-green-400' },
  pending:        { label: 'Pendente',       color: 'text-amber-600 dark:text-amber-400' },
  error:          { label: 'Erro',           color: 'text-red-600 dark:text-red-400' },
  not_applicable: { label: 'N/A',            color: 'text-muted-foreground' },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

const SectionCard = ({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: React.ElementType;
  title: string;
  badge?: string | number;
  children: React.ReactNode;
}) => (
  <div className="border border-border rounded-[4px] bg-card overflow-hidden">
    <div className="px-4 py-2.5 border-b border-border bg-muted flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
      <span className="text-xs font-semibold text-foreground flex-1">{title}</span>
      {badge !== undefined && badge !== 0 && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
          {badge}
        </span>
      )}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const MetaRow = ({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div className="flex items-start gap-2.5 py-2.5 border-b border-border last:border-0">
    <Icon className="h-3.5 w-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest font-semibold mb-0.5">
        {label}
      </p>
      <p className={cn(
        'text-xs text-foreground leading-relaxed break-all',
        mono && 'font-mono text-[10px] text-muted-foreground',
      )}>
        {value}
      </p>
    </div>
  </div>
);

// ── Main ───────────────────────────────────────────────────────────────────────

interface ConfiguracaoTabProps {
  agente: AgenteIA;
  onAgentChange: (data: Partial<AgenteIA>) => void;
  onSync?: () => void;
  isSyncing?: boolean;
  pipelines?: Array<{ id: string; nome: string }>;
  stages?: Array<{ id: string; nome: string; pipeline_id: string; ordem: number }>;
  scoreMatrices?: Array<{ id: string; name: string; score_number: number }>;
}

export const ConfiguracaoTab = ({
  agente,
  onAgentChange,
  onSync,
  isSyncing,
  pipelines = [],
  stages = [],
  scoreMatrices = [],
}: ConfiguracaoTabProps) => {
  const { data: aiProviders = [] } = useAIProviders();
  const { leadTypes } = useLeadTypes();
  const { isConfigured: elevenLabsConfigured, config: elevenLabsConfig } = useElevenLabsConfig();
  const { data: elevenLabsVoices = [] } = useElevenLabsVoices();
  const { data: elevenLabsAgents = [] } = useElevenLabsAgents();

  // agente.elevenlabs_agent_id é UUID FK → elevenlabs_agents.id
  // O ID real do ElevenLabs (ex: "agent_5301kb365...") está em elevenlabs_agents.elevenlabs_agent_id
  const elStringId = useMemo(() => {
    if (!agente.elevenlabs_agent_id) return null;
    const row = elevenLabsAgents.find(a => a.id === agente.elevenlabs_agent_id);
    return row?.elevenlabs_agent_id ?? null;
  }, [elevenLabsAgents, agente.elevenlabs_agent_id]);
  const [voiceLangFilter, setVoiceLangFilter] = useState<string>('all');
  const [voiceSearch, setVoiceSearch] = useState('');

  // Extract unique languages from voices for filter dropdown
  const voiceLanguages = useMemo(() => {
    const langs = new Set<string>();
    for (const v of elevenLabsVoices) {
      if (v.language) langs.add(v.language);
    }
    return Array.from(langs).sort();
  }, [elevenLabsVoices]);

  // Filtered voices based on language + search
  const filteredVoices = useMemo(() => {
    let result = elevenLabsVoices;
    if (voiceLangFilter !== 'all') {
      result = result.filter(v => {
        const lang = (v.language || '').toLowerCase();
        const filter = voiceLangFilter.toLowerCase();
        return lang.includes(filter);
      });
    }
    if (voiceSearch.trim()) {
      const q = voiceSearch.toLowerCase();
      result = result.filter(v => v.name.toLowerCase().includes(q));
    }
    return result;
  }, [elevenLabsVoices, voiceLangFilter, voiceSearch]);

  const channelTypes = agente.channel_types || [];
  const stageIds     = agente.stage_ids || [];
  const pipelineIds  = agente.pipeline_ids || (agente.pipeline_id ? [agente.pipeline_id] : []);

  const { data: conflicts = [] } = useCheckAgentConflict(
    agente.id,
    channelTypes,
    pipelineIds,
    stageIds,
  );

  const toggleChannel = (ch: string) => {
    const updated = channelTypes.includes(ch)
      ? channelTypes.filter(c => c !== ch)
      : [...channelTypes, ch];
    onAgentChange({ channel_types: updated });
  };

  const togglePipeline = (pid: string) => {
    const updated = pipelineIds.includes(pid)
      ? pipelineIds.filter(id => id !== pid)
      : [...pipelineIds, pid];
    // When removing a pipeline, also remove its stages
    const removedStages = stages.filter(s => s.pipeline_id === pid).map(s => s.id);
    const updatedStages = pipelineIds.includes(pid)
      ? stageIds.filter(id => !removedStages.includes(id))
      : stageIds;
    onAgentChange({
      pipeline_ids: updated,
      pipeline_id: updated[0],
      stage_ids: updatedStages,
      leads_stages_id: updatedStages[0],
    });
  };

  const toggleStage = (stageId: string) => {
    const updated = stageIds.includes(stageId)
      ? stageIds.filter(id => id !== stageId)
      : [...stageIds, stageId];
    const lastStage = updated.length > 0 ? updated[updated.length - 1] : undefined;
    onAgentChange({ stage_ids: updated, leads_stages_id: lastStage });
  };

  const EMPTY_SCORE_SENTINEL = '__empty__';

  const toggleMatrix = (matrixId: string) => {
    const current = agente.score_matrix_ids || [];
    const updated = current.includes(matrixId)
      ? current.filter(id => id !== matrixId)
      : [...current, matrixId];
    onAgentChange({ score_matrix_ids: updated });
  };

  const toggleEmptyScore = () => {
    const current = agente.score_matrix_ids || [];
    const updated = current.includes(EMPTY_SCORE_SENTINEL)
      ? current.filter(id => id !== EMPTY_SCORE_SENTINEL)
      : [...current, EMPTY_SCORE_SENTINEL];
    onAgentChange({ score_matrix_ids: updated });
  };

  const includesEmptyScore = (agente.score_matrix_ids || []).includes(EMPTY_SCORE_SENTINEL);

  const stagesByPipeline = (pid: string) =>
    stages.filter(s => s.pipeline_id === pid).sort((a, b) => a.ordem - b.ordem);

  const timeAgo = (dateStr?: string) => {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'hoje';
    if (days === 1) return 'ontem';
    if (days < 30) return `há ${days} dias`;
    if (days < 365) return `há ${Math.floor(days / 30)} meses`;
    return `há ${Math.floor(days / 365)} anos`;
  };

  const isVoice = agente.agent_type === 'voice';

  const activeModel = LLM_MODELS[agente.llm_provider || 'openai']?.find(
    m => m.value === agente.llm_model,
  )?.label ?? agente.llm_model ?? '—';

  const syncStatus = SYNC_STATUS_MAP[agente.el_sync_status || 'not_applicable'];

  return (
    <div className="p-5 overflow-y-auto h-full">
      <div className="flex gap-5 max-w-5xl">

        {/* ── Left — config forms ── */}
        <div className="flex-1 min-w-0 space-y-3.5">

          {/* ── Identidade ── */}
          <SectionCard icon={Bot} title="Identidade do agente">
            <div className="space-y-3">
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input
                    value={agente.nome || ''}
                    onChange={(e) => onAgentChange({ nome: e.target.value })}
                    placeholder="Ex: SDR Qualificador"
                    className="h-[30px] text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 pb-0.5 shrink-0">
                  <Switch
                    checked={agente.ativo ?? false}
                    onCheckedChange={(v) => onAgentChange({ ativo: v })}
                  />
                  <span className="text-xs text-muted-foreground">
                    {agente.ativo ? (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3" /> Ativo
                      </span>
                    ) : 'Inativo'}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                <Textarea
                  value={agente.descricao || ''}
                  onChange={(e) => onAgentChange({ descricao: e.target.value })}
                  placeholder="O que faz este agente? Em que situações ele é acionado?"
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>
            </div>
          </SectionCard>

          {/* ── Canais (text only) ── */}
          {!isVoice && (
          <SectionCard
            icon={Radio}
            title="Canais de atendimento"
            badge={channelTypes.length || undefined}
          >
            <div className="flex flex-wrap gap-2">
              {CHANNEL_OPTIONS.map(({ value, label, Icon, activeClass, idleClass }) => {
                const isActive = channelTypes.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => toggleChannel(value)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 rounded-[4px] border text-sm transition-all text-left',
                      isActive
                        ? activeClass
                        : cn('bg-muted border-border text-muted-foreground', idleClass),
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium">{label}</span>
                    {isActive && (
                      <CheckCircle2 className="h-3 w-3 ml-auto shrink-0 opacity-70" />
                    )}
                  </button>
                );
              })}
            </div>
            {channelTypes.length === 0 && (
              <p className="text-[10px] text-muted-foreground/50 mt-2">
                Selecione ao menos um canal para o agente atender.
              </p>
            )}
          </SectionCard>
          )}

          {/* ── Pipeline & Etapas (text only) ── */}
          {!isVoice && (
          <SectionCard
            icon={GitMerge}
            title="Pipelines & Etapas"
            badge={stageIds.length > 0 ? stageIds.length : (pipelineIds.length > 0 ? 'todas' : undefined)}
          >
            <div className="space-y-3">
              {/* Pipeline multi-select chips */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Pipelines vinculados
                  <span className="ml-1.5 text-muted-foreground/40 font-normal">— selecione um ou mais</span>
                </Label>
                {pipelines.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {pipelines.map((p) => {
                      const isActive = pipelineIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => togglePipeline(p.id)}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] text-xs border transition-colors',
                            isActive
                              ? 'bg-primary/10 border-primary/40 text-primary font-medium'
                              : 'bg-muted border-border text-muted-foreground hover:border-border hover:text-foreground',
                          )}
                        >
                          {isActive && <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />}
                          {p.nome}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground/40 italic">
                    Nenhum pipeline criado ainda.
                  </p>
                )}
              </div>

              {/* Stages grouped by selected pipeline */}
              {pipelineIds.length > 0 && (
                <div className="space-y-3 pt-1">
                  <Label className="text-xs text-muted-foreground">
                    Etapas de ativação
                    <span className="ml-1.5 text-muted-foreground/40 font-normal">— selecione em quais etapas o agente deve atuar</span>
                  </Label>
                  {pipelineIds.map((pid) => {
                    const pipeline = pipelines.find(p => p.id === pid);
                    const pStages = stagesByPipeline(pid);
                    return (
                      <div key={pid} className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <GitMerge className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                          <span className="text-[11px] font-medium text-muted-foreground/70">{pipeline?.nome}</span>
                        </div>
                        {pStages.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 pl-4">
                            {pStages.map((s) => {
                              const isActive = stageIds.includes(s.id);
                              return (
                                <button
                                  key={s.id}
                                  onClick={() => toggleStage(s.id)}
                                  className={cn(
                                    'flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs border transition-colors',
                                    isActive
                                      ? 'bg-primary/10 border-primary/40 text-primary font-medium'
                                      : 'bg-muted border-border text-muted-foreground hover:border-border hover:text-foreground',
                                  )}
                                >
                                  {isActive && <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />}
                                  {s.nome}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground/40 pl-4">Nenhuma etapa neste pipeline.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {pipelineIds.length === 0 && (
                <p className="text-[10px] text-muted-foreground/40 italic">
                  Selecione ao menos um pipeline para ver e escolher as etapas.
                </p>
              )}
              {pipelineIds.length > 0 && stageIds.length === 0 && (
                <p className="text-[10px] text-primary/60 italic">
                  Nenhuma etapa selecionada — agente atende leads em <strong>todas as etapas</strong> deste pipeline.
                </p>
              )}

              {/* Conflict warning */}
              {conflicts.length > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-[4px] bg-amber-500/10 border border-amber-500/25 mt-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mb-0.5">
                      Conflito de roteamento
                    </p>
                    <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                      {conflicts.map((c, i) => (
                        <span key={c.id}>
                          <span className="font-semibold">{c.nome}</span>
                          {i < conflicts.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                      {' '}já cobre a mesma combinação de canal + pipeline + etapa.
                      Dois agentes ativos com a mesma rota causam comportamento imprevisível.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
          )}

          {/* ── Origem da Lista ── */}
          {!isVoice && (
          <SectionCard
            icon={Users}
            title="Origem da lista"
            badge={(agente.origem_lista_filters?.length ?? 0) > 0 ? agente.origem_lista_filters!.length : undefined}
          >
            <div className="flex flex-wrap gap-1.5">
              {(['Todos', ...leadTypes.map((t) => t.name)] as const).map((op) => {
                const isTodos = op === 'Todos';
                const isActive = isTodos
                  ? (agente.origem_lista_filters?.length ?? 0) === 0
                  : agente.origem_lista_filters?.includes(op) ?? false;
                return (
                  <button
                    key={op}
                    onClick={() => {
                      if (isTodos) {
                        onAgentChange({ origem_lista_filters: [] });
                      } else {
                        const current = agente.origem_lista_filters ?? [];
                        const next = current.includes(op)
                          ? current.filter((v) => v !== op)
                          : [...current, op];
                        onAgentChange({ origem_lista_filters: next });
                      }
                    }}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs border transition-colors',
                      isActive
                        ? 'bg-primary/10 border-primary/40 text-primary font-medium'
                        : 'bg-muted border-border text-muted-foreground hover:border-border hover:text-foreground',
                    )}
                  >
                    {isActive && !isTodos && <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />}
                    {op}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground/40 mt-2">
              {(agente.origem_lista_filters?.length ?? 0) === 0
                ? 'Nenhuma seleção — agente atende leads de qualquer origem.'
                : 'Agente dispara apenas para leads com a origem da lista selecionada.'
              }
            </p>
          </SectionCard>
          )}

          {/* ── Score Matrices (text only) ── */}
          {!isVoice && scoreMatrices.length > 0 && (
            <SectionCard
              icon={Hash}
              title="Matrizes de score"
              badge={agente.score_matrix_ids?.length || undefined}
            >
              <div className="flex flex-wrap gap-1.5">
                {/* Chip especial: sem score */}
                <button
                  onClick={toggleEmptyScore}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs border transition-colors',
                    includesEmptyScore
                      ? 'bg-primary/10 border-primary/40 text-primary font-medium'
                      : 'bg-muted border-border text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                >
                  {includesEmptyScore && <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />}
                  Sem score
                  <span className="text-[9px] ml-0.5 opacity-50 font-normal">—</span>
                </button>

                {/* Chips das matrizes reais */}
                {scoreMatrices.map((matrix) => {
                  const isActive = agente.score_matrix_ids?.includes(matrix.id);
                  return (
                    <button
                      key={matrix.id}
                      onClick={() => toggleMatrix(matrix.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs border transition-colors',
                        isActive
                          ? 'bg-primary/10 border-primary/40 text-primary font-medium'
                          : 'bg-muted border-border text-muted-foreground hover:border-border hover:text-foreground',
                      )}
                    >
                      {isActive && <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />}
                      {matrix.name}
                      <span className="text-[9px] ml-0.5 opacity-50 font-normal">
                        #{matrix.score_number}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground/40 mt-2">
                {(agente.score_matrix_ids || []).filter(id => id !== '__empty__').length === 0 && !includesEmptyScore
                  ? 'Nenhuma seleção — agente atende todos os leads independente do score.'
                  : 'Agente dispara apenas para leads cujo score corresponda às matrizes selecionadas.'
                }{' '}
                Use <strong>Sem score</strong> para incluir leads sem score definido.
              </p>
            </SectionCard>
          )}

          {/* ── Runtime IA ── */}
          <SectionCard icon={Cpu} title="Runtime IA">
            <div className="space-y-4">

              {/* Chave de API + Provedor */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Chave de API</Label>
                  <Select
                    value={agente.llm_provider_id || '__none__'}
                    onValueChange={(v) => {
                      const prov = aiProviders.find((p) => p.id === v);
                      onAgentChange({
                        llm_provider_id: v === '__none__' ? undefined : v,
                        llm_provider: prov?.provider ?? agente.llm_provider,
                      });
                    }}
                  >
                    <SelectTrigger className="h-[30px] text-sm">
                      <SelectValue placeholder="Chave padrão" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Chave padrão</SelectItem>
                      {aiProviders.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                          {p.is_default && (
                            <span className="ml-1.5 text-[9px] text-primary">• padrão</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Provedor LLM</Label>
                  <Select
                    value={agente.llm_provider || 'openai'}
                    onValueChange={(v) => onAgentChange({ llm_provider: v, llm_model: undefined })}
                  >
                    <SelectTrigger className="h-[30px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LLM_PROVIDERS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Modelo */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Modelo</Label>
                <Select
                  value={agente.llm_model || ''}
                  onValueChange={(v) => onAgentChange({ llm_model: v })}
                >
                  <SelectTrigger className="h-[30px] text-sm">
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(LLM_MODELS[agente.llm_provider || 'openai'] || LLM_MODELS.openai).map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        <span className="flex items-center gap-2">
                          {m.label}
                          {m.badge && (
                            <span className="text-[9px] font-medium px-1 py-0 rounded bg-primary/10 text-primary/70 leading-4">
                              {m.badge}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {agente.llm_model && (
                  <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5" />
                    Usando <span className="font-medium text-primary/70">{activeModel}</span>
                  </p>
                )}
              </div>

              {/* Sliders numéricos */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Temperatura
                    <span className="ml-1 text-muted-foreground/40 font-normal text-[10px]">0–2</span>
                  </Label>
                  <Input
                    type="number" min={0} max={2} step={0.1}
                    value={agente.llm_temperature ?? 0.7}
                    onChange={(e) => onAgentChange({ llm_temperature: parseFloat(e.target.value) || 0.7 })}
                    className="h-[30px] text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Max tokens</Label>
                  <Input
                    type="number" min={256} max={32768} step={256}
                    value={agente.llm_max_tokens ?? 1024}
                    onChange={(e) => onAgentChange({ llm_max_tokens: parseInt(e.target.value) || 1024 })}
                    className="h-[30px] text-sm"
                  />
                </div>
              </div>

              {/* Memory + Buffer (text only) */}
              {!isVoice && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Janela de memória
                    <span className="ml-1 text-muted-foreground/40 font-normal text-[10px]">msgs</span>
                  </Label>
                  <Input
                    type="number" min={1} max={200}
                    value={agente.memory_window ?? 20}
                    onChange={(e) => onAgentChange({ memory_window: parseInt(e.target.value) || 20 })}
                    className="h-[30px] text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Buffer debounce
                    <span className="ml-1 text-muted-foreground/40 font-normal text-[10px]">seg</span>
                  </Label>
                  <Input
                    type="number" min={0} max={30} step={0.5}
                    value={((agente.buffer_ms ?? 3000) / 1000).toFixed(1)}
                    onChange={(e) => onAgentChange({ buffer_ms: Math.round((parseFloat(e.target.value) || 3) * 1000) })}
                    className="h-[30px] text-sm"
                  />
                </div>
              </div>
              )}

              {/* Humanização (text only) */}
              {!isVoice && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-3 w-3 opacity-50" />
                  Humanização de respostas
                </Label>
                <Select
                  value={agente.humanizacao ?? 'media'}
                  onValueChange={(v) => onAgentChange({ humanizacao: v as AgenteIA['humanizacao'] })}
                >
                  <SelectTrigger className="h-[30px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta — quebra em várias mensagens curtas</SelectItem>
                    <SelectItem value="media">Média — quebra por parágrafo</SelectItem>
                    <SelectItem value="nenhuma">Nenhuma — envia tudo em 1 mensagem</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground/50">
                  {agente.humanizacao === 'alta'
                    ? 'Cada linha vira uma mensagem separada — máximo realismo.'
                    : agente.humanizacao === 'nenhuma'
                    ? 'Resposta única, independente do tamanho.'
                    : 'Divide por parágrafo (linha dupla) — padrão.'}
                </p>
              </div>
              )}

            </div>
          </SectionCard>

          {/* ── Agendar Retorno (RETORNO-04 — text only) ── */}
          {!isVoice && (
          <SectionCard icon={CalendarClock} title="Agendar Retorno">
            <CallbackConfigSection
              agentId={agente.id}
              usaEtapas={agente.usa_etapas ?? false}
            />
          </SectionCard>
          )}

          {/* ── Resposta por Voz (text agents — simple toggle) ── */}
          {!isVoice && (
          <SectionCard icon={Volume2} title="Resposta por Voz">
            {!elevenLabsConfigured || !elevenLabsConfig?.active ? (
              <p className="text-[10px] text-muted-foreground/60">
                Configure o ElevenLabs em Integrações para ativar voz.
              </p>
            ) : elevenLabsVoices.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/60">
                Sincronize as vozes em Integrações → ElevenLabs.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={agente.voice_enabled ?? false}
                    onCheckedChange={(v) => onAgentChange({ voice_enabled: v })}
                  />
                  <span className="text-xs text-muted-foreground">
                    {agente.voice_enabled ? 'Responde por áudio' : 'Responde por texto'}
                  </span>
                </div>
                {agente.voice_enabled && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Modo de resposta por áudio</Label>
                      <Select
                        value={agente.voice_response_mode || 'mirror'}
                        onValueChange={(v) => onAgentChange({ voice_response_mode: v as 'always' | 'mirror' })}
                      >
                        <SelectTrigger className="h-[30px] text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mirror">Espelhar — áudio só quando cliente envia áudio</SelectItem>
                          <SelectItem value="always">Sempre — responder sempre por áudio</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground/60">
                        {agente.voice_response_mode === 'always'
                          ? 'O agente responderá sempre com áudio, independente do formato da mensagem do cliente.'
                          : 'O agente responderá com áudio apenas quando o cliente enviar áudio. Texto recebe texto.'}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Voz do Agente</Label>
                      {/* Language filter + search */}
                      <div className="flex items-center gap-2">
                        <Select value={voiceLangFilter} onValueChange={setVoiceLangFilter}>
                          <SelectTrigger className="h-[30px] text-xs w-[140px]">
                            <Globe className="h-3 w-3 mr-1 shrink-0" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos idiomas</SelectItem>
                            <SelectItem value="portuguese">Português</SelectItem>
                            <SelectItem value="english">English</SelectItem>
                            <SelectItem value="spanish">Español</SelectItem>
                            {voiceLanguages
                              .filter(l => !['portuguese', 'english', 'spanish'].includes(l.toLowerCase()))
                              .map(l => (
                                <SelectItem key={l} value={l}>{l}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Buscar voz..."
                          value={voiceSearch}
                          onChange={(e) => setVoiceSearch(e.target.value)}
                          className="h-[30px] text-xs flex-1"
                        />
                        <span className="text-[10px] text-muted-foreground/50 shrink-0">
                          {filteredVoices.length} vozes
                        </span>
                      </div>
                      {/* Voice selector */}
                      <div className="flex items-center gap-2">
                        <Select
                          value={agente.voice_id || '_default'}
                          onValueChange={(v) => onAgentChange({ voice_id: v === '_default' ? null : v })}
                        >
                          <SelectTrigger className="h-[30px] text-sm flex-1">
                            <SelectValue placeholder="Selecione uma voz" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <SelectItem value="_default">
                              <span className="text-muted-foreground">Voz padrão (configuração global)</span>
                            </SelectItem>
                            {filteredVoices.map((v) => (
                              <SelectItem key={v.voice_id} value={v.voice_id}>
                                <span className="flex items-center gap-1.5">
                                  {v.name}
                                  {v.language && (
                                    <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                      {v.language}
                                    </span>
                                  )}
                                  {v.gender && (
                                    <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">
                                      {v.gender}
                                    </span>
                                  )}
                                  {v.source === 'workspace' && (
                                    <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/10 text-green-600 font-medium">
                                      lib
                                    </span>
                                  )}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {(() => {
                          const selectedVoice = elevenLabsVoices.find(
                            (v) => v.voice_id === agente.voice_id,
                          );
                          return selectedVoice?.preview_url ? (
                            <button
                              onClick={() => new Audio(selectedVoice.preview_url!).play()}
                              className="text-muted-foreground/50 hover:text-primary transition-colors shrink-0"
                              title="Ouvir preview"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          ) : null;
                        })()}
                      </div>
                    </div>

                    {/* TTS Parameters */}
                    <div className="space-y-2 pt-1">
                      <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                        Parâmetros de Voz
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">
                            Estabilidade
                            <span className="ml-1 text-muted-foreground/40 font-normal text-[10px]">0–1</span>
                          </Label>
                          <Input
                            type="number" min={0} max={1} step={0.05}
                            value={agente.voice_stability ?? 0.5}
                            onChange={(e) => onAgentChange({ voice_stability: parseFloat(e.target.value) || 0.5 })}
                            className="h-[30px] text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">
                            Fidelidade
                            <span className="ml-1 text-muted-foreground/40 font-normal text-[10px]">0–1</span>
                          </Label>
                          <Input
                            type="number" min={0} max={1} step={0.05}
                            value={agente.voice_similarity ?? 0.75}
                            onChange={(e) => onAgentChange({ voice_similarity: parseFloat(e.target.value) || 0.75 })}
                            className="h-[30px] text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">
                            Velocidade
                            <span className="ml-1 text-muted-foreground/40 font-normal text-[10px]">0.5–2</span>
                          </Label>
                          <Input
                            type="number" min={0.5} max={2} step={0.1}
                            value={agente.voice_speed ?? 1.0}
                            onChange={(e) => onAgentChange({ voice_speed: parseFloat(e.target.value) || 1.0 })}
                            className="h-[30px] text-sm"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground/50">
                        Estabilidade alta = voz mais consistente. Fidelidade alta = mais fiel à voz original. Velocidade {'>'} 1 = mais rápido.
                      </p>
                    </div>

                    {/* Model override */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Modelo TTS</Label>
                      <Select
                        value={agente.voice_model_id || '_default'}
                        onValueChange={(v) => onAgentChange({ voice_model_id: v === '_default' ? null : v })}
                      >
                        <SelectTrigger className="h-[30px] text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_default">
                            <span className="text-muted-foreground">Padrão global (Flash v2.5)</span>
                          </SelectItem>
                          <SelectItem value="eleven_flash_v2_5">
                            <span>Flash v2.5 <span className="text-muted-foreground text-[10px] ml-1">~75ms, barato</span></span>
                          </SelectItem>
                          <SelectItem value="eleven_multilingual_v2">
                            <span>Multilingual v2 <span className="text-muted-foreground text-[10px] ml-1">29 idiomas</span></span>
                          </SelectItem>
                          <SelectItem value="eleven_v3">
                            <span>Eleven v3 <span className="text-muted-foreground text-[10px] ml-1">mais expressivo</span></span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
          )}

          {/* ── Configuração de Voz (voice agents only) ── */}
          {isVoice && (
          <SectionCard icon={Mic} title="Configuração de Voz">
            <div className="space-y-4">
              {/* Voice picker */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Voz</Label>
                {/* Language filter + search */}
                <div className="flex items-center gap-2">
                  <Select value={voiceLangFilter} onValueChange={setVoiceLangFilter}>
                    <SelectTrigger className="h-[30px] text-xs w-[140px]">
                      <Globe className="h-3 w-3 mr-1 shrink-0" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos idiomas</SelectItem>
                      <SelectItem value="portuguese">Português</SelectItem>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="spanish">Español</SelectItem>
                      {voiceLanguages
                        .filter(l => !['portuguese', 'english', 'spanish'].includes(l.toLowerCase()))
                        .map(l => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Buscar voz..."
                    value={voiceSearch}
                    onChange={(e) => setVoiceSearch(e.target.value)}
                    className="h-[30px] text-xs flex-1"
                  />
                  <span className="text-[10px] text-muted-foreground/50 shrink-0">
                    {filteredVoices.length} vozes
                  </span>
                </div>
                {/* Voice selector */}
                <div className="flex items-center gap-2">
                  <Select
                    value={agente.voice_id || '_default'}
                    onValueChange={(v) => onAgentChange({ voice_id: v === '_default' ? null : v })}
                  >
                    <SelectTrigger className="h-[30px] text-sm flex-1">
                      <SelectValue placeholder="Selecione uma voz" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="_default">
                        <span className="text-muted-foreground">Voz padrão (configuração global)</span>
                      </SelectItem>
                      {[...filteredVoices]
                        .sort((a, b) => {
                          const safeCategories = ['cloned', 'generated', 'professional'];
                          const aIsSafe = safeCategories.includes(a.category || '');
                          const bIsSafe = safeCategories.includes(b.category || '');
                          if (aIsSafe && !bIsSafe) return -1;
                          if (!aIsSafe && bIsSafe) return 1;
                          return (a.name || '').localeCompare(b.name || '');
                        })
                        .map((v) => (
                          <SelectItem key={v.voice_id} value={v.voice_id}>
                            <span className="flex items-center gap-1.5">
                              {v.name}
                              {v.language && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                  {v.language}
                                </span>
                              )}
                              {v.gender && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">
                                  {v.gender}
                                </span>
                              )}
                              {v.source === 'workspace' && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/10 text-green-600 font-medium">
                                  lib
                                </span>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {(() => {
                    const selectedVoice = elevenLabsVoices.find(
                      (v) => v.voice_id === agente.voice_id,
                    );
                    return selectedVoice?.preview_url ? (
                      <button
                        onClick={() => new Audio(selectedVoice.preview_url!).play()}
                        className="text-muted-foreground/50 hover:text-primary transition-colors shrink-0"
                        title="Ouvir preview"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* First message */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Primeira mensagem</Label>
                <Textarea
                  value={agente.voice_first_message || ''}
                  onChange={(e) => onAgentChange({ voice_first_message: e.target.value })}
                  placeholder="Olá! Meu nome é Sofia, como posso ajudar?"
                  rows={2}
                  className="text-sm resize-none"
                />
                <p className="text-[10px] text-muted-foreground/50">
                  O que o agente diz ao atender a chamada.
                </p>
              </div>

              {/* Language */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3 w-3 opacity-50" />
                  Idioma
                </Label>
                <Select
                  value={agente.voice_language || 'pt'}
                  onValueChange={(v) => onAgentChange({ voice_language: v })}
                >
                  <SelectTrigger className="h-[30px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* TTS Parameters */}
              <div className="space-y-2 pt-1">
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                  Parâmetros TTS
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Estabilidade
                      <span className="ml-1 text-muted-foreground/40 font-normal text-[10px]">0–1</span>
                    </Label>
                    <Input
                      type="number" min={0} max={1} step={0.05}
                      value={agente.voice_stability ?? 0.5}
                      onChange={(e) => onAgentChange({ voice_stability: parseFloat(e.target.value) || 0.5 })}
                      className="h-[30px] text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Fidelidade
                      <span className="ml-1 text-muted-foreground/40 font-normal text-[10px]">0–1</span>
                    </Label>
                    <Input
                      type="number" min={0} max={1} step={0.05}
                      value={agente.voice_similarity ?? 0.75}
                      onChange={(e) => onAgentChange({ voice_similarity: parseFloat(e.target.value) || 0.75 })}
                      className="h-[30px] text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Velocidade
                      <span className="ml-1 text-muted-foreground/40 font-normal text-[10px]">0.5–2</span>
                    </Label>
                    <Input
                      type="number" min={0.5} max={2} step={0.1}
                      value={agente.voice_speed ?? 1.0}
                      onChange={(e) => onAgentChange({ voice_speed: parseFloat(e.target.value) || 1.0 })}
                      className="h-[30px] text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Model override */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Modelo TTS</Label>
                <Select
                  value={agente.voice_model_id || '_default'}
                  onValueChange={(v) => onAgentChange({ voice_model_id: v === '_default' ? null : v })}
                >
                  <SelectTrigger className="h-[30px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_default">
                      <span className="text-muted-foreground">Padrão global (Flash v2.5)</span>
                    </SelectItem>
                    <SelectItem value="eleven_flash_v2_5">
                      <span>Flash v2.5 <span className="text-muted-foreground text-[10px] ml-1">~75ms, barato</span></span>
                    </SelectItem>
                    <SelectItem value="eleven_multilingual_v2">
                      <span>Multilingual v2 <span className="text-muted-foreground text-[10px] ml-1">29 idiomas</span></span>
                    </SelectItem>
                    <SelectItem value="eleven_v3">
                      <span>Eleven v3 <span className="text-muted-foreground text-[10px] ml-1">mais expressivo</span></span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SectionCard>
          )}

          {/* ── Telefone (voice agents only, read-only) ── */}
          {isVoice && agente.elevenlabs_agent_id && (
          <SectionCard icon={Phone} title="Telefone">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground/70 flex items-center gap-1.5">
                <Phone className="h-3 w-3" />
                Gerenciado na ElevenLabs. Sincronizado automaticamente.
              </p>
            </div>
          </SectionCard>
          )}

          {/* ── Sincronização (voice agents only) ── */}
          {isVoice && (
          <SectionCard icon={RefreshCw} title="Sincronização ElevenLabs">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={cn('text-xs font-medium', syncStatus.color)}>
                  {syncStatus.label}
                </span>
                {agente.el_last_synced_at && (
                  <span className="text-[10px] text-muted-foreground/50">
                    Último sync: {new Date(agente.el_last_synced_at).toLocaleString('pt-BR')}
                  </span>
                )}
              </div>
              {elStringId && (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground/50">
                    ElevenLabs Agent ID: <span className="font-mono">{elStringId}</span>
                  </p>
                  <a
                    href={`https://elevenlabs.io/app/conversational-ai/${elStringId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    Abrir no ElevenLabs <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              )}
              {onSync && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSync}
                  disabled={isSyncing}
                  className="h-[28px] rounded-[4px] gap-1.5 text-xs px-3"
                >
                  <RefreshCw className={cn('h-3 w-3', isSyncing && 'animate-spin')} />
                  {isSyncing ? 'Sincronizando...' : 'Sincronizar agora'}
                </Button>
              )}
              {agente.el_sync_status === 'error' && (
                <div className="flex items-start gap-2 p-2 rounded-[4px] bg-red-500/10 border border-red-500/25">
                  <AlertTriangle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-600 dark:text-red-400">
                    Último sync falhou. Salve novamente para tentar sincronizar.
                  </p>
                </div>
              )}
            </div>
          </SectionCard>
          )}

        </div>

        {/* ── Right — metadata ── */}
        <div className="w-52 shrink-0 space-y-3.5 pt-0">

          {/* Status card */}
          <div className="border border-border rounded-[4px] bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-muted">
              <span className="text-xs font-semibold text-foreground">Resumo</span>
            </div>
            <div className="divide-y divide-border/20 px-4">
              <MetaRow
                icon={Sparkles}
                label="Versão"
                value={`v${agente.versao_atual ?? 1}`}
              />
              <MetaRow
                icon={isVoice ? Mic : Radio}
                label="Tipo"
                value={isVoice ? 'Voz' : 'Texto'}
              />
              {!isVoice && (
              <MetaRow
                icon={Radio}
                label="Canais ativos"
                value={
                  channelTypes.length > 0
                    ? CHANNEL_OPTIONS
                        .filter(c => channelTypes.includes(c.value))
                        .map(c => c.label)
                        .join(', ')
                    : 'Nenhum'
                }
              />
              )}
              {!isVoice && (
              <MetaRow
                icon={GitMerge}
                label="Pipelines"
                value={
                  pipelineIds.length > 0
                    ? pipelines.filter(p => pipelineIds.includes(p.id)).map(p => p.nome).join(', ')
                    : 'Nenhum'
                }
              />
              )}
              {!isVoice && (
              <MetaRow
                icon={GitMerge}
                label="Etapas ativas"
                value={stageIds.length > 0 ? `${stageIds.length} selecionada${stageIds.length > 1 ? 's' : ''}` : (pipelineIds.length > 0 ? 'Todas as etapas' : 'Nenhuma')}
              />
              )}
              {isVoice && (
              <MetaRow
                icon={Volume2}
                label="Voz"
                value={elevenLabsVoices.find(v => v.voice_id === agente.voice_id)?.name || 'Padrão'}
              />
              )}
              {isVoice && (
              <MetaRow
                icon={RefreshCw}
                label="Sync"
                value={syncStatus.label}
              />
              )}
              <MetaRow
                icon={Cpu}
                label="Modelo IA"
                value={activeModel}
              />
            </div>
          </div>

          {/* Timestamps */}
          <div className="border border-border rounded-[4px] bg-card overflow-hidden">
            <div className="divide-y divide-border/20 px-4">
              <MetaRow
                icon={CalendarDays}
                label="Criado"
                value={
                  agente.created_at
                    ? new Date(agente.created_at).toLocaleDateString('pt-BR')
                    : '—'
                }
              />
              <MetaRow
                icon={Clock}
                label="Atualizado"
                value={timeAgo(agente.updated_at)}
              />
              <MetaRow
                icon={Fingerprint}
                label="ID"
                value={agente.id}
                mono
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
