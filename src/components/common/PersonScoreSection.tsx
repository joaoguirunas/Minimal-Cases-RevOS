import { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, CheckCircle, AlertCircle } from 'lucide-react';
import { useScoreObjectives } from '@/hooks/useScoreObjectives';
import { useScoreInvestments } from '@/hooks/useScoreInvestments';
import { useScoreFramings } from '@/hooks/useScoreFramings';
import { useFindScoreMatrix } from '@/hooks/useScoreMatrix';
import { cn } from '@/lib/utils';

interface PersonScoreSectionProps {
  objectiveId: string;
  investmentId: string;
  framingId: string;
  onObjectiveChange: (value: string) => void;
  onInvestmentChange: (value: string) => void;
  onFramingChange: (value: string) => void;
  onScoreMatrixIdChange: (id: string | null) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

export const PersonScoreSection = ({
  objectiveId,
  investmentId,
  framingId,
  onObjectiveChange,
  onInvestmentChange,
  onFramingChange,
  onScoreMatrixIdChange,
  onLoadingChange,
}: PersonScoreSectionProps) => {
  const { data: objectives = [] } = useScoreObjectives();
  const { data: investments = [] } = useScoreInvestments();
  const { data: framings = [] } = useScoreFramings();

  const activeObjectives = objectives.filter((o) => o.active);
  const activeInvestments = investments.filter((i) => i.active);
  const activeFramings = framings.filter((f) => f.active);

  const { data: scoreMatrix, isLoading } = useFindScoreMatrix(
    objectiveId,
    investmentId,
    framingId
  );

  useEffect(() => {
    // Se não tiver todos os campos, não está loading
    if (!objectiveId || !investmentId || !framingId) {
      onLoadingChange?.(false);
    } else {
      // Notifica o componente pai sobre o estado de loading
      onLoadingChange?.(isLoading);
    }
  }, [isLoading, onLoadingChange, objectiveId, investmentId, framingId]);

  useEffect(() => {
    // Se não tiver todos os campos preenchidos, limpa o score_matrix_id
    if (!objectiveId || !investmentId || !framingId) {
      onScoreMatrixIdChange(null);
      return;
    }
    
    // Se a query ainda está carregando, não faz nada
    if (isLoading) {
      return;
    }
    
    // Atualiza com o resultado da busca (pode ser um ID ou null)
    if (scoreMatrix) {
      onScoreMatrixIdChange(scoreMatrix.id);
    } else {
      onScoreMatrixIdChange(null);
    }
  }, [scoreMatrix, onScoreMatrixIdChange, objectiveId, investmentId, framingId, isLoading]);

  const getScoreVariant = (score: number) => {
    if (score >= 8) return { bg: 'bg-emerald-500/8 border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', icon: 'text-emerald-500' };
    if (score >= 5) return { bg: 'bg-amber-500/8 border-amber-500/30', text: 'text-amber-600 dark:text-amber-400', icon: 'text-amber-500' };
    return { bg: 'bg-red-500/8 border-red-500/30', text: 'text-red-600 dark:text-red-400', icon: 'text-red-500' };
  };

  const hasAllFields = objectiveId && investmentId && framingId;

  return (
    <section className="border border-border rounded-[4px] bg-card">
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06] flex items-center gap-2">
        <Target className="w-3.5 h-3.5 text-muted-foreground/50" strokeWidth={1.5} />
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Score
        </p>
      </div>
      <div className="p-4 space-y-3">

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Objetivo
            </Label>
            <Select value={objectiveId} onValueChange={onObjectiveChange}>
              <SelectTrigger id="score-objective" className="h-8 text-[13px] rounded-[4px]">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {activeObjectives.map((obj) => (
                  <SelectItem key={obj.id} value={obj.id} className="text-[13px]">
                    {obj.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Investimento
            </Label>
            <Select value={investmentId} onValueChange={onInvestmentChange}>
              <SelectTrigger id="score-investment" className="h-8 text-[13px] rounded-[4px]">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {activeInvestments.map((inv) => (
                  <SelectItem key={inv.id} value={inv.id} className="text-[13px]">
                    {inv.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Enquadramento
            </Label>
            <Select value={framingId} onValueChange={onFramingChange}>
              <SelectTrigger id="score-framing" className="h-8 text-[13px] rounded-[4px]">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {activeFramings.map((frm) => (
                  <SelectItem key={frm.id} value={frm.id} className="text-[13px]">
                    {frm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasAllFields && (
          <>
            {isLoading ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-[4px] bg-muted border border-white/[0.06]">
                <span className="text-[12px] text-muted-foreground">Calculando score...</span>
              </div>
            ) : scoreMatrix ? (
              (() => {
                const variant = getScoreVariant(scoreMatrix.score_number);
                return (
                  <div className={cn('flex items-center gap-3 px-3 py-2.5 rounded-[4px] border', variant.bg)}>
                    <CheckCircle className={cn('w-4 h-4 flex-shrink-0', variant.icon)} strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-[22px] font-bold leading-none', variant.text)}>
                          {scoreMatrix.score_number}
                        </span>
                        <span className="text-[11px] text-muted-foreground/60 font-medium">/ 10</span>
                        {scoreMatrix.profile_score && (
                          <span className="text-[12px] text-muted-foreground ml-1">{scoreMatrix.profile_score}</span>
                        )}
                      </div>
                      {scoreMatrix.detail_score && (
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{scoreMatrix.detail_score}</p>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-[4px] bg-amber-500/8 border border-amber-500/30">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" strokeWidth={1.5} />
                <span className="text-[12px] text-amber-700 dark:text-amber-400">
                  Combinação não cadastrada na matriz de score
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
