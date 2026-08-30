/**
 * META LEAD FORMS — List Facebook Pages
 *
 * POST /meta-pages-list
 * Body: { user_access_token: string }
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
    const { user_access_token } = body as { user_access_token: string };

    if (!user_access_token) {
      return json({ success: false, error: 'Token de acesso ausente.' });
    }

    // === FETCH PAGES ===
    console.log('[meta-pages-list] Fetching pages from Graph API...');
    const pagesUrl = new URL(`${GRAPH_API}/me/accounts`);
    pagesUrl.searchParams.set('fields', 'id,name,access_token');
    pagesUrl.searchParams.set('access_token', user_access_token);
    pagesUrl.searchParams.set('limit', '100');

    const pagesRes = await fetch(pagesUrl.toString());
    const pagesData = await pagesRes.json();

    if (!pagesRes.ok || pagesData.error) {
      const errMsg = pagesData.error?.message ?? 'Failed to fetch pages';
      console.error('[meta-pages-list] Graph API error:', errMsg);
      return json({ success: false, error: `Meta API: ${errMsg}` });
    }

    const pages: Array<{ id: string; name: string; access_token: string }> = pagesData.data ?? [];

    if (pages.length === 0) {
      return json({
        success: true,
        pages: [],
      });
    }

    // === STORE PAGE TOKENS SERVER-SIDE ===
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existingPages } = await supabase
      .from('meta_lead_form_pages')
      .select('page_id, subscribed');

    const connectedPageIds = new Set((existingPages ?? []).map((p: { page_id: string }) => p.page_id));

    for (const page of pages) {
      await supabase.from('meta_lead_form_pages').upsert(
        {
          page_id: page.id,
          page_name: page.name,
          access_token: page.access_token,
        },
        { onConflict: 'page_id' }
      );
    }

    // === RETURN (without access_token) ===
    const pageList = pages.map((p) => ({
      page_id: p.id,
      page_name: p.name,
      connected: connectedPageIds.has(p.id),
      subscribed: (existingPages ?? []).find(
        (ep: { page_id: string; subscribed: boolean }) => ep.page_id === p.id
      )?.subscribed ?? false,
    }));

    console.log(`✅ [meta-pages-list] ${pageList.length} page(s) found`);
    return json({ success: true, pages: pageList });

  } catch (err) {
    console.error('[meta-pages-list] Unexpected error:', err);
    return json({ success: false, error: `Erro inesperado: ${String(err)}` });
  }
});
