import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { SendChannel, ImportResult } from '@/types/sends';

export interface FieldMappingConfig {
  name?: string;
  whatsapp?: string;
  email?: string;
  lead_control?: string;  // CSV column header whose value is written to leads.control per row
  crm_extra?: Record<string, string>;
  lead_extra?: Record<string, string>;
  empresa_extra?: Record<string, string>;
  score_cat?: Record<string, string>;          // categoryId -> csvHeader
  value_maps?: Record<string, Record<string, string>>; // fieldKey -> { csvValue -> crmOptionValue }
  q_field?: Record<string, string>;           // q-field key -> csvHeader
  company_struct?: Record<string, string>;    // company field key -> csvHeader
  lead_cols?: Record<string, string>;         // native leads column key -> csvHeader
}

export interface UseImportarListaInput {
  rows: Record<string, string>[];
  field_mapping: FieldMappingConfig;
  channel: SendChannel;
  create_leads: boolean;
  pipeline_id?: string | null;
  stage_id?: string | null;
  send_id?: string | null;
  lead_control?: string | null;
  score_matrix_id?: string | null;
  assign_user_id?: string | null;
  assign_team_id?: string | null;
  origem_lista?: string | null;
}

export interface ImportarListaResult extends ImportResult {
  session_id: string;
  failed_rows: number;
}

// Staged data returned by ImportListaTab before the send is created.
// The actual API call only happens after the send is saved.
export interface StagedImportData extends UseImportarListaInput {
  total: number;
}

export function useImportarLista() {
  return useMutation({
    mutationFn: async (input: UseImportarListaInput): Promise<ImportarListaResult> => {
      const { data, error } = await supabase.functions.invoke('sends-import-contacts', {
        body: input,
      });
      if (error) throw error;
      return data as ImportarListaResult;
    },
    onError: (error: Error) => {
      toast.error(`Erro na importação: ${error.message}`);
    },
  });
}
