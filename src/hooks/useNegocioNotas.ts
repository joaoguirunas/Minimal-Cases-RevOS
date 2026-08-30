import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Nota {
  id: string;
  lead_id: string;
  title: string;
  content?: string | null;
  created_at: string;
  updated_at: string;
  user_id?: string | null;
  // UI aliases
  titulo?: string;
  conteudo?: string | null;
}

// Listar notas do negócio
export const useNegocioNotas = (negocioId: string) => {
  return useQuery({
    queryKey: ["negocio-notas", negocioId],
    enabled: !!negocioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads_notes")
        .select("id, lead_id, title, content, created_at, updated_at, user_id")
        .eq("lead_id", negocioId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Mapear para os aliases usados no componente (titulo/conteudo)
      const mapped = (data || []).map((n) => ({
        ...n,
        titulo: n.title,
        conteudo: n.content,
      })) as Nota[];

      return mapped;
    },
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  });
};

// Criar nota
export const useCriarNota = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      negocioId: string;
      titulo: string;
      conteudo?: string;
    }) => {
      const payload = {
        lead_id: data.negocioId,
        title: data.titulo,
        content: data.conteudo ?? null,
      };

      const { data: inserted, error } = await supabase
        .from("leads_notes")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return inserted as Nota;
    },
    onSuccess: (result) => {
      toast.success("Nota criada!");
      queryClient.invalidateQueries({ queryKey: ["negocio-notas", result.lead_id] });
    },
    onError: (err) => {
      console.error("Erro ao criar nota:", err);
      toast.error("Erro ao criar nota");
    },
  });
};

// Atualizar nota
export const useAtualizarNota = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      titulo: string;
      conteudo?: string;
    }) => {
      const updates = {
        title: data.titulo,
        content: data.conteudo ?? null,
      };

      const { data: updated, error } = await supabase
        .from("leads_notes")
        .update(updates)
        .eq("id", data.id)
        .select()
        .single();

      if (error) throw error;
      return updated as Nota;
    },
    onSuccess: (result) => {
      toast.success("Nota atualizada!");
      queryClient.invalidateQueries({ queryKey: ["negocio-notas", result.lead_id] });
    },
    onError: (err) => {
      console.error("Erro ao atualizar nota:", err);
      toast.error("Erro ao atualizar nota");
    },
  });
};

// Deletar nota
export const useDeletarNota = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Descobrir lead_id para invalidar depois
      const { data: existing, error: fetchErr } = await supabase
        .from("leads_notes")
        .select("id, lead_id")
        .eq("id", id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const { error } = await supabase
        .from("leads_notes")
        .delete()
        .eq("id", id);

      if (error) throw error;

      return existing?.lead_id as string | undefined;
    },
    onSuccess: (lead_id) => {
      toast.success("Nota removida!");
      if (lead_id) {
        queryClient.invalidateQueries({ queryKey: ["negocio-notas", lead_id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["negocio-notas"] });
      }
    },
    onError: (err) => {
      console.error("Erro ao deletar nota:", err);
      toast.error("Erro ao deletar nota");
    },
  });
};
