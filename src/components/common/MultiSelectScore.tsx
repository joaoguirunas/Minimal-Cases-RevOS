import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from 'lucide-react';

interface MultiSelectScoreProps {
  selectedScores: number[];
  onScoresChange: (scores: number[]) => void;
  disabled?: boolean;
}

const SCORE_OPTIONS = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
  { value: 6, label: "6" },
  { value: 7, label: "7" },
  { value: 8, label: "8" },
  { value: 9, label: "9" },
  { value: 10, label: "10" },
  { value: 0, label: "Sem score" },
];

const MultiSelectScore = ({ selectedScores, onScoresChange, disabled }: MultiSelectScoreProps) => {
  const availableScores = SCORE_OPTIONS.filter(score => 
    !selectedScores.includes(score.value)
  );
  
  const selectedScoresData = SCORE_OPTIONS.filter(score => 
    selectedScores.includes(score.value)
  );

  const handleAddScore = (scoreValue: string) => {
    const score = parseInt(scoreValue);
    if (!selectedScores.includes(score)) {
      onScoresChange([...selectedScores, score]);
    }
  };

  const handleRemoveScore = (scoreValue: number) => {
    onScoresChange(selectedScores.filter(score => score !== scoreValue));
  };

  return (
    <div className="space-y-2">
      <Select onValueChange={handleAddScore} disabled={disabled || availableScores.length === 0}>
        <SelectTrigger className="w-full rounded-[4px]">
          <SelectValue placeholder={
            availableScores.length === 0 
              ? "Todos os scores selecionados" 
              : "Selecionar scores..."
          } />
        </SelectTrigger>
        <SelectContent>
          {availableScores.map((score) => (
            <SelectItem key={score.value} value={score.value.toString()}>
              {score.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedScoresData.length > 0 && (
        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
          {selectedScoresData.map((score) => (
            <Badge key={score.value} variant="secondary" className="rounded-[4px] text-xs h-6 px-2">
              {score.label}
              <button
                onClick={() => handleRemoveScore(score.value)}
                className="ml-1 h-3 w-3 rounded-full hover:bg-muted-foreground/10 flex items-center justify-center"
                disabled={disabled}
              >
                <X className="h-2 w-2" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiSelectScore;