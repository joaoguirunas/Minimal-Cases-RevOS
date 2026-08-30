import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WhatsappTemplate {
  id: string;
  id_template: string;
  meta_template_name?: string | null;
  nome: string;
  slug: string;
  status: string;
  system_enabled: boolean;
  provider?: 'meta' | 'evolution' | null;
  purpose?: string | null;
  created_at: string;
  updated_at: string;
  variables?: Record<string, unknown>;
  json_data: {
    id: string;
    data?: string;
    meta?: string;
    appId?: string;
    status?: string;
    category?: string;
    vertical?: string;
    namespace?: string;
    externalId?: string;
    elementName?: string;
    languageCode?: string;
    templateType?: string;
    containerMeta?: string;
    [key: string]: unknown; // campos arbitrários do Gupshup
  } | null;
}

export const useWhatsappTemplates = () => {
  return useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      
      // Map English column names to Portuguese for compatibility
      const mappedData = (data || []).map(item => ({
        ...item,
        nome: item.name
      }));
      
      return mappedData as WhatsappTemplate[];
    },
  });
};
