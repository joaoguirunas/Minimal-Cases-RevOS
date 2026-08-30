import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Tables not yet in generated types — cast once here
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as any;

// ── Types ────────────────────────────────────────────────────────────────────

export interface ElevenLabsConfig {
  id: string;
  api_key: string | null;
  api_key_encrypted: string | null;
  workspace_id: string | null;
  default_model_id: string;
  default_voice_id: string | null;
  default_output_format: string;
  webhook_secret: string | null;
  monthly_char_limit: number;
  monthly_char_used: number;
  monthly_reset_at: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type ElevenLabsConfigInput = Partial<
  Omit<ElevenLabsConfig, 'id' | 'created_at' | 'updated_at'>
>;

// ── Models ───────────────────────────────────────────────────────────────────

export const ELEVENLABS_MODELS = [
  { value: 'eleven_flash_v2_5',       label: 'Flash v2.5',         hint: 'Ultra-low latency (~75ms), 50% cheaper — recommended' },
  { value: 'eleven_multilingual_v2',   label: 'Multilingual v2',    hint: '29 languages, most stable for long-form' },
  { value: 'eleven_v3',               label: 'Eleven v3',          hint: 'Most expressive, dramatic delivery' },
] as const;

export const ELEVENLABS_FORMATS = [
  { value: 'mp3_44100_128', label: 'MP3 44.1kHz 128kbps (padrão)' },
  { value: 'mp3_22050_32',  label: 'MP3 22kHz 32kbps (leve)' },
  { value: 'pcm_16000',     label: 'PCM 16kHz (raw)' },
  { value: 'ulaw_8000',     label: 'μ-law 8kHz (telefonia)' },
] as const;

// ── Read ─────────────────────────────────────────────────────────────────────

export function useElevenLabsConfig() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['elevenlabs-config'],
    queryFn: async () => {
      const { data, error } = await db
        .from('settings_elevenlabs')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ElevenLabsConfig | null;
    },
    staleTime: 60_000,
  });

  return {
    config: data ?? null,
    isLoading,
    error,
    isConfigured: !!(data?.api_key || data?.api_key_encrypted),
  };
}

// ── Upsert ───────────────────────────────────────────────────────────────────

export function useUpsertElevenLabsConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: ElevenLabsConfigInput) => {
      const { data: existing } = await db
        .from('settings_elevenlabs')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await db
          .from('settings_elevenlabs')
          .update({ ...input, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await db
          .from('settings_elevenlabs')
          .insert(input);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-config'] });
      toast({ title: 'ElevenLabs configurado com sucesso' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao salvar configuração', description: err.message, variant: 'destructive' });
    },
  });
}

// ── Voices ───────────────────────────────────────────────────────────────────

export interface ElevenLabsVoice {
  id: string;
  voice_id: string;
  name: string;
  category: string | null;
  language: string | null;
  gender: string | null;
  use_case: string | null;
  labels: Record<string, string> | null;
  description: string | null;
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
  preview_url: string | null;
  is_default: boolean;
  source: 'workspace' | 'shared' | null;
  synced_at: string;
}

export function useElevenLabsVoices() {
  return useQuery({
    queryKey: ['elevenlabs-voices'],
    queryFn: async () => {
      const { data, error } = await db
        .from('elevenlabs_voices')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as ElevenLabsVoice[];
    },
    staleTime: 60_000,
  });
}

export function useUpdateElevenLabsVoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ElevenLabsVoice> & { id: string }) => {
      const { error } = await db
        .from('elevenlabs_voices')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-voices'] });
    },
  });
}

// ── Agents ───────────────────────────────────────────────────────────────────

export interface ElevenLabsAgent {
  id: string;
  elevenlabs_agent_id: string;
  name: string | null;
  voice_id: string | null;
  llm_provider: string | null;
  llm_model: string | null;
  phone_number_id: string | null;
  phone_number: string | null;
  first_message: string | null;
  status: string;
  ai_agent_id: string | null;
  synced_at: string;
}

export function useElevenLabsAgents() {
  return useQuery({
    queryKey: ['elevenlabs-agents'],
    queryFn: async () => {
      const { data, error } = await db
        .from('elevenlabs_agents')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as ElevenLabsAgent[];
    },
    staleTime: 60_000,
  });
}
