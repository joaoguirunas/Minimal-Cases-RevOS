/**
 * r — redirect rastreado (LINKS-V2). Público (verify_jwt=false).
 *
 * GET /functions/v1/r?t=<token>[?extra] →
 *   1. classifica a request (humano × crawler de preview/scanner/prefetch) — função pura;
 *   2. UMA chamada ao banco (rpc record_tracked_click): grava o hit em tracked_link_clicks,
 *      conta só humano não duplicado em tracked_links e devolve o destino;
 *   3. responde 302 imediatamente (robô inclusive — o preview precisa do redirect);
 *   4. em background (EdgeRuntime.waitUntil): move o lead para "Engajou" e, no PRIMEIRO
 *      clique humano, agenda o retorno reativo (se habilitado na config).
 * Token desconhecido → 302 para a loja. Nunca falha o redirect por causa do log.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { progressEsteiraStage } from '../_shared/esteira-progress.ts';
import { classifyClick, clickInfoFromRequest, extractClientIp, hashIp } from '../_shared/click-classifier.ts';
import { scheduleClickNudge } from '../_shared/click-nudge.ts';

const FALLBACK_URL = 'https://minimalcases.com.br/';

// Supabase Edge Runtime expõe EdgeRuntime.waitUntil (background tasks). Fallback: await.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
function runInBackground(p: Promise<unknown>): Promise<unknown> | null {
  const safe = p.catch(() => undefined);
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime && typeof EdgeRuntime.waitUntil === 'function') {
    EdgeRuntime.waitUntil(safe);
    return null;
  }
  return safe;
}

interface ClickResult {
  destination: string; lead_id: string | null; people_id: string | null;
  tracked_link_id: string; counted: boolean; first_human: boolean; source: string;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Templates anexam query ao {{link_checkout}} ("…?discount=VOLTA10&utm_…"), que
  // vira "r?t=TOKEN?discount=…" — o token é só o trecho até o primeiro '?', e
  // tudo o mais (inclusive outros params da URL) é repassado ao destino.
  const rawT = url.searchParams.get('t') ?? '';
  const [token, ...tailParts] = rawT.split('?');
  const extra = new URLSearchParams(tailParts.join('?'));
  for (const [k, v] of url.searchParams) if (k !== 't') extra.append(k, v);
  const extraQs = extra.toString();

  let destination = FALLBACK_URL;
  let background: Promise<unknown> | null = null;

  if (token && /^[A-Za-z0-9]{4,32}$/.test(token)) {
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const cls = classifyClick(clickInfoFromRequest(req));
      const salt = Deno.env.get('TRACKED_LINKS_SALT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'tracked-links';
      const ipHash = await hashIp(extractClientIp(req.headers), salt);

      const { data } = await supabase.rpc('record_tracked_click', {
        p_token: token,
        p_is_bot: cls.isBot,
        p_bot_reason: cls.reason,
        p_user_agent: (req.headers.get('user-agent') ?? '').slice(0, 512) || null,
        p_ip_hash: ipHash,
        p_referer: (req.headers.get('referer') ?? '').slice(0, 512) || null,
        p_device: cls.device,
      });
      const row = (Array.isArray(data) ? data[0] : data) as ClickResult | undefined;

      if (row?.destination) {
        destination = row.destination;
        if (row.counted) {
          background = runInBackground((async () => {
            // Progressão da esteira (YMP-7): clique humano = engajamento → "Engajou" (forward-only).
            if (row.lead_id) {
              try { await progressEsteiraStage(supabase, row.lead_id, 'Engajou'); } catch (_) { /* segue */ }
            }
            // Retorno reativo só no PRIMEIRO clique humano do link (config decide se agenda).
            if (row.first_human) {
              try { await scheduleClickNudge(supabase, { linkId: row.tracked_link_id, leadId: row.lead_id, peopleId: row.people_id }); } catch (_) { /* segue */ }
            }
          })());
        }
      }
    } catch (_) { /* redirect sempre acontece */ }
  }

  if (extraQs && destination !== FALLBACK_URL) {
    destination += (destination.includes('?') ? '&' : '?') + extraQs;
  }

  const res = new Response(null, {
    status: 302,
    headers: { 'Location': destination, 'Cache-Control': 'no-store' },
  });
  if (background) await background; // só quando não há waitUntil (ambiente local)
  return res;
});
