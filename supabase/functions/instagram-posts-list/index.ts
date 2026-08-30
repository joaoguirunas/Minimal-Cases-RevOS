/**
 * instagram-posts-list
 *
 * Returns the 10 most recent IMAGE/VIDEO posts for the configured Instagram
 * Business Account. Credentials are read server-side from omni_channel_configs
 * and never exposed to the client.
 *
 * DEPLOY: supabase functions deploy instagram-posts-list
 *   (JWT verification ON — no --no-verify-jwt)
 *
 * GET (no body required)
 * Returns: { posts: InstagramPost[] }
 *
 * Error shapes:
 *   404 { error: 'no_instagram_config' }
 *   401 { error: 'invalid_token', message: string }
 *   502 { error: 'graph_api_error', message: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const GRAPH_BASE = 'https://graph.facebook.com/v25.0';
const MEDIA_FIELDS = 'id,media_type,media_product_type,thumbnail_url,media_url,caption,timestamp';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface InstagramPost {
  id: string;
  media_type: string;
  media_product_type: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  caption: string | null;
  timestamp: string;
}

interface GraphMediaItem {
  id: string;
  media_type: string;
  media_product_type?: string;
  thumbnail_url?: string;
  media_url?: string;
  caption?: string;
  timestamp: string;
}

interface GraphMediaResponse {
  data?: GraphMediaItem[];
  error?: { code: number; message: string; type: string };
  paging?: unknown;
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const log = createLogger('instagram-posts-list');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ── Verify JWT ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice('Bearer '.length);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    log.warn('auth_failed', { error: authError?.message });
    return json({ error: 'Unauthorized' }, 401);
  }

  log.info('request', { user_id: user.id });

  // ── Load Instagram config from DB (server-side only) ─────────────────────
  const { data: channelConfig, error: cfgError } = await supabase
    .from('omni_channel_configs')
    .select('credentials, is_active')
    .eq('channel', 'instagram')
    .maybeSingle();

  if (cfgError) {
    log.error('db_error', { error: cfgError.message });
    return json({ error: 'graph_api_error', message: 'Erro ao carregar configuração' }, 502);
  }

  if (!channelConfig) {
    log.warn('no_config');
    return json({ error: 'no_instagram_config' }, 404);
  }

  const creds = (channelConfig.credentials ?? {}) as Record<string, unknown>;
  const accessToken = (creds.access_token as string) || '';
  const igBusinessId = (creds.instagram_business_id as string) || '';

  if (!accessToken || !igBusinessId) {
    log.warn('missing_credentials', { has_token: !!accessToken, has_igbid: !!igBusinessId });
    return json({ error: 'no_instagram_config' }, 404);
  }

  // ── Call Graph API ────────────────────────────────────────────────────────
  const graphUrl =
    `${GRAPH_BASE}/${igBusinessId}/media` +
    `?fields=${MEDIA_FIELDS}&limit=10&access_token=${accessToken}`;

  let graphResp: Response;
  try {
    graphResp = await fetch(graphUrl);
  } catch (err) {
    log.error('graph_fetch_exception', { error: String(err) });
    return json({ error: 'graph_api_error', message: 'Não foi possível contactar a API do Meta' }, 502);
  }

  const graphData = await graphResp.json() as GraphMediaResponse;

  if (!graphResp.ok || graphData.error) {
    const errMsg = graphData.error?.message ?? `HTTP ${graphResp.status}`;
    const errCode = graphData.error?.code ?? graphResp.status;
    log.error('graph_api_error', { status: graphResp.status, code: errCode, message: errMsg });

    // Token invalid / expired
    if (errCode === 190 || graphResp.status === 401 || graphResp.status === 403) {
      return json({ error: 'invalid_token', message: errMsg }, 401);
    }

    return json({ error: 'graph_api_error', message: errMsg }, 502);
  }

  // ── Filter and shape response ─────────────────────────────────────────────
  const allItems = graphData.data ?? [];

  const posts: InstagramPost[] = allItems
    .filter(item => item.media_type === 'IMAGE' || item.media_type === 'VIDEO' || item.media_type === 'CAROUSEL_ALBUM')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20)
    .map(item => ({
      id: item.id,
      media_type: item.media_type,
      media_product_type: item.media_product_type ?? null,
      thumbnail_url: item.thumbnail_url ?? null,
      media_url: item.media_url ?? null,
      caption: item.caption ?? null,
      timestamp: item.timestamp,
    }));

  log.info('done', { total_raw: allItems.length, returned: posts.length });

  return json({ posts });
});
