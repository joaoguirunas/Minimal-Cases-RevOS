import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { usePipelines } from '@/hooks/usePipelines';
import { useAllFollowups } from '@/hooks/useFollowups';
import { useWhatsappTemplates } from '@/hooks/useWhatsappTemplates';
import { useWhatsappChannels } from '@/hooks/useWhatsappChannels';
import { useTrackedClicksRealtime } from '@/hooks/useTrackedLinks';
import { useLiveAbExperiment } from '@/hooks/useAbExperiments';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { aggregateClickRates } from '@/lib/bi/clicks';
import StageTimelineCard from './StageTimelineCard';
import AbExperimentPanel from './AbExperimentPanel';

const db = supabase as unknown as SupabaseClient;

/** Aba "Timeline" de /followups: toques por stage no tempo + painel do teste A/B do pipeline. */
const EsteiraTimelineTab = () => {
  const { pipelines, stages: allStages, isLoading } = usePipelines();
  const { data: allFollowups = [], isSuccess: followupsLoaded } = useAllFollowups();
  const { data: templates = [] } = useWhatsappTemplates();
  const { data: channels = [] } = useWhatsappChannels();
  const { isManager } = useUserPermissions();
  const queryClient = useQueryClient();
  useTrackedClicksRealtime();

  const [pipelineId, setPipelineId] = useState<string | undefined>(undefined);
  const [syncing, setSyncing] = useState(false);
  const initialized = useRef(false);

  const activePipelines = useMemo(() => (pipelines ?? []).filter((p) => p.ativo || p.active), [pipelines]);

  const { data: clickRates = [] } = useQuery({
    queryKey: ['tracked-links', 'rates'],
    queryFn: async () => {
      const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await db
        .from('tracked_links')
        .select('source, label, template_name, channel, clicks')
        .gte('created_at', from)
        .limit(10000);
      if (error) throw error;
      return aggregateClickRates(data ?? []);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Seleciona por padrão o pipeline ativo com mais regras de follow-up. Só decide
  // (e trava) depois que useAllFollowups realmente carregou — antes disso
  // allFollowups é sempre [] e "mais regras" viraria sempre "o primeiro ativo".
  useEffect(() => {
    if (initialized.current || activePipelines.length === 0 || !followupsLoaded) return;
    initialized.current = true;
    const counts = new Map<string, number>();
    for (const p of activePipelines) counts.set(p.id, 0);
    for (const f of allFollowups) {
      const stage = (allStages ?? []).find((s) => s.id === f.leads_stages_id);
      if (stage && counts.has(stage.leads_pipelines_id)) {
        counts.set(stage.leads_pipelines_id, (counts.get(stage.leads_pipelines_id) ?? 0) + 1);
      }
    }
    let best = activePipelines[0];
    let bestCount = -1;
    for (const p of activePipelines) {
      const c = counts.get(p.id) ?? 0;
      if (c > bestCount) { bestCount = c; best = p; }
    }
    setPipelineId(best.id);
  }, [activePipelines, allFollowups, allStages, followupsLoaded]);

  const selectedPipeline = activePipelines.find((p) => p.id === pipelineId);

  const pipelineStages = useMemo(
    () => (allStages ?? [])
      .filter((s) => s.leads_pipelines_id === pipelineId && (s.ativo || s.active))
      .sort((a, b) => (a.order_index ?? a.ordem ?? 0) - (b.order_index ?? b.ordem ?? 0)),
    [allStages, pipelineId],
  );

  const pipelineStageIds = useMemo(() => new Set(pipelineStages.map((s) => s.id)), [pipelineStages]);
  const followupsDoPipeline = useMemo(
    () => allFollowups.filter((f) => f.leads_stages_id && pipelineStageIds.has(f.leads_stages_id)),
    [allFollowups, pipelineStageIds],
  );

  const { data: live } = useLiveAbExperiment(pipelineId);
  const defaultChannel = channels.find((c) => c.is_default) ?? channels[0];

  const handleSync = async () => {
    if (!defaultChannel) {
      toast.warning('Nenhum canal WhatsApp padrão configurado');
      return;
    }
    if (!defaultChannel.waba_id) {
      toast.error('WABA ID não configurado no canal. Configure em Canais & Meta.');
      return;
    }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-templates-sync', {
        body: { channel_id: defaultChannel.id },
      });
      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as unknown as { context: Response }).context;
          if (ctx?.json) {
            const body = (await ctx.json()) as Record<string, unknown>;
            msg = (body?.error as string) || (body?.message as string) || msg;
          }
        } catch { /* ignore */ }
        toast.error(msg);
        return;
      }
      if (data?.error) {
        toast.error(data.error as string);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      const { synced, created, updated, deleted: deletedCount } = data as { synced: number; created: number; updated: number; deleted?: number };
      const parts = [`${synced} templates`];
      if (created) parts.push(`${created} novos`);
      if (updated) parts.push(`${updated} atualizados`);
      if (deletedCount) parts.push(`${deletedCount} removidos do Meta`);
      toast.success(`Sincronizado: ${parts.join(', ')}`);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Erro ao sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  if (isLoading) {
    return <p className="py-8 text-center text-[13px] text-muted-foreground">Carregando esteira…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={pipelineId} onValueChange={setPipelineId}>
            <SelectTrigger className="h-8 w-64 text-[13px]">
              <SelectValue placeholder="Selecione um pipeline" />
            </SelectTrigger>
            <SelectContent className="bg-background">
              {activePipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPipeline && (
            <span className="text-[11px] text-muted-foreground">
              {followupsDoPipeline.length} toque{followupsDoPipeline.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {isManager && defaultChannel && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleSync}
            disabled={syncing}
            className="h-[30px] gap-1.5 rounded-lg text-[12px]"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sincronizar templates com a Meta
          </Button>
        )}
      </div>

      {activePipelines.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">Nenhum pipeline ativo.</p>
      ) : !pipelineId ? null : (
        <>
          <AbExperimentPanel pipelineId={pipelineId} followupsDoPipeline={followupsDoPipeline} />

          {pipelineStages.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">Nenhuma etapa ativa neste pipeline.</p>
          ) : (
            <>
              {followupsDoPipeline.length === 0 && (
                <p className="text-[12px] text-muted-foreground">
                  Nenhum toque configurado neste pipeline. Clique no trilho para criar o primeiro.
                </p>
              )}
              <div className="space-y-4">
                {pipelineStages.map((stage) => (
                  <StageTimelineCard
                    key={stage.id}
                    stage={{ id: stage.id, nome: stage.nome }}
                    followups={followupsDoPipeline.filter((f) => f.leads_stages_id === stage.id)}
                    templates={templates}
                    clickRates={clickRates}
                    variants={live?.variants ?? []}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default EsteiraTimelineTab;
