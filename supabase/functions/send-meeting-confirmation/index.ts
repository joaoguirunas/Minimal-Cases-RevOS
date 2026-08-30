/**
 * SEND MEETING CONFIRMATION — Auto-send WhatsApp template on meeting creation
 *
 * Receives { meeting_id } and:
 *   1. Looks up meeting data (title, start_time, meeting_link, people_id)
 *   2. Looks up person (name, whatsapp)
 *   3. Finds the 'confirmacao_agendamento' template (or custom template_name)
 *   4. Builds Meta components with meeting-specific variables
 *   5. Calls whatsapp-outbound to deliver
 *   6. Records in messages table
 *
 * Auth: JWT required
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function formatDateTime(isoString: string) {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return {
    date: `${day}/${month}/${year}`,
    time: `${hours}:${minutes}`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const log = createLogger('send-meeting-confirmation');
  const t0 = Date.now();

  try {
    // Auth
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    // Parse body
    const { meeting_id, template_name: customTemplateName } = await req.json();
    if (!meeting_id) return jsonResponse({ error: 'meeting_id é obrigatório' }, 400);

    log.info('start', { meeting_id });

    // 1. Lookup meeting
    const { data: meeting, error: meetErr } = await supabase
      .from('meetings')
      .select('id, title, start_time, end_time, meeting_link, people_id, status')
      .eq('id', meeting_id)
      .single();

    if (meetErr || !meeting) {
      log.error('meeting_not_found', { meeting_id });
      return jsonResponse({ error: 'Reunião não encontrada' }, 404);
    }

    if (!meeting.people_id) {
      return jsonResponse({ error: 'Reunião sem contato associado' }, 400);
    }

    // 2. Lookup person
    const { data: person, error: personErr } = await supabase
      .from('clients_people')
      .select('id, name, whatsapp')
      .eq('id', meeting.people_id)
      .single();

    if (personErr || !person) {
      return jsonResponse({ error: 'Contato não encontrado' }, 404);
    }

    if (!person.whatsapp) {
      log.warn('no_whatsapp', { people_id: person.id });
      return jsonResponse({ error: 'Contato não tem WhatsApp cadastrado' }, 400);
    }

    // 3. Find template
    const templateName = customTemplateName || 'confirmacao_reuniao';
    const { data: template } = await supabase
      .from('whatsapp_templates')
      .select('id, name, meta_template_name, status, json_data')
      .eq('meta_template_name', templateName)
      .eq('status', 'approved')
      .maybeSingle();

    if (!template) {
      log.warn('template_not_found', { templateName });
      return jsonResponse({
        error: `Template "${templateName}" não encontrado ou não aprovado. Crie o template em Configurações → Templates e aguarde aprovação da Meta.`,
      }, 404);
    }

    // 4. Build variables
    const personName = person.name || 'Cliente';
    const { date, time } = formatDateTime(meeting.start_time);
    const meetLink = meeting.meeting_link || '';

    // Detect how many variables the template body expects
    const components = template.json_data?.components || [];
    const bodyComponent = components.find((c: any) => c.type === 'BODY');
    const headerComponent = components.find((c: any) => c.type === 'HEADER');
    const bodyText = bodyComponent?.text || '';
    const headerText = headerComponent?.text || '';

    // Count variables in body and header
    const bodyVars = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m: RegExpMatchArray) => parseInt(m[1]));
    const headerVars = [...headerText.matchAll(/\{\{(\d+)\}\}/g)].map((m: RegExpMatchArray) => parseInt(m[1]));

    // Build Meta components array for sending
    const metaComponents: Array<Record<string, unknown>> = [];

    if (headerVars.length > 0) {
      const headerParams = headerVars.sort().map((varNum: number) => {
        const values: Record<number, string> = { 1: personName, 2: date, 3: time, 4: meetLink };
        return { type: 'text', text: values[varNum] || '' };
      });
      metaComponents.push({ type: 'header', parameters: headerParams });
    }

    if (bodyVars.length > 0) {
      const bodyParams = bodyVars.sort().map((varNum: number) => {
        const values: Record<number, string> = { 1: personName, 2: date, 3: time, 4: meetLink };
        return { type: 'text', text: values[varNum] || '' };
      });
      metaComponents.push({ type: 'body', parameters: bodyParams });
    }

    // Check for URL button with dynamic variable (e.g. meet link)
    const buttonsComponent = components.find((c: any) => c.type === 'BUTTONS');
    if (buttonsComponent?.buttons) {
      buttonsComponent.buttons.forEach((btn: any, idx: number) => {
        if (btn.type === 'URL' && /\{\{1\}\}/.test(btn.url) && meetLink) {
          metaComponents.push({
            type: 'button',
            sub_type: 'url',
            index: idx,
            parameters: [{ type: 'text', text: meetLink }],
          });
        }
      });
    }

    log.info('sending', {
      template: templateName,
      to: person.whatsapp,
      vars: { name: personName, date, time, meetLink: meetLink ? 'present' : 'empty' },
    });

    // 5. Get lead_id for this person (needed for messages table)
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('people_id', person.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 6. Insert message record
    // Get user's settings_users id
    const { data: settingsUser } = await supabase
      .from('settings_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    // Build rendered content for display
    let renderedContent = bodyText;
    const varMap: Record<string, string> = { '1': personName, '2': date, '3': time, '4': meetLink };
    renderedContent = renderedContent.replace(/\{\{(\d+)\}\}/g, (_: string, n: string) => varMap[n] || `{{${n}}}`);

    const { data: insertedMsg } = await supabase
      .from('messages')
      .insert({
        from_contact: 'humano',
        source_type: 'auto_meeting',
        content: renderedContent,
        message_type: 'texto',
        lead_id: lead?.id || null,
        people_id: person.id,
        user_id: settingsUser?.id || null,
        status: 'pending',
        channel: 'whatsapp',
        whatsapp_template_id: template.meta_template_name,
      })
      .select('id')
      .single();

    // 7. Call whatsapp-outbound
    const outboundPayload = {
      to: person.whatsapp,
      messages: [{
        type: 'template',
        template_name: template.meta_template_name,
        language_code: template.json_data?.language || 'pt_BR',
        components: metaComponents,
      }],
      people_id: person.id,
      message_ids: insertedMsg ? [insertedMsg.id] : [],
    };

    const { error: outboundErr } = await supabase.functions.invoke('whatsapp-outbound', {
      body: outboundPayload,
    });

    if (outboundErr) {
      log.error('outbound_failed', { error: outboundErr.message });
      return jsonResponse({
        sent: false,
        error: `Falha ao enviar WhatsApp: ${outboundErr.message}`,
      }, 502);
    }

    log.info('sent_ok', { duration_ms: log.elapsed(t0) });

    return jsonResponse({
      sent: true,
      to: person.whatsapp,
      template: templateName,
      meeting_id,
    });

  } catch (err: any) {
    log.error('failed', { error: err?.message ?? String(err) });
    return jsonResponse({ error: err?.message ?? 'Internal error' }, 500);
  }
});
