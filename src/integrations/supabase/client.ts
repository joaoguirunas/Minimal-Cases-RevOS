import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Preenchidos via .env (ver .env.example) — nunca hardcodear projeto/chave aqui.
const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!envUrl || !envAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias. Configure o .env (veja .env.example).'
  );
}

export const CONTROL_PLANE_URL = envUrl;
export const CONTROL_PLANE_ANON_KEY = envAnonKey;

export const supabaseUrl = CONTROL_PLANE_URL;
export const supabaseAnonKey = CONTROL_PLANE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
