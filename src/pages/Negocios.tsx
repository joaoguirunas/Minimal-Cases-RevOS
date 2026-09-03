import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePipelines } from "@/hooks/usePipelines";
import KanbanBoard from "@/components/negocios/KanbanBoard";
import NegociosList from "@/components/negocios/NegociosList";
import NegociosToolbar from "@/components/negocios/NegociosToolbar";
import { useTeams } from "@/hooks/useTeamsNew";
import { useUsuarios } from "@/hooks/useUsuarios";
import { Loader2 } from "lucide-react";
import NovoNegocioModal from "@/components/negocios/NovoNegocioModal";
import Clientes from "@/pages/Clientes";
import { startOfToday, endOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { useNegociosPipeline } from "@/hooks/useNegociosOptimized";
import { useDebounce } from "@/hooks/useDebounce";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Negocios = () => {
  const { pipelines: allPipelines = [], stages = [], isLoading } = usePipelines();
  const { data: times = [] } = useTeams();
  const { data: usuarios = [] } = useUsuarios();
  const { isManager, isComercial, userTimes, getResponsavelFilter } = useUserPermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Filter only active pipelines for selection
  const pipelines = useMemo(() =>
    allPipelines.filter(p => p.active || p.ativo),
    [allPipelines]
  );

  // Detectar viewMode da URL
  const getViewModeFromUrl = (): 'kanban' | 'list' | 'clientes' => {
    if (location.pathname.includes('/crm/list')) return 'list';
    if (location.pathname.includes('/crm/clients')) return 'clientes';
    return 'kanban';
  };

  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'clientes'>(getViewModeFromUrl());

  // Sincronizar viewMode com URL
  useEffect(() => {
    setViewMode(getViewModeFromUrl());
  }, [location.pathname]);
  
  // Persist pipeline selection in localStorage
  const [pipelineFilter, setPipelineFilter] = useState<string | null>(() => {
    const saved = localStorage.getItem('negocios_pipeline_filter');
    return saved || null;
  });
  
  // Save pipeline filter to localStorage when it changes
  useEffect(() => {
    if (pipelineFilter) {
      localStorage.setItem('negocios_pipeline_filter', pipelineFilter);
    }
  }, [pipelineFilter]);
  
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>('sem-perdidos');
  const [dateFilter, setDateFilter] = useState<string>('todos');
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [responsavelFilter, setResponsavelFilter] = useState<string>('');
  const [campanhaFilter, setCampanhaFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [mediumFilter, setMediumFilter] = useState<string>('');
  const [termFilter, setTermFilter] = useState<string>('');
  const [contentFilter, setContentFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [scoreMatrixFilter, setScoreMatrixFilter] = useState<string>('');
  const [motivoFilter, setMotivoFilter] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleStatusFilterChange = (value: string | null) => {
    setStatusFilter(value);
    if (value !== 'perdido') setMotivoFilter(null);
  };
  
  // Debounce search to avoid too many queries
  const debouncedSearch = useDebounce(searchFilter, 500);
  
  // Auto-apply responsável filter for non-manager users
  useEffect(() => {
    if (!isManager) {
      const defaultFilter = getResponsavelFilter();
      if (defaultFilter && defaultFilter !== '__INVALID_USER__') {
        setResponsavelFilter(defaultFilter);
      }
    }
  }, [isManager, getResponsavelFilter]);

  // Auto-apply team filter for non-manager users — não pra 'comercial', que é
  // restrito por PIPELINE (equipe → settings_teams_pipelines), não por
  // teams_id do lead (a maioria dos leads não tem isso setado).
  useEffect(() => {
    if (!isManager && !isComercial && userTimes.length > 0 && !teamFilter) {
      const firstTeamId = userTimes[0];
      setTeamFilter(firstTeamId);
    }
  }, [isManager, isComercial, userTimes, teamFilter]);
  
  // Auto-select first pipeline only if no saved filter or saved filter is invalid
  useEffect(() => {
    console.log('🎯 Pipeline auto-select effect:', { 
      pipelinesLength: pipelines.length, 
      currentPipelineFilter: pipelineFilter,
      firstPipelineId: pipelines[0]?.id
    });
    
    if (pipelines.length > 0) {
      // Check if current filter is valid (exists in pipelines)
      const isValidFilter = pipelineFilter && pipelines.some(p => p.id === pipelineFilter);
      
      if (!isValidFilter) {
        console.log('✅ Auto-selecting first pipeline:', pipelines[0].id);
        setPipelineFilter(pipelines[0].id);
      }
    }
  }, [pipelines, pipelineFilter]);
  
  const selectedPipeline = pipelines.find(p => p.id === pipelineFilter);
  const pipelineStages = stages.filter(s => s.leads_pipelines_id === pipelineFilter);

  // Convert date filter to date range
  const dateRange = useMemo(() => {
    if (!dateFilter || dateFilter === 'todos') {
      console.log('📅 No date filter or "todos" - returning undefined');
      return undefined;
    }
    
    console.log('📅 Date range calculation for filter:', dateFilter);
    
    switch (dateFilter) {
      case 'hoje':
        return {
          dataInicio: startOfToday().toISOString(),
          dataFim: endOfToday().toISOString()
        };
      case 'semana':
        return {
          dataInicio: startOfWeek(new Date(), { weekStartsOn: 0 }).toISOString(),
          dataFim: endOfWeek(new Date(), { weekStartsOn: 0 }).toISOString()
        };
      case 'mes':
        return {
          dataInicio: startOfMonth(new Date()).toISOString(),
          dataFim: endOfMonth(new Date()).toISOString()
        };
      case '3meses':
        const threeMonthsAgo = subMonths(new Date(), 3);
        return {
          dataInicio: threeMonthsAgo.toISOString(),
          dataFim: endOfToday().toISOString()
        };
      default:
        return undefined;
    }
  }, [dateFilter]);

  // Fetch negocios for list view with all filters (skip when no pipeline selected)
  const { data: negociosForList = [], refetch: refetchNegocios, isRefetching: isRefetchingNegocios } = useNegociosPipeline(
    pipelineFilter ?? '',
    {
      stageId: stageFilter || undefined,
      status: statusFilter || undefined,
      user_id: responsavelFilter || undefined,
      teams_id: teamFilter || undefined,
      dataInicio: dateRange?.dataInicio,
      dataFim: dateRange?.dataFim,
      searchFilter: debouncedSearch || undefined,
      scoreMatrixId: scoreMatrixFilter || undefined,
      utm_campaign: campanhaFilter || undefined,
      utm_source: sourceFilter || undefined,
      utm_medium: mediumFilter || undefined,
      utm_term: termFilter || undefined,
      utm_content: contentFilter || undefined,
      motivoFilter: motivoFilter || undefined,
      productId: productFilter || undefined,
      tagId: tagFilter || undefined,
      channelId: channelFilter || undefined
    }
  );

  console.log('📊 Negocios.tsx:', {
    pipelineFilter,
    selectedPipeline: selectedPipeline?.name,
    totalStages: stages.length,
    pipelineStagesCount: pipelineStages.length,
    pipelineStages: pipelineStages.map(s => ({ id: s.id, name: s.name, pipeline_id: s.leads_pipelines_id })),
    dateFilter,
    dateRange,
    negociosForListCount: negociosForList.length
  });

  const handleRefresh = () => {
    refetchNegocios();
    queryClient.invalidateQueries({ queryKey: ['negocios-por-etapa'] });
    queryClient.invalidateQueries({ queryKey: ['negocios-pipeline'] });
  };

  const handleStageChange = (negocioId: string, newStageId: string) => {
    console.log('Stage changed:', negocioId, newStageId);
  };

  const handleCreateNegocio = () => {
    setIsModalOpen(true);
  };

  const handleViewModeChange = (newMode: 'kanban' | 'list' | 'clientes') => {
    setViewMode(newMode);
    // Navegar para a URL apropriada
    const urlMap = {
      'kanban': '/crm/kanban',
      'list': '/crm/list',
      'clientes': '/crm/clients'
    };
    navigate(urlMap[newMode], { replace: true });
  };

  const handleClearFilters = () => {
    setStageFilter(null);
    setStatusFilter('sem-perdidos');
    setMotivoFilter(null);
    setDateFilter('todos');
    setTeamFilter('');
    setResponsavelFilter('');
    setCampanhaFilter('');
    setSourceFilter('');
    setMediumFilter('');
    setTermFilter('');
    setContentFilter('');
    setSearchFilter('');
    setScoreMatrixFilter('');
    setProductFilter('');
    setTagFilter('');
    setChannelFilter('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading deals...</p>
        </div>
      </div>
    );
  }

  if (!pipelines.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-lg font-medium text-foreground">No pipelines configured</p>
          <p className="text-sm text-muted-foreground">Configure pipelines in Settings to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {viewMode !== 'clientes' && (
      <NegociosToolbar
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        pipelines={pipelines}
        stages={stages}
        pipelineFilter={pipelineFilter}
        stageFilter={stageFilter}
        statusFilter={statusFilter}
        dateFilter={dateFilter}
        teamFilter={teamFilter}
        responsavelFilter={responsavelFilter}
        campanhaFilter={campanhaFilter}
        sourceFilter={sourceFilter}
        mediumFilter={mediumFilter}
        termFilter={termFilter}
        contentFilter={contentFilter}
        searchFilter={searchFilter}
        scoreMatrixFilter={scoreMatrixFilter}
        motivoFilter={motivoFilter}
        productFilter={productFilter}
        tagFilter={tagFilter}
        channelFilter={channelFilter}
        onPipelineFilterChange={setPipelineFilter}
        onStageFilterChange={setStageFilter}
        onStatusFilterChange={handleStatusFilterChange}
        onDateFilterChange={setDateFilter}
        onTeamFilterChange={setTeamFilter}
        onResponsavelFilterChange={setResponsavelFilter}
        onCampanhaFilterChange={setCampanhaFilter}
        onSourceFilterChange={setSourceFilter}
        onMediumFilterChange={setMediumFilter}
        onTermFilterChange={setTermFilter}
        onContentFilterChange={setContentFilter}
        onSearchFilterChange={setSearchFilter}
        onScoreMatrixFilterChange={setScoreMatrixFilter}
        onMotivoFilterChange={setMotivoFilter}
        onProductFilterChange={setProductFilter}
        onTagFilterChange={setTagFilter}
        onChannelFilterChange={setChannelFilter}
        onClearFilters={handleClearFilters}
        onCreateNegocio={handleCreateNegocio}
        onRefresh={handleRefresh}
        isRefreshing={isRefetchingNegocios}
        times={times}
        usuarios={usuarios}
      />
      )}

      {viewMode === 'kanban' ? (
        <KanbanBoard
          stages={pipelineStages}
          onStageChange={handleStageChange}
          pipelineId={pipelineFilter || undefined}
          stageFilter={stageFilter}
          onStageFilterChange={setStageFilter}
          statusFilter={statusFilter}
          teamFilter={teamFilter}
          responsavelFilter={responsavelFilter}
          campanhaFilter={campanhaFilter}
          sourceFilter={sourceFilter}
          mediumFilter={mediumFilter}
          termFilter={termFilter}
          contentFilter={contentFilter}
          dataInicio={dateRange?.dataInicio}
          dataFim={dateRange?.dataFim}
          searchFilter={debouncedSearch}
          motivoFilter={motivoFilter}
          productFilter={productFilter}
          tagFilter={tagFilter}
          channelFilter={channelFilter}
        />
      ) : viewMode === 'list' ? (
        <NegociosList
          negocios={negociosForList}
          stages={stages}
          pipelines={pipelines}
        />
      ) : (
        <Clientes />
      )}

      {viewMode !== 'clientes' && (
        <NovoNegocioModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          stageId={pipelineStages[0]?.id}
        />
      )}
    </div>
  );
};

export default Negocios;