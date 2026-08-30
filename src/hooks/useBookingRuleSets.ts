import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type RuleType = 'team_priority' | 'random' | 'least_busy' | 'specific_user' | 'round_robin';

export interface BookingRule {
  id: string;
  rule_set_id: string;
  order_index: number;
  rule_type: RuleType;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface BookingRuleSet {
  id: string;
  url_id: number | null;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  booking_rules?: BookingRule[];
}

const QUERY_KEY = 'booking_rule_sets';

export const useBookingRuleSets = () =>
  useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('booking_rule_sets')
        .select('*, booking_rules(*)')
        .eq('is_active', true)
        .order('created_at');
      if (error) throw error;
      return (data || []).map((rs: any) => ({
        ...rs,
        booking_rules: (rs.booking_rules || []).sort(
          (a: BookingRule, b: BookingRule) => a.order_index - b.order_index
        ),
      })) as BookingRuleSet[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

export const useCreateBookingRuleSet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string; is_default?: boolean }) => {
      const { data, error } = await (supabase as any)
        .from('booking_rule_sets')
        .insert([{ ...payload, is_active: true }])
        .select()
        .single();
      if (error) throw error;
      return data as BookingRuleSet;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Conjunto criado!');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
};

export const useUpdateBookingRuleSet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BookingRuleSet> & { id: string }) => {
      const { error } = await (supabase as any)
        .from('booking_rule_sets')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Salvo!');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
};

export const useDeleteBookingRuleSet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('booking_rule_sets')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Removido!');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
};

// Replace ALL rules for a rule set atomically
export const useUpsertBookingRules = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ruleSetId,
      rules,
    }: {
      ruleSetId: string;
      rules: Array<{ order_index: number; rule_type: RuleType; config: Record<string, unknown>; is_active: boolean }>;
    }) => {
      const { error: delErr } = await (supabase as any)
        .from('booking_rules')
        .delete()
        .eq('rule_set_id', ruleSetId);
      if (delErr) throw delErr;
      if (rules.length === 0) return;
      const { error } = await (supabase as any)
        .from('booking_rules')
        .insert(rules.map(r => ({ ...r, rule_set_id: ruleSetId })));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Regras salvas!');
    },
    onError: (e: any) => toast.error('Erro ao salvar regras: ' + e.message),
  });
};
