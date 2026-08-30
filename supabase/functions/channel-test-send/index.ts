import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  sendEmailWithConfig,
  hasDirectEmailProvider,
  escapeHtml,
  type EmailCredentials,
} from '../_shared/email-provider.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RequestSchema = z.object({
  channel: z.enum(['email', 'sms', 'phone']),
  test_to: z.string().min(1, 'test_to é obrigatório'),
});

interface ChannelCreds {
  provider: string;
  host?: string; port?: string; user?: string; pass?: string;
  from_email?: string; from_name?: string;
  api_key?: string;
  account_sid?: string; auth_token?: string; from_number?: string;
  [key: string]: string | undefined;
}

const CHANNEL_TO_OMNI: Record<string, string> = {
  email: 'email',
  sms:   'sms',
  phone: 'telefone',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // ── Validate input ────────────────────────────────────────────────────────
    let input: z.infer<typeof RequestSchema>;
    try {
      input = RequestSchema.parse(await req.json());
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, error: e instanceof z.ZodError ? e.errors[0].message : 'Input inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { channel, test_to } = input;
    const omniKey = CHANNEL_TO_OMNI[channel];

    // ── Fetch channel config ──────────────────────────────────────────────────
    const { data: omniConfig } = await supabase
      .from('omni_channel_configs')
      .select('credentials, webhook_fallback, is_active')
      .eq('channel', omniKey)
      .maybeSingle();

    if (!omniConfig) {
      return new Response(
        JSON.stringify({ success: false, error: `Canal ${channel} não configurado` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const creds = (omniConfig.credentials ?? {}) as ChannelCreds;
    const provider = creds.provider ?? 'webhook';
    const webhookFallback = omniConfig.webhook_fallback as { url?: string } | null;

    // ── Dispatch test message ─────────────────────────────────────────────────
    const testMessage = `Mensagem de teste — ${channel.toUpperCase()} — ${new Date().toLocaleString('pt-BR')}`;

    if (channel === 'email' && hasDirectEmailProvider(creds as EmailCredentials)) {
      // Envio de teste via sender compartilhado (mesmo dispatch do worker/omni).
      // Testa mesmo com o canal inativo — sendEmailWithConfig não checa is_active.
      const testHtml = `<div style="font-family: Arial, sans-serif;"><p>${escapeHtml(testMessage)}</p></div>`;
      const result = await sendEmailWithConfig(
        { is_active: true, credentials: creds as EmailCredentials },
        { to: test_to, subject: 'Teste de configuração de e-mail', html: testHtml },
      );
      if (!result.success) {
        return new Response(
          JSON.stringify({ success: false, error: result.error ?? 'Falha no envio de e-mail de teste' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({ success: true, message: `E-mail de teste enviado via ${provider} para ${test_to}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (channel === 'sms' && provider === 'twilio') {
      if (!creds.account_sid || !creds.auth_token || !creds.from_number) {
        return new Response(
          JSON.stringify({ success: false, error: 'Twilio: Account SID, Auth Token e número são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.account_sid}/Messages.json`;
      const params = new URLSearchParams({ To: test_to, From: creds.from_number, Body: testMessage });
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${creds.account_sid}:${creds.auth_token}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        return new Response(
          JSON.stringify({ success: false, error: `Twilio ${res.status}: ${txt.substring(0, 200)}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({ success: true, message: `SMS de teste enviado via Twilio para ${test_to}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Webhook fallback for all channels
    const webhookUrl = webhookFallback?.url;
    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ success: false, error: `Canal ${channel} com provedor '${provider}' não suporta envio de teste direto. Configure um webhook para testar.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true, channel, test_to, message: testMessage }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return new Response(
        JSON.stringify({ success: false, error: `Webhook ${res.status}: ${txt.substring(0, 200)}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    return new Response(
      JSON.stringify({ success: true, message: `Teste enviado via webhook para ${test_to}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    console.error('channel-test-send error:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
