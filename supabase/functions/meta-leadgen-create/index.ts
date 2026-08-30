/**
 * META LEAD FORMS — Create Lead Form via Graph API
 *
 * POST /meta-leadgen-create
 * Body: {
 *   page_id, name, questions, thank_you_page, privacy_policy_url,
 *   field_mapping, settings, pipeline_id
 * }
 *
 * Flow:
 * 1. Verify user JWT
 * 2. Read page access_token from meta_lead_form_pages (service_role)
 * 3. POST /{page-id}/leadgen_forms to create form on Meta
 * 4. Insert into meta_lead_forms with returned meta_form_id
 * 5. Return { success, form_id, meta_form_id }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API = 'https://graph.facebook.com/v25.0';

interface CreateFormBody {
  page_id: string;
  name: string;
  questions: unknown[];
  thank_you_page: { title: string; body: string };
  privacy_policy_url: string;
  field_mapping: unknown[];
  settings: Record<string, unknown>;
  pipeline_id: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return json(null, 200);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    // === AUTH ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return json({ success: false, error: 'Invalid token' }, 401);
    }

    // === PARSE BODY ===
    const body = (await req.json()) as CreateFormBody;
    const { page_id, name, questions, thank_you_page, privacy_policy_url, field_mapping, settings, pipeline_id } = body;

    if (!page_id || !name || !questions?.length || !privacy_policy_url) {
      return json({ success: false, error: 'Missing required fields: page_id, name, questions, privacy_policy_url' }, 400);
    }

    // === READ PAGE TOKEN ===
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: page, error: pageError } = await supabase
      .from('meta_lead_form_pages')
      .select('access_token')
      .eq('page_id', page_id)
      .single();

    if (pageError || !page?.access_token) {
      return json({ success: false, error: 'Page não encontrada ou sem token. Conecte a Page primeiro.' }, 404);
    }

    // === CREATE FORM ON META ===
    const createUrl = `${GRAPH_API}/${page_id}/leadgen_forms`;
    const metaPayload = {
      name,
      questions: JSON.stringify(questions),
      privacy_policy: JSON.stringify({ url: privacy_policy_url }),
      thank_you_page: JSON.stringify(thank_you_page),
      access_token: page.access_token,
    };

    const metaRes = await fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metaPayload),
    });

    const metaData = await metaRes.json();

    if (!metaRes.ok || metaData.error) {
      console.error('Meta create form error:', metaData.error);
      return json({
        success: false,
        error: `Meta API: ${metaData.error?.message ?? 'Failed to create form'}`,
      }, 502);
    }

    const metaFormId: string = metaData.id;

    // === SAVE LOCALLY ===
    const { data: localForm, error: insertError } = await supabase
      .from('meta_lead_forms')
      .insert({
        page_id,
        meta_form_id: metaFormId,
        name,
        status: 'active',
        field_mapping,
        settings: {
          ...settings,
          thank_you_title: thank_you_page.title,
          thank_you_body: thank_you_page.body,
          privacy_policy_url,
        },
        pipeline_id,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Local save error:', insertError);
      // Form was created on Meta but failed to save locally
      return json({
        success: true,
        warning: 'Form criado na Meta mas falhou ao salvar localmente. Use Sincronizar para importar.',
        meta_form_id: metaFormId,
      });
    }

    console.log(`✅ Meta Lead Form created: ${name} (${metaFormId})`);

    return json({
      success: true,
      form_id: localForm.id,
      meta_form_id: metaFormId,
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return json({ success: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
