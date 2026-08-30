import { useState } from 'react';
import {
  Trash2, ExternalLink, Play, FileText, Brain, StickyNote, Sparkles, Clock,
  ChevronDown, ChevronUp, Pencil, Check, X, Plus, AlignLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { MeetingRecord } from '@/hooks/useMeetingRecords';
import { useDeleteMeetingRecord, useUpdateMeetingRecord } from '@/hooks/useMeetingRecords';
import { ConfirmarExclusaoModal } from '@/components/modals/ConfirmarExclusaoModal';
import { MeetingTranscriptViewer } from '@/components/reunioes/MeetingTranscriptViewer';

interface MeetingRecordCardProps {
  record: MeetingRecord;
}

const RECORD_TYPE_CONFIG = {
  recording:    { label: 'Gravação',     icon: Play,       color: 'text-rose-500    bg-rose-500/10    border-rose-500/20' },
  transcript:   { label: 'Transcrição',  icon: FileText,   color: 'text-blue-500    bg-blue-500/10    border-blue-500/20' },
  summary:      { label: 'Resumo',       icon: StickyNote, color: 'text-amber-500   bg-amber-500/10   border-amber-500/20' },
  ai_summary:   { label: 'Resumo IA',    icon: Sparkles,   color: 'text-violet-500  bg-violet-500/10  border-violet-500/20' },
  ai_analysis:  { label: 'Análise IA',   icon: Brain,      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  note:         { label: 'Nota',         icon: StickyNote, color: 'text-sky-500     bg-sky-500/10     border-sky-500/20' },
} as const;

const SOURCE_LABELS: Record<string, string> = {
  loom: 'Loom', google_meet: 'Google Meet', zoom: 'Zoom',
  fireflies: 'Fireflies', fathom: 'Fathom', manual: 'Manual', ai: 'IA',
};

const SOURCES = [
  { value: 'loom', label: 'Loom' }, { value: 'google_meet', label: 'Google Meet' },
  { value: 'zoom', label: 'Zoom' }, { value: 'fireflies', label: 'Fireflies' },
  { value: 'fathom', label: 'Fathom' }, { value: 'manual', label: 'Manual' },
  { value: 'ai', label: 'IA' },
];

const SENTIMENT_CONFIG = {
  positivo: { label: 'Positivo', cls: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  neutro:   { label: 'Neutro',   cls: 'text-sky-600     bg-sky-500/10     border-sky-500/20' },
  negativo: { label: 'Negativo', cls: 'text-rose-600    bg-rose-500/10    border-rose-500/20' },
  misto:    { label: 'Misto',    cls: 'text-amber-600   bg-amber-500/10   border-amber-500/20' },
} as const;

const formatDuration = (seconds?: number) => {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}min${s > 0 ? ` ${s}s` : ''}` : `${s}s`;
};

const formatDate = (iso?: string) => {
  if (!iso) return null;
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const isLoomUrl = (url?: string) => !!url && url.includes('loom.com');

const ScoreGauge = ({ score }: { score: number }) => {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 10) * circ;
  const color = score >= 7 ? '#10b981' : score >= 4 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-border/30" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 32 32)" />
        <text x="32" y="36" textAnchor="middle" fill={color} fontSize="14" fontWeight="bold">{score}</text>
      </svg>
      <span className="text-xs text-muted-foreground">/ 10</span>
    </div>
  );
};

const TagInput = ({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) => {
  const [input, setInput] = useState('');
  const add = () => {
    const t = input.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setInput('');
  };
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <Input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder} className="h-[30px] text-xs rounded-[2px]" />
        <Button type="button" variant="outline" size="sm" onClick={add} className="h-[30px] px-2 rounded-[2px] shrink-0">
          <Plus className="w-3 h-3" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[11px] bg-muted border border-border text-foreground">
              {tag}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <X className="w-2.5 h-2.5 text-muted-foreground" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export const MeetingRecordCard = ({ record }: MeetingRecordCardProps) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  // Edit state — initialised from record
  const [editTitle, setEditTitle]       = useState(record.title || '');
  const [editContent, setEditContent]   = useState(record.content || '');
  const [editUrl, setEditUrl]           = useState(record.url || '');
  const [editDurMin, setEditDurMin]     = useState(record.duration_seconds ? String(Math.round(record.duration_seconds / 60)) : '');
  const [editSource, setEditSource]     = useState(record.source || '');
  const [editScore, setEditScore]       = useState(record.ai_score ?? 5);
  const [editSentiment, setEditSentiment] = useState<MeetingRecord['ai_sentiment']>(record.ai_sentiment ?? 'neutro');
  const [editTopics, setEditTopics]     = useState<string[]>(record.ai_key_topics ?? []);
  const [editNextSteps, setEditNextSteps] = useState<string[]>(record.ai_next_steps ?? []);
  const [editObjections, setEditObjections] = useState<string[]>(record.ai_objections ?? []);

  const deleteMutation = useDeleteMeetingRecord();
  const updateMutation = useUpdateMeetingRecord();

  const typeConfig = RECORD_TYPE_CONFIG[record.record_type] ?? RECORD_TYPE_CONFIG.note;
  const TypeIcon = typeConfig.icon;

  const startEditing = () => {
    // Reset to current record values
    setEditTitle(record.title || '');
    setEditContent(record.content || '');
    setEditUrl(record.url || '');
    setEditDurMin(record.duration_seconds ? String(Math.round(record.duration_seconds / 60)) : '');
    setEditSource(record.source || '');
    setEditScore(record.ai_score ?? 5);
    setEditSentiment(record.ai_sentiment ?? 'neutro');
    setEditTopics(record.ai_key_topics ?? []);
    setEditNextSteps(record.ai_next_steps ?? []);
    setEditObjections(record.ai_objections ?? []);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const payload: Parameters<typeof updateMutation.mutateAsync>[0] = {
      id: record.id,
      meetingId: record.meeting_id,
    };

    if (record.record_type === 'recording') {
      payload.url = editUrl || undefined;
      payload.duration_seconds = editDurMin ? Number(editDurMin) * 60 : undefined;
      payload.source = editSource || undefined;
    } else if (record.record_type === 'ai_analysis') {
      payload.ai_score = editScore;
      payload.ai_sentiment = editSentiment;
      payload.ai_key_topics = editTopics.length > 0 ? editTopics : undefined;
      payload.ai_next_steps = editNextSteps.length > 0 ? editNextSteps : undefined;
      payload.ai_objections = editObjections.length > 0 ? editObjections : undefined;
      payload.title = editTitle || undefined;
      payload.content = editContent || undefined;
      payload.source = editSource || undefined;
    } else {
      payload.title = editTitle || undefined;
      payload.content = editContent || undefined;
      payload.source = editSource || undefined;
    }

    await updateMutation.mutateAsync(payload);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync({ id: record.id, meetingId: record.meeting_id });
    setShowConfirm(false);
  };

  return (
    <>
      <div className="border border-border bg-card rounded-[2px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[11px] font-medium border shrink-0', typeConfig.color)}>
              <TypeIcon className="w-3 h-3" />
              {typeConfig.label}
            </span>
            {record.source && !isEditing && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-[2px] text-[11px] font-medium border border-border bg-muted text-muted-foreground shrink-0">
                {SOURCE_LABELS[record.source] ?? record.source}
              </span>
            )}
            {record.duration_seconds && !isEditing && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                <Clock className="w-3 h-3" />
                {formatDuration(record.duration_seconds)}
              </span>
            )}
            {record.title && !isEditing && (
              <span className="text-xs font-medium text-foreground truncate">{record.title}</span>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {record.url && !isEditing && (
              <Button variant="ghost" size="sm" asChild className="h-[30px] w-[30px] p-0 rounded-[2px]">
                <a href={record.url} target="_blank" rel="noopener noreferrer" title="Abrir link">
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </a>
              </Button>
            )}
            {isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}
                  className="h-[30px] w-[30px] p-0 rounded-[2px] text-muted-foreground">
                  <X className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}
                  className="h-[30px] px-2.5 rounded-[2px] text-xs gap-1">
                  <Check className="w-3 h-3" />
                  {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={startEditing}
                  className="h-[30px] w-[30px] p-0 rounded-[2px] text-muted-foreground hover:text-foreground">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowConfirm(true)}
                  className="h-[30px] w-[30px] p-0 rounded-[2px] text-muted-foreground hover:text-destructive hover:bg-destructive/5">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">

          {/* ── EDIT MODE ───────────────────────────────────── */}
          {isEditing && (
            <div className="space-y-3">
              {/* Source (shared across types) */}
              <div className="space-y-1">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Fonte</Label>
                <Select value={editSource} onValueChange={setEditSource}>
                  <SelectTrigger className="h-8 text-xs rounded-[2px]"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent className="rounded-[2px]">
                    {SOURCES.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Recording */}
              {record.record_type === 'recording' && (
                <>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">URL da Gravação</Label>
                    <Input value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="https://loom.com/share/..." className="h-8 text-xs rounded-[2px]" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Duração (minutos)</Label>
                    <Input type="number" value={editDurMin} onChange={e => setEditDurMin(e.target.value)} placeholder="Ex: 45" className="h-8 text-xs rounded-[2px]" />
                  </div>
                </>
              )}

              {/* Text types */}
              {(record.record_type !== 'recording' && record.record_type !== 'ai_analysis') && (
                <>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Título</Label>
                    <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Título do registro..." className="h-8 text-xs rounded-[2px]" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Conteúdo</Label>
                    <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="min-h-[120px] text-xs rounded-[2px] resize-none" />
                  </div>
                </>
              )}

              {/* AI Analysis */}
              {record.record_type === 'ai_analysis' && (
                <>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Score: <span className="text-foreground font-semibold">{editScore}/10</span>
                    </Label>
                    <Slider value={[editScore]} onValueChange={([v]) => setEditScore(v)} min={0} max={10} step={0.5} className="py-1" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Sentimento</Label>
                    <Select value={editSentiment ?? 'neutro'} onValueChange={v => setEditSentiment(v as MeetingRecord['ai_sentiment'])}>
                      <SelectTrigger className="h-8 text-xs rounded-[2px]"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-[2px]">
                        <SelectItem value="positivo" className="text-xs">Positivo</SelectItem>
                        <SelectItem value="neutro" className="text-xs">Neutro</SelectItem>
                        <SelectItem value="negativo" className="text-xs">Negativo</SelectItem>
                        <SelectItem value="misto" className="text-xs">Misto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Tópicos</Label>
                    <TagInput value={editTopics} onChange={setEditTopics} placeholder="Adicionar tópico..." />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Próximos passos</Label>
                    <TagInput value={editNextSteps} onChange={setEditNextSteps} placeholder="Adicionar próximo passo..." />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Objeções</Label>
                    <TagInput value={editObjections} onChange={setEditObjections} placeholder="Adicionar objeção..." />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Título</Label>
                    <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Título..." className="h-8 text-xs rounded-[2px]" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Conteúdo adicional</Label>
                    <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="Observações..." className="min-h-[80px] text-xs rounded-[2px] resize-none" />
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── VIEW MODE ───────────────────────────────────── */}
          {!isEditing && (
            <>
              {/* Recording embed */}
              {record.record_type === 'recording' && record.url && (
                isLoomUrl(record.url) ? (
                  <div className="rounded-[2px] overflow-hidden bg-muted aspect-video">
                    <iframe src={record.url.replace('/share/', '/embed/')} className="w-full h-full"
                      allowFullScreen title={record.title || 'Gravação'} />
                  </div>
                ) : (
                  <a href={record.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <ExternalLink className="w-3 h-3" />
                    Abrir gravação
                  </a>
                )
              )}

              {/* Transcript viewer (tl;dv structured segments) */}
              {record.record_type === 'transcript' &&
                Array.isArray(record.transcript_json) &&
                record.transcript_json.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowTranscript(v => !v)}
                    className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline mb-2"
                  >
                    <AlignLeft className="w-3 h-3" />
                    {showTranscript ? 'Ocultar transcrição' : 'Ver transcrição'}
                  </button>
                  {showTranscript && (
                    <div className="border border-border rounded-[2px] p-3 bg-muted/30">
                      <MeetingTranscriptViewer transcript_json={record.transcript_json} />
                    </div>
                  )}
                </div>
              )}

              {/* Text content */}
              {(record.record_type === 'transcript' || record.record_type === 'summary' ||
                record.record_type === 'note' || record.record_type === 'ai_summary') && record.content && (
                <div>
                  <div className={cn(
                    'text-xs text-muted-foreground whitespace-pre-wrap rounded-[2px] bg-muted p-3 border border-border',
                    !expanded && 'max-h-32 overflow-hidden relative'
                  )}>
                    {record.content}
                    {!expanded && (
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent" />
                    )}
                  </div>
                  {record.content.length > 200 && (
                    <button onClick={() => setExpanded(v => !v)}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mt-1.5 transition-colors">
                      {expanded
                        ? <><ChevronUp className="w-3 h-3" />Mostrar menos</>
                        : <><ChevronDown className="w-3 h-3" />Mostrar mais</>}
                    </button>
                  )}
                </div>
              )}

              {/* AI Analysis */}
              {record.record_type === 'ai_analysis' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 flex-wrap">
                    {record.ai_score != null && <ScoreGauge score={record.ai_score} />}
                    {record.ai_sentiment && (
                      <span className={cn('inline-flex items-center px-2.5 py-1 rounded-[2px] text-xs font-medium border',
                        SENTIMENT_CONFIG[record.ai_sentiment]?.cls)}>
                        {SENTIMENT_CONFIG[record.ai_sentiment]?.label}
                      </span>
                    )}
                  </div>
                  {record.ai_key_topics && record.ai_key_topics.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Tópicos</p>
                      <div className="flex flex-wrap gap-1">
                        {record.ai_key_topics.map((t, i) => (
                          <Badge key={i} variant="secondary" className="text-[11px] rounded-[2px] px-2 py-0.5">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {record.ai_next_steps && record.ai_next_steps.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Próximos passos</p>
                      <ul className="space-y-1">
                        {record.ai_next_steps.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                            <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {record.ai_objections && record.ai_objections.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Objeções</p>
                      <ul className="space-y-1">
                        {record.ai_objections.map((o, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            {o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {record.content && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{record.content}</p>
                  )}
                </div>
              )}

              {record.recorded_at && (
                <p className="text-[11px] text-white/40">
                  Registrado em {formatDate(record.recorded_at)}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmarExclusaoModal
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={handleDelete}
        title="Excluir registro"
        description="Tem certeza que deseja excluir este registro da reunião?"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
};
