import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TestPerson {
  id: string;
  name: string;
  whatsapp: string | null;
  email: string | null;
  ai_enabled: boolean;
  ai_processing_lock: boolean;
  lead: {
    id: string;
    title: string;
    control: string | null;
    status: string;
    pipeline_id: string | null;
    pipeline_name: string;
    stage_id: string | null;
    stage_name: string;
    stage_color: string | null;
  };
}

export interface TestMessage {
  id: string;
  content: string;
  from_contact: string; // 'cliente' | 'agente_ia' | ...
  channel: string;
  created_at: string;
  message_type: string;
}

export interface TestExecution {
  id: string;
  ai_agent_id: string;
  agent_name: string | null;
  people_id: string;
  person_name: string | null;
  execution_status: string;
  execution_duration_ms: number | null;
  tools_used: unknown[];
  response_data: unknown;
  error_message: string | null;
  created_at: string;
}

// ── People with active leads ───────────────────────────────────────────────────

export function usePeopleWithActiveLeads(search: string) {
  return useQuery({
    queryKey: ['test-people-v2', search],
    queryFn: async () => {
      // 1. Active leads
      const { data: leads, error: leadsErr } = await supabase
        .from('leads')
        .select('id, title, control, status, people_id, leads_stages_id, leads_pipelines_id')
        .eq('status', 'in_progress')
        .not('people_id', 'is', null)
        .limit(300);
      if (leadsErr) throw leadsErr;
      if (!leads || leads.length === 0) return [];

      const peopleIds = [...new Set(leads.map(l => l.people_id as string))];
      const stageIds  = [...new Set(leads.map(l => l.leads_stages_id).filter(Boolean))] as string[];
      const pipelineIds = [...new Set(leads.map(l => l.leads_pipelines_id).filter(Boolean))] as string[];

      // 2. People, stages, pipelines in parallel
      const [
        { data: people },
        { data: stages },
        { data: pipelines },
      ] = await Promise.all([
        supabase.from('clients_people')
          .select('id, name, whatsapp, email, ai_enabled, ai_processing_lock')
          .in('id', peopleIds),
        stageIds.length
          ? supabase.from('leads_stages').select('id, name, color').in('id', stageIds)
          : Promise.resolve({ data: [] }),
        pipelineIds.length
          ? supabase.from('leads_pipelines').select('id, name').in('id', pipelineIds)
          : Promise.resolve({ data: [] }),
      ]);

      const peopleMap   = Object.fromEntries((people ?? []).map(p => [p.id, p]));
      const stageMap    = Object.fromEntries((stages ?? []).map(s => [s.id, s]));
      const pipelineMap = Object.fromEntries((pipelines ?? []).map(p => [p.id, p as { id: string; name: string }]));

      // Deduplicate by person (first lead wins)
      const seen = new Set<string>();
      const result: TestPerson[] = [];

      for (const lead of leads) {
        const pid = lead.people_id as string;
        if (seen.has(pid)) continue;
        const person = peopleMap[pid];
        if (!person) continue;
        if (search && !person.name?.toLowerCase().includes(search.toLowerCase())) continue;
        seen.add(pid);

        const stage    = stageMap[lead.leads_stages_id ?? ''];
        const pipeline = pipelineMap[lead.leads_pipelines_id ?? ''];

        result.push({
          id: person.id,
          name: person.name ?? '',
          whatsapp: person.whatsapp ?? null,
          email: person.email ?? null,
          ai_enabled: person.ai_enabled !== false,
          ai_processing_lock: person.ai_processing_lock === true,
          lead: {
            id: lead.id,
            title: lead.title ?? '',
            control: lead.control ?? null,
            status: lead.status,
            pipeline_id: lead.leads_pipelines_id ?? null,
            pipeline_name: pipeline?.name ?? '—',
            stage_id: lead.leads_stages_id ?? null,
            stage_name: stage?.name ?? '—',
            stage_color: stage?.color ?? null,
          },
        });
      }

      return result.sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 0,
  });
}

// ── Messages (realtime) ────────────────────────────────────────────────────────

export function usePersonMessages(personId: string | null) {
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Initial load
  const { data: initial } = useQuery({
    queryKey: ['test-messages', personId],
    queryFn: async () => {
      if (!personId) return [];
      const { data } = await supabase
        .from('messages')
        .select('id, content, from_contact, channel, created_at, message_type')
        .eq('people_id', personId)
        .order('created_at', { ascending: true })
        .limit(100);
      return (data ?? []).map(m => ({ ...m, id: String(m.id) })) as TestMessage[];
    },
    enabled: !!personId,
  });

  useEffect(() => {
    if (initial) setMessages(initial);
  }, [initial]);

  // Realtime subscription
  useEffect(() => {
    if (!personId) { setMessages([]); return; }

    channelRef.current?.unsubscribe();

    channelRef.current = supabase
      .channel(`test-msgs-${personId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `people_id=eq.${personId}`,
      }, (payload) => {
        const raw = payload.new as Record<string, unknown>;
        const msg: TestMessage = { ...(raw as TestMessage), id: String(raw.id) };
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      })
      .subscribe();

    return () => { channelRef.current?.unsubscribe(); };
  }, [personId]);

  return messages;
}

// ── Execution activity (realtime) ─────────────────────────────────────────────

export function useSessionActivity(sessionStart: Date | null) {
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const sessionStartRef = useRef(sessionStart);

  const { data: initial } = useQuery({
    queryKey: ['test-activity', sessionStart?.toISOString()],
    queryFn: async () => {
      if (!sessionStart) return [];
      const { data } = await supabase
        .from('ai_agents_execution_log')
        .select(`
          id, ai_agent_id, people_id, execution_status, execution_duration_ms,
          tools_used, response_data, error_message, created_at,
          ai_agents!ai_agents_execution_log_ai_agent_id_fkey(name),
          clients_people!ai_agents_execution_log_people_id_fkey(name)
        `)
        .gte('created_at', sessionStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);
      return (data ?? []).map((d) => {
        const row = d as Record<string, unknown>;
        return {
          ...row,
          agent_name: (row.ai_agents as { name?: string } | null)?.name ?? null,
          person_name: (row.clients_people as { name?: string } | null)?.name ?? null,
        } as TestExecution;
      });
    },
    enabled: !!sessionStart,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (initial) setExecutions(initial);
  }, [initial]);

  useEffect(() => {
    channelRef.current?.unsubscribe();

    channelRef.current = supabase
      .channel('test-activity-global')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ai_agents_execution_log',
      }, async (payload) => {
        const raw = payload.new as Record<string, unknown>;
        // only include entries from this session
        if (sessionStartRef.current && new Date(raw.created_at as string) < sessionStartRef.current) return;

        // Fetch agent + person names since realtime events don't include JOIN data
        const [agentRes, personRes] = await Promise.all([
          raw.ai_agent_id
            ? supabase.from('ai_agents').select('name').eq('id', raw.ai_agent_id).maybeSingle()
            : Promise.resolve({ data: null }),
          raw.people_id
            ? supabase.from('clients_people').select('name').eq('id', raw.people_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        const exec: TestExecution = {
          ...raw,
          agent_name: (agentRes.data as { name?: string } | null)?.name ?? null,
          person_name: (personRes.data as { name?: string } | null)?.name ?? null,
        };
        setExecutions(prev => {
          if (prev.some(e => e.id === exec.id)) return prev;
          return [exec, ...prev];
        });
      })
      .subscribe();

    return () => { channelRef.current?.unsubscribe(); };
  }, []);

  return executions;
}

// ── Agents available for a person's lead ──────────────────────────────────────

export interface TestAgent {
  id: string;
  name: string;
  template_type: string | null;
}

export function useAgentsForLead(pipelineId: string | null, stageId: string | null) {
  return useQuery({
    queryKey: ['test-agents-for-lead', pipelineId, stageId],
    queryFn: async (): Promise<TestAgent[]> => {
      if (!pipelineId) return [];
      const client = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };
      const { data } = await (client.from('ai_agents') as ReturnType<typeof supabase.from>)
        .select('id, name, template_type')
        .overlaps('pipeline_ids', [pipelineId])
        .eq('active', true)
        .eq('is_template', false)
        .order('name', { ascending: true });
      return (data ?? []).map(a => ({ id: a.id, name: a.name, template_type: a.template_type }));
    },
    enabled: !!pipelineId,
    staleTime: 30_000,
  });
}

// ── Live lead state (realtime UPDATE subscription) ────────────────────────────

interface LiveLeadState {
  control: string | null;
  stage_name: string;
  stage_color: string | null;
  stage_id: string | null;
  pipeline_id: string | null;
}

export function useLiveLeadState(leadId: string | null) {
  const [liveState, setLiveState] = useState<LiveLeadState | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!leadId) { setLiveState(null); return; }

    channelRef.current?.unsubscribe();
    channelRef.current = supabase
      .channel(`test-live-lead-${leadId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'leads',
        filter: `id=eq.${leadId}`,
      }, async (payload) => {
        const updated = payload.new as { control?: string | null; leads_stages_id?: string | null; leads_pipelines_id?: string | null };
        let stageName = '—';
        let stageColor: string | null = null;
        if (updated.leads_stages_id) {
          const { data } = await supabase
            .from('leads_stages')
            .select('name, color')
            .eq('id', updated.leads_stages_id)
            .maybeSingle();
          if (data) { stageName = data.name; stageColor = (data as { name: string; color?: string | null }).color ?? null; }
        }
        setLiveState({
          control: updated.control ?? null,
          stage_name: stageName,
          stage_color: stageColor,
          stage_id: updated.leads_stages_id ?? null,
          pipeline_id: updated.leads_pipelines_id ?? null,
        });
      })
      .subscribe();

    return () => { channelRef.current?.unsubscribe(); };
  }, [leadId]);

  return liveState;
}

// ── Session state ──────────────────────────────────────────────────────────────

export function useTestSession() {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<TestPerson | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>('whatsapp');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionStart, setSessionStart] = useState(() => new Date());
  const queryClient = useQueryClient();

  const selectPerson = useCallback((person: TestPerson) => {
    setSelectedPersonId(person.id);
    setSelectedPerson(person);
    setSelectedAgentId(null); // reset agent selection on person change
    // Auto-select first available channel
    if (person.whatsapp) setSelectedChannel('whatsapp');
    else if (person.email) setSelectedChannel('email');
  }, []);

  const clearSession = useCallback(() => {
    setSelectedPersonId(null);
    setSelectedPerson(null);
    setSelectedAgentId(null);
  }, []);

  const clearHistory = useCallback(async () => {
    if (!selectedPersonId) return;
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('people_id', selectedPersonId);
    if (error) {
      toast({ title: 'Erro ao limpar histórico', description: error.message, variant: 'destructive' });
      return;
    }
    setSessionStart(new Date());
    await queryClient.invalidateQueries({ queryKey: ['test-messages', selectedPersonId] });
    toast({ title: 'Histórico limpo', description: 'Todas as mensagens do Testador removidas.' });
  }, [selectedPersonId, setSessionStart, queryClient]);

  const sendMessage = useCallback(async (
    content: string,
    media?: { message_type: string; media_url: string; media_metadata?: object },
  ) => {
    if (!selectedPersonId || (!content.trim() && !media)) return;

    setIsProcessing(true);
    try {
      // 1. INSERT message as inbound — keeps conversation history visible in chat
      const { error: msgErr } = await supabase.from('messages').insert({
        people_id: selectedPersonId,
        channel: selectedChannel,
        content: content.trim(),
        from_contact: 'cliente',
        source_type: 'inbound',
        message_type: media?.message_type ?? 'texto',
        media_url: media?.media_url ?? null,
        media_metadata: media?.media_metadata ?? null,
        status: 'delivered',
      });

      if (msgErr) {
        toast({ title: 'Erro ao enviar mensagem', description: msgErr.message, variant: 'destructive' });
        return;
      }

      // 2. Invoke in test_mode — bypasses ai_processing_lock, G1 (ai_enabled),
      //    G2 (score gate), and buffer reading. Uses direct_message content.
      const { data: invokeData, error: invokeErr } = await supabase.functions.invoke('ai-agent-execute', {
        body: {
          people_id: selectedPersonId,
          test_mode: true,
          direct_message: content.trim(),
          channel_type: selectedChannel,
          ...(selectedAgentId ? { agent_id: selectedAgentId } : {}),
        },
      });

      if (invokeErr) {
        let msg = invokeErr.message;
        try {
          const ctx = (invokeErr as unknown as { context?: Response }).context;
          if (ctx) { const body = await ctx.clone().json(); if (body?.error) msg = body.error; }
        } catch { /* ignore */ }
        toast({ title: 'Erro no agente', description: msg, variant: 'destructive' });
        return;
      }

      const result = invokeData as { status?: string; error?: string } | null;
      if (result?.status !== 'ok') {
        toast({ title: 'Agente não respondeu', description: result?.error ?? 'Resposta inválida', variant: 'destructive' });
      }
    } catch (err) {
      console.error('[useTestSession] sendMessage error:', err);
      toast({ title: 'Erro inesperado', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPersonId, selectedChannel, selectedAgentId]);

  return {
    selectedPersonId,
    selectedPerson,
    selectedChannel,
    setSelectedChannel,
    selectedAgentId,
    setSelectedAgentId,
    isProcessing,
    sessionStart,
    selectPerson,
    clearSession,
    clearHistory,
    sendMessage,
  };
}

// ── Dev mode: execution log ───────────────────────────────────────────────────
// Mostra as execuções reais do agente (prompt renderizado, tools chamadas,
// tokens) — usado no painel "Modo Dev" da Central de Testes para validação de
// prompts sem precisar abrir os logs do banco manualmente.

export interface ToolCallDetail {
  name: string;
  args: Record<string, unknown>;
  result: string;
}

export interface TestExecutionLog {
  id: string;
  ai_agent_id: string;
  agent_name: string | null;
  execution_status: string;
  execution_duration_ms: number | null;
  error_message: string | null;
  prompt_rendered: string;
  tools_used: string[] | null;
  tool_call_details: ToolCallDetail[];
  response_text: string | null;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number; cached_tokens?: number } | null;
  created_at: string;
}

const EXEC_LOG_LIMIT = 20;

function mapExecutionRow(row: Record<string, unknown>): TestExecutionLog {
  const responseData = (row.response_data ?? {}) as Record<string, unknown>;
  return {
    id: row.id as string,
    ai_agent_id: row.ai_agent_id as string,
    agent_name: (row as { ai_agents?: { name?: string } | null }).ai_agents?.name ?? null,
    execution_status: row.execution_status as string,
    execution_duration_ms: (row.execution_duration_ms as number | null) ?? null,
    error_message: (row.error_message as string | null) ?? null,
    prompt_rendered: (row.prompt_rendered as string) ?? '',
    tools_used: (row.tools_used as string[] | null) ?? null,
    tool_call_details: (responseData.tool_call_details as ToolCallDetail[] | undefined) ?? [],
    response_text: (responseData.text as string | undefined) ?? null,
    usage: (responseData.usage as TestExecutionLog['usage']) ?? null,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
  };
}

export function useTestExecutionLog(peopleId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['test-execution-log', peopleId] as const;

  const query = useQuery({
    queryKey,
    enabled: !!peopleId,
    refetchInterval: 4000, // fallback caso o evento realtime não chegue
    queryFn: async (): Promise<TestExecutionLog[]> => {
      const { data, error } = await supabase
        .from('ai_agents_execution_log')
        .select('*, ai_agents(name)')
        .eq('people_id', peopleId!)
        .order('created_at', { ascending: false })
        .limit(EXEC_LOG_LIMIT);
      if (error) throw error;
      return (data ?? []).map(row => mapExecutionRow(row as Record<string, unknown>));
    },
  });

  useEffect(() => {
    if (!peopleId) return;
    const channel = supabase
      .channel(`test-exec-log-${peopleId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ai_agents_execution_log',
        filter: `people_id=eq.${peopleId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peopleId]);

  return query;
}

// ── Testador auto-load ─────────────────────────────────────────────────────────
// Finds or creates a fixed "Testador" person (whatsapp=TEST_CENTRAL) with an
// active lead. Used by CentralDeTestes to auto-select on mount.

const TESTADOR_WA = 'TEST_CENTRAL';

export function useEnsureTestador() {
  return useQuery({
    queryKey: ['testador-person'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<TestPerson> => {
      // 1. Find or create person
      let { data: person } = await supabase
        .from('clients_people')
        .select('id, name, whatsapp, email, ai_enabled, ai_processing_lock')
        .eq('whatsapp', TESTADOR_WA)
        .maybeSingle();

      if (!person) {
        const { data, error } = await supabase
          .from('clients_people')
          .insert({ name: 'Testador', whatsapp: TESTADOR_WA, ai_enabled: true, status: 'active' })
          .select('id, name, whatsapp, email, ai_enabled, ai_processing_lock')
          .single();
        if (error) throw error;
        person = data;
      }

      // 2. Find or create active lead
      let { data: lead } = await supabase
        .from('leads')
        .select('id, title, control, status, leads_stages_id, leads_pipelines_id')
        .eq('people_id', person!.id)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lead) {
        const { data: pipelines } = await supabase
          .from('leads_pipelines')
          .select('id, name')
          .eq('active', true)
          .order('created_at', { ascending: true })
          .limit(1);

        const pipeline = pipelines?.[0] ?? null;
        let stageId: string | null = null;

        if (pipeline) {
          const { data: stages } = await supabase
            .from('leads_stages')
            .select('id')
            .eq('leads_pipelines_id', pipeline.id)
            .eq('active', true)
            .order('order_index', { ascending: true })
            .limit(1);
          stageId = stages?.[0]?.id ?? null;
        }

        const { data: newLead, error: leadErr } = await supabase
          .from('leads')
          .insert({
            people_id: person!.id,
            leads_pipelines_id: pipeline?.id ?? null,
            leads_stages_id: stageId,
            status: 'in_progress',
            title: 'Testador',
          })
          .select('id, title, control, status, leads_stages_id, leads_pipelines_id')
          .single();
        if (leadErr) throw leadErr;
        lead = newLead;
      }

      // 3. Resolve stage + pipeline names
      const [{ data: stageRow }, { data: pipelineRow }] = await Promise.all([
        lead!.leads_stages_id
          ? supabase.from('leads_stages').select('name, color').eq('id', lead!.leads_stages_id).maybeSingle()
          : Promise.resolve({ data: null }),
        lead!.leads_pipelines_id
          ? supabase.from('leads_pipelines').select('name').eq('id', lead!.leads_pipelines_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      return {
        id: person!.id,
        name: person!.name ?? 'Testador',
        whatsapp: person!.whatsapp ?? null,
        email: person!.email ?? null,
        ai_enabled: person!.ai_enabled !== false,
        ai_processing_lock: person!.ai_processing_lock === true,
        lead: {
          id: lead!.id,
          title: lead!.title ?? 'Testador',
          control: lead!.control ?? null,
          status: lead!.status,
          pipeline_id: lead!.leads_pipelines_id ?? null,
          pipeline_name: (pipelineRow as { name: string } | null)?.name ?? '—',
          stage_id: lead!.leads_stages_id ?? null,
          stage_name: (stageRow as { name: string; color: string } | null)?.name ?? '—',
          stage_color: (stageRow as { name: string; color: string } | null)?.color ?? null,
        },
      };
    },
  });
}

// ── Renomear Testador ────────────────────────────────────────────────────────

export function useRenameTestador() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('clients_people').update({ name }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testador-person'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao renomear', description: err.message, variant: 'destructive' });
    },
  });
}

// ── Dev mode: estado atual do contato (campos de qualificação) ────────────────
// Usado no painel "Modo Dev" para validar o que o agente salvou no cadastro
// (goal/moment/conversation_summary/q1-qN via salvar_qualificacao).

export interface TestPersonState {
  qualificationFields: Array<{ key: string; value: string }>;
}

const QUALIFICATION_KEY_RE = /^q\d+_/;

export function useTestPersonState(peopleId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['test-person-state', peopleId] as const;

  const query = useQuery({
    queryKey,
    enabled: !!peopleId,
    queryFn: async (): Promise<TestPersonState> => {
      const { data: person, error } = await supabase
        .from('clients_people')
        .select('*')
        .eq('id', peopleId!)
        .single();
      if (error) throw error;

      const row = person as unknown as Record<string, unknown>;
      const qualificationFields = Object.entries(row)
        .filter(([key, value]) => {
          if (value == null || String(value).trim() === '') return false;
          return key === 'goal' || key === 'moment' || key === 'conversation_summary' || QUALIFICATION_KEY_RE.test(key);
        })
        .map(([key, value]) => ({ key, value: String(value) }))
        .sort((a, b) => a.key.localeCompare(b.key));

      return { qualificationFields };
    },
  });

  useEffect(() => {
    if (!peopleId) return;
    const channel = supabase
      .channel(`test-person-state-${peopleId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'clients_people',
        filter: `id=eq.${peopleId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peopleId]);

  return query;
}
