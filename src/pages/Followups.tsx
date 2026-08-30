import { useState, useEffect, useRef, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { usePipelines } from '@/hooks/usePipelines';
import { useAllFollowups, type StageFollowup } from '@/hooks/useFollowups';
import { useAgendamentosFollowups, type MeetingStatus } from '@/hooks/useAgendamentosFollowups';
import { useWhatsappChannels } from '@/hooks/useWhatsappChannels';
import { useMeetingFollowupAutoSetup } from '@/hooks/useMeetingFollowupAutoSetup';
import MultiSelectScoreMatrix from '@/components/followups/MultiSelectScoreMatrix';
import StageFollowupsCard from '@/components/followups/StageFollowupsCard';
import AgendamentoFollowupsCard from '@/components/followups/AgendamentoFollowupsCard';
import { BusinessHoursSettings } from '@/components/followups/BusinessHoursSettings';
import StandardPageLoader from '@/components/loading/StandardPageLoader';
import { ChevronDown, GitBranch, Wand2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const MEETING_STATUSES: MeetingStatus[] = ['agendado', 'compareceu', 'nao_compareceu', 'cancelado', 'realizado'];

const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  agendado:       'Agendado',
  compareceu:     'Compareceu',
  nao_compareceu: 'Não Compareceu',
  cancelado:      'Cancelado',
  realizado:      'Realizado',
};

const MEETING_STATUS_DOT: Record<MeetingStatus, string> = {
  agendado:       'bg-blue-400',
  compareceu:     'bg-emerald-400',
  nao_compareceu: 'bg-amber-400',
  cancelado:      'bg-red-400',
  realizado:      'bg-purple-400',
};

// ── Aba Etapas CRM ──────────────────────────────────────────────────────────

const EtapasCRMTab = () => {
  const [selectedScores, setSelectedScores] = useState<string[]>([]);
  const [expandedPipelines, setExpandedPipelines] = useState<Set<string>>(new Set());
  const initialized = useRef(false);

  const { pipelines, stages: allStages, isLoading } = usePipelines();
  const { data: allFollowups = [] } = useAllFollowups();

  const activePipelines = useMemo(
    () => (pipelines ?? []).filter(p => p.ativo || p.active),
    [pipelines]
  );

  // Open all pipelines on first load
  useEffect(() => {
    if (!initialized.current && activePipelines.length > 0) {
      initialized.current = true;
      setExpandedPipelines(new Set(activePipelines.map(p => p.id)));
    }
  }, [activePipelines]);

  // Single batch query — group followups by stage, respecting score filter
  const followupsByStage = useMemo(() => {
    const map: Record<string, StageFollowup[]> = {};
    const filtered = selectedScores.length > 0
      ? allFollowups.filter(f => f.score_matrix_id && selectedScores.includes(f.score_matrix_id))
      : allFollowups;
    for (const f of filtered) {
      if (!map[f.leads_stages_id]) map[f.leads_stages_id] = [];
      map[f.leads_stages_id].push(f);
    }
    return map;
  }, [allFollowups, selectedScores]);

  const togglePipeline = (id: string) => {
    setExpandedPipelines(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) return <StandardPageLoader size="large" message="Carregando follow-ups..." />;

  return (
    <div className="space-y-4">
      <BusinessHoursSettings />

      {/* Header + score filter */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-foreground">Follow-ups por Etapa do Pipeline</p>
          <p className="text-[12px] text-muted-foreground/60 mt-0.5">
            Disparados automaticamente quando um lead entra em uma etapa
          </p>
        </div>
        <div className="flex-shrink-0 w-48">
          <MultiSelectScoreMatrix
            selectedMatrixIds={selectedScores}
            onMatrixIdsChange={setSelectedScores}
          />
        </div>
      </div>

      {activePipelines.length === 0 ? (
        <Alert>
          <AlertDescription>
            Nenhum pipeline ativo. Configure pipelines nas Configurações para começar.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-2">
          {activePipelines.map(pipeline => {
            const pipelineStages = (allStages ?? [])
              .filter(s => s.leads_pipelines_id === pipeline.id && (s.ativo || s.active))
              .sort((a, b) => (a.order_index ?? a.ordem ?? 0) - (b.order_index ?? b.ordem ?? 0));

            const totalFups = pipelineStages.reduce(
              (sum, s) => sum + (followupsByStage[s.id]?.length ?? 0),
              0
            );
            const isExpanded = expandedPipelines.has(pipeline.id);

            return (
              <div key={pipeline.id} className="border border-border rounded-[4px] overflow-hidden">
                {/* Pipeline header */}
                <button
                  type="button"
                  onClick={() => togglePipeline(pipeline.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-white/[0.035] transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <GitBranch className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" strokeWidth={1.5} />
                    <span className="text-[13px] font-semibold text-foreground">{pipeline.nome}</span>
                    <span className="text-[11px] text-muted-foreground/40">
                      {pipelineStages.length} etapa{pipelineStages.length !== 1 ? 's' : ''}
                    </span>
                    {totalFups > 0 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary leading-none">
                        {totalFups} FUP{totalFups !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-muted-foreground/40 transition-transform duration-200 flex-shrink-0',
                      isExpanded && 'rotate-180'
                    )}
                    strokeWidth={1.5}
                  />
                </button>

                {/* Stages */}
                {isExpanded && (
                  <div className="border-t border-border p-3 space-y-2">
                    {pipelineStages.length === 0 ? (
                      <p className="text-[12px] text-muted-foreground/50 text-center py-4">
                        Nenhuma etapa ativa neste pipeline.
                      </p>
                    ) : (
                      pipelineStages.map(stage => (
                        <StageFollowupsCard
                          key={stage.id}
                          stage={{
                            id: stage.id,
                            nome: stage.nome,
                            ordem: stage.order_index ?? stage.ordem ?? 0,
                          }}
                          followups={followupsByStage[stage.id] ?? []}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Aba Agendamento ──────────────────────────────────────────────────────────

const AgendamentoTab = () => {
  const { data: agendamentoFollowups = [] } = useAgendamentosFollowups();
  const { data: channels = [] } = useWhatsappChannels();
  const autoSetup = useMeetingFollowupAutoSetup();

  const handleAutoSetup = () => {
    const channel = channels[0];
    if (!channel) {
      return;
    }
    autoSetup.mutate(channel.id);
  };

  return (
    <div className="space-y-4">
      <BusinessHoursSettings />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-foreground">Follow-ups por Status de Reunião</p>
          <p className="text-[12px] text-muted-foreground/60 mt-0.5">
            Disparados automaticamente quando o status de uma reunião muda
          </p>
        </div>
        {channels.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleAutoSetup}
            disabled={autoSetup.isPending}
            className="flex-shrink-0 h-[30px] rounded-[4px] text-xs gap-1.5"
          >
            {autoSetup.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Wand2 className="w-3.5 h-3.5" />
            }
            Configurar Automaticamente
          </Button>
        )}
      </div>

      <Tabs defaultValue="agendado">
        <TabsList className="h-[45px] w-full justify-start gap-0 bg-card dark:bg-zinc-950 border border-border rounded-[2px] p-0">
          {MEETING_STATUSES.map(s => {
            const count = agendamentoFollowups.filter(f => f.meeting_status === s).length;
            return (
              <TabsTrigger
                key={s}
                value={s}
                className="flex-1 text-[13px] h-full px-2 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', MEETING_STATUS_DOT[s])} />
                {MEETING_STATUS_LABELS[s]}
                {count > 0 && (
                  <span className="text-[10px] font-medium px-1 leading-none rounded-[2px] bg-white/[0.06] text-muted-foreground/60">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {MEETING_STATUSES.map(s => (
          <TabsContent key={s} value={s} className="mt-3">
            <AgendamentoFollowupsCard
              status={s}
              followups={agendamentoFollowups.filter(f => f.meeting_status === s)}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────

const Followups = () => (
  <Tabs defaultValue="etapas" className="space-y-4">
    <div className="flex items-center justify-between px-4 h-[45px] border-b border-border bg-card dark:bg-zinc-950">
      <TabsList className="h-full bg-transparent gap-1">
        <TabsTrigger value="etapas" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-[13px]">Etapas CRM</TabsTrigger>
        <TabsTrigger value="agendamento" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-[13px]">Agendamento</TabsTrigger>
      </TabsList>
    </div>

    <TabsContent value="etapas"      className="mt-0"><EtapasCRMTab /></TabsContent>
    <TabsContent value="agendamento" className="mt-0"><AgendamentoTab /></TabsContent>
  </Tabs>
);

export default Followups;
