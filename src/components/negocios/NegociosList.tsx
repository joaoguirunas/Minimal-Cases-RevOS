import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal, Building2, Mail, MessageSquare,
  ArrowUpRight, Star, DollarSign, Layers, X,
  MoveRight, Tag, UserCheck, Trash2, Check, XCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NegocioOptimized } from "@/hooks/useNegociosOptimized";
import { Stage, Pipeline } from "@/hooks/usePipelines";
import { cn } from "@/lib/utils";
import { useBulkUpdateNegocios } from "@/hooks/useBulkUpdateNegocios";
import { useBulkDeletarNegocios } from "@/hooks/useBulkDeletarNegocios";
import { useUsuarios } from "@/hooks/useUsuarios";
import { useUpdateNegocio } from "@/hooks/useNegocios";
import MotivoPerdasModal from "./MotivoPerdasModal";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NegociosListProps {
  negocios: NegocioOptimized[];
  stages: Stage[];
  pipelines: Pipeline[];
}

const NegociosList = ({ negocios, stages, pipelines }: NegociosListProps) => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showLostModal, setShowLostModal] = useState<string | null>(null);
  const bulkUpdate = useBulkUpdateNegocios();
  const bulkDelete = useBulkDeletarNegocios();
  const { usuarios = [] } = useUsuarios();
  const updateNegocio = useUpdateNegocio();

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

  const allSelected = negocios.length > 0 && selected.size === negocios.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(negocios.map(n => n.id)));
    }
  };

  const toggleOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleBulkStage = (stageId: string) => {
    bulkUpdate.mutate(
      { ids: [...selected], updates: { leads_stages_id: stageId } },
      {
        onSuccess: () => {
          toast.success(`${selected.size} negócio${selected.size !== 1 ? 's' : ''} movido${selected.size !== 1 ? 's' : ''} de etapa`);
          clearSelection();
        },
        onError: () => toast.error('Erro ao atualizar etapa'),
      }
    );
  };

  const handleBulkStatus = (status: string) => {
    bulkUpdate.mutate(
      { ids: [...selected], updates: { status } },
      {
        onSuccess: () => {
          toast.success(`Status atualizado para ${selected.size} negócio${selected.size !== 1 ? 's' : ''}`);
          clearSelection();
        },
        onError: () => toast.error('Erro ao atualizar status'),
      }
    );
  };

  const handleBulkDelete = () => {
    const ids = [...selected];
    bulkDelete.mutate(ids, {
      onSuccess: () => {
        toast.success(`${ids.length} negócio${ids.length !== 1 ? 's' : ''} excluído${ids.length !== 1 ? 's' : ''}`);
        clearSelection();
        setConfirmDelete(false);
      },
      onError: () => {
        toast.error('Erro ao excluir negócios');
        setConfirmDelete(false);
      },
    });
  };

  const handleBulkResponsavel = (userId: string) => {
    bulkUpdate.mutate(
      { ids: [...selected], updates: { user_id: userId === '__none' ? null : userId } },
      {
        onSuccess: () => {
          toast.success(`Responsável atualizado para ${selected.size} negócio${selected.size !== 1 ? 's' : ''}`);
          clearSelection();
        },
        onError: () => toast.error('Erro ao atualizar responsável'),
      }
    );
  };

  // Helpers
  const formatCurrency = (value?: number) => {
    if (!value) return '—';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStageInfo = (stageId: string) => stages.find(s => s.id === stageId);
  const getPipelineInfo = (pipelineId: string) => pipelines.find(p => p.id === pipelineId);

  const formatPhoneForWhatsApp = (phone?: string) => {
    if (!phone) return null;
    return `https://wa.me/${phone.replace(/\D/g, '')}`;
  };

  const getStatusStyle = (status?: string) => {
    switch (status) {
      case 'won':
        return 'text-[#00D26A] bg-[#00D26A]/10 border-[#00D26A]/20';
      case 'lost':
        return 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20';
      case 'in_progress':
        return 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/20';
      default:
        return 'text-muted-foreground/50 bg-muted border-border';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'won': return 'Ganho';
      case 'lost': return 'Perdido';
      case 'in_progress': return 'Em Andamento';
      default: return 'Em Andamento';
    }
  };

  const getScoreStyle = (score?: number) => {
    if (score == null) return null;
    if (score >= 8) return 'text-[#00D26A] bg-[#00D26A]/10 border-[#00D26A]/20';
    if (score >= 6) return 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20';
    return 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20';
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-auto">

        {/* Bulk action bar — appears when items are selected */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2.5 px-4 py-2 bg-[#B8924B]/5 border-b border-[#B8924B]/15">
            {/* Count */}
            <span className="text-[13px] font-medium text-primary flex-shrink-0">
              {selected.size} selecionado{selected.size !== 1 ? 's' : ''}
            </span>

            <div className="w-px h-4 bg-border/60 mx-0.5" />

            {/* Move stage */}
            <Select onValueChange={handleBulkStage} disabled={bulkUpdate.isPending}>
              <SelectTrigger className="h-7 text-[12px] w-36 border-border gap-1" aria-label="Mover para etapa">
                <MoveRight className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" strokeWidth={1.5} />
                <SelectValue placeholder="Mover etapa" />
              </SelectTrigger>
              <SelectContent>
                {stages.map(s => (
                  <SelectItem key={s.id} value={s.id} className="text-[13px]">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: s.cor || s.color || 'hsl(var(--muted-foreground))' }}
                      />
                      {s.nome || s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Change status */}
            <Select onValueChange={handleBulkStatus} disabled={bulkUpdate.isPending}>
              <SelectTrigger className="h-7 text-[12px] w-36 border-border gap-1" aria-label="Alterar status">
                <Tag className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" strokeWidth={1.5} />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_progress" className="text-[13px]">Em Andamento</SelectItem>
                <SelectItem value="won" className="text-[13px]">Ganho</SelectItem>
                <SelectItem value="lost" className="text-[13px]">Perdido</SelectItem>
              </SelectContent>
            </Select>

            {/* Change responsible */}
            {usuarios.length > 0 && (
              <Select onValueChange={handleBulkResponsavel} disabled={bulkUpdate.isPending}>
                <SelectTrigger className="h-7 text-[12px] w-40 border-border gap-1" aria-label="Alterar responsável">
                  <UserCheck className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" strokeWidth={1.5} />
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none" className="text-[13px] text-muted-foreground">Sem responsável</SelectItem>
                  {usuarios.map(u => (
                    <SelectItem key={u.id} value={u.id} className="text-[13px]">
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Delete */}
            <div className="w-px h-4 bg-border/60 mx-0.5" />
            {!confirmDelete ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                disabled={bulkDelete.isPending}
                className="h-[30px] px-2.5 text-xs gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 flex-shrink-0 rounded-[4px]"
              >
                <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                Deletar
              </Button>
            ) : (
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-[12px] text-destructive font-medium whitespace-nowrap">
                  Excluir {selected.size} negócio{selected.size !== 1 ? 's' : ''}?
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDelete.isPending}
                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                  aria-label="Confirmar exclusão"
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={bulkDelete.isPending}
                  className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-foreground"
                  aria-label="Cancelar exclusão"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                </Button>
              </div>
            )}

            {/* Deselect */}
            {!confirmDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="ml-auto h-7 w-7 p-0 text-muted-foreground/50 hover:text-foreground flex-shrink-0"
                aria-label="Limpar seleção"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </Button>
            )}
          </div>
        )}

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              {/* Select all */}
              <TableHead className="w-10 px-4 h-9">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleAll}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground h-9 px-4">
                Cliente
              </TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground h-9">
                Etapa
              </TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground h-9">
                Valor
              </TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground h-9">
                Status
              </TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground h-9">
                Score
              </TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground h-9">
                Contato
              </TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground h-9">
                Criado em
              </TableHead>
              <TableHead className="w-10 h-9" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {negocios.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3 text-center px-6">
                    <div className="w-10 h-10 rounded-[4px] bg-muted flex items-center justify-center">
                      <Layers className="w-5 h-5 text-muted-foreground/50" strokeWidth={1.5} />
                    </div>
                    <p className="text-[13px] font-medium text-foreground">Nenhum negócio encontrado</p>
                    <p className="text-[12px] text-muted-foreground/60">Ajuste os filtros ou crie um novo negócio</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              negocios.map((negocio, index) => {
                const stage = getStageInfo(negocio.leads_stages_id);
                const pipeline = getPipelineInfo(negocio.leads_pipelines_id);
                const isSelected = selected.has(negocio.id);
                const isLast = index === negocios.length - 1;
                const scoreStyle = getScoreStyle(negocio.pessoa?.score_matrix?.score_number);

                return (
                  <TableRow
                    key={negocio.id}
                    className={cn(
                      "group transition-colors cursor-pointer border-border",
                      isSelected
                        ? "bg-[#B8924B]/5 hover:bg-[#B8924B]/8"
                        : "hover:bg-white/[0.035]",
                      negocio.status === 'lost' && !isSelected && "bg-[#EF4444]/5"
                    )}
                    onClick={() => navigate(`/crm/kanban/${negocio.id}`)}
                  >
                    {/* Checkbox */}
                    <TableCell className="w-10 px-4 py-2.5" onClick={(e) => toggleOne(negocio.id, e)}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => {}}
                        aria-label="Selecionar negócio"
                        className={cn(
                          "transition-opacity",
                          !isSelected && "opacity-0 group-hover:opacity-100"
                        )}
                      />
                    </TableCell>

                    {/* Cliente */}
                    <TableCell className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-semibold text-primary leading-none">
                            {(negocio.pessoa?.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate leading-tight">
                            {negocio.pessoa?.name || 'Sem nome'}
                          </p>
                          {negocio.empresa?.trade_name && (
                            <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mt-0.5 truncate">
                              <Building2 className="w-3 h-3 flex-shrink-0" strokeWidth={1.5} />
                              {negocio.empresa.trade_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Etapa */}
                    <TableCell className="py-2.5">
                      {stage ? (
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: stage.cor || stage.color || 'hsl(var(--muted-foreground))' }}
                          />
                          <span className="text-[13px] text-foreground truncate max-w-[120px]">
                            {stage.nome || stage.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[13px] text-muted-foreground/40">—</span>
                      )}
                      {pipeline && (
                        <p className="text-[11px] text-muted-foreground/40 mt-0.5 truncate max-w-[120px]">
                          {pipeline.nome || pipeline.name}
                        </p>
                      )}
                    </TableCell>

                    {/* Valor */}
                    <TableCell className="py-2.5">
                      <span className="text-[13px] font-semibold text-foreground whitespace-nowrap">
                        {formatCurrency(negocio.value)}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-2.5">
                      <span className={cn(
                        "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] border leading-none whitespace-nowrap",
                        getStatusStyle(negocio.status)
                      )}>
                        {getStatusLabel(negocio.status)}
                      </span>
                    </TableCell>

                    {/* Score */}
                    <TableCell className="py-2.5">
                      {negocio.pessoa?.score_matrix?.name && scoreStyle ? (
                        <span className={cn(
                          "inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] border leading-none",
                          scoreStyle
                        )}>
                          <Star className="w-2.5 h-2.5" strokeWidth={1.5} />
                          {negocio.pessoa.score_matrix.name}
                        </span>
                      ) : (
                        <span className="text-[13px] text-muted-foreground/40">—</span>
                      )}
                    </TableCell>

                    {/* Contato */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        {negocio.pessoa?.whatsapp && (
                          <a
                            href={formatPhoneForWhatsApp(negocio.pessoa.whatsapp) || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="w-6 h-6 rounded-[4px] bg-[#00D26A]/10 text-[#00D26A] hover:bg-[#00D26A]/20 flex items-center justify-center transition-all duration-300"
                            title={negocio.pessoa.whatsapp}
                          >
                            <MessageSquare className="w-3 h-3" strokeWidth={1.5} />
                          </a>
                        )}
                        {negocio.pessoa?.email && (
                          <a
                            href={`mailto:${negocio.pessoa.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-6 h-6 rounded-[4px] bg-[#3B82F6]/10 text-[#3B82F6] hover:bg-[#3B82F6]/20 flex items-center justify-center transition-all duration-300"
                            title={negocio.pessoa.email}
                          >
                            <Mail className="w-3 h-3" strokeWidth={1.5} />
                          </a>
                        )}
                        {!negocio.pessoa?.whatsapp && !negocio.pessoa?.email && (
                          <span className="text-[13px] text-muted-foreground/40">—</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Criado em */}
                    <TableCell className="py-2.5">
                      <p className="text-[13px] text-foreground/70 whitespace-nowrap">
                        {format(new Date(negocio.created_at), 'dd/MM/yy', { locale: ptBR })}
                      </p>
                      <p className="text-[11px] text-muted-foreground/40">
                        {format(new Date(negocio.created_at), 'HH:mm', { locale: ptBR })}
                      </p>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-2.5 pr-3 w-10" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Mais ações"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/crm/kanban/${negocio.id}`);
                            }}
                            className="text-[13px] gap-2 cursor-pointer"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                            Ver detalhes
                          </DropdownMenuItem>
                          {negocio.pessoa?.whatsapp && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(formatPhoneForWhatsApp(negocio.pessoa?.whatsapp) || '', '_blank');
                              }}
                              className="text-[13px] gap-2 cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />
                              Abrir WhatsApp
                            </DropdownMenuItem>
                          )}
                          {negocio.pessoa?.email && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `mailto:${negocio.pessoa?.email}`;
                              }}
                              className="text-[13px] gap-2 cursor-pointer"
                            >
                              <Mail className="w-3.5 h-3.5" strokeWidth={1.5} />
                              Enviar email
                            </DropdownMenuItem>
                          )}
                          {negocio.status === 'in_progress' && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowLostModal(negocio.id);
                              }}
                              className="text-[13px] gap-2 cursor-pointer text-destructive focus:text-destructive"
                            >
                              <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                              Marcar como Perdido
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Footer summary */}
        {negocios.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-[12px] text-muted-foreground/50">
              {negocios.length} negócio{negocios.length !== 1 ? 's' : ''}
              {selected.size > 0 && (
                <span className="text-primary ml-1">· {selected.size} selecionado{selected.size !== 1 ? 's' : ''}</span>
              )}
            </span>
            <span className="text-[12px] font-medium text-muted-foreground/60">
              Total:{' '}
              <span className="text-foreground">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(
                  negocios.reduce((sum, n) => sum + (n.value || 0), 0)
                )}
              </span>
            </span>
          </div>
        )}
      </div>

      <MotivoPerdasModal
        isOpen={!!showLostModal}
        onClose={() => setShowLostModal(null)}
        onConfirm={handleConfirmLost}
        isLoading={updateNegocio.isPending}
      />
    </div>
  );
};

export default NegociosList;
