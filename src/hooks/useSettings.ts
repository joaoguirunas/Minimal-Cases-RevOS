import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Settings {
  id: string;
  company_name: string;
  logo_url: string | null;
  whatsapp_provider: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  timezone: string;
  language: string;
  currency: string;
  tax_id: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  google_client_id: string | null;
  google_client_secret: string | null;
  explorium_api_key: string | null;
  apollo_api_key: string | null;
  pdl_api_key: string | null;
  login_max_attempts: number | null;
  require_mfa_for_gestores: boolean | null;
  custom_domain: string | null;
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  product_name: string | null;
  bi_voice_chat_beta_enabled: boolean | null;
  created_at: string;
  updated_at: string;
}

export const useSettings = () => {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as Settings | null;
    },
  });
};

type UpdateSettingsData = Partial<Omit<Settings, 'id' | 'created_at' | 'updated_at'>> & { company_name?: string };

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: UpdateSettingsData) => {
      const { data: existing } = await supabase
        .from("settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("settings")
          .update(values)
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        if (!values.company_name) {
          throw new Error("company_name é obrigatório");
        }
        
        const { data, error } = await supabase
          .from("settings")
          .insert([values])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["google-oauth-config"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error: Error) => {
      console.error("Erro ao salvar configurações:", error);
      toast.error("Erro ao salvar configurações");
    },
  });
};

export const useUploadLogo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("logos")
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    },
    onSuccess: (url) => {
      queryClient.setQueryData<Settings | null>(
        ["settings"],
        (old) => {
          if (!old) return old;
          return { ...old, logo_url: url };
        }
      );
      toast.success("Logo enviado com sucesso!");
    },
    onError: (error: Error & { error_description?: string }) => {
      console.error("Erro ao fazer upload da logo:", error);
      const msg = error?.message || error?.error_description || JSON.stringify(error);
      toast.error(`Upload falhou: ${msg}`);
    },
  });
};

// Re-export for backward compatibility
export const useConfiguracoesGerais = useSettings;
export const useUpdateConfiguracoesGerais = useUpdateSettings;
export type ConfiguracoesGerais = Settings;
