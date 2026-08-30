import { lazy, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, StickyNote, Calendar, Target, ListChecks, Brain } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { type Negocio } from '@/hooks/useNegocios';

const NegocioConversa = lazy(() => import('@/components/negocios/NegocioConversa'));
const NegocioNotas = lazy(() => import('@/components/negocios/NegocioNotas'));
const NegocioReunioes = lazy(() => import('@/components/negocios/NegocioReunioes'));
const NegocioScoreSection = lazy(() => import('@/components/negocios/NegocioScoreSection').then(m => ({ default: m.NegocioScoreSection })));
const CamposExtrasSection = lazy(() => import('@/components/negocios/CamposExtrasSection'));
const QualificacaoIASection = lazy(() => import('@/components/negocios/QualificacaoIASection'));

interface MobileNegocioTabsProps {
  negocioId: string;
  clientName?: string;
  leadValue?: number;
  pessoaId?: string;
  scoreMatrixId?: string | null;
  score?: number | null;
  pipelineId?: string;
  pessoaData?: Negocio['pessoa'] | null;
}

const TabFallback = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

export const MobileNegocioTabs = ({
  negocioId,
  clientName,
  leadValue,
  pessoaId,
  scoreMatrixId,
  score,
  pipelineId,
  pessoaData,
}: MobileNegocioTabsProps) => {
  return (
    <Tabs defaultValue="conversa" className="flex-1 flex flex-col">
      <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-2 gap-1 overflow-x-auto snap-x">
        <TabsTrigger value="conversa" className="gap-1.5 min-h-[44px] text-xs shrink-0 snap-start">
          <MessageSquare className="h-3.5 w-3.5" />
          Conversa
        </TabsTrigger>
        <TabsTrigger value="notas" className="gap-1.5 min-h-[44px] text-xs shrink-0 snap-start">
          <StickyNote className="h-3.5 w-3.5" />
          Notas
        </TabsTrigger>
        <TabsTrigger value="reunioes" className="gap-1.5 min-h-[44px] text-xs shrink-0 snap-start">
          <Calendar className="h-3.5 w-3.5" />
          Reuniões
        </TabsTrigger>
        <TabsTrigger value="score" className="gap-1.5 min-h-[44px] text-xs shrink-0 snap-start">
          <Target className="h-3.5 w-3.5" />
          Score
        </TabsTrigger>
        <TabsTrigger value="campos" className="gap-1.5 min-h-[44px] text-xs shrink-0 snap-start">
          <ListChecks className="h-3.5 w-3.5" />
          Campos
        </TabsTrigger>
        <TabsTrigger value="qualificacao" className="gap-1.5 min-h-[44px] text-xs shrink-0 snap-start">
          <Brain className="h-3.5 w-3.5" />
          Q.IA
        </TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-y-auto">
        <TabsContent value="conversa" className="mt-0 h-full">
          <Suspense fallback={<TabFallback />}>
            <NegocioConversa negocioId={negocioId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="notas" className="mt-0 p-4">
          <Suspense fallback={<TabFallback />}>
            <NegocioNotas negocioId={negocioId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="reunioes" className="mt-0 p-4">
          <Suspense fallback={<TabFallback />}>
            <NegocioReunioes
              negocioId={negocioId}
              clientName={clientName}
              leadValue={leadValue}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="score" className="mt-0 p-4">
          <Suspense fallback={<TabFallback />}>
            {pessoaId && (
              <NegocioScoreSection
                pessoaId={pessoaId}
                scoreMatrixId={scoreMatrixId}
                score={score}
              />
            )}
          </Suspense>
        </TabsContent>

        <TabsContent value="campos" className="mt-0 p-4">
          <Suspense fallback={<TabFallback />}>
            {pipelineId && (
              <CamposExtrasSection
                leadId={negocioId}
                pipelineId={pipelineId}
                category="all"
              />
            )}
          </Suspense>
        </TabsContent>

        <TabsContent value="qualificacao" className="mt-0 p-4">
          <Suspense fallback={<TabFallback />}>
            <QualificacaoIASection data={pessoaData || null} />
          </Suspense>
        </TabsContent>
      </div>
    </Tabs>
  );
};
