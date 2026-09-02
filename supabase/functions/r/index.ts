/**
 * r — redirect rastreado (BI-REC-3). Público (verify_jwt=false).
 *
 * GET /functions/v1/r?t=<token> → registra o clique (clicks++, first/last_clicked_at)
 * e responde 302 para o destino. Token desconhecido → 302 para a loja (não quebra a
 * experiência de um link velho). Nunca falha o redirect por causa do log.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { progressEsteiraStage } from '../_shared/esteira-progress.ts';

const FALLBACK_URL = 'https://minimalcases.com.br/';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('t');

  let destination = FALLBACK_URL;
  if (token && /^[A-Za-z0-9]{4,32}$/.test(token)) {
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { data } = await supabase
        .from('tracked_links')
        .select('id, destination, clicks, first_clicked_at, lead_id')
        .eq('token', token)
        .maybeSingle();
      const row = data as {
        id: string; destination: string; clicks: number;
        first_clicked_at: string | null; lead_id: string | null;
      } | null;
      if (row) {
        destination = row.destination;
        const now = new Date().toISOString();
        await supabase.from('tracked_links').update({
          clicks: row.clicks + 1,
          first_clicked_at: row.first_clicked_at ?? now,
          last_clicked_at: now,
        }).eq('id', row.id);
        // Progressão da esteira (YMP-7): clique = engajamento → stage "Engajou"
        // do pipeline do lead (forward-only; nunca regride nem atrasa o redirect).
        if (row.lead_id) {
          try { await progressEsteiraStage(supabase, row.lead_id, 'Engajou'); } catch (_) { /* segue o redirect */ }
        }
      }
    } catch (_) { /* redirect sempre acontece */ }
  }

  return new Response(null, {
    status: 302,
    headers: { 'Location': destination, 'Cache-Control': 'no-store' },
  });
});
