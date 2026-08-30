import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Janela de cooldown anti-duplicata pra follow-ups de etapa (ver uso abaixo).
const COOLDOWN_MINUTES = 15;

interface EnqueuePayload {
  lead_id:        string;
  stage_id?:      string;
  source_type?:   'stage' | 'meeting';
  meeting_status?: string;
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

    const { lead_id, stage_id, source_type = 'stage', meeting_status }: EnqueuePayload = await req.json();

    // Validação de entrada
    if (!lead_id) {
      return new Response(
        JSON.stringify({ error: 'lead_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (source_type === 'stage' && !stage_id) {
      return new Response(
        JSON.stringify({ error: 'stage_id é obrigatório para source_type=stage' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (source_type === 'meeting' && !meeting_status) {
      return new Response(
        JSON.stringify({ error: 'meeting_status é obrigatório para source_type=meeting' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[followup-enqueue] lead_id=${lead_id} source=${source_type} stage_id=${stage_id ?? '-'} meeting_status=${meeting_status ?? '-'}`);

    // Buscar dados do lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, title, people_id, leads_stages_id, control')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ error: 'Lead não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Escape hatch universal: leads marcados com control='sem_fup' (ex: import
    // em massa de contato de evento, sem intenção de trabalhar via funil) nunca
    // recebem follow-up, independente do stage_id/meeting_status ou do `control`
    // configurado na própria regra — hoje a única regra ativa no sistema tem
    // control=null (bate com qualquer lead.control), então esse é o único jeito
    // de excluir leads específicos sem alterar o comportamento de todo o resto.
    if ((lead as Record<string, unknown>).control === 'sem_fup') {
      console.log(`[followup-enqueue] Lead ${lead_id} marcado como control='sem_fup' — pulando todos os follow-ups`);
      return new Response(
        JSON.stringify({ message: "Lead marcado como control='sem_fup' — follow-ups desativados", enqueued: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const queueEntries: Record<string, unknown>[] = [];

    // ── Modo: STAGE ──────────────────────────────────────────────────────────
    if (source_type === 'stage') {
      const { data: followups, error: fupError } = await supabase
        .from('leads_stages_followups')
        .select('*')
        .eq('leads_stages_id', stage_id)
        .eq('active', true);

      if (fupError) throw fupError;
      if (!followups || followups.length === 0) {
        return new Response(
          JSON.stringify({ message: 'Nenhum follow-up ativo para esta etapa', enqueued: 0 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar score do lead para filtro por score_matrix_id (coluna nativa em clients_people)
      let leadScoreMatrixId: string | null = null;
      if (lead.people_id) {
        const { data: scoreData } = await supabase
          .from('clients_people')
          .select('score_matrix_id')
          .eq('id', lead.people_id)
          .maybeSingle();
        leadScoreMatrixId = scoreData?.score_matrix_id ?? null;
      }

      const leadControl: string | null = (lead as Record<string, unknown>).control as string ?? null;

      for (const fup of followups) {
        // Filtro de score
        if (fup.score_matrix_id && fup.score_matrix_id !== leadScoreMatrixId) {
          console.log(`[followup-enqueue] Pulando FUP ${fup.id} — score não corresponde`);
          continue;
        }

        // Filtro de controle de origem (ambos text agora)
        if (fup.control && fup.control !== leadControl) {
          console.log(`[followup-enqueue] Pulando FUP ${fup.id} — control '${fup.control}' ≠ lead.control '${leadControl}'`);
          continue;
        }

        // Cooldown anti-duplicata: se esse mesmo follow-up já foi enfileirado pra
        // esse lead nos últimos COOLDOWN_MINUTES, não enfileira de novo. Cobre o
        // caso de drag-and-drop instável (mover/desmover/mover sozinho em segundos)
        // disparando o gatilho de troca de etapa mais de uma vez pro mesmo lead.
        const cooldownThreshold = new Date(now.getTime() - COOLDOWN_MINUTES * 60 * 1000).toISOString();
        const { data: recentEntry } = await supabase
          .from('followup_queue')
          .select('id')
          .eq('lead_id', lead_id)
          .eq('followup_id', fup.id)
          .neq('status', 'cancelled')
          .gte('created_at', cooldownThreshold)
          .limit(1)
          .maybeSingle();
        if (recentEntry) {
          console.log(`[followup-enqueue] Pulando FUP ${fup.id} — já enfileirado pra esse lead nos últimos ${COOLDOWN_MINUTES}min (cooldown, entry ${recentEntry.id})`);
          continue;
        }

        const delayMs =
          (fup.days    || 0) * 24 * 60 * 60 * 1000 +
          (fup.hours   || 0) *      60 * 60 * 1000 +
          (fup.minutes || 0) *           60 * 1000;

        queueEntries.push({
          followup_id:         fup.id,
          meeting_followup_id: null,
          lead_id,
          person_id:           lead.people_id ?? null,
          channel:             fup.type,
          template_id:         fup.template_id ?? null,
          message:             fup.message ?? null,
          subject:             fup.subject ?? null,
          source_type:         'stage',
          scheduled_for:       new Date(now.getTime() + delayMs).toISOString(),
          status:              'pending',
        });
      }

    // ── Modo: MEETING ────────────────────────────────────────────────────────
    } else {
      const { data: followups, error: fupError } = await supabase
        .from('meetings_followups')
        .select('*')
        .eq('meeting_status', meeting_status)
        .eq('active', true);

      if (fupError) throw fupError;
      if (!followups || followups.length === 0) {
        return new Response(
          JSON.stringify({ message: 'Nenhum follow-up ativo para este status de reunião', enqueued: 0 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      for (const fup of followups) {
        const delayMs =
          (fup.days    || 0) * 24 * 60 * 60 * 1000 +
          (fup.hours   || 0) *      60 * 60 * 1000 +
          (fup.minutes || 0) *           60 * 1000;

        // Para 'agendado' o delay é NEGATIVO (antes da reunião) — N8N deve tratar
        // Aqui usamos delay positivo: o operador/N8N interpreta o source_type=meeting + meeting_status=agendado
        // para calcular o disparo como "T_reuniao - delay" ao receber o payload
        queueEntries.push({
          followup_id:         null,
          meeting_followup_id: fup.id,
          lead_id,
          person_id:           lead.people_id ?? null,
          channel:             fup.type,
          template_id:         fup.template_id ?? null,
          message:             fup.message ?? null,
          subject:             fup.subject ?? null,
          source_type:         'meeting',
          scheduled_for:       new Date(now.getTime() + delayMs).toISOString(),
          status:              'pending',
        });
      }
    }

    if (queueEntries.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhum follow-up elegível para este lead', enqueued: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .from('followup_queue')
      .insert(queueEntries)
      .select('id, channel, scheduled_for');

    if (insertError) {
      console.error('[followup-enqueue] Erro ao inserir na fila:', insertError);
      throw insertError;
    }

    console.log(`[followup-enqueue] ${inserted?.length ?? 0} follow-up(s) enfileirados para lead ${lead_id}`);

    return new Response(
      JSON.stringify({ message: 'Follow-ups enfileirados', enqueued: inserted?.length ?? 0, entries: inserted }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[followup-enqueue] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
