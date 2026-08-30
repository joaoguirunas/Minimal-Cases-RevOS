import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SettingsAuditEntry {
  id: string;
  user_id: string | null;
  section: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  is_sensitive: boolean;
  changed_at: string;
  user_name?: string | null;
}

export interface SettingsAuditFilters {
  section?: string;
  user_id?: string;
  page?: number;
}

const PAGE_SIZE = 20;

export function useSettingsAuditLog(filters: SettingsAuditFilters = {}) {
  const { section, user_id, page = 0 } = filters;

  return useQuery<SettingsAuditEntry[]>({
    queryKey: ["settings-audit-log", section, user_id, page],
    queryFn: async () => {
      let query = supabase
        .from("settings_audit_log")
        .select(`
          id,
          user_id,
          section,
          field,
          old_value,
          new_value,
          is_sensitive,
          changed_at,
          settings_users!settings_audit_log_user_id_fkey(name)
        `)
        .order("changed_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (section) query = query.eq("section", section);
      if (user_id) query = query.eq("user_id", user_id);

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        section: row.section,
        field: row.field,
        old_value: row.old_value,
        new_value: row.new_value,
        is_sensitive: row.is_sensitive,
        changed_at: row.changed_at,
        user_name: row.settings_users?.name ?? null,
      }));
    },
    staleTime: 30 * 1000,
  });
}
