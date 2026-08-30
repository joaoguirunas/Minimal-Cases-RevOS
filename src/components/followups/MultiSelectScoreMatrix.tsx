import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from 'lucide-react';
import { useScoreMatrix, type ScoreMatrix } from '@/hooks/useScoreMatrix';

interface MultiSelectScoreMatrixProps {
  selectedMatrixIds: string[];
  onMatrixIdsChange: (ids: string[]) => void;
  disabled?: boolean;
}

const getScoreBadgeColor = (score: number) => {
  if (score >= 8) return "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20";
  if (score >= 6) return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/20";
  if (score >= 4) return "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20";
  return "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20";
};

const MatrixCategoryBadges = ({ matrix }: { matrix: ScoreMatrix }) => {
  const cats = matrix.resolved_categories ?? [];
  if (cats.length === 0) return null;
  return (
    <>
      {cats.map(cat => (
        <Badge
          key={cat.categoryId}
          variant="outline"
          className="rounded-full h-6 px-2 text-xs bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
        >
          {cat.categoryName}: {cat.itemNames.join(', ')}
        </Badge>
      ))}
    </>
  );
};

const MatrixSummaryLabel = ({ matrix }: { matrix: ScoreMatrix }) => {
  const cats = matrix.resolved_categories ?? [];
  if (cats.length === 0) return <span className="text-muted-foreground/50 text-xs">—</span>;
  return (
    <span className="truncate max-w-[120px] text-xs">
      {cats.map(c => c.itemNames.join('+')).join(' / ')}
    </span>
  );
};

const MultiSelectScoreMatrix = ({ selectedMatrixIds, onMatrixIdsChange, disabled }: MultiSelectScoreMatrixProps) => {
  const { data: allMatrices = [], isLoading } = useScoreMatrix();

  const availableMatrices = allMatrices.filter(m => !selectedMatrixIds.includes(m.id));
  const selectedMatrices  = allMatrices.filter(m => selectedMatrixIds.includes(m.id));

  const handleAddMatrix = (matrixId: string) => {
    if (!selectedMatrixIds.includes(matrixId)) {
      onMatrixIdsChange([...selectedMatrixIds, matrixId]);
    }
  };

  const handleRemoveMatrix = (matrixId: string) => {
    onMatrixIdsChange(selectedMatrixIds.filter(id => id !== matrixId));
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando scores...</div>;
  }

  return (
    <div className="space-y-2">
      <Select onValueChange={handleAddMatrix} disabled={disabled || availableMatrices.length === 0}>
        <SelectTrigger className="w-full rounded-[4px] bg-background">
          <SelectValue placeholder={availableMatrices.length === 0 ? "Todos selecionados" : "Selecionar scores..."} />
        </SelectTrigger>
        <SelectContent className="bg-background z-50 max-h-[300px]">
          {availableMatrices.map(matrix => (
            <SelectItem key={matrix.id} value={matrix.id} className="py-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={`rounded-full h-6 px-2 text-xs font-semibold border ${getScoreBadgeColor(matrix.score_number)}`}
                >
                  {matrix.score_number}
                </Badge>
                <MatrixCategoryBadges matrix={matrix} />
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedMatrices.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
          {selectedMatrices.map(matrix => (
            <Badge
              key={matrix.id}
              variant="secondary"
              className="rounded-full text-xs h-6 px-2 pr-1 flex items-center gap-1"
            >
              <span className="font-semibold">{matrix.score_number}</span>
              <span className="text-muted-foreground">•</span>
              <MatrixSummaryLabel matrix={matrix} />
              <button
                onClick={() => handleRemoveMatrix(matrix.id)}
                className="ml-0.5 h-4 w-4 rounded-full hover:bg-muted-foreground/20 flex items-center justify-center transition-colors"
                disabled={disabled}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiSelectScoreMatrix;
