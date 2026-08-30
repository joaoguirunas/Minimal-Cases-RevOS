import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TriggerType = "stage_enter" | "lead_won" | "lead_lost" | "lead_created" | "booking_status";

export interface ConversionEventRule {
  id: string;
  user_id: string;
  name: string;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  meta_enabled: boolean;
  meta_pixel_id: string | null;
  meta_event_name: string | null;
  meta_send_value: boolean;
  google_enabled: boolean;
  google_account_id: string | null;
  google_conversion_action_id: string | null;
  google_conversion_action_name: string | null;
  google_send_value: boolean;
  google_currency: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MetaPixelOption {
  id: string;
  name: string;
  account_id: string;
  account_name: string;
}

export interface GoogleConversionActionOption {
  id: string;
  name: string;
  type: string;
  status: string;
  account_id: string;
  account_name: string;
  resource_name: string;
}

export interface ConversionEvent {
  id: string;
  lead_id: string;
  stage_id: string;
  lead_source: string | null;
  event_data: Record<string, unknown>;
  meta_status: "pending" | "sent" | "failed" | "skipped";
  meta_response: Record<string, unknown> | null;
  meta_sent_at: string | null;
  google_status: "pending" | "sent" | "failed" | "skipped";
  google_response: Record<string, unknown> | null;
  google_sent_at: string | null;
  skip_reason: string | null;
  retry_count: number;
  created_at: string;
}

// ─── Conversion Event Rules (v2) ────────────────────────────────────────────

export const useConversionRules = () =>
  useQuery({
    queryKey: ["conversion-rules"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("conversion_event_rules")
        .select("*")
        .order("created_at", { ascending: false });
      // Table may not exist yet (migration pending) — return empty gracefully
      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return [] as ConversionEventRule[];
        }
        throw error;
      }
      return (data || []) as ConversionEventRule[];
    },
  });

export const useCreateConversionRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      rule: Omit<ConversionEventRule, "id" | "user_id" | "created_at" | "updated_at">,
    ) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await (supabase as any)
        .from("conversion_event_rules")
        .insert({ ...rule, user_id: user.user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversion-rules"] });
      toast.success("Regra criada");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
};

export const useUpdateConversionRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<ConversionEventRule> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("conversion_event_rules")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversion-rules"] });
      toast.success("Regra atualizada");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
};

export const useDeleteConversionRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("conversion_event_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversion-rules"] });
      toast.success("Regra removida");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
};

// ─── Platform Data (Pixels + Conversion Actions) ────────────────────────────

export interface MetaPixelsResult {
  pixels: MetaPixelOption[];
  errors: string[];
}

export const useMetaPixels = () =>
  useQuery({
    queryKey: ["conversion-meta-pixels"],
    queryFn: async (): Promise<MetaPixelsResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const resp = await fetch(
        `${(supabase as any).supabaseUrl}/functions/v1/conversion-fetch-platforms?platform=meta`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: (supabase as any).supabaseKey,
          },
        },
      );
      if (!resp.ok) throw new Error("Failed to fetch pixels");
      const result = await resp.json();
      return {
        pixels: (result.meta?.pixels || []) as MetaPixelOption[],
        errors: (result.meta?.errors || []) as string[],
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

export interface GoogleActionsResult {
  actions: GoogleConversionActionOption[];
  errors: string[];
}

export const useGoogleConversionActions = () =>
  useQuery({
    queryKey: ["conversion-google-actions"],
    queryFn: async (): Promise<GoogleActionsResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const resp = await fetch(
        `${(supabase as any).supabaseUrl}/functions/v1/conversion-fetch-platforms?platform=google`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: (supabase as any).supabaseKey,
          },
        },
      );
      if (!resp.ok) throw new Error("Failed to fetch conversion actions");
      const result = await resp.json();
      return {
        actions: (result.google?.actions || []) as GoogleConversionActionOption[],
        errors: (result.google?.errors || []) as string[],
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

// ─── Events Queue (Log) ─────────────────────────────────────────────────────

export const useConversionEvents = (filters?: {
  limit?: number;
  platform?: "meta" | "google";
  status?: string;
}) =>
  useQuery({
    queryKey: ["conversion-events", filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from("conversion_events_queue")
        .select(
          `
          *,
          lead:leads(id, title, people_id, clients_people:people_id(name, email)),
          stage:leads_stages(name, color)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(filters?.limit ?? 50);

      if (filters?.platform === "meta" && filters?.status) {
        query = query.eq("meta_status", filters.status);
      } else if (filters?.platform === "google" && filters?.status) {
        query = query.eq("google_status", filters.status);
      }

      const { data, error } = await query;
      // Table may not exist yet (migration pending) — return empty gracefully
      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return [];
        }
        throw error;
      }
      return data || [];
    },
  });
