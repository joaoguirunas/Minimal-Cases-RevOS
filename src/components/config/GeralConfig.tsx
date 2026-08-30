import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Upload, Save, Loader2, Check, Trash2, Copy, Globe, CheckCircle2, XCircle } from "lucide-react";
import { useSettings, useUpdateSettings, useUploadLogo } from "@/hooks/useSettings";
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

// ── Row: label esquerda + controle direita ────────────────────────────────────
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
  <div
    className={cn(
      "flex items-center justify-between gap-6 px-5 py-3.5",
      !last && "border-b border-border"
    )}
  >
    <div className="min-w-0 flex-shrink-0 w-44">
      <p className="text-[13px] font-medium text-foreground">{label}</p>
      {hint && <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-snug">{hint}</p>}
    </div>
    <div className="flex-1 flex justify-end">{children}</div>
  </div>
);

// ── Section header ─────────────────────────────────────────────────────────────
const SectionHeader = ({ title }: { title: string }) => (
  <div className="px-5 py-2.5 bg-muted border-b border-border">
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{title}</p>
  </div>
);

// ── Color field (hex input + color picker) ────────────────────────────────────
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

// ── Component ──────────────────────────────────────────────────────────────────
const GeralConfig = () => {
  const { t } = useTranslation();
  const { data: config, isLoading } = useSettings();
  const updateConfig = useUpdateSettings();
  const uploadLogo = useUploadLogo();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    nome_empresa: "",
    whatsapp_provider: "whatsapp-oficial",
    fuso_horario: "America/Sao_Paulo",
    idioma: "pt-br",
    moeda: "BRL",
    cnpj: "",
    login_max_attempts: 5,
    require_mfa_for_gestores: false,
    website: "",
    email: "",
    telefone: "",
    endereco: "",
    product_name: "",
    brand_primary_color: "#6366f1",
    brand_secondary_color: "#8b5cf6",
    custom_domain: "",
  });

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    verified: boolean;
    expected_cname: string;
    found_cnames?: string[];
  } | null>(null);

  useEffect(() => {
    if (config && !isInitialized) {
      setFormData({
        nome_empresa: config.company_name || "",
        whatsapp_provider: config.whatsapp_provider || "whatsapp-oficial",
        fuso_horario: config.timezone || "America/Sao_Paulo",
        idioma: config.language || "pt-br",
        moeda: config.currency || "BRL",
        cnpj: config.tax_id || "",
        website: config.website || "",
        email: config.email || "",
        telefone: config.phone || "",
        endereco: config.address || "",
        login_max_attempts: config.login_max_attempts ?? 5,
        require_mfa_for_gestores: config.require_mfa_for_gestores ?? false,
        product_name: config.product_name ?? "",
        brand_primary_color: config.brand_primary_color ?? config.primary_color ?? "#6366f1",
        brand_secondary_color: config.brand_secondary_color ?? config.secondary_color ?? "#8b5cf6",
        custom_domain: config.custom_domain ?? "",
      });
      setIsInitialized(true);
    }
  }, [config, isInitialized]);

  const handleVerifyDomain = async () => {
    if (!formData.custom_domain.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("domain-verify", {
        method: "POST",
        body: { domain: formData.custom_domain.trim() },
      });
      if (error) throw error;
      setVerifyResult(data);
    } catch {
      toast.error("Erro ao verificar domínio");
    } finally {
      setVerifying(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const setVal = (field: string) => (value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const handleLanguageChange = async (value: string) => {
    setFormData(prev => ({ ...prev, idioma: value }));
    try {
      await updateConfig.mutateAsync({ language: value });
    } catch {
      if (config) setFormData(prev => ({ ...prev, idioma: config.language || "pt-br" }));
    }
  };

  const [removingLogo, setRemovingLogo] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
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
    if (!config?.logo_url) return;
    setRemovingLogo(true);
    try {
      await updateConfig.mutateAsync({ logo_url: null });
      toast.success("Logo removida");
    } catch {
      toast.error("Erro ao remover logo");
    } finally {
      setRemovingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateConfig.mutateAsync({
        company_name: formData.nome_empresa,
        whatsapp_provider: formData.whatsapp_provider,
        timezone: formData.fuso_horario,
        language: formData.idioma,
        currency: formData.moeda,
        tax_id: formData.cnpj,
        website: formData.website,
        email: formData.email,
        phone: formData.telefone,
        address: formData.endereco,
        login_max_attempts: formData.login_max_attempts,
        require_mfa_for_gestores: formData.require_mfa_for_gestores,
        product_name: formData.product_name || null,
        brand_primary_color: HEX_RE.test(formData.brand_primary_color) ? formData.brand_primary_color : null,
        brand_secondary_color: HEX_RE.test(formData.brand_secondary_color) ? formData.brand_secondary_color : null,
        custom_domain: formData.custom_domain.trim() || null,
      });

      if (formData.custom_domain.trim() && config) {
        try {
          await supabase.rpc("sync_custom_domain_to_adm", {
            p_tenant_id: config.id,
            p_custom_domain: formData.custom_domain.trim(),
          });
        } catch (e) {
          console.warn("sync_custom_domain_to_adm falhou (não crítico):", e);
        }
      }

      setSaved(true);
      toast.success("Configurações salvas");
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast.error("Erro ao salvar configurações");
    }
  };

  const handleCancel = () => {
    if (!config) return;
    setFormData({
      nome_empresa: config.company_name || "",
      whatsapp_provider: config.whatsapp_provider || "whatsapp-oficial",
      fuso_horario: config.timezone || "America/Sao_Paulo",
      idioma: config.language || "pt-br",
      moeda: config.currency || "BRL",
      cnpj: config.tax_id || "",
      website: config.website || "",
      email: config.email || "",
      telefone: config.phone || "",
      endereco: config.address || "",
      login_max_attempts: config.login_max_attempts ?? 5,
      require_mfa_for_gestores: config.require_mfa_for_gestores ?? false,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header — mesmo padrão que UsuariosConfig */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-[15px] font-semibold text-foreground">{t('generalSettings.title')}</h1>
          <p className="text-[13px] text-muted-foreground/70 mt-0.5">{t('generalSettings.description')}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="h-[30px] text-xs text-muted-foreground/70 rounded-[4px]"
          >
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            disabled={updateConfig.isPending || saved}
            onClick={handleSubmit as any}
            className="h-[30px] px-3 gap-1.5 text-xs rounded-[4px]"
          >
            {updateConfig.isPending
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('common.saving')}</>
              : saved
              ? <><Check className="w-3.5 h-3.5" />Salvo</>
              : <><Save className="w-3.5 h-3.5" strokeWidth={1.5} />{t('generalSettings.actions.save')}</>}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Identidade ─────────────────────────────────────────── */}
        <div className="border border-border rounded-[2px] overflow-hidden">
          <SectionHeader title={t('generalSettings.companyInfo.title')} />

          <FieldRow label={t('generalSettings.companyInfo.companyName')}>
            <Input
              value={formData.nome_empresa}
              onChange={set("nome_empresa")}
              placeholder={t('generalSettings.companyInfo.companyNamePlaceholder')}
              required
              className="h-[30px] text-[13px] w-64"
            />
          </FieldRow>

          <FieldRow label={t('generalSettings.companyInfo.logo')} hint={t('generalSettings.companyInfo.logoFormat')} last>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[2px] border border-border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {config?.logo_url
                  ? <img src={config.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  : <Building2 className="w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={1.5} />}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLogo.isPending}
                className="h-[30px] text-[12px] gap-1.5 rounded-[4px]"
              >
                {uploadLogo.isPending
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Upload className="w-3 h-3" strokeWidth={1.5} />}
                {uploadLogo.isPending ? t('generalSettings.companyInfo.uploading') : t('generalSettings.companyInfo.changeLogo')}
              </Button>
              {config?.logo_url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveLogo}
                  disabled={removingLogo}
                  className="h-[30px] text-[12px] gap-1.5 rounded-[4px] text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {removingLogo
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Trash2 className="w-3 h-3" strokeWidth={1.5} />}
                  Remover
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/svg+xml,image/jpeg"
                onChange={handleLogoChange}
                className="hidden"
              />
            </div>
          </FieldRow>
        </div>

        {/* ── Regionalização ─────────────────────────────────────── */}
        <div className="border border-border rounded-[2px] overflow-hidden">
          <SectionHeader title={t('generalSettings.regionalSettings.title')} />

          <FieldRow label={t('generalSettings.regionalSettings.timezone')}>
            <Select value={formData.fuso_horario} onValueChange={setVal("fuso_horario")}>
              <SelectTrigger className="h-[30px] text-[13px] w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Sao_Paulo">América/São Paulo</SelectItem>
                <SelectItem value="America/New_York">América/New York</SelectItem>
                <SelectItem value="Europe/London">Europa/Londres</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label={t('generalSettings.regionalSettings.currency')}>
            <Select value={formData.moeda} onValueChange={setVal("moeda")}>
              <SelectTrigger className="h-[30px] text-[13px] w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">Real (BRL)</SelectItem>
                <SelectItem value="USD">Dólar (USD)</SelectItem>
                <SelectItem value="EUR">Euro (EUR)</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label={t('generalSettings.regionalSettings.language')} last>
            <div className="flex items-center gap-2">
              {updateConfig.isPending && (
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/40" />
              )}
              <Select value={formData.idioma} onValueChange={handleLanguageChange} disabled={updateConfig.isPending}>
                <SelectTrigger className="h-[30px] text-[13px] w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-br">{t('generalSettings.regionalSettings.languages.ptBr')}</SelectItem>
                  <SelectItem value="en-us">{t('generalSettings.regionalSettings.languages.enUs')}</SelectItem>
                  <SelectItem value="es">{t('generalSettings.regionalSettings.languages.esEs')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FieldRow>
        </div>

        {/* ── WhatsApp ───────────────────────────────────────────── */}
        <div className="border border-border rounded-[2px] overflow-hidden">
          <SectionHeader title={t('generalSettings.whatsappIntegration.title')} />

          <FieldRow label={t('generalSettings.whatsappIntegration.provider')} hint={t('generalSettings.whatsappIntegration.providerDescription')} last>
            <Select value={formData.whatsapp_provider} onValueChange={setVal("whatsapp_provider")}>
              <SelectTrigger className="h-[30px] text-[13px] w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp-oficial">{t('generalSettings.whatsappIntegration.whatsappOfficial')}</SelectItem>
                <SelectItem value="outro">{t('generalSettings.whatsappIntegration.other')}</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </div>

        {/* ── Dados de Contato ───────────────────────────────────── */}
        <div className="border border-border rounded-[2px] overflow-hidden">
          <SectionHeader title={t('generalSettings.institutionalData.title')} />

          <FieldRow label={t('generalSettings.institutionalData.taxId')}>
            <Input
              value={formData.cnpj}
              onChange={set("cnpj")}
              placeholder={t('generalSettings.institutionalData.taxIdPlaceholder')}
              className="h-[30px] text-[13px] w-64"
            />
          </FieldRow>

          <FieldRow label={t('generalSettings.institutionalData.website')}>
            <Input
              value={formData.website}
              onChange={set("website")}
              placeholder={t('generalSettings.institutionalData.websitePlaceholder')}
              className="h-[30px] text-[13px] w-64"
            />
          </FieldRow>

          <FieldRow label={t('generalSettings.institutionalData.email')}>
            <Input
              type="email"
              value={formData.email}
              onChange={set("email")}
              placeholder={t('generalSettings.institutionalData.emailPlaceholder')}
              className="h-[30px] text-[13px] w-64"
            />
          </FieldRow>

          <FieldRow label={t('generalSettings.institutionalData.phone')}>
            <Input
              value={formData.telefone}
              onChange={set("telefone")}
              placeholder={t('generalSettings.institutionalData.phonePlaceholder')}
              className="h-[30px] text-[13px] w-64"
            />
          </FieldRow>

          <FieldRow label={t('generalSettings.institutionalData.address')} last>
            <Textarea
              value={formData.endereco}
              onChange={set("endereco")}
              placeholder={t('generalSettings.institutionalData.addressPlaceholder')}
              rows={2}
              className="text-[13px] resize-none w-64"
            />
          </FieldRow>
        </div>

        {/* ── Links Úteis (Meta) ─────────────────────────────── */}
        {(() => {
          const privacyUrl = `${window.location.origin}/politica-de-privacidade`;
          const deletionUrl = `${window.location.origin}/excluir-dados`;
          return (
            <div className="border border-border rounded-[2px] overflow-hidden">
              <SectionHeader title="Links Úteis (Meta)" />

              <div className="px-5 py-3 border-b border-border">
                <p className="text-[11px] text-muted-foreground/50 leading-snug">
                  Registre estas URLs no painel Meta Business para conformidade com WhatsApp/Facebook.
                </p>
              </div>

              <FieldRow label="Política de Privacidade">
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={privacyUrl}
                    className="h-[30px] text-[12px] w-72 text-muted-foreground/70 cursor-default"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(privacyUrl)}
                    className="h-[30px] px-2.5 gap-1.5 text-[12px] rounded-[4px] flex-shrink-0"
                  >
                    {copiedUrl === privacyUrl
                      ? <Check className="w-3 h-3 text-emerald-400" />
                      : <Copy className="w-3 h-3" strokeWidth={1.5} />}
                    {copiedUrl === privacyUrl ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
              </FieldRow>

              <FieldRow label="Exclusão de Dados" last>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={deletionUrl}
                    className="h-[30px] text-[12px] w-72 text-muted-foreground/70 cursor-default"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(deletionUrl)}
                    className="h-[30px] px-2.5 gap-1.5 text-[12px] rounded-[4px] flex-shrink-0"
                  >
                    {copiedUrl === deletionUrl
                      ? <Check className="w-3 h-3 text-emerald-400" />
                      : <Copy className="w-3 h-3" strokeWidth={1.5} />}
                    {copiedUrl === deletionUrl ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
              </FieldRow>
            </div>
          );
        })()}

        {/* ── Identidade da Plataforma (White-label) ──────────────── */}
        <div className="border border-border rounded-[2px] overflow-hidden">
          <SectionHeader title="IDENTIDADE DA PLATAFORMA" />

          <FieldRow label="Nome do produto" hint="Substitui 'GrowthSales' no header e emails">
            <Input
              value={formData.product_name}
              onChange={(e) => setFormData(prev => ({ ...prev, product_name: e.target.value }))}
              placeholder="GrowthSales"
              className="h-[30px] text-[13px] w-64"
            />
          </FieldRow>

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

        {/* ── Domínio customizado ─────────────────────────────────── */}
        <div className="border border-border rounded-[2px] overflow-hidden">
          <SectionHeader title="DOMÍNIO CUSTOMIZADO" />

          <div className="px-5 py-4 space-y-3">
            <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
              Aponte um subdomínio seu para <code className="text-[11px] bg-muted px-1 rounded">app.growthsales.ai</code> via CNAME. Após verificação, salve o domínio e comunique ao time de infra para provisionamento SSL.
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={formData.custom_domain}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, custom_domain: e.target.value }));
                  setVerifyResult(null);
                }}
                placeholder="app.seudominio.com.br"
                className="h-[30px] text-[12px] max-w-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleVerifyDomain}
                disabled={!formData.custom_domain.trim() || verifying}
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
                      {formData.custom_domain} → {verifyResult.expected_cname}
                    </code>
                    <p className="text-muted-foreground/60 mt-1">Propagação pode levar até 48h após configurar.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Segurança ──────────────────────────────────────────── */}
        <div className="border border-border rounded-[2px] overflow-hidden">
          <SectionHeader title="SEGURANÇA" />

          <FieldRow label="Tentativas de login" hint="Bloqueio temporário após N tentativas falhas">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={20}
                value={formData.login_max_attempts}
                onChange={(e) =>
                  setFormData(prev => ({
                    ...prev,
                    login_max_attempts: Math.max(1, Math.min(20, parseInt(e.target.value) || 5)),
                  }))
                }
                className="h-[30px] text-[13px] w-20 text-center"
              />
              <span className="text-[12px] text-muted-foreground/60">tentativas</span>
            </div>
          </FieldRow>
          <FieldRow label="Exigir MFA para gestores" hint="Gestores sem TOTP configurado serão redirecionados ao próximo login" last>
            <Switch
              checked={formData.require_mfa_for_gestores}
              onCheckedChange={(checked) =>
                setFormData(prev => ({ ...prev, require_mfa_for_gestores: checked }))
              }
            />
          </FieldRow>
        </div>

      </form>

      {/* Versão do sistema — mesmo padrão font-mono do ADM HealthBadge */}
      <p className="text-[11px] text-muted-foreground/40 text-center pt-2 font-mono">
        Versão: {__APP_VERSION__}
      </p>
    </div>
  );
};

export default GeralConfig;
