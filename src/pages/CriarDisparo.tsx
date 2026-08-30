import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, ChevronRight, Send, Calendar, Clock, Eye,
  AlertCircle, MessageCircle, Mail, Smartphone, Phone, Check,
  Filter, Upload, Bot,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import FiltroContatosVisual from '@/components/disparos/FiltroContatosVisual';
import LiveCounterSidebar from '@/components/disparos/LiveCounterSidebar';
import { WhatsappTemplatePreview } from '@/components/config/WhatsappTemplatePreview';
import { WhatsappTemplateModal } from '@/components/config/WhatsappTemplateModal';
import { useCriarSend } from '@/hooks/useSendMutations';
import { useWhatsappChannels } from '@/hooks/useWhatsappChannels';
import { useWhatsappTemplates } from '@/hooks/useWhatsappTemplates';
import { useFilterLeads } from '@/hooks/useFilterLeads';
import { usePipelines } from '@/hooks/usePipelines';
import { useImportarLista, type StagedImportData } from '@/hooks/useImportarLista';
import { useAiAgents } from '@/hooks/useAiAgents';
import { SendChannelUi, SEND_CHANNELS, SendFilters, FilterResult } from '@/types/sends';
import { useUserPermissions } from '@/hooks/useUserPermissions';

const ImportListaTab = React.lazy(() => import('@/components/disparos/ImportListaTab'));

const CHANNEL_ICONS: Record<SendChannelUi, React.ElementType> = {
  whatsapp: MessageCircle,
  email:    Mail,
  sms:      Smartphone,
  phone:    Phone,
  voice_ai: Bot,
};

// ─── Cadência intervals ───────────────────────────────────────────────────────
const CADENCE_OPTIONS = [
  { value: 5,    label: '5s' },
  { value: 10,   label: '10s' },
  { value: 30,   label: '30s' },
  { value: 60,   label: '1 min' },
  { value: 300,  label: '5 min' },
  { value: 600,  label: '10 min' },
  { value: 1800, label: '30 min' },
  { value: 3600, label: '1 h' },
];

const DEBOUNCE_MS = 600;

export default function CriarDisparo() {
  const navigate = useNavigate();

  // ── Campaign base state ───────────────────────────────────────────────────
  const [nome, setNome] = React.useState('');
  const [channel, setChannel] = React.useState<SendChannelUi>('whatsapp');
  const [voiceAgentId, setVoiceAgentId] = React.useState<string | null>(null);

  // ── Mode toggle ───────────────────────────────────────────────────────────
  const [importMode, setImportMode] = React.useState<'filtered' | 'imported'>('filtered');
  const [stagedImport, setStagedImport] = React.useState<StagedImportData | null>(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filters, setFilters] = React.useState<SendFilters>({});
  const [filterResult, setFilterResult] = React.useState<FilterResult | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Config ────────────────────────────────────────────────────────────────
  const [intervalSeconds, setIntervalSeconds] = React.useState(60);
  const [templateId, setTemplateId] = React.useState<string | null>(null);
  const [messageContent, setMessageContent] = React.useState('');
  const [agendar, setAgendar] = React.useState(false);
  const [scheduledDate, setScheduledDate] = React.useState('');
  const [scheduledTime, setScheduledTime] = React.useState('');
  const [movePipeline, setMovePipeline] = React.useState(false);
  const [destPipelineId, setDestPipelineId] = React.useState<string | null>(null);
  const [destStageId, setDestStageId] = React.useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = React.useState(false);

  // ── Data hooks ────────────────────────────────────────────────────────────
  const { data: waChannels } = useWhatsappChannels();
  const { data: templates } = useWhatsappTemplates();
  const { data: voiceAgents, isLoading: loadingVoiceAgents } = useAiAgents();
  const { pipelines, stages } = usePipelines();
  const { mutate: filterLeadsMutate, isPending: isSearching } = useFilterLeads();
  const { mutate: criarSend, isPending: isCreating } = useCriarSend();
  const { mutate: importarLista, isPending: isImporting } = useImportarLista();
  const { isUser } = useUserPermissions();

  const isVoice = channel === 'voice_ai';

  const [waChannelId, setWaChannelId] = React.useState<string | null>(null);

  // Auto-select default channel on load
  React.useEffect(() => {
    if (!waChannelId && waChannels?.length) {
      const def = waChannels.find(c => c.is_default) ?? waChannels[0];
      setWaChannelId(def.id);
    }
  }, [waChannels, waChannelId]);

  const activeTemplates = templates?.filter(t => t.system_enabled === true) ?? [];
  const selectedTemplate = activeTemplates.find(t => t.id === templateId) ?? null;
  const destStages = stages.filter(s => s.pipeline_id === destPipelineId).sort((a, b) => a.order_index - b.order_index);

  // ── Auto-search on filter change (debounced) ──────────────────────────────
  const doSearch = React.useCallback(
    (f: SendFilters) => {
      if (!f.pipeline_id) return;
      filterLeadsMutate(f, {
        onSuccess: (data) => setFilterResult(data),
      });
    },
    [filterLeadsMutate]
  );

  const handleFilterChange = (newFilters: Partial<SendFilters>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (updated.pipeline_id) {
      debounceRef.current = setTimeout(() => doSearch(updated), DEBOUNCE_MS);
    } else {
      setFilterResult(null);
    }
  };

  React.useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // ── Import complete handler ────────────────────────────────────────────────
  const handleImportComplete = (data: StagedImportData) => {
    setStagedImport(data);
  };

  const handleTipoSelected = React.useCallback((_tipo: string, templateId: string | null) => {
    if (channel !== 'whatsapp') return;
    if (templateId) setTemplateId(templateId);
  }, [channel]);

  // ── Validation & create ────────────────────────────────────────────────────
  const validate = () => {
    if (!nome.trim()) { toast.error('Informe o nome do disparo'); return false; }
    if (importMode === 'filtered') {
      if (!filterResult || filterResult.total === 0) { toast.error('Selecione um pipeline e aguarde os contatos carregarem'); return false; }
    } else {
      if (!stagedImport || stagedImport.total === 0) { toast.error('Importe uma lista de contatos primeiro'); return false; }
    }
    if (channel === 'whatsapp' && !isUser && !waChannelId) { toast.error('Selecione um número WhatsApp para o disparo'); return false; }
    if (channel === 'whatsapp' && !templateId) { toast.error('Selecione um template WhatsApp'); return false; }
    if (isVoice && !voiceAgentId) { toast.error('Selecione um voice agent para o disparo'); return false; }
    if (channel !== 'whatsapp' && !isVoice && !messageContent.trim()) { toast.error('Escreva a mensagem para o disparo'); return false; }
    if (agendar && (!scheduledDate || !scheduledTime)) { toast.error('Informe data e hora para agendamento'); return false; }
    return true;
  };

  const handleCreate = () => {
    if (!validate()) return;

    const dbChannel = isVoice ? 'phone' : channel;

    // For isUser the selector is hidden; fall back to default/first channel if effect hasn't fired yet
    const effectiveWaChannelId = channel === 'whatsapp'
      ? (waChannelId ?? waChannels?.find(c => c.is_default)?.id ?? waChannels?.[0]?.id ?? null)
      : null;

    const isImported = importMode === 'imported';

    if (isImported && stagedImport) {
      // Step 1: create the send record (no contacts yet — they'll be inserted by the import)
      const sendData: Parameters<typeof criarSend>[0] = {
        name:                  nome.trim(),
        type:                  'imported',
        channel:               dbChannel,
        wa_channel_id:         effectiveWaChannelId,
        webhook_id:            null,
        send_interval_seconds: intervalSeconds,
        status:                agendar ? 'scheduled' : 'draft',
        pipeline_id:           null,
        stage_ids:             null,
        filter_config:         isVoice ? { voice_agent_id: voiceAgentId } : null,
        total_contacts:        stagedImport.total,
        contacts:              [],
      };
      if (channel === 'whatsapp') sendData.template_id = templateId;
      else if (isVoice) sendData.template_id = null;
      else sendData.message_content = messageContent.trim();
      if (agendar && scheduledDate && scheduledTime) {
        sendData.scheduled_at = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      }

      criarSend(sendData, {
        onSuccess: (send) => {
          // Step 2: import contacts/people/leads now that send_id exists
          const { total, ...importPayload } = stagedImport;
          importarLista({ ...importPayload, send_id: send.id }, {
            onSuccess: () => navigate('/send'),
          });
        },
      });
      return;
    }

    // Filtered mode
    const contacts = filterResult!.contacts.map(c => ({
      people_id: c.people_id,
      whatsapp: channel === 'email' ? (c.email ?? '') : (c.whatsapp ?? c.telefone ?? ''),
    }));

    const sendData: Parameters<typeof criarSend>[0] = {
      name:                  nome.trim(),
      type:                  'filtered',
      channel:               dbChannel,
      wa_channel_id:         channel === 'whatsapp' ? effectiveWaChannelId : null,
      webhook_id:            null,
      send_interval_seconds: intervalSeconds,
      status:                agendar ? 'scheduled' : 'draft',
      pipeline_id:           movePipeline ? destPipelineId : null,
      stage_ids:             movePipeline && destStageId ? [destStageId] : null,
      filter_config:         {
        ...(filters as unknown as Record<string, unknown>),
        ...(isVoice ? { voice_agent_id: voiceAgentId } : {}),
      },
      total_contacts:        filterResult!.total,
      contacts,
    };

    if (channel === 'whatsapp') sendData.template_id = templateId;
    else if (isVoice) sendData.template_id = null;
    else sendData.message_content = messageContent.trim();
    if (agendar && scheduledDate && scheduledTime) {
      sendData.scheduled_at = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
    }

    criarSend(sendData, {
      onSuccess: () => navigate('/send'),
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-background">

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-[1400px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between gap-4">

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/send')}
                className="h-[30px] rounded-[4px] text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Disparos
              </Button>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
              <span className="text-sm font-medium text-foreground">Novo Disparo</span>
            </div>

            <Input
              placeholder="Nome da campanha (ex: Black Friday 2024)"
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="max-w-sm h-[30px] text-sm"
            />

            <Button
              onClick={handleCreate}
              disabled={isCreating || isImporting}
              size="sm"
              className="h-[30px] rounded-[4px] text-xs gap-2 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              {isImporting ? 'Importando...' : isCreating ? 'Criando...' : 'Criar Campanha'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-6 py-6 flex gap-6">

        {/* ── Left: Canal + Filtros ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ── Canal ── */}
          <Card className="p-5 border border-border bg-card rounded-[2px]">
            <p className="text-sm font-semibold text-foreground mb-4">Canal de envio</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SEND_CHANNELS.map(ch => {
                const Icon = CHANNEL_ICONS[ch.id];
                const selected = channel === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setChannel(ch.id);
                      setTemplateId(null);
                      setMessageContent('');
                    }}
                    className={cn(
                      'relative flex flex-col items-start gap-2 p-4 rounded-[4px] border text-left transition-all duration-150 cursor-pointer',
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-primary/40 hover:bg-white/[0.035]'
                    )}
                  >
                    {selected && (
                      <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-primary-foreground" />
                      </span>
                    )}
                    <div className={cn(
                      'w-8 h-8 rounded-[4px] flex items-center justify-center transition-colors',
                      selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium leading-none',
                        selected ? 'text-foreground' : 'text-foreground/80'
                      )}>
                        {ch.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                        {ch.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* ── Mode toggle ── */}
          <Card className="p-4 border border-border bg-card rounded-[2px]">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setImportMode('filtered')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[4px] border text-sm font-medium transition-all cursor-pointer',
                  importMode === 'filtered'
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40',
                )}
              >
                <Filter className="w-3.5 h-3.5" />
                Filtrar CRM
              </button>
              <button
                type="button"
                onClick={() => setImportMode('imported')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[4px] border text-sm font-medium transition-all cursor-pointer',
                  importMode === 'imported'
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40',
                )}
              >
                <Upload className="w-3.5 h-3.5" />
                Importar Lista
              </button>
            </div>
          </Card>

          {/* ── Filtros / Import ── */}
          <Card className="p-5 border border-border bg-card rounded-[2px]">
            <p className="text-sm font-semibold text-foreground mb-4">Selecionar contatos</p>
            {importMode === 'filtered'
              ? <FiltroContatosVisual filters={filters} onFilterChange={handleFilterChange} />
              : (
                <React.Suspense fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  </div>
                }>
                  <ImportListaTab
                    channel={channel}
                    onImportComplete={handleImportComplete}
                    onTipoSelected={handleTipoSelected}
                  />
                </React.Suspense>
              )
            }
          </Card>
        </div>

        {/* ── Right: Contador + Configuração ──────────────────────────────── */}
        <div className="w-80 lg:w-[360px] shrink-0 space-y-4">

          {/* Contador live */}
          <LiveCounterSidebar
            count={importMode === 'imported' ? (stagedImport?.total ?? 0) : (filterResult?.total ?? 0)}
            contacts={importMode === 'imported' ? [] : (filterResult?.contacts ?? [])}
            isLoading={importMode === 'filtered' && isSearching}
            onRefresh={() => { if (importMode === 'filtered') doSearch(filters); }}
          />

          {/* ── Configuração ── */}
          <Card className="border border-border bg-card rounded-[2px] overflow-hidden">

            {/* WhatsApp channel selector — hidden for user type (default auto-selected) */}
            {channel === 'whatsapp' && !isUser && (
              <div className="p-4 border-b border-border">
                <p className="text-xs font-semibold text-foreground mb-2">Número de envio</p>
                {!waChannels?.length ? (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-600" />
                    <p className="text-xs text-yellow-700">
                      Nenhum número WhatsApp configurado.{' '}
                      <button
                        type="button"
                        onClick={() => navigate('/settings/general/integracoes')}
                        className="underline underline-offset-2"
                      >
                        Configurar
                      </button>
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {waChannels.map(ch => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setWaChannelId(ch.id)}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-[4px] border text-left text-xs transition-all cursor-pointer',
                          waChannelId === ch.id
                            ? 'border-primary bg-primary/5 text-foreground'
                            : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-white/[0.035]'
                        )}
                      >
                        <div className={cn(
                          'w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center',
                          waChannelId === ch.id ? 'border-primary' : 'border-muted-foreground/30'
                        )}>
                          {waChannelId === ch.id && (
                            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium leading-none truncate">{ch.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {ch.phone_number_id}
                          </p>
                        </div>
                        {ch.is_default && (
                          <span className="text-[10px] text-primary font-medium shrink-0">padrão</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="p-5 space-y-5">

              {/* ── Cadência ── */}
              <div>
                <p className="text-sm font-semibold text-foreground mb-3">Cadência entre envios</p>
                <div className="flex flex-wrap gap-1.5">
                  {CADENCE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setIntervalSeconds(opt.value)}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs border transition-all cursor-pointer',
                        intervalSeconds === opt.value
                          ? 'bg-primary text-primary-foreground border-primary font-medium'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* ── Template / Mensagem / Voice Agent ── */}
              {channel === 'whatsapp' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Template WhatsApp</p>
                    {selectedTemplate && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-[30px] rounded-[4px] px-2 text-xs text-muted-foreground"
                        onClick={() => setShowTemplateModal(true)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Preview
                      </Button>
                    )}
                  </div>
                  <Select value={templateId ?? ''} onValueChange={v => setTemplateId(v || null)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Selecionar template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeTemplates.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplate?.json_data?.components && (
                    <WhatsappTemplatePreview components={selectedTemplate.json_data.components} />
                  )}
                </div>
              ) : isVoice ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Voice Agent</p>
                  <p className="text-[11px] text-muted-foreground">
                    Agente de IA que conduzirá as chamadas via ElevenLabs.
                  </p>
                  <Select
                    value={voiceAgentId ?? ''}
                    onValueChange={v => setVoiceAgentId(v || null)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder={loadingVoiceAgents ? 'Carregando agentes...' : 'Selecionar voice agent'} />
                    </SelectTrigger>
                    <SelectContent>
                      {voiceAgents?.map(agent => (
                        <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {voiceAgents && voiceAgents.length === 0 && !loadingVoiceAgents && (
                    <p className="text-[11px] text-amber-500">
                      Nenhum voice agent ativo. Configure um em Agentes IA.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Mensagem</p>
                    <span className="text-xs text-muted-foreground">{messageContent.length} chars</span>
                  </div>
                  <Textarea
                    placeholder={
                      channel === 'email'
                        ? 'Escreva o corpo do e-mail...'
                        : channel === 'sms'
                        ? 'Escreva a mensagem SMS...'
                        : 'Escreva o script para ligação...'
                    }
                    value={messageContent}
                    onChange={e => setMessageContent(e.target.value)}
                    rows={4}
                    className="text-sm resize-none"
                  />
                </div>
              )}

              <Separator />

              {/* ── Agendamento ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="agendar" className="text-sm font-semibold text-foreground cursor-pointer">
                    Agendar disparo
                  </Label>
                  <Switch id="agendar" checked={agendar} onCheckedChange={setAgendar} />
                </div>
                {agendar && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        type="date"
                        value={scheduledDate}
                        onChange={e => setScheduledDate(e.target.value)}
                        className="pl-8 text-sm h-[30px]"
                      />
                    </div>
                    <div className="relative">
                      <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        type="time"
                        value={scheduledTime}
                        onChange={e => setScheduledTime(e.target.value)}
                        className="pl-8 text-sm h-[30px]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Mover leads (apenas modo filtered) ── */}
              {importMode === 'filtered' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="movePipeline" className="text-sm font-semibold text-foreground cursor-pointer">
                      Mover leads após envio
                    </Label>
                    <Switch id="movePipeline" checked={movePipeline} onCheckedChange={setMovePipeline} />
                  </div>
                  {movePipeline && (
                    <div className="space-y-2">
                      <Select
                        value={destPipelineId ?? ''}
                        onValueChange={v => { setDestPipelineId(v || null); setDestStageId(null); }}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Pipeline de destino" />
                        </SelectTrigger>
                        <SelectContent>
                          {pipelines.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {destPipelineId && (
                        <Select value={destStageId ?? ''} onValueChange={v => setDestStageId(v || null)}>
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Etapa de destino" />
                          </SelectTrigger>
                          <SelectContent>
                            {destStages.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          </Card>
        </div>
      </div>

      {/* Template modal */}
      {selectedTemplate && (
        <WhatsappTemplateModal
          template={selectedTemplate}
          open={showTemplateModal}
          onOpenChange={setShowTemplateModal}
        />
      )}
    </div>
  );
}
