
import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Stage } from "@/hooks/usePipelines";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Droppable, Draggable, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { NegocioOptimized } from "@/hooks/useNegociosOptimized";
import { useNavigate } from "react-router-dom";
import { ChevronsLeft, Clock, MessageCircle, MoreHorizontal, XCircle } from "lucide-react";
import { format, formatDistanceToNowStrict, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { useEsteiraCardData } from "@/hooks/useEsteiraLead";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MotivoPerdasModal from "./MotivoPerdasModal";
import { useUpdateNegocio } from "@/hooks/useNegocios";
import { toast } from "sonner";

/** "Case Couro — Gabriella" → "Case Couro". Títulos sem separador voltam inteiros. */
export function productFromTitle(title?: string | null): string | null {
  if (!title) return null;
  const [produto] = title.split(' — ');
  return produto.trim() || null;
}

const CHANNEL_LABEL: Record<string, string> = { email: 'E-mail', whatsapp: 'WhatsApp', sms: 'SMS' };

function nextTouchText(nextAt: string | null, nextChannel: string | null): string | null {
  if (!nextAt || !nextChannel) return null;
  const d = new Date(nextAt);
  const when = isPast(d) ? 'agora' : `em ${formatDistanceToNowStrict(d, { locale: ptBR })}`;
  return `${CHANNEL_LABEL[nextChannel] ?? nextChannel} ${when}`;
}

interface StageColumnProps {
  stage: Stage;
  negocios: NegocioOptimized[];
  totalValue: number;
  isLoading: boolean;
  totalLeads: number;
  pipelineId: string;
}

/** Recolhimento da coluna persistido por pipeline em localStorage. */
function useCollapsed(pipelineId: string, stageId: string): [boolean, () => void] {
  const key = `kanban:collapsed:${pipelineId}`;
  const read = (): string[] => { try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; } };
  const [collapsed, setCollapsed] = useState<boolean>(() => read().includes(stageId));
  const toggle = () => {
    const cur = new Set(read());
    if (cur.has(stageId)) cur.delete(stageId); else cur.add(stageId);
    try { localStorage.setItem(key, JSON.stringify([...cur])); } catch { /* storage indisponível */ }
    setCollapsed(cur.has(stageId));
  };
  return [collapsed, toggle];
}

const StageColumn = ({
  stage,
  negocios,
  totalValue,
  isLoading,
  totalLeads,
  pipelineId
}: StageColumnProps) => {
  const navigate = useNavigate();
  const [collapsed, toggleCollapsed] = useCollapsed(pipelineId, stage.id);
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
  const { data: cardData = {} } = useEsteiraCardData(leadIds);

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

  const handleLoadMore = () => {
    setDisplayedItems(prev => prev + ITEMS_PER_PAGE);
  };

  // Portal-aware draggable to prevent z-index issues
  const PortalAwareDraggable: React.FC<{
    negocio: NegocioOptimized;
    index: number;
    ariaLabel: string;
    onOpen: () => void;
    children: (args: { provided: DraggableProvided; snapshot: DraggableStateSnapshot }) => React.ReactNode;
  }> = ({ negocio, index, ariaLabel, onOpen, children }) => (
    <Draggable draggableId={negocio.id} index={index}>
      {(provided, snapshot) => {
        const child = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            aria-label={ariaLabel}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onOpen(); } }}
            className={cn("rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40")}
            style={provided.draggableProps.style}
          >
            {children({ provided, snapshot })}
          </div>
        );
        return snapshot.isDragging ? createPortal(child, document.body) : child;
      }}
    </Draggable>
  );

  const share = totalLeads > 0 ? Math.round((negocios.length / totalLeads) * 100) : 0;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggleCollapsed}
        className="w-10 flex-shrink-0 border border-border rounded-xl bg-card flex flex-col items-center py-3 gap-2 hover:border-foreground/20 transition-colors"
        aria-label={`Expandir etapa ${stage.nome} (${negocios.length})`}
        title="Expandir"
      >
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.cor || 'hsl(var(--muted-foreground))' }} />
        <span className="text-[11px] font-semibold tabular-nums text-foreground">{negocios.length}</span>
        <span className="text-[11px] text-muted-foreground [writing-mode:vertical-rl] rotate-180 truncate max-h-[200px]">{stage.nome}</span>
      </button>
    );
  }

  return (
    <div className="w-72 flex-shrink-0 border border-border rounded-xl bg-card flex flex-col h-full overflow-hidden" role="region" aria-label={`Etapa ${stage.nome} — ${negocios.length} negócios`}>
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.cor || 'hsl(var(--muted-foreground))' }} />
          <span className="text-[13px] font-medium text-foreground truncate">{stage.nome}</span>
          <span className="text-[11px] text-muted-foreground tabular-nums flex-shrink-0">{negocios.length}</span>
          {totalLeads > 0 && <span className="text-[10px] text-muted-foreground/60 tabular-nums flex-shrink-0">· {share}%</span>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{formatCurrency(totalValue)}</span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-foreground" onClick={toggleCollapsed} aria-label={`Recolher etapa ${stage.nome}`} title="Recolher">
            <ChevronsLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      {/* Cards area */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "p-2 space-y-1.5 flex-1 overflow-y-auto min-h-0",
              snapshot.isDraggingOver && "bg-primary/[0.03] ring-1 ring-inset ring-primary/30 rounded-lg"
            )}
          >
            {isLoading ? (
              <div className="space-y-1.5">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-background p-3 space-y-2">
                    <div className="flex justify-between"><Skeleton className="h-3.5 w-28 rounded-full" /><Skeleton className="h-3.5 w-14 rounded-full" /></div>
                    <Skeleton className="h-3 w-40 rounded-full" />
                    <Skeleton className="h-1 w-full rounded-full" />
                    <div className="flex gap-1"><Skeleton className="h-4 w-10 rounded-full" /><Skeleton className="h-4 w-8 rounded-full" /></div>
                  </div>
                ))}
              </div>
            ) : negocios.length > 0 ? (
              <>
                {displayedNegocios.map((negocio, index) => {
                  const s = cardData[negocio.id];
                  const unread = negocio.pessoa?.unread_count ?? 0;
                  return (
                    <PortalAwareDraggable
                      key={negocio.id}
                      negocio={negocio}
                      index={index}
                      ariaLabel={`${negocio.pessoa?.name || 'Lead'}, ${formatCurrency(negocio.value || 0)}${s ? `, ${s.sent.total} de ${s.total} toques` : ''}${unread > 0 ? `, ${unread} não lidas` : ''}`}
                      onOpen={() => navigate(`/crm/kanban/${negocio.id}`)}
                    >
                      {({ snapshot }) => (
                        <div
                          onClick={() => navigate(`/crm/kanban/${negocio.id}`)}
                          className={cn(
                            "w-full bg-background border border-border rounded-xl p-3 space-y-2 cursor-pointer transition-all duration-300",
                            "hover:border-foreground/20",
                            snapshot.isDragging && "ring-2 ring-primary/20 z-[9999]",
                            negocio.status === 'lost' && "bg-[#EF4444]/5 border-[#EF4444]/20",
                            unread > 0 && "border-l-2 border-l-[#EF4444]"
                          )}
                        >
                          {(() => {
                            const produto = productFromTitle(negocio.title);
                            const d = daysSince(negocio.created_at);
                            const next = s ? nextTouchText(s.nextAt, s.nextChannel) : null;
                            const pct = s && s.total > 0 ? Math.round((s.sent.total / s.total) * 100) : 0;
                            const tags = (negocio.tags ?? []).map((t) => t.tag?.name).filter(Boolean) as string[];
                            return (
                              <>
                                {/* 1 · quem + quanto */}
                                <div className="flex items-start justify-between gap-2">
                                  <p className="flex-1 min-w-0 text-[13px] font-medium text-foreground truncate leading-tight">
                                    {negocio.pessoa?.name || 'Sem nome'}
                                  </p>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <p className="text-[13px] font-semibold text-foreground tabular-nums whitespace-nowrap">{formatCurrency(negocio.value || 0)}</p>
                                    {negocio.status === 'in_progress' && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-foreground -mr-1" onClick={(e) => e.stopPropagation()} aria-label="Mais ações">
                                            <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-44">
                                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowLostModal(negocio.id); }} className="text-[13px] gap-2 cursor-pointer text-destructive focus:text-destructive">
                                            <XCircle className="h-3.5 w-3.5" strokeWidth={1.5} />Marcar como Perdido
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                  </div>
                                </div>

                                {/* 2 · o quê */}
                                {produto && <p className="text-[11.5px] text-muted-foreground truncate leading-tight">{produto}</p>}

                                {/* 3 · progresso da esteira */}
                                {s && s.total > 0 ? (
                                  <div className="space-y-1 pt-1">
                                    <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
                                      <span className="tabular-nums">{s.sent.total} de {s.total} toques{s.failed > 0 ? ` · ${s.failed} falhou` : ''}</span>
                                      <span className="truncate ml-2">{next ? `próximo: ${next}` : s.pending > 0 ? 'sem data prevista' : s.failed > 0 && s.sent.total === 0 ? 'esteira encerrada com falhas' : s.pending === 0 ? 'esteira concluída' : ''}</span>
                                    </div>
                                    <div className="h-1 w-full rounded-full bg-muted overflow-hidden" aria-hidden>
                                      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[10.5px] text-muted-foreground/60 pt-1">sem toques agendados</p>
                                )}

                                {/* 4 · estado */}
                                <div className="flex items-center gap-1 flex-wrap pt-1.5 border-t border-border/60">
                                  {unread > 0 && <Chip tone="danger" icon={MessageCircle} title="Mensagens não lidas">{unread}</Chip>}
                                  {tags.slice(0, 1).map((t) => <Chip key={t}>{t}</Chip>)}
                                  {tags.length > 1 && <Chip title={tags.slice(1).join(', ')}>+{tags.length - 1}</Chip>}
                                  {d !== null && (
                                    <Chip
                                      className="ml-auto"
                                      icon={Clock}
                                      tone={d >= 7 ? 'danger' : d >= 3 ? 'warning' : 'neutral'}
                                      title={`No funil desde ${format(new Date(negocio.created_at), 'dd/MM/yy', { locale: ptBR })}`}
                                    >
                                      {d === 0 ? 'hoje' : `${d}d`}
                                    </Chip>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </PortalAwareDraggable>
                  );
                })}
                {negocios.length > ITEMS_PER_PAGE && displayedItems < negocios.length && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    className="w-full text-[12px] text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.035] mt-1 h-[30px] rounded-lg"
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
