
import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  LayoutGrid, List, Plus, Calendar, SlidersHorizontal,
  Users, UserCheck, Megaphone, Search, ChevronDown, ChevronRight, X, RotateCcw, ArrowRightLeft
} from "lucide-react";
import { Pipeline, Stage } from "@/hooks/usePipelines";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useUsuarios } from "@/hooks/useUsuarios";
import { useScoreMatrix } from "@/hooks/useScoreMatrix";
import { useUtmValues } from "@/hooks/useUtmValues";
import { useMotivosPerda } from "@/hooks/useMotivosPerda";
import { useKiwifyProductsInPipeline } from "@/hooks/useKiwifyProductsInPipeline";
import { useLeadTags } from "@/hooks/useLeadTags";
import { useWhatsappChannels } from "@/hooks/useWhatsappChannels";
import { productColor } from "@/components/negocios/CursoBadges";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import MoverLeadsEmMassaModal from "@/components/negocios/MoverLeadsEmMassaModal";
import { cn } from "@/lib/utils";

interface NegociosToolbarProps {
  viewMode: "kanban" | "list" | "clientes";
  onViewModeChange: (mode: "kanban" | "list" | "clientes") => void;
  pipelines: Pipeline[];
  stages: Stage[];
  pipelineFilter: string | null;
  stageFilter: string | null;
  statusFilter: string | null;
  dateFilter: string;
  teamFilter: string;
  responsavelFilter: string;
  campanhaFilter?: string;
  sourceFilter?: string;
  mediumFilter?: string;
  termFilter?: string;
  contentFilter?: string;
  searchFilter: string;
  scoreMatrixFilter?: string;
  motivoFilter?: string | null;
  productFilter?: string;
  tagFilter?: string;
  channelFilter?: string;
  onPipelineFilterChange: (value: string | null) => void;
  onStageFilterChange: (value: string | null) => void;
  onStatusFilterChange: (value: string | null) => void;
  onDateFilterChange: (value: string) => void;
  onTeamFilterChange: (value: string) => void;
  onResponsavelFilterChange: (value: string) => void;
  onCampanhaFilterChange?: (value: string) => void;
  onSourceFilterChange?: (value: string) => void;
  onMediumFilterChange?: (value: string) => void;
  onTermFilterChange?: (value: string) => void;
  onContentFilterChange?: (value: string) => void;
  onSearchFilterChange: (value: string) => void;
  onScoreMatrixFilterChange?: (value: string) => void;
  onMotivoFilterChange?: (value: string | null) => void;
  onProductFilterChange?: (value: string) => void;
  onTagFilterChange?: (value: string) => void;
  onChannelFilterChange?: (value: string) => void;
  onClearFilters: () => void;
  onCreateNegocio: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  times?: any[];
  usuarios?: any[];
  currentTenant?: any;
}

const NegociosToolbar = ({
  viewMode,
  onViewModeChange,
  pipelines,
  stages,
  pipelineFilter,
  stageFilter,
  statusFilter,
  dateFilter,
  teamFilter,
  responsavelFilter,
  campanhaFilter = "",
  sourceFilter = "",
  mediumFilter = "",
  termFilter = "",
  contentFilter = "",
  searchFilter,
  scoreMatrixFilter = "",
  motivoFilter = null,
  productFilter = "",
  tagFilter = "",
  channelFilter = "",
  onPipelineFilterChange,
  onStageFilterChange,
  onStatusFilterChange,
  onDateFilterChange,
  onTeamFilterChange,
  onResponsavelFilterChange,
  onCampanhaFilterChange,
  onSourceFilterChange,
  onMediumFilterChange,
  onTermFilterChange,
  onContentFilterChange,
  onSearchFilterChange,
  onScoreMatrixFilterChange,
  onMotivoFilterChange,
  onProductFilterChange,
  onTagFilterChange,
  onChannelFilterChange,
  onClearFilters,
  onCreateNegocio,
  onRefresh,
  isRefreshing = false,
  times = [],
  usuarios = [],
  currentTenant,
}: NegociosToolbarProps) => {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [utmOpen, setUtmOpen] = useState(false);
  const [moverLeadsOpen, setMoverLeadsOpen] = useState(false);

  
  const { isManager, canChangeFilters, currentUserName, currentUserId, userTimes } = useUserPermissions();
  const { data: teamMembers = [] } = useTeamMembers('single-tenant', teamFilter);
  const { data: scoreMatrices = [] } = useScoreMatrix();
  const { data: utmValues } = useUtmValues(pipelineFilter || undefined);
  const { data: kiwifyProductOptions = [] } = useKiwifyProductsInPipeline(pipelineFilter || undefined);
  const { tags: tagOptions = [] } = useLeadTags(true);
  const { data: channelOptions = [] } = useWhatsappChannels();
  const { motivos } = useMotivosPerda();

  const { usuarios: usuariosDoTenant } = useUsuarios();

  const activePipelines = pipelines.filter(p => p.active || p.ativo);
  const stagesDoPipelineAtual = stages.filter(
    (stage) => !pipelineFilter || stage.pipeline_id === pipelineFilter
  );

  const getDateFilterLabel = (value: string) => {
    switch (value) {
      case 'hoje': return 'Hoje';
      case 'semana': return 'Semana atual';
      case 'mes': return 'Mês atual';
      case '3meses': return 'Últimos 3 meses';
      case 'todos': return 'Todo período';
      default: return 'Últimos 3 meses';
    }
  };

  const filteredTimes = isManager ? times : times.filter(time => userTimes.includes(time.id));

  const filteredUsuarios = useMemo(() => {
    let filtered = usuariosDoTenant || [];

    if (teamFilter && teamMembers.length > 0) {
      filtered = teamMembers.map(member => ({
        id: member.id,
        nome: member.nome,
        name: member.nome,
        email: member.email,
        gestor: member.gestor || false,
        is_manager: member.gestor || false,
        ativo: member.ativo !== undefined ? member.ativo : true,
        active: member.ativo !== undefined ? member.ativo : true,
        super_adm: false,
        is_super_admin: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        whatsapp: undefined,
        tenant_id: 'single-tenant',
        auth_user_id: undefined
      }));
    }

    if (!isManager) {
      filtered = filtered.filter((usuario: any) => usuario.id === currentUserId);
    }

    return filtered;
  }, [usuariosDoTenant, teamFilter, teamMembers, isManager, currentUserId, 'single-tenant']);

  const shouldShowResponsavelFilter = times.length > 0 && filteredUsuarios.length > 0;

  const hasUTMData = canChangeFilters && (
    (utmValues?.campaigns?.length || 0) > 0 ||
    (utmValues?.sources?.length || 0) > 0 ||
    (utmValues?.mediums?.length || 0) > 0 ||
    (utmValues?.terms?.length || 0) > 0 ||
    (utmValues?.contents?.length || 0) > 0
  );

  const hasActiveUTM = (campanhaFilter !== '') ||
    (sourceFilter !== '') ||
    (mediumFilter !== '') ||
    (termFilter !== '') ||
    (contentFilter !== '');

  // Count active secondary filters
  const secondaryFilterCount = [
    stageFilter !== null,
    statusFilter !== null && statusFilter !== 'sem-perdidos',
    teamFilter !== '',
    responsavelFilter !== '',
    scoreMatrixFilter !== '',
    productFilter !== '',
    tagFilter !== '',
    channelFilter !== '',
    campanhaFilter !== '',
    sourceFilter !== '',
    mediumFilter !== '',
    termFilter !== '',
    contentFilter !== '',
  ].filter(Boolean).length;

  const clearSecondaryFilters = () => {
    onStageFilterChange(null);
    onStatusFilterChange('sem-perdidos');
    if (onMotivoFilterChange) onMotivoFilterChange(null);
    onTeamFilterChange('');
    onResponsavelFilterChange('');
    if (onScoreMatrixFilterChange) onScoreMatrixFilterChange('');
    if (onProductFilterChange) onProductFilterChange('');
    if (onTagFilterChange) onTagFilterChange('');
    if (onChannelFilterChange) onChannelFilterChange('');
    if (onCampanhaFilterChange) onCampanhaFilterChange('');
    if (onSourceFilterChange) onSourceFilterChange('');
    if (onMediumFilterChange) onMediumFilterChange('');
    if (onTermFilterChange) onTermFilterChange('');
    if (onContentFilterChange) onContentFilterChange('');
  };

  return (
    <div className="bg-background border-b border-border" role="toolbar" aria-label="Barra de ferramentas CRM">
      <div className="flex items-center gap-2 px-4 py-2">
        {/* View Mode Toggle */}
        <div className="flex border border-border rounded-[4px] overflow-hidden h-[30px] flex-shrink-0" role="group" aria-label="Modo de visualização">
          <Button
            variant={viewMode === "kanban" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("kanban")}
            className="border-none h-full px-2.5 rounded-none"
            title="Kanban"
            aria-label="Visualização Kanban"
            aria-pressed={viewMode === "kanban"}
          >
            <LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("list")}
            className="border-none h-full px-2.5 rounded-none"
            title="Lista"
            aria-label="Visualização Lista"
            aria-pressed={viewMode === "list"}
          >
            <List className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Button>
          <Button
            variant={viewMode === "clientes" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("clientes")}
            className="border-none h-full px-2.5 rounded-none"
            title="Clientes"
            aria-label="Visualização Clientes"
            aria-pressed={viewMode === "clientes"}
          >
            <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Button>
        </div>

        {/* New Deal Button */}
        {viewMode !== 'clientes' && (
          <Button
            onClick={onCreateNegocio}
            className="h-[30px] px-3 text-xs gap-1.5 flex-shrink-0 rounded-[4px]"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            Novo Negócio
          </Button>
        )}

        {/* Search */}
        {viewMode !== 'clientes' && (
          <div className="relative flex-1 min-w-[160px] max-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={1.5} />
            <Input
              type="text"
              placeholder="Buscar..."
              value={searchFilter}
              onChange={(e) => onSearchFilterChange(e.target.value)}
              className="pl-8 h-[30px] text-xs border-border"
              aria-label="Buscar negócios"
            />
          </div>
        )}

        {/* Pipeline Filter */}
        {viewMode !== 'clientes' && (
          <Select
            value={pipelineFilter || (activePipelines[0]?.id || "")}
            onValueChange={onPipelineFilterChange}
          >
            <SelectTrigger className="w-40 h-[30px] text-xs border-border flex-shrink-0">
              <SelectValue placeholder="Pipeline" />
            </SelectTrigger>
            <SelectContent>
              {activePipelines.map((pipeline) => (
                <SelectItem key={pipeline.id} value={pipeline.id}>
                  {pipeline.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Date Filter */}
        {viewMode !== 'clientes' && (
          <Select value={dateFilter} onValueChange={onDateFilterChange}>
            <SelectTrigger className="w-44 h-[30px] text-xs border-border flex-shrink-0">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-muted-foreground/50 flex-shrink-0" strokeWidth={1.5} />
              <SelectValue>{getDateFilterLabel(dateFilter)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3meses">Últimos 3 meses</SelectItem>
              <SelectItem value="mes">Mês atual</SelectItem>
              <SelectItem value="semana">Semana atual</SelectItem>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="todos">Todo período</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Secondary Filters Popover */}
        {viewMode !== 'clientes' && <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-[30px] text-xs gap-1.5 border-border flex-shrink-0 rounded-[4px]",
                secondaryFilterCount > 0 && "border-primary/40 text-primary bg-primary/5 hover:bg-primary/10"
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
              Filtros
              {secondaryFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-semibold rounded-[2px] bg-primary text-primary-foreground leading-none">
                  {secondaryFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-4 space-y-4">
            {/* Popover header */}
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-foreground">Filtros</span>
              {secondaryFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSecondaryFilters}
                  className="h-6 px-2 text-[11px] text-muted-foreground/60 hover:text-foreground gap-1"
                >
                  <X className="w-3 h-3" strokeWidth={1.5} />
                  Limpar
                </Button>
              )}
            </div>

            {/* Stage */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Etapa</Label>
              <Select
                value={stageFilter || "all"}
                onValueChange={(value) => onStageFilterChange(value === "all" ? null : value)}
              >
                <SelectTrigger className="h-[30px] text-xs">
                  <SelectValue placeholder="Todas as etapas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as etapas</SelectItem>
                  {stages
                    .filter(stage => !pipelineFilter || stage.pipeline_id === pipelineFilter)
                    .map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Status</Label>
              <Select
                value={statusFilter || "sem-perdidos"}
                onValueChange={(value) => onStatusFilterChange(value)}
              >
                <SelectTrigger className="h-[30px] text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem-perdidos">Exceto Perdido</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ganho">Ganhos</SelectItem>
                  <SelectItem value="em-andamento">Em Andamento</SelectItem>
                  <SelectItem value="perdido">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Motivo de Perda — apenas quando filtrando por perdidos */}
            {statusFilter === 'perdido' && onMotivoFilterChange && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Motivo de Perda</Label>
                <Select
                  value={motivoFilter || "__all__"}
                  onValueChange={(value) => onMotivoFilterChange(value === "__all__" ? null : value)}
                >
                  <SelectTrigger className="h-[30px] text-xs">
                    <SelectValue placeholder="Motivo de perda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os motivos</SelectItem>
                    {motivos.map((motivo) => (
                      <SelectItem key={motivo.id} value={motivo.id}>
                        {motivo.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Team (managers only) */}
            {canChangeFilters && times.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Equipe</Label>
                <Select
                  value={teamFilter || "all"}
                  onValueChange={(value) => {
                    onTeamFilterChange(value === "all" ? "" : value);
                    if (value !== teamFilter) onResponsavelFilterChange("");
                  }}
                >
                  <SelectTrigger className="h-[30px] text-xs">
                    <SelectValue placeholder="Todas as equipes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as equipes</SelectItem>
                    {times.map((time) => (
                      <SelectItem key={time.id} value={time.id}>
                        {time.name || time.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Responsável */}
            {shouldShowResponsavelFilter && canChangeFilters && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Responsável</Label>
                <Select
                  value={responsavelFilter || "all"}
                  onValueChange={(value) => onResponsavelFilterChange(value === "all" ? "" : value)}
                >
                  <SelectTrigger className="h-[30px] text-xs">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {filteredUsuarios.map((usuario) => (
                      <SelectItem key={usuario.id} value={usuario.id}>
                        {usuario.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Score Matrix */}
            {onScoreMatrixFilterChange && canChangeFilters && scoreMatrices.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Score</Label>
                <Select
                  value={scoreMatrixFilter || "all"}
                  onValueChange={(value) => onScoreMatrixFilterChange(value === "all" ? "" : value)}
                >
                  <SelectTrigger className="h-[30px] text-xs">
                    <SelectValue placeholder="Todos os scores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os scores</SelectItem>
                    {scoreMatrices.map((matrix) => (
                      <SelectItem key={matrix.id} value={matrix.id}>
                        Score {matrix.score_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Produto Kiwify */}
            {onProductFilterChange && kiwifyProductOptions.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Produto</Label>
                <Select
                  value={productFilter || "all"}
                  onValueChange={(value) => onProductFilterChange(value === "all" ? "" : value)}
                >
                  <SelectTrigger className="h-[30px] text-xs">
                    <SelectValue placeholder="Todos os produtos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {kiwifyProductOptions.map((p) => (
                      <SelectItem key={p.product_id} value={p.product_id}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className={cn('w-2 h-2 rounded-full shrink-0', productColor(p.product_id).dot)} />
                          {p.product_name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Tag */}
            {onTagFilterChange && tagOptions.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Tag</Label>
                <Select
                  value={tagFilter || "all"}
                  onValueChange={(value) => onTagFilterChange(value === "all" ? "" : value)}
                >
                  <SelectTrigger className="h-[30px] text-xs">
                    <SelectValue placeholder="Todas as tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as tags</SelectItem>
                    {tagOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                          {t.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Canal WhatsApp (Meta/Evolution) */}
            {onChannelFilterChange && channelOptions.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Canal</Label>
                <Select
                  value={channelFilter || "all"}
                  onValueChange={(value) => onChannelFilterChange(value === "all" ? "" : value)}
                >
                  <SelectTrigger className="h-[30px] text-xs">
                    <SelectValue placeholder="Todos os canais" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os canais</SelectItem>
                    {channelOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className={cn('w-2 h-2 rounded-full shrink-0', c.provider === 'evolution' ? 'bg-emerald-500' : 'bg-blue-500')} />
                          {c.label} {c.provider === 'evolution' ? '(não-oficial)' : ''}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* UTM — Avançado (managers only) */}
            {canChangeFilters && (
              <Collapsible open={utmOpen} onOpenChange={setUtmOpen}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-1.5 w-full text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                    {utmOpen
                      ? <ChevronDown className="w-3 h-3" strokeWidth={1.5} />
                      : <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
                    }
                    <Megaphone className="w-3 h-3" strokeWidth={1.5} />
                    UTM
                    {hasActiveUTM && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {onCampanhaFilterChange && (utmValues?.campaigns?.length || 0) > 0 && (
                    <SearchableSelect
                      value={campanhaFilter}
                      onValueChange={onCampanhaFilterChange}
                      options={utmValues?.campaigns || []}
                      placeholder="Campaign"
                      searchPlaceholder="Buscar campaign..."
                      emptyMessage="Nenhuma campaign encontrada"
                      className="w-full"
                    />
                  )}
                  {onSourceFilterChange && (utmValues?.sources?.length || 0) > 0 && (
                    <SearchableSelect
                      value={sourceFilter}
                      onValueChange={onSourceFilterChange}
                      options={utmValues?.sources || []}
                      placeholder="Source"
                      searchPlaceholder="Buscar source..."
                      emptyMessage="Nenhum source encontrado"
                      className="w-full"
                    />
                  )}
                  {onMediumFilterChange && (utmValues?.mediums?.length || 0) > 0 && (
                    <SearchableSelect
                      value={mediumFilter}
                      onValueChange={onMediumFilterChange}
                      options={utmValues?.mediums || []}
                      placeholder="Medium"
                      searchPlaceholder="Buscar medium..."
                      emptyMessage="Nenhum medium encontrado"
                      className="w-full"
                    />
                  )}
                  {onTermFilterChange && (utmValues?.terms?.length || 0) > 0 && (
                    <SearchableSelect
                      value={termFilter}
                      onValueChange={onTermFilterChange}
                      options={utmValues?.terms || []}
                      placeholder="Term"
                      searchPlaceholder="Buscar term..."
                      emptyMessage="Nenhum term encontrado"
                      className="w-full"
                    />
                  )}
                  {onContentFilterChange && (utmValues?.contents?.length || 0) > 0 && (
                    <SearchableSelect
                      value={contentFilter}
                      onValueChange={onContentFilterChange}
                      options={utmValues?.contents || []}
                      placeholder="Content"
                      searchPlaceholder="Buscar content..."
                      emptyMessage="Nenhum content encontrado"
                      className="w-full"
                    />
                  )}
                  {!hasUTMData && (
                    <p className="text-[12px] text-muted-foreground/40">Nenhum dado UTM encontrado</p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
          </PopoverContent>
        </Popover>}

        {/* Mover leads em massa */}
        {viewMode !== 'clientes' && stagesDoPipelineAtual.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMoverLeadsOpen(true)}
            className="h-[30px] w-[30px] p-0 border-border flex-shrink-0 rounded-[4px]"
            title="Mover leads em massa"
            aria-label="Mover leads em massa"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Button>
        )}

        {/* Refresh */}
        {viewMode !== 'clientes' && onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-[30px] w-[30px] p-0 border-border flex-shrink-0 rounded-[4px]"
            title="Atualizar"
            aria-label="Atualizar negócios"
          >
            <RotateCcw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} strokeWidth={1.5} />
          </Button>
        )}
      </div>

      {moverLeadsOpen && (
        <MoverLeadsEmMassaModal
          open={moverLeadsOpen}
          onClose={() => setMoverLeadsOpen(false)}
          stages={stagesDoPipelineAtual}
          defaultFromStageId={stageFilter}
        />
      )}
    </div>
  );
};

export default NegociosToolbar;
