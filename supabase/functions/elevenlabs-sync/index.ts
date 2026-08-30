// =============================================================================
// elevenlabs-sync — Sync voices from ElevenLabs (workspace + shared library)
// Epic: EPIC-OMNI-PRO-V2 / Story: OP-12
//
// Input:  (none required)
// Output: { synced: N, added: N, removed: N, shared: N }
//
// Flow:
//   1. GET /v1/voices → workspace voices (custom, cloned, defaults)
//   2. GET /v1/shared-voices → shared library (Portuguese, English, professional)
//   3. Upsert all to elevenlabs_voices with source tag
//   4. Cleanup stale workspace voices (shared voices are never auto-removed)
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Languages to fetch from shared library
const SHARED_LANGUAGES = ['pt', 'en', 'es'];
const SHARED_PAGE_SIZE = 100; // max per request
const SHARED_MAX_PAGES = 3;  // max pages per language (300 voices per lang)

interface WorkspaceVoice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  description?: string;
  preview_url?: string;
  settings?: { stability?: number; similarity_boost?: number; style?: number; speed?: number };
}

interface SharedVoice {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
  gender?: string;
  use_cases?: string[];
  rate?: number;
  cloned_by_count?: number;
}

interface VoiceRow {
  voice_id: string;
  name: string;
  category: string | null;
  language: string | null;
  gender: string | null;
  use_case: string | null;
  labels: Record<string, string>;
  description: string | null;
  preview_url: string | null;
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
  source: 'workspace' | 'shared';
  synced_at: string;
  updated_at: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Load config ──────────────────────────────────────────────────────────
    const { data: config, error: cfgError } = await supabase
      .from('settings_elevenlabs')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (cfgError || !config) {
      return new Response(
        JSON.stringify({ error: 'ElevenLabs não configurado — adicione a API key em Configurações' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!config.active) {
      return new Response(
        JSON.stringify({ error: 'ElevenLabs está inativo — ative em Configurações antes de sincronizar' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Decrypt API key
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
        JSON.stringify({ error: 'API key da ElevenLabs não encontrada — configure em Configurações' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const headers = { 'xi-api-key': apiKey };
    const now = new Date().toISOString();

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 1: Workspace voices (GET /v1/voices)
    // ══════════════════════════════════════════════════════════════════════════

    const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers,
    });

    if (!voicesResponse.ok) {
      const errorBody = await voicesResponse.text();
      console.error('ElevenLabs voices API error:', voicesResponse.status, errorBody);
      return new Response(
        JSON.stringify({ error: `ElevenLabs API error: ${voicesResponse.status}`, details: errorBody }),
        { status: voicesResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { voices: workspaceVoices } = await voicesResponse.json() as { voices: WorkspaceVoice[] };
    console.log(`📢 Workspace: fetched ${workspaceVoices.length} voices`);

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 2: Shared library voices (GET /v1/shared-voices)
    // ══════════════════════════════════════════════════════════════════════════

    const sharedVoices: SharedVoice[] = [];

    for (const lang of SHARED_LANGUAGES) {
      let cursor: string | undefined;

      for (let page = 0; page < SHARED_MAX_PAGES; page++) {
        const params = new URLSearchParams({
          page_size: String(SHARED_PAGE_SIZE),
          language: lang,
          sort: 'trending',
        });
        if (cursor) params.set('last_sort_id', cursor);

        const url = `https://api.elevenlabs.io/v1/shared-voices?${params}`;
        const res = await fetch(url, { headers });

        if (!res.ok) {
          console.error(`Shared voices error (${lang}, page ${page}):`, res.status);
          break;
        }

        const body = await res.json() as {
          voices: SharedVoice[];
          has_more: boolean;
          last_sort_id?: string;
        };

        sharedVoices.push(...body.voices);
        console.log(`📢 Shared (${lang}): page ${page + 1}, got ${body.voices.length} voices`);

        if (!body.has_more || !body.last_sort_id) break;
        cursor = body.last_sort_id;
      }
    }

    console.log(`📢 Shared library: fetched ${sharedVoices.length} voices total`);

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 3: Upsert all voices
    // ══════════════════════════════════════════════════════════════════════════

    const allVoiceIds = new Set<string>();
    const workspaceVoiceIds = new Set<string>();
    let added = 0;

    // -- Workspace voices --
    for (const v of workspaceVoices) {
      allVoiceIds.add(v.voice_id);
      workspaceVoiceIds.add(v.voice_id);

      const labels = v.labels ?? {};
      const language = labels.language ?? labels.accent ?? null;

      const row: VoiceRow = {
        voice_id: v.voice_id,
        name: v.name,
        category: v.category ?? null,
        language,
        gender: labels.gender ?? null,
        use_case: labels.use_case ?? null,
        labels,
        description: v.description ?? null,
        preview_url: v.preview_url ?? null,
        stability: v.settings?.stability ?? 0.5,
        similarity_boost: v.settings?.similarity_boost ?? 0.75,
        style: v.settings?.style ?? 0,
        speed: v.settings?.speed ?? 1,
        source: 'workspace',
        synced_at: now,
        updated_at: now,
      };

      const { error } = await supabase
        .from('elevenlabs_voices')
        .upsert(row, { onConflict: 'voice_id' });

      if (error) {
        console.error(`Error upserting workspace voice ${v.voice_id}:`, error);
      } else {
        added++;
      }
    }

    // -- Shared library voices --
    let sharedAdded = 0;
    // Deduplicate shared voices (same voice can appear in multiple language searches)
    const seenSharedIds = new Set<string>();

    for (const v of sharedVoices) {
      if (seenSharedIds.has(v.voice_id) || workspaceVoiceIds.has(v.voice_id)) continue;
      seenSharedIds.add(v.voice_id);
      allVoiceIds.add(v.voice_id);

      const labels = v.labels ?? {};
      const language = labels.language ?? null;

      const row: VoiceRow = {
        voice_id: v.voice_id,
        name: v.name,
        category: v.category ?? null,
        language,
        gender: v.gender ?? labels.gender ?? null,
        use_case: v.use_cases?.[0] ?? null,
        labels,
        description: v.description ?? null,
        preview_url: v.preview_url ?? null,
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        speed: 1,
        source: 'shared',
        synced_at: now,
        updated_at: now,
      };

      const { error } = await supabase
        .from('elevenlabs_voices')
        .upsert(row, { onConflict: 'voice_id' });

      if (error) {
        console.error(`Error upserting shared voice ${v.voice_id}:`, error);
      } else {
        sharedAdded++;
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 4: Cleanup stale WORKSPACE voices only (shared are kept)
    // ══════════════════════════════════════════════════════════════════════════

    let removed = 0;
    const { data: dbWorkspaceVoices } = await supabase
      .from('elevenlabs_voices')
      .select('id, voice_id')
      .eq('source', 'workspace');

    if (dbWorkspaceVoices) {
      const stale = dbWorkspaceVoices.filter(
        (dbv: { voice_id: string }) => !workspaceVoiceIds.has(dbv.voice_id),
      );

      for (const s of stale) {
        const { error } = await supabase
          .from('elevenlabs_voices')
          .delete()
          .eq('id', s.id);

        if (!error) {
          removed++;
          console.log(`🗑️ Removed stale workspace voice: ${s.voice_id}`);
        }
      }
    }

    const total = added + sharedAdded;
    console.log(`✅ Sync complete: workspace=${added}, shared=${sharedAdded}, removed=${removed}, total=${total}`);

    return new Response(
      JSON.stringify({
        synced: total,
        workspace: added,
        shared: sharedAdded,
        removed,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('elevenlabs-sync error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
