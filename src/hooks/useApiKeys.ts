import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  created_by: string | null;
}

export function useApiKeys() {
  return useQuery<ApiKey[]>({
    queryKey: ["tenant-api-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_api_keys")
        .select("id, name, key_prefix, last_used_at, revoked_at, created_at, created_by")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ApiKey[];
    },
    staleTime: 30 * 1000,
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      // Generate rev_live_{32 hex chars}
      const randomBytes = new Uint8Array(16);
      crypto.getRandomValues(randomBytes);
      const hex = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      const rawKey = `rev_live_${hex}`;
      const prefix = rawKey.slice(0, 12);

      // SHA-256 hash
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(rawKey));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const { data: user } = await supabase.auth.getUser();
      const createdBy = user?.user?.id ?? null;

      const { error } = await supabase.from("tenant_api_keys").insert({
        name,
        key_hash: keyHash,
        key_prefix: prefix,
        created_by: createdBy,
      });

      if (error) throw error;
      return rawKey;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-api-keys"] });
    },
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tenant_api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-api-keys"] });
    },
  });
}
