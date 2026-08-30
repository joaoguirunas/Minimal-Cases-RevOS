import { useMemo } from 'react';
import { Loader2, GitBranch } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { usePipelines } from '@/hooks/usePipelines';

interface TestPipelineStageSelectorProps {
  pipelineId: string | null;
  stageId: string | null;
  isUpdating: boolean;
  onChange: (pipelineId: string, stageId: string) => void;
}

export function TestPipelineStageSelector({
  pipelineId,
  stageId,
  isUpdating,
  onChange,
}: TestPipelineStageSelectorProps) {
  const { pipelines, stages } = usePipelines();

  const pipelineStages = useMemo(
    () =>
      stages
        .filter((s) => s.pipeline_id === pipelineId)
        .sort((a, b) => a.ordem - b.ordem),
    [stages, pipelineId],
  );

  const handlePipelineChange = (newPipelineId: string) => {
    const firstStage = stages
      .filter((s) => s.pipeline_id === newPipelineId)
      .sort((a, b) => a.ordem - b.ordem)[0];
    if (firstStage) onChange(newPipelineId, firstStage.id);
  };

  const handleStageChange = (newStageId: string) => {
    if (pipelineId) onChange(pipelineId, newStageId);
  };

  return (
    <div className="px-3 py-3 border-t border-border space-y-2">
      <div className="flex items-center gap-1.5">
        <GitBranch className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Pipeline / Etapa
        </span>
        {isUpdating && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/50" />}
      </div>

      <Select value={pipelineId ?? undefined} onValueChange={handlePipelineChange}>
        <SelectTrigger className="h-[30px] w-full text-xs border-border">
          <SelectValue placeholder="Pipeline" />
        </SelectTrigger>
        <SelectContent>
          {pipelines.map((p) => (
            <SelectItem key={p.id} value={p.id} className="text-xs">
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={stageId ?? undefined} onValueChange={handleStageChange} disabled={!pipelineId}>
        <SelectTrigger className="h-[30px] w-full text-xs border-border">
          <SelectValue placeholder="Etapa" />
        </SelectTrigger>
        <SelectContent>
          {pipelineStages.map((s) => (
            <SelectItem key={s.id} value={s.id} className="text-xs">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: s.cor ?? '#999' }}
                />
                {s.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
