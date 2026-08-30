import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AgenteIA } from '@/hooks/useAgentesIA';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TestData {
  personId: string;
  leadId: string;
  firstStageId: string;
}

export interface ToolCallDetail {
  name: string;
  args: Record<string, unknown>;
  result: string;
}

export interface TestResponse {
  status: string;
  response: string;
  tools_used: string[];
  tool_calls: ToolCallDetail[];
  duration_ms: number;
}

export interface QField {
  field_key: string;
  value: string;
}

export interface LeadState {
  lead_id: string;
  title: string;
  control: string;
  stage_id: string;
  stage_name: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function testWhatsapp(agentId: string): string {
  return 'TEST' + agentId.replace(/-/g, '').slice(0, 12);
}

function testPersonName(agentNome: string): string {
  return `Lead Teste - ${agentNome}`;
}

async function getFirstStage(pipelineId?: string | null): Promise<{ id: string; name: string } | null> {
  if (!pipelineId) return null;
  const { data } = await supabase
    .from('leads_stages')
    .select('id, name')
    .eq('leads_pipelines_id', pipelineId)
    .eq('active', true)
    .order('order_index', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

// ── useTestData ───────────────────────────────────────────────────────────────
// Query-based: runs once per agent per session (staleTime: Infinity).
// Survives tab switches. React Query deduplicates concurrent calls automatically.

export function useTestData(agentId: string | undefined, agente: AgenteIA | null) {
  return useQuery({
    queryKey: ['test-data', agentId],
    queryFn: async (): Promise<TestData> => {
      if (!agentId || !agente) throw new Error('Missing agent');

      const testWa = testWhatsapp(agentId);
      const personName = testPersonName(agente.nome);
      const firstStage = await getFirstStage(agente.pipeline_id);

      // ── 1. Find or create person ────────────────────────────────────────────
      const { data: existing } = await supabase
        .from('clients_people')
        .select('id')
        .eq('whatsapp', testWa)
        .maybeSingle();

      let personId: string;

      if (existing) {
        personId = existing.id;
      } else {
        const { data: person, error: personErr } = await supabase
          .from('clients_people')
          .insert({ name: personName, whatsapp: testWa, status: 'active', ai_enabled: true })
          .select('id')
          .single();

        if (personErr) {
          // Race condition: another call may have just inserted — re-query once
          const { data: race } = await supabase
            .from('clients_people')
            .select('id')
            .eq('whatsapp', testWa)
            .maybeSingle();
          if (!race) throw new Error(`Erro ao criar pessoa de teste: ${personErr.message}`);
          personId = race.id;
        } else {
          personId = person.id;
        }
      }

      // ── 2. Find or create lead — keep exactly ONE active ────────────────────
      const { data: allLeads } = await supabase
        .from('leads')
        .select('id, leads_stages_id')
        .eq('people_id', personId)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false });

      if (allLeads && allLeads.length > 0) {
        // Keep the newest; delete extras from previous duplication bug
        if (allLeads.length > 1) {
          const idsToDelete = allLeads.slice(1).map((l) => l.id);
          await supabase.from('leads').delete().in('id', idsToDelete);
        }
        const kept = allLeads[0];
        return {
          personId,
          leadId: kept.id,
          firstStageId: firstStage?.id ?? kept.leads_stages_id ?? '',
        };
      }

      // No active lead — create one
      const { data: newLead, error: leadErr } = await supabase
        .from('leads')
        .insert({
          people_id: personId,
          title: personName,
          leads_pipelines_id: agente.pipeline_id ?? null,
          leads_stages_id: firstStage?.id ?? null,
          control: '1',
          status: 'in_progress',
        })
        .select('id')
        .single();

      if (leadErr) throw new Error(`Erro ao criar lead de teste: ${leadErr.message}`);
      return { personId, leadId: newLead.id, firstStageId: firstStage?.id ?? '' };
    },
    enabled: !!agentId && !!agente?.pipeline_id,
    staleTime: Infinity,          // Never auto-refetch once loaded
    gcTime: 30 * 60 * 1000,      // Keep in cache for 30 min
    retry: false,                 // Surface errors immediately
  });
}

// ── useTestLeadState ──────────────────────────────────────────────────────────

export function useTestLeadState(leadId: string | null, peopleId: string | null) {
  return useQuery({
    queryKey: ['test-lead-state', leadId],
    queryFn: async (): Promise<{ lead: LeadState; qFields: QField[] }> => {
      if (!leadId || !peopleId) throw new Error('Missing IDs');

      const { data: lead, error: leadErr } = await supabase
        .from('leads')
        .select('id, title, control, leads_stages_id, leads_stages:leads_stages!leads_leads_stages_id_fkey(name, id)')
        .eq('id', leadId)
        .single();

      if (leadErr) throw leadErr;

      const stageData = lead.leads_stages as unknown as { name: string; id: string } | null;

      const { data: defs } = await supabase
        .from('lead_field_definitions')
        .select('id, key')
        .eq('entity_type', 'pessoa')
        .eq('active', true);

      const defMap: Record<string, string> = {};
      if (defs) defs.forEach((d) => { defMap[d.id] = d.key; });

      const { data: vals } = await supabase
        .from('lead_field_values')
        .select('value_text, field_definition_id')
        .eq('entity_type', 'pessoa')
        .eq('entity_id', peopleId);

      const qFields: QField[] = [];
      if (vals) {
        for (const row of vals) {
          const key = defMap[row.field_definition_id];
          if (key && row.value_text != null) {
            qFields.push({ field_key: key, value: row.value_text });
          }
        }
      }

      return {
        lead: {
          lead_id: lead.id,
          title: lead.title ?? '',
          control: lead.control ?? '1',
          stage_id: stageData?.id ?? '',
          stage_name: stageData?.name ?? '',
        },
        qFields,
      };
    },
    enabled: !!leadId && !!peopleId,
    staleTime: 0,
  });
}

// ── useEnviarMensagemTeste ────────────────────────────────────────────────────

export function useEnviarMensagemTeste() {
  return useMutation({
    mutationFn: async ({
      message,
      peopleId,
      leadId,
      agentId,
    }: {
      message: string;
      peopleId: string;
      leadId: string;
      agentId: string;
    }): Promise<TestResponse> => {
      // 1. Persist user message for conversation memory
      const { error: msgErr } = await supabase.from('messages').insert({
        people_id: peopleId,
        lead_id: leadId,
        content: message,
        from_contact: 'cliente',
        message_type: 'texto',
        channel: 'whatsapp',
        status: 'sent',
      });

      if (msgErr) throw new Error(`Erro ao salvar mensagem: ${msgErr.message}`);

      // 2. Call ai-agent-execute in test mode (90s timeout via AbortController)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90_000);

      let invokeData: unknown = null;
      let invokeError: unknown = null;
      try {
        const result = await supabase.functions.invoke('ai-agent-execute', {
          body: {
            people_id: peopleId,
            test_mode: true,
            agent_id: agentId,
            direct_message: message,
          },
        });
        invokeData = result.data;
        invokeError = result.error;
      } finally {
        clearTimeout(timeoutId);
      }

      if (controller.signal.aborted) {
        throw new Error('Tempo limite de 90s atingido. O agente demorou demais para responder.');
      }

      const error = invokeError;
      const data = invokeData;

      if (error) {
        // supabase-js hides the body on non-2xx — try to read the actual error
        let msg = (error as Error).message;
        try {
          const ctx = (error as unknown as { context?: Response }).context;
          if (ctx) {
            const body = await ctx.clone().json();
            if (body?.error) msg = body.error;
          }
        } catch { /* ignore parse failures */ }
        throw new Error(msg);
      }

      // Surface edge function errors clearly
      const result = data as TestResponse & { error?: string };
      if (result?.status !== 'ok') {
        throw new Error(result?.error ?? 'Resposta inválida do agente');
      }

      return result;
    },
  });
}

// ── useReiniciarConversa ──────────────────────────────────────────────────────

export function useReiniciarConversa() {
  return useMutation({
    mutationFn: async ({
      peopleId,
      leadId,
      firstStageId,
    }: {
      peopleId: string;
      leadId: string;
      firstStageId: string;
    }) => {
      await supabase.from('messages').delete().eq('people_id', peopleId);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('leads') as any)
        .update({ control: '1', ...(firstStageId ? { leads_stages_id: firstStageId } : {}) })
        .eq('id', leadId);

      const { data: defs } = await supabase
        .from('lead_field_definitions')
        .select('id')
        .eq('entity_type', 'pessoa')
        .eq('active', true);

      if (defs && defs.length > 0) {
        await supabase
          .from('lead_field_values')
          .delete()
          .eq('entity_type', 'pessoa')
          .eq('entity_id', peopleId)
          .in('field_definition_id', defs.map((d) => d.id));
      }
    },
  });
}

// ── useLimparTestData ─────────────────────────────────────────────────────────

export function useLimparTestData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      peopleId,
      leadId,
    }: {
      peopleId: string;
      leadId: string;
      agentId: string;
    }) => {
      await supabase.from('messages').delete().eq('people_id', peopleId);

      const { data: defs } = await supabase
        .from('lead_field_definitions')
        .select('id')
        .eq('entity_type', 'pessoa')
        .eq('active', true);

      if (defs && defs.length > 0) {
        await supabase
          .from('lead_field_values')
          .delete()
          .eq('entity_type', 'pessoa')
          .eq('entity_id', peopleId)
          .in('field_definition_id', defs.map((d) => d.id));
      }

      await supabase.from('leads').delete().eq('id', leadId);
      await supabase.from('clients_people').delete().eq('id', peopleId);
    },
    onSuccess: (_, variables) => {
      // Remove cached test data so next visit re-creates
      queryClient.removeQueries({ queryKey: ['test-data', variables.agentId] });
      queryClient.removeQueries({ queryKey: ['test-lead-state'] });
    },
  });
}
