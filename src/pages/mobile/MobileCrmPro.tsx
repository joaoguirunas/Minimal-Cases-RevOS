import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { MobileNegociosList } from '@/components/mobile/negocios/MobileNegociosList';
import { MobileNegociosToolbar } from '@/components/mobile/negocios/MobileNegociosToolbar';
import { useMobileNavigation } from '@/hooks/useMobileNavigation';
import { usePipelines } from '@/hooks/usePipelines';
import { useNegociosPipeline } from '@/hooks/useNegociosOptimized';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import NovoNegocioModal from '@/components/negocios/NovoNegocioModal';

const MobileCrmPro = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { negociosFilters, setNegociosFilter } = useMobileNavigation();
  const { pipelines, stages } = usePipelines();

  const [showCreateModal, setShowCreateModal] = useState(false);

  const pipelineId = negociosFilters.pipelineId || pipelines?.[0]?.id || '';

  const { data: negocios = [], isLoading } = useNegociosPipeline(pipelineId, {
    stageId: negociosFilters.stageId || undefined,
    status: negociosFilters.status !== 'all' ? negociosFilters.status : undefined,
    searchFilter: negociosFilters.searchTerm || undefined,
    user_id: negociosFilters.userId || undefined,
    teams_id: negociosFilters.teamId || undefined,
    dataInicio: negociosFilters.dataInicio || undefined,
    dataFim: negociosFilters.dataFim || undefined,
    utm_source: negociosFilters.utmSource || undefined,
    utm_campaign: negociosFilters.utmCampaign || undefined,
  });

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['negocios-pipeline'] });
  }, [queryClient]);

  const { containerRef, isPulling, isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const filteredNegocios = useMemo(() => {
    if (!negociosFilters.searchTerm) return negocios;
    const term = negociosFilters.searchTerm.toLowerCase();
    return negocios.filter((n) =>
      (n.pessoa?.name || '').toLowerCase().includes(term) ||
      (n.title || '').toLowerCase().includes(term) ||
      (n.empresa?.trade_name || '').toLowerCase().includes(term)
    );
  }, [negocios, negociosFilters.searchTerm]);

  const handleNegocioClick = (negocioId: string) => {
    navigate('/m/crm/' + negocioId);
  };

  const showIndicator = isPulling || isRefreshing;
  const indicatorHeight = isRefreshing ? 44 : Math.min(pullDistance / 2, 44);

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="px-4 py-3 space-y-3">
          <h1 className="text-lg font-semibold">Negócios</h1>
          <MobileNegociosToolbar
            searchTerm={negociosFilters.searchTerm}
            onSearchChange={(v) => setNegociosFilter('searchTerm', v)}
            pipelineId={pipelineId}
            onPipelineChange={(v) => setNegociosFilter('pipelineId', v)}
            stageId={negociosFilters.stageId}
            onStageChange={(v) => setNegociosFilter('stageId', v)}
            status={negociosFilters.status}
            onStatusChange={(v) => setNegociosFilter('status', v)}
            pipelines={pipelines || []}
            stages={stages || []}
            onCreateClick={() => setShowCreateModal(true)}
            advancedFilters={{
              userId: negociosFilters.userId,
              teamId: negociosFilters.teamId,
              dataInicio: negociosFilters.dataInicio,
              dataFim: negociosFilters.dataFim,
              utmSource: negociosFilters.utmSource,
              utmCampaign: negociosFilters.utmCampaign,
            }}
            onAdvancedFilterChange={(key, value) => setNegociosFilter(key as keyof typeof negociosFilters, value)}
          />
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto">
        {(showIndicator || pullDistance > 0) && (
          <div
            className="flex items-center justify-center transition-all duration-150"
            style={{ height: indicatorHeight, opacity: Math.min(pullDistance / 60, 1) || (isRefreshing ? 1 : 0) }}
          >
            <RefreshCw
              className={`h-5 w-5 text-primary ${isRefreshing ? 'animate-spin' : ''}`}
              style={{ transform: isRefreshing ? undefined : `rotate(${pullDistance * 3}deg)` }}
            />
          </div>
        )}

        <MobileNegociosList
          negocios={filteredNegocios}
          isLoading={isLoading}
          onSelect={handleNegocioClick}
        />
      </div>

      <NovoNegocioModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
};

export default MobileCrmPro;
