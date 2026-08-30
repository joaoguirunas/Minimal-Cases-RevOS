import { Target, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ScoreInformationDisplayProps {
  scoreMatrixId: string | null;
  showEditButton?: boolean;
  onEditClick?: () => void;
}

export const ScoreInformationDisplay = ({ 
  scoreMatrixId,
  showEditButton = false,
  onEditClick 
}: ScoreInformationDisplayProps) => {
  // Buscar informações do score
  const { data: scoreData, isLoading } = useQuery({
    queryKey: ['score-display', scoreMatrixId],
    queryFn: async () => {
      if (!scoreMatrixId) return null;
      
      const { data, error } = await supabase
        .from('score_matrix')
        .select(`
          *,
          score_objectives!inner(name),
          score_incomes!inner(name),
          score_framings!inner(name)
        `)
        .eq('id', scoreMatrixId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!scoreMatrixId,
  });

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800';
    if (score >= 5) return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800';
    return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800';
  };

  if (!scoreMatrixId) {
    return (
      <Card className="border-0 border border-border rounded-[2px]">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <Label className="text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                Score não definido
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Nenhum score foi associado a este cliente ainda.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-0 border border-border rounded-[2px]">
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="h-4 bg-muted animate-pulse rounded w-1/4"></div>
            <div className="h-8 bg-muted animate-pulse rounded w-1/2"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!scoreData) {
    return (
      <Card className="border-0 border border-border rounded-[2px] bg-destructive/10">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <Label className="text-xs font-medium uppercase tracking-[0.05em] text-destructive">
                Score inválido
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                O score associado não foi encontrado no sistema.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 border border-border rounded-[2px]">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header com Score Number */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-[2px] bg-primary/10">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <Label className="text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                  Score Information
                </Label>
              </div>
            </div>
            <Badge className={`text-2xl font-bold px-4 py-2 ${getScoreColor(scoreData.score_number)}`}>
              {scoreData.score_number}
            </Badge>
          </div>

          {/* Campos do Score */}
          <div className="grid grid-cols-1 gap-3">
            {/* Objetivo */}
            <div className="flex items-start gap-3 p-3 bg-muted rounded-[2px]">
              <Target className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                  Objetivo
                </Label>
                <p className="text-sm font-medium mt-0.5">
                  {(scoreData as any).score_objectives?.name || 'N/A'}
                </p>
              </div>
            </div>

            {/* Renda */}
            <div className="flex items-start gap-3 p-3 bg-muted rounded-[2px]">
              <TrendingUp className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                  Renda
                </Label>
                <p className="text-sm font-medium mt-0.5">
                  {(scoreData as any).score_incomes?.name || 'N/A'}
                </p>
              </div>
            </div>

            {/* Enquadramento */}
            <div className="flex items-start gap-3 p-3 bg-muted rounded-[2px]">
              <TrendingUp className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                  Enquadramento
                </Label>
                <p className="text-sm font-medium mt-0.5">
                  {(scoreData as any).score_framings?.name || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Detalhe do Score */}
          {scoreData.detail_score && (
            <div className="p-3 bg-primary/5 rounded-[2px] border border-primary/10">
              <Label className="text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                Detalhe
              </Label>
              <p className="text-sm mt-1">{scoreData.detail_score}</p>
            </div>
          )}

          {/* Perfil do Score */}
          {scoreData.profile_score && (
            <div className="p-3 bg-primary/5 rounded-[2px] border border-primary/10">
              <Label className="text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                Perfil
              </Label>
              <p className="text-sm mt-1">{scoreData.profile_score}</p>
            </div>
          )}

          {/* Descrição */}
          {scoreData.pre_description_score && (
            <div className="p-3 bg-primary/5 rounded-[2px] border border-primary/10">
              <Label className="text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                Descrição
              </Label>
              <p className="text-sm mt-1 text-muted-foreground">
                {scoreData.pre_description_score}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
