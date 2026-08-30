import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Chamada fire-and-forget pelo trigger notify_closer_on_meeting_scheduled
// (AFTER INSERT ON meetings). O sino (notifications) já foi criado direto
// no trigger, transacional — esta function cuida só do envio de WhatsApp
// pro closer (meetings.user_id), que precisa de chamadas externas (Meta API)
// e por isso não pode rodar dentro da transação do INSERT da reunião.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEMPLATE_NAME = 'aviso_reuniao_agendada_closer_v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { meeting_id } = await req.json();
    if (!meeting_id) {
      return new Response(
        JSON.stringify({ error: 'meeting_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, start_time, people_id, lead_id, user_id')
      .eq('id', meeting_id)
      .single();

    if (meetingError || !meeting || !meeting.user_id) {
      console.warn(`[notify-closer-meeting] meeting ${meeting_id} não encontrada ou sem closer`);
      return new Response(
        JSON.stringify({ message: 'Reunião não encontrada ou sem closer', sent: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const [{ data: closer }, { data: lead }] = await Promise.all([
      supabase.from('settings_users').select('name, phone').eq('id', meeting.user_id).maybeSingle(),
      meeting.people_id
        ? supabase.from('clients_people').select('name').eq('id', meeting.people_id).maybeSingle()
        : Promise.resolve({ data: null as { name: string } | null }),
    ]);

    if (!closer?.phone) {
      console.log(`[notify-closer-meeting] closer ${meeting.user_id} sem telefone cadastrado — pulando envio WA`);
      return new Response(
        JSON.stringify({ message: 'Closer sem telefone cadastrado', sent: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: waCh } = await supabase
      .from('settings_whatsapp_channels')
      .select('phone_number_id')
      .eq('is_default', true)
      .eq('active', true)
      .maybeSingle();

    if (!waCh?.phone_number_id) {
      console.warn('[notify-closer-meeting] nenhum canal WhatsApp padrão ativo');
      return new Response(
        JSON.stringify({ message: 'Nenhum canal WhatsApp padrão ativo', sent: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const closerFirstName = (closer.name || '').trim().split(' ')[0] || 'Closer';
    const leadName = lead?.name || 'Lead';
    const timeLabel = new Date(meeting.start_time).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(',', ' às');

    const waRes = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-outbound`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          to: closer.phone,
          phone_number_id: waCh.phone_number_id,
          lead_id: meeting.lead_id ?? null,
          messages: [{
            type: 'template',
            template_name: TEMPLATE_NAME,
            components: [{
              type: 'body',
              parameters: [
                { type: 'text', text: closerFirstName, parameter_name: '1' },
                { type: 'text', text: leadName, parameter_name: '2' },
                { type: 'text', text: timeLabel, parameter_name: '3' },
              ],
            }],
          }],
        }),
      }
    );

    const sent = waRes.ok;
    if (!sent) {
      const errBody = await waRes.text().catch(() => '');
      console.error(`[notify-closer-meeting] WA HTTP ${waRes.status} para meeting ${meeting_id}: ${errBody.slice(0, 300)}`);
    } else {
      console.log(`[notify-closer-meeting] enviado para closer ${meeting.user_id} (meeting ${meeting_id})`);
    }

    return new Response(
      JSON.stringify({ sent }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[notify-closer-meeting] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
