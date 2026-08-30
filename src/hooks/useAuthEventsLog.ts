import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AuthEventType =
  | "login_success"
  | "login_failure"
  | "logout"
  | "session_refresh"
  | "profile_fetch_timeout";

export interface AuthEventLog {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  event_type: string;
  user_agent_hash: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
}

export interface AuthEventsLogFilters {
  event_type?: AuthEventType;
  user_id?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

const PAGE_SIZE = 25;

export function useAuthEventsLog(filters: AuthEventsLogFilters = {}) {
  const { event_type, user_id, from, to, page = 0, pageSize = PAGE_SIZE } = filters;

  return useQuery({
    queryKey: ["auth-events-log", { event_type, user_id, from, to, page, pageSize }],
    queryFn: async () => {
      let q = supabase
        .from("auth_events_log")
        .select("*", { count: "exact" })
        .order("occurred_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (event_type) q = q.eq("event_type", event_type);
      if (user_id) q = q.eq("user_id", user_id);
      if (from) q = q.gte("occurred_at", from);
      if (to) q = q.lte("occurred_at", to);

      const { data, error, count } = await q;
      if (error) throw error;

      return {
        events: (data ?? []) as AuthEventLog[],
        total: count ?? 0,
      };
    },
    staleTime: 30_000,
  });
}
