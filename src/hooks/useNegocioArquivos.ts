import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Arquivo {
  id: string;
  lead_id: string;
  user_id?: string | null;
  file_name: string;
  file_url: string;
  file_type?: string | null;
  file_size?: number | null;
  created_at: string;
  updated_at: string;
  // UI aliases
  nome_arquivo?: string;
  url_arquivo?: string;
  tipo_arquivo?: string;
  tamanho_arquivo?: number | null;
}

// Listar arquivos do negócio
export const useNegocioArquivos = (negocioId: string) => {
  return useQuery({
    queryKey: ["negocio-arquivos", negocioId],
    enabled: !!negocioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads_files")
        .select("*")
        .eq("lead_id", negocioId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Mapear para aliases usados no componente
      const mapped = (data || []).map((a) => ({
        ...a,
        nome_arquivo: a.file_name,
        url_arquivo: a.file_url,
        tipo_arquivo: a.file_type,
        tamanho_arquivo: a.file_size,
      })) as Arquivo[];

      return mapped;
    },
  });
};

// Upload de arquivo
export const useUploadArquivo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      file: File;
      negocioId: string;
    }) => {
      const { file, negocioId } = data;

      // 1. Upload do arquivo para o storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${negocioId}/${Date.now()}.${fileExt}`;
      const filePath = `leads/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("logos") // usando o bucket existente
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 2. Obter URL pública
      const { data: publicUrlData } = supabase.storage
        .from("logos")
        .getPublicUrl(filePath);

      const fileUrl = publicUrlData.publicUrl;

      // 3. Salvar metadados na tabela leads_files
      const payload = {
        lead_id: negocioId,
        file_name: file.name,
        file_url: fileUrl,
        file_type: file.type || null,
        file_size: file.size || null,
      };

      const { data: inserted, error: dbError } = await supabase
        .from("leads_files")
        .insert([payload])
        .select()
        .single();

      if (dbError) {
        // Se falhar ao salvar no DB, tentar remover do storage
        await supabase.storage.from("logos").remove([filePath]);
        throw dbError;
      }

      return inserted as Arquivo;
    },
    onSuccess: (result) => {
      toast.success("Arquivo enviado com sucesso!");
      queryClient.invalidateQueries({
        queryKey: ["negocio-arquivos", result.lead_id],
      });
    },
    onError: (err) => {
      console.error("Erro ao fazer upload do arquivo:", err);
      toast.error("Erro ao enviar arquivo");
    },
  });
};

// Deletar arquivo
export const useDeletarArquivo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (arquivo: Arquivo) => {
      // 1. Extrair caminho do arquivo da URL
      const url = new URL(arquivo.file_url || arquivo.url_arquivo || "");
      const pathMatch = url.pathname.match(/\/logos\/(.+)$/);
      const filePath = pathMatch ? pathMatch[1] : null;

      // 2. Deletar do banco de dados
      const { error: dbError } = await supabase
        .from("leads_files")
        .delete()
        .eq("id", arquivo.id);

      if (dbError) throw dbError;

      // 3. Deletar do storage (se conseguirmos extrair o caminho)
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from("logos")
          .remove([filePath]);

        if (storageError) {
          console.warn("Erro ao deletar arquivo do storage:", storageError);
          // Não falha a operação toda se o storage falhar
        }
      }

      return arquivo.lead_id;
    },
    onSuccess: (lead_id) => {
      toast.success("Arquivo removido!");
      queryClient.invalidateQueries({
        queryKey: ["negocio-arquivos", lead_id],
      });
    },
    onError: (err) => {
      console.error("Erro ao deletar arquivo:", err);
      toast.error("Erro ao remover arquivo");
    },
  });
};
