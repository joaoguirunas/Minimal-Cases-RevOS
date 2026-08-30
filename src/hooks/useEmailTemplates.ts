import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  variables: string[];
  category: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplateInput {
  name: string;
  subject: string;
  html_body: string;
  variables?: string[];
  category?: string | null;
  active?: boolean;
}

const QK = ['email-templates'];

export const useEmailTemplates = () => {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<EmailTemplate[]> => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useCreateEmailTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EmailTemplateInput): Promise<EmailTemplate> => {
      const { data, error } = await supabase
        .from('email_templates')
        .insert({
          name: input.name,
          subject: input.subject,
          html_body: input.html_body,
          variables: input.variables ?? [],
          category: input.category ?? null,
          active: input.active ?? true,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};

export const useUpdateEmailTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EmailTemplateInput & { id: string }): Promise<EmailTemplate> => {
      const { data, error } = await supabase
        .from('email_templates')
        .update({
          name: input.name,
          subject: input.subject,
          html_body: input.html_body,
          variables: input.variables ?? [],
          category: input.category ?? null,
          active: input.active ?? true,
        })
        .eq('id', input.id)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};

export const useDeleteEmailTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('email_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};
