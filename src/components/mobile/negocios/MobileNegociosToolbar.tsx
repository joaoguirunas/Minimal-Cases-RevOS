import { useState } from 'react';
import { Search, Plus, Filter, SlidersHorizontal } from 'lucide-react';
import { type Pipeline, type Stage } from '@/hooks/usePipelines';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface AdvancedFilters {
  userId: string;
  teamId: string;
  dataInicio: string;
  dataFim: string;
  utmSource: string;
  utmCampaign: string;
}

interface MobileNegociosToolbarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  pipelineId: string;
  onPipelineChange: (id: string) => void;
  stageId: string;
  onStageChange: (id: string) => void;
  status: string;
  onStatusChange: (status: string) => void;
  pipelines: Pipeline[];
  stages: Stage[];
  onCreateClick: () => void;
  advancedFilters?: AdvancedFilters;
  onAdvancedFilterChange?: (key: string, value: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'in_progress', label: 'Ativos' },
  { value: 'won', label: 'Ganhos' },
  { value: 'lost', label: 'Perdidos' },
];

export const MobileNegociosToolbar = ({
  searchTerm,
  onSearchChange,
  pipelineId,
  onPipelineChange,
  stageId,
  onStageChange,
  status,
  onStatusChange,
  pipelines,
  stages,
  onCreateClick,
  advancedFilters,
  onAdvancedFilterChange,
}: MobileNegociosToolbarProps) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const pipelineStages = stages?.filter((s) => s.leads_pipelines_id === pipelineId) || [];

  const advancedCount = advancedFilters
    ? [advancedFilters.userId, advancedFilters.teamId, advancedFilters.dataInicio,
       advancedFilters.dataFim, advancedFilters.utmSource, advancedFilters.utmCampaign]
        .filter(Boolean).length
    : 0;

  const activeFilterCount =
    (stageId ? 1 : 0) +
    (status && status !== 'all' ? 1 : 0) +
    advancedCount;

  const handleClearAdvanced = () => {
    if (onAdvancedFilterChange) {
      onAdvancedFilterChange('userId', '');
      onAdvancedFilterChange('teamId', '');
      onAdvancedFilterChange('dataInicio', '');
      onAdvancedFilterChange('dataFim', '');
      onAdvancedFilterChange('utmSource', '');
      onAdvancedFilterChange('utmCampaign', '');
    }
  };

  return (
    <div className="space-y-3">
      {/* Busca + Avançados + Criar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar negócios..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-muted border-0 h-10"
          />
        </div>
        <Button
          variant={advancedCount > 0 ? 'default' : 'outline'}
          size="icon"
          className="shrink-0 min-h-[44px] min-w-[44px]"
          onClick={() => setAdvancedOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          className="shrink-0 min-h-[44px] min-w-[44px] bg-primary"
          onClick={onCreateClick}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Pipeline selector */}
      <Select value={pipelineId} onValueChange={onPipelineChange}>
        <SelectTrigger className="h-10 min-h-[44px] text-sm bg-card">
          <SelectValue placeholder="Selecionar pipeline" />
        </SelectTrigger>
        <SelectContent>
          {pipelines?.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name || p.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status toggle */}
      <div className="flex gap-1.5">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onStatusChange(opt.value)}
            className={cn(
              'flex-1 text-xs font-medium px-2 py-2 min-h-[44px] rounded-[4px] border transition-colors',
              status === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-muted/50',

            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Stage chips (horizontal scroll) */}
      {pipelineStages.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
          <button
            onClick={() => onStageChange('')}
            className={cn(
              'shrink-0 text-xs font-medium px-3 py-1.5 min-h-[36px] rounded-full border snap-start transition-colors',
              !stageId
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border',
            )}
          >
            Todas
          </button>
          {pipelineStages
            .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
            .map((stage) => (
              <button
                key={stage.id}
                onClick={() => onStageChange(stage.id)}
                className={cn(
                  'shrink-0 text-xs font-medium px-3 py-1.5 min-h-[36px] rounded-full border snap-start transition-colors flex items-center gap-1.5',
                  stageId === stage.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border',
                )}
              >
                {stage.color && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />
                )}
                {stage.name || stage.nome}
              </button>
            ))}
        </div>
      )}

      {/* Badge de filtros ativos */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs gap-1">
            <Filter className="h-3 w-3" />
            {activeFilterCount} filtro{activeFilterCount > 1 ? 's' : ''} ativo{activeFilterCount > 1 ? 's' : ''}
          </Badge>
          <button
            onClick={() => {
              onStageChange('');
              onStatusChange('all');
              handleClearAdvanced();
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Limpar
          </button>
        </div>
      )}

      {/* Advanced Filters Sheet (T7) */}
      <Sheet open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-[12px] px-4 pb-8">
          <SheetHeader className="pb-4 border-b border-border">
            <SheetTitle className="text-base">Filtros Avançados</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto mt-4 space-y-4">
            {/* Responsável */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Responsável (User ID)</Label>
              <Input
                placeholder="ID do responsável"
                value={advancedFilters?.userId || ''}
                onChange={(e) => onAdvancedFilterChange?.('userId', e.target.value)}
                className="min-h-[44px]"
              />
            </div>

            {/* Time */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Time (Team ID)</Label>
              <Input
                placeholder="ID do time"
                value={advancedFilters?.teamId || ''}
                onChange={(e) => onAdvancedFilterChange?.('teamId', e.target.value)}
                className="min-h-[44px]"
              />
            </div>

            {/* Data */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data início</Label>
                <Input
                  type="date"
                  value={advancedFilters?.dataInicio || ''}
                  onChange={(e) => onAdvancedFilterChange?.('dataInicio', e.target.value)}
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data fim</Label>
                <Input
                  type="date"
                  value={advancedFilters?.dataFim || ''}
                  onChange={(e) => onAdvancedFilterChange?.('dataFim', e.target.value)}
                  className="min-h-[44px]"
                />
              </div>
            </div>

            {/* UTM Params */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">UTM Source</Label>
              <Input
                placeholder="google, facebook, ..."
                value={advancedFilters?.utmSource || ''}
                onChange={(e) => onAdvancedFilterChange?.('utmSource', e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">UTM Campaign</Label>
              <Input
                placeholder="Nome da campanha"
                value={advancedFilters?.utmCampaign || ''}
                onChange={(e) => onAdvancedFilterChange?.('utmCampaign', e.target.value)}
                className="min-h-[44px]"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 min-h-[44px]"
                onClick={() => {
                  handleClearAdvanced();
                  setAdvancedOpen(false);
                }}
              >
                Limpar
              </Button>
              <Button
                className="flex-1 min-h-[44px]"
                onClick={() => setAdvancedOpen(false)}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
