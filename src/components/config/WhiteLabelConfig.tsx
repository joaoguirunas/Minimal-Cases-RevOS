import { useState, useEffect, useRef } from "react";
import { Globe, Loader2, CheckCircle2, XCircle, Save, Check, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSettings, useUpdateSettings, useUploadLogo } from "@/hooks/useSettings";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

// ── Shared ─────────────────────────────────────────────────────────────────────
const SectionHeader = ({ title }: { title: string }) => (
  <div className="px-5 py-2.5 bg-muted border-b border-border">
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{title}</p>
  </div>
);

const FieldRow = ({
  label,
  hint,
  last = false,
  children,
}: {
  label: string;
  hint?: string;
  last?: boolean;
  children: React.ReactNode;
}) => (
  <div className={cn("flex items-center justify-between gap-6 px-5 py-3.5", !last && "border-b border-border")}>
    <div className="min-w-0 flex-shrink-0 w-44">
      <p className="text-[13px] font-medium text-foreground">{label}</p>
      {hint && <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-snug">{hint}</p>}
    </div>
    <div className="flex-1 flex justify-end">{children}</div>
  </div>
);

// ── Color picker ───────────────────────────────────────────────────────────────
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [raw, setRaw] = useState(value);

  useEffect(() => { setRaw(value); }, [value]);

  const isValid = HEX_RE.test(raw);

  const handleRawChange = (v: string) => {
    const normalized = v.startsWith("#") ? v : "#" + v;
    setRaw(normalized);
    if (HEX_RE.test(normalized)) onChange(normalized);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={isValid ? raw : "#6366f1"}
        onChange={(e) => { setRaw(e.target.value); onChange(e.target.value); }}
        className="w-8 h-8 rounded-[3px] border border-border cursor-pointer p-0.5 bg-transparent"
        title={label}
      />
      <Input
        value={raw}
        onChange={(e) => handleRawChange(e.target.value)}
        maxLength={7}
        className={cn("h-[30px] text-[12px] font-mono w-28", !isValid && "border-destructive")}
        placeholder="#000000"
      />
    </div>
  );
}

// ── Domain section ─────────────────────────────────────────────────────────────
function DomainSection({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    verified: boolean;
    expected_cname: string;
    found_cnames?: string[];
  } | null>(null);

  const handleVerify = async () => {
    if (!value.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("domain-verify", {
        method: "POST",
        body: { domain: value.trim() },
      });
      if (error) throw error;
      setVerifyResult(data);
    } catch {
      toast.error("Erro ao verificar domínio");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => { onChange(e.target.value); setVerifyResult(null); }}
          placeholder="app.seudominio.com.br"
          className="h-[30px] text-[12px] max-w-xs"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleVerify}
          disabled={!value.trim() || verifying}
          className="h-[30px] text-[12px] gap-1.5 shrink-0"
        >
          {verifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
          Verificar DNS
        </Button>
      </div>

      {verifyResult && (
        <div className={cn(
          "rounded-[4px] border px-3 py-2.5 text-[12px] space-y-1.5",
          verifyResult.verified
            ? "border-green-500/30 bg-green-500/5 text-green-700"
            : "border-amber-500/30 bg-amber-500/5 text-amber-700"
        )}>
          <div className="flex items-center gap-1.5 font-medium">
            {verifyResult.verified
              ? <><CheckCircle2 className="w-3.5 h-3.5" /> Domínio verificado</>
              : <><XCircle className="w-3.5 h-3.5" /> CNAME não encontrado</>}
          </div>
          {!verifyResult.verified && (
            <div className="text-[11px] text-muted-foreground space-y-0.5">
              <p>Configure um registro CNAME no seu provedor DNS:</p>
              <code className="block bg-muted px-2 py-1 rounded-[3px] text-foreground">
                {value} → {verifyResult.expected_cname}
              </code>
              <p className="text-muted-foreground/60 mt-1">Propagação pode levar até 48h após configurar.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const WhiteLabelConfig = () => {
  const { data: config, isLoading } = useSettings();
  const updateConfig = useUpdateSettings();
  const uploadLogo = useUploadLogo();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saved, setSaved] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [formData, setFormData] = useState({
    product_name: "",
    brand_primary_color: "#6366f1",
    brand_secondary_color: "#8b5cf6",
    custom_domain: "",
  });

  useEffect(() => {
    if (config && !isInitialized) {
      setFormData({
        product_name: config.product_name ?? "",
        brand_primary_color: config.brand_primary_color ?? config.primary_color ?? "#6366f1",
        brand_secondary_color: config.brand_secondary_color ?? config.secondary_color ?? "#8b5cf6",
        custom_domain: config.custom_domain ?? "",
      });
      setIsInitialized(true);
    }
  }, [config, isInitialized]);

  const handleSave = async () => {
    try {
      await updateConfig.mutateAsync({
        product_name: formData.product_name || null,
        brand_primary_color: HEX_RE.test(formData.brand_primary_color) ? formData.brand_primary_color : null,
        brand_secondary_color: HEX_RE.test(formData.brand_secondary_color) ? formData.brand_secondary_color : null,
        custom_domain: formData.custom_domain.trim() || null,
      });

      // Sync custom domain to adm_clients via RPC
      if (formData.custom_domain.trim() && config) {
        await supabase.rpc("sync_custom_domain_to_adm", {
          p_tenant_id: config.id,
          p_custom_domain: formData.custom_domain.trim(),
        });
      }

      setSaved(true);
      toast.success("Configurações salvas");
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Máximo 2MB"); return; }
    if (!["image/png", "image/svg+xml", "image/jpeg"].includes(file.type)) {
      toast.error("Use PNG, SVG ou JPG"); return;
    }
    try {
      const url = await uploadLogo.mutateAsync(file);
      if (config) await updateConfig.mutateAsync({ logo_url: url });
      toast.success("Logo atualizada");
    } catch {
      toast.error("Erro ao fazer upload");
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await updateConfig.mutateAsync({ logo_url: null });
      toast.success("Logo removida");
    } catch {
      toast.error("Erro ao remover logo");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">White-label</h2>
          <p className="text-[12px] text-muted-foreground/60 mt-0.5">
            Customize a identidade visual e o domínio do produto para sua marca.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={updateConfig.isPending}
          className="h-8 text-[12px] gap-1.5"
        >
          {updateConfig.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : saved ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {saved ? "Salvo" : "Salvar"}
        </Button>
      </div>

      {/* Identity */}
      <div className="border border-border rounded-[2px] overflow-hidden">
        <SectionHeader title="IDENTIDADE" />
        <FieldRow label="Nome do produto" hint="Substitui 'GrowthSales' no header e emails">
          <Input
            value={formData.product_name}
            onChange={(e) => setFormData(prev => ({ ...prev, product_name: e.target.value }))}
            placeholder="GrowthSales"
            className="h-[30px] text-[12px] max-w-xs"
          />
        </FieldRow>
        <FieldRow label="Logo" hint="PNG, SVG ou JPG — máximo 2MB" last>
          <div className="flex items-center gap-2">
            {config?.logo_url && (
              <img src={config.logo_url} alt="Logo" className="h-7 w-auto max-w-[80px] object-contain rounded-[2px]" />
            )}
            <input ref={fileInputRef} type="file" accept="image/png,image/svg+xml,image/jpeg" className="hidden" onChange={handleLogoChange} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadLogo.isPending}
              className="h-[30px] text-[12px] gap-1"
            >
              {uploadLogo.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              Upload
            </Button>
            {config?.logo_url && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRemoveLogo}
                className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-destructive"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </FieldRow>
      </div>

      {/* Brand colors */}
      <div className="border border-border rounded-[2px] overflow-hidden">
        <SectionHeader title="CORES DA MARCA" />
        <FieldRow label="Cor primária" hint="Botões, links, elementos de destaque">
          <ColorField
            label="Cor primária"
            value={formData.brand_primary_color}
            onChange={(v) => setFormData(prev => ({ ...prev, brand_primary_color: v }))}
          />
        </FieldRow>
        <FieldRow label="Cor secundária" hint="Accents, badges, gradientes" last>
          <ColorField
            label="Cor secundária"
            value={formData.brand_secondary_color}
            onChange={(v) => setFormData(prev => ({ ...prev, brand_secondary_color: v }))}
          />
        </FieldRow>
      </div>

      {/* Custom domain */}
      <div className="border border-border rounded-[2px] overflow-hidden">
        <SectionHeader title="DOMÍNIO CUSTOMIZADO" />
        <div className="px-5 py-4">
          <p className="text-[12px] text-muted-foreground/70 mb-3 leading-relaxed">
            Aponte um subdomínio seu para <code className="text-[11px] bg-muted px-1 rounded">app.growthsales.ai</code> via CNAME. Após verificação, salve o domínio e comunique ao time de infra para provisionamento SSL.
          </p>
          <DomainSection
            value={formData.custom_domain}
            onChange={(v) => setFormData(prev => ({ ...prev, custom_domain: v }))}
          />
        </div>
      </div>
    </div>
  );
};

export default WhiteLabelConfig;
