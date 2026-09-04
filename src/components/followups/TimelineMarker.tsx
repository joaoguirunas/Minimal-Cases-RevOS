import { useRef, useState, type RefObject } from 'react';
import { Mail, MessageCircle, Smartphone, Phone, MoreHorizontal } from 'lucide-react';
import { Chip } from '@/components/ui/chip';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { WhatsappTemplateDetails } from '@/components/config/WhatsappTemplateDetails';
import { useCreateFollowup, useDeleteFollowup, useUpdateFollowupFields, type StageFollowup } from '@/hooks/useFollowups';
import type { WhatsappTemplate } from '@/hooks/useWhatsappTemplates';
import { minToParts, snapOffset, formatTempo, type TimelineRule, type Lane, type Canal, type TemplateStatus } from '@/lib/followups/timeline';
import { cn } from '@/lib/utils';

const CANAL_ICON: Record<Canal, React.ElementType> = {
  email: Mail,
  whatsapp: MessageCircle,
  sms: Smartphone,
  outro: Phone,
};

const CANAL_LABEL: Record<Canal, string> = {
  email: 'e-mail',
  whatsapp: 'whatsapp',
  sms: 'sms',
  outro: 'ligação',
};

const TEMPLATE_STATUS_META: Record<TemplateStatus, { label: string; tone: 'success' | 'warning' | 'danger' } | null> = {
  aprovado: { label: 'Aprovado', tone: 'success' },
  em_analise: { label: 'Em análise', tone: 'warning' },
  rejeitado: { label: 'Rejeitado', tone: 'danger' },
  sem_template: { label: 'Sem template', tone: 'danger' },
  nao_aplica: null,
};

const laneLabel = (lane: Lane): string => (lane.key === 'comum' ? 'Comum' : `${lane.key} · ${lane.name}`);

interface TimelineMarkerProps {
  rule: TimelineRule;
  followup: StageFollowup;
  index: number;
  scaleMax: number;
  /** Elemento do trilho (raia) — usado para medir a posição do drag, NÃO o wrapper do marcador. */
  trackRef: RefObject<HTMLDivElement>;
  /** Outras raias (sem a "Variante encerrada"), para duplicar/mover. */
  lanes: Lane[];
  templates: WhatsappTemplate[];
  onEdit: (followup: StageFollowup) => void;
}

/** Marcador da timeline: botão de 28px arrastável (pointer events, sem lib de drag). */
const TimelineMarker = ({ rule, followup, index, scaleMax, trackRef, lanes, templates, onEdit }: TimelineMarkerProps) => {
  const [dragPct, setDragPct] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const moved = useRef(false);

  const updateFields = useUpdateFollowupFields();
  const createFollowup = useCreateFollowup();
  const deleteFollowup = useDeleteFollowup();

  const Icon = CANAL_ICON[rule.canal] ?? Phone;
  const basePct = scaleMax > 0 ? Math.min(100, Math.max(0, (rule.offsetMin / scaleMax) * 100)) : 0;
  const pct = dragPct ?? basePct;

  const parts = minToParts(rule.offsetMin);
  const tempo = formatTempo(parts.dias, parts.horas, parts.minutos);
  const ariaLabel = `E${index} · ${CANAL_LABEL[rule.canal]} · ${tempo}`;

  const statusMeta = TEMPLATE_STATUS_META[rule.templateStatus];
  const needsAttention = rule.templateStatus === 'rejeitado' || rule.templateStatus === 'sem_template';

  // Usa followup.ab_variant_id (o valor real, não o de rule — que fica null para regras
  // órfãs, já que a raia "Variante encerrada" zera ab_variant_id só para reaproveitar
  // buildStageTimeline). Assim uma órfã sempre oferece "Comum" entre os destinos.
  const otherLanes = lanes.filter((l) => l.variantId !== followup.ab_variant_id);

  const waTemplate = rule.canal === 'whatsapp'
    ? (templates.find((t) => t.id === followup.whatsapp_template_id) ?? templates.find((t) => t.id_template === followup.template_id) ?? null)
    : null;
  const hasPreview = waTemplate ? true : !!followup.mensagem;

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartX.current = e.clientX;
    moved.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    if (!moved.current && Math.abs(dx) < 4) return;
    moved.current = true;
    // Mede o TRILHO (a raia inteira), não o wrapper de ~28px do próprio marcador —
    // e.currentTarget.parentElement é o wrapper do marcador, não o trilho.
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const next = rect.width > 0 ? Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) : 0;
    setDragPct(next * 100);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragStartX.current === null) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    dragStartX.current = null;
    if (moved.current && dragPct !== null) {
      const newMin = snapOffset(Math.round((dragPct / 100) * scaleMax), scaleMax);
      setDragPct(null);
      if (newMin !== rule.offsetMin) {
        updateFields.mutate({ id: rule.id, ...minToParts(newMin) });
      }
    } else {
      setDragPct(null);
    }
  };

  // Cancelamento do navegador (menu de contexto, gesto interrompido) — só reseta se
  // ainda estávamos em drag (dragStartX !== null); handlePointerUp já zera dragStartX
  // antes de soltar a captura, então o lostpointercapture disparado por ele mesmo é
  // um no-op aqui e não atropela o `moved` que handleClick ainda precisa ler.
  const handlePointerCancel = () => {
    if (dragStartX.current === null) return;
    dragStartX.current = null;
    moved.current = false;
    setDragPct(null);
  };

  const handleClick = () => {
    if (moved.current) { moved.current = false; return; }
    onEdit(followup);
  };

  const handleDuplicate = (target: Lane) => {
    createFollowup.mutate({
      stage_id: followup.leads_stages_id ?? undefined,
      score_matrix_id: followup.score_matrix_id ?? undefined,
      dias: followup.dias,
      horas: followup.horas,
      minutos: followup.minutos,
      tipo: followup.tipo,
      mensagem: followup.mensagem,
      assunto: followup.assunto,
      arquivo_audio: followup.arquivo_audio,
      template_id: followup.template_id,
      whatsapp_template_id: followup.whatsapp_template_id,
      email_template_id: followup.email_template_id,
      as_queue_id: followup.as_queue_id,
      ativo: followup.ativo,
      target_stage_id: followup.target_stage_id,
      control: followup.control,
      business_hours_only: followup.business_hours_only,
      bh_only_last: followup.bh_only_last,
      vars: followup.vars,
      ab_variant_id: target.variantId,
    });
  };

  return (
    <div
      className="group/marker absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${pct}%` }}
    >
      {/* Rótulo — acima/abaixo conforme colisão com o vizinho. Clicável (mesma ação
          de editar do botão) para não deixar o clique vazar pro trilho e criar uma
          regra nova em cima da existente. */}
      <div
        onClick={() => onEdit(followup)}
        className={cn(
          'absolute left-1/2 flex -translate-x-1/2 cursor-pointer flex-col items-center gap-0.5 whitespace-nowrap',
          rule.placement === 'above' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
        )}
      >
        <span className="text-[11px] tabular-nums text-muted-foreground">{tempo}</span>
        <span className="max-w-[140px] truncate text-[12px] font-medium text-foreground">{rule.label}</span>
        <span className="flex flex-wrap items-center justify-center gap-1">
          {statusMeta && <Chip tone={statusMeta.tone}>{statusMeta.label}</Chip>}
          {rule.tracked && <Chip tone="info">link</Chip>}
          {rule.headerImage && <Chip tone="info">foto</Chip>}
          {rule.ctr && (
            <Chip tone="neutral">
              {rule.ctr.clicados}/{rule.ctr.enviados} · {rule.ctr.ctr != null ? Math.round(rule.ctr.ctr * 100) : 0}%
            </Chip>
          )}
        </span>
      </div>

      <button
        type="button"
        aria-label={ariaLabel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handlePointerCancel}
        onClick={handleClick}
        className={cn(
          'relative flex h-7 w-7 touch-none items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-opacity',
          !rule.ativo && 'opacity-50',
          needsAttention && 'ring-2 ring-red-500/40',
        )}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Mais ações"
            className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card opacity-0 transition-opacity focus:opacity-100 group-hover/marker:opacity-100"
          >
            <MoreHorizontal className="h-2.5 w-2.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 text-[13px]">
          <DropdownMenuItem onClick={() => onEdit(followup)}>Editar</DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateFields.mutate({ id: rule.id, ativo: !rule.ativo })}>
            {rule.ativo ? 'Desligar' : 'Ligar'}
          </DropdownMenuItem>
          {otherLanes.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {otherLanes.map((l) => (
                <DropdownMenuItem key={`dup-${l.key}`} onClick={() => handleDuplicate(l)}>
                  Duplicar para {laneLabel(l)}
                </DropdownMenuItem>
              ))}
              {otherLanes.map((l) => (
                <DropdownMenuItem key={`move-${l.key}`} onClick={() => updateFields.mutate({ id: rule.id, ab_variant_id: l.variantId })}>
                  Mover para {laneLabel(l)}
                </DropdownMenuItem>
              ))}
            </>
          )}
          {hasPreview && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setPreviewOpen(true)}>Pré-visualizar</DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteOpen(true)}>
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="truncate text-[16px] font-semibold">{waTemplate?.nome ?? rule.label}</DialogTitle>
          </DialogHeader>
          {waTemplate ? (
            <WhatsappTemplateDetails template={waTemplate} />
          ) : (
            <div className="mt-2 rounded-lg border border-border bg-muted/40 p-4">
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/80">{followup.mensagem}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Follow-up</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFollowup.mutate({ id: rule.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TimelineMarker;
