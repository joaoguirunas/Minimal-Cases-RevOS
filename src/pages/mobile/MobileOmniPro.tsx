import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { MobileConversasList } from '@/components/mobile/conversas/MobileConversasList';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

const MobileOmniPro = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['conversas-simples-v4'] });
  }, [queryClient]);

  const { containerRef, isPulling, isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const showIndicator = isPulling || isRefreshing;
  const indicatorHeight = isRefreshing ? 44 : Math.min(pullDistance / 2, 44);

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-card border-b border-border" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold mb-3">Conversas</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar conversas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-muted border-0"
            />
          </div>
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

        <MobileConversasList searchTerm={searchTerm} />
      </div>
    </div>
  );
};

export default MobileOmniPro;
