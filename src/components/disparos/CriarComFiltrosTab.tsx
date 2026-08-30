import * as React from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SendFilters, FilterResult } from '@/types/sends';
import { useFilterLeads } from '@/hooks/useFilterLeads';
import LiveCounterSidebar from './LiveCounterSidebar';
import FiltroContatosVisual from './FiltroContatosVisual';

interface CriarComFiltrosTabProps {
  onFilterResult: (result: FilterResult) => void;
  onNext?: () => void;
  onBack?: () => void;
}

const DEBOUNCE_MS = 600;

export default function CriarComFiltrosTab({ onFilterResult, onNext, onBack }: CriarComFiltrosTabProps) {
  const [filters, setFilters] = React.useState<SendFilters>({});
  const [filterResult, setFilterResult] = React.useState<FilterResult | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const { mutate: filterLeadsMutate, isPending } = useFilterLeads();

  const doSearch = React.useCallback(
    (f: SendFilters) => {
      if (!f.pipeline_id) return;
      filterLeadsMutate(f, {
        onSuccess: (data) => {
          setFilterResult(data);
          onFilterResult(data);
        },
        onError: () => {
          // toast already shown by useFilterLeads onError
        },
      });
    },
    [filterLeadsMutate, onFilterResult]
  );

  const handleFilterChange = (newFilters: Partial<SendFilters>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (updated.pipeline_id) {
      debounceRef.current = setTimeout(() => doSearch(updated), DEBOUNCE_MS);
    } else {
      // Pipeline cleared → reset results
      setFilterResult(null);
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleNext = () => {
    if (!filterResult || filterResult.total === 0) {
      toast.error('Selecione um pipeline — os contatos serão carregados automaticamente');
      return;
    }
    onNext?.();
  };

  return (
    <div className="flex gap-6">

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex-1">
        <div className="border border-border bg-card rounded-[4px] p-6">
          <FiltroContatosVisual filters={filters} onFilterChange={handleFilterChange} />
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center gap-3 pt-6 mt-6 border-t border-border">
          <Button variant="outline" onClick={onBack} disabled={!onBack}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <Button
            onClick={handleNext}
            disabled={!filterResult || filterResult.total === 0 || isPending}
          >
            Próximo
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div className="w-80 lg:w-96 shrink-0">
        <LiveCounterSidebar
          count={filterResult?.total ?? 0}
          contacts={filterResult?.contacts ?? []}
          isLoading={isPending}
          onRefresh={() => doSearch(filters)}
        />
      </div>

    </div>
  );
}
