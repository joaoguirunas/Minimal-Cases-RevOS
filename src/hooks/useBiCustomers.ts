// src/hooks/useBiCustomers.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SortKey = 'revenue' | 'orders' | 'avg_ticket' | 'last_order_at' | 'first_order_at' | 'name';
export interface CustomerRow {
  customer_id: number; name: string | null; email: string | null; phone: string | null; people_id: string | null;
  state: string | null; city: string | null; orders: number; revenue: number; avg_ticket: number;
  first_order_at: string; last_order_at: string; days_since: number; segment: string;
}
export interface CustomersParams { segment: string | null; search: string; sort: SortKey; desc: boolean }
export const PAGE_SIZE = 50;

async function call(p: CustomersParams, offset: number, limit: number) {
  const { data, error } = await (supabase.rpc as any)('bi_customers_list', {
    p_segment: p.segment, p_search: p.search || null, p_sort: p.sort, p_desc: p.desc, p_limit: limit, p_offset: offset,
  });
  if (error) throw error;
  return data as { total: number; rows: CustomerRow[] };
}

export const fetchCustomersPage = async (p: CustomersParams, offset: number, limit: number) => (await call(p, offset, limit)).rows;

export function useBiCustomers(p: CustomersParams & { page: number }) {
  return useQuery({
    queryKey: ['bi', 'bi_customers_list', p],
    queryFn: () => call(p, p.page * PAGE_SIZE, PAGE_SIZE),
    staleTime: 60_000, refetchOnWindowFocus: false, placeholderData: (prev) => prev,
  });
}
