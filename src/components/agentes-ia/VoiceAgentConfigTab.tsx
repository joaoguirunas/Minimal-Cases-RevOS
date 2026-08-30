import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  MessageSquare,
  Mic,
  Play,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { AgenteIA } from '@/hooks/useAgentesIAReal';
import {
  useElevenLabsAgents,
  useElevenLabsConfig,
  useElevenLabsVoices,
} from '@/hooks/useElevenLabsConfig';

// ── Constants ─────────────────────────────────────────────────────────────────

const VOICE_LANGUAGES = [
  { value: 'pt', label: 'Português (BR)' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
];

const VOICE_MODELS = [
  { value: '_default', label: 'Padrão global', hint: 'usa configuração de Integrações' },
  { value: 'eleven_flash_v2_5', label: 'Flash v2.5', hint: '~75ms · mais barato' },
  { value: 'eleven_turbo_v2_5', label: 'Turbo v2.5', hint: 'baixa latência · qualidade alta' },
  { value: 'eleven_multilingual_v2', label: 'Multilingual v2', hint: '29 idiomas · estável' },
];

type SyncStatus = 'synced' | 'pending' | 'error' | 'not_applicable';

const SYNC_STATUS_MAP: Record<
  SyncStatus,
  { label: string; cls: string; dot: string; description: string }
> = {
  synced: {
    label: 'Sincronizado',
    cls: 'text-green-700 dark:text-green-400 bg-green-500/10 border-green-500/30',
    dot: 'bg-green-500',
    description: 'Configuração ativa no ElevenLabs.',
  },
  pending: {
    label: 'Pendente',
    cls: 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30',
    dot: 'bg-amber-500',
    description: 'Há mudanças aguardando envio ao ElevenLabs.',
  },
  error: {
    label: 'Erro',
    cls: 'text-red-700 dark:text-red-400 bg-red-500/10 border-red-500/30',
    dot: 'bg-red-500',
    description: 'Última tentativa de sincronização falhou.',
  },
  not_applicable: {
    label: 'Não sincronizado',
    cls: 'text-muted-foreground bg-muted border-border',
    dot: 'bg-muted-foreground/40',
    description: 'Salve o agente para sincronizar pela primeira vez.',
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

const SectionCard = ({
  icon: Icon,
  title,
  description,
  badge,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="border border-border rounded-[4px] bg-card overflow-hidden">
    <div className="px-4 py-2.5 border-b border-border bg-muted flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
      <span className="text-xs font-semibold text-foreground">{title}</span>
      {description && (
        <span className="text-[10px] text-muted-foreground/60 hidden sm:inline truncate">
          — {description}
        </span>
      )}
      {badge && <span className="ml-auto shrink-0">{badge}</span>}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const FieldLabel = ({
  children,
  hint,
  required,
}: {
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) => (
  <Label className="text-xs text-muted-foreground flex items-baseline gap-1.5">
    <span>{children}</span>
    {required && <span className="text-red-500/70 font-bold">*</span>}
    {hint && (
      <span className="text-muted-foreground/40 font-normal text-[10px] truncate">
        {hint}
      </span>
    )}
  </Label>
);

const FieldHelp = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
    {children}
  </p>
);

const SliderRow = ({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  decimals = 2,
  marks,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  marks?: { left: string; right: string };
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <span className="text-[11px] font-mono text-primary tabular-nums px-1.5 py-0.5 rounded bg-primary/10">
        {value.toFixed(decimals)}
      </span>
    </div>
    <Slider
      value={[value]}
      onValueChange={(v) => onChange(v[0] ?? value)}
      min={min}
      max={max}
      step={step}
      className="py-1"
    />
    {marks && (
      <div className="flex items-center justify-between text-[9px] text-muted-foreground/40 px-0.5">
        <span>{marks.left}</span>
        <span>{marks.right}</span>
      </div>
    )}
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────

export interface VoiceAgentConfigTabProps {
  agente: Partial<AgenteIA>;
  onAgentChange: (changes: Partial<AgenteIA>) => void;
  onSync?: () => void;
  isSyncing?: boolean;
  /** Mensagem detalhada do último erro de sync (vinda do edge function) */
  lastSyncError?: string | null;
  /** Pull config from ElevenLabs and stage it locally — does NOT save. */
  onImport?: () => void | Promise<void>;
  isImporting?: boolean;
}

export const VoiceAgentConfigTab = ({
  agente,
  onAgentChange,
  onSync,
  isSyncing,
  lastSyncError,
  onImport,
  isImporting,
}: VoiceAgentConfigTabProps) => {
  const { data: voices = [], isLoading: voicesLoading } = useElevenLabsVoices();
  const { data: elAgents = [] } = useElevenLabsAgents();
  const { isConfigured: elConfigured, config: elConfig } = useElevenLabsConfig();

  const [voiceLangFilter, setVoiceLangFilter] = useState<string>('all');
  const [voiceSearch, setVoiceSearch] = useState('');

  // agente.elevenlabs_agent_id é UUID FK → elevenlabs_agents.id
  // O ID real do EL (ex: "agent_5301kb365...") está em elevenlabs_agents.elevenlabs_agent_id
  const elStringId = useMemo(() => {
    if (!agente.elevenlabs_agent_id) return null;
    const row = elAgents.find((a) => a.id === agente.elevenlabs_agent_id);
    return row?.elevenlabs_agent_id ?? null;
  }, [elAgents, agente.elevenlabs_agent_id]);

  const voiceLanguages = useMemo(() => {
    const langs = new Set<string>();
    for (const v of voices) {
      if (v.language) langs.add(v.language);
    }
    return Array.from(langs).sort();
  }, [voices]);

  const filteredVoices = useMemo(() => {
    let result = voices;
    if (voiceLangFilter !== 'all') {
      result = result.filter((v) => {
        const lang = (v.language || '').toLowerCase();
        return lang.includes(voiceLangFilter.toLowerCase());
      });
    }
    if (voiceSearch.trim()) {
      const q = voiceSearch.toLowerCase();
      result = result.filter((v) => v.name.toLowerCase().includes(q));
    }
    return result;
  }, [voices, voiceLangFilter, voiceSearch]);

  const sortedVoices = useMemo(() => {
    const safeCategories = ['cloned', 'generated', 'professional'];
    return [...filteredVoices].sort((a, b) => {
      const aSafe = safeCategories.includes(a.category || '');
      const bSafe = safeCategories.includes(b.category || '');
      if (aSafe && !bSafe) return -1;
      if (!aSafe && bSafe) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [filteredVoices]);

  const selectedVoice = useMemo(
    () => voices.find((v) => v.voice_id === agente.voice_id),
    [voices, agente.voice_id],
  );

  const defaultGlobalVoice = useMemo(
    () => voices.find((v) => v.voice_id === elConfig?.default_voice_id),
    [voices, elConfig?.default_voice_id],
  );

  const syncStatusKey = (agente.el_sync_status as SyncStatus) || 'not_applicable';
  const syncStatus = SYNC_STATUS_MAP[syncStatusKey] ?? SYNC_STATUS_MAP.not_applicable;

  const playVoicePreview = () => {
    if (selectedVoice?.preview_url) {
      new Audio(selectedVoice.preview_url).play().catch(() => {});
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-5 overflow-y-auto h-full">
      <div className="flex gap-5 max-w-5xl mx-auto">

        {/* ── Left — main config ── */}
        <div className="flex-1 min-w-0 space-y-3.5">

          {/* ── ElevenLabs not configured banner ── */}
          {!elConfigured && (
            <div className="flex items-start gap-2.5 p-3 rounded-[4px] bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mb-0.5">
                  ElevenLabs não configurado
                </p>
                <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                  Configure a chave de API em{' '}
                  <a
                    href="/settings/integrations/elevenlabs"
                    className="font-medium underline hover:text-amber-600"
                  >
                    Integrações → ElevenLabs
                  </a>{' '}
                  antes de sincronizar este agente.
                </p>
              </div>
            </div>
          )}

          {/* ── Voice missing warning ── */}
          {elConfigured && !voicesLoading && !agente.voice_id && !defaultGlobalVoice && (
            <div className="flex items-start gap-2.5 p-3 rounded-[4px] bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mb-0.5">
                  Nenhuma voz selecionada
                </p>
                <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                  Sem voz padrão global definida, a sincronização vai falhar.
                  Selecione uma voz na seção <strong>Voz</strong> abaixo.
                </p>
              </div>
            </div>
          )}

          {/* ── Identidade ── */}
          <SectionCard
            icon={Bot}
            title="Identidade"
            description="Nome interno e estado do agente"
          >
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:items-end">
              <div className="space-y-1.5">
                <FieldLabel required>Nome do agente</FieldLabel>
                <Input
                  value={agente.nome || ''}
                  onChange={(e) => onAgentChange({ nome: e.target.value })}
                  placeholder="Ex: Sofia — SDR de voz"
                  className="h-[30px] text-sm"
                />
                <FieldHelp>Aparece no CRM e nos relatórios. Não é falado pelo agente.</FieldHelp>
              </div>
              <div className="flex items-center gap-2 sm:pb-[26px] shrink-0">
                <Switch
                  checked={agente.ativo ?? false}
                  onCheckedChange={(v) => onAgentChange({ ativo: v })}
                />
                <span className="text-xs">
                  {agente.ativo ? (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                      <CheckCircle2 className="h-3 w-3" /> Ativo
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Inativo</span>
                  )}
                </span>
              </div>
            </div>
          </SectionCard>

          {/* ── Comportamento (vira o prompt enviado ao ElevenLabs) ── */}
          <SectionCard
            icon={BookOpen}
            title="Comportamento"
            description="Persona e regras enviadas ao ElevenLabs como system prompt"
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FieldLabel required>Identidade & objetivo</FieldLabel>
                <Textarea
                  value={agente.identidade || ''}
                  onChange={(e) => onAgentChange({ identidade: e.target.value })}
                  placeholder="Ex: Você é Sofia, SDR da Acme. Tom acolhedor, objetivo é qualificar leads para reunião com o time comercial."
                  rows={4}
                  className="text-sm resize-none"
                />
                <FieldHelp>
                  Quem o agente é, com qual tom fala e qual o objetivo principal da chamada.
                </FieldHelp>
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Regras gerais</FieldLabel>
                <Textarea
                  value={agente.regras_gerais || ''}
                  onChange={(e) => onAgentChange({ regras_gerais: e.target.value })}
                  placeholder="Ex: Sempre confirme o nome do lead. Não prometa preço. Encerre com cortesia se houver objeção dura."
                  rows={4}
                  className="text-sm resize-none"
                />
                <FieldHelp>
                  Diretrizes que valem para a conversa toda. Junto com a identidade, formam o prompt enviado ao ElevenLabs.
                </FieldHelp>
              </div>
            </div>
          </SectionCard>

          {/* ── Voz ── */}
          <SectionCard
            icon={Volume2}
            title="Voz"
            description="Timbre e estilo de fala usados pelo agente"
          >
            {voicesLoading ? (
              <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Carregando vozes da ElevenLabs...
              </div>
            ) : voices.length === 0 ? (
              <div className="flex items-start gap-2.5 p-3 rounded-[4px] bg-muted border border-border">
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  Nenhuma voz sincronizada. Vá em{' '}
                  <a
                    href="/settings/integrations/elevenlabs"
                    className="font-medium underline hover:text-foreground"
                  >
                    Integrações → ElevenLabs
                  </a>{' '}
                  e clique em <strong>Sincronizar vozes</strong>.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Filters */}
                <div className="flex items-center gap-2">
                  <Select value={voiceLangFilter} onValueChange={setVoiceLangFilter}>
                    <SelectTrigger className="h-[30px] text-xs w-[140px]">
                      <Globe className="h-3 w-3 mr-1 shrink-0 opacity-60" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos idiomas</SelectItem>
                      <SelectItem value="portuguese">Português</SelectItem>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="spanish">Español</SelectItem>
                      {voiceLanguages
                        .filter(
                          (l) =>
                            !['portuguese', 'english', 'spanish'].includes(
                              l.toLowerCase(),
                            ),
                        )
                        .map((l) => (
                          <SelectItem key={l} value={l}>
                            {l}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                    <Input
                      placeholder="Buscar voz pelo nome..."
                      value={voiceSearch}
                      onChange={(e) => setVoiceSearch(e.target.value)}
                      className="h-[30px] text-xs pl-7"
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
                    {filteredVoices.length} de {voices.length}
                  </span>
                </div>

                {/* Voice select + preview */}
                <div className="space-y-1.5">
                  <FieldLabel required>Voz selecionada</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Select
                      value={agente.voice_id || '_default'}
                      onValueChange={(v) =>
                        onAgentChange({ voice_id: v === '_default' ? null : v })
                      }
                    >
                      <SelectTrigger className="h-[30px] text-sm flex-1">
                        <SelectValue placeholder="Selecione uma voz" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        <SelectItem value="_default">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Sparkles className="h-3 w-3" />
                            Voz padrão global
                            {defaultGlobalVoice && (
                              <span className="text-[10px] text-muted-foreground/60">
                                ({defaultGlobalVoice.name})
                              </span>
                            )}
                          </span>
                        </SelectItem>
                        {sortedVoices.map((v) => (
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={playVoicePreview}
                      disabled={!selectedVoice?.preview_url}
                      className="h-[30px] w-[30px] p-0 shrink-0"
                      title={selectedVoice?.preview_url ? 'Ouvir preview' : 'Sem preview disponível'}
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {selectedVoice ? (
                    <div className="flex items-start gap-2 px-2.5 py-2 rounded-[4px] bg-muted/40 border border-border/50">
                      <Mic className="h-3 w-3 text-primary/60 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-foreground font-medium leading-tight">
                          {selectedVoice.name}
                          {selectedVoice.gender && (
                            <span className="ml-1.5 text-muted-foreground/60 font-normal">
                              · {selectedVoice.gender}
                            </span>
                          )}
                        </p>
                        {selectedVoice.description && (
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-relaxed line-clamp-2">
                            {selectedVoice.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <FieldHelp>
                      Usando a voz padrão global. Selecione uma voz específica acima para sobrescrever.
                    </FieldHelp>
                  )}
                </div>
              </div>
            )}
          </SectionCard>

          {/* ── Conversação ── */}
          <SectionCard
            icon={MessageSquare}
            title="Conversação"
            description="Como a chamada começa e em qual idioma"
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FieldLabel required>Primeira mensagem</FieldLabel>
                <Textarea
                  value={agente.voice_first_message || ''}
                  onChange={(e) =>
                    onAgentChange({ voice_first_message: e.target.value })
                  }
                  placeholder="Ex: Olá! Aqui é a Sofia da Acme. Tudo bem? Estou ligando porque você se interessou pela nossa solução, posso te fazer algumas perguntas rápidas?"
                  rows={3}
                  className="text-sm resize-none"
                />
                <FieldHelp>
                  Frase exata que o agente fala ao iniciar a chamada — antes de qualquer interação do lead.
                </FieldHelp>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel>Idioma</FieldLabel>
                  <Select
                    value={agente.voice_language || 'pt'}
                    onValueChange={(v) => onAgentChange({ voice_language: v })}
                  >
                    <SelectTrigger className="h-[30px] text-sm">
                      <Globe className="h-3 w-3 mr-1 shrink-0 opacity-60" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_LANGUAGES.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Modelo TTS</FieldLabel>
                  <Select
                    value={agente.voice_model_id || '_default'}
                    onValueChange={(v) =>
                      onAgentChange({
                        voice_model_id: v === '_default' ? undefined : v,
                      })
                    }
                  >
                    <SelectTrigger className="h-[30px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          <span className="flex flex-col">
                            <span className="text-sm">{m.label}</span>
                            {m.hint && (
                              <span className="text-muted-foreground text-[10px]">
                                {m.hint}
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── Ajustes finos ── */}
          <SectionCard
            icon={Sliders}
            title="Ajustes finos da voz"
            description="Estabilidade, fidelidade e ritmo da fala"
          >
            <div className="space-y-4">
              <SliderRow
                label="Estabilidade"
                value={agente.voice_stability ?? 0.5}
                onChange={(v) => onAgentChange({ voice_stability: v })}
                min={0}
                max={1}
                step={0.05}
                marks={{ left: 'Mais variável', right: 'Mais consistente' }}
              />
              <SliderRow
                label="Similaridade"
                value={agente.voice_similarity ?? 0.75}
                onChange={(v) => onAgentChange({ voice_similarity: v })}
                min={0}
                max={1}
                step={0.05}
                marks={{ left: 'Mais livre', right: 'Mais fiel à voz' }}
              />
              <SliderRow
                label="Velocidade"
                value={agente.voice_speed ?? 1.0}
                onChange={(v) => onAgentChange({ voice_speed: v })}
                min={0.5}
                max={2}
                step={0.05}
                marks={{ left: 'Mais lento', right: 'Mais rápido' }}
              />
              <FieldHelp>
                <strong>Estabilidade alta</strong> deixa a voz mais previsível;
                <strong> baixa</strong> permite mais emoção. <strong>Velocidade</strong> 1.0 é o ritmo natural da voz.
              </FieldHelp>
            </div>
          </SectionCard>
        </div>

        {/* ── Right — sidebar ── */}
        <div className="w-52 shrink-0 space-y-3.5">

          {/* Sync card — destaque visual */}
          <div
            className={cn(
              'border rounded-[4px] overflow-hidden transition-colors',
              syncStatusKey === 'error'
                ? 'border-red-500/40 bg-red-500/5'
                : syncStatusKey === 'pending'
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : 'border-border bg-card',
            )}
          >
            <div className="px-4 py-2.5 border-b border-border/60 bg-muted flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
              <span className="text-xs font-semibold text-foreground">
                Sincronização
              </span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border text-[11px] font-medium',
                    syncStatus.cls,
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      syncStatus.dot,
                      syncStatusKey === 'pending' && 'animate-pulse',
                    )}
                  />
                  {syncStatus.label}
                </span>
                <p className="text-[10px] text-muted-foreground/70 mt-1.5 leading-relaxed">
                  {syncStatus.description}
                </p>
              </div>

              {syncStatusKey === 'error' && (
                <div className="space-y-1.5 p-2 rounded-[4px] bg-red-500/10 border border-red-500/25">
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-red-700 dark:text-red-400 leading-relaxed font-medium">
                      {lastSyncError || 'Última tentativa falhou.'}
                    </p>
                  </div>
                  {!lastSyncError && (
                    <p className="text-[10px] text-red-700/70 dark:text-red-400/70 leading-relaxed pl-[18px]">
                      Verifique nome, identidade e voz, depois tente novamente.
                    </p>
                  )}
                </div>
              )}

              {agente.el_last_synced_at && (
                <div>
                  <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest font-semibold mb-0.5">
                    Último sync
                  </p>
                  <p className="text-[11px] text-foreground leading-relaxed">
                    {new Date(agente.el_last_synced_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )}

              {/* Agent ID — dentro do mesmo card */}
              <div className="pt-2 border-t border-border/40">
                <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest font-semibold mb-1">
                  Agent ID (ElevenLabs)
                </p>
                {elStringId ? (
                  <>
                    <p className="text-[10px] font-mono text-muted-foreground break-all leading-relaxed mb-1.5">
                      {elStringId}
                    </p>
                    <a
                      href={`https://elevenlabs.io/app/conversational-ai/agents/${elStringId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      Abrir no ElevenLabs
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </>
                ) : (
                  <p className="text-[10px] text-muted-foreground/40 italic">
                    Será gerado no primeiro sync
                  </p>
                )}
              </div>

              {onSync && (
                <Button
                  variant={syncStatusKey === 'error' ? 'default' : 'outline'}
                  size="sm"
                  onClick={onSync}
                  disabled={isSyncing || !elConfigured}
                  className="w-full h-[28px] rounded-[4px] gap-1.5 text-xs"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3" />
                      Sincronizar agora
                    </>
                  )}
                </Button>
              )}

              {onImport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onImport}
                  disabled={isImporting || isSyncing || !elConfigured || !elStringId}
                  className="w-full h-[28px] rounded-[4px] gap-1.5 text-xs"
                  title={
                    !elStringId
                      ? 'Sincronize ao menos uma vez antes de importar'
                      : 'Puxa a configuração atual do ElevenLabs para revisão'
                  }
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Download className="h-3 w-3" />
                      Importar do ElevenLabs
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceAgentConfigTab;
