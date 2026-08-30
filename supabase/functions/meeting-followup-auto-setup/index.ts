/**
 * MEETING FOLLOW-UP AUTO-SETUP
 *
 * POST /meeting-followup-auto-setup
 *
 * Auto-creates WhatsApp templates + follow-up rules for all meeting statuses.
 * Creates templates via whatsapp-templates-manage, then links them to rules.
 *
 * Body: { channel_id: string }
 * Auth: JWT required (admin/manager)
 *
 * Template presets per meeting status:
 *   agendado      → confirmacao_reuniao (immediate), lembrete_30min, lembrete_5min, lembrete_dia, lembrete_1dia_antes
 *   compareceu    → pos_reuniao_followup (immediate)
 *   realizado     → pos_reuniao_followup (immediate)
 *   nao_compareceu → ausencia_imediato (0min), ausencia_6h (6h), ausencia_24h (24h)
 *   cancelado      → reagendamento_cancelamento (immediate)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Template Definitions ──────────────────────────────────────────────────────

interface TemplatePreset {
  meta_name: string;
  label: string;
  category: string;
  language: string;
  components: Array<{
    type: string;
    text?: string;
    format?: string;
    example?: Record<string, unknown>;
    buttons?: Array<{ type: string; text: string; url?: string }>;
  }>;
}

interface RulePreset {
  meeting_status: string;
  name: string;
  template_meta_name: string;
  channel: string;
  days: number;
  hours: number;
  minutes: number;
}

const TEMPLATE_PRESETS: TemplatePreset[] = [
  // ── Confirmação ────────────────────────────────────────────────────────────
  {
    meta_name: 'confirmacao_reuniao',
    label: 'Confirmação de Agendamento',
    category: 'UTILITY',
    language: 'pt_BR',
    components: [
      {
        type: 'BODY',
        text: '{{1}}, está confirmado.\n\nSua sessão com {{5}} acontece em {{2}} às {{3}}.\n\nAcesso: {{4}}\n\nVocê também vai receber uma confirmação por e-mail. Até lá.',
        example: { body_text: [['João Silva', '20/06/2026', '14:00', 'https://meet.google.com/abc', 'Bruno']] },
      },
    ],
  },

  // ── Lembretes ─────────────────────────────────────────────────────────────
  {
    meta_name: 'lembrete_1d',
    label: 'Lembrete — 1 dia antes',
    category: 'UTILITY',
    language: 'pt_BR',
    components: [
      {
        type: 'BODY',
        text: '{{1}}, amanhã é com você.\n\nÀs {{3}} de {{2}} a sua sessão começa. Se tiver qualquer dúvida antes, é só responder aqui.\n\nAcesso: {{4}}',
        example: { body_text: [['João Silva', '20/06/2026', '14:00', 'https://meet.google.com/abc']] },
      },
    ],
  },
  {
    meta_name: 'lembrete_2h_v2',
    label: 'Lembrete — 2 horas antes',
    category: 'UTILITY',
    language: 'pt_BR',
    components: [
      {
        type: 'BODY',
        // {{1}}=nome, {{2}}=hora, {{3}}=link
        text: 'Lembrete de sessão, {{1}}.\n\nÀs {{2}} começa. Acesse o link para entrar: {{3}}\n\nQualquer dúvida, responda aqui.',
        example: { body_text: [['João Silva', '14:00', 'https://meet.google.com/abc']] },
      },
    ],
  },
  {
    meta_name: 'lembrete_30min',
    label: 'Lembrete — 30 minutos antes',
    category: 'UTILITY',
    language: 'pt_BR',
    components: [
      {
        type: 'BODY',
        // {{1}}=nome, {{2}}=link
        text: '{{1}}, faltam 30 minutos.\n\nAcessa o link quando estiver pronto.\n\n{{2}}',
        example: { body_text: [['João Silva', 'https://meet.google.com/abc']] },
      },
    ],
  },
  {
    meta_name: 'lembrete_5min',
    label: 'Lembrete — 5 minutos antes',
    category: 'UTILITY',
    language: 'pt_BR',
    components: [
      {
        type: 'BODY',
        // {{1}}=nome, {{2}}=hora, {{3}}=link
        text: '{{1}}, é agora.\n\nÀs {{2}} começa. Acessa o link abaixo.\n\n{{3}}',
        example: { body_text: [['João Silva', '14:00', 'https://meet.google.com/abc']] },
      },
    ],
  },

  // ── Ausências ──────────────────────────────────────────────────────────────
  {
    meta_name: 'ausencia_imediato',
    label: 'Ausência — Imediato',
    category: 'UTILITY',
    language: 'pt_BR',
    components: [
      {
        type: 'BODY',
        // {{1}}=nome, {{2}}=link de reagendamento
        text: '{{1}}, vimos que você não conseguiu estar presente hoje.\n\nSem problema, a agenda ainda pode ser sua. Escolhe um novo horário pelo link abaixo.\n\n{{2}}',
        example: { body_text: [['João Silva', 'https://app.example.com/agendar/uuid']] },
      },
    ],
  },
  {
    meta_name: 'ausencia_6h',
    label: 'Ausência — 6h após',
    category: 'UTILITY',
    language: 'pt_BR',
    components: [
      {
        type: 'BODY',
        // {{1}}=nome, {{2}}=link de reagendamento
        text: '{{1}}, sentimos a sua falta hoje.\n\nO que planejamos para essa sessão ainda faz muito sentido para o seu momento. Quando quiser remarcar, é só clicar abaixo.\n\n{{2}}',
        example: { body_text: [['João Silva', 'https://app.example.com/agendar/uuid']] },
      },
    ],
  },
  {
    meta_name: 'ausencia_24h',
    label: 'Ausência — 24h após',
    category: 'UTILITY',
    language: 'pt_BR',
    components: [
      {
        type: 'BODY',
        // {{1}}=nome, {{2}}=link de reagendamento
        text: '{{1}}, essa é nossa última mensagem.\n\nSe ainda fizer sentido para você, o link para remarcar fica disponível por mais 1 dia.\n\n{{2}}',
        example: { body_text: [['João Silva', 'https://app.example.com/agendar/uuid']] },
      },
    ],
  },
];

const RULE_PRESETS: RulePreset[] = [
  // agendado: confirmação imediata + 4 lembretes
  { meeting_status: 'agendado',        name: 'Confirmação de agendamento', template_meta_name: 'confirmacao_reuniao', channel: 'whatsapp', days: 0, hours: 0, minutes: 0 },
  { meeting_status: 'agendado',        name: 'Lembrete 1 dia antes',       template_meta_name: 'lembrete_1d',         channel: 'whatsapp', days: 1, hours: 0, minutes: 0 },
  { meeting_status: 'agendado',        name: 'Lembrete 2 horas antes',     template_meta_name: 'lembrete_2h_v2',      channel: 'whatsapp', days: 0, hours: 2, minutes: 0 },
  { meeting_status: 'agendado',        name: 'Lembrete 30 min antes',      template_meta_name: 'lembrete_30min',      channel: 'whatsapp', days: 0, hours: 0, minutes: 30 },
  { meeting_status: 'agendado',        name: 'Lembrete 5 min antes',       template_meta_name: 'lembrete_5min',       channel: 'whatsapp', days: 0, hours: 0, minutes: 5 },
  // nao_compareceu: 3 touchpoints
  { meeting_status: 'nao_compareceu',  name: 'Ausência — imediato',        template_meta_name: 'ausencia_imediato',   channel: 'whatsapp', days: 0, hours: 0, minutes: 0 },
  { meeting_status: 'nao_compareceu',  name: 'Ausência — 6h após',         template_meta_name: 'ausencia_6h',         channel: 'whatsapp', days: 0, hours: 6, minutes: 0 },
  { meeting_status: 'nao_compareceu',  name: 'Ausência — 24h após',        template_meta_name: 'ausencia_24h',        channel: 'whatsapp', days: 1, hours: 0, minutes: 0 },
];

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const log = createLogger('meeting-followup-auto-setup');
  const t0 = Date.now();

  try {
    // Auth
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { channel_id } = await req.json();
    if (!channel_id) return jsonResponse({ error: 'channel_id é obrigatório' }, 400);

    log.info('start', { channel_id });

    const summary = {
      templates_created: 0,
      templates_reused: 0,
      templates_failed: 0,
      rules_created: 0,
      rules_existing: 0,
    };

    // ── Step 1: Ensure all templates exist ──────────────────────────────────

    // Map meta_name → template record (id, status)
    const templateMap: Record<string, { id: string; status: string }> = {};

    for (const preset of TEMPLATE_PRESETS) {
      // Check if template already exists
      const { data: existing } = await supabase
        .from('whatsapp_templates')
        .select('id, status, meta_template_name')
        .eq('meta_template_name', preset.meta_name)
        .not('status', 'eq', 'deleted')
        .maybeSingle();

      if (existing) {
        templateMap[preset.meta_name] = { id: existing.id, status: existing.status };
        summary.templates_reused++;
        log.info('template_reused', { name: preset.meta_name, status: existing.status });
        continue;
      }

      // Create via whatsapp-templates-manage
      const createPayload = {
        action: 'create',
        channel_id,
        name: preset.meta_name,
        category: preset.category,
        language: preset.language,
        components: preset.components,
      };

      const { data: createResult, error: createErr } = await supabase.functions.invoke(
        'whatsapp-templates-manage',
        {
          body: createPayload,
          headers: { Authorization: authHeader },
        },
      );

      if (createErr || createResult?.error) {
        const errMsg = createErr?.message || createResult?.error || 'Unknown error';
        log.warn('template_create_failed', { name: preset.meta_name, error: errMsg });
        summary.templates_failed++;
        continue;
      }

      // Fetch the newly created template to get its UUID
      const { data: newTpl } = await supabase
        .from('whatsapp_templates')
        .select('id, status')
        .eq('meta_template_name', preset.meta_name)
        .not('status', 'eq', 'deleted')
        .maybeSingle();

      if (newTpl) {
        templateMap[preset.meta_name] = { id: newTpl.id, status: newTpl.status };
        summary.templates_created++;
        log.info('template_created', { name: preset.meta_name, id: newTpl.id });
      } else {
        summary.templates_failed++;
        log.warn('template_created_but_not_found_locally', { name: preset.meta_name });
      }
    }

    // ── Step 2: Create follow-up rules ──────────────────────────────────────

    for (const rule of RULE_PRESETS) {
      const tpl = templateMap[rule.template_meta_name];

      // Check if rule already exists for this status + delay combo
      const { data: existingRule } = await supabase
        .from('meetings_followups')
        .select('id')
        .eq('meeting_status', rule.meeting_status)
        .eq('days', rule.days)
        .eq('hours', rule.hours)
        .eq('minutes', rule.minutes)
        .eq('channel', rule.channel)
        .maybeSingle();

      if (existingRule) {
        summary.rules_existing++;

        // Patch existing rule: set whatsapp_template_id (UUID) and template_id (meta_name string) if missing
        const patch: Record<string, unknown> = {};
        if (tpl) patch.whatsapp_template_id = tpl.id;
        patch.template_id = rule.template_meta_name;

        if (Object.keys(patch).length > 0) {
          await supabase
            .from('meetings_followups')
            .update(patch)
            .eq('id', existingRule.id);
        }
        continue;
      }

      // Insert new rule — set both whatsapp_template_id (UUID FK) and template_id (meta_name string)
      const { error: insertErr } = await supabase
        .from('meetings_followups')
        .insert({
          meeting_status: rule.meeting_status,
          name: rule.name,
          type: 'whatsapp',
          channel: rule.channel,
          message: `[Auto] ${rule.name}`,
          template_id: rule.template_meta_name,
          days: rule.days,
          hours: rule.hours,
          minutes: rule.minutes,
          active: true,
          whatsapp_template_id: tpl?.id ?? null,
        });

      if (insertErr) {
        log.warn('rule_insert_failed', { rule: rule.name, error: insertErr.message });
      } else {
        summary.rules_created++;
        log.info('rule_created', { name: rule.name, status: rule.meeting_status });
      }
    }

    log.info('complete', { ...summary, duration_ms: log.elapsed(t0) });

    return jsonResponse({
      ...summary,
      message: `Auto-setup completo. ${summary.templates_created} templates criados, ${summary.templates_reused} reutilizados, ${summary.rules_created} regras criadas.`,
    });
  } catch (err: any) {
    log.error('failed', { error: err?.message ?? String(err) });
    return jsonResponse({ error: err?.message ?? 'Internal error' }, 500);
  }
});
