// =============================================================================
// elevenlabs-tts — Text-to-Speech via ElevenLabs API
// Epic: EPIC-ELEVENLABS-INFRA / Story: EL-02
//
// Input:  { text, voice_id?, model_id?, output_format? }
// Output: { url, characters_used, duration_ms }
//
// Flow: text → ElevenLabs TTS API → MP3 → Supabase Storage → public URL
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startAt = Date.now();

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Parse input ──────────────────────────────────────────────────────────
    const body = await req.json();
    const text: string = body.text ?? '';
    const voiceIdOverride: string | null = body.voice_id ?? null;
    const modelIdOverride: string | null = body.model_id ?? null;
    const outputFormatOverride: string | null = body.output_format ?? null;
    const voiceSettings: { stability?: number; similarity_boost?: number; style?: number; speed?: number } | null =
      body.voice_settings ?? null;

    if (!text.trim()) {
      return new Response(
        JSON.stringify({ error: 'text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (text.length > 10_000) {
      return new Response(
        JSON.stringify({ error: 'text exceeds 10,000 character limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Load config ──────────────────────────────────────────────────────────
    const { data: config, error: cfgError } = await supabase
      .from('settings_elevenlabs')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (cfgError || !config) {
      return new Response(
        JSON.stringify({ error: 'ElevenLabs not configured — add API key in Settings' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Try encrypted key first, fall back to plaintext
    let apiKey: string | null = null;
    if (config.api_key_encrypted) {
      const { data: decrypted } = await supabase.rpc('decrypt_elevenlabs_key', {
        encrypted_key: config.api_key_encrypted,
      });
      apiKey = decrypted;
    }
    if (!apiKey) apiKey = config.api_key;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ElevenLabs API key not configured' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check monthly limit
    if (config.monthly_char_limit && config.monthly_char_used >= config.monthly_char_limit) {
      return new Response(
        JSON.stringify({ error: 'Monthly character limit exceeded', used: config.monthly_char_used, limit: config.monthly_char_limit }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const voiceId = voiceIdOverride || config.default_voice_id;
    const modelId = modelIdOverride || config.default_model_id || 'eleven_flash_v2_5';
    const outputFormat = outputFormatOverride || config.default_output_format || 'mp3_44100_128';

    if (!voiceId) {
      return new Response(
        JSON.stringify({ error: 'No voice_id provided and no default voice configured' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Call ElevenLabs TTS API ───────────────────────────────────────────────
    const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`;

    const ttsResponse = await fetch(ttsUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        ...(voiceSettings && {
          voice_settings: {
            stability: voiceSettings.stability ?? 0.5,
            similarity_boost: voiceSettings.similarity_boost ?? 0.75,
            style: voiceSettings.style ?? 0,
            ...(voiceSettings.speed != null && voiceSettings.speed !== 1 ? { speed: voiceSettings.speed } : {}),
          },
        }),
      }),
    });

    if (!ttsResponse.ok) {
      const errorBody = await ttsResponse.text();
      console.error('ElevenLabs TTS error:', ttsResponse.status, errorBody);
      return new Response(
        JSON.stringify({ error: `ElevenLabs API error: ${ttsResponse.status}`, details: errorBody }),
        { status: ttsResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Upload to Storage ────────────────────────────────────────────────────
    const audioBuffer = await ttsResponse.arrayBuffer();
    const ext = outputFormat.startsWith('mp3') ? 'mp3'
      : outputFormat.startsWith('opus') ? 'ogg'
      : outputFormat.startsWith('ogg') ? 'ogg'
      : outputFormat.startsWith('pcm') ? 'pcm' : 'bin';
    const mimeType = outputFormat.startsWith('mp3') ? 'audio/mpeg'
      : outputFormat.startsWith('opus') ? 'audio/ogg'
      : outputFormat.startsWith('ogg') ? 'audio/ogg'
      : 'application/octet-stream';
    const fileName = `tts/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('omni-media')
      .upload(fileName, audioBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload audio', details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('omni-media')
      .getPublicUrl(fileName);

    // ── Update character counter ─────────────────────────────────────────────
    const charsUsed = text.length;
    await supabase
      .from('settings_elevenlabs')
      .update({
        monthly_char_used: (config.monthly_char_used || 0) + charsUsed,
      })
      .eq('id', config.id);

    const durationMs = Date.now() - startAt;

    return new Response(
      JSON.stringify({
        url: urlData.publicUrl,
        characters_used: charsUsed,
        duration_ms: durationMs,
        model_id: modelId,
        voice_id: voiceId,
        output_format: outputFormat,
        mime_type: mimeType,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('elevenlabs-tts error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
