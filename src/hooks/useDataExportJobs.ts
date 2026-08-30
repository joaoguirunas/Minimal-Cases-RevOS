import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DataExportJob {
  id: string;
  tenant_id: string;
  requested_by: string | null;
  status: "pending" | "processing" | "done" | "failed" | "expired";
  download_url: string | null;
  expires_at: string | null;
  error_message: string | null;
  created_at: string;
}

export function useDataExportJobs() {
  const { data: jobs = [], isLoading, refetch } = useQuery<DataExportJob[]>({
    queryKey: ["data-export-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_export_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return (data ?? []) as DataExportJob[];
    },
    // Poll every 10s while any job is processing
    refetchInterval: (query) => {
      const jobs = query.state.data ?? [];
      const hasProcessing = jobs.some(
        (j: DataExportJob) => j.status === "pending" || j.status === "processing"
      );
      return hasProcessing ? 10_000 : false;
    },
    staleTime: 10 * 1000,
  });

  return { jobs, isLoading, refetch };
}

export function useRequestDataExport() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("data-export-request", {
        method: "POST",
        body: {},
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Export failed");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["data-export-jobs"] });
    },
  });
}

export function useAnonymizePerson() {
  return useMutation({
    mutationFn: async (personId: string) => {
      const { data, error } = await supabase.rpc("anonymize_person", {
        p_person_id: personId,
      });
      if (error) throw error;
      return data as { ok: boolean; tables_affected: string[] };
    },
  });
}

export function useSearchPersonByEmail() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase
        .from("clients_people")
        .select("id, name, email, whatsapp, created_at")
        .eq("email", email)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as { id: string; name: string; email: string; whatsapp: string | null; created_at: string } | null;
    },
  });
}
