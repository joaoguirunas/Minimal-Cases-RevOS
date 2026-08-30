import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, CheckCircle, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SendFilters } from '@/types/sends';

interface Pipeline {
  id: string;
  name: string;
  description?: string;
}

interface Stage {
  id: string;
  pipeline_id?: string;
  leads_pipelines_id?: string;
  name: string;
}

interface PipelineStepProps {
  pipelines: Pipeline[];
  stages: Stage[];
  filters: SendFilters;
  onFilterChange: (filters: Partial<SendFilters>) => void;
}

export default function PipelineStep({ 
  pipelines, 
  stages,
  filters, 
  onFilterChange 
}: PipelineStepProps) {
  const handleSelectPipeline = (pipelineId: string) => {
    onFilterChange({ 
      pipeline_id: pipelineId,
      stage_ids: [] // Reset stages when pipeline changes
    });
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[18px] font-semibold mb-2 text-foreground">Selecione o Pipeline</h2>
        <p className="text-[14px] text-muted-foreground">
          Escolha o pipeline de vendas que deseja usar para filtrar os contatos
        </p>
      </div>

      {pipelines && pipelines.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pipelines.map((pipeline) => {
            const stageCount = stages?.filter(s => s.leads_pipelines_id === pipeline.id).length || 0;
            const isSelected = filters.pipeline_id === pipeline.id;

            return (
              <Card
                key={pipeline.id}
                onClick={() => handleSelectPipeline(pipeline.id)}
                className={cn(
                  'cursor-pointer transition-all duration-200 hover:border-white/[0.10] border',
                  isSelected
                    ? 'border-foreground bg-muted'
                    : 'border-border hover:border-white/[0.10]'
                )}
              >
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="p-2.5 rounded-[4px] bg-muted border border-border">
                      <Layers className="w-5 h-5 text-foreground" />
                    </div>
                    {isSelected && (
                      <CheckCircle className="w-4 h-4 text-foreground" />
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-[16px] mb-1 text-foreground">{pipeline.name}</h3>
                    {pipeline.description && (
                      <p className="text-[13px] text-muted-foreground line-clamp-2">
                        {pipeline.description}
                      </p>
                    )}
                  </div>

                  <Badge variant="secondary" className="rounded-[2px] text-[12px] bg-muted text-muted-foreground">
                    <ListChecks className="w-3 h-3 mr-1" />
                    {stageCount} {stageCount === 1 ? 'etapa' : 'etapas'}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Layers className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-[14px]">Nenhum pipeline disponível</p>
        </div>
      )}
    </div>
  );
}
