import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EventType = 'conversa' | 'disparo' | 'lead_etapa' | 'followup';

const EVENTO_META: Record<EventType, { categoria: string; canal: string }> = {
  'lead_etapa': { categoria: 'CRM PRO™',   canal: 'crm' },
  'conversa':   { categoria: 'OMNI PRO™',  canal: 'omni' },
  'disparo':    { categoria: 'SENDS PRO™', canal: 'sends' },
  'followup':   { categoria: 'Follow-ups', canal: 'followups' },
};

// Extract the most relevant value from a field_value row
function fieldValue(fv: Record<string, unknown>): unknown {
  if (fv.value_text   !== null && fv.value_text   !== undefined) return fv.value_text;
  if (fv.value_number !== null && fv.value_number !== undefined) return fv.value_number;
  if (fv.value_boolean !== null && fv.value_boolean !== undefined) return fv.value_boolean;
  if (fv.value_date   !== null && fv.value_date   !== undefined) return fv.value_date;
  return null;
}

// Build a key→value map from field values joined with definitions
function buildCustomFields(
  values: Array<Record<string, unknown>>,
  definitions: Array<Record<string, unknown>>,
  entityType: string,
  entityId: string | null
): Record<string, unknown> {
  if (!entityId) return {};
  const result: Record<string, unknown> = {};
  const filtered = values.filter(v => v.entity_type === entityType && v.entity_id === entityId);
  for (const v of filtered) {
    const def = definitions.find(d => d.id === v.field_definition_id);
    if (def?.key) result[def.key as string] = fieldValue(v);
  }
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { tipo, lead_id } = await req.json() as { tipo: EventType; lead_id: string };

    console.log(`[dispara-webhook] tipo=${tipo} lead_id=${lead_id}`);

    if (!tipo || !lead_id) {
      return new Response(
        JSON.stringify({ error: 'tipo e lead_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 1. Fetch lead ──────────────────────────────────────────────────────────
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadErr || !lead) {
      console.error('[dispara-webhook] Lead não encontrado:', leadErr);
      return new Response(
        JSON.stringify({ error: 'Lead não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 2. Parallel fetches ────────────────────────────────────────────────────
    const [
      pessoaRes, empresaRes, meetingRes,
      pipelineRes, stageRes,
      fieldDefsRes, fieldValsRes,
      conversaRes,
    ] = await Promise.all([
      // Pessoa
      lead.people_id
        ? supabase.from('clients_people').select('*').eq('id', lead.people_id).single()
        : Promise.resolve({ data: null }),

      // Empresa
      lead.company_id
        ? supabase.from('clients_companies').select('*').eq('id', lead.company_id).single()
        : Promise.resolve({ data: null }),

      // Agendamento mais recente associado ao lead
      supabase
        .from('meetings')
        .select('*')
        .eq('lead_id', lead_id)
        .order('start_time', { ascending: false })
        .limit(1),

      // Pipeline
      lead.leads_pipelines_id
        ? supabase.from('leads_pipelines').select('id, name, description, active').eq('id', lead.leads_pipelines_id).single()
        : Promise.resolve({ data: null }),

      // Etapa
      lead.leads_stages_id
        ? supabase.from('leads_stages').select('id, name, color, order_index, leads_pipelines_id').eq('id', lead.leads_stages_id).single()
        : Promise.resolve({ data: null }),

      // Field definitions (all entity types)
      supabase.from('lead_field_definitions').select('id, key, name, entity_type, category, type').eq('active', true),

      // Field values for this lead's entities
      supabase.from('lead_field_values').select('entity_type, entity_id, field_definition_id, value_text, value_number, value_boolean, value_date').or(
        [
          `entity_id.eq.${lead_id}`,
          lead.people_id    ? `entity_id.eq.${lead.people_id}`    : null,
          lead.company_id ? `entity_id.eq.${lead.company_id}` : null,
        ].filter(Boolean).join(',')
      ),

      // Última mensagem (só para conversa)
      tipo === 'conversa'
        ? supabase.from('messages').select('*').eq('lead_id', lead_id).order('created_at', { ascending: false }).limit(1)
        : Promise.resolve({ data: null }),
    ]);

    const pessoa    = pessoaRes.data;
    const empresa   = empresaRes.data;
    const meeting   = meetingRes.data?.[0] ?? null;
    const pipeline  = pipelineRes.data;
    const stage     = stageRes.data;
    const fieldDefs = (fieldDefsRes.data ?? []) as Array<Record<string, unknown>>;
    const fieldVals = (fieldValsRes.data ?? []) as Array<Record<string, unknown>>;
    const conversa  = conversaRes.data?.[0] ?? null;

    // ── 3. Custom fields per entity ────────────────────────────────────────────
    const customFields = {
      negocio: buildCustomFields(fieldVals, fieldDefs, 'negocio', lead_id),
      pessoa:  buildCustomFields(fieldVals, fieldDefs, 'pessoa',  lead.people_id ?? null),
      empresa: buildCustomFields(fieldVals, fieldDefs, 'empresa', lead.company_id ?? null),
    };

    // ── 4. Build standard payload ──────────────────────────────────────────────
    const { categoria, canal } = EVENTO_META[tipo] ?? { categoria: tipo, canal: tipo };

    const duracao_minutos = meeting
      ? Math.round((new Date(meeting.end_time).getTime() - new Date(meeting.start_time).getTime()) / 60000)
      : null;

    const payload: Record<string, unknown> = {
      // Envelope
      categoria,
      canal,
      evento: tipo,
      timestamp: new Date().toISOString(),

      // Lead / Negócio
      lead: {
        id:                   lead.id,
        titulo:               lead.title,
        status:               lead.status,
        valor:                lead.value,
        descricao:            lead.description,
        created_at:           lead.created_at,
        updated_at:           lead.updated_at,
        last_interaction_at:  lead.last_interaction_at,
        archived:             lead.archived,
        won_at:               lead.won_at,
        lost_at:              lead.lost_at,
        motivo_perda:         lead.loss_reason,
        utm: {
          source:   lead.utm_source,
          medium:   lead.utm_medium,
          campaign: lead.utm_campaign,
          term:     lead.utm_term,
          content:  lead.utm_content,
        },
        gclid:      lead.gclid,
        fbclid:     lead.fbclid,
        fb_lead_id: lead.fb_lead_id,
      },

      // Pipeline
      pipeline: pipeline ? {
        id:        pipeline.id,
        nome:      pipeline.name,
        descricao: pipeline.description,
      } : null,

      // Etapa
      etapa: stage ? {
        id:          stage.id,
        nome:        stage.name,
        cor:         stage.color,
        ordem:       stage.order_index,
        pipeline_id: stage.leads_pipelines_id,
      } : null,

      // Pessoa / Contato
      pessoa: pessoa ? {
        id:                  pessoa.id,
        nome:                pessoa.name,
        email:               pessoa.email,
        telefone:            pessoa.telefone,
        whatsapp:            pessoa.whatsapp,
        documento:           pessoa.document,
        fonte:               pessoa.source,
        tipo:                pessoa.type,
        status:              pessoa.status,
        score:               pessoa.score,
        disc_perfil:         pessoa.disc_profile,
        disc_analise:        pessoa.disc_summary,
        resumo_conversa:     pessoa.conversation_summary,
        aceita_ligacoes:     pessoa.accepts_calls,
        ai_habilitado:       pessoa.ai_enabled,
        instagram_user_id:   pessoa.instagram_user_id,
        created_at:          pessoa.created_at,
        updated_at:          pessoa.updated_at,
        // Qualificação (Q fields)
        qualificacao: {
          bottleneck:            pessoa.q1_main_bottleneck,
          volume_leads_mes:      pessoa.q2_lead_volume_month,
          tamanho_time:          pessoa.q3_team_size,
          maturidade_crm:        pessoa.q4_crm_maturity,
          crm_atual:             pessoa.q5_crm_name,
          gatilho:               pessoa.q6_trigger,
          impacto_problema:      pessoa.q7_problem_impact,
          nivel_engajamento:     pessoa.q8_engagement_level,
          autoridade_decisao:    pessoa.q9_decision_authority,
          stakeholders:          pessoa.q10_stakeholders,
          orcamento_aprovado:    pessoa.q11_budget_approved,
          prazo:                 pessoa.q12_timeline,
          urgencia:              pessoa.q13_urgency_reason,
          dados_prontos:         pessoa.q14_data_ready,
          volume_minimo:         pessoa.q15_minimum_volume,
          roi_esperado:          pessoa.q16_expected_roi,
          objecoes:              pessoa.q17_objections,
          fit_real:              pessoa.q18_real_fit,
          status_qualificacao:   pessoa.q19_qualification_status,
          motivo_rejeicao:       pessoa.q20_rejection_reason,
          nivel_interesse:       pessoa.q21_interest_level,
          probabilidade_fechamento: pessoa.q22_close_probability,
          tags_comportamentais:  pessoa.q23_behavioral_tags,
        },
      } : null,

      // Empresa
      empresa: empresa ? {
        id:           empresa.id,
        nome_fantasia: empresa.trade_name,
        razao_social: empresa.legal_name,
        cnpj:         empresa.tax_id,
        email:        empresa.email,
        telefone:     empresa.phone,
        site:         empresa.website,
        endereco:     empresa.address,
        created_at:   empresa.created_at,
        updated_at:   empresa.updated_at,
      } : null,

      // Agendamento
      agendamento: meeting ? {
        id:                meeting.id,
        titulo:            meeting.title,
        descricao:         meeting.description,
        status:            meeting.status,
        inicio:            meeting.start_time,
        fim:               meeting.end_time,
        duracao_minutos:   duracao_minutos,
        link_reuniao:      meeting.meeting_link,
        local:             meeting.location,
        notas:             meeting.notes,
        resultado:         meeting.outcome,
        participantes:     meeting.attendee_emails,
        fonte:             meeting.source,
        google_event_id:   meeting.google_event_id,
        ms_meeting_id:     meeting.ms_meeting_id,
        consultor_id:      meeting.user_id,
        created_at:        meeting.created_at,
        updated_at:        meeting.updated_at,
      } : null,

      // Campos personalizados
      campos_personalizados: customFields,

      // Evento-specific
      ...(tipo === 'conversa' && { conversa }),
    };

    // ── 5. Fetch matching webhooks ─────────────────────────────────────────────
    const { data: allWebhooks, error: webhooksErr } = await supabase
      .from('webhooks')
      .select('*')
      .eq('event_type', tipo)
      .eq('active', true);

    if (webhooksErr) throw webhooksErr;

    let webhooks = allWebhooks ?? [];

    // For lead_etapa: filter by pipeline/stage if set on webhook
    if (tipo === 'lead_etapa') {
      const stagePipelineId = stage?.leads_pipelines_id ?? null;
      const stageId = lead.leads_stages_id ?? null;
      webhooks = webhooks.filter(w => {
        const pipelineMatch = !w.pipeline_id || w.pipeline_id === stagePipelineId;
        const stageMatch    = !w.stage_ids?.length || (stageId && w.stage_ids.includes(stageId));
        return pipelineMatch && stageMatch;
      });
    }

    console.log(`[dispara-webhook] ${webhooks.length} webhook(s) ativo(s) para tipo=${tipo}`);

    if (webhooks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhum webhook ativo', dispatched: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 6. Dispatch ────────────────────────────────────────────────────────────
    const results = await Promise.all(webhooks.map(async (webhook) => {
      let statusCode = 0;
      let responseBody: string | null = null;
      let errorMessage: string | null = null;

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (webhook.headers && typeof webhook.headers === 'object') {
          Object.assign(headers, webhook.headers);
        }

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });

        statusCode = response.status;
        try { responseBody = await response.text(); } catch { /* ignore */ }
        if (!response.ok) errorMessage = `HTTP ${statusCode}: ${responseBody || 'Sem resposta'}`;
      } catch (err) {
        statusCode = 0;
        errorMessage = err instanceof Error ? err.message : 'Erro de conexão';
      }

      await supabase.from('webhook_logs').insert({
        webhook_id:    webhook.id,
        request_body:  payload,
        response_body: responseBody,
        status_code:   statusCode,
        error_message: errorMessage,
      });

      return {
        webhook_id:   webhook.id,
        webhook_name: webhook.name,
        status_code:  statusCode,
        success:      statusCode >= 200 && statusCode < 300,
        error:        errorMessage,
      };
    }));

    const successCount = results.filter(r => r.success).length;
    console.log(`[dispara-webhook] ${successCount}/${results.length} com sucesso`);

    return new Response(
      JSON.stringify({ message: 'Webhooks disparados', dispatched: results.length, successful: successCount, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[dispara-webhook] Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
