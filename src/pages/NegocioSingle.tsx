import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  ArrowLeft, User, Mail, Phone, Calendar, DollarSign, Edit2, Check, X,
  Trophy, XCircle, RotateCcw, Users, UserCheck, MessageSquare, FileText,
  Plus, TrendingUp, Clock, Target, UserCircle, Brain, AlertTriangle,
  Settings, Building2, RefreshCw, ChevronsUpDown, Trash2, Flame, Star, GitBranch,
  Layers
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AgentFlowViewer } from "@/components/agentes-ia/AgentFlowViewer";
import { useDeleteLead } from "@/hooks/useLeads";
import { ConfirmarExclusaoModal } from "@/components/modals/ConfirmarExclusaoModal";
import { useNegocio, useUpdateNegocio, useOtherActiveLeads, useAddLeadToPipeline } from "@/hooks/useNegocios";
import { usePipelines } from "@/hooks/usePipelines";
import { useTimesWithMethods, useUsuariosTimes, Usuario } from "@/hooks/useTimes";
import { useUsuarios } from "@/hooks/useUsuarios";
import { useEstatisticasMensagens } from "@/hooks/useEstatisticasMensagens";
import { useMotivosPerda } from "@/hooks/useMotivosPerda";
import { useUpdatePessoa } from "@/hooks/usePessoasReal";
import { useCompanies } from "@/hooks/useCompanies";
import { toast } from "sonner";
import EditableField from "@/components/common/EditableField";
import { NegocioScoreSection } from "@/components/negocios/NegocioScoreSection";
import { AtribuirTimeResponsavel } from "@/components/conversas/AtribuirTimeResponsavel";
import NegocioConversa from "@/components/negocios/NegocioConversa";
import ConversaErrorBoundary from "@/components/negocios/conversa/ConversaErrorBoundary";
import NegocioArquivos from "@/components/negocios/NegocioArquivos";
import NegocioEsteira from "@/components/negocios/NegocioEsteira";
import { ShoppingCart } from "lucide-react";
import NegocioNotas from "@/components/negocios/NegocioNotas";
import NegocioSidebar from "@/components/negocios/NegocioSidebar";
import { useNavigation } from "@/contexts/NavigationContext";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import MotivoPerdasModal from "@/components/negocios/MotivoPerdasModal";
import CamposExtrasSection from "@/components/negocios/CamposExtrasSection";
import { ExtraFieldsCard } from "@/components/pessoas/ExtraFieldsCard";

const NegocioSingle = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setNavigationState, clearNavigationState } = useNavigation();

  const { data: negocio, isLoading, error, isError } = useNegocio(id || "");
  const { pipelines, stages } = usePipelines();
  const { times } = useTimesWithMethods();
  const { usuarios } = useUsuarios();
  const updateNegocio = useUpdateNegocio();
  const { data: estatisticas } = useEstatisticasMensagens(negocio?.people_id);
  const { usuariosTimes } = useUsuariosTimes();
  const { motivos } = useMotivosPerda();
  const atualizarPessoa = useUpdatePessoa();

  // NOTA: guard client-side por user_id===currentUserId foi removido daqui —
  // ficou redundante e MAIS restritivo que o modelo real de acesso desde que
  // a visibilidade virou por pipeline-via-equipe (RLS users_read_own_leads
  // já cobre isso no banco). Leads sem user_id (a maioria) faziam esse guard
  // barrar TODO acesso de 'comercial' com um `navigate(..., {replace:true})`
  // disparando a cada clique em lead — corrompia o histórico do navegador e
  // deixava a navegação presa em loop. Se o RLS já deixou `negocio` chegar
  // aqui, o acesso é legítimo; não precisa reconferir no client.

  const { data: companies = [], isLoading: isLoadingCompanies } = useCompanies();

  const deleteLead = useDeleteLead();
  const queryClient = useQueryClient();

  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [editValue, setEditValue] = useState<string>("");
  const [selectedTimeId, setSelectedTimeId] = useState<string>("");
  const [showMotivoPerdasModal, setShowMotivoPerdasModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [addPipelinePopoverOpen, setAddPipelinePopoverOpen] = useState(false);

  const { data: otherActiveLeads = [] } = useOtherActiveLeads(negocio?.people_id, negocio?.id);
  const addLeadToPipeline = useAddLeadToPipeline();

  const filteredUsuarios = selectedTimeId
    ? usuariosTimes
        .filter(ut => ut.time_id === selectedTimeId)
        .map(ut => ut.usuario)
        .filter(Boolean) as Usuario[]
    : [];

  useEffect(() => {
    if (negocio) {
      setSelectedStageId(negocio.leads_stages_id);
      setEditValue(negocio.value?.toString() || '0');
      setSelectedTimeId(negocio.teams_id || '');
    }
  }, [negocio]);

  useEffect(() => {
    if (negocio) {
      const displayName = negocio.pessoa?.name || 'Cliente';
      document.title = `${displayName} — GrowthSales CRM`;
      setNavigationState({
        showBackButton: true,
        leadName: displayName,
        pipelineName: pipelines.find(p => p.id === negocio.pipeline_id)?.nome || 'Vendas',
        onBack: () => navigate(-1)
      });
    }
  }, [negocio, pipelines, navigate, setNavigationState]);

  useEffect(() => {
    return () => { clearNavigationState(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatPerfilDisc = (disc?: string) => {
    const perfilMap: { [key: string]: string } = {
      'D': 'Dominance', 'I': 'Influence', 'S': 'Steadiness', 'C': 'Compliance'
    };
    return disc ? perfilMap[disc] || disc : 'Não informado';
  };

  const getMotivoPerda = () => {
    if (!negocio?.motivo_perda_id && !negocio?.motivo_perda) return null;
    let motivoTexto = '';
    if (negocio.motivo_perda_id) {
      const motivoEncontrado = motivos.find(m => m.id === negocio.motivo_perda_id);
      if (motivoEncontrado) motivoTexto = motivoEncontrado.name;
    }
    if (!motivoTexto && negocio.motivo_perda) motivoTexto = negocio.motivo_perda;
    return motivoTexto;
  };

  const getMotivoComObservacoes = () => {
    const motivo = getMotivoPerda();
    if (!motivo) return null;
    let textoCompleto = motivo;
    if (negocio?.motivo_perda && negocio.motivo_perda_id) {
      const motivoEncontrado = motivos.find(m => m.id === negocio.motivo_perda_id);
      if (motivoEncontrado && negocio.motivo_perda !== motivoEncontrado.nome) {
        textoCompleto += ` - ${negocio.motivo_perda}`;
      }
    }
    if (negocio?.pessoa?.observacoes && negocio.status === 'lost') {
      textoCompleto += ` (${negocio.pessoa.observacoes})`;
    }
    return textoCompleto;
  };

  const handleStageClick = async (newStageId: string) => {
    if (newStageId === selectedStageId) return;
    try {
      await updateNegocio.mutateAsync({ id: id!, leads_stages_id: newStageId });
      setSelectedStageId(newStageId);
      toast.success("Etapa atualizada!");
    } catch (error) {
      toast.error("Erro ao atualizar etapa.");
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === 'lost') { setShowMotivoPerdasModal(true); return; }
    try {
      await updateNegocio.mutateAsync({ id: id!, status: newStatus });
      toast.success("Status atualizado!");
    } catch (error) {
      toast.error("Erro ao atualizar status.");
    }
  };

  const handleMotivoPerdasConfirm = async (motivoId: string, motivoTexto?: string) => {
    try {
      await updateNegocio.mutateAsync({
        id: id!, status: 'lost',
        leads_loss_reasons_id: motivoId, loss_reason: motivoTexto
      });
      setShowMotivoPerdasModal(false);
      toast.success("Negócio marcado como perdido.");
    } catch (error) {
      toast.error("Erro ao marcar como perdido.");
    }
  };

  const handleValueSave = async () => {
    try {
      await updateNegocio.mutateAsync({ id: id!, value: parseFloat(editValue) || 0 });
      setIsEditingValue(false);
      toast.success("Valor atualizado!");
    } catch (error) {
      toast.error("Erro ao atualizar valor.");
    }
  };

  const handleResponsavelChange = async (newResponsavel: string) => {
    try {
      await updateNegocio.mutateAsync({ id: id!, user_id: newResponsavel });
      toast.success("Responsável atualizado!");
    } catch (error) {
      toast.error("Erro ao atualizar responsável.");
    }
  };

  const handleTimeChange = async (newTimeId: string) => {
    try {
      const currentResponsavel = negocio?.user_id;
      const isResponsavelInNewTeam = currentResponsavel &&
        filteredUsuarios.find(u => u.id === currentResponsavel);
      const updateData: any = { id: id!, teams_id: newTimeId };
      if (currentResponsavel && !isResponsavelInNewTeam) updateData.user_id = null;
      await updateNegocio.mutateAsync(updateData);
      setSelectedTimeId(newTimeId);
      toast.success("Equipe atualizada!");
    } catch (error) {
      toast.error("Erro ao atualizar equipe.");
    }
  };

  const handleValueCancel = () => {
    setEditValue(negocio?.value?.toString() || '0');
    setIsEditingValue(false);
  };

  const handleRefresh = async () => {
    if (!id) return;
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) && (
            queryKey.includes('negocio') || queryKey.includes('negocios') ||
            queryKey.includes('leads') || queryKey.includes('pipelines') ||
            queryKey.includes('stages') || queryKey.includes('conversations') ||
            queryKey.includes('messages') || queryKey.includes('empresas') ||
            queryKey.includes('pessoas') || queryKey.includes('negocio-notas') ||
            queryKey.includes('agendamentos-simple') || queryKey.includes(id)
          );
        }
      });
      toast.success('Dados atualizados!');
    } catch (error) {
      toast.error('Erro ao atualizar dados');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePipelineChange = async (newPipelineId: string) => {
    if (!id || newPipelineId === negocio?.pipeline_id) return;
    const newPipelineStages = stages
      .filter(s => s.pipeline_id === newPipelineId)
      .sort((a, b) => a.ordem - b.ordem);
    const firstStage = newPipelineStages[0];
    try {
      await updateNegocio.mutateAsync({
        id, leads_pipelines_id: newPipelineId,
        leads_stages_id: firstStage?.id
      });
      setSelectedStageId(firstStage?.id || '');
      toast.success('Pipeline atualizado!');
    } catch (error) {
      toast.error('Erro ao atualizar pipeline');
    }
  };

  const handleAddToPipeline = async (targetPipelineId: string) => {
    if (!negocio?.id) return;
    try {
      const result = await addLeadToPipeline.mutateAsync({ leadId: negocio.id, targetPipelineId });
      toast.success(`Lead adicionado também ao pipeline "${result.pipeline_name}"`);
      setAddPipelinePopoverOpen(false);
    } catch (error) {
      toast.error('Erro ao adicionar a outro pipeline: ' + (error as Error).message);
    }
  };

  const formatCurrency = (value?: number) => {
    if (!value) return 'R$ 0';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  const handleUpdatePessoa = async (field: string, value: any) => {
    if (!negocio?.pessoa) return;
    const fieldMap: Record<string, string> = {
      'nome': 'name', 'renda': 'income', 'momento': 'moment',
      'objetivo': 'goal', 'disc': 'disc_profile'
    };
    const mappedField = fieldMap[field] || field;
    try {
      await atualizarPessoa.mutateAsync({ id: negocio.pessoa.id, [mappedField]: value });
      toast.success('Informação atualizada!');
    } catch (error) {
      toast.error('Erro ao atualizar informação');
    }
  };

  const validateWhatsApp = (value: string): string | null => {
    if (!value) return null;
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(value) ? null : "Formato de WhatsApp inválido";
  };

  const validateEmail = (value: string): string | null => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : "Formato de e-mail inválido";
  };

  const validateScore = (value: string): string | null => {
    if (!value) return null;
    const score = parseInt(value);
    return (isNaN(score) || score < 1 || score > 100) ? "Score deve ser entre 1 e 100" : null;
  };

  // --- State screens ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <div className="text-center space-y-2">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[12px] text-muted-foreground/60">Carregando negócio...</p>
        </div>
      </div>
    );
  }

  if (isError || error || !negocio) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <div className="text-center space-y-3">
          <p className="text-[13px] font-medium text-foreground">
            {!negocio ? 'Negócio não encontrado' : 'Erro ao carregar negócio'}
          </p>
          <p className="text-[12px] text-muted-foreground/60">
            {error?.message || 'O negócio solicitado não existe ou você não tem permissão.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            {isError && (
              <Button size="sm" onClick={() => window.location.reload()} className="h-[30px] text-xs rounded-lg">
                Tentar novamente
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => navigate(-1)} className="h-[30px] text-xs rounded-lg gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              Voltar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentPipeline = pipelines.find(p => p.id === negocio.pipeline_id);
  const filteredStages = stages.filter(stage => stage.pipeline_id === negocio.pipeline_id);
  const currentStage = stages.find(stage => stage.id === selectedStageId);

  const showGanharButton = negocio.status === 'in_progress';
  const showPerderButton = negocio.status === 'in_progress';
  const showReabrirButton = negocio.status === 'won' || negocio.status === 'lost';

  const getStatusStyle = () => {
    switch (negocio.status) {
      case 'won': return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 border-emerald-200/30';
      case 'lost': return 'text-red-600 dark:text-red-400 bg-red-500/8 border-red-200/30';
      default: return 'text-[#7A5C24] dark:text-[#D4B071] bg-[#B8924B]/8 border-[#B8924B]/25';
    }
  };

  const getStatusLabel = () => {
    switch (negocio.status) {
      case 'won': return 'Ganho';
      case 'lost': return 'Perdido';
      default: return 'Em Andamento';
    }
  };

  return (
    <TooltipProvider>
      <div className="h-[calc(100vh-72px)] flex flex-col bg-background overflow-hidden">

        {/* ── Compact header ── */}
        <div className="flex-none border-b border-border bg-card px-5 pt-3 pb-0">
          <div className="flex items-center justify-between gap-4 pb-3">
            {/* Left: pipeline + status + title */}
            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
              <div className="flex-shrink-0">
                <Select value={negocio.pipeline_id} onValueChange={handlePipelineChange}>
                  <SelectTrigger className="h-[30px] w-auto text-[12px] bg-white/[0.04] border-white/[0.08] gap-1.5 pl-2.5 pr-2 rounded-lg">
                    <SelectValue>{currentPipeline?.nome || 'Pipeline'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.filter(p => p.ativo || p.active).map(pipeline => (
                      <SelectItem key={pipeline.id} value={pipeline.id} className="text-[13px]">
                        {pipeline.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {otherActiveLeads.length > 0 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {otherActiveLeads.map(l => {
                    const p = pipelines.find(p => p.id === l.leads_pipelines_id);
                    return (
                      <Tooltip key={l.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => navigate(`/crm/kanban/${l.id}`)}
                            className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none text-violet-600 dark:text-violet-400 bg-violet-500/8 border-violet-200/30 hover:bg-violet-500/15 transition-colors"
                          >
                            <Layers className="w-2.5 h-2.5" strokeWidth={2} />
                            {p?.nome || 'outro pipeline'}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          Este lead também está ativo aqui — clique pra abrir
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              )}

              <Popover open={addPipelinePopoverOpen} onOpenChange={setAddPipelinePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-foreground rounded-lg flex-shrink-0"
                    title="Adicionar a outro pipeline"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar pipeline..." className="text-[13px]" />
                    <CommandList>
                      <CommandEmpty className="text-[12px] py-3 text-center text-muted-foreground/60">
                        Nenhum pipeline disponível
                      </CommandEmpty>
                      <CommandGroup>
                        {pipelines
                          .filter(p => (p.ativo || p.active))
                          .filter(p => p.id !== negocio.pipeline_id)
                          .filter(p => !otherActiveLeads.some(l => l.leads_pipelines_id === p.id))
                          .map(p => (
                            <CommandItem
                              key={p.id}
                              value={p.nome}
                              onSelect={() => handleAddToPipeline(p.id)}
                              disabled={addLeadToPipeline.isPending}
                              className="text-[13px] cursor-pointer"
                            >
                              {p.nome}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <span className={cn(
                "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none flex-shrink-0",
                getStatusStyle()
              )}>
                {getStatusLabel()}
              </span>

              <EditableField
                label=""
                value={negocio.titulo}
                type="text"
                onSave={async (value) => {
                  await updateNegocio.mutateAsync({ id: id!, titulo: value });
                  toast.success("Título atualizado!");
                }}
                icon={<Target className="w-3.5 h-3.5 text-muted-foreground/50" strokeWidth={1.5} />}
                isLoading={updateNegocio.isPending}
                placeholder="Adicionar título..."
                className="text-[13px] text-foreground font-medium border-0 bg-transparent p-0 h-auto max-w-[220px] min-w-0"
              />

              {/* Temperatura & Fechamento — lado a lado */}
              <div className="flex items-center gap-3 rounded-md bg-white/[0.03] border border-white/[0.06] px-2.5 py-1.5 ml-1 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground/60">Temperatura</span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(level => (
                      <button key={level} type="button"
                        onClick={() => updateNegocio.mutateAsync({ id: id!, pre_sale_temperature: negocio.pre_sale_temperature === level ? null : level })}
                        className="p-0.5 transition-transform hover:scale-110"
                        title={`${level}/5`}>
                        <Flame className={cn("w-3.5 h-3.5 transition-colors",
                          level <= (negocio.pre_sale_temperature || 0) ? "text-orange-500 fill-orange-500" : "text-muted-foreground/20"
                        )} strokeWidth={1.5} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="w-px h-4 bg-border/40" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground/60">Fechamento</span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(level => (
                      <button key={level} type="button"
                        onClick={() => updateNegocio.mutateAsync({ id: id!, close_probability: negocio.close_probability === level ? null : level })}
                        className="p-0.5 transition-transform hover:scale-110"
                        title={`${level * 20}%`}>
                        <Star className={cn("w-3.5 h-3.5 transition-colors",
                          level <= (negocio.close_probability || 0) ? "text-amber-500 fill-amber-500" : "text-muted-foreground/20"
                        )} strokeWidth={1.5} />
                      </button>
                    ))}
                  </div>
                  {negocio.close_probability ? (
                    <span className="text-[10px] font-medium text-muted-foreground/40">{negocio.close_probability * 20}%</span>
                  ) : null}
                </div>
              </div>

              {negocio.status === 'lost' && getMotivoPerda() && (
                <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none text-red-600 dark:text-red-400 bg-red-500/8 border-red-200/30 flex-shrink-0 max-w-[200px] truncate" title={`Motivo: ${getMotivoPerda()}`}>
                  Motivo: {getMotivoPerda()}
                </span>
              )}
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1.5 flex-none">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-foreground rounded-lg"
                title="Atualizar dados"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} strokeWidth={1.5} />
              </Button>
              {showGanharButton && (
                <Button
                  onClick={() => handleStatusChange('won')}
                  size="sm"
                  className="h-[30px] px-3 text-xs gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Trophy className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Ganhar
                </Button>
              )}
              {showPerderButton && (
                <Button
                  onClick={() => handleStatusChange('lost')}
                  variant="destructive"
                  size="sm"
                  className="h-[30px] px-3 text-xs gap-1.5 rounded-lg"
                >
                  <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Perder
                </Button>
              )}
              {showReabrirButton && (
                <Button
                  onClick={() => handleStatusChange('in_progress')}
                  variant="outline"
                  size="sm"
                  className="h-[30px] px-3 text-xs gap-1.5 rounded-lg"
                >
                  <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Reabrir
                </Button>
              )}
              <Button
                onClick={() => setShowDeleteModal(true)}
                variant="ghost"
                size="sm"
                className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-destructive rounded-lg"
                title="Excluir negócio"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              </Button>
            </div>
          </div>

          {/* Stage progress bar */}
          <div className="pb-3">
            <div className="flex gap-0.5">
              {filteredStages.map((stage, index) => {
                const isActive = stage.id === selectedStageId;
                const isPassed = index < filteredStages.findIndex(s => s.id === selectedStageId);
                return (
                  <Tooltip key={stage.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleStageClick(stage.id)}
                        className={cn(
                          "flex-1 transition-all duration-200 first:rounded-l last:rounded-r",
                          isPassed ? 'h-3 bg-emerald-500' :
                          isActive ? 'h-3.5 bg-primary' :
                          'h-3 bg-muted-foreground/20 hover:bg-muted-foreground/30'
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {stage.nome}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            <p className="text-[10px] text-center text-muted-foreground/50 mt-1">
              <span className="font-medium text-foreground/70">
                {filteredStages.find(s => s.id === selectedStageId)?.nome || 'Sem etapa'}
              </span>
              {' '}· {filteredStages.findIndex(s => s.id === selectedStageId) + 1}/{filteredStages.length}
            </p>
          </div>
        </div>

        {/* ── Main layout ── */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* Sidebar */}
          <NegocioSidebar
            negocio={negocio}
            pipelines={pipelines}
            stages={stages}
            companies={companies}
            times={times}
            onUpdateNegocio={async (data) => {
              await updateNegocio.mutateAsync({ id: id!, ...data });
            }}
            onUpdatePessoa={handleUpdatePessoa}
            isLoadingCompanies={isLoadingCompanies}
            isPendingNegocio={updateNegocio.isPending}
            isPendingPessoa={atualizarPessoa.isPending}
          />

          {/* Content area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Tabs defaultValue="conversas" className="flex-1 flex flex-col overflow-hidden">

              {/* Tab bar */}
              <div className="flex-none border-b border-border bg-card dark:bg-zinc-950">
                <TabsList className="flex justify-start bg-transparent p-0 h-[45px] gap-0">
                  {[
                    { value: 'conversas', icon: MessageSquare, label: 'Conversas' },
                    { value: 'esteira', icon: ShoppingCart, label: 'Esteira' },
                    { value: 'informacoes', icon: UserCheck, label: 'Informações' },
                    { value: 'arquivos', icon: FileText, label: 'Notas' },
                    ...(user?.profile?.super_adm === true
                      ? [{ value: 'fluxo', icon: GitBranch, label: 'Fluxo IA' }]
                      : []),
                  ].map(tab => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={cn(
                        "w-[160px] flex items-center justify-center gap-1.5 text-[13px] font-normal text-muted-foreground/60 h-[45px]",
                        "border-b-2 border-transparent rounded-none transition-colors",
                        "data-[state=active]:text-foreground data-[state=active]:border-primary data-[state=active]:font-medium",
                        "hover:text-foreground/80 bg-transparent"
                      )}
                    >
                      <tab.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-auto">

                {/* Conversas */}
                <TabsContent value="conversas" className="h-full mt-0">
                  <ConversaErrorBoundary>
                    <NegocioConversa negocioId={id!} />
                  </ConversaErrorBoundary>
                </TabsContent>

                {/* Esteira: carrinho + timeline de toques */}
                <TabsContent value="esteira" className="mt-0 p-5 overflow-auto">
                  <NegocioEsteira leadId={id!} peopleId={negocio?.pessoa?.id ?? negocio?.people_id} />
                </TabsContent>

                {/* Informações */}
                <TabsContent value="informacoes" className="mt-0 p-5 overflow-auto">
                  <div className="space-y-6 max-w-4xl">

                    {/* Métricas */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Informações gerais</p>
                      <div className="border border-border rounded-md overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                          <span className="text-[13px] text-muted-foreground/70">Follow-ups enviados</span>
                          <span className="text-[13px] font-medium text-foreground">{negocio.tentativas_followup || 0}</span>
                        </div>
                        <div className="flex items-center justify-between px-5 py-3">
                          <span className="text-[13px] text-muted-foreground/70">Criado em</span>
                          <span className="text-[13px] font-medium text-foreground">
                            {new Date(negocio.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* UTM & Marketing */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Campanhas e Marketing</p>
                        {(negocio.utm_campaign || negocio.utm_source || negocio.gclid || negocio.fbclid || negocio.fb_lead_id) && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 border-emerald-200/30">
                            <TrendingUp className="w-2.5 h-2.5" strokeWidth={1.5} />
                            Lead de campanha
                          </span>
                        )}
                      </div>
                      <div className="border border-border rounded-md overflow-hidden">
                        <div className="px-5 py-2 bg-muted border-b border-border">
                          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/40">UTM Parameters</p>
                        </div>
                        {[
                          { label: 'Source', value: negocio.utm_source },
                          { label: 'Medium', value: negocio.utm_medium },
                          { label: 'Campaign', value: negocio.utm_campaign },
                          { label: 'Term', value: negocio.utm_term },
                          { label: 'Content', value: negocio.utm_content },
                        ].map((row, i, arr) => (
                          <div key={row.label} className={cn(
                            "flex items-center justify-between px-5 py-2.5",
                            i < arr.length - 1 && "border-b border-border"
                          )}>
                            <span className="text-[12px] text-muted-foreground/60">{row.label}</span>
                            <span className="text-[12px] font-medium text-foreground/80">{row.value || '—'}</span>
                          </div>
                        ))}
                        <div className="px-5 py-2 bg-muted border-t border-border border-b border-border">
                          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/40">Click Identifiers</p>
                        </div>
                        {[
                          { label: 'GCLID (Google)', value: negocio.gclid },
                          { label: 'FBCLID (Facebook)', value: negocio.fbclid },
                          { label: 'FB Lead ID', value: negocio.fb_lead_id },
                        ].map((row, i, arr) => (
                          <div key={row.label} className={cn(
                            "flex items-center justify-between px-5 py-2.5",
                            i < arr.length - 1 && "border-b border-border"
                          )}>
                            <span className="text-[12px] text-muted-foreground/60">{row.label}</span>
                            {row.value ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-[11px] font-mono text-foreground/70 truncate max-w-[200px] cursor-help">{row.value}</span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs break-all font-mono text-[10px]">{row.value}</TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-[12px] text-muted-foreground/30">—</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Dados do Lead — Objetivo & Momento (preenchidos pelo agente IA) */}
                    {(negocio.pessoa?.goal || (negocio.pessoa as any)?.objetivo || negocio.pessoa?.moment || (negocio.pessoa as any)?.momento) && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Dados do Lead</p>
                        <div className="border border-border rounded-md overflow-hidden">
                          <div className="flex items-start justify-between px-5 py-2.5 border-b border-border gap-4">
                            <span className="text-[12px] text-muted-foreground/60 shrink-0">Objetivo</span>
                            <span className="text-[12px] font-medium text-foreground/80 text-right">
                              {negocio.pessoa?.goal || (negocio.pessoa as any)?.objetivo || '—'}
                            </span>
                          </div>
                          <div className="flex items-start justify-between px-5 py-2.5 gap-4">
                            <span className="text-[12px] text-muted-foreground/60 shrink-0">Momento</span>
                            <span className="text-[12px] font-medium text-foreground/80 text-right">
                              {negocio.pessoa?.moment || (negocio.pessoa as any)?.momento || '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Campos personalizados — Qualificação */}
                    {negocio?.leads_pipelines_id && (
                      <CamposExtrasSection
                        leadId={id!}
                        pipelineId={negocio.leads_pipelines_id}
                        category="qualificacao"
                      />
                    )}

                    {/* Qualificação IA — campos da pessoa */}
                    {negocio?.people_id && (
                      <ExtraFieldsCard personId={negocio.people_id} />
                    )}

                    {/* Campos personalizados — Outros */}
                    {negocio?.leads_pipelines_id && (
                      <CamposExtrasSection
                        leadId={id!}
                        pipelineId={negocio.leads_pipelines_id}
                        category="outros"
                      />
                    )}

                    {/* Score */}
                    {negocio.pessoa && (
                      <NegocioScoreSection
                        pessoaId={negocio.pessoa.id}
                        scoreMatrixId={negocio.pessoa.score_matrix_id}
                        score={negocio.pessoa.score}
                      />
                    )}
                  </div>
                </TabsContent>

                {/* Notas & Arquivos */}
                <TabsContent value="arquivos" className="mt-0 p-5 overflow-auto">
                  <div className="space-y-6 max-w-4xl">
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Notas</p>
                      <NegocioNotas negocioId={id!} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Documentos e Arquivos</p>
                      <NegocioArquivos negocioId={id!} />
                    </div>
                  </div>
                </TabsContent>


                {/* Fluxo IA — apenas super admins */}
                {user?.profile?.super_adm === true && (
                  <TabsContent value="fluxo" className="mt-0 h-[calc(100vh-180px)]">
                    <AgentFlowViewer peopleId={negocio.people_id ?? null} />
                  </TabsContent>
                )}
              </div>
            </Tabs>
          </div>
        </div>
      </div>

      <MotivoPerdasModal
        isOpen={showMotivoPerdasModal}
        onClose={() => setShowMotivoPerdasModal(false)}
        onConfirm={handleMotivoPerdasConfirm}
        isLoading={updateNegocio.isPending}
      />

      <ConfirmarExclusaoModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        onConfirm={async () => {
          try {
            await deleteLead.mutateAsync(id!);
            navigate(-1);
          } catch (error) {
            // Error handled in hook
          }
        }}
        title="Excluir Negócio"
        description={`Tem certeza que deseja excluir "${negocio.titulo || negocio.pessoa?.name || 'Sem título'}"? Esta ação não pode ser desfeita.`}
        isLoading={deleteLead.isPending}
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </TooltipProvider>
  );
};

export default NegocioSingle;
