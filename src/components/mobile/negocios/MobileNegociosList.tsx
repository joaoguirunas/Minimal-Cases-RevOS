import { MobileNegocioCard } from './MobileNegocioCard';
import { PieChart } from 'lucide-react';
import { NegocioOptimized } from '@/hooks/useNegociosOptimized';

interface MobileNegociosListProps {
  negocios: NegocioOptimized[];
  isLoading: boolean;
  onSelect?: (id: string) => void;
}

export const MobileNegociosList = ({ negocios, isLoading, onSelect }: MobileNegociosListProps) => {
  if (isLoading && negocios.length === 0) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="h-5 w-3/4 rounded animate-shimmer" />
            <div className="flex gap-2">
              <div className="h-5 w-16 rounded-full animate-shimmer" />
              <div className="h-5 w-20 rounded-full animate-shimmer" />
            </div>
            <div className="flex justify-between">
              <div className="h-5 w-24 rounded animate-shimmer" />
              <div className="h-6 w-6 rounded-full animate-shimmer" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (negocios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
        <PieChart className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">Nenhum negócio encontrado</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {negocios.map((negocio) => (
        <MobileNegocioCard key={negocio.id} negocio={negocio} onSelect={onSelect} />
      ))}
    </div>
  );
};
