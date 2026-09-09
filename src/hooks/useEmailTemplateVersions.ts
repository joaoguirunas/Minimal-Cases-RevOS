/**
 * useEmailTemplateVersions — histórico de versões dos templates de e-mail
 * (EMAIL-VERSIONS). Snapshot gravado automaticamente pelo trigger
 * email_templates_snapshot_version antes de cada UPDATE de conteúdo.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const db = supabase as unknown as SupabaseClient;

export interface EmailTemplateVersion {
  id: number;
  name: string | null;
  subject: string;
  html_body: string;
  variables: string[];
  saved_by: string | null;
  created_at: string;
}

export function useEmailTemplateVersions(templateId?: string) {
  return useQuery({
    queryKey: ['email-template-versions', templateId],
    queryFn: async (): Promise<EmailTemplateVersion[]> => {
      if (!templateId) return [];
      const { data, error } = await db
        .from('email_template_versions')
        .select('id, name, subject, html_body, variables, saved_by, created_at')
        .eq('template_id', templateId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as EmailTemplateVersion[];
    },
    enabled: !!templateId,
    staleTime: 30 * 1000,
  });
}

export function useDeleteEmailTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await db.from('email_template_versions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['email-template-versions'] }); toast.success('Versão excluída'); },
    onError: () => toast.error('Erro ao excluir versão'),
  });
}
