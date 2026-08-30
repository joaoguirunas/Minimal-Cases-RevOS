import { supabase } from '@/integrations/supabase/client';

/** Merge chains are shallow in practice; the cap only exists to bound a corrupted cycle. */
const MAX_MERGE_CHAIN = 5;

/**
 * Walks `clients_people.merged_into_id` to the surviving person.
 * Returns every id in the chain — callers that only need the destination take the last one,
 * callers that watch realtime need the whole set (writes may land on any id mid-merge).
 */
export async function resolvePersonMergeChain(pessoaId: string): Promise<string[]> {
  const chain: string[] = [pessoaId];
  const visited = new Set<string>([pessoaId]);
  let currentId = pessoaId;

  for (let depth = 0; depth < MAX_MERGE_CHAIN; depth++) {
    const { data, error } = await supabase
      .from('clients_people')
      .select('status, merged_into_id')
      .eq('id', currentId)
      .maybeSingle();

    // Degrade to the ids resolved so far — an incomplete history beats a blank screen.
    if (error) {
      console.error('❌ personMerge: lookup da cadeia falhou', error);
      break;
    }
    if (!data || data.status !== 'merged' || !data.merged_into_id) break;

    const next = data.merged_into_id;
    if (visited.has(next)) {
      console.error('❌ personMerge: ciclo detectado', { pessoaId, next });
      break;
    }
    visited.add(next);
    chain.push(next);
    currentId = next;
  }

  return chain;
}

/** The surviving person id — what writes (mark-as-read, counters) must target. */
export async function resolveCanonicalPersonId(pessoaId: string): Promise<string> {
  const chain = await resolvePersonMergeChain(pessoaId);
  return chain[chain.length - 1];
}
