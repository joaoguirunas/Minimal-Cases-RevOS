import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Resolves the active API key for a given AI provider via RPC.
 * Calls get_active_ai_provider_key (SECURITY DEFINER, service_role only).
 * Returns null when provider is not configured for this tenant.
 */
export async function getProviderKey(
  provider: 'openai' | 'anthropic' | 'groq' | 'gemini',
  supabase: ReturnType<typeof createClient>,
): Promise<string | null> {
  const { data, error } = await supabase
    .rpc('get_active_ai_provider_key', { p_provider: provider });

  if (error) {
    console.error(`[ai_providers] getProviderKey(${provider}) error:`, JSON.stringify(error));
    return null;
  }

  return (data as string | null) ?? null;
}
