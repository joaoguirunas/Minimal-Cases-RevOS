/**
 * META LEAD FORMS — Subscribe Page to Leadgen Webhook
 *
 * POST /meta-pages-subscribe
 * Body: { page_id: string }
 *
 * All responses are HTTP 200 with { success: true/false }
 * because supabase.functions.invoke discards body for non-2xx.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API = 'https://graph.facebook.com/v25.0';

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    // === AUTH ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ success: false, error: 'Unauthorized — no Bearer token' });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return json({ success: false, error: 'Sessão inválida ou expirada.' });
    }

    // === PARSE BODY ===
    const body = await req.json();
    const { page_id } = body as { page_id: string };

    if (!page_id) {
      return json({ success: false, error: 'page_id ausente.' });
    }

    // === READ PAGE TOKEN (service_role) ===
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: page, error: pageError } = await supabase
      .from('meta_lead_form_pages')
      .select('page_id, page_name, access_token')
      .eq('page_id', page_id)
      .single();

    if (pageError || !page) {
      console.error('[meta-pages-subscribe] Page not found:', page_id, pageError);
      return json({
        success: false,
        error: 'Page não encontrada no banco. Execute "Buscar minhas Pages" novamente.',
      });
    }

    if (!page.access_token) {
      return json({
        success: false,
        error: 'Token da Page não disponível. Reconecte com Facebook.',
      });
    }

    // === SUBSCRIBE TO LEADGEN WEBHOOK ===
    console.log(`[meta-pages-subscribe] Subscribing page ${page_id} to leadgen...`);
    const subscribeUrl = `${GRAPH_API}/${page_id}/subscribed_apps`;
    const subscribeRes = await fetch(subscribeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscribed_fields: 'leadgen',
        access_token: page.access_token,
      }),
    });

    const subscribeData = await subscribeRes.json();

    if (!subscribeRes.ok || subscribeData.error) {
      const errMsg = subscribeData.error?.message ?? JSON.stringify(subscribeData);
      console.error('[meta-pages-subscribe] Subscribe FAILED:', errMsg);
      return json({
        success: false,
        error: `Falha ao ativar webhook: ${errMsg}`,
      });
    }

    // === UPDATE SUBSCRIBED STATUS ===
    await supabase
      .from('meta_lead_form_pages')
      .update({ subscribed: true, updated_at: new Date().toISOString() })
      .eq('page_id', page_id);

    console.log(`✅ [meta-pages-subscribe] Page ${page.page_name} (${page_id}) subscribed OK`);

    return json({
      success: true,
      page_id: page.page_id,
      page_name: page.page_name,
      subscribed: true,
    });

  } catch (err) {
    console.error('[meta-pages-subscribe] Unexpected error:', err);
    return json({ success: false, error: `Erro inesperado: ${String(err)}` });
  }
});
