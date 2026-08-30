import { useConversasPaginadas } from '@/hooks/useConversasPaginadas';
import { MobileConversaItem } from './MobileConversaItem';
import { Loader2, MessageCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface MobileConversasListProps {
  searchTerm: string;
}

export const MobileConversasList = ({ searchTerm }: MobileConversasListProps) => {
  const observerTarget = useRef<HTMLDivElement>(null);
  

  const {
    data: conversas = [],
    totalCount,
    isLoading,
    hasMore,
    loadMore
  } = useConversasPaginadas({
    tenantId: 'single-tenant',
    searchTerm,
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore]);

  if (isLoading && conversas.length === 0) {
    return (
      <div className="p-4 space-y-1 divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 py-3">
            <div className="h-12 w-12 rounded-full shrink-0 animate-shimmer" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-3/4 rounded animate-shimmer" />
              <div className="h-3 w-1/2 rounded animate-shimmer" />
              <div className="h-3 w-2/3 rounded animate-shimmer" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
        <MessageCircle className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">Nenhuma conversa encontrada</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="divide-y divide-border">
        {conversas.map((conversa) => (
          <MobileConversaItem key={conversa.id} conversa={conversa} />
        ))}
      </div>
      
      {hasMore && (
        <div ref={observerTarget} className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
};
