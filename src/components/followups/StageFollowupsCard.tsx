import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Copy, Trash2, MessageSquare, Mail, Smartphone, Phone, Zap, Target, Eye } from 'lucide-react';
import { useDeleteFollowup, type StageFollowup } from '@/hooks/useFollowups';
import { useScoreMatrix } from '@/hooks/useScoreMatrix';
import { useWhatsappTemplates } from '@/hooks/useWhatsappTemplates';
import { WhatsappTemplateDetails } from '@/components/config/WhatsappTemplateDetails';
import FollowupModal from './FollowupModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface StageFollowupsCardProps {
  stage: { id: string; nome: string; ordem: number };
  followups: StageFollowup[];
  leadsCount?: number;
}

const CANAL_ICONS: Record<string, { icon: React.ElementType; label: string; format?: string }> = {
  whatsapp_template: { icon: MessageSquare, label: 'WhatsApp', format: 'Template' },
  whatsapp_texto:    { icon: Zap,           label: 'WhatsApp', format: 'Texto' },
  email:             { icon: Mail,          label: 'E-mail',   format: 'Email' },
  sms:               { icon: Smartphone,    label: 'SMS',      format: 'SMS' },
  ligacao:           { icon: Phone,         label: 'Ligação',  format: 'Call' },
};

const ORIGEM_LABELS: Record<number, string> = {
  1: 'Recomendação',
  2: 'Pessoal',
  3: 'Evento / Campanha',
  4: 'Network',
};

const formatTempo = (dias: number, horas: number, minutos: number) => {
  const parts: string[] = [];
  if (dias > 0)    parts.push(`${dias}d`);
  if (horas > 0)   parts.push(`${horas}h`);
  if (minutos > 0) parts.push(`${minutos}min`);
  return parts.length > 0 ? parts.join(' ') : 'Imediato';
};

const StageFollowupsCard = ({ stage, followups, leadsCount = 0 }: StageFollowupsCardProps) => {
  const [isModalOpen, setIsModalOpen]         = useState(false);
  const [editing, setEditing]                 = useState<StageFollowup | null>(null);
  const [previewTemplateId, setPreviewId]     = useState<string | null>(null);
  const [previewMessage, setPreviewMessage]   = useState<{ title: string; body: string } | null>(null);
  const deleteFollowup                        = useDeleteFollowup();
  const { data: scoreMatrixList = [] }        = useScoreMatrix();
  const { data: allTemplates = [] }           = useWhatsappTemplates();

  // lookup por UUID (whatsapp_template_id) ou por id_template (template_id string)
  const previewTemplate = previewTemplateId
    ? (allTemplates.find(t => t.id === previewTemplateId) ?? allTemplates.find(t => t.id_template === previewTemplateId) ?? null)
    : null;

  const getFollowupTitle = (f: StageFollowup) =>
    f.tipo === 'whatsapp_template'
      ? (f.whatsapp_template_name ?? allTemplates.find(t => t.id === f.whatsapp_template_id)?.nome ?? allTemplates.find(t => t.id_template === f.template_id)?.nome ?? f.template_id ?? '')
      : (f.assunto ?? f.mensagem?.split('\n')[0] ?? '');

  const sortFollowups = (arr: StageFollowup[]) =>
    [...arr].sort((a, b) => {
      const timeA = a.dias * 1440 + a.horas * 60 + (a.minutos || 0);
      const timeB = b.dias * 1440 + b.horas * 60 + (b.minutos || 0);
      if (timeA !== timeB) return timeA - timeB;
      return getFollowupTitle(a).localeCompare(getFollowupTitle(b), 'pt');
    });

  const generalFollowups  = sortFollowups(followups.filter(f => !f.score_matrix_id));
  const specificFollowups = sortFollowups(followups.filter(f => !!f.score_matrix_id));

  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const renderItem = (f: StageFollowup, isLast: boolean) => {
    const canal = CANAL_ICONS[f.tipo] ?? CANAL_ICONS['whatsapp_texto'];
    const Icon  = canal.icon;
    const score = f.score_matrix_id ? scoreMatrixList.find(m => m.id === f.score_matrix_id) : null;

    const resolvedName =
      f.whatsapp_template_name ??
      allTemplates.find(t => t.id === f.whatsapp_template_id)?.nome ??
      allTemplates.find(t => t.id_template === f.template_id)?.nome ??
      null;

    const previewKey = f.whatsapp_template_id ?? f.template_id ?? null;

    // título principal — o que identifica o followup
    const title =
      f.tipo === 'whatsapp_template'
        ? (resolvedName ?? f.template_id ?? 'Template sem nome')
        : (f.assunto ?? f.mensagem?.split('\n')[0] ?? (f.tipo === 'ligacao' ? 'Ligação via Discador AS' : '—'));

    const handleEye = () => {
      if (f.tipo === 'whatsapp_template' && previewKey) {
        setPreviewId(previewKey);
      } else if (f.mensagem) {
        setPreviewMessage({ title: title, body: f.mensagem });
      }
    };

    const hasPreview = f.tipo === 'whatsapp_template' ? !!previewKey : !!f.mensagem;

    return (
      <div
        key={f.id}
        className={cn(
          'group flex items-center gap-3 px-5 py-3 hover:bg-white/[0.035] transition-colors',
          !isLast && 'border-b border-border'
        )}
      >
        <div className="flex-1 min-w-0">
          {/* Título — destaque principal */}
          <p className="text-[13px] font-medium text-foreground truncate">{title}</p>

          {/* Canal + timing + badges — secundário */}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50">
              <Icon className="w-3 h-3" strokeWidth={1.5} />
              {canal.label}
              {canal.format && canal.format !== canal.label && <>· {canal.format}</>}
            </span>
            <span className="text-muted-foreground/30 text-[10px]">·</span>
            <span className="text-[11px] text-muted-foreground/50">
              {formatTempo(f.dias, f.horas, f.minutos || 0)}
            </span>
            <span className={cn(
              'inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none',
              f.ativo
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 border-emerald-200/30'
                : 'text-muted-foreground/50 bg-muted border-border'
            )}>
              {f.ativo ? 'Ativo' : 'Inativo'}
            </span>
            {f.control != null && (
              <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none text-amber-600 dark:text-amber-400 bg-amber-500/8 border-amber-200/30">
                {ORIGEM_LABELS[f.control] ?? `Origem ${f.control}`}
              </span>
            )}
            {score && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none text-blue-600 dark:text-blue-400 bg-blue-500/8 border-blue-200/30">
                <Target className="w-2.5 h-2.5" strokeWidth={1.5} />
                Score {score.score_number}
              </span>
            )}
          </div>
        </div>

        {/* Ações — visíveis no hover */}
        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {hasPreview && (
            <Button size="sm" variant="ghost" onClick={handleEye}
              className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-emerald-500">
              <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => { setEditing(f); setIsModalOpen(true); }}
            className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-foreground">
            <Edit className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditing({ ...f, id: '' } as StageFollowup); setIsModalOpen(true); }}
            className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-foreground">
            <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Follow-up</AlertDialogTitle>
                <AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteFollowup.mutate({ id: f.id })}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (followups.length === 0) {
      return (
        <div className="px-5 py-8 text-center">
          <p className="text-[13px] text-muted-foreground/50">Nenhum follow-up cadastrado para esta etapa</p>
        </div>
      );
    }
    const items: React.ReactNode[] = [];
    if (generalFollowups.length > 0) {
      items.push(
        <div key="lbl-g" className="px-5 py-2 bg-card border-b border-border">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/40">
            Gerais · {generalFollowups.length}
          </p>
        </div>
      );
      generalFollowups.forEach((f, i) => items.push(renderItem(f, i === generalFollowups.length - 1 && specificFollowups.length === 0)));
    }
    if (specificFollowups.length > 0) {
      items.push(
        <div key="lbl-s" className="px-5 py-2 bg-card border-b border-border">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/40 flex items-center gap-1.5">
            <Target className="w-3 h-3" strokeWidth={1.5} />Por Score · {specificFollowups.length}
          </p>
        </div>
      );
      specificFollowups.forEach((f, i) => items.push(renderItem(f, i === specificFollowups.length - 1)));
    }
    return items;
  };

  return (
    <>
      <div className="border border-border rounded-[4px] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-foreground">{stage.nome}</span>
            <span className="text-[11px] text-muted-foreground/40">
              {followups.length} follow-up{followups.length !== 1 ? 's' : ''}
              {leadsCount > 0 && ` · ${leadsCount} lead${leadsCount !== 1 ? 's' : ''}`}
            </span>
          </div>
          <Button size="sm" onClick={() => setIsModalOpen(true)} className="h-[30px] text-xs rounded-[4px] gap-1">
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            Adicionar
          </Button>
        </div>
        {renderContent()}
      </div>

      <FollowupModal
        isOpen={isModalOpen}
        onClose={closeModal}
        stageId={stage.id}
        followup={editing}
      />

      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold truncate">
              {previewTemplate?.nome ?? 'Template'}
            </DialogTitle>
          </DialogHeader>
          {previewTemplate && <WhatsappTemplateDetails template={previewTemplate} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewMessage} onOpenChange={() => setPreviewMessage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold truncate">
              {previewMessage?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="bg-muted/40 border border-border rounded-[4px] p-4 mt-2">
            <p className="text-[13px] text-foreground/80 whitespace-pre-wrap leading-relaxed">
              {previewMessage?.body}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StageFollowupsCard;
