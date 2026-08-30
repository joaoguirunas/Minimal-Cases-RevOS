import { useState } from "react";
import { CheckCircle2, Loader2, Link2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MetaPage {
  page_id: string;
  page_name: string;
  connected: boolean;
  subscribed: boolean;
}

interface MetaPageSelectorProps {
  userAccessToken: string;
  onConnected?: (page: MetaPage) => void;
}

export function MetaPageSelector({ userAccessToken, onConnected }: MetaPageSelectorProps) {
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  async function fetchPages() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-pages-list", {
        body: { user_access_token: userAccessToken },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      setPages(data.pages);
      setFetched(true);
    } catch (err) {
      toast.error(`Erro ao buscar Pages: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function subscribePage(pageId: string) {
    setSubscribing(pageId);
    try {
      const { data, error } = await supabase.functions.invoke("meta-pages-subscribe", {
        body: { page_id: pageId },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setPages((prev) =>
        prev.map((p) =>
          p.page_id === pageId ? { ...p, connected: true, subscribed: true } : p
        )
      );
      toast.success(`Page "${data.page_name}" conectada com sucesso!`);
      const connected = pages.find((p) => p.page_id === pageId);
      if (connected) onConnected?.({ ...connected, connected: true, subscribed: true });
    } catch (err) {
      toast.error(`Erro ao conectar Page: ${(err as Error).message}`);
    } finally {
      setSubscribing(null);
    }
  }

  if (!fetched) {
    return (
      <div className="border border-border rounded-[2px] p-6 bg-card">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-[#1877F2]/10 flex items-center justify-center">
            <Link2 className="w-5 h-5 text-[#1877F2]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Conectar Facebook Page</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Selecione a Page do Facebook para receber leads dos formulários Meta Lead Ads.
            </p>
          </div>
          <Button
            size="sm"
            onClick={fetchPages}
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {loading ? "Buscando..." : "Buscar minhas Pages"}
          </Button>
        </div>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="border border-border rounded-[2px] p-6 bg-card text-center">
        <p className="text-sm text-muted-foreground">
          Nenhuma Facebook Page encontrada. Verifique se você é administrador de pelo menos uma Page.
        </p>
        <Button size="sm" variant="outline" onClick={fetchPages} className="mt-3 gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-[2px] bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted">
        <p className="text-xs font-medium text-foreground">Suas Facebook Pages</p>
        <Button size="sm" variant="ghost" onClick={fetchPages} disabled={loading} className="h-[30px] px-2 text-xs gap-1 rounded-[4px]">
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>
      <div className="divide-y divide-border">
        {pages.map((page) => (
          <div key={page.page_id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                page.subscribed
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-[#1877F2]/10 text-[#1877F2]"
              )}>
                {page.subscribed ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  page.page_name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{page.page_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {page.subscribed ? "Webhook ativo — recebendo leads" : `ID: ${page.page_id}`}
                </p>
              </div>
            </div>
            {page.subscribed ? (
              <span className="text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-[2px]">
                Conectada
              </span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => subscribePage(page.page_id)}
                disabled={subscribing === page.page_id}
                className="h-[30px] px-3 text-xs gap-1 rounded-[4px]"
              >
                {subscribing === page.page_id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Link2 className="w-3 h-3" />
                )}
                Conectar
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
