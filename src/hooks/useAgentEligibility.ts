import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Mirrors the P1→P8 matching logic from ai-agent-execute edge function.
// Returns which agent would respond to this person's next message
// and whether all criteria (pipeline, stage, channel, score) are met.

export interface AgentEligibility {
  agent: { id: string; name: string } | null;
  loading: boolean;
  hasPipeline: boolean;      // person has active lead with pipeline
  pipelineName: string | null;
  stageName: string | null;
  scoreOk: boolean;          // score gate passes (or no filter configured)
  channel: string | null;    // channel used for matching ('whatsapp' | null)
  matchLevel: 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | 'p7' | 'p8' | null; // how specific the match was
  diagnostics: string[];     // human-readable reasons if no agent found
}

async function resolveEligibility(personId: string): Promise<Omit<AgentEligibility, 'loading'>> {
  const empty: Omit<AgentEligibility, 'loading'> = {
    agent: null, hasPipeline: false, pipelineName: null, stageName: null,
    scoreOk: true, channel: null, matchLevel: null, diagnostics: [],
  };

  // 1. Active lead + person score
  const [{ data: leads }, { data: person }] = await Promise.all([
    supabase
      .from('leads')
      .select('id, leads_pipelines_id, leads_stages_id, leads_pipelines!leads_leads_pipelines_id_fkey(name), leads_stages!leads_leads_stages_id_fkey(name)')
      .eq('people_id', personId)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('clients_people')
      .select('score, whatsapp, instagram_id')
      .eq('id', personId)
      .single(),
  ]);

  const lead = leads?.[0] ?? null;
  const whatsapp = person?.whatsapp ?? null;
  const instagramId = (person as any)?.instagram_id ?? null;

  if (!lead) {
    return { ...empty, diagnostics: ['Sem lead ativo neste pipeline'] };
  }

  const pipelineId = lead.leads_pipelines_id as string | null;
  const stageId = lead.leads_stages_id as string | null;
  const pipelineName = (lead.leads_pipelines as any)?.name ?? null;
  const stageName = (lead.leads_stages as any)?.name ?? null;
  // Build channel list from available identifiers (try instagram first for IG contacts)
  const availableChannels: string[] = [];
  if (instagramId) availableChannels.push('instagram_dm');
  if (whatsapp) availableChannels.push('whatsapp');
  // Primary channel for display — prefer the first available
  const channel = availableChannels[0] ?? null;

  if (!pipelineId) {
    return { ...empty, hasPipeline: false, pipelineName, stageName, diagnostics: ['Lead sem pipeline configurado'] };
  }

  // 2. Try P1→P4 matching (same logic as edge function)
  const baseSelect = 'id, name, channel_types, stage_ids, score_matrix_ids, score_allow_empty';

  type AgentRow = {
    id: string;
    name: string;
    channel_types: string[];
    stage_ids: string[];
    score_matrix_ids: string[];
    score_allow_empty: boolean;
  };

  let agent: AgentRow | null = null;
  let matchLevel: 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | 'p7' | 'p8' | null = null;

  // P1: channel + pipeline + stage (try each available channel)
  if (availableChannels.length > 0 && pipelineId && stageId) {
    for (const ch of availableChannels) {
      const { data } = await supabase
        .from('ai_agents')
        .select(baseSelect)
        .eq('active', true)
        .eq('is_template', false)
        .eq('pipeline_id', pipelineId)
        .contains('channel_types', [ch])
        .contains('stage_ids', [stageId])
        .limit(1)
        .maybeSingle();
      if (data) { agent = data as AgentRow; matchLevel = 'p1'; break; }
    }
  }

  // P2: channel + pipeline (no stage filter, try each available channel)
  if (!agent && availableChannels.length > 0 && pipelineId) {
    for (const ch of availableChannels) {
      const { data } = await supabase
        .from('ai_agents')
        .select(baseSelect)
        .eq('active', true)
        .eq('is_template', false)
        .eq('pipeline_id', pipelineId)
        .contains('channel_types', [ch])
        .eq('stage_ids', '{}')
        .limit(1)
        .maybeSingle();
      if (data) { agent = data as AgentRow; matchLevel = 'p2'; break; }
    }
  }

  // P3: pipeline + stage (only agents with NO channel constraint)
  if (!agent && pipelineId && stageId) {
    const { data } = await supabase
      .from('ai_agents')
      .select(baseSelect)
      .eq('active', true)
      .eq('is_template', false)
      .eq('pipeline_id', pipelineId)
      .contains('stage_ids', [stageId])
      .eq('channel_types', '{}')
      .limit(1)
      .maybeSingle();
    if (data) { agent = data as AgentRow; matchLevel = 'p3'; }
  }

  // P4: pipeline catch-all (only agents with NO channel AND NO stage constraints)
  if (!agent && pipelineId) {
    const { data } = await supabase
      .from('ai_agents')
      .select(baseSelect)
      .eq('active', true)
      .eq('is_template', false)
      .eq('pipeline_id', pipelineId)
      .eq('channel_types', '{}')
      .eq('stage_ids', '{}')
      .limit(1)
      .maybeSingle();
    if (data) { agent = data as AgentRow; matchLevel = 'p4'; }
  }

  // P5-P8: Same priorities but via pipeline_ids array (multi-pipeline agents)
  // P5: channel + pipeline_ids[] + stage
  if (!agent && availableChannels.length > 0 && pipelineId && stageId) {
    for (const ch of availableChannels) {
      const { data } = await (supabase as any)
        .from('ai_agents')
        .select(baseSelect)
        .eq('active', true)
        .eq('is_template', false)
        .contains('pipeline_ids', [pipelineId])
        .contains('channel_types', [ch])
        .contains('stage_ids', [stageId])
        .limit(1)
        .maybeSingle();
      if (data) { agent = data as AgentRow; matchLevel = 'p5'; break; }
    }
  }

  // P6: channel + pipeline_ids[] (no stage)
  if (!agent && availableChannels.length > 0 && pipelineId) {
    for (const ch of availableChannels) {
      const { data } = await (supabase as any)
        .from('ai_agents')
        .select(baseSelect)
        .eq('active', true)
        .eq('is_template', false)
        .contains('pipeline_ids', [pipelineId])
        .contains('channel_types', [ch])
        .eq('stage_ids', '{}')
        .limit(1)
        .maybeSingle();
      if (data) { agent = data as AgentRow; matchLevel = 'p6'; break; }
    }
  }

  // P7: pipeline_ids[] + stage (only agents with NO channel constraint)
  if (!agent && pipelineId && stageId) {
    const { data } = await (supabase as any)
      .from('ai_agents')
      .select(baseSelect)
      .eq('active', true)
      .eq('is_template', false)
      .contains('pipeline_ids', [pipelineId])
      .contains('stage_ids', [stageId])
      .eq('channel_types', '{}')
      .limit(1)
      .maybeSingle();
    if (data) { agent = data as AgentRow; matchLevel = 'p7'; }
  }

  // P8: pipeline_ids[] catch-all (only agents with NO channel AND NO stage constraints)
  if (!agent && pipelineId) {
    const { data } = await (supabase as any)
      .from('ai_agents')
      .select(baseSelect)
      .eq('active', true)
      .eq('is_template', false)
      .contains('pipeline_ids', [pipelineId])
      .eq('channel_types', '{}')
      .eq('stage_ids', '{}')
      .limit(1)
      .maybeSingle();
    if (data) { agent = data as AgentRow; matchLevel = 'p8'; }
  }

  if (!agent) {
    const diagnostics: string[] = [];
    if (availableChannels.length === 0) diagnostics.push('Sem WhatsApp ou Instagram configurado');
    diagnostics.push(`Nenhum agente configurado para: pipeline "${pipelineName ?? pipelineId}"${stageId ? ` / etapa "${stageName ?? stageId}"` : ''}`);
    return { ...empty, hasPipeline: true, pipelineName, stageName, channel, diagnostics };
  }

  // 3. Check G2 score gate
  const hasScoreFilter = (agent.score_matrix_ids?.length > 0) || agent.score_allow_empty;
  if (hasScoreFilter) {
    const personScore = person?.score ? Number(person.score) : null;
    const hasNoScore = personScore === null || personScore === 0;

    let qualifies = false;
    if (hasNoScore && agent.score_allow_empty) qualifies = true;
    if (!qualifies && !hasNoScore && agent.score_matrix_ids?.length > 0) {
      const { data: matrices } = await supabase
        .from('score_matrix')
        .select('score_number')
        .in('id', agent.score_matrix_ids);
      const allowedScores = (matrices ?? []).map((m: any) => Number(m.score_number));
      if (allowedScores.includes(personScore!)) qualifies = true;
    }

    if (!qualifies) {
      return {
        agent: { id: agent.id, name: agent.name },
        hasPipeline: true, pipelineName, stageName, channel,
        scoreOk: false, matchLevel,
        diagnostics: [`Agente "${agent.name}" encontrado, mas score do lead não atende à matriz de score configurada`],
      };
    }
  }

  return {
    agent: { id: agent.id, name: agent.name },
    hasPipeline: true, pipelineName, stageName, channel,
    scoreOk: true, matchLevel,
    diagnostics: [],
  };
}

export function useAgentEligibility(personId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ['agent-eligibility', personId],
    queryFn: () => resolveEligibility(personId!),
    enabled: !!personId,
    staleTime: 30_000, // 30s — eligibility can change when lead moves stage
  });

  return {
    loading: isLoading,
    agent: data?.agent ?? null,
    hasPipeline: data?.hasPipeline ?? false,
    pipelineName: data?.pipelineName ?? null,
    stageName: data?.stageName ?? null,
    scoreOk: data?.scoreOk ?? true,
    channel: data?.channel ?? null,
    matchLevel: data?.matchLevel ?? null,
    diagnostics: data?.diagnostics ?? [],
  };
}
