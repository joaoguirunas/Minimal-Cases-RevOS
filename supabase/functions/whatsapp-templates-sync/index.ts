/**
 * WHATSAPP TEMPLATES SYNC — WAT-02
 *
 * Syncs WhatsApp message templates from Meta Graph API to local whatsapp_templates table.
 *
 * Flow:
 *   1. Receive { channel_id } — identifies which WA channel to sync from
 *   2. Look up waba_id + access_token from settings_whatsapp_channels
 *   3. GET /{WABA_ID}/message_templates with cursor-based pagination
 *   4. Upsert each template into whatsapp_templates (name as merge key)
 *   5. Soft-delete local templates not found in Meta
 *
 * Auth: JWT required (admin/manager only)
 *
 * Env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import {
  buildTemplateRow,
  fetchAllMetaTemplates,
  type MetaTemplate,
  resolveTemplateMatch,
  shouldSoftDelete,
  type TemplateLookupClient,
} from '../_shared/template-sync-lib.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Valida o bearer decodificando o JWT e conferindo `role === 'service_role'`.
 *
 * NUNCA comparar `bearer === SUPABASE_SERVICE_ROLE_KEY` por string: a rotação para o
 * novo sistema de API keys do Supabase quebra o string-match e o cron passa a tomar
 * 401 silencioso (memória `supabase-new-api-keys-cron-auth`).
 * Espelha ai-callback-worker/logic.ts:isServiceRoleJwt e kiwify-reconcile/logic.ts:isServiceRoleJwt.
 */
function isServiceRoleJwt(bearer: string | null | undefined): boolean {
  if (!bearer) return false;
  const parts = bearer.split('.');
  if (parts.length !== 3) return false;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { role?: string };
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const log = createLogger('whatsapp-templates-sync');
  const t0 = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Auth check ──────────────────────────────────────────────────────────
    // Two paths: an automated cron caller presents the service role key (either
    // via x-cron-key or the standard Authorization: Bearer header used by the
    // project's secure_http_post cron helper); everyone else must present a
    // valid user JWT (admin/manager).
    const authHeader = req.headers.get('authorization') ?? '';
    const bearer = authHeader.replace('Bearer ', '').trim();
    const cronKey = req.headers.get('x-cron-key') ?? '';
    const isCronCall =
      (serviceRoleKey.length > 0 && cronKey === serviceRoleKey) || isServiceRoleJwt(bearer);
    let actorId = 'cron';

    if (!isCronCall) {
      if (!bearer) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify the user's JWT
      const { data: { user }, error: authError } = await supabase.auth.getUser(bearer);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      actorId = user.id;
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    const { channel_id } = await req.json();
    if (!channel_id) {
      return new Response(JSON.stringify({ error: 'channel_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    log.info('sync_start', { channel_id, actor: actorId, cron: isCronCall });

    // ── Look up channel credentials ─────────────────────────────────────────
    const { data: channel, error: chError } = await supabase
      .from('settings_whatsapp_channels')
      .select('waba_id, access_token')
      .eq('id', channel_id)
      .eq('active', true)
      .single();

    if (chError || !channel) {
      return new Response(JSON.stringify({ error: 'Canal não encontrado ou inativo' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { waba_id, access_token } = channel as { waba_id: string | null; access_token: string };

    if (!waba_id) {
      return new Response(JSON.stringify({ error: 'WABA ID não configurado neste canal' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch templates from Meta ───────────────────────────────────────────
    let metaTemplates: MetaTemplate[];
    try {
      metaTemplates = await fetchAllMetaTemplates(waba_id, access_token, log);
    } catch (e: unknown) {
      const fe = e as { message?: string; status?: number };
      return new Response(JSON.stringify({ error: fe.message }), {
        status: fe.status || 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Upsert templates ────────────────────────────────────────────────────
    // Match precedence id_template → slug → name lives in resolveTemplateMatch.
    // A `name` match is what repairs rows whose id_template is a `pending_*`
    // placeholder (their real Meta id is written by the update).
    const lookup: TemplateLookupClient = {
      async matchByIdTemplate(idTemplate) {
        const { data } = await supabase
          .from('whatsapp_templates')
          .select('id, slug')
          .eq('id_template', idTemplate)
          .maybeSingle();
        return data ?? null;
      },
      async matchBySlug(slug) {
        const { data } = await supabase
          .from('whatsapp_templates')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();
        return data ?? null;
      },
      async matchByName(name) {
        const { data } = await supabase
          .from('whatsapp_templates')
          .select('id, id_template')
          .eq('name', name)
          .maybeSingle();
        return data ?? null;
      },
    };

    const syncedAt = new Date().toISOString();
    let created = 0;
    let updated = 0;

    for (const tpl of metaTemplates) {
      const row = buildTemplateRow(tpl, syncedAt);
      const match = await resolveTemplateMatch(lookup, tpl);

      if (match.kind === 'none') {
        await supabase
          .from('whatsapp_templates')
          .insert({ ...row, system_enabled: false });
        created++;
        continue;
      }

      await supabase
        .from('whatsapp_templates')
        .update(row)
        .eq('id', match.id);
      updated++;

      if (match.kind === 'name' && match.previousIdTemplate?.startsWith('pending_')) {
        log.info('id_template_fixed', {
          name: tpl.name,
          old: match.previousIdTemplate,
          new: tpl.id,
        });
      }
    }

    // ── Reconciliation: mark local templates deleted when gone from Meta ───────
    // A template with id_template set that is absent from Meta's response was
    // deleted (or rejected permanently) on Meta. Mark it locally as 'deleted'.
    // Local-only templates (no id_template) are not touched here — they have
    // never been submitted and don't represent a Meta deletion.
    const metaIds = new Set(metaTemplates.map((t) => t.id));

    const { data: localTemplates } = await supabase
      .from('whatsapp_templates')
      .select('id, slug, id_template, name')
      .neq('status', 'deleted');

    let softDeleted = 0;

    for (const local of localTemplates ?? []) {
      if (shouldSoftDelete(local, metaIds)) {
        await supabase
          .from('whatsapp_templates')
          .update({ status: 'deleted', system_enabled: false, updated_at: new Date().toISOString() })
          .eq('id', local.id);
        softDeleted++;
        log.info('template_soft_deleted', { name: local.name, id_template: local.id_template });
      }
    }

    const submitted = 0; // kept for response shape compatibility

    const result = {
      synced: metaTemplates.length,
      created,
      updated,
      submitted,
      deleted: softDeleted,
    };

    log.info('sync_complete', { ...result, duration_ms: log.elapsed(t0) });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const msg = (err as Error)?.message ?? String(err);
    log.error('sync_failed', { error: msg });
    return new Response(JSON.stringify({ error: msg ?? 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
