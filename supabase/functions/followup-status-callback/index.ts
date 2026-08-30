import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CallbackPayload {
  followup_queue_id: string;
  status: 'sent' | 'failed';
  error_message?: string;
  external_message_id?: string;
}

/**
 * followup-status-callback
 *
 * Chamado pelo N8N após o disparo da mensagem.
 * - Atualiza followup_queue.status → 'sent' | 'failed'
 * - Se 'sent': insere registro em messages (aparece no OMNI PRO)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const log = createLogger('followup-status-callback');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: CallbackPayload = await req.json();
    const { followup_queue_id, status, error_message, external_message_id } = body;
    log.info('received', { queue_id: followup_queue_id, status });

    if (!followup_queue_id || !status) {
      return new Response(
        JSON.stringify({ error: 'followup_queue_id e status são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // Buscar entry da fila
    const { data: entry, error: entryError } = await supabase
      .from('followup_queue')
      .select('*')
      .eq('id', followup_queue_id)
      .single();

    if (entryError || !entry) {
      return new Response(
        JSON.stringify({ error: 'Entry da fila não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let messageId: number | null = null;

    // Se enviado com sucesso: registrar em messages (aparece no OMNI PRO)
    if (status === 'sent') {
      // Buscar lead para ter lead_id
      const { data: lead } = await supabase
        .from('leads')
        .select('id, people_id')
        .eq('id', entry.lead_id)
        .single();

      if (lead) {
        // Mapear canal para o formato da tabela messages
        const channelMap: Record<string, string> = {
          whatsapp_template: 'whatsapp',
          whatsapp_texto:    'whatsapp',
          email:             'email',
          sms:               'sms',
          ligacao:           'telefone',
        };
        const messageChannel = channelMap[entry.canal] ?? 'whatsapp';

        // Conteúdo da mensagem
        const content = entry.mensagem
          || entry.template_id
          || `Follow-up via ${entry.canal}`;

        const { data: msg, error: msgError } = await supabase
          .from('messages')
          .insert({
            lead_id:             lead.id,
            people_id:           lead.people_id ?? null,
            followup_id:         entry.followup_id ?? null,
            content:             content,
            from_contact:        'sistema',
            source_type:         'followup',
            channel:             messageChannel,
            message_type:        'texto',
            whatsapp_template_id: entry.template_id ?? null,
            status:              'sent',
            sent_at:             new Date().toISOString(),
            metadata:            {
              followup_queue_id,
              external_message_id: external_message_id ?? null,
            },
          })
          .select('id')
          .single();

        if (msgError) {
          log.error('message_insert_failed', { queue_id: followup_queue_id, error: msgError.message });
        } else {
          messageId = msg?.id ?? null;
          log.info('message_created', { queue_id: followup_queue_id, message_id: messageId });
        }
      }
    }

    // Atualizar entry da fila
    const { error: updateError } = await supabase
      .from('followup_queue')
      .update({
        status,
        error_message: error_message ?? null,
        message_id:    messageId,
        response_data: external_message_id ? { external_message_id } : null,
      })
      .eq('id', followup_queue_id);

    if (updateError) {
      log.error('queue_update_failed', { queue_id: followup_queue_id, error: updateError.message });
      throw updateError;
    }

    log.info('completed', { queue_id: followup_queue_id, status, message_id: messageId });

    return new Response(
      JSON.stringify({ success: true, status, message_id: messageId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    log.error('unhandled_error', { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
