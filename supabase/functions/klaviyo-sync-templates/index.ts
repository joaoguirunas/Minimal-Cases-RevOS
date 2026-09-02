/**
 * klaviyo-sync-templates (KLV-2)
 *
 * Admin-only: empurra os templates ativos da biblioteca (email_templates) para o
 * Klaviyo via Templates API (POST/PATCH /api/templates), convertendo os tokens do
 * CRM para a sintaxe de evento do Klaviyo:
 *   {{nome}}         → {{ event.nome }}
 *   {{pessoa.nome}}  → {{ event|lookup:'pessoa.nome' }}   (chave com ponto)
 *
 * Assim o Flow disparado pela métrica "CRM Email Followup" pode simplesmente
 * selecionar o template "CRM · <nome>" no editor — as propriedades do evento
 * preenchem as variáveis. (Alternativa ao template de uma linha {{ event.html|safe }}.)
 *
 * Upsert por nome: se "CRM · <nome>" já existe no Klaviyo, faz PATCH; senão POST.
 * A API key vem de omni_channel_configs (channel=email, provider klaviyo).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, err200, ok200 } from '../_shared/response.ts';
import { KlaviyoAuthError, KlaviyoClient } from '../_shared/klaviyo-client.ts';

const TOKEN_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Converte tokens do CRM para a sintaxe de evento do Klaviyo. */
export function toKlaviyoEventSyntax(text: string): string {
  return text.replace(TOKEN_RE, (_full, key: string) =>
    key.includes('.')
      ? `{{ event|lookup:'${key}' }}`
      : `{{ event.${key} }}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  try {
    // ── Auth: JWT + gate gestor (mesmo padrão dos *-connect) ────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return err200('Unauthorized', 'UNAUTHORIZED');
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return err200('Invalid token', 'UNAUTHORIZED');

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: crmUser } = await supabase
      .from('settings_users')
      .select('id, user_type, super_admin')
      .eq('auth_user_id', user.id)
      .eq('active', true)
      .maybeSingle();
    const isManager = crmUser &&
      (crmUser.super_admin === true || crmUser.user_type === 'gestor' ||
        crmUser.user_type === 'manager' || crmUser.user_type === 'admin');
    if (!crmUser || !isManager) return err200('Acesso restrito a gestores', 'FORBIDDEN');

    // ── API key do canal e-mail (provider klaviyo) ──────────────────────────
    const { data: cfg } = await supabase
      .from('omni_channel_configs')
      .select('credentials')
      .eq('channel', 'email')
      .maybeSingle();
    const creds = ((cfg as { credentials?: Record<string, string> } | null)?.credentials ?? {});
    const apiKey = creds.api_key;
    if (creds.provider !== 'klaviyo' || !apiKey) {
      return err200('Configure o canal E-mail com provider Klaviyo (e salve) antes de sincronizar.', 'NOT_CONFIGURED');
    }
    const client = new KlaviyoClient(apiKey);

    // ── Templates ativos da biblioteca ──────────────────────────────────────
    const { data: templates } = await supabase
      .from('email_templates')
      .select('id, name, subject, html_body')
      .eq('active', true)
      .order('name');
    const rows = (templates ?? []) as Array<{ id: string; name: string; subject: string; html_body: string }>;
    if (rows.length === 0) return ok200({ ok: true, synced: [], message: 'Nenhum template ativo na biblioteca.' });

    const results: Array<{ name: string; klaviyo_name: string; action: string; error?: string }> = [];
    for (const t of rows) {
      const klaviyoName = `CRM · ${t.name}`.slice(0, 255);
      const html = toKlaviyoEventSyntax(t.html_body);
      try {
        const existing = await client.findTemplateByName(klaviyoName);
        if (existing) {
          await client.updateTemplate(existing.id, klaviyoName, html);
          results.push({ name: t.name, klaviyo_name: klaviyoName, action: 'updated' });
        } else {
          await client.createTemplate(klaviyoName, html);
          results.push({ name: t.name, klaviyo_name: klaviyoName, action: 'created' });
        }
      } catch (e) {
        if (e instanceof KlaviyoAuthError) return err200('Klaviyo rejeitou a API key', 'AUTH_ERROR');
        results.push({ name: t.name, klaviyo_name: klaviyoName, action: 'failed', error: (e as Error).message.slice(0, 200) });
      }
    }

    const failed = results.filter((r) => r.action === 'failed').length;
    return ok200({
      ok: true,
      synced: results,
      created: results.filter((r) => r.action === 'created').length,
      updated: results.filter((r) => r.action === 'updated').length,
      failed,
      hint: 'No Flow (métrica CRM Email Followup), selecione o template "CRM · <nome>" e use {{ event.subject }} no assunto. Lembre: o assunto não faz parte do template no Klaviyo.',
    });
  } catch (err) {
    return err200(`Erro interno: ${(err as Error).message}`, 'INTERNAL');
  }
});
