
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  LayoutGrid, List, Plus, Calendar,
  Users, Search, RotateCcw, ArrowRightLeft
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
import ActiveFilterChips, { type ActiveFilter } from "@/components/negocios/ActiveFilterChips";
import MoreFiltersPopover from "@/components/negocios/MoreFiltersPopover";
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

  const getStatusFilterLabel = (value: string) => {
    switch (value) {
      case 'todos': return 'Todos';
      case 'ganho': return 'Ganhos';
      case 'em-andamento': return 'Em Andamento';
      case 'perdido': return 'Perdido';
      case 'sem-perdidos': return 'Exceto Perdido';
      default: return value;
    }
  };

  const filteredTimes = isManager ? times : times.filter(time => userTimes.includes(time.id));

  const filteredUsuarios = React.useMemo(() => {
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

  // Count active secondary filters (os que moraram no popover "Mais filtros")
  const secondaryValues: Array<string | null | undefined> = [
    stageFilter,
    teamFilter,
    responsavelFilter,
    scoreMatrixFilter,
    productFilter,
    tagFilter,
    channelFilter,
    campanhaFilter,
    sourceFilter,
    mediumFilter,
    termFilter,
    contentFilter,
    motivoFilter,
  ];
  const secondaryCount = secondaryValues.filter(
    (value) => value !== null && value !== undefined && value !== '' && value !== 'all' && value !== '__all__'
  ).length;

  // Resolução de nomes (id -> rótulo legível) para os chips
  const stageName = (id: string) => stages.find((s) => s.id === id)?.nome || id;
  const pipelineName = (id: string) => pipelines.find((p) => p.id === id)?.nome || id;
  const teamName = (id: string) => {
    const found = times.find((t) => t.id === id);
    return found?.name || found?.nome || id;
  };
  const usuarioName = (id: string) =>
    filteredUsuarios.find((u) => u.id === id)?.nome ||
    usuariosDoTenant?.find((u) => u.id === id)?.nome ||
    id;
  const scoreName = (id: string) => {
    const matrix = scoreMatrices.find((m) => m.id === id);
    return matrix ? `Score ${matrix.score_number}` : id;
  };
  const productName = (id: string) => kiwifyProductOptions.find((p) => p.product_id === id)?.product_name || id;
  const tagName = (id: string) => tagOptions.find((t) => t.id === id)?.name || id;
  const channelName = (id: string) => channelOptions.find((c) => c.id === id)?.label || id;
  const motivoName = (id: string) => motivos.find((m) => m.id === id)?.name || id;

  const activeItems: ActiveFilter[] = [];

  if (pipelineFilter) {
    activeItems.push({
      key: 'pipeline',
      label: `Pipeline: ${pipelineName(pipelineFilter)}`,
      onClear: () => onPipelineFilterChange(null),
    });
  }
  if (searchFilter) {
    activeItems.push({
      key: 'search',
      label: `Busca: "${searchFilter}"`,
      onClear: () => onSearchFilterChange(''),
    });
  }
  if (statusFilter && statusFilter !== 'sem-perdidos') {
    activeItems.push({
      key: 'status',
      label: `Status: ${getStatusFilterLabel(statusFilter)}`,
      onClear: () => onStatusFilterChange('sem-perdidos'),
    });
  }
  if (dateFilter && dateFilter !== '3meses') {
    activeItems.push({
      key: 'date',
      label: `Período: ${getDateFilterLabel(dateFilter)}`,
      onClear: () => onDateFilterChange('3meses'),
    });
  }
  if (stageFilter) {
    activeItems.push({
      key: 'stage',
      label: `Etapa: ${stageName(stageFilter)}`,
      onClear: () => onStageFilterChange(null),
    });
  }
  if (teamFilter) {
    activeItems.push({
      key: 'team',
      label: `Equipe: ${teamName(teamFilter)}`,
      onClear: () => onTeamFilterChange(''),
    });
  }
  if (responsavelFilter) {
    activeItems.push({
      key: 'responsavel',
      label: `Responsável: ${usuarioName(responsavelFilter)}`,
      onClear: () => onResponsavelFilterChange(''),
    });
  }
  if (scoreMatrixFilter) {
    activeItems.push({
      key: 'score',
      label: `Score: ${scoreName(scoreMatrixFilter)}`,
      onClear: () => onScoreMatrixFilterChange && onScoreMatrixFilterChange(''),
    });
  }
  if (motivoFilter) {
    activeItems.push({
      key: 'motivo',
      label: `Motivo: ${motivoName(motivoFilter)}`,
      onClear: () => onMotivoFilterChange && onMotivoFilterChange(null),
    });
  }
  if (productFilter) {
    activeItems.push({
      key: 'product',
      label: `Produto: ${productName(productFilter)}`,
      onClear: () => onProductFilterChange && onProductFilterChange(''),
    });
  }
  if (tagFilter) {
    activeItems.push({
      key: 'tag',
      label: `Tag: ${tagName(tagFilter)}`,
      onClear: () => onTagFilterChange && onTagFilterChange(''),
    });
  }
  if (channelFilter) {
    activeItems.push({
      key: 'channel',
      label: `Canal: ${channelName(channelFilter)}`,
      onClear: () => onChannelFilterChange && onChannelFilterChange(''),
    });
  }
  if (campanhaFilter) {
    activeItems.push({
      key: 'campanha',
      label: `Campaign: ${campanhaFilter}`,
      onClear: () => onCampanhaFilterChange && onCampanhaFilterChange(''),
    });
  }
  if (sourceFilter) {
    activeItems.push({
      key: 'source',
      label: `Source: ${sourceFilter}`,
      onClear: () => onSourceFilterChange && onSourceFilterChange(''),
    });
  }
  if (mediumFilter) {
    activeItems.push({
      key: 'medium',
      label: `Medium: ${mediumFilter}`,
      onClear: () => onMediumFilterChange && onMediumFilterChange(''),
    });
  }
  if (termFilter) {
    activeItems.push({
      key: 'term',
      label: `Term: ${termFilter}`,
      onClear: () => onTermFilterChange && onTermFilterChange(''),
    });
  }
  if (contentFilter) {
    activeItems.push({
      key: 'content',
      label: `Content: ${contentFilter}`,
      onClear: () => onContentFilterChange && onContentFilterChange(''),
    });
  }

  return (
    <div className="bg-background border-b border-border" role="toolbar" aria-label="Barra de ferramentas CRM">
      <div className="flex items-center gap-2 px-4 py-2">
        {/* View Mode Toggle */}
        <div className="flex border border-border rounded-lg overflow-hidden h-[30px] flex-shrink-0" role="group" aria-label="Modo de visualização">
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

        {/* Status Filter */}
        {viewMode !== 'clientes' && (
          <Select
            value={statusFilter || "sem-perdidos"}
            onValueChange={(value) => onStatusFilterChange(value)}
          >
            <SelectTrigger className="w-36 h-[30px] text-xs border-border flex-shrink-0">
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

        {/* Mais filtros (secundários) */}
        {viewMode !== 'clientes' && (
          <MoreFiltersPopover count={secondaryCount}>
            {/* Etapa */}
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Etapa</label>
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

            {/* Motivo de Perda — apenas quando filtrando por perdidos */}
            {statusFilter === 'perdido' && onMotivoFilterChange && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Motivo de Perda</label>
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

            {/* Equipe (managers only) */}
            {canChangeFilters && times.length > 0 && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Equipe</label>
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
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Responsável</label>
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

            {/* Score */}
            {onScoreMatrixFilterChange && canChangeFilters && scoreMatrices.length > 0 && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Score</label>
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
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Produto</label>
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
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Tag</label>
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
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Canal</label>
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

            {/* UTM — Campaign, Source, Medium, Term, Content (managers only) */}
            {canChangeFilters && onCampanhaFilterChange && (utmValues?.campaigns?.length || 0) > 0 && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Campaign</label>
                <SearchableSelect
                  value={campanhaFilter}
                  onValueChange={onCampanhaFilterChange}
                  options={utmValues?.campaigns || []}
                  placeholder="Campaign"
                  searchPlaceholder="Buscar campaign..."
                  emptyMessage="Nenhuma campaign encontrada"
                  className="w-full"
                />
              </div>
            )}
            {canChangeFilters && onSourceFilterChange && (utmValues?.sources?.length || 0) > 0 && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Source</label>
                <SearchableSelect
                  value={sourceFilter}
                  onValueChange={onSourceFilterChange}
                  options={utmValues?.sources || []}
                  placeholder="Source"
                  searchPlaceholder="Buscar source..."
                  emptyMessage="Nenhum source encontrado"
                  className="w-full"
                />
              </div>
            )}
            {canChangeFilters && onMediumFilterChange && (utmValues?.mediums?.length || 0) > 0 && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Medium</label>
                <SearchableSelect
                  value={mediumFilter}
                  onValueChange={onMediumFilterChange}
                  options={utmValues?.mediums || []}
                  placeholder="Medium"
                  searchPlaceholder="Buscar medium..."
                  emptyMessage="Nenhum medium encontrado"
                  className="w-full"
                />
              </div>
            )}
            {canChangeFilters && onTermFilterChange && (utmValues?.terms?.length || 0) > 0 && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Term</label>
                <SearchableSelect
                  value={termFilter}
                  onValueChange={onTermFilterChange}
                  options={utmValues?.terms || []}
                  placeholder="Term"
                  searchPlaceholder="Buscar term..."
                  emptyMessage="Nenhum term encontrado"
                  className="w-full"
                />
              </div>
            )}
            {canChangeFilters && onContentFilterChange && (utmValues?.contents?.length || 0) > 0 && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Content</label>
                <SearchableSelect
                  value={contentFilter}
                  onValueChange={onContentFilterChange}
                  options={utmValues?.contents || []}
                  placeholder="Content"
                  searchPlaceholder="Buscar content..."
                  emptyMessage="Nenhum content encontrado"
                  className="w-full"
                />
              </div>
            )}
          </MoreFiltersPopover>
        )}

        {/* Mover leads em massa */}
        {viewMode !== 'clientes' && stagesDoPipelineAtual.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMoverLeadsOpen(true)}
            className="h-[30px] w-[30px] p-0 border-border flex-shrink-0 rounded-full"
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
            className="h-[30px] w-[30px] p-0 border-border flex-shrink-0 rounded-full"
            title="Atualizar"
            aria-label="Atualizar negócios"
          >
            <RotateCcw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} strokeWidth={1.5} />
          </Button>
        )}

        {/* New Deal Button */}
        {viewMode !== 'clientes' && (
          <Button
            onClick={onCreateNegocio}
            className="h-[30px] px-3 text-xs gap-1.5 flex-shrink-0 rounded-full"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            Novo Negócio
          </Button>
        )}
      </div>

      {viewMode !== 'clientes' && (
        <ActiveFilterChips items={activeItems} onClearAll={onClearFilters} />
      )}

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
