import { useState, useMemo } from 'react';
import {
  Bot, Sparkles, Plus, ArrowLeft, MessageCircle, Mic,
  Stethoscope, Megaphone, Zap, ListOrdered, Calendar,
  Target, Share2, RefreshCw, HeartHandshake, Play, AlertTriangle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCriarAgente, useAgentesTemplates } from '@/hooks/useAgentesIA';
import { useElevenLabsConfig, useElevenLabsVoices } from '@/hooks/useElevenLabsConfig';
import { usePipelines } from '@/hooks/usePipelines';
import { TemplateCard } from './TemplateCard';

type Step = 'type' | 'choice' | 'categories' | 'templates' | 'form' | 'voice-form';

const CATEGORY_META: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string; bg: string }> = {
  diagnostico:       { icon: Stethoscope,    label: 'Diagnóstico',      color: 'text-violet-500',  bg: 'bg-violet-500/10' },
  sdr_outbound:      { icon: Megaphone,      label: 'SDR Outbound',     color: 'text-orange-500',  bg: 'bg-orange-500/10' },
  triagem:           { icon: Zap,            label: 'Triagem',          color: 'text-amber-500',   bg: 'bg-amber-500/10' },
  qualificacao_bant: { icon: ListOrdered,    label: 'Qualificação BANT',color: 'text-blue-500',    bg: 'bg-blue-500/10' },
  qualificacao:      { icon: ListOrdered,    label: 'Qualificação',     color: 'text-blue-500',    bg: 'bg-blue-500/10' },
  agendamento:       { icon: Calendar,       label: 'Agendamento',      color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  closer:            { icon: Target,         label: 'Closer',           color: 'text-red-500',     bg: 'bg-red-500/10' },
  social_selling:    { icon: Share2,         label: 'Social Selling',   color: 'text-pink-500',    bg: 'bg-pink-500/10' },
  reativacao:        { icon: RefreshCw,      label: 'Reativação',       color: 'text-cyan-500',    bg: 'bg-cyan-500/10' },
  customer_success:  { icon: HeartHandshake, label: 'Customer Success', color: 'text-teal-500',    bg: 'bg-teal-500/10' },
};

interface NovoAgenteModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (agentId: string) => void;
}

export const NovoAgenteModal = ({ open, onClose, onSuccess }: NovoAgenteModalProps) => {
  const [step, setStep] = useState<Step>('type');
  const [selectedCategory, setSelectedCategory] = useState('');
  // Text agent fields
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [pipelineId, setPipelineId] = useState('');
  const [scoreValue, setScoreValue] = useState('');
  // Voice agent fields
  const [voiceNome, setVoiceNome] = useState('');
  const [voiceDescricao, setVoiceDescricao] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [voiceFirstMessage, setVoiceFirstMessage] = useState('');

  const { pipelines, isLoading: isPipelinesLoading } = usePipelines();
  const { isConfigured: elConfigured, config: elConfig } = useElevenLabsConfig();
  const { data: elVoices = [] } = useElevenLabsVoices();
  const criarAgente = useCriarAgente();
  const { data: templates } = useAgentesTemplates();

  const elAvailable = elConfigured && elConfig?.active;

  const categories = useMemo(() => {
    if (!templates) return [];
    const seen = new Set<string>();
    return templates.reduce<{ key: string; count: number }[]>((acc, t) => {
      const type = t.template_type;
      if (type && !seen.has(type) && CATEGORY_META[type]) {
        seen.add(type);
        acc.push({ key: type, count: templates.filter(x => x.template_type === type).length });
      }
      return acc;
    }, []);
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    if (!templates || !selectedCategory) return [];
    return templates.filter((t) => t.template_type === selectedCategory);
  }, [templates, selectedCategory]);

  const sortedPipelines = useMemo(() =>
    [...(pipelines || [])].sort((a, b) => {
      const nA = parseInt(a.nome.match(/^(\d+)/)?.[1] || '999');
      const nB = parseInt(b.nome.match(/^(\d+)/)?.[1] || '999');
      return nA !== nB ? nA - nB : a.nome.localeCompare(b.nome);
    }), [pipelines]);

  const resetForm = () => {
    setStep('type');
    setSelectedCategory('');
    setNome(''); setDescricao(''); setPipelineId(''); setScoreValue('');
    setVoiceNome(''); setVoiceDescricao(''); setVoiceId(''); setVoiceFirstMessage('');
  };

  const handleClose = () => { resetForm(); onClose(); };

  // Text agent submit
  const handleSubmitText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !pipelineId) return;
    try {
      const agente = await criarAgente.mutateAsync({
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        usa_etapas: true,
        pipeline_id: pipelineId,
        score_value: scoreValue ? parseFloat(scoreValue) : undefined,
        agent_type: 'text',
      });
      resetForm();
      onSuccess(agente.id);
    } catch { /* handled by hook */ }
  };

  // Voice agent submit
  const handleSubmitVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiceNome.trim() || !voiceId || !voiceFirstMessage.trim()) return;
    try {
      const agente = await criarAgente.mutateAsync({
        nome: voiceNome.trim(),
        descricao: voiceDescricao.trim() || undefined,
        usa_etapas: false,
        agent_type: 'voice',
        voice_enabled: true,
        voice_id: voiceId,
        voice_first_message: voiceFirstMessage.trim(),
      });
      resetForm();
      onSuccess(agente.id);
    } catch { /* handled by hook */ }
  };

  const handleBack = () => {
    if (step === 'choice' || step === 'voice-form') setStep('type');
    else if (step === 'categories') setStep('choice');
    else if (step === 'templates') { setStep('categories'); setSelectedCategory(''); }
    else if (step === 'form') setStep('choice');
  };

  const stepTitle: Record<Step, string> = {
    'type': 'Novo Agente de IA',
    'choice': 'Agente de Texto',
    'categories': 'Escolha a categoria',
    'templates': CATEGORY_META[selectedCategory]?.label || 'Templates',
    'form': 'Criar Agente de Texto',
    'voice-form': 'Criar Agente de Voz',
  };

  const selectedVoice = elVoices.find(v => v.voice_id === voiceId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step !== 'type' && (
              <Button type="button" variant="ghost" size="sm" className="h-[30px] w-[30px] p-0 mr-1 rounded-[4px]" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {step === 'voice-form' ? <Mic className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
            {stepTitle[step]}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 0: Tipo de agente ── */}
        {step === 'type' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
            <button
              type="button"
              onClick={() => setStep('choice')}
              className="flex flex-col items-center gap-3 p-6 rounded-[4px] border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 text-center group"
            >
              <div className="p-3 rounded-[4px] bg-blue-500/10 group-hover:bg-blue-500/15 transition-all duration-300">
                <MessageCircle className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-foreground">Texto</div>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Atende via texto nos canais de mensagem
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  WhatsApp · Instagram · Email · SMS
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => elAvailable && setStep('voice-form')}
              disabled={!elAvailable}
              className={`flex flex-col items-center gap-3 p-6 rounded-[4px] border transition-all duration-300 text-center group relative ${
                elAvailable
                  ? 'border-border bg-card hover:border-violet-500/40 hover:bg-violet-500/5'
                  : 'border-border bg-card opacity-60 cursor-not-allowed'
              }`}
            >
              <div className={`p-3 rounded-[4px] transition-all duration-300 ${elAvailable ? 'bg-violet-500/10 group-hover:bg-violet-500/15' : 'bg-card'}`}>
                <Mic className={`h-6 w-6 ${elAvailable ? 'text-violet-500' : 'text-muted-foreground/50'}`} />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-foreground">Voz</div>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Atende por voz via telefone ou áudio
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  Chamadas · ElevenLabs
                </p>
              </div>
              {!elAvailable && (
                <div className="flex items-center gap-1.5 mt-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">
                    Configure a ElevenLabs em Integrações
                  </span>
                </div>
              )}
            </button>
          </div>
        )}

        {/* ── Step: Escolha Text (template/do zero) ── */}
        {step === 'choice' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
            <button
              type="button"
              onClick={() => setStep('categories')}
              className="flex flex-col items-center gap-3 p-6 rounded-[4px] border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 text-center group"
            >
              <div className="p-3 rounded-[4px] bg-amber-500/10 group-hover:bg-amber-500/15 transition-all duration-300">
                <Sparkles className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-foreground">Usar Template</div>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Começar com um modelo pré-configurado
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStep('form')}
              className="flex flex-col items-center gap-3 p-6 rounded-[4px] border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 text-center group"
            >
              <div className="p-3 rounded-[4px] bg-primary/10 group-hover:bg-primary/15 transition-all duration-300">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-foreground">Criar do Zero</div>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Configurar um agente manualmente
                </p>
              </div>
            </button>
          </div>
        )}

        {/* ── Step: Categorias ── */}
        {step === 'categories' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2">
            {categories.map(({ key, count }) => {
              const meta = CATEGORY_META[key];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setSelectedCategory(key); setStep('templates'); }}
                  className="flex items-center gap-2.5 p-3 rounded-[4px] border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
                >
                  <div className={`p-1.5 rounded-[4px] shrink-0 ${meta.bg}`}>
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-foreground leading-tight truncate">{meta.label}</div>
                    <span className="text-[11px] text-muted-foreground">{count} modelo{count > 1 ? 's' : ''}</span>
                  </div>
                </button>
              );
            })}
            {categories.length === 0 && (
              <div className="col-span-full py-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhum template disponível ainda.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setStep('form')}>
                  Criar do zero
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Step: Templates da categoria ── */}
        {step === 'templates' && (
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onCloned={(agentId) => { resetForm(); onSuccess(agentId); }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Step: Formulário Text ── */}
        {step === 'form' && (
          <form onSubmit={handleSubmitText} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Agente *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Assistente de Vendas"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição breve do que este agente faz..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pipeline">Pipeline *</Label>
              <Select value={pipelineId} onValueChange={setPipelineId} disabled={isPipelinesLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {sortedPipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>{pipeline.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pipelines.length === 0 && !isPipelinesLoading && (
                <p className="text-sm text-muted-foreground">Nenhum pipeline encontrado. Configure um pipeline primeiro.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="score_value">Valor de Score (opcional)</Label>
              <Input
                id="score_value"
                type="number"
                step="0.01"
                value={scoreValue}
                onChange={(e) => setScoreValue(e.target.value)}
                placeholder="Ex: 8.5"
              />
              <p className="text-xs text-muted-foreground">Valor numérico para matching via n8n</p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button type="submit" disabled={!nome.trim() || !pipelineId || criarAgente.isPending}>
                {criarAgente.isPending ? 'Criando...' : 'Criar Agente'}
              </Button>
            </div>
          </form>
        )}

        {/* ── Step: Formulário Voice ── */}
        {step === 'voice-form' && (
          <form onSubmit={handleSubmitVoice} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="voice-nome">Nome do Agente *</Label>
              <Input
                id="voice-nome"
                value={voiceNome}
                onChange={(e) => setVoiceNome(e.target.value)}
                placeholder="Ex: Assistente de Vendas por Voz"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="voice-descricao">Descrição</Label>
              <Textarea
                id="voice-descricao"
                value={voiceDescricao}
                onChange={(e) => setVoiceDescricao(e.target.value)}
                placeholder="Descrição breve do que este agente de voz faz..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Voz *</Label>
              <Select value={voiceId} onValueChange={setVoiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar voz" />
                </SelectTrigger>
                <SelectContent>
                  {elVoices.map((voice) => (
                    <SelectItem key={voice.voice_id} value={voice.voice_id}>
                      <span className="flex items-center gap-2">
                        {voice.name}
                        {voice.language && (
                          <span className="text-[9px] font-medium px-1 py-0 rounded bg-muted text-muted-foreground leading-4">
                            {voice.language}
                          </span>
                        )}
                        {voice.category && (
                          <span className="text-[9px] font-medium px-1 py-0 rounded bg-primary/10 text-primary/70 leading-4">
                            {voice.category}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedVoice?.preview_url && (
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const audio = new Audio(selectedVoice.preview_url!);
                      audio.play();
                    }}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-all duration-300"
                  >
                    <Play className="h-3 w-3" />
                    Preview
                  </button>
                  <span className="text-[10px] text-muted-foreground">{selectedVoice.name}</span>
                </div>
              )}
              {elVoices.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Nenhuma voz sincronizada. Sincronize vozes em Configurações &rarr; Integrações &rarr; ElevenLabs.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="voice-first-msg">Primeira mensagem *</Label>
              <Textarea
                id="voice-first-msg"
                value={voiceFirstMessage}
                onChange={(e) => setVoiceFirstMessage(e.target.value)}
                placeholder="Olá! Meu nome é Sofia, sou assistente da..."
                rows={3}
              />
              <p className="text-[10px] text-muted-foreground">O que o agente diz ao iniciar a conversa.</p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button
                type="submit"
                disabled={!voiceNome.trim() || !voiceId || !voiceFirstMessage.trim() || criarAgente.isPending}
              >
                {criarAgente.isPending ? 'Criando...' : 'Criar Agente de Voz'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
