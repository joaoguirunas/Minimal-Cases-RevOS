
import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Stage } from "@/hooks/usePipelines";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Droppable, Draggable, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { NegocioOptimized } from "@/hooks/useNegociosOptimized";
import { useNavigate } from "react-router-dom";
import { Building2, Clock, Mail, MessageCircle, Megaphone, MoreHorizontal, Smartphone, Star, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useMessageCountByLead } from "@/hooks/useMessageCount";
import { useTouchCountsByLead } from "@/hooks/useEsteiraLead";
import CursoBadges from "./CursoBadges";
import TagBadges from "./TagBadges";
import UnreadBadge from "@/components/common/UnreadBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MotivoPerdasModal from "./MotivoPerdasModal";
import { useUpdateNegocio } from "@/hooks/useNegocios";
import { toast } from "sonner";

interface StageColumnProps {
  stage: Stage;
  negocios: NegocioOptimized[];
  totalValue: number;
  isLoading: boolean;
}

const StageColumn = ({
  stage,
  negocios,
  totalValue,
  isLoading
}: StageColumnProps) => {
  const navigate = useNavigate();
  const [displayedItems, setDisplayedItems] = useState(10);
  const [showLostModal, setShowLostModal] = useState<string | null>(null);
  const updateNegocio = useUpdateNegocio();

  const ITEMS_PER_PAGE = 10;

  const handleConfirmLost = async (motivoId: string, motivoTexto?: string) => {
    if (!showLostModal) return;
    try {
      await updateNegocio.mutateAsync({
        id: showLostModal,
        status: 'lost',
        leads_loss_reasons_id: motivoId,
        loss_reason: motivoTexto,
      });
      toast.success('Negócio marcado como perdido');
      setShowLostModal(null);
    } catch {
      toast.error('Erro ao marcar como perdido');
    }
  };

  const displayedNegocios = useMemo(
    () => negocios.slice(0, displayedItems),
    [negocios, displayedItems]
  );

  const leadIds = useMemo(
    () => negocios.map(n => n.id),
    [negocios]
  );
  const { data: messageCounts = {} } = useMessageCountByLead(leadIds);
  const { data: touchCounts = {} } = useTouchCountsByLead(leadIds);

  const daysSince = (iso?: string) => {
    if (!iso) return null;
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    return Number.isFinite(d) && d >= 0 ? d : null;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0
    }).format(value);
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-muted-foreground/50 bg-muted border-border rounded-[2px]';
    if (score >= 8) return 'text-[#00D26A] bg-[#00D26A]/10 border-[#00D26A]/20 rounded-[2px]';
    if (score >= 6) return 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20 rounded-[2px]';
    return 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20 rounded-[2px]';
  };

  const handleLoadMore = () => {
    setDisplayedItems(prev => prev + ITEMS_PER_PAGE);
  };

  // Portal-aware draggable to prevent z-index issues
  const PortalAwareDraggable: React.FC<{
    negocio: NegocioOptimized;
    index: number;
    children: (args: { provided: DraggableProvided; snapshot: DraggableStateSnapshot }) => React.ReactNode;
  }> = ({ negocio, index, children }) => (
    <Draggable draggableId={negocio.id} index={index}>
      {(provided, snapshot) => {
        const child = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            style={provided.draggableProps.style}
          >
            {children({ provided, snapshot })}
          </div>
        );
        return snapshot.isDragging ? createPortal(child, document.body) : child;
      }}
    </Draggable>
  );

  return (
    <div className="w-72 flex-shrink-0 border border-border rounded-[2px] bg-card flex flex-col h-full" role="region" aria-label={`Etapa ${stage.nome} — ${negocios.length} negócios`}>
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: stage.cor || 'hsl(var(--muted-foreground))' }}
          />
          <span className="text-[13px] font-medium text-foreground truncate">{stage.nome}</span>
          <span className="text-[11px] text-muted-foreground/40 flex-shrink-0">{negocios.length}</span>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground/60 flex-shrink-0 ml-2">
          {formatCurrency(totalValue)}
        </span>
      </div>

      {/* Cards area */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "p-2 space-y-1.5 flex-1 overflow-y-auto min-h-0",
              snapshot.isDraggingOver && "bg-accent/5"
            )}
          >
            {isLoading ? (
              <div className="space-y-1.5">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-[2px]" />
                ))}
              </div>
            ) : negocios.length > 0 ? (
              <>
                {displayedNegocios.map((negocio, index) => (
                  <PortalAwareDraggable key={negocio.id} negocio={negocio} index={index}>
                    {({ snapshot }) => (
                      <div
                        onClick={() => navigate(`/crm/kanban/${negocio.id}`)}
                        className={cn(
                          "w-full bg-background border border-border rounded-[2px] p-3 space-y-2 cursor-pointer transition-all duration-300",
                          "hover:bg-white/[0.035] hover:border-white/[0.10]",
                          snapshot.isDragging && "ring-2 ring-primary/20 z-[9999]",
                          negocio.status === 'lost' && "bg-[#EF4444]/5 border-[#EF4444]/20",
                          (negocio.pessoa?.unread_count ?? 0) > 0 && "border-l-2 border-l-[#EF4444]"
                        )}
                      >
                        {/* Name + value */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-foreground truncate leading-tight">
                              {negocio.pessoa?.name || 'Sem nome'}
                            </p>
                            {negocio.empresa?.trade_name && (
                              <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                                <Building2 className="h-3 w-3 flex-shrink-0" strokeWidth={1.5} />
                                <span className="truncate">{negocio.empresa.trade_name}</span>
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <p className="text-[13px] font-semibold text-primary whitespace-nowrap">
                              {formatCurrency(negocio.value || 0)}
                            </p>
                            {negocio.status === 'in_progress' && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-foreground -mr-1"
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label="Mais ações"
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowLostModal(negocio.id);
                                    }}
                                    className="text-[13px] gap-2 cursor-pointer text-destructive focus:text-destructive"
                                  >
                                    <XCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
                                    Marcar como Perdido
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>

                        {/* Chips row */}
                        <div className="flex items-center gap-1 flex-wrap pt-1.5 border-t border-white/[0.04]">
                          <UnreadBadge
                            variant="chip"
                            count={negocio.pessoa?.unread_count}
                            since={negocio.pessoa?.first_unread_at}
                          />

                          {negocio.pessoa?.score_matrix?.name && (
                            <span className={cn(
                              "inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] border leading-none",
                              getScoreColor(negocio.pessoa.score_matrix.score_number)
                            )}>
                              <Star className="h-2.5 w-2.5" strokeWidth={1.5} />
                              {negocio.pessoa.score_matrix.name}
                            </span>
                          )}


                          {messageCounts[negocio.id] > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] border leading-none text-violet-400 bg-violet-400/10 border-violet-400/20">
                              <MessageCircle className="h-2.5 w-2.5" strokeWidth={1.5} />
                              {messageCounts[negocio.id]} msg
                            </span>
                          )}

                          {negocio.utm_source && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] border leading-none text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/20">
                              <Megaphone className="h-2.5 w-2.5" strokeWidth={1.5} />
                              {negocio.utm_source}
                            </span>
                          )}

                          {/* Toques da esteira (follow-ups enviados) por canal */}
                          {(touchCounts[negocio.id]?.email ?? 0) > 0 && (
                            <span title="E-mails enviados" className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] border leading-none text-sky-400 bg-sky-400/10 border-sky-400/20">
                              <Mail className="h-2.5 w-2.5" strokeWidth={1.5} />
                              {touchCounts[negocio.id].email}
                            </span>
                          )}
                          {(touchCounts[negocio.id]?.whatsapp ?? 0) > 0 && (
                            <span title="WhatsApp enviados" className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] border leading-none text-emerald-400 bg-emerald-400/10 border-emerald-400/20">
                              <MessageCircle className="h-2.5 w-2.5" strokeWidth={1.5} />
                              {touchCounts[negocio.id].whatsapp}
                            </span>
                          )}
                          {(touchCounts[negocio.id]?.sms ?? 0) > 0 && (
                            <span title="SMS enviados" className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] border leading-none text-violet-400 bg-violet-400/10 border-violet-400/20">
                              <Smartphone className="h-2.5 w-2.5" strokeWidth={1.5} />
                              {touchCounts[negocio.id].sms}
                            </span>
                          )}

                          <CursoBadges cursos={negocio.pessoa?.cursos} />

                          <TagBadges tags={negocio.tags?.map((t: any) => t.tag).filter(Boolean)} />

                          {(() => {
                            const d = daysSince(negocio.created_at);
                            if (d === null) return null;
                            return (
                              <span
                                title={`No funil desde ${format(new Date(negocio.created_at), 'dd/MM/yy', { locale: ptBR })}`}
                                className={cn(
                                  "ml-auto inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] border leading-none",
                                  d >= 7 ? "text-red-400 bg-red-400/10 border-red-400/20"
                                    : d >= 3 ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
                                    : "text-muted-foreground/60 bg-muted border-border",
                                )}
                              >
                                <Clock className="h-2.5 w-2.5" strokeWidth={1.5} />
                                {d === 0 ? 'hoje' : `${d}d`}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </PortalAwareDraggable>
                ))}
                {negocios.length > ITEMS_PER_PAGE && displayedItems < negocios.length && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    className="w-full text-[12px] text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.035] mt-1 h-[30px] rounded-[4px]"
                  >
                    Carregar mais ({negocios.length - displayedItems})
                  </Button>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-[12px] text-muted-foreground/40">
                  Nenhum negócio nesta etapa
                </p>
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <MotivoPerdasModal
        isOpen={!!showLostModal}
        onClose={() => setShowLostModal(null)}
        onConfirm={handleConfirmLost}
        isLoading={updateNegocio.isPending}
      />
    </div>
  );
};

export default StageColumn;
