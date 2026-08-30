import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Extracted from KiwifyIntegrationConfig.tsx so the product catalog (API +
// manual fallback) can be reused wherever a Kiwify product needs to be picked
// (integration config, pipeline↔product link).

export interface KiwifyConnectionStatus {
  status: 'connected' | 'disconnected' | 'error' | 'pending_webhook';
  connected: boolean;
  account_id?: string;
  client_id?: string;
  connection_id?: string;
  inbound_url?: string;
  webhook_registered: boolean;
  last_error?: string | null;
}

export interface KiwifyProduct {
  id: string;
  name: string;
}

// ── Edge-function invoke helper (edge always returns HTTP 200 { ok }) ──────────

export async function invokeKiwify<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('kiwify-connect', { body });
  if (error) throw new Error(error.message);
  const res = data as { ok?: boolean; error?: string } & T;
  if (!res?.ok) throw new Error(res?.error ?? 'Erro ao contactar a Kiwify');
  return res;
}

export function useKiwifyStatus() {
  return useQuery({
    queryKey: ['kiwify', 'status'],
    queryFn: () => invokeKiwify<KiwifyConnectionStatus>({ action: 'status' }),
    staleTime: 30_000,
  });
}

export function useKiwifyProducts(connected: boolean) {
  return useQuery({
    queryKey: ['kiwify', 'products'],
    queryFn: async () => {
      const res = await invokeKiwify<{ products: KiwifyProduct[] }>({ action: 'list_products' });
      return res.products ?? [];
    },
    enabled: connected,
    staleTime: 5 * 60 * 1000,
  });
}

// Manual product fallback (AC5): when list_products returns nothing (credential
// without the `products` scope), managers can register product_id+name by hand.
// Persisted in localStorage — no new table (KFY-2.3 scope forbids it).
const MANUAL_PRODUCTS_KEY = 'kiwify_manual_products';

export function useManualProducts() {
  const [manualProducts, setManualProducts] = useState<KiwifyProduct[]>(() => {
    try {
      const raw = localStorage.getItem(MANUAL_PRODUCTS_KEY);
      return raw ? (JSON.parse(raw) as KiwifyProduct[]) : [];
    } catch {
      return [];
    }
  });

  const addManualProduct = useCallback((p: KiwifyProduct) => {
    setManualProducts((prev) => {
      if (prev.some((x) => x.id === p.id)) return prev;
      const next = [...prev, p];
      try { localStorage.setItem(MANUAL_PRODUCTS_KEY, JSON.stringify(next)); } catch { /* ignore quota */ }
      return next;
    });
  }, []);

  return { manualProducts, addManualProduct };
}

export function mergeProducts(api: KiwifyProduct[], manual: KiwifyProduct[]): KiwifyProduct[] {
  const map = new Map<string, KiwifyProduct>();
  for (const p of api) map.set(p.id, p);
  for (const p of manual) if (!map.has(p.id)) map.set(p.id, p);
  return [...map.values()];
}
