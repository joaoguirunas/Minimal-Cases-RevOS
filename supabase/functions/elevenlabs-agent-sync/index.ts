// =============================================================================
// elevenlabs-agent-sync — Sync voice agent config → ElevenLabs Conversational AI
// Epic: VOICE-AGENTS-MVP / Story: VA-02
//
// Input:  { ai_agent_id: uuid }
// Output: { success: true, elevenlabs_agent_id: string, sync_status: string }
//
// Flow:
//   1. Load ai_agent (must be agent_type='voice')
//   2. Decrypt ElevenLabs API key
//   3. Build Conversational AI payload
//   4. If elevenlabs_agent_id exists → PATCH /agents/{id}, else → POST /agents/create
//   5. Update ai_agents with sync status + agent ID
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EL_API_BASE = 'https://api.elevenlabs.io/v1/convai/agents';
const EL_CREATE_URL = `${EL_API_BASE}/create`;

// Convai TTS supports a subset of ElevenLabs TTS models. Anything outside this
// allowlist falls back to eleven_flash_v2_5. The expressive family
// (eleven_v3, eleven_v3_5, eleven_turbo_v3) is TTS-only and rejected by the
// Convai PATCH/POST with `expressive_tts_not_allowed`.
const CONVAI_TTS_MODELS = new Set([
  'eleven_flash_v2_5',
  'eleven_flash_v2',
  'eleven_turbo_v2_5',
  'eleven_turbo_v2',
  'eleven_multilingual_v2',
]);

const sanitizeTtsModel = (model: string | null | undefined): string => {
  if (model && CONVAI_TTS_MODELS.has(model)) return model;
  return 'eleven_flash_v2_5';
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Parse input ──────────────────────────────────────────────────────────
    const { ai_agent_id } = await req.json() as { ai_agent_id: string };

    if (!ai_agent_id) {
      return new Response(
        JSON.stringify({ error: 'ai_agent_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Supabase client ──────────────────────────────────────────────────────
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
        JSON.stringify({ error: 'Agente não encontrado', details: agentError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (agent.agent_type !== 'voice') {
      return new Response(
        JSON.stringify({ error: 'Apenas agentes do tipo voice podem ser sincronizados' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Load ElevenLabs config ───────────────────────────────────────────────
    const { data: config, error: cfgError } = await supabase
      .from('settings_elevenlabs')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (cfgError) {
      return new Response(
        JSON.stringify({
          error: 'Falha ao ler configuração da ElevenLabs',
          details: cfgError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!config) {
      return new Response(
        JSON.stringify({
          error: 'ElevenLabs ainda não foi configurado',
          details: 'Cadastre a chave de API em Configurações > Integrações > ElevenLabs antes de sincronizar.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!config.active) {
      return new Response(
        JSON.stringify({
          error: 'Integração ElevenLabs está desativada',
          details: 'Reative a integração em Configurações > Integrações > ElevenLabs.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Decrypt API key — fall back to plaintext when decryption returns null.
    let apiKey: string | null = null;
    if (config.api_key_encrypted) {
      const { data: decrypted, error: decryptErr } = await supabase.rpc('decrypt_elevenlabs_key', {
        encrypted_key: config.api_key_encrypted,
      });
      if (decryptErr) {
        console.error('decrypt_elevenlabs_key failed:', decryptErr);
      }
      apiKey = decrypted ?? null;
    }
    if (!apiKey) apiKey = config.api_key;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'Chave de API ElevenLabs não encontrada',
          details: 'A configuração existe, mas o campo de API key está vazio. Atualize-a em Configurações > Integrações > ElevenLabs.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Build prompt from identity + general_rules ───────────────────────────
    const promptParts: string[] = [];
    if (agent.identity) promptParts.push(agent.identity);
    if (agent.general_rules) promptParts.push(agent.general_rules);
    const combinedPrompt = promptParts.join('\n\n');

    // ── Resolve voice_id (required by ElevenLabs API) ────────────────────────
    const resolvedVoiceId = agent.voice_id || config.default_voice_id;
    if (!resolvedVoiceId) {
      // Distinguish "voices catalog never synced" from "synced but none chosen"
      // so the user knows whether to sync voices first or just pick one.
      const { count: voicesCount } = await supabase
        .from('elevenlabs_voices')
        .select('voice_id', { count: 'exact', head: true });

      const noVoicesAvailable = (voicesCount ?? 0) === 0;
      const error = noVoicesAvailable
        ? 'Nenhuma voz disponível para sincronizar'
        : 'Nenhuma voz selecionada para o agente';
      const details = noVoicesAvailable
        ? 'A biblioteca de vozes ElevenLabs ainda não foi sincronizada. Vá em Configurações > Integrações > ElevenLabs e clique em "Sincronizar vozes".'
        : 'Selecione uma voz na configuração do agente, ou defina uma voz padrão em Configurações > Integrações > ElevenLabs.';

      return new Response(
        JSON.stringify({ error, details, sync_status: 'error' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Build ElevenLabs Conversational AI payload ───────────────────────────
    // Convai supports only a subset of TTS models (eleven_v3 is TTS-only and
    // rejected here). Map first to the agent's preference, then fall back to
    // the workspace default, then to the safe default.
    const ttsModelId = sanitizeTtsModel(
      agent.voice_model_id || config.default_model_id,
    );

    // Only include fields that are explicitly set in ORA — avoid overwriting EL values with fallbacks.
    // For PATCH requests, omitted fields are left unchanged in EL.
    const agentConfig: Record<string, unknown> = {
      language: agent.voice_language || 'pt',
    };
    if (combinedPrompt) agentConfig.prompt = { prompt: combinedPrompt };
    if (agent.voice_first_message) agentConfig.first_message = agent.voice_first_message;

    const payload = {
      name: agent.name || 'Voice Agent',
      conversation_config: {
        agent: agentConfig,
        tts: {
          voice_id: resolvedVoiceId,
          model_id: ttsModelId,
          stability: agent.voice_stability ?? 0.5,
          similarity_boost: agent.voice_similarity ?? 0.75,
          speed: agent.voice_speed ?? 1.0,
        },
      },
    };

    // ── Resolve EL string ID via elevenlabs_agents table ────────────────────
    // ai_agents.elevenlabs_agent_id is a UUID FK → elevenlabs_agents.id
    // The actual EL string ID (e.g. "agent_5301kb365...") lives in elevenlabs_agents.elevenlabs_agent_id
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

    console.log(`🔄 Syncing voice agent "${agent.name}" (${ai_agent_id}) to ElevenLabs — el_id=${elStringId ?? 'new'}...`);
    console.log('Convai payload:', {
      voice_id: resolvedVoiceId,
      model_id: ttsModelId,
      language: payload.conversation_config.agent.language,
      requested_model: agent.voice_model_id ?? null,
      default_model: config.default_model_id ?? null,
    });

    // ── Create or Update on ElevenLabs ───────────────────────────────────────
    let response: Response;

    if (elStringId) {
      // PATCH existing agent — endpoint: /v1/convai/agents/{agent_id}
      response = await fetch(`${EL_API_BASE}/${elStringId}`, {
        method: 'PATCH',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } else {
      // POST new agent — endpoint: /v1/convai/agents/create
      response = await fetch(EL_CREATE_URL, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        'ElevenLabs Convai API error:',
        response.status,
        'url:', elStringId ? `PATCH ${EL_API_BASE}/${elStringId}` : `POST ${EL_CREATE_URL}`,
        'body:', errorBody,
      );

      await supabase
        .from('ai_agents')
        .update({ el_sync_status: 'error', updated_at: new Date().toISOString() })
        .eq('id', ai_agent_id);

      // Surface a structured detail when ElevenLabs returns JSON
      let parsedDetail: unknown = errorBody;
      try {
        parsedDetail = JSON.parse(errorBody);
      } catch {
        // keep raw text
      }

      // Extract the most actionable message for the user. ElevenLabs Convai
      // returns errors in several shapes:
      //   { detail: { status: "...", message: "..." } }   — most common
      //   { detail: "string"      }                        — auth/simple errors
      //   { detail: [{ loc, msg, type }]   }               — FastAPI validation
      //   { message: "..."        }                        — fallback
      const flattenDetail = (d: unknown): string => {
        if (d == null) return '';
        if (typeof d === 'string') return d;
        if (Array.isArray(d)) {
          return d.map(flattenDetail).filter(Boolean).join('; ');
        }
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

      const flatDetail = flattenDetail(parsedDetail);
      const isExpressiveTtsBlocked =
        /expressive[_\s]?tts/i.test(flatDetail) ||
        /expressive_tts_not_allow/i.test(flatDetail);

      const friendly = (() => {
        if (response.status === 401) return 'Chave de API ElevenLabs inválida ou expirada — confira em Configurações > ElevenLabs.';
        if (response.status === 400 && isExpressiveTtsBlocked)
          return 'Modelo de voz expressiva (Eleven v3) não disponível no Convai. Selecione Flash v2.5, Turbo v2.5 ou Multilingual v2 no agente.';
        if (response.status === 403 && isExpressiveTtsBlocked)
          return 'Modelo de voz expressiva não disponível no seu plano ElevenLabs. Selecione Flash v2.5 ou Multilingual v2 no agente.';
        if (response.status === 403) return 'Acesso negado pela ElevenLabs (workspace sem permissão para Conversational AI).';
        if (response.status === 404 && elStringId) return `Agente ${elStringId} não existe mais na ElevenLabs — limpe o vínculo e sincronize de novo.`;
        if (response.status === 422) return 'Payload rejeitado pela ElevenLabs (voice_id, model_id ou idioma inválido).';
        if (response.status === 429) return 'Limite de requisições da ElevenLabs atingido — tente em alguns minutos.';
        if (response.status >= 500) return 'ElevenLabs indisponível no momento — tente novamente em instantes.';
        return `ElevenLabs respondeu ${response.status}.`;
      })();

      return new Response(
        JSON.stringify({
          error: friendly,
          details: flatDetail,
          status: response.status,
          sync_status: 'error',
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const result = await response.json() as { agent_id?: string };

    // For POST (create), EL returns the new agent_id string
    if (!elStringId && result.agent_id) {
      elStringId = result.agent_id;
    }

    console.log(`✅ ElevenLabs sync success — agent_id: ${elStringId}`);

    // ── Upsert into elevenlabs_agents and resolve UUID FK ────────────────────
    let newElFkUuid: string | null = elAgentFk;

    if (elStringId) {
      const elAgentRow = {
        elevenlabs_agent_id: elStringId,
        name: agent.name,
        voice_id: resolvedVoiceId,
        language: agent.voice_language || 'pt',
        first_message: agent.voice_first_message || null,
        llm_provider: agent.llm_provider || null,
        llm_model: agent.llm_model || null,
        status: 'active',
        ai_agent_id: ai_agent_id,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: upserted, error: upsertErr } = await supabase
        .from('elevenlabs_agents')
        .upsert(elAgentRow, { onConflict: 'elevenlabs_agent_id' })
        .select('id')
        .maybeSingle();

      if (upsertErr) {
        console.error('Failed to upsert elevenlabs_agents tracking row:', upsertErr);
      }
      if (upserted?.id) newElFkUuid = upserted.id;
    }

    // ── Update ai_agents with sync result ────────────────────────────────────
    const updateData: Record<string, unknown> = {
      el_sync_status: 'synced',
      el_last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Store UUID FK if this was a newly created EL agent
    if (newElFkUuid && newElFkUuid !== elAgentFk) {
      updateData.elevenlabs_agent_id = newElFkUuid;
    }

    await supabase
      .from('ai_agents')
      .update(updateData)
      .eq('id', ai_agent_id);

    return new Response(
      JSON.stringify({
        success: true,
        elevenlabs_agent_id: elStringId,
        sync_status: 'synced',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('elevenlabs-agent-sync error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
