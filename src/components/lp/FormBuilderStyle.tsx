import React from "react";
import {
  Monitor,
  Layers,
  MousePointerClick,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type {
  LpFormField,
  LpFormSettings,
  LpFormStyle,
  LpFormWidget,
} from "@/hooks/useLpForms";
import {
  getFormStyle,
  getAccentBarStyle,
  getButtonBg,
  FieldLabel,
  WEIGHT_MAP,
  RADIUS_MAP,
  BTN_SIZE_MAP,
  ACCENT_WIDTH_MAP,
  FONT_OPTIONS,
  GOOGLE_FONTS_URL,
  FORM_SKINS,
} from "./formBuilderUtils";
import { cn } from "@/lib/utils";

// Inject keyframes for accent shimmer animation
if (typeof document !== 'undefined' && !document.querySelector('style[data-accent-shimmer]')) {
  const style = document.createElement('style');
  style.setAttribute('data-accent-shimmer', '1');
  style.textContent = `@keyframes accent-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`;
  document.head.appendChild(style);
}

function BadgeIndicator({ icon, color, size = 8 }: { icon: 'circle' | 'pulse' | 'wave' | 'star' | 'bolt' | 'heart'; color: string; size?: number }) {
  const s = size;
  switch (icon) {
    case 'pulse':
      return (
        <span className="relative inline-flex shrink-0" style={{ width: s, height: s }}>
          <span className="absolute inset-0 rounded-full animate-ping opacity-50" style={{ backgroundColor: color }} />
          <span className="relative rounded-full w-full h-full" style={{ backgroundColor: color }} />
        </span>
      );
    case 'wave':
      return <span className="shrink-0 animate-pulse" style={{ color, fontSize: s * 1.2, lineHeight: 1 }}>〰</span>;
    case 'star':
      return <span className="shrink-0 animate-pulse" style={{ color, fontSize: s * 1.2, lineHeight: 1 }}>★</span>;
    case 'bolt':
      return <span className="shrink-0 animate-pulse" style={{ color, fontSize: s * 1.2, lineHeight: 1 }}>⚡</span>;
    case 'heart':
      return <span className="shrink-0 animate-pulse" style={{ color, fontSize: s * 1.2, lineHeight: 1 }}>♥</span>;
    default:
      return <span className="shrink-0 rounded-full animate-pulse" style={{ backgroundColor: color, width: s, height: s }} />;
  }
}

// ─── Dark mode detection (mirrors PublicFormPage) ────────────────────────────

function isColorDark(hex: string | undefined): boolean {
  if (!hex || hex === "transparent") return false;
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.45;
}

const DARK_BASE = {
  cardBg: "#18181b", pageBg: "#09090b", bodyColor: "#fafafa",
  labelColor: "#a1a1aa", inputBg: "#27272a", inputBorder: "#3f3f46",
};

/** Resolves style exactly like PublicFormPage — real sizes, dark mode auto-detection */
function resolvePreviewStyle(settings: LpFormSettings) {
  const fs = getFormStyle(settings);
  const st = settings.style ?? {};
  const isDarkMode = st.page_mode === "dark";
  const skinBg = fs.bg;

  const cardBg = st.bg_color ?? (isDarkMode && !skinBg ? DARK_BASE.cardBg : skinBg) ?? (isDarkMode ? DARK_BASE.cardBg : undefined);
  const inputBg = fs.inputBg ?? (isDarkMode ? DARK_BASE.inputBg : undefined);
  const inputBorder = fs.inputBorder ?? (isDarkMode ? DARK_BASE.inputBorder : undefined);
  const pageBg = fs.pageBg ?? (isDarkMode ? DARK_BASE.pageBg : undefined);

  const glass = fs.glass;
  const cardIsDark = glass || isColorDark(cardBg ?? "#ffffff");
  const computedBodyColor = (isDarkMode ? DARK_BASE.bodyColor : undefined) ?? fs.bodyColor ?? (cardIsDark ? "#f1f5f9" : "#111827");
  const computedLabelColor = st.label_color ?? (isDarkMode ? DARK_BASE.labelColor : undefined) ?? fs.labelColor ?? computedBodyColor;
  const inputIsDark = inputBg ? isColorDark(inputBg) : cardIsDark;
  const computedInputTextColor = st.input_text_color ?? (inputIsDark ? "#e5e7eb" : "#111827");

  return {
    ...fs,
    pageBg, cardBg, inputBg, inputBorder,
    bodyColor: computedBodyColor,
    labelColor: computedLabelColor,
    inputTextColor: computedInputTextColor,
    isDark: isDarkMode || cardIsDark,
  };
}

export function StyleFormPreview({ fields, settings }: { fields: LpFormField[]; settings: LpFormSettings }) {
  const visible = fields.filter((f) => f.type !== "hidden");
  const fs = resolvePreviewStyle(settings);
  const preview = visible.slice(0, 4);

  React.useEffect(() => {
    if (!document.querySelector('link[data-gf-preview]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = GOOGLE_FONTS_URL;
      link.setAttribute('data-gf-preview', '1');
      document.head.appendChild(link);
    }
  }, []);

  const accentBar = getAccentBarStyle(fs);

  // FormCard — mirrors PublicFormPage.FormCard
  const cardStyle: React.CSSProperties = {
    borderRadius: 10, overflow: "hidden",
    boxShadow: fs.noShadow ? "none" : "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)",
    border: "1px solid",
    borderColor: fs.glass ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.08)",
  };
  if (fs.glass) {
    cardStyle.background = fs.cardBg ?? "rgba(255,255,255,0.12)";
    cardStyle.backdropFilter = "blur(12px)";
  } else if (fs.cardBg) {
    cardStyle.backgroundColor = fs.cardBg;
  } else {
    cardStyle.backgroundColor = "#ffffff";
  }

  const pageStyle: React.CSSProperties = {
    background: fs.pageBg ?? undefined,
    padding: "16px 12px",
    borderRadius: 8,
  };

  const labelStyle: React.CSSProperties = {
    color: fs.labelColor,
    textTransform: fs.labelUppercase ? "uppercase" : undefined,
    letterSpacing: fs.labelUppercase ? "0.06em" : undefined,
    fontSize: fs.labelUppercase ? "11px" : fs.labelSize,
    fontWeight: fs.labelWeight,
    fontFamily: fs.labelFont,
    display: "block",
    marginBottom: "6px",
  };

  const inputStyle: React.CSSProperties = {
    borderRadius: fs.inputRadius,
    backgroundColor: fs.inputBg ?? undefined,
    borderColor: fs.inputBorder ?? undefined,
    borderWidth: fs.inputBorder ? fs.inputBorderWidth : undefined,
    borderStyle: fs.inputBorder ? "solid" : undefined,
    color: fs.inputTextColor,
    paddingTop: fs.inputSize.py,
    paddingBottom: fs.inputSize.py,
    paddingLeft: fs.inputSize.px,
    paddingRight: fs.inputSize.px,
    fontSize: fs.inputSize.fs,
    fontFamily: fs.inputFont,
    fontWeight: fs.inputFontWeight,
    width: "100%",
    boxSizing: "border-box" as const,
  };

  const borderClass = fs.inputBorder ? "" : "border border-border";

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {accentBar && fs.accentPosition !== "bottom" && <div style={accentBar} />}
        <div style={{ padding: "2rem", color: "inherit" }}>
          {/* FormHeader */}
          {fs.title && (
            <div style={{ textAlign: fs.titleAlign, marginBottom: "1.25rem" }}>
              {fs.badgeEnabled && (
                <div style={{ display: "flex", justifyContent: fs.titleAlign === "center" ? "center" : fs.titleAlign === "right" ? "flex-end" : "flex-start", marginBottom: 8 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 9999, border: "1px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.1)", color: fs.bodyColor }}>
                    <BadgeIndicator icon={fs.badgeIcon} color={fs.badgeColor} size={7} />
                    {fs.badgeText}
                  </span>
                </div>
              )}
              <p style={{ fontFamily: fs.titleFont, fontSize: fs.titleSize, color: fs.titleColor, fontWeight: fs.titleWeight, lineHeight: 1.2, margin: 0 }}>
                {fs.title}
              </p>
              {fs.subtitle && (
                <p style={{ color: fs.subtitleColor ?? fs.bodyColor, fontSize: fs.subtitleSize, marginTop: "0.4rem", lineHeight: 1.5, margin: "0.4rem 0 0", opacity: fs.subtitleColor ? 1 : 0.65 }}>
                  {fs.subtitle}
                </p>
              )}
            </div>
          )}
          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: fs.fieldGap }}>
            {preview.length === 0 ? (
              <p style={{ color: fs.labelColor, opacity: 0.6, textAlign: "center", padding: "1rem 0", fontStyle: "italic", fontSize: 13 }}>
                Adicione campos ao formulário
              </p>
            ) : (
              preview.map((field) => (
                <div key={field.id}>
                  <label style={labelStyle}>
                    <FieldLabel field={field} required={field.required} color={fs.labelColor || undefined} />
                  </label>
                  {field.type === "select" ? (
                    <div style={{ position: "relative" }}>
                      <div className={cn("w-full", borderClass)} style={{ ...inputStyle, cursor: "default" }}>
                        {field.options?.[0]?.label || "Selecione..."}
                      </div>
                      <ChevronDown style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: fs.labelColor ?? "#6b7280", pointerEvents: "none" }} />
                    </div>
                  ) : field.type === "textarea" ? (
                    <div className={cn("w-full", borderClass)} style={{ ...inputStyle, minHeight: 60 }}>
                      <span style={{ opacity: 0.5 }}>{field.placeholder || field.label || "..."}</span>
                    </div>
                  ) : (
                    <div className={cn("w-full", borderClass)} style={inputStyle}>
                      <span style={{ opacity: 0.5 }}>{field.placeholder || field.label || "..."}</span>
                    </div>
                  )}
                </div>
              ))
            )}
            {visible.length > 4 && (
              <p style={{ color: fs.labelColor, opacity: 0.5, fontSize: 12 }}>
                +{visible.length - 4} campo{visible.length - 4 > 1 ? "s" : ""}...
              </p>
            )}
            {/* Submit button */}
            {visible.length > 0 && (
              <button
                className="cursor-default"
                style={{
                  background: getButtonBg(fs),
                  color: fs.buttonTextColor,
                  borderRadius: fs.buttonRadius,
                  paddingTop: fs.buttonSize.py,
                  paddingBottom: fs.buttonSize.py,
                  paddingLeft: "1.5rem",
                  paddingRight: "1.5rem",
                  fontSize: fs.buttonSize.fs,
                  fontFamily: fs.buttonFont,
                  fontWeight: fs.buttonFontWeight,
                  width: fs.buttonFullWidth ? "100%" : "auto",
                  border: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {settings.submit_text || "Enviar"}
              </button>
            )}
          </div>
        </div>
        {accentBar && fs.accentPosition === "bottom" && <div style={accentBar} />}
      </div>
    </div>
  );
}

export function StylePanel({
  fields,
  settings,
  setSettings,
  hidePreview = false,
}: {
  fields: LpFormField[];
  settings: LpFormSettings;
  setSettings: React.Dispatch<React.SetStateAction<LpFormSettings>>;
  hidePreview?: boolean;
}) {
  const st = settings.style ?? {};
  const fs = getFormStyle(settings);

  function patchStyle(partial: Partial<LpFormStyle>) {
    setSettings((s) => ({ ...s, style: { ...(s.style ?? {}), ...partial } }));
  }

  const displayStyle = settings.display_style ?? "static";
  const widget: LpFormWidget = settings.widget ?? {
    enabled: true, position: "bottom-right", button_color: "#4f46e5",
    button_icon: "📋", button_shape: "round", button_size: "md", button_shadow: true, destination: "form",
  };
  function patchWidget(partial: Partial<LpFormWidget>) {
    setSettings((s) => ({ ...s, widget: { ...widget, ...partial } }));
  }
  const PRESET_COLORS_STYLE = ["#4f46e5", "#16a34a", "#dc2626", "#ea580c", "#0891b2", "#7c3aed", "#db2777", "#1d4ed8"];

  const titleEnabled = st.title !== undefined;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Sticky live preview (hidden when rendered externally) ── */}
      {!hidePreview && (
        <div className="shrink-0 border-b border-border bg-muted">
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-muted">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400/60" />
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400/60" />
            <div className="w-1.5 h-1.5 rounded-full bg-green-400/60" />
            <span className="text-[9px] text-muted-foreground ml-1">Preview ao vivo</span>
          </div>
          <div className="p-3">
            <StyleFormPreview fields={fields} settings={settings} />
          </div>
        </div>
      )}

      {/* ── Sub-tabs (shadcn Tabs) ── */}
      <Tabs defaultValue="exibicao" className="flex flex-col flex-1 min-h-0">
        <TabsList className="h-auto bg-transparent border-b border-border rounded-none px-2 shrink-0 gap-0 justify-start">
          {([
            { value: "exibicao", label: "Exibição" },
            { value: "cabecalho", label: "Cabeçalho" },
            { value: "campos", label: "Campos" },
            { value: "botao", label: "Botão" },
            { value: "detalhes", label: "Detalhes" },
          ]).map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 text-xs font-medium whitespace-nowrap"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ══ EXIBIÇÃO ══ */}
        <TabsContent value="exibicao" className="flex-1 overflow-y-auto p-4 space-y-6 mt-0">

      {/* ── Design (skin) ── */}
      <div className="border border-border rounded-[4px] overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border bg-muted">
          <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">Design</p>
        </div>
        <div className="px-3 py-3">
          <div className="grid grid-cols-3 gap-2">
            {FORM_SKINS.map((skin) => (
              <button
                key={skin.key}
                onClick={() => patchStyle({ form_skin: skin.key })}
                title={skin.label}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-2 rounded-[4px] border-2 transition-all",
                  (st.form_skin ?? "default") === skin.key
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40"
                )}
              >
                <span
                  className="w-full h-8 rounded-[2px] flex items-center justify-center overflow-hidden"
                  style={{ background: skin.thumb.wrap }}
                >
                  <span className="w-3/5 h-2 rounded-[1px]" style={{ background: skin.thumb.input }} />
                  <span className="w-2 h-2 rounded-full ml-1" style={{ background: skin.thumb.btn }} />
                </span>
                <span className="text-[10px] font-semibold text-foreground">{skin.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
            Escolhe uma versão pronta pro formulário. As cores e fontes customizadas abaixo são aplicadas por cima.
          </p>
        </div>
      </div>

      {/* ── Fundo do formulário ── */}
      <div className="border border-border rounded-[4px] overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border bg-muted">
          <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">Fundo do formulário</p>
        </div>
        <div className="px-3 py-3 space-y-6">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Cor de fundo</label>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSettings((s) => { const { bg_color: _, ...rest } = s.style ?? {}; return { ...s, style: rest }; })}
                title="Padrão (transparente)"
                className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center text-[8px] text-muted-foreground bg-card transition-all", !st.bg_color ? "border-foreground scale-110" : "border-border")}
              >
                A
              </button>
              {['#ffffff', '#f8f9fa', '#f1f5f9', '#0f172a', '#09090b', '#fefce8'].map((c) => (
                <button
                  key={c}
                  onClick={() => patchStyle({ bg_color: c })}
                  style={{ background: c }}
                  className={cn("w-6 h-6 rounded-full border-2 transition-all", st.bg_color === c ? "border-foreground scale-110" : "border-border")}
                />
              ))}
              <input type="color" value={st.bg_color ?? '#ffffff'} onChange={(e) => patchStyle({ bg_color: e.target.value })} className="w-6 h-6 rounded-full border-2 border-border cursor-pointer bg-transparent" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Modo da Página ── */}
      <div className="border border-border rounded-[4px] overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border bg-muted">
          <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">Modo da Página</p>
        </div>
        <div className="px-3 py-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => patchStyle({ page_mode: 'light' })}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-[4px] border-2 transition-all text-xs font-semibold",
                (!st.page_mode || st.page_mode === 'light')
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              <span className="text-lg">☀️</span>
              Claro
            </button>
            <button
              onClick={() => patchStyle({ page_mode: 'dark' })}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-[4px] border-2 transition-all text-xs font-semibold",
                st.page_mode === 'dark'
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              <span className="text-lg">🌙</span>
              Escuro
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
            Define o tema base da página pública. As cores customizadas abaixo são aplicadas por cima.
          </p>
        </div>
      </div>

      {/* ── Modo de exibição ── */}
      <div className="border border-border rounded-[4px] overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border bg-muted">
          <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">Modo de exibição</p>
        </div>
        <div className="px-3 py-3 space-y-6">
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { key: "static"     as const, label: "Estático",  icon: <Monitor className="w-3.5 h-3.5" /> },
              { key: "fullscreen" as const, label: "Fullscreen", icon: <Layers className="w-3.5 h-3.5" /> },
              { key: "floating"   as const, label: "Flutuante",  icon: <MousePointerClick className="w-3.5 h-3.5" /> },
            ] as const).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setSettings((s) => ({ ...s, display_style: key }))}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-2.5 text-[10px] font-semibold rounded-[4px] border transition-colors",
                  displayStyle === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {/* Floating FAB customization */}
          {displayStyle === "floating" && (
            <div className="space-y-6 pt-1">
              {/* Posição */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-semibold">Posição</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {([{ v: "bottom-right" as const, label: "↘ Direita" }, { v: "bottom-left" as const, label: "↙ Esquerda" }] as const).map(({ v, label }) => (
                    <button key={v} onClick={() => patchWidget({ position: v })}
                      className={cn("text-xs px-2 py-2 rounded-[4px] border text-center font-medium transition-colors", widget.position === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50")}
                    >{label}</button>
                  ))}
                </div>
              </div>
              {/* Formato */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-semibold">Formato</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {([{ v: "round" as const, label: "● Redondo" }, { v: "pill" as const, label: "⬭ Pílula" }] as const).map(({ v, label }) => (
                    <button key={v} onClick={() => patchWidget({ button_shape: v })}
                      className={cn("text-xs px-2 py-2 rounded-[4px] border text-center font-medium transition-colors", (widget.button_shape ?? "round") === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50")}
                    >{label}</button>
                  ))}
                </div>
              </div>
              {/* Ícone (round) ou Texto (pill) */}
              {(widget.button_shape ?? "round") === "round" ? (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-semibold">Ícone</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {["💬", "⚡", "📋", "📞", "🎯", "✉️", "🚀", "💡", "🎁", "👋"].map((emoji) => (
                      <button key={emoji} onClick={() => patchWidget({ button_icon: emoji })}
                        className={cn("h-9 text-lg flex items-center justify-center rounded-[4px] border transition-colors", (widget.button_icon ?? "📋") === emoji ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")}
                      >{emoji}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-semibold">Texto do botão</label>
                  <Input value={widget.button_label ?? "Fale conosco"} onChange={(e) => patchWidget({ button_label: e.target.value })} placeholder="Fale conosco" className="h-[30px] text-sm rounded-[4px]" />
                </div>
              )}
              {/* Cor */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-semibold">Cor</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS_STYLE.map((c) => (
                    <button key={c} onClick={() => patchWidget({ button_color: c })} style={{ background: c }}
                      className={cn("w-6 h-6 rounded-full border-2 transition-all", widget.button_color === c ? "border-foreground scale-110" : "border-transparent")} />
                  ))}
                  <input type="color" value={widget.button_color ?? "#4f46e5"} onChange={(e) => patchWidget({ button_color: e.target.value })} className="w-6 h-6 rounded-full border-2 border-border cursor-pointer bg-transparent" />
                </div>
              </div>
              {/* Sombra */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground font-semibold">Sombra</label>
                <Switch checked={widget.button_shadow !== false} onCheckedChange={(v) => patchWidget({ button_shadow: v })} className="scale-75" />
              </div>
            </div>
          )}

          {/* Fullscreen hint */}
          {displayStyle === "fullscreen" && (
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              O formulário abrirá como um modal cobrindo a tela quando ativado.
            </p>
          )}
        </div>
      </div>

        </TabsContent>

        {/* ══ CABEÇALHO ══ */}
        <TabsContent value="cabecalho" className="flex-1 overflow-y-auto p-4 space-y-6 mt-0">

      {/* ── Cabeçalho ── */}
      <div className="border border-border rounded-[4px] overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border bg-muted">
          <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">Cabeçalho</p>
        </div>
        <div className="px-3 py-3 space-y-6">

          {/* Switch exibir título */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">Exibir título</label>
            <Switch
              checked={titleEnabled}
              onCheckedChange={(v) => {
                if (v) {
                  patchStyle({ title: '' });
                } else {
                  setSettings((s) => {
                    const { title: _t, subtitle: _s, title_align: _ta, title_font: _tf, title_size: _ts, title_weight: _tw, title_color: _tc, subtitle_color: _sc, subtitle_size: _ss, ...rest } = s.style ?? {};
                    void _t; void _s; void _ta; void _tf; void _ts; void _tw; void _tc; void _sc; void _ss;
                    return { ...s, style: rest };
                  });
                }
              }}
              className="scale-75"
            />
          </div>

          {titleEnabled && (
            <>
              {/* Título */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Título</label>
                <Input
                  value={st.title ?? ''}
                  onChange={(e) => patchStyle({ title: e.target.value })}
                  placeholder="Preencha o formulário"
                  className="h-[30px] text-sm rounded-[4px]"
                />
              </div>

              {/* Tamanho do título */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-semibold">Tamanho</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {([ { key: 'sm' as const, label: 'P' }, { key: 'md' as const, label: 'M' }, { key: 'lg' as const, label: 'G' }, { key: 'xl' as const, label: 'XG' } ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => patchStyle({ title_size: key })}
                      className={cn(
                        "py-1.5 text-xs font-bold rounded-[4px] border transition-colors",
                        (st.title_size ?? 'md') === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Peso do título */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-semibold">Peso</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { key: 'normal'    as const, label: 'Regular' },
                    { key: 'semibold'  as const, label: 'Semi'    },
                    { key: 'bold'      as const, label: 'Bold'    },
                    { key: 'extrabold' as const, label: 'Extra'   },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => patchStyle({ title_weight: key })}
                      className={cn(
                        "py-1.5 text-[10px] rounded-[4px] border transition-colors",
                        (st.title_weight ?? 'bold') === key ? "border-primary bg-primary/10 text-primary font-bold" : "border-border text-muted-foreground hover:border-primary/50"
                      )}
                      style={{ fontWeight: WEIGHT_MAP[key] }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fonte */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-semibold">Fonte</label>
                <Select value={st.title_font ?? 'sans'} onValueChange={(v) => patchStyle({ title_font: v })}>
                  <SelectTrigger className="h-[30px] text-xs rounded-[4px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{FONT_OPTIONS.map(({ key, label }) => <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Cor do título */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-semibold">Cor</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {['#000000', '#1e293b', '#374151', '#6366f1', '#dc2626', '#ffffff'].map((c) => (
                    <button
                      key={c}
                      onClick={() => patchStyle({ title_color: c })}
                      style={{ background: c }}
                      className={cn("w-6 h-6 rounded-full border-2 transition-all", st.title_color === c ? "border-foreground scale-110" : "border-border")}
                    />
                  ))}
                  <input type="color" value={st.title_color ?? '#000000'} onChange={(e) => patchStyle({ title_color: e.target.value })} className="w-6 h-6 rounded-full border-2 border-border cursor-pointer bg-transparent" />
                </div>
              </div>

              {/* Alinhamento */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-semibold">Alinhamento</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { key: 'left' as const,   icon: <AlignLeft className="w-3.5 h-3.5" /> },
                    { key: 'center' as const, icon: <AlignCenter className="w-3.5 h-3.5" /> },
                    { key: 'right' as const,  icon: <AlignRight className="w-3.5 h-3.5" /> },
                  ] as const).map(({ key, icon }) => (
                    <button
                      key={key}
                      onClick={() => patchStyle({ title_align: key })}
                      className={cn(
                        "py-1.5 flex items-center justify-center rounded-[4px] border transition-colors",
                        (st.title_align ?? 'left') === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtítulo */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Subtítulo (opcional)</label>
                <Textarea
                  value={st.subtitle ?? ''}
                  onChange={(e) => patchStyle({ subtitle: e.target.value })}
                  placeholder="Breve descrição..."
                  className="text-sm rounded-[4px] resize-none"
                  rows={2}
                />
              </div>

              {(st.subtitle !== undefined && st.subtitle !== '') && (
                <>
                  {/* Tamanho do subtítulo */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-semibold">Tamanho do subtítulo</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([
                        { key: 'sm' as const, label: 'Pequeno' },
                        { key: 'md' as const, label: 'Médio'   },
                        { key: 'lg' as const, label: 'Grande'  },
                      ] as const).map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => patchStyle({ subtitle_size: key })}
                          className={cn(
                            "py-1.5 text-[10px] font-medium rounded-[4px] border transition-colors",
                            (st.subtitle_size ?? 'sm') === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cor do subtítulo */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-semibold">Cor do subtítulo</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {['#374151', '#6b7280', '#94a3b8', '#6366f1', '#16a34a', '#ffffff'].map((c) => (
                        <button
                          key={c}
                          onClick={() => patchStyle({ subtitle_color: c })}
                          style={{ background: c }}
                          className={cn("w-6 h-6 rounded-full border-2 transition-all", st.subtitle_color === c ? "border-foreground scale-110" : "border-border")}
                        />
                      ))}
                      <input type="color" value={st.subtitle_color ?? '#374151'} onChange={(e) => patchStyle({ subtitle_color: e.target.value })} className="w-6 h-6 rounded-full border-2 border-border cursor-pointer bg-transparent" />
                    </div>
                  </div>
                </>
              )}

            </>
          )}
        </div>
      </div>

        </TabsContent>

        {/* ══ CAMPOS ══ */}
        <TabsContent value="campos" className="flex-1 overflow-y-auto p-4 space-y-6 mt-0">

      {/* ── Campos ── */}
      <div className="border border-border rounded-[4px] overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border bg-muted">
          <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">Campos</p>
        </div>
        <div className="px-3 py-3 space-y-6">

          {/* Cor dos labels */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Cor dos labels</label>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSettings((s) => { const { label_color: _, ...rest } = s.style ?? {}; return { ...s, style: rest }; })}
                title="Padrão"
                className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center text-[8px] text-muted-foreground bg-card transition-all", !st.label_color ? "border-foreground scale-110" : "border-border")}
              >
                A
              </button>
              {['#111827', '#374151', '#6b7280', '#4f46e5', '#ffffff', '#94a3b8'].map((c) => (
                <button
                  key={c}
                  onClick={() => patchStyle({ label_color: c })}
                  style={{ background: c }}
                  className={cn("w-6 h-6 rounded-full border-2 transition-all", st.label_color === c ? "border-foreground scale-110" : "border-border")}
                />
              ))}
              <input type="color" value={st.label_color ?? '#374151'} onChange={(e) => patchStyle({ label_color: e.target.value })} className="w-6 h-6 rounded-full border-2 border-border cursor-pointer bg-transparent" />
            </div>
          </div>

          {/* Fonte dos labels */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Fonte dos labels</label>
            <Select value={st.label_font ?? 'sans'} onValueChange={(v) => patchStyle({ label_font: v })}>
              <SelectTrigger className="h-[30px] text-xs rounded-[4px]"><SelectValue /></SelectTrigger>
              <SelectContent>{FONT_OPTIONS.map(({ key, label }) => <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Peso dos labels */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Peso dos labels</label>
            <div className="grid grid-cols-4 gap-1.5">
              {([
                { key: 'normal'    as const, label: 'Regular' },
                { key: 'semibold'  as const, label: 'Semi'    },
                { key: 'bold'      as const, label: 'Bold'    },
                { key: 'extrabold' as const, label: 'Extra'   },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => patchStyle({ label_weight: key })}
                  className={cn(
                    "py-1.5 text-[10px] rounded-[4px] border transition-colors",
                    (st.label_weight ?? 'semibold') === key ? "border-primary bg-primary/10 text-primary font-bold" : "border-border text-muted-foreground hover:border-primary/50"
                  )}
                  style={{ fontWeight: WEIGHT_MAP[key] }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tamanho dos labels */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Tamanho dos labels</label>
            <div className="grid grid-cols-3 gap-1.5">
              {([ { key: 'sm' as const, label: 'P' }, { key: 'md' as const, label: 'M' }, { key: 'lg' as const, label: 'G' } ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => patchStyle({ label_size: key })}
                  className={cn(
                    "py-1.5 text-xs font-bold rounded-[4px] border transition-colors",
                    (st.label_size ?? 'md') === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Fundo dos campos */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Fundo dos campos</label>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSettings((s) => { const { input_bg_color: _, ...rest } = s.style ?? {}; return { ...s, style: rest }; })}
                title="Padrão"
                className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center text-[8px] text-muted-foreground bg-card transition-all", !st.input_bg_color ? "border-foreground scale-110" : "border-border")}
              >A</button>
              {['#ffffff', '#f8f9fa', '#f1f5f9', '#0f172a', '#18181b', 'transparent'].map((c) => (
                <button key={c} onClick={() => patchStyle({ input_bg_color: c })}
                  style={{ background: c === 'transparent' ? 'repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 0 0 / 8px 8px' : c }}
                  className={cn("w-6 h-6 rounded-full border-2 transition-all", st.input_bg_color === c ? "border-foreground scale-110" : "border-border")}
                  title={c === 'transparent' ? 'Transparente' : c}
                />
              ))}
              <input type="color" value={st.input_bg_color ?? '#ffffff'} onChange={(e) => patchStyle({ input_bg_color: e.target.value })} className="w-6 h-6 rounded-full border-2 border-border cursor-pointer bg-transparent" />
            </div>
          </div>

          {/* Cor do outline */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Cor do outline</label>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSettings((s) => { const { input_border_color: _, input_border_width: __, ...rest } = s.style ?? {}; return { ...s, style: rest }; })}
                title="Padrão"
                className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center text-[8px] text-muted-foreground bg-card transition-all", !st.input_border_color ? "border-foreground scale-110" : "border-border")}
              >A</button>
              {['#e2e8f0', '#d1d5db', '#6366f1', '#16a34a', '#dc2626', '#0891b2', '#f59e0b', '#000000'].map((c) => (
                <button key={c} onClick={() => patchStyle({ input_border_color: c })}
                  style={{ background: c }}
                  className={cn("w-6 h-6 rounded-full border-2 transition-all", st.input_border_color === c ? "border-foreground scale-110" : "border-border")}
                />
              ))}
              <input type="color" value={st.input_border_color ?? '#e2e8f0'} onChange={(e) => patchStyle({ input_border_color: e.target.value })} className="w-6 h-6 rounded-full border-2 border-border cursor-pointer bg-transparent" />
            </div>
          </div>

          {/* Espessura do outline */}
          {st.input_border_color && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-semibold">Espessura do outline</label>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { key: 'thin'   as const, label: 'Fina',   w: '1px'   },
                  { key: 'normal' as const, label: 'Normal', w: '1.5px' },
                  { key: 'thick'  as const, label: 'Grossa', w: '2.5px' },
                ] as const).map(({ key, label, w }) => (
                  <button key={key} onClick={() => patchStyle({ input_border_width: key })}
                    className={cn("flex flex-col items-center gap-1 py-1.5 rounded-[4px] border transition-colors",
                      (st.input_border_width ?? 'normal') === key ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="w-8 rounded-full" style={{ height: w, backgroundColor: st.input_border_color ?? '#e2e8f0' }} />
                    <span className={cn("text-[9px] font-semibold", (st.input_border_width ?? 'normal') === key ? "text-primary" : "text-muted-foreground")}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cor do texto dos campos */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Cor do texto</label>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSettings((s) => { const { input_text_color: _, ...rest } = s.style ?? {}; return { ...s, style: rest }; })}
                title="Padrão"
                className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center text-[8px] text-muted-foreground bg-card transition-all", !st.input_text_color ? "border-foreground scale-110" : "border-border")}
              >A</button>
              {['#111827', '#374151', '#ffffff', '#94a3b8', '#f1f5f9', '#6366f1'].map((c) => (
                <button key={c} onClick={() => patchStyle({ input_text_color: c })}
                  style={{ background: c }}
                  className={cn("w-6 h-6 rounded-full border-2 transition-all", st.input_text_color === c ? "border-foreground scale-110" : "border-border")}
                />
              ))}
              <input type="color" value={st.input_text_color ?? '#111827'} onChange={(e) => patchStyle({ input_text_color: e.target.value })} className="w-6 h-6 rounded-full border-2 border-border cursor-pointer bg-transparent" />
            </div>
          </div>

          {/* Fonte dos campos */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Fonte dos campos</label>
            <Select value={st.input_font ?? 'sans'} onValueChange={(v) => patchStyle({ input_font: v })}>
              <SelectTrigger className="h-[30px] text-xs rounded-[4px]"><SelectValue /></SelectTrigger>
              <SelectContent>{FONT_OPTIONS.map(({ key, label }) => <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Peso dos campos */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Peso dos campos</label>
            <div className="grid grid-cols-4 gap-1.5">
              {([
                { key: 'normal'    as const, label: 'Regular' },
                { key: 'semibold'  as const, label: 'Semi'    },
                { key: 'bold'      as const, label: 'Bold'    },
                { key: 'extrabold' as const, label: 'Extra'   },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => patchStyle({ input_font_weight: key })}
                  className={cn(
                    "py-1.5 text-[10px] rounded-[4px] border transition-colors",
                    (st.input_font_weight ?? 'normal') === key ? "border-primary bg-primary/10 text-primary font-bold" : "border-border text-muted-foreground hover:border-primary/50"
                  )}
                  style={{ fontWeight: WEIGHT_MAP[key] }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Altura dos campos */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Altura dos campos</label>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { key: 'sm' as const, label: 'Compacto', py: '7px'  },
                { key: 'md' as const, label: 'Normal',   py: '10px' },
                { key: 'lg' as const, label: 'Espaçoso', py: '14px' },
              ] as const).map(({ key, label, py }) => {
                const isActive = (st.input_size ?? 'md') === key;
                return (
                  <button
                    key={key}
                    onClick={() => patchStyle({ input_size: key })}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-[4px] border p-2 transition-colors",
                      isActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="w-full border rounded-[2px] bg-background/50 transition-all" style={{ borderColor: isActive ? 'hsl(var(--primary))' : 'hsl(var(--border))', paddingTop: `calc(${py} * 0.5)`, paddingBottom: `calc(${py} * 0.5)` }} />
                    <span className={cn("text-[9px] font-semibold", isActive ? "text-primary" : "text-muted-foreground")}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cantos dos campos */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Cantos dos campos</label>
            <div className="grid grid-cols-4 gap-1.5">
              {([
                { key: 'none' as const, label: 'Quadrado' },
                { key: 'sm'   as const, label: 'Suave' },
                { key: 'md'   as const, label: 'Médio' },
                { key: 'full' as const, label: 'Pílula' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => patchStyle({ input_radius: key })}
                  className={cn(
                    "py-1.5 text-[10px] font-medium rounded-[4px] border transition-colors",
                    (st.input_radius ?? 'sm') === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Espaçamento entre campos */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Espaçamento entre campos</label>
            <div className="grid grid-cols-4 gap-1.5">
              {([
                { key: 'compact' as const, label: 'Compacto' },
                { key: 'normal'  as const, label: 'Normal'   },
                { key: 'relaxed' as const, label: 'Espaçado' },
                { key: 'loose'   as const, label: 'Muito'    },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => patchStyle({ field_gap: key })}
                  className={cn(
                    "py-1.5 text-[10px] font-medium rounded-[4px] border transition-colors",
                    (st.field_gap ?? 'normal') === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

        </TabsContent>

        {/* ══ BOTÃO ══ */}
        <TabsContent value="botao" className="flex-1 overflow-y-auto p-4 space-y-6 mt-0">

      {/* ── Botão ── */}
      <div className="border border-border rounded-[4px] overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border bg-muted">
          <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">Botão</p>
        </div>
        <div className="px-3 py-3 space-y-6">

          {/* Cor do botão */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">{st.button_gradient ? 'Cor inicial' : 'Cor'}</label>
            <div className="flex items-center gap-2 flex-wrap">
              {['#4f46e5', '#16a34a', '#dc2626', '#ea580c', '#0891b2', '#7c3aed', '#db2777', '#111827'].map((c) => (
                <button
                  key={c}
                  onClick={() => patchStyle({ button_color: c })}
                  style={{ background: c }}
                  className={cn("w-6 h-6 rounded-full border-2 transition-all", st.button_color === c ? "border-foreground scale-110" : "border-transparent")}
                />
              ))}
              <input type="color" value={st.button_color ?? '#4f46e5'} onChange={(e) => patchStyle({ button_color: e.target.value })} className="w-6 h-6 rounded-full border-2 border-border cursor-pointer bg-transparent" />
            </div>
          </div>

          {/* Degradê no botão */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Degradê</label>
              <Switch checked={!!st.button_gradient} onCheckedChange={(v) => patchStyle({ button_gradient: v })} className="scale-75" />
            </div>
            {st.button_gradient && (
              <div className="space-y-2 pl-0.5">
                {/* Cor final */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Cor final</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['#7c3aed', '#ec4899', '#16a34a', '#dc2626', '#f59e0b', '#0891b2', '#ea580c', '#4f46e5', '#ffffff', '#000000'].map((c) => (
                      <button key={c} onClick={() => patchStyle({ button_color2: c })} style={{ background: c }}
                        className={cn("w-5 h-5 rounded-full border-2 transition-all", (st.button_color2 ?? '#7c3aed') === c ? "border-foreground scale-110" : "border-border")} />
                    ))}
                    <input type="color" value={st.button_color2 ?? '#7c3aed'} onChange={(e) => patchStyle({ button_color2: e.target.value })} className="w-5 h-5 rounded-full border-2 border-border cursor-pointer bg-transparent" />
                  </div>
                </div>
                {/* Direção */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Direção</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { key: 'right'    as const, label: '→ Horizontal' },
                      { key: 'diagonal' as const, label: '↘ Diagonal'   },
                    ] as const).map(({ key, label }) => (
                      <button key={key} onClick={() => patchStyle({ button_gradient_dir: key })}
                        className={cn("py-1.5 text-[10px] font-medium rounded-[4px] border transition-colors",
                          (st.button_gradient_dir ?? 'right') === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >{label}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cor do texto do botão */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Texto</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => patchStyle({ button_text_color: '#ffffff' })}
                className={cn("flex-1 py-1.5 text-xs rounded-[4px] border font-medium transition-colors",
                  (st.button_text_color ?? '#ffffff') === '#ffffff' ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                )}
              >
                Claro
              </button>
              <button
                onClick={() => patchStyle({ button_text_color: '#000000' })}
                className={cn("flex-1 py-1.5 text-xs rounded-[4px] border font-medium transition-colors",
                  st.button_text_color === '#000000' ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                )}
              >
                Escuro
              </button>
              <input type="color" value={st.button_text_color ?? '#ffffff'} onChange={(e) => patchStyle({ button_text_color: e.target.value })} className="w-7 h-7 rounded-full border-2 border-border cursor-pointer bg-transparent" />
            </div>
          </div>

          {/* Fonte do botão */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Fonte</label>
            <Select value={st.button_font ?? 'sans'} onValueChange={(v) => patchStyle({ button_font: v })}>
              <SelectTrigger className="h-[30px] text-xs rounded-[4px]"><SelectValue /></SelectTrigger>
              <SelectContent>{FONT_OPTIONS.map(({ key, label }) => <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Peso do botão */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Peso</label>
            <div className="grid grid-cols-4 gap-1.5">
              {([
                { key: 'normal'    as const, label: 'Regular' },
                { key: 'semibold'  as const, label: 'Semi'    },
                { key: 'bold'      as const, label: 'Bold'    },
                { key: 'extrabold' as const, label: 'Extra'   },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => patchStyle({ button_font_weight: key })}
                  className={cn(
                    "py-1.5 text-[10px] rounded-[4px] border transition-colors",
                    (st.button_font_weight ?? 'bold') === key ? "border-primary bg-primary/10 text-primary font-bold" : "border-border text-muted-foreground hover:border-primary/50"
                  )}
                  style={{ fontWeight: WEIGHT_MAP[key] }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Cantos do botão */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Cantos</label>
            <div className="grid grid-cols-4 gap-1.5">
              {([
                { key: 'none' as const, label: 'Quadrado' },
                { key: 'sm'   as const, label: 'Suave' },
                { key: 'md'   as const, label: 'Médio' },
                { key: 'full' as const, label: 'Pílula' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => patchStyle({ button_radius: key })}
                  className={cn(
                    "py-1.5 text-[10px] font-medium rounded-[4px] border transition-colors",
                    (st.button_radius ?? 'sm') === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Altura do botão */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-semibold">Altura</label>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { key: 'sm' as const, label: 'Compacto' },
                { key: 'md' as const, label: 'Normal'   },
                { key: 'lg' as const, label: 'Grande'   },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => patchStyle({ button_size: key })}
                  className={cn(
                    "py-1.5 text-[10px] font-medium rounded-[4px] border transition-colors",
                    (st.button_size ?? 'md') === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Largura total */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">Largura total</label>
            <Switch
              checked={st.button_full_width !== false}
              onCheckedChange={(v) => patchStyle({ button_full_width: v })}
              className="scale-75"
            />
          </div>

          {/* Preview do botão */}
          <div className="border border-border rounded-[4px] p-3 bg-muted">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-2">Preview</p>
            <div className={st.button_full_width !== false ? "w-full" : "inline-block"}>
              <button
                style={{
                  background: getButtonBg(fs),
                  color: st.button_text_color ?? '#ffffff',
                  borderRadius: RADIUS_MAP[st.button_radius ?? 'sm'],
                  width: st.button_full_width !== false ? '100%' : 'auto',
                  paddingTop: BTN_SIZE_MAP[st.button_size ?? 'md'].py,
                  paddingBottom: BTN_SIZE_MAP[st.button_size ?? 'md'].py,
                  paddingLeft: '1rem',
                  paddingRight: '1rem',
                  fontSize: BTN_SIZE_MAP[st.button_size ?? 'md'].fs,
                  fontFamily: fs.buttonFont,
                  fontWeight: fs.buttonFontWeight,
                }}
                className="cursor-default"
              >
                {settings.submit_text || "Enviar"}
              </button>
            </div>
          </div>

        </div>
      </div>

        </TabsContent>

        {/* ══ DETALHES ══ */}
        <TabsContent value="detalhes" className="flex-1 overflow-y-auto p-4 space-y-6 mt-0">

      {/* ── Detalhes ── */}
      <div className="border border-border rounded-[4px] overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border bg-muted">
          <p className="text-[10px] font-bold text-foreground uppercase tracking-wide">Detalhes</p>
        </div>
        <div className="px-3 py-3 space-y-6">

          {/* Linha decorativa */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Linha decorativa</label>
              <Switch
                checked={!!st.accent_color}
                onCheckedChange={(v) => {
                  if (v) patchStyle({ accent_color: '#4f46e5', accent_type: 'solid', accent_width: 'normal', accent_position: 'top' });
                  else setSettings((s) => {
                    const { accent_color: _a, accent_type: _at, accent_color2: _a2, accent_width: _aw, accent_position: _ap, ...rest } = s.style ?? {};
                    void _a; void _at; void _a2; void _aw; void _ap;
                    return { ...s, style: rest };
                  });
                }}
                className="scale-75"
              />
            </div>

            {st.accent_color && (
              <div className="space-y-2.5 pl-0.5">
                {/* Tipo */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Tipo</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { key: 'solid'    as const, label: 'Sólida'   },
                      { key: 'gradient' as const, label: 'Degradê'  },
                      { key: 'animated' as const, label: 'Animada ✨' },
                    ] as const).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => patchStyle({ accent_type: key })}
                        className={cn(
                          "py-1.5 text-[9px] font-semibold rounded-[4px] border transition-colors",
                          (st.accent_type ?? 'solid') === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cor 1 */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                    {(st.accent_type ?? 'solid') === 'solid' ? 'Cor' : 'Cor inicial'}
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['#4f46e5', '#7c3aed', '#ec4899', '#16a34a', '#dc2626', '#ea580c', '#0891b2', '#f59e0b', '#ffffff', '#000000'].map((c) => (
                      <button key={c} onClick={() => patchStyle({ accent_color: c })} style={{ background: c }}
                        className={cn("w-5 h-5 rounded-full border-2 transition-all", st.accent_color === c ? "border-foreground scale-110" : "border-border")} />
                    ))}
                    <input type="color" value={st.accent_color ?? '#4f46e5'} onChange={(e) => patchStyle({ accent_color: e.target.value })} className="w-5 h-5 rounded-full border-2 border-border cursor-pointer bg-transparent" />
                  </div>
                </div>

                {/* Cor 2 (gradient/animated) */}
                {(st.accent_type === 'gradient' || st.accent_type === 'animated') && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Cor final</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {['#7c3aed', '#ec4899', '#16a34a', '#dc2626', '#ea580c', '#0891b2', '#f59e0b', '#4f46e5', '#ffffff', '#000000'].map((c) => (
                        <button key={c} onClick={() => patchStyle({ accent_color2: c })} style={{ background: c }}
                          className={cn("w-5 h-5 rounded-full border-2 transition-all", (st.accent_color2 ?? '#7c3aed') === c ? "border-foreground scale-110" : "border-border")} />
                      ))}
                      <input type="color" value={st.accent_color2 ?? '#7c3aed'} onChange={(e) => patchStyle({ accent_color2: e.target.value })} className="w-5 h-5 rounded-full border-2 border-border cursor-pointer bg-transparent" />
                    </div>
                  </div>
                )}

                {/* Largura */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Espessura</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { key: 'thin'   as const, label: 'Fina',    h: 'h-[2px]' },
                      { key: 'normal' as const, label: 'Normal',  h: 'h-[3px]' },
                      { key: 'thick'  as const, label: 'Grossa',  h: 'h-[6px]' },
                    ] as const).map(({ key, label, h }) => (
                      <button
                        key={key}
                        onClick={() => patchStyle({ accent_width: key })}
                        className={cn(
                          "flex flex-col items-center gap-1 py-2 rounded-[4px] border transition-colors",
                          (st.accent_width ?? 'normal') === key ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className={cn("w-8 rounded-full", h)} style={{ background: st.accent_color ?? '#4f46e5' }} />
                        <span className={cn("text-[9px] font-semibold", (st.accent_width ?? 'normal') === key ? "text-primary" : "text-muted-foreground")}>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Posição */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Posição</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { key: 'top'    as const, label: '↑ Topo' },
                      { key: 'bottom' as const, label: '↓ Base' },
                    ] as const).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => patchStyle({ accent_position: key })}
                        className={cn(
                          "py-1.5 text-[10px] font-medium rounded-[4px] border transition-colors",
                          (st.accent_position ?? 'top') === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview da linha */}
                <div
                  className="rounded-[2px] transition-all"
                  style={{
                    height: ACCENT_WIDTH_MAP[st.accent_width ?? 'normal'],
                    background: (st.accent_type === 'gradient' || st.accent_type === 'animated')
                      ? `linear-gradient(90deg, ${st.accent_color}, ${st.accent_color2 ?? '#7c3aed'})`
                      : st.accent_color,
                  }}
                />
              </div>
            )}
          </div>

          {/* Divisor */}
          <div className="border-t border-border" />

          {/* Bolinha de status */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Indicador de status</label>
              <Switch
                checked={!!st.badge_enabled}
                onCheckedChange={(v) => patchStyle({ badge_enabled: v })}
                className="scale-75"
              />
            </div>

            {st.badge_enabled && (
              <div className="space-y-2.5 pl-0.5">
                {/* Texto */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Texto</label>
                  <Input
                    value={st.badge_text ?? 'Online agora'}
                    onChange={(e) => patchStyle({ badge_text: e.target.value })}
                    placeholder="Online agora"
                    className="h-[30px] text-xs rounded-[4px]"
                  />
                </div>

                {/* Ícone do indicador */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Ícone</label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {([
                      { key: 'circle' as const, label: '●'  },
                      { key: 'pulse'  as const, label: '◉'  },
                      { key: 'wave'   as const, label: '〰' },
                      { key: 'star'   as const, label: '★'  },
                      { key: 'bolt'   as const, label: '⚡' },
                      { key: 'heart'  as const, label: '♥'  },
                    ] as const).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => patchStyle({ badge_icon: key })}
                        className={cn(
                          "py-1.5 text-sm rounded-[4px] border transition-colors flex items-center justify-center",
                          (st.badge_icon ?? 'circle') === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cor da bolinha */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Cor</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4'].map((c) => (
                      <button key={c} onClick={() => patchStyle({ badge_color: c })} style={{ background: c }}
                        className={cn("w-5 h-5 rounded-full border-2 transition-all", (st.badge_color ?? '#22c55e') === c ? "border-foreground scale-110" : "border-transparent")} />
                    ))}
                    <input type="color" value={st.badge_color ?? '#22c55e'} onChange={(e) => patchStyle({ badge_color: e.target.value })} className="w-5 h-5 rounded-full border-2 border-border cursor-pointer bg-transparent" />
                  </div>
                </div>

                {/* Preview */}
                <div className="border border-border rounded-[4px] px-3 py-2 bg-muted flex justify-end">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-[2px] border border-border bg-card">
                    <BadgeIndicator icon={(st.badge_icon ?? 'circle') as 'circle' | 'pulse' | 'wave' | 'star' | 'bolt' | 'heart'} color={st.badge_color ?? '#22c55e'} size={8} />
                    {st.badge_text || 'Online agora'}
                  </span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

        </TabsContent>
      </Tabs>
    </div>
  );
}
