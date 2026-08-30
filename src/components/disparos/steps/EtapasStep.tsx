import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ListChecks, CheckCircle, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SendFilters } from '@/types/sends';

interface Stage {
  id: string;
  pipeline_id?: string;
  leads_pipelines_id?: string;
  name: string;
  order?: number;
  order_index?: number;
}

interface EtapasStepProps {
  stages: Stage[];
  filters: SendFilters;
  onFilterChange: (filters: Partial<SendFilters>) => void;
}

export default function EtapasStep({ 
  stages, 
  filters, 
  onFilterChange 
}: EtapasStepProps) {
  const pipelineStages = stages?.filter(s => (s.pipeline_id || s.leads_pipelines_id) === filters.pipeline_id) || [];
  const selectedStageIds = filters.stage_ids || [];
  
  const handleToggleStage = (stageId: string) => {
    const newStageIds = selectedStageIds.includes(stageId)
      ? selectedStageIds.filter(id => id !== stageId)
      : [...selectedStageIds, stageId];
    
    onFilterChange({ stage_ids: newStageIds });
  };
  
  const handleSelectAll = () => {
    const allStageIds = pipelineStages.map(s => s.id);
    onFilterChange({ stage_ids: allStageIds });
  };
  
  const handleClearAll = () => {
    onFilterChange({ stage_ids: [] });
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-semibold mb-2 text-foreground">Selecione as Etapas</h2>
          <p className="text-[14px] text-muted-foreground">
            Escolha as etapas do pipeline que deseja incluir no disparo
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={!stages || stages.length === 0}
            className="h-[30px] rounded-[4px] text-xs"
          >
            <CheckSquare className="w-4 h-4 mr-2" />
            Selecionar Todas
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={!filters.stage_ids || filters.stage_ids.length === 0}
            className="h-[30px] rounded-[4px] text-xs"
          >
            <Square className="w-4 h-4 mr-2" />
            Limpar
          </Button>
        </div>
      </div>

      {pipelineStages && pipelineStages.length > 0 ? (
        <div className="space-y-3">
          {pipelineStages.map((stage) => {
            const isSelected = filters.stage_ids?.includes(stage.id) || false;
            
            return (
              <Card
                key={stage.id}
                onClick={() => handleToggleStage(stage.id)}
                className={cn(
                  'cursor-pointer transition-all duration-200 border',
                  isSelected
                    ? 'border-foreground bg-muted'
                    : 'border-border hover:border-border'
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleStage(stage.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-5 w-5"
                    />
                    
                    <div className="flex items-center gap-3 flex-1">
                      <div className={cn(
                        'w-10 h-10 rounded-[4px] flex items-center justify-center text-[13px] font-medium',
                        isSelected
                          ? 'bg-foreground text-background'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {stage.order_index}
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="font-semibold text-[15px] text-foreground">{stage.name}</h3>
                        <p className="text-[13px] text-muted-foreground">Ordem: {stage.order_index}</p>
                      </div>
                    </div>

                    {isSelected && (
                      <CheckCircle className="w-4 h-4 text-foreground" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <ListChecks className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-[14px]">Nenhuma etapa disponível para o pipeline selecionado</p>
        </div>
      )}
    </div>
  );
}
