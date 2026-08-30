import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// ai_agents_execution_log e ai_scheduled_callbacks não estão em types.ts
// (kiwify_* / RETORNO-01) → cast de fronteira, mesmo padrão do resto do projeto.
const sbUntyped = supabase as unknown as SupabaseClient;

export interface ConversationMessage {
  type: 'lead_message' | 'ai_response' | 'execution' | 'followup';
  id: string;
  created_at: string;
  // lead_message / ai_response
  content?: string;
  from_contact?: string;
  // execution
  execution_status?: string;
  execution_duration_ms?: number | null;
  tool_call_details?: Array<{ name: string; args: Record<string, unknown>; result: string }>;
  agent_name?: string | null;
  error_message?: string | null;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  // followup (inclui os retornos agendados da tool agendar_retorno — RETORNO-01/02)
  followup_message?: string | null;
  followup_status?: string;
  followup_source_type?: string;
  followup_id?: string | null;
}

interface RawExecution {
  id: string;
  ai_agent_id: string | null;
  execution_status: string;
  execution_duration_ms: number | null;
  response_data: unknown;
  error_message: string | null;
  created_at: string;
}

interface RawFollowup {
  id: string;
  status: string;
  source_type: string;
  message: string | null;
  followup_id: string | null;
  created_at: string;
}

interface RawCallback {
  id: string;
  status: string;
  mode: string;
  reason: string | null;
  scheduled_for: string;
  created_at: string;
}

const parseResponseData = (raw: unknown): {
  text?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  tool_call_details?: Array<{ name: string; args: Record<string, unknown>; result: string }>;
} => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  if (typeof raw === 'object') return raw as ReturnType<typeof parseResponseData>;
  return {};
};

const fetchConversation = async (peopleId: string): Promise<ConversationMessage[]> => {
  const [messagesResult, executionsResult, followupsResult, callbacksResult] = await Promise.all([
    supabase
      .from('messages')
      .select('id, content, from_contact, message_type, created_at')
      .eq('people_id', peopleId)
      .order('created_at', { ascending: true })
      .limit(100),

    sbUntyped
      .from('ai_agents_execution_log')
      .select('id, ai_agent_id, execution_status, execution_duration_ms, response_data, error_message, created_at')
      .eq('people_id', peopleId)
      .order('created_at', { ascending: true })
      .limit(50),

    sbUntyped
      .from('followup_queue')
      .select('id, status, source_type, message, followup_id, created_at')
      .eq('person_id', peopleId)
      .order('created_at', { ascending: true })
      .limit(100),

    sbUntyped
      .from('ai_scheduled_callbacks')
      .select('id, status, mode, reason, scheduled_for, created_at')
      .eq('people_id', peopleId)
      .order('created_at', { ascending: true })
      .limit(50),
  ]);

  const executionsRaw = (executionsResult.data ?? []) as RawExecution[];
  const agentIds = [...new Set(executionsRaw.map(e => e.ai_agent_id).filter(Boolean))] as string[];
  const agentNames = new Map<string, string>();
  if (agentIds.length > 0) {
    const { data: agents } = await sbUntyped.from('ai_agents').select('id, name').in('id', agentIds);
    (agents ?? []).forEach((a: { id: string; name: string }) => agentNames.set(a.id, a.name));
  }

  const messages: ConversationMessage[] = (messagesResult.data ?? []).map(
    (m: { id: string; content: string; from_contact: string; created_at: string }) => ({
      type: m.from_contact === 'cliente' ? 'lead_message' : 'ai_response',
      id: m.id,
      created_at: m.created_at,
      content: m.content,
      from_contact: m.from_contact,
    })
  );

  const executions: ConversationMessage[] = executionsRaw.map((exec) => {
    const rd = parseResponseData(exec.response_data);
    return {
      type: 'execution' as const,
      id: exec.id,
      created_at: exec.created_at,
      execution_status: exec.execution_status,
      execution_duration_ms: exec.execution_duration_ms,
      tool_call_details: rd.tool_call_details,
      agent_name: exec.ai_agent_id ? agentNames.get(exec.ai_agent_id) ?? null : null,
      error_message: exec.error_message,
      usage: rd.usage,
    };
  });

  const followups: ConversationMessage[] = (followupsResult.data ?? []).map((f: unknown) => {
    const fu = f as RawFollowup;
    return {
      type: 'followup' as const,
      id: fu.id,
      created_at: fu.created_at,
      followup_message: fu.message,
      followup_status: fu.status,
      followup_source_type: fu.source_type,
      followup_id: fu.followup_id,
    };
  });

  // Retornos agendados pela tool agendar_retorno (RETORNO-01/02) — mesma forma
  // visual de "followup" nesta visualização: é conceitualmente a mesma coisa
  // (uma ação futura da IA agendada), só que ad-hoc em vez de por regra de etapa.
  const callbacks: ConversationMessage[] = ((callbacksResult.data ?? []) as RawCallback[]).map((c) => ({
    type: 'followup' as const,
    id: c.id,
    created_at: c.created_at,
    followup_message: c.reason ? `[Retorno agendado — ${c.mode}] ${c.reason} → ${new Date(c.scheduled_for).toLocaleString('pt-BR')}` : null,
    followup_status: c.status,
    followup_source_type: 'ai_callback',
    followup_id: null,
  }));

  return [...messages, ...executions, ...followups, ...callbacks].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

export function useAgentConversation(peopleId: string | null) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['agent-conversation', peopleId],
    queryFn: () => fetchConversation(peopleId!),
    enabled: !!peopleId,
    refetchInterval: 5000,
  });

  return { items, isLoading };
}
