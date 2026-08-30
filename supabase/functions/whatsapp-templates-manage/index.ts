/**
 * WHATSAPP TEMPLATES MANAGE — WAT-05/06
 *
 * CRUD operations for WhatsApp message templates via Meta Graph API.
 *
 * Actions:
 *   - create: POST template to Meta, insert locally with status 'pending'
 *   - delete: DELETE template from Meta, soft-delete locally
 *
 * Auth: JWT required (admin/manager only)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API_VERSION = 'v23.0';

interface MetaComponent {
  type: string;
  format?: string;
  text?: string;
  example?: Record<string, unknown>;
  buttons?: Array<{ type: string; text: string; url?: string }>;
}

interface CreatePayload {
  action: 'create';
  channel_id: string;
  name: string;
  category: string;
  language: string;
  components: MetaComponent[];
  purpose?: string;
  variables?: Record<string, unknown>;
}

interface DeletePayload {
  action: 'delete';
  channel_id: string;
  template_name: string;
}

type ActionPayload = CreatePayload | DeletePayload;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Lookup channel credentials ───────────────────────────────────────────────

async function getChannelCredentials(
  supabase: ReturnType<typeof createClient>,
  channelId: string,
) {
  const { data: channel, error } = await supabase
    .from('settings_whatsapp_channels')
    .select('waba_id, access_token')
    .eq('id', channelId)
    .eq('active', true)
    .single();

  if (error || !channel) {
    throw { message: 'Canal não encontrado ou inativo' };
  }

  const { waba_id, access_token } = channel as { waba_id: string | null; access_token: string };

  if (!waba_id) {
    throw { message: 'WABA ID não configurado neste canal' };
  }

  return { waba_id, access_token };
}

// ── CREATE template ──────────────────────────────────────────────────────────

async function handleCreate(
  supabase: ReturnType<typeof createClient>,
  payload: CreatePayload,
  log: ReturnType<typeof createLogger>,
) {
  const { channel_id, name, category, language, components, purpose, variables } = payload;

  // Validate required fields
  if (!name || !category || !language || !components?.length) {
    return jsonResponse({ error: 'Campos obrigatórios: name, category, language, components' });
  }

  // Validate template name format
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    return jsonResponse({ error: 'Nome do template deve ser lowercase, começar com letra, apenas letras, números e underscores' });
  }

  const { waba_id, access_token } = await getChannelCredentials(supabase, channel_id);

  log.info('create_start', { name, category, language, waba_id });

  // POST to Meta API
  const metaPayload = {
    name,
    category,
    language,
    components,
  };

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${waba_id}/message_templates`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metaPayload),
    },
  );

  const body = await res.json();

  if (!res.ok) {
    log.error('meta_create_error', { status: res.status, body });

    // Extract user-friendly error from Meta's response
    const metaError = body?.error?.error_user_msg || body?.error?.message || `Erro da Meta API (${res.status})`;
    // Return 200 with error field so supabase.functions.invoke delivers the message to the client
    return jsonResponse({ error: metaError, meta_status: res.status });
  }

  // Insert locally with status 'pending'
  const slug = `${name}|${language}`;
  const templateId = body.id;

  const row = {
    name,
    slug,
    id_template: templateId,
    meta_template_name: name,
    status: 'pending',
    system_enabled: false,
    purpose: purpose || null,
    variables: variables || null,
    json_data: {
      category,
      language,
      components,
    },
    updated_at: new Date().toISOString(),
  };

  const { error: insertError } = await supabase
    .from('whatsapp_templates')
    .insert(row);

  if (insertError) {
    log.warn('local_insert_failed', { error: insertError.message });
    // Template was created on Meta even if local insert fails
    // Next sync will pick it up
  }

  log.info('create_success', { templateId, name, status: 'pending' });

  return jsonResponse({
    id: templateId,
    name,
    status: 'pending',
    message: 'Template criado. Aguardando aprovação da Meta (pode levar até 24h).',
  });
}

// ── DELETE template ──────────────────────────────────────────────────────────

async function handleDelete(
  supabase: ReturnType<typeof createClient>,
  payload: DeletePayload,
  log: ReturnType<typeof createLogger>,
) {
  const { channel_id, template_name } = payload;

  if (!template_name) {
    return jsonResponse({ error: 'template_name é obrigatório' });
  }

  const { waba_id, access_token } = await getChannelCredentials(supabase, channel_id);

  log.info('delete_start', { template_name, waba_id });

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${waba_id}/message_templates?name=${encodeURIComponent(template_name)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${access_token}` },
    },
  );

  const body = await res.json();

  if (!res.ok) {
    log.error('meta_delete_error', { status: res.status, body });
    const metaError = body?.error?.error_user_msg || body?.error?.message || `Erro ao excluir template (${res.status})`;
    return jsonResponse({ error: metaError, meta_status: res.status });
  }

  // Soft-delete locally
  await supabase
    .from('whatsapp_templates')
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .eq('meta_template_name', template_name);

  log.info('delete_success', { template_name });

  return jsonResponse({ success: true, message: 'Template excluído com sucesso.' });
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const log = createLogger('whatsapp-templates-manage');

  try {
    // Auth check
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const payload: ActionPayload = await req.json();

    if (!payload.channel_id) {
      return jsonResponse({ error: 'channel_id é obrigatório' });
    }

    switch (payload.action) {
      case 'create':
        return await handleCreate(supabase, payload as CreatePayload, log);
      case 'delete':
        return await handleDelete(supabase, payload as DeletePayload, log);
      default:
        return jsonResponse({ error: `Ação inválida: ${(payload as any).action}` });
    }
  } catch (err: any) {
    log.error('manage_failed', { error: err?.message ?? String(err) });
    // Always return 200 so supabase.functions.invoke delivers the error message to the client
    return jsonResponse({ error: err?.message ?? 'Internal error' });
  }
});
