import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Copy, Trash2, MessageSquare, Mail, Smartphone, Zap, Clock, Eye } from 'lucide-react';
import { useDeleteAgendamentoFollowup, type AgendamentoFollowup, type MeetingStatus } from '@/hooks/useAgendamentosFollowups';
import { useWhatsappTemplates } from '@/hooks/useWhatsappTemplates';
import { WhatsappTemplateDetails } from '@/components/config/WhatsappTemplateDetails';
import AgendamentoFollowupModal from './AgendamentoFollowupModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface AgendamentoFollowupsCardProps {
  status:    MeetingStatus;
  followups: AgendamentoFollowup[];
}

const STATUS_DESCRIPTIONS: Record<MeetingStatus, string> = {
  agendado:       'Lembretes enviados antes da reunião agendada',
  compareceu:     'Follow-ups enviados após confirmação de presença',
  nao_compareceu: 'Follow-ups enviados para leads que não apareceram',
  cancelado:      'Follow-ups enviados após cancelamento de reunião',
  realizado:      'Follow-ups enviados após o agendamento ser realizado',
};

const CANAL_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  whatsapp_template: { icon: MessageSquare, label: 'WhatsApp',  color: 'text-emerald-500 dark:text-emerald-400' },
  // compat-shims: não criáveis via UI — presentes apenas para renderizar followups antigos
  whatsapp_texto:    { icon: Zap,           label: 'WhatsApp',  color: 'text-emerald-500 dark:text-emerald-400' },
  whatsapp_audio:    { icon: MessageSquare, label: 'WA Áudio',  color: 'text-emerald-500 dark:text-emerald-400' },
  email:             { icon: Mail,          label: 'E-mail',    color: 'text-primary/70'                        },
  email_texto:       { icon: Mail,          label: 'E-mail',    color: 'text-primary/70'                        }, // compat-shim
  sms:               { icon: Smartphone,    label: 'SMS',       color: 'text-violet-500 dark:text-violet-400'   },
};

const formatTempo = (dias: number, horas: number, minutos: number) => {
  const parts: string[] = [];
  if (dias > 0)    parts.push(`${dias}d`);
  if (horas > 0)   parts.push(`${horas}h`);
  if (minutos > 0) parts.push(`${minutos}min`);
  return parts.length > 0 ? parts.join(' ') : 'Imediato';
};

const AgendamentoFollowupsCard = ({ status, followups }: AgendamentoFollowupsCardProps) => {
  const [isModalOpen, setIsModalOpen]     = useState(false);
  const [editing, setEditing]             = useState<AgendamentoFollowup | null>(null);
  const [previewTemplateId, setPreviewId] = useState<string | null>(null);
  const deleteFollowup                    = useDeleteAgendamentoFollowup();
  const { data: allTemplates = [] }       = useWhatsappTemplates();
  const isAntes                           = status === 'agendado';

  const previewTemplate = previewTemplateId
    ? (allTemplates.find(t => t.id === previewTemplateId) ?? allTemplates.find(t => t.id_template === previewTemplateId) ?? null)
    : null;

  const closeModal = () => { setIsModalOpen(false); setEditing(null); };
  const openCreate = () => { setEditing(null); setIsModalOpen(true); };
  const openEdit   = (f: AgendamentoFollowup) => { setEditing(f); setIsModalOpen(true); };
  const openCopy   = (f: AgendamentoFollowup) => { setEditing({ ...f, id: '' } as AgendamentoFollowup); setIsModalOpen(true); };

  return (
    <>
      <div className="border border-border rounded-[4px] overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card">
          <div>
            <p className="text-[12px] text-muted-foreground/60">{STATUS_DESCRIPTIONS[status]}</p>
            {followups.length > 0 && (
              <p className="text-[11px] text-muted-foreground/40 mt-0.5">
                {followups.length} follow-up{followups.length !== 1 ? 's' : ''} configurado{followups.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <Button size="sm" onClick={openCreate} className="h-[30px] text-xs rounded-[4px] gap-1.5">
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            Adicionar
          </Button>
        </div>

        {/* Lista */}
        {followups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center mb-3">
              <Clock className="w-5 h-5 text-muted-foreground/30" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-medium text-muted-foreground/50">
              {isAntes ? 'Nenhum lembrete configurado' : 'Nenhum follow-up configurado'}
            </p>
            <p className="text-[12px] text-muted-foreground/35 mt-1">
              Clique em "Adicionar" para criar o primeiro
            </p>
          </div>
        ) : (
          <div>
            {followups.map((f, i) => {
              const meta   = CANAL_META[f.tipo] ?? CANAL_META['whatsapp_texto'];
              const Icon   = meta.icon;
              const isLast = i === followups.length - 1;
              const tempo  = formatTempo(f.dias, f.horas, f.minutos);

              return (
                <div
                  key={f.id}
                  className={cn(
                    'group flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.035] transition-colors',
                    !isLast && 'border-b border-border'
                  )}
                >
                  {/* Timing */}
                  <div className="flex-shrink-0 min-w-[52px] text-right">
                    <span className="text-[13px] font-semibold font-mono text-foreground/75">{tempo}</span>
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                      {isAntes ? 'antes' : 'após'}
                    </p>
                  </div>

                  {/* Divider dot */}
                  <div className="flex-shrink-0 w-1 h-1 rounded-full bg-border/60" />

                  {/* Canal */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 w-[110px]">
                    <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', meta.color)} strokeWidth={1.5} />
                    <span className="text-[12px] text-foreground/70 truncate">{meta.label}</span>
                  </div>

                  {/* Conteúdo preview */}
                  <div className="flex-1 min-w-0">
                    {f.whatsapp_template_name ? (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate leading-tight">
                        Template: {f.whatsapp_template_name}
                      </p>
                    ) : f.template_id && f.tipo === 'whatsapp_template' ? (
                      <p className="text-[11px] text-emerald-600/60 dark:text-emerald-400/60 truncate leading-tight">
                        Template: {f.template_id}
                      </p>
                    ) : null}
                    {f.assunto && (
                      <p className="text-[12px] text-foreground/60 truncate leading-tight">{f.assunto}</p>
                    )}
                    {!f.assunto && f.mensagem && !f.whatsapp_template_name && !f.template_id && (
                      <p className="text-[12px] text-muted-foreground/50 truncate leading-tight">{f.mensagem}</p>
                    )}
                  </div>

                  {/* BH badge */}
                  {f.business_hours_only && (
                    <span
                      title={f.bh_only_last ? 'Horário comercial · apenas o último' : 'Horário comercial'}
                      className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none text-amber-600 dark:text-amber-400 bg-amber-500/8 border-amber-200/30"
                    >
                      <Clock className="w-2.5 h-2.5" strokeWidth={1.5} />
                      HC
                    </span>
                  )}

                  {/* Status pill */}
                  <span className={cn(
                    'flex-shrink-0 inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none',
                    f.ativo
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 border-emerald-200/30'
                      : 'text-muted-foreground/50 bg-card0 border-border'
                  )}>
                    {f.ativo ? 'Ativo' : 'Inativo'}
                  </span>

                  {/* Ações — visíveis no hover */}
                  <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {f.tipo === 'whatsapp_template' && (f.whatsapp_template_id ?? f.template_id) && (
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => setPreviewId(f.whatsapp_template_id ?? f.template_id)}
                        className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-emerald-500"
                      >
                        <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </Button>
                    )}
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => openEdit(f)}
                      className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-foreground"
                    >
                      <Edit className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => openCopy(f)}
                      className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-foreground"
                    >
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
            })}
          </div>
        )}
      </div>

      <AgendamentoFollowupModal
        isOpen={isModalOpen}
        onClose={closeModal}
        status={status}
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
    </>
  );
};

export default AgendamentoFollowupsCard;
