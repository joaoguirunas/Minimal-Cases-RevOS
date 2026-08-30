import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Play, FileText, StickyNote, Sparkles, Brain, X, Plus, Badge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateMeetingRecord, type CreateMeetingRecordData } from '@/hooks/useMeetingRecords';
import { useAuth } from '@/hooks/useAuth';

type RecordType = 'recording' | 'transcript' | 'summary' | 'ai_summary' | 'ai_analysis' | 'note';

interface AddMeetingRecordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
}

const RECORD_TYPES: { type: RecordType; label: string; description: string; icon: React.ElementType }[] = [
  { type: 'recording',   label: 'Gravação',    description: 'Link de vídeo (Loom, Google Meet, Zoom...)', icon: Play },
  { type: 'transcript',  label: 'Transcrição', description: 'Texto da transcrição da reunião', icon: FileText },
  { type: 'summary',     label: 'Resumo',      description: 'Resumo escrito manualmente', icon: StickyNote },
  { type: 'ai_summary',  label: 'Resumo IA',   description: 'Resumo gerado por inteligência artificial', icon: Sparkles },
  { type: 'ai_analysis', label: 'Análise IA',  description: 'Análise detalhada com score e sentimento', icon: Brain },
  { type: 'note',        label: 'Nota',        description: 'Anotação rápida sobre a reunião', icon: StickyNote },
];

const SOURCES = [
  { value: 'loom',        label: 'Loom' },
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'zoom',        label: 'Zoom' },
  { value: 'fireflies',   label: 'Fireflies' },
  { value: 'fathom',      label: 'Fathom' },
  { value: 'manual',      label: 'Manual' },
  { value: 'ai',          label: 'IA' },
];

const TagInput = ({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) => {
  const [input, setInput] = useState('');

  const addTag = () => {
    const tag = input.trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setInput('');
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          placeholder={placeholder}
          className="h-[30px] text-xs rounded-[4px]"
        />
        <Button type="button" variant="outline" size="sm" onClick={addTag} className="h-[30px] px-2.5 rounded-[4px] shrink-0">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[11px] font-medium bg-muted border border-border text-foreground">
              {tag}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export const AddMeetingRecordModal = ({ open, onOpenChange, meetingId }: AddMeetingRecordModalProps) => {
  const { user } = useAuth();
  const createMutation = useCreateMeetingRecord();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<RecordType | null>(null);

  // Recording fields
  const [url, setUrl] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [source, setSource] = useState('');

  // Text fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // AI Analysis fields
  const [aiScore, setAiScore] = useState(50);
  const [aiSentiment, setAiSentiment] = useState<'positivo' | 'neutro' | 'negativo' | 'misto'>('neutro');
  const [aiKeyTopics, setAiKeyTopics] = useState<string[]>([]);
  const [aiNextSteps, setAiNextSteps] = useState<string[]>([]);
  const [aiObjections, setAiObjections] = useState<string[]>([]);

  const reset = () => {
    setStep(1);
    setSelectedType(null);
    setUrl(''); setDurationMinutes(''); setThumbnailUrl(''); setSource('');
    setTitle(''); setContent('');
    setAiScore(50); setAiSentiment('neutro'); setAiKeyTopics([]); setAiNextSteps([]); setAiObjections([]);
  };

  const handleClose = () => { reset(); onOpenChange(false); };

  const handleSelectType = (type: RecordType) => {
    setSelectedType(type);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!selectedType) return;

    const data: CreateMeetingRecordData = {
      meeting_id: meetingId,
      record_type: selectedType,
      created_by: user?.profile?.id,
    };

    if (selectedType === 'recording') {
      data.url = url || undefined;
      data.duration_seconds = durationMinutes ? Number(durationMinutes) * 60 : undefined;
      data.thumbnail_url = thumbnailUrl || undefined;
      data.source = source || undefined;
    } else if (selectedType === 'ai_analysis') {
      data.ai_score = aiScore;
      data.ai_sentiment = aiSentiment;
      data.ai_key_topics = aiKeyTopics.length > 0 ? aiKeyTopics : undefined;
      data.ai_next_steps = aiNextSteps.length > 0 ? aiNextSteps : undefined;
      data.ai_objections = aiObjections.length > 0 ? aiObjections : undefined;
      data.title = title || undefined;
      data.content = content || undefined;
      data.source = source || undefined;
    } else {
      data.title = title || undefined;
      data.content = content || undefined;
      data.source = source || undefined;
    }

    await createMutation.mutateAsync(data);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg rounded-[4px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {step === 1 ? 'Adicionar Registro' : `Novo ${RECORD_TYPES.find(r => r.type === selectedType)?.label}`}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Type selection */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-2 py-2">
            {RECORD_TYPES.map(({ type, label, description, icon: Icon }) => (
              <button
                key={type}
                onClick={() => handleSelectType(type)}
                className="flex flex-col gap-1.5 p-3 rounded-[2px] border border-border bg-muted hover:bg-muted hover:border-border text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{description}</p>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Form */}
        {step === 2 && selectedType && (
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">

            {/* Recording form */}
            {selectedType === 'recording' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">URL da Gravação *</Label>
                  <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://loom.com/share/..." className="h-[30px] text-sm rounded-[4px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duração (minutos)</Label>
                  <Input type="number" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} placeholder="Ex: 45" className="h-[30px] text-sm rounded-[4px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">URL do Thumbnail</Label>
                  <Input value={thumbnailUrl} onChange={e => setThumbnailUrl(e.target.value)} placeholder="https://..." className="h-[30px] text-sm rounded-[4px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fonte</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger className="h-[30px] text-sm rounded-[4px]"><SelectValue placeholder="Selecionar fonte..." /></SelectTrigger>
                    <SelectContent className="rounded-[4px]">
                      {SOURCES.map(s => <SelectItem key={s.value} value={s.value} className="text-sm">{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Text-based forms */}
            {(selectedType === 'transcript' || selectedType === 'summary' || selectedType === 'note' || selectedType === 'ai_summary') && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Título</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título do registro..." className="h-[30px] text-sm rounded-[4px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Conteúdo *</Label>
                  <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Digite o conteúdo aqui..." className="min-h-[140px] text-sm rounded-[4px] resize-none" />
                </div>
                {(selectedType === 'transcript' || selectedType === 'ai_summary') && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fonte</Label>
                    <Select value={source} onValueChange={setSource}>
                      <SelectTrigger className="h-[30px] text-sm rounded-[4px]"><SelectValue placeholder="Selecionar fonte..." /></SelectTrigger>
                      <SelectContent className="rounded-[4px]">
                        {SOURCES.map(s => <SelectItem key={s.value} value={s.value} className="text-sm">{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {/* AI Analysis form */}
            {selectedType === 'ai_analysis' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Score da Reunião: <span className="text-foreground font-semibold">{aiScore}/100</span>
                  </Label>
                  <Slider
                    value={[aiScore]}
                    onValueChange={([v]) => setAiScore(v)}
                    min={0} max={100} step={1}
                    className="py-2"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sentimento</Label>
                  <Select value={aiSentiment} onValueChange={(v: typeof aiSentiment) => setAiSentiment(v)}>
                    <SelectTrigger className="h-[30px] text-sm rounded-[4px]"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-[4px]">
                      <SelectItem value="positivo" className="text-sm">Positivo</SelectItem>
                      <SelectItem value="neutro" className="text-sm">Neutro</SelectItem>
                      <SelectItem value="negativo" className="text-sm">Negativo</SelectItem>
                      <SelectItem value="misto" className="text-sm">Misto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tópicos principais</Label>
                  <TagInput value={aiKeyTopics} onChange={setAiKeyTopics} placeholder="Ex: Preço (Enter para adicionar)" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Próximos passos</Label>
                  <TagInput value={aiNextSteps} onChange={setAiNextSteps} placeholder="Ex: Enviar proposta (Enter para adicionar)" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Objeções identificadas</Label>
                  <TagInput value={aiObjections} onChange={setAiObjections} placeholder="Ex: Preço alto (Enter para adicionar)" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Título (opcional)</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da análise..." className="h-[30px] text-sm rounded-[4px]" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Conteúdo adicional (opcional)</Label>
                  <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Observações adicionais..." className="min-h-[80px] text-sm rounded-[4px] resize-none" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fonte</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger className="h-[30px] text-sm rounded-[4px]"><SelectValue placeholder="Selecionar fonte..." /></SelectTrigger>
                    <SelectContent className="rounded-[4px]">
                      {SOURCES.map(s => <SelectItem key={s.value} value={s.value} className="text-sm">{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          {step === 2 ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="h-[30px] px-3 text-xs rounded-[4px]">
                ← Voltar
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                className="h-[30px] px-4 text-xs rounded-[4px]"
              >
                {createMutation.isPending ? 'Salvando...' : 'Salvar registro'}
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleClose} className="h-[30px] px-3 text-xs rounded-[4px] ml-auto">
              Cancelar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
