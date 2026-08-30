import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface LLMProvider {
  provider: 'openai' | 'anthropic' | 'groq' | 'gemini';
  api_key: string;
  label: string;
}

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMCallOptions {
  system?: string;
  messages: LLMMessage[];
  maxTokens?: number;
  jsonMode?: boolean;
  temperature?: number;
}

export interface LLMResult {
  text: string;
  model: string;
  provider: string;
}

export const MODEL_FALLBACK: Record<string, string> = {
  openai:    'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5-20251001',
  groq:      'llama-3.1-8b-instant',
  gemini:    'gemini-2.0-flash',
};

export async function getActiveProvider(
  supabase: ReturnType<typeof createClient>,
): Promise<LLMProvider> {
  const { data: providers, error } = await supabase
    .from('settings_ai_providers')
    .select('provider, api_key, label, active')
    .eq('active', true)
    .limit(1);

  if (error) {
    console.error('[llm-provider] provider query error:', JSON.stringify(error));
  }

  const provider = providers?.[0];
  if (!provider?.api_key) {
    throw new Error('Nenhum provider de IA configurado. Acesse Configurações → Provedores IA.');
  }

  return provider as LLMProvider;
}

export async function callLLM(
  provider: LLMProvider,
  options: LLMCallOptions,
): Promise<LLMResult> {
  const model = MODEL_FALLBACK[provider.provider] ?? 'gpt-4o-mini';
  const maxTokens = options.maxTokens ?? 2048;
  const temperature = options.temperature ?? 0.7;

  if (provider.provider === 'anthropic') {
    const systemParts: string[] = [];
    if (options.system) systemParts.push(options.system);
    if (options.jsonMode) systemParts.push('Responda APENAS com JSON válido, sem markdown.');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': provider.api_key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        ...(systemParts.length > 0 ? { system: systemParts.join('\n\n') } : {}),
        messages: options.messages,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${errBody}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? '';
    return { text, model, provider: provider.provider };
  }

  // OpenAI-compatible (openai, groq, gemini)
  const endpointMap: Record<string, string> = {
    openai: 'https://api.openai.com/v1/chat/completions',
    groq:   'https://api.groq.com/openai/v1/chat/completions',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  };
  const endpoint = endpointMap[provider.provider] ?? 'https://api.openai.com/v1/chat/completions';

  const systemMessages = options.system
    ? [{ role: 'system' as const, content: options.system }]
    : [];

  const useNewTokenParam = model.startsWith('gpt-5') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4');

  const body: Record<string, unknown> = {
    model,
    temperature,
    messages: [...systemMessages, ...options.messages],
    ...(useNewTokenParam
      ? { max_completion_tokens: maxTokens }
      : { max_tokens: maxTokens }),
    ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${provider.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`${provider.provider} API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  return { text, model, provider: provider.provider };
}
