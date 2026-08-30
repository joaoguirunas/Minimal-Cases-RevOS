import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useScoreMatrix } from '@/hooks/useScoreMatrix';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ScoreMatrixSelectorProps {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

const getScoreBadgeColor = (score: number) => {
  if (score >= 8) return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800';
  if (score >= 5) return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800';
  return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800';
};

export const ScoreMatrixSelector = ({
  value,
  onValueChange,
  placeholder = "Selecione um score...",
  disabled = false
}: ScoreMatrixSelectorProps) => {
  const { data: scoreMatrixList = [], isLoading } = useScoreMatrix();

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Carregando scores..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (scoreMatrixList.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Nenhum score cadastrado" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select
      value={value || 'none'}
      onValueChange={(val) => onValueChange(val === 'none' ? undefined : val)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-background z-50 max-h-[300px]">
        <SelectItem value="none">
          <span className="text-muted-foreground italic">Nenhum (aplicar para todos)</span>
        </SelectItem>
        {scoreMatrixList.map((matrix) => {
          const cats = matrix.resolved_categories ?? [];
          return (
            <SelectItem key={matrix.id} value={matrix.id}>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn("text-xs font-semibold", getScoreBadgeColor(matrix.score_number))}
                >
                  {matrix.score_number}
                </Badge>
                {cats.length > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {cats.map(c => `${c.categoryName}: ${c.itemNames.join(', ')}`).join(' • ')}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Sem categorias</span>
                )}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};
