/**
 * EVOLUTION SESSION MANAGE — WhatsApp não-oficial (Evolution API, self-hosted)
 *
 * Gerencia os canais `provider='evolution'` de `settings_whatsapp_channels`
 * (integração tenant-wide — sem "canal por usuário"). MÚLTIPLOS canais Evolution
 * podem coexistir (cada um = um número/servidor distinto), então toda ação além
 * de `setup` precisa de um `channel_id` explícito pra saber sobre qual operar.
 * Chamado pela tela de config do admin.
 *
 * Auth: JWT normal (verify_jwt=true, default) + checagem de admin/gestor —
 * conectar/desconectar o WhatsApp da empresa inteira é sensível o bastante pra
 * não deixar em "qualquer autenticado" (padrão mais simples usado em
 * whatsapp-templates-manage).
 *
 * Ações:
 *   - setup    { base_url, api_key, instance_name, channel_id? } → sem channel_id,
 *                SEMPRE cria um canal novo; com channel_id, atualiza esse canal
 *                existente. Cria/atualiza também a instância no servidor Evolution
 *                (com webhook já configurado). instance_name convém ser fixo por
 *                canal (ex: "crm-principal", "crm-comercial-2").
 *   - connect  { channel_id } → GET /instance/connect — retorna QR inline (base64).
 *   - status   { channel_id } → GET /instance/connectionState — traduz pro
 *                vocabulário canônico, persiste em evolution_status.
 *   - logout   { channel_id } → desfaz o pareamento (mantém instância e canal).
 *   - delete   { channel_id } → remove a instância no servidor E a linha do canal.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import {
  createEvolutionClient,
  buildEvolutionWebhookConfig,
  toCanonicalStatus,
  qrToDataUrl,
} from '../_shared/evolution-client.ts';
import { generateToken, isAdminCaller } from '../_shared/evolution-session-manage-lib.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const log = createLogger('evolution-session-manage');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { data: caller } = await supabase
      .from('settings_users')
      .select('super_admin, user_type')
      .eq('auth_user_id', user.id)
      .maybeSingle() as unknown as { data: { super_admin: boolean; user_type: string } | null };

    if (!isAdminCaller(caller)) return jsonResponse({ error: 'Apenas admin/gestor pode gerenciar o canal WhatsApp' }, 403);

    const body = await req.json();
    const action = body.action as string;

    // ── setup: cria um canal novo, ou atualiza um existente se channel_id vier ──
    if (action === 'setup') {
      const { base_url, api_key, instance_name, channel_id: setupChannelId, label: setupLabel } = body as {
        base_url: string; api_key: string; instance_name: string; channel_id?: string; label?: string;
      };
      if (!base_url || !api_key || !instance_name) {
        return jsonResponse({ error: 'base_url, api_key e instance_name são obrigatórios' });
      }

      // Sem channel_id: SEMPRE cria um canal novo (múltiplos canais Evolution
      // coexistem) — não reusa nenhum existente por engano.
      let existing: { id: string; evolution_webhook_token: string } | null = null;
      if (setupChannelId) {
        const { data } = await supabase
          .from('settings_whatsapp_channels')
          .select('id, evolution_webhook_token')
          .eq('id', setupChannelId)
          .eq('provider', 'evolution')
          .maybeSingle() as unknown as { data: { id: string; evolution_webhook_token: string } | null };
        if (!data) return jsonResponse({ error: 'Canal Evolution não encontrado' });
        existing = data;
      }

      const webhookToken = existing?.evolution_webhook_token || generateToken();
      const cleanBaseUrl = base_url.replace(/\/+$/, '');

      const client = createEvolutionClient({ baseUrl: cleanBaseUrl, apiKey: api_key, logger: log });
      const webhookConfig = buildEvolutionWebhookConfig({
        supabaseUrl,
        webhookToken,
        pathSecret: webhookToken, // path-secreto reusa o mesmo token (defesa em profundidade, sem 2º segredo pra gerenciar)
      });

      // Cria a instância; se já existir no servidor (setup rodado 2x), segue —
      // o (re)connect abaixo é quem efetivamente pareia.
      const createResult = await client.instances.create(instance_name, { webhook: webhookConfig });
      if (!createResult.ok && createResult.error !== 'EVO_VALIDATION') {
        // EVO_VALIDATION costuma ser "instância já existe" — não é fatal aqui.
        return jsonResponse({ error: `Falha ao criar instância no Evolution: ${createResult.message ?? createResult.error}` });
      }
      if (!createResult.ok) {
        // Instância já existia — garante que o webhook está configurado mesmo assim.
        await client.webhook.set(instance_name, webhookConfig);
      }

      const row = {
        // Múltiplos canais Evolution coexistem — label precisa distinguir qual é
        // qual na lista; usa o nome da instância como padrão se não vier um custom.
        label: (setupLabel && setupLabel.trim()) || `WhatsApp (Evolution) — ${instance_name}`,
        provider: 'evolution',
        evolution_base_url: cleanBaseUrl,
        evolution_api_key: api_key,
        evolution_webhook_token: webhookToken,
        evolution_instance_name: instance_name,
        evolution_status: 'STOPPED',
        active: true,
        is_default: false,
      };

      const { data: saved, error: saveError } = existing
        ? await supabase.from('settings_whatsapp_channels').update(row).eq('id', existing.id).select('id').single()
        : await supabase.from('settings_whatsapp_channels').insert(row).select('id').single();

      if (saveError) return jsonResponse({ error: `Falha ao salvar canal: ${saveError.message}` });

      log.info('setup_ok', { channel_id: (saved as { id: string }).id, instance_name });
      return jsonResponse({ ok: true, channel_id: (saved as { id: string }).id });
    }

    // ── Ações que operam sobre um canal específico já configurado ────────────
    // Múltiplos canais Evolution podem existir — toda ação daqui em diante
    // precisa saber sobre QUAL delas operar.
    const { channel_id: actionChannelId } = body as { channel_id?: string };
    if (!actionChannelId) return jsonResponse({ error: 'channel_id é obrigatório' });

    const { data: channel } = await supabase
      .from('settings_whatsapp_channels')
      .select('id, evolution_base_url, evolution_api_key, evolution_instance_name')
      .eq('id', actionChannelId)
      .eq('provider', 'evolution')
      .maybeSingle() as unknown as {
        data: { id: string; evolution_base_url: string; evolution_api_key: string; evolution_instance_name: string } | null;
      };

    if (!channel) return jsonResponse({ error: 'Canal Evolution não encontrado' });

    const client = createEvolutionClient({
      baseUrl: channel.evolution_base_url,
      apiKey: channel.evolution_api_key,
      logger: log,
    });

    if (action === 'connect') {
      const result = await client.instances.connect(channel.evolution_instance_name);
      if (!result.ok) return jsonResponse({ error: `Falha ao conectar: ${result.message ?? result.error}` });

      // GET /instance/connect NÃO retorna "state" (só pairingCode/code/base64/count,
      // confirmado contra o servidor real) — diferente de connectionState, que tem
      // instance.state. toCanonicalStatus(undefined, hasQr) sempre cairia em FAILED
      // aqui; QR presente já significa SCAN_QR_CODE, sem precisar traduzir estado cru.
      const hasQr = !!result.data.base64;
      const canonical = hasQr ? 'SCAN_QR_CODE' : toCanonicalStatus(result.data.state as string | undefined);
      await supabase.from('settings_whatsapp_channels')
        .update({ evolution_status: canonical, evolution_last_seen_at: new Date().toISOString() })
        .eq('id', channel.id);

      return jsonResponse({ ok: true, status: canonical, qr_data_url: qrToDataUrl(result.data), pairing_code: result.data.pairingCode ?? null });
    }

    if (action === 'status') {
      const result = await client.instances.connectionState(channel.evolution_instance_name);
      if (!result.ok) return jsonResponse({ error: `Falha ao consultar status: ${result.message ?? result.error}` });

      const canonical = toCanonicalStatus(result.data.instance?.state);
      await supabase.from('settings_whatsapp_channels')
        .update({ evolution_status: canonical, evolution_last_seen_at: new Date().toISOString() })
        .eq('id', channel.id);

      return jsonResponse({ ok: true, status: canonical });
    }

    if (action === 'logout') {
      const result = await client.instances.logout(channel.evolution_instance_name);
      if (!result.ok) return jsonResponse({ error: `Falha ao desconectar: ${result.message ?? result.error}` });

      await supabase.from('settings_whatsapp_channels')
        .update({ evolution_status: 'STOPPED', evolution_last_seen_at: new Date().toISOString() })
        .eq('id', channel.id);

      return jsonResponse({ ok: true });
    }

    if (action === 'delete') {
      await client.instances.delete(channel.evolution_instance_name); // best-effort — segue mesmo se já não existir no servidor
      const { error: deleteError } = await supabase.from('settings_whatsapp_channels').delete().eq('id', channel.id);
      if (deleteError) return jsonResponse({ error: `Falha ao remover canal: ${deleteError.message}` });
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: `Ação inválida: ${action}` });
  } catch (err) {
    log.error('session_manage_failed', { error: (err as Error).message });
    return jsonResponse({ error: (err as Error).message ?? 'Internal error' });
  }
});
