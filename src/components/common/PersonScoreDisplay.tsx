import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

interface PersonScoreDisplayProps {
  scoreMatrix?: {
    score_number: number;
    detail_score?: string;
    profile_score?: string;
    pre_description_score?: string;
    objective_name?: string;
    income_name?: string;
    framing_name?: string;
  } | null;
}

export const PersonScoreDisplay = ({ scoreMatrix }: PersonScoreDisplayProps) => {
  if (!scoreMatrix) {
    return (
      <Card className="border border-border rounded-[2px]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
            <CardTitle>Score</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Score não definido para esta pessoa
          </p>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="border border-border rounded-[2px]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <CardTitle>📊 Score</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className={`text-6xl font-bold ${getScoreColor(scoreMatrix.score_number)}`}>
            {scoreMatrix.score_number}
          </div>
          {scoreMatrix.detail_score && (
            <p className="text-sm text-muted-foreground mt-2">
              Detalhe: {scoreMatrix.detail_score}
            </p>
          )}
        </div>

        <div className="space-y-2 pt-4 border-t">
          <div>
            <span className="text-sm font-medium">Objetivo: </span>
            <span className="text-sm text-muted-foreground">
              {scoreMatrix.objective_name}
            </span>
          </div>
          <div>
            <span className="text-sm font-medium">Renda: </span>
            <span className="text-sm text-muted-foreground">
              {scoreMatrix.income_name}
            </span>
          </div>
          <div>
            <span className="text-sm font-medium">Enquadramento: </span>
            <span className="text-sm text-muted-foreground">
              {scoreMatrix.framing_name}
            </span>
          </div>
        </div>

        {scoreMatrix.profile_score && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-1">Perfil:</p>
            <p className="text-sm text-muted-foreground">{scoreMatrix.profile_score}</p>
          </div>
        )}

        {scoreMatrix.pre_description_score && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-1">Descrição:</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {scoreMatrix.pre_description_score}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
