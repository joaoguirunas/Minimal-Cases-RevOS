import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScoreCadastrosBase } from './score/ScoreCadastrosBase';
import { ScoreMatriz } from './score/ScoreMatriz';
import { Target, Grid3x3 } from 'lucide-react';

export const ScoreConfig = () => {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-[15px] font-semibold text-foreground">Sistema de Score</h1>
        <p className="text-[13px] text-muted-foreground/70 mt-0.5">
          Configure objetivos, faixas de investimento, segmentos e combinações da matriz de score
        </p>
      </div>

      <Tabs defaultValue="cadastros" className="w-full">
        <TabsList className="h-[30px] bg-muted p-0.5">
          <TabsTrigger value="cadastros" className="flex items-center gap-1.5 px-4 h-[30px] text-[13px]">
            <Target className="w-3.5 h-3.5" />
            Cadastros Base
          </TabsTrigger>
          <TabsTrigger value="matriz" className="flex items-center gap-1.5 px-4 h-[30px] text-[13px]">
            <Grid3x3 className="w-3.5 h-3.5" />
            Matriz de Score
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cadastros" className="mt-6">
          <ScoreCadastrosBase />
        </TabsContent>

        <TabsContent value="matriz" className="mt-6">
          <ScoreMatriz />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ScoreConfig;
