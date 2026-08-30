
import { Pipeline, Stage, usePipelines } from "@/hooks/usePipelines";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

interface PipelineVisualizationProps {
  pipeline: Pipeline;
}

const PipelineVisualization = ({ pipeline }: PipelineVisualizationProps) => {
  const { stages: allStages } = usePipelines();
  const stages = allStages.filter(s => s.pipeline_id === pipeline.id) || [];
  const sortedStages = stages.sort((a, b) => a.ordem - b.ordem);

  if (sortedStages.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground bg-muted rounded-[4px]">
        <p className="text-sm">Nenhuma etapa configurada para este pipeline</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium">Funil:</span>
        <Badge variant="secondary" className="text-xs">
          {sortedStages.length} etapa{sortedStages.length !== 1 ? 's' : ''}
        </Badge>
        {!pipeline.ativo && (
          <Badge variant="outline" className="text-xs text-muted-foreground/60">
            Inativo
          </Badge>
        )}
      </div>

      {/* Visual funnel */}
      <div className="flex items-center gap-2 overflow-x-auto py-2">
        {sortedStages.map((stage, index) => (
          <div key={stage.id} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-2 min-w-[120px]">
              <div
                className="w-14 h-14 rounded-[4px] flex items-center justify-center text-white font-semibold text-sm transition-transform hover:scale-105"
                style={{ backgroundColor: stage.cor }}
              >
                {stage.ordem}
              </div>
              <p className="text-xs font-medium text-foreground leading-tight text-center">
                {stage.nome}
              </p>
            </div>

            {index < sortedStages.length - 1 && (
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-[-20px]" />
            )}
          </div>
        ))}
      </div>

      {/* Simple stage list */}
      <div className="space-y-1.5">
        {sortedStages.map((stage) => (
          <div key={stage.id} className="flex items-center gap-2 text-xs px-2 py-1.5">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: stage.cor }}
            />
            <span className="text-muted-foreground/60 w-4">{stage.ordem}.</span>
            <span className="text-foreground">{stage.nome}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PipelineVisualization;
