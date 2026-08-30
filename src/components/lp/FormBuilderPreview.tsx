import React, { useState } from "react";
import {
  ChevronDown,
  ClipboardList,
  Monitor,
  Smartphone,
  Globe,
  Code2,
  Layers,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import type { LpFormField, LpFormSettings } from "@/hooks/useLpForms";
import { cn } from "@/lib/utils";

// ─── Classic form preview ─────────────────────────────────────────────────────

export function FormFieldStatic({ field, isDark = false }: { field: LpFormField; isDark?: boolean }) {
  const labelStyle: React.CSSProperties | undefined = isDark ? { color: '#e4e4e7' } : undefined;
  const inputStyle: React.CSSProperties | undefined = isDark
    ? { backgroundColor: '#18181b', borderColor: '#3f3f46', color: '#fafafa' }
    : undefined;

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-foreground" style={labelStyle}>
        {field.label || <span className={isDark ? undefined : "text-muted-foreground italic"} style={isDark ? { color: '#71717a', fontStyle: 'italic' } : undefined}>sem rótulo</span>}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea
          disabled
          placeholder={field.placeholder || ""}
          rows={2}
          className="w-full text-xs border border-border rounded-[4px] px-3 py-2 bg-muted resize-none"
          style={inputStyle}
        />
      ) : field.type === "select" ? (
        <div className="relative">
          <select disabled className="w-full text-xs border border-border rounded-[4px] px-3 py-1.5 bg-muted h-[30px] appearance-none pr-6" style={inputStyle}>
            <option>Selecione...</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
        </div>
      ) : field.type === "radio" || field.type === "checkbox" ? (
        <div className="space-y-1">
          {(field.options ?? []).length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic" style={isDark ? { color: '#71717a' } : undefined}>Adicione opções</p>
          ) : (
            (field.options ?? []).map((o, i) => (
              <label key={i} className="flex items-center gap-2 text-xs text-muted-foreground" style={isDark ? { color: '#a1a1aa' } : undefined}>
                <input type={field.type} disabled className="w-3 h-3" />
                {o.label || `Opção ${i + 1}`}
              </label>
            ))
          )}
        </div>
      ) : (
        <input
          disabled
          type={field.type === "phone" ? "tel" : field.type}
          placeholder={field.placeholder || ""}
          className="w-full text-xs border border-border rounded-[4px] px-3 py-1.5 bg-muted h-[30px]"
          style={inputStyle}
        />
      )}
    </div>
  );
}

export function FormPreview({
  fields,
  settings,
}: {
  fields: LpFormField[];
  settings: LpFormSettings;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const visible = fields.filter((f) => f.type !== "hidden");

  return (
    <div className="space-y-3">
      {/* Device toggle */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Estrutura do formulário
        </p>
        <div className="flex items-center bg-muted rounded-[4px] p-0.5 gap-0.5">
          <button
            onClick={() => setDevice("desktop")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-[3px] text-[10px] font-medium transition-colors",
              device === "desktop" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Monitor className="w-3 h-3" /> Desktop
          </button>
          <button
            onClick={() => setDevice("mobile")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-[3px] text-[10px] font-medium transition-colors",
              device === "mobile" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Smartphone className="w-3 h-3" /> Mobile
          </button>
        </div>
      </div>

      {/* Device frame */}
      <div className={cn(
        "mx-auto transition-all duration-300",
        device === "mobile" ? "max-w-[240px]" : "max-w-full"
      )}>
        {device === "mobile" && (
          <div className="bg-foreground/10 rounded-[12px] p-1.5 border-2 border-foreground/20">
            <div className="flex justify-center mb-1.5">
              <div className="w-10 h-1 bg-foreground/20 rounded-full" />
            </div>
            <div className="bg-card rounded-[8px] overflow-hidden border border-border">
              <FormPreviewInner visible={visible} settings={settings} />
            </div>
            <div className="flex justify-center mt-1.5">
              <div className="w-6 h-6 bg-foreground/20 rounded-full" />
            </div>
          </div>
        )}
        {device === "desktop" && (
          <div className="bg-card rounded-[4px] border border-border overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-muted border-b border-border">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <div className="flex-1 mx-2 h-4 bg-background border border-border rounded-[3px] flex items-center px-2 gap-1">
                <Globe className="w-2.5 h-2.5 text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground">seusite.com</span>
              </div>
            </div>
            <FormPreviewInner visible={visible} settings={settings} />
          </div>
        )}
      </div>
    </div>
  );
}

export function FormPreviewInner({
  visible,
  settings,
}: {
  visible: LpFormField[];
  settings: LpFormSettings;
}) {
  const isDark = settings.style?.page_mode === 'dark';

  return (
    <div
      className="p-4"
      style={isDark ? { backgroundColor: '#09090b', color: '#fafafa' } : undefined}
    >
      {visible.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground" style={isDark ? { color: '#71717a' } : undefined}>
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Adicione campos para visualizar
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((field) => (
            <FormFieldStatic key={field.id} field={field} isDark={isDark} />
          ))}
          <button
            disabled
            className="w-full py-2 rounded-[4px] text-sm font-semibold text-white bg-primary/80 cursor-default"
          >
            {settings.submit_text || "Enviar"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Steps preview ────────────────────────────────────────────────────────────

export function StepsPreview({
  fields,
  settings,
}: {
  fields: LpFormField[];
  settings: LpFormSettings;
}) {
  const steps = settings.steps ?? [];
  const [previewStep, setPreviewStep] = useState(0);

  if (steps.length === 0) {
    return <FormPreview fields={fields} settings={settings} />;
  }

  const visible = fields.filter((f) => f.type !== "hidden");
  const currentStep = steps[previewStep];
  const stepFields = visible.filter((f) => f.step_id === currentStep?.id);
  const isDark = settings.style?.page_mode === 'dark';

  return (
    <div
      className="bg-card rounded-[4px] border border-border overflow-hidden max-w-sm mx-auto"
      style={isDark ? { backgroundColor: '#09090b', borderColor: '#27272a' } : undefined}
    >
      {/* Step progress */}
      <div className="p-3 border-b border-border bg-muted" style={isDark ? { backgroundColor: '#18181b', borderColor: '#27272a' } : undefined}>
        <div className="flex items-center gap-1 mb-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 h-1 rounded-full transition-all duration-300",
                i < previewStep
                  ? "bg-primary"
                  : i === previewStep
                  ? "bg-primary/60"
                  : "bg-muted-foreground/20"
              )}
            />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground" style={isDark ? { color: '#a1a1aa' } : undefined}>
          Passo {previewStep + 1} de {steps.length}:{" "}
          <span className="font-semibold text-foreground" style={isDark ? { color: '#fafafa' } : undefined}>{currentStep?.title}</span>
        </p>
      </div>

      <div className="p-4 space-y-3" style={isDark ? { backgroundColor: '#09090b' } : undefined}>
        {stepFields.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4 italic" style={isDark ? { color: '#71717a' } : undefined}>
            Nenhum campo neste passo
          </p>
        ) : (
          stepFields.map((field) => (
            <div key={field.id} className="space-y-1">
              <label className="text-xs font-semibold text-foreground" style={isDark ? { color: '#e4e4e7' } : undefined}>
                {field.label || <span className={isDark ? undefined : "italic text-muted-foreground"} style={isDark ? { color: '#71717a', fontStyle: 'italic' } : undefined}>sem rótulo</span>}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <input
                disabled
                placeholder={field.placeholder || ""}
                className="w-full text-xs border border-border rounded-[4px] px-3 py-1.5 bg-muted h-[30px]"
                style={isDark ? { backgroundColor: '#18181b', borderColor: '#3f3f46', color: '#fafafa' } : undefined}
              />
            </div>
          ))
        )}
      </div>

      <div className="p-3 pt-0 flex items-center gap-2">
        <button
          onClick={() => setPreviewStep((s) => Math.max(0, s - 1))}
          disabled={previewStep === 0}
          className="px-3 py-1.5 text-xs border border-border rounded-[4px] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >
          ← Voltar
        </button>
        <button
          onClick={() => setPreviewStep((s) => Math.min(steps.length - 1, s + 1))}
          className="flex-1 py-1.5 text-xs rounded-[4px] bg-primary/80 text-white font-semibold hover:bg-primary/90 transition-colors"
        >
          {previewStep < steps.length - 1 ? "Próximo →" : settings.submit_text || "Enviar"}
        </button>
      </div>
    </div>
  );
}


// ─── Embed codes panel ────────────────────────────────────────────────────────

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border hover:border-primary bg-card"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-green-500" /> Copiado!
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" /> Copiar
        </>
      )}
    </button>
  );
}

export function EmbedPanel({
  formId,
  settings,
}: {
  formId?: string;
  settings: LpFormSettings;
}) {
  const [sub, setSub] = useState<"iframe" | "script" | "widget">("iframe");

  if (!formId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
        <Code2 className="w-8 h-8 text-muted-foreground opacity-25" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Salve primeiro
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Salve o formulário para obter o código de incorporação.
          </p>
        </div>
      </div>
    );
  }

  const formUrl = `${window.location.origin}/f/${formId}`;
  // Embed JS: no standalone embed script exists yet — iframe is the only working embed mode
  const embedJsUrl = `${window.location.origin}/embed.js`;

  const widget = settings.widget;
  const widgetCfg: Record<string, unknown> = {
    formId,
    position: widget?.position ?? "bottom-right",
    buttonColor: widget?.button_color ?? "#4f46e5",
    buttonShape: widget?.button_shape ?? "round",
    buttonSize: widget?.button_size ?? "md",
    buttonShadow: widget?.button_shadow !== false,
    type: widget?.destination ?? "form",
    whatsapp: widget?.whatsapp_number ?? "",
  };
  if (widget?.button_icon) widgetCfg.buttonIcon = widget.button_icon;
  if ((widget?.button_shape ?? "round") === "pill") {
    widgetCfg.buttonLabel = widget?.button_label ?? "Fale conosco";
  }

  const codes: Record<"iframe" | "script" | "widget", string> = {
    iframe: `<iframe\n  src="${formUrl}?embed=1"\n  width="100%"\n  height="600"\n  style="border:none;border-radius:8px;"\n  loading="lazy"\n></iframe>`,
    script: `<div id="lp-form-${formId}"></div>\n<script\n  src="${embedJsUrl}?form_id=${formId}"\n  data-form-id="${formId}"\n  async\n></script>`,
    widget: `<script>\n  window.lpProConfig = ${JSON.stringify(
      widgetCfg,
      null,
      2
    )};\n</script>\n<script src="${embedJsUrl}" async></script>`,
  };

  const subtabsMeta: Record<"iframe" | "script" | "widget", { icon: React.ReactNode; desc: string; badge?: string }> = {
    iframe: {
      icon: <Monitor className="w-3.5 h-3.5" />,
      desc: "Cole no HTML do seu site para exibir o formulário embutido em uma área fixa.",
      badge: "Mais simples",
    },
    script: {
      icon: <Code2 className="w-3.5 h-3.5" />,
      desc: "Carregamento assíncrono via JS. O <div> será substituído automaticamente pelo formulário.",
      badge: "Recomendado",
    },
    widget: {
      icon: <Layers className="w-3.5 h-3.5" />,
      desc: "Botão flutuante (FAB) no canto da página. Configure a aparência em Config → Widget.",
      badge: "Widget FAB",
    },
  };

  const subtabs = [
    { key: "iframe" as const, label: "iFrame" },
    { key: "script" as const, label: "Script" },
    { key: "widget" as const, label: "Widget" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Subtab bar */}
      <div className="flex border-b border-border shrink-0 px-3 pt-3 gap-0.5">
        {subtabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-[4px] transition-colors border-b-2 -mb-px",
              sub === t.key
                ? "border-primary text-foreground bg-card"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {subtabsMeta[t.key].icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Description card */}
        <div className="mx-4 mt-4 p-3 bg-muted border border-border rounded-[4px] flex items-start gap-2.5">
          <div className="mt-0.5 text-muted-foreground shrink-0">{subtabsMeta[sub].icon}</div>
          <div className="min-w-0">
            {subtabsMeta[sub].badge && (
              <span className="inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary mb-1">
                {subtabsMeta[sub].badge}
              </span>
            )}
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {subtabsMeta[sub].desc}
            </p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Code block */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wide">
                  Código de integração
                </span>
              </div>
              <CopyButton text={codes[sub]} />
            </div>
            <div className="bg-[#1e1e2e] rounded-[4px] border border-border overflow-hidden">
              {/* Fake header bar */}
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5">
                <div className="w-2 h-2 rounded-full bg-red-500/60" />
                <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
                <div className="w-2 h-2 rounded-full bg-green-500/60" />
                <span className="ml-2 text-[9px] text-white/30 font-mono">
                  {sub === "iframe" ? "index.html" : sub === "script" ? "script.js" : "widget-config.html"}
                </span>
              </div>
              <pre className="text-[11px] font-mono p-4 overflow-x-auto whitespace-pre-wrap break-all text-[#cdd6f4] leading-relaxed">
                {codes[sub]}
              </pre>
            </div>
          </div>

          {/* Direct URL */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                URL direta do formulário
              </span>
              <CopyButton text={formUrl} />
            </div>
            <div className="flex items-center gap-2 bg-muted border border-border rounded-[4px] px-2.5 py-2">
              <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-[10px] font-mono text-muted-foreground break-all flex-1">{formUrl}</span>
              <a href={formUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground shrink-0">
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Browser chrome wrapper ───────────────────────────────────────────────────

export function BrowserChrome() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 bg-muted border-b border-border shrink-0">
      <div className="w-2 h-2 rounded-full bg-red-400" />
      <div className="w-2 h-2 rounded-full bg-yellow-400" />
      <div className="w-2 h-2 rounded-full bg-green-400" />
      <div className="flex-1 mx-2 h-4 bg-background border border-border rounded-[3px] flex items-center px-2 gap-1">
        <Globe className="w-2.5 h-2.5 text-muted-foreground" />
        <span className="text-[9px] text-muted-foreground">seusite.com/landing</span>
      </div>
    </div>
  );
}
