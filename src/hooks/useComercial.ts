import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useUserPermissions } from '@/hooks/useUserPermissions';

const db = supabase as unknown as SupabaseClient;

export function useCommercialScope() {
  const { isComercial, currentUserId } = useUserPermissions();
  return { isComercial, currentUserId: currentUserId ?? null };
}

export function useClaimLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string): Promise<{ ok: boolean; reason?: string }> => {
      const { data, error } = await db.rpc('claim_lead', { p_lead_id: leadId });
      if (error) throw error;
      return (data ?? { ok: false, reason: 'fora_do_pool' }) as { ok: boolean; reason?: string };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['negocios-pipeline'] });
      qc.invalidateQueries({ queryKey: ['negocio'] });
    },
  });
}

/** Foto da capa por SKU (cache yampi_sku_images). Uma query por board. */
export function useSkuImages(skuIds: number[]) {
  const ids = [...new Set(skuIds.filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
  return useQuery({
    queryKey: ['sku-images', ids.join(',')],
    enabled: ids.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Record<number, string>> => {
      const { data, error } = await db.from('yampi_sku_images').select('sku_id, url').in('sku_id', ids);
      if (error) throw error;
      return Object.fromEntries(((data ?? []) as Array<{ sku_id: number; url: string }>).map((r) => [r.sku_id, r.url]));
    },
  });
}

export function useLeadCoupon(leadId?: string) {
  return useQuery({
    queryKey: ['lead-coupon', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await db.from('crm_coupons').select('code, percent, expires_at, created_by')
        .eq('lead_id', leadId!).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return (data ?? null) as { code: string; percent: number | null; expires_at: string | null; created_by: string | null } | null;
    },
  });
}

export interface CouponCreateResponse {
  ok: true; code: string; percent: number; expires_at: string | null; reused: boolean;
  price: number | null; price_with_coupon: number | null; price_label: string; price_with_coupon_label: string;
  cart_url: string | null; tracked_url: string | null; message_preview: string;
}

export function useCreateCommercialCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { lead_id: string; percent: number; validity_days?: number }): Promise<CouponCreateResponse> => {
      const { data, error } = await supabase.functions.invoke('commercial-coupon-create', { body: input });
      if (error) throw new Error(error.message);
      const r = data as CouponCreateResponse | { ok: false; error: string };
      if (!r.ok) throw new Error((r as { error: string }).error);
      return r;
    },
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['lead-coupon', v.lead_id] });
      qc.invalidateQueries({ queryKey: ['negocios-pipeline'] });
      qc.invalidateQueries({ queryKey: ['negocio'] });
    },
  });
}
