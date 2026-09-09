/**
 * email-template-test-send — envia um teste de template de e-mail para um destinatário
 * da lista de e-mails de teste (omni_channel_configs.settings.email_test_recipients).
 *
 * Contrato: POST { to, subject, html, vars? } → { success: true, provider } |
 * { success: false, error }. Sempre HTTP 200 exceto 401/403 (para o
 * `functions.invoke` entregar a mensagem de erro ao front).
 *
 * Auth: JWT do usuário → settings_users por auth_user_id, exige
 * active && !deleted_at && (super_admin || user_type === 'manager').
 *
 * Não lê nem grava nenhuma trava de envio existente: se o Klaviyo estiver
 * travado, `sendEmailWithConfig` devolve KLAVIYO_LOCKED_MSG e esta função
 * só repassa `result.error`.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import {
  sendEmailWithConfig,
  hasDirectEmailProvider,
  type EmailCredentials,
} from '../_shared/email-provider.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const RequestSchema = z.object({
  to: z.string().trim().email('E-mail de destino inválido'),
  subject: z.string().max(300, 'Assunto excede 300 caracteres'),
  html: z.string().max(200_000, 'HTML excede o limite de 200.000 caracteres'),
  vars: z.record(z.string()).optional().refine(
    (v) => !v || Object.keys(v).length <= 60,
    { message: 'vars aceita no máximo 60 chaves' },
  ),
});

interface OmniEmailSettings {
  email_test_recipients?: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: crmUser } = await supabase
      .from('settings_users')
      .select('id, user_type, super_admin, active, deleted_at')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle();

    const isManager = crmUser?.super_admin === true || crmUser?.user_type === 'manager';
    if (!crmUser || !crmUser.active || crmUser.deleted_at || !isManager) {
      return json({ success: false, error: 'Só gestores podem enviar teste.' }, 403);
    }

    // ── Validate input ────────────────────────────────────────────────────────
    let input: z.infer<typeof RequestSchema>;
    try {
      input = RequestSchema.parse(await req.json());
    } catch (e) {
      return json(
        { success: false, error: e instanceof z.ZodError ? e.errors[0].message : 'Input inválido' },
      );
    }

    const { to, subject, html, vars } = input;
    const toLower = to.toLowerCase();

    // ── Load channel config + allowlist ──────────────────────────────────────
    const { data: omniConfig } = await supabase
      .from('omni_channel_configs')
      .select('credentials, settings')
      .eq('channel', 'email')
      .maybeSingle();

    if (!omniConfig) {
      return json({ success: false, error: 'Canal e-mail não configurado' });
    }

    const settings = (omniConfig.settings ?? {}) as OmniEmailSettings;
    const allow = (settings.email_test_recipients ?? []) as string[];
    if (!allow.map((e) => e.toLowerCase()).includes(toLower)) {
      return json({
        success: false,
        error: 'Destinatário fora da lista de e-mails de teste (Configurações → Integrações → E-mail → "E-mails de teste").',
      });
    }

    const creds = (omniConfig.credentials ?? {}) as EmailCredentials;
    if (!hasDirectEmailProvider(creds)) {
      return json({ success: false, error: `Canal e-mail sem provider de envio direto (provider='${creds.provider ?? 'nenhum'}')` });
    }
    const provider = creds.provider as string;

    // ── Send ──────────────────────────────────────────────────────────────────
    const result = await sendEmailWithConfig(
      { is_active: true, credentials: creds },
      { to, subject: `[TESTE] ${subject}`, html, vars },
    );

    // Log sem HTML e sem credenciais.
    console.log('email-template-test-send', {
      to,
      bytes: html.length,
      provider,
      success: result.success,
    });

    if (!result.success) {
      return json({ success: false, error: result.error ?? 'Falha no envio do e-mail de teste' });
    }

    return json({ success: true, provider });
  } catch (error) {
    console.error('email-template-test-send error:', error);
    return json({ success: false, error: (error as Error).message });
  }
});
