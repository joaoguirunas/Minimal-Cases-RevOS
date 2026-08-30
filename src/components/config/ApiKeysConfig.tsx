import { useState } from "react";
import { Key, Plus, Copy, Check, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApiKeys, useCreateApiKey, useRevokeApiKey, type ApiKey } from "@/hooks/useApiKeys";

// ── Section header ─────────────────────────────────────────────────────────────
const SectionHeader = ({ title }: { title: string }) => (
  <div className="px-5 py-2.5 bg-muted border-b border-border">
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{title}</p>
  </div>
);

// ── Generate modal ─────────────────────────────────────────────────────────────
function GenerateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const createKey = useCreateApiKey();

  const handleGenerate = async () => {
    if (!name.trim()) return;
    try {
      const key = await createKey.mutateAsync(name.trim());
      setGeneratedKey(key);
      toast.success("API Key gerada com sucesso");
    } catch {
      toast.error("Erro ao gerar API Key");
    }
  };

  const handleCopy = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setName("");
    setGeneratedKey(null);
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold">Gerar nova API Key</DialogTitle>
        </DialogHeader>

        {!generatedKey ? (
          <>
            <div className="space-y-3 py-2">
              <label className="text-[13px] font-medium text-foreground">Nome / descrição</label>
              <Input
                placeholder="Ex: Zapier Automação, Webhook CRM externo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                className="h-[34px] text-[13px]"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={!name.trim() || createKey.isPending}
              >
                {createKey.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Gerar key
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3 py-2">
              <p className="text-[12px] text-muted-foreground leading-snug">
                Copie sua API Key agora. Ela <span className="font-semibold text-foreground">não será exibida novamente</span>.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] font-mono bg-muted border border-border rounded-[4px] px-3 py-2 break-all">
                  {generatedKey}
                </code>
                <Button size="icon" variant="outline" className="h-8 w-8 flex-shrink-0" onClick={handleCopy}>
                  {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" onClick={handleClose}>Fechar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Revoke confirm dialog ──────────────────────────────────────────────────────
function RevokeDialog({
  apiKey,
  onClose,
}: {
  apiKey: ApiKey | null;
  onClose: () => void;
}) {
  const [confirmName, setConfirmName] = useState("");
  const revokeKey = useRevokeApiKey();

  const handleRevoke = async () => {
    if (!apiKey || confirmName !== apiKey.name) return;
    try {
      await revokeKey.mutateAsync(apiKey.id);
      toast.success("API Key revogada");
      onClose();
    } catch {
      toast.error("Erro ao revogar key");
    }
  };

  return (
    <AlertDialog open={!!apiKey} onOpenChange={() => { setConfirmName(""); onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[15px]">Revogar API Key</AlertDialogTitle>
          <AlertDialogDescription className="text-[13px] leading-relaxed">
            Esta ação é irreversível. Integrações usando esta key perderão acesso imediatamente.
            <br /><br />
            Digite <span className="font-semibold text-foreground">{apiKey?.name}</span> para confirmar:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          placeholder={apiKey?.name ?? ""}
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          className="h-[34px] text-[13px] mt-1"
          autoFocus
        />
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => { setConfirmName(""); onClose(); }}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRevoke}
            disabled={confirmName !== apiKey?.name || revokeKey.isPending}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {revokeKey.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Revogar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────────
function ApiKeyRow({ apiKey, last }: { apiKey: ApiKey; last: boolean }) {
  const [revoking, setRevoking] = useState(false);
  const isRevoked = !!apiKey.revoked_at;

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
  };

  return (
    <>
      <div className={cn("flex items-center gap-4 px-5 py-3.5", !last && "border-b border-border")}>
        <Key className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-foreground truncate">{apiKey.name}</span>
            {isRevoked && (
              <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 px-1.5 py-0">
                Revogada
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <code className="text-[11px] font-mono text-muted-foreground/60">{apiKey.key_prefix}...</code>
            <span className="text-[11px] text-muted-foreground/50">Criada {formatDate(apiKey.created_at)}</span>
            {apiKey.last_used_at && (
              <span className="text-[11px] text-muted-foreground/50">Último uso {formatDate(apiKey.last_used_at)}</span>
            )}
          </div>
        </div>
        {!isRevoked && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground/50 hover:text-destructive"
            onClick={() => setRevoking(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
      <RevokeDialog apiKey={revoking ? apiKey : null} onClose={() => setRevoking(false)} />
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const ApiKeysConfig = () => {
  const [showGenerate, setShowGenerate] = useState(false);
  const { data: keys = [], isLoading } = useApiKeys();

  const activeKeys = keys.filter((k) => !k.revoked_at);
  const revokedKeys = keys.filter((k) => !!k.revoked_at);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">API Keys</h2>
          <p className="text-[12px] text-muted-foreground/60 mt-0.5">
            Chaves de acesso para integrações externas (Zapier, webhooks, automações).
          </p>
        </div>
        <Button size="sm" onClick={() => setShowGenerate(true)} className="h-8 text-[12px]">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Gerar nova key
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" />
        </div>
      ) : (
        <>
          {/* Active keys */}
          <div className="border border-border rounded-[2px] overflow-hidden">
            <SectionHeader title="KEYS ATIVAS" />
            {activeKeys.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[13px] text-muted-foreground/50">Nenhuma API Key ativa. Crie a primeira.</p>
              </div>
            ) : (
              activeKeys.map((k, i) => (
                <ApiKeyRow key={k.id} apiKey={k} last={i === activeKeys.length - 1} />
              ))
            )}
          </div>

          {/* Revoked keys (last 30 days, shown for audit) */}
          {revokedKeys.length > 0 && (
            <div className="border border-border rounded-[2px] overflow-hidden">
              <SectionHeader title="REVOGADAS (30 DIAS)" />
              {revokedKeys.map((k, i) => (
                <ApiKeyRow key={k.id} apiKey={k} last={i === revokedKeys.length - 1} />
              ))}
            </div>
          )}
        </>
      )}

      <GenerateModal open={showGenerate} onClose={() => setShowGenerate(false)} />
    </div>
  );
};

export default ApiKeysConfig;
