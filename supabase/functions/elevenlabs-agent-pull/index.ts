// =============================================================================
// elevenlabs-agent-pull — GET voice agent config from ElevenLabs Convai
// Epic: VOICE-AGENTS-MVP
//
// Input:  { ai_agent_id: uuid }
// Output: { mapped: Partial<AgenteIA>, raw: object }
//
// Flow:
//   1. Load ai_agent (must be agent_type='voice')
//   2. Resolve EL string ID via elevenlabs_agents table
//   3. Decrypt ElevenLabs API key
//   4. GET /v1/convai/agents/{el_id} → ElevenLabs config
//   5. Map response to AgenteIA shape — does NOT persist to DB
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EL_API_BASE = 'https://api.elevenlabs.io/v1/convai/agents';

// Mirror of sanitizeTtsModel from elevenlabs-agent-sync — anything outside
// the Convai allowlist is normalized to flash v2.5 to keep the imported
// model_id valid for a subsequent push.
const CONVAI_TTS_MODELS = new Set([
  'eleven_flash_v2_5',
  'eleven_flash_v2',
  'eleven_turbo_v2_5',
  'eleven_turbo_v2',
  'eleven_multilingual_v2',
]);

const sanitizeTtsModel = (model: unknown): string => {
  if (typeof model === 'string' && CONVAI_TTS_MODELS.has(model)) return model;
  return 'eleven_flash_v2_5';
};

const flattenDetail = (d: unknown): string => {
  if (d == null) return '';
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map(flattenDetail).filter(Boolean).join('; ');
  if (typeof d === 'object') {
    const obj = d as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.msg === 'string') return obj.msg;
    if (typeof obj.detail === 'string') return obj.detail;
    if (obj.detail !== undefined) return flattenDetail(obj.detail);
    if (typeof obj.error === 'string') return obj.error;
    return JSON.stringify(d);
  }
  return String(d);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { ai_agent_id } = await req.json() as { ai_agent_id: string };

    if (!ai_agent_id) {
      return new Response(
        JSON.stringify({ error: 'ai_agent_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Load agent ───────────────────────────────────────────────────────────
    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', ai_agent_id)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({
          error: 'Agente não encontrado',
          details: agentError?.message ?? null,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (agent.agent_type !== 'voice') {
      return new Response(
        JSON.stringify({
          error: 'Agente não é do tipo voice',
          details: `agent_type=${agent.agent_type ?? 'null'} — só agentes de voz podem ser importados.`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Load ElevenLabs config + decrypt key ─────────────────────────────────
    const { data: config, error: cfgError } = await supabase
      .from('settings_elevenlabs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cfgError) {
      return new Response(
        JSON.stringify({ error: 'Falha ao ler configuração da ElevenLabs', details: cfgError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!config || !config.active) {
      return new Response(
        JSON.stringify({
          error: 'ElevenLabs não está ativo',
          details: 'Configure e ative em Configurações > Integrações > ElevenLabs.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let apiKey: string | null = null;
    if (config.api_key_encrypted) {
      const { data: decrypted, error: decryptErr } = await supabase.rpc('decrypt_elevenlabs_key', {
        encrypted_key: config.api_key_encrypted,
      });
      if (decryptErr) console.error('decrypt_elevenlabs_key failed:', decryptErr);
      apiKey = decrypted ?? null;
    }
    if (!apiKey) apiKey = config.api_key;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'Chave de API ElevenLabs não encontrada',
          details: 'Atualize a chave em Configurações > Integrações > ElevenLabs.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Resolve EL string ID via elevenlabs_agents table ─────────────────────
    let elStringId: string | null = null;
    const elAgentFk: string | null = agent.elevenlabs_agent_id ?? null;

    if (elAgentFk) {
      const { data: elRow } = await supabase
        .from('elevenlabs_agents')
        .select('elevenlabs_agent_id')
        .eq('id', elAgentFk)
        .maybeSingle();
      elStringId = elRow?.elevenlabs_agent_id ?? null;
    }

    if (!elStringId) {
      return new Response(
        JSON.stringify({
          error: 'Agente ainda não foi sincronizado',
          details: 'Sincronize ao menos uma vez antes de importar — sem ID na ElevenLabs não é possível buscar a config.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── GET on ElevenLabs ────────────────────────────────────────────────────
    console.log(`📥 Pulling voice agent "${agent.name}" (${ai_agent_id}) from ElevenLabs — el_id=${elStringId}...`);

    const response = await fetch(`${EL_API_BASE}/${elStringId}`, {
      method: 'GET',
      headers: { 'xi-api-key': apiKey },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('ElevenLabs Convai GET error:', response.status, 'body:', errorBody);

      let parsedDetail: unknown = errorBody;
      try { parsedDetail = JSON.parse(errorBody); } catch { /* keep raw */ }

      const friendly = (() => {
        if (response.status === 401) return 'Chave de API ElevenLabs inválida ou expirada.';
        if (response.status === 403) return 'Acesso negado pela ElevenLabs (workspace sem permissão para Conversational AI).';
        if (response.status === 404) return `Agente ${elStringId} não existe mais na ElevenLabs — limpe o vínculo e crie um novo.`;
        if (response.status === 429) return 'Limite de requisições da ElevenLabs atingido — tente em alguns minutos.';
        if (response.status >= 500) return 'ElevenLabs indisponível no momento.';
        return `ElevenLabs respondeu ${response.status}.`;
      })();

      return new Response(
        JSON.stringify({
          error: friendly,
          details: flattenDetail(parsedDetail),
          status: response.status,
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const remote = await response.json() as Record<string, unknown>;

    // ── Map ElevenLabs response → AgenteIA-compatible shape ──────────────────
    // EL Convai response shape (relevant subset):
    //   {
    //     name: "...",
    //     conversation_config: {
    //       agent: { prompt: { prompt: "..." }, first_message: "...", language: "..." },
    //       tts:   { voice_id: "...", model_id: "...", stability, similarity_boost, speed }
    //     }
    //   }
    type ConvaiAgentBlock = {
      prompt?: { prompt?: unknown } | null;
      first_message?: unknown;
      language?: unknown;
    };
    type ConvaiTtsBlock = {
      voice_id?: unknown;
      model_id?: unknown;
      stability?: unknown;
      similarity_boost?: unknown;
      speed?: unknown;
    };
    type ConvaiConfig = {
      agent?: ConvaiAgentBlock | null;
      tts?: ConvaiTtsBlock | null;
    };

    const conv = (remote.conversation_config ?? {}) as ConvaiConfig;
    const ag = (conv.agent ?? {}) as ConvaiAgentBlock;
    const tts = (conv.tts ?? {}) as ConvaiTtsBlock;

    const asString = (v: unknown): string | null =>
      typeof v === 'string' && v.length > 0 ? v : null;

    const asNumber = (v: unknown, fallback: number | null = null): number | null => {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
      return fallback;
    };

    // Per spec: EL has no separation between identity/general_rules. Dump the
    // entire prompt into `identity` and leave `general_rules` empty.
    const promptText = asString(ag.prompt?.prompt) ?? '';

    const mapped = {
      name: asString(remote.name) ?? agent.name,
      identity: promptText,
      general_rules: '',
      voice_first_message: asString(ag.first_message) ?? '',
      voice_language: asString(ag.language) ?? 'pt',
      voice_id: asString(tts.voice_id),
      voice_model_id: sanitizeTtsModel(tts.model_id),
      voice_stability: asNumber(tts.stability, 0.5),
      voice_similarity: asNumber(tts.similarity_boost, 0.75),
      voice_speed: asNumber(tts.speed, 1.0),
      el_sync_status: 'synced' as const,
      el_last_synced_at: new Date().toISOString(),
    };

    console.log(`✅ ElevenLabs pull success — mapped fields ready for review`);

    return new Response(
      JSON.stringify({ success: true, mapped, raw: remote }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('elevenlabs-agent-pull error:', err);
    return new Response(
      JSON.stringify({
        error: 'Erro inesperado ao importar do ElevenLabs',
        details: (err as Error)?.message ?? String(err),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
