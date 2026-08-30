/**
 * Score PRO — Re-evaluation Worker
 *
 * Triggered when score_matrix changes (update/delete) to resync clients_people.
 *
 * POST body (one of):
 *   { matrix_id: string }       — re-evaluate all persons linked to this matrix entry
 *   { deleted_matrix_ids: string[] } — clear score for persons whose matrix was deleted
 *   {}                          — full re-evaluation (all persons with score_matrix_id)
 *
 * Auth: service_role Bearer (called from DB trigger via pg_net, or manually by gestor)
 *
 * Strategy:
 *   1. For each person linked to a matrix entry:
 *      - If matrix entry still exists → update score to current score_number
 *      - If matrix entry was deleted → clear score_matrix_id + score
 *   2. Full mode: iterate all score_matrix rows, update linked persons in batch
 *
 * This is a pragmatic MVP — it syncs score_number changes and cleans up deleted
 * matrix entries. It does NOT re-run the full matching algorithm because
 * clients_people does not store the original category item selections.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey        = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  // Auth — accept service_role (pg_net/cron) or user JWT (gestor)
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ success: false, error: 'Unauthorized' }, 401);
  }

  const bearer = authHeader.slice(7);
  if (bearer !== serviceRoleKey) {
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return json({ success: false, error: 'Invalid token' }, 401);
    }

    // Require gestor for manual trigger
    const supabaseCheck = createClient(supabaseUrl, serviceRoleKey);
    const { data: userRecord } = await supabaseCheck
      .from('settings_users')
      .select('super_admin, user_type')
      .eq('auth_user_id', user.id)
      .eq('active', true)
      .single();
    const isAdmin = userRecord?.super_admin === true || userRecord?.user_type === 'admin';
    const isManager = userRecord?.user_type === 'manager';
    if (!userRecord || (!isAdmin && !isManager)) {
      return json({ success: false, error: 'Permissão insuficiente. Requer admin ou manager.' }, 403);
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let body: { matrix_id?: string; deleted_matrix_ids?: string[] } = {};
  try {
    body = await req.json();
  } catch { /* no body = full re-evaluation */ }

  const { matrix_id, deleted_matrix_ids } = body;

  let updatedCount = 0;
  let clearedCount = 0;

  try {
    // ── Mode 1: Clear persons linked to deleted matrices ──────────────────────
    if (deleted_matrix_ids && deleted_matrix_ids.length > 0) {
      const { data: cleared, error: clearErr } = await supabase
        .from('clients_people')
        .update({ score_matrix_id: null, score: null })
        .in('score_matrix_id', deleted_matrix_ids)
        .select('id');

      if (clearErr) {
        return json({ success: false, error: `Clear error: ${clearErr.message}` });
      }
      clearedCount = cleared?.length ?? 0;
      console.log(`[score-re-evaluate] Cleared score for ${clearedCount} persons (deleted matrices)`);
    }

    // ── Mode 2: Re-evaluate persons linked to a specific matrix entry ─────────
    if (matrix_id) {
      // Get current score_number from the matrix entry
      const { data: matrixRow, error: matrixErr } = await supabase
        .from('score_matrix')
        .select('id, score_number')
        .eq('id', matrix_id)
        .single();

      if (matrixErr || !matrixRow) {
        // Matrix was deleted — clear persons linked to it
        const { data: cleared, error: clearErr } = await supabase
          .from('clients_people')
          .update({ score_matrix_id: null, score: null })
          .eq('score_matrix_id', matrix_id)
          .select('id');

        if (clearErr) {
          return json({ success: false, error: `Clear error: ${clearErr.message}` });
        }
        clearedCount += cleared?.length ?? 0;
      } else {
        // Matrix exists — sync score_number to all linked persons
        const { data: updated, error: updateErr } = await supabase
          .from('clients_people')
          .update({ score: matrixRow.score_number })
          .eq('score_matrix_id', matrix_id)
          .select('id');

        if (updateErr) {
          return json({ success: false, error: `Update error: ${updateErr.message}` });
        }
        updatedCount = updated?.length ?? 0;
        console.log(`[score-re-evaluate] Updated score to ${matrixRow.score_number} for ${updatedCount} persons`);
      }
    }

    // ── Mode 3: Full re-evaluation (no specific matrix_id or deleted_ids) ─────
    if (!matrix_id && (!deleted_matrix_ids || deleted_matrix_ids.length === 0)) {
      console.log('[score-re-evaluate] Starting full re-evaluation...');

      // Get all score matrix entries with their current score_number
      const { data: allMatrices, error: matrixListErr } = await supabase
        .from('score_matrix')
        .select('id, score_number');

      if (matrixListErr) {
        return json({ success: false, error: `Matrix fetch error: ${matrixListErr.message}` });
      }

      const validMatrixIds = new Set((allMatrices ?? []).map((m) => m.id));

      // Process each matrix: update linked persons' score_number
      for (const matrix of allMatrices ?? []) {
        const { data: updated, error: updateErr } = await supabase
          .from('clients_people')
          .update({ score: matrix.score_number })
          .eq('score_matrix_id', matrix.id)
          .select('id');

        if (updateErr) {
          console.error(`[score-re-evaluate] Error updating matrix ${matrix.id}:`, updateErr.message);
          continue;
        }
        updatedCount += updated?.length ?? 0;
      }

      // Clear persons linked to non-existent matrices (orphaned references)
      // Fetch persons with score_matrix_id set
      const { data: personsWithScore } = await supabase
        .from('clients_people')
        .select('id, score_matrix_id')
        .not('score_matrix_id', 'is', null);

      const orphanIds = (personsWithScore ?? [])
        .filter((p) => p.score_matrix_id && !validMatrixIds.has(p.score_matrix_id))
        .map((p) => p.id);

      if (orphanIds.length > 0) {
        const { data: cleared, error: clearErr } = await supabase
          .from('clients_people')
          .update({ score_matrix_id: null, score: null })
          .in('id', orphanIds)
          .select('id');

        if (!clearErr) {
          clearedCount = cleared?.length ?? 0;
          console.log(`[score-re-evaluate] Cleared ${clearedCount} orphaned score references`);
        }
      }

      console.log(`[score-re-evaluate] Full re-evaluation complete: ${updatedCount} updated, ${clearedCount} cleared`);
    }

    return json({
      success: true,
      updated: updatedCount,
      cleared: clearedCount,
      mode: matrix_id ? 'single' : deleted_matrix_ids?.length ? 'deleted' : 'full',
    });

  } catch (err) {
    console.error('[score-re-evaluate] Unexpected error:', err);
    return json({ success: false, error: `Erro inesperado: ${(err as Error).message}` }, 500);
  }
});
