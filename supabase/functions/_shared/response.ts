/**
 * Shared response helpers for Prospect PRO edge functions.
 *
 * Supabase SDK constraint: supabase.functions.invoke() only populates
 * res.data for 2xx responses. Non-2xx → res.data is null and the error
 * message is lost. Therefore ALL responses use HTTP 200 with { ok: true/false }.
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const ok200 = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

export const err200 = (error: string, code?: string, details?: Record<string, unknown>) =>
  new Response(JSON.stringify({ ok: false, error, ...(code ? { code } : {}), ...(details ? { details } : {}) }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

export const err401 = () =>
  new Response(JSON.stringify({ ok: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * Extract user ID from Authorization header JWT (base64-decoded sub claim).
 * Falls back to 'system' if no valid JWT is present.
 */
export function extractActor(req: Request): string {
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return 'system';
    const token = auth.replace('Bearer ', '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || 'system';
  } catch {
    return 'system';
  }
}

