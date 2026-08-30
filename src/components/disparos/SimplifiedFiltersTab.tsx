import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Check, Search } from 'lucide-react';
import { SendFilters, FilterResult } from '@/types/sends';
import { useFilterLeads } from '@/hooks/useFilterLeads';
import { usePipelines } from '@/hooks/usePipelines';

interface SimplifiedFiltersTabProps {
  onFilterResult: (result: FilterResult) => void;
  onNext?: () => void;
  onBack?: () => void;
}

export default function SimplifiedFiltersTab({ onFilterResult, onNext, onBack }: SimplifiedFiltersTabProps) {
  const [filters, setFilters] = React.useState<SendFilters>({});
  const [filterResult, setFilterResult] = React.useState<FilterResult | null>(null);

  const { pipelines } = usePipelines();
  const { mutate: filterLeadsMutate, isPending } = useFilterLeads();

  const handleSearch = () => {
    if (!filters.pipeline_id) {
      toast.error('Selecione um pipeline para buscar');
      return;
    }

    console.log('🔍 Buscando com filtros:', filters);

    filterLeadsMutate(filters, {
      onSuccess: (data) => {
        console.log('✅ Busca concluída:', data);
        setFilterResult(data);
        onFilterResult(data);

        if (data.total === 0) {
          toast.warning('Nenhuma pessoa encontrada com os filtros aplicados');
        } else {
          toast.success(`${data.total} pessoas encontradas!`);
        }
      },
      onError: (error) => {
        console.error('❌ Erro:', error);
        toast.error('Erro ao buscar pessoas');
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-border bg-card rounded-[2px]">
        <h3 className="text-lg font-semibold mb-6">Filtros para Seleção de Pessoas</h3>

        <div className="space-y-4">
          {/* Pipeline - OBRIGATÓRIO */}
          <div>
            <Label className="font-semibold">Pipeline *</Label>
            <Select
              value={filters.pipeline_id || ''}
              onValueChange={(v) => setFilters({ ...filters, pipeline_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status - Opcional */}
          <div>
            <Label className="text-muted-foreground">Status (Opcional)</Label>
            <Select
              value={filters.person_status?.[0] || 'all'}
              onValueChange={(v) => setFilters({ ...filters, person_status: v === 'all' ? undefined : [v as 'active' | 'archived'] })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Qualquer status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="arquivado">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Resultado */}
      {filterResult && (
        <Card className="p-6 border border-border bg-card rounded-[2px]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pessoas encontradas</p>
              <p className="text-3xl font-bold text-primary">{filterResult.total}</p>
            </div>
            <Check className="w-10 h-10 text-green-600" />
          </div>
        </Card>
      )}

      {/* Ações */}
      <div className="flex justify-between items-center gap-3 pt-6 border-t border-border">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={!onBack}
          className="h-[30px] rounded-[4px] text-xs"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <Button
          onClick={handleSearch}
          disabled={isPending || !filters.pipeline_id}
          className="h-[30px] rounded-[4px] text-xs gap-2"
        >
          <Search className="w-4 h-4" />
          {isPending ? 'Buscando...' : 'Buscar Pessoas'}
        </Button>

        <Button
          onClick={() => {
            if (!filterResult || filterResult.total === 0) {
              toast.error('Busque pessoas primeiro');
              return;
            }
            onNext?.();
          }}
          disabled={!filterResult || filterResult.total === 0}
          className="h-[30px] rounded-[4px] text-xs"
        >
          Próximo
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
