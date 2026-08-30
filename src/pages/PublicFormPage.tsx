import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import * as SelectPrimitive from "@radix-ui/react-select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertCircle, Send, ChevronRight, ChevronLeft, ChevronDown, ExternalLink, Check } from "lucide-react";

async function invokeSubmit(payload: Record<string, string>): Promise<SubmitResponse> {
  const { data, error } = await supabase.functions.invoke<SubmitResponse>("lp-submit", {
    body: payload,
  });

  if (error) {
    console.error("[PublicForm] invokeSubmit error:", error);
    throw new Error(error.message || "Erro desconhecido");
  }

  if (!data?.success) {
    console.error("[PublicForm] invokeSubmit logic error:", data);
    const d = data as unknown as { errors?: { _?: string }; error?: string } | null;
    throw new Error(d?.errors?._ || d?.error || "Erro desconhecido");
  }

  return data;
}
import { cn } from "@/lib/utils";
import type { LpForm, LpFormField, LpFormSettings, LpFormStyle, LpFormSuccessRoute } from "@/hooks/useLpForms";
import InlineBooking from "@/components/booking/InlineBooking";
import { RevOSLogo } from "@/components/config/assets/RevOSLogo";

// ─── Submit response from lp-submit ──────────────────────────────────────────

interface SubmitResponse {
  success: boolean;
  score: number | null;
  score_matrix_id: string | null;
  lead_id: string | null;
  person_id: string | null;
  success_route: LpFormSuccessRoute | null;
  redirect_url: string | null;
}

// ─── Style engine (mirrors LpFormBuilder) ────────────────────────────────────

const RADIUS_MAP: Record<string, string> = { none: "0px", sm: "4px", md: "8px", full: "9999px" };
const FONT_MAP: Record<string, string> = {
  sans: "system-ui,sans-serif", serif: "Georgia,serif", mono: "monospace",
  Inter: "'Inter',sans-serif", Poppins: "'Poppins',sans-serif", Roboto: "'Roboto',sans-serif",
  'Open Sans': "'Open Sans',sans-serif", Lato: "'Lato',sans-serif", Montserrat: "'Montserrat',sans-serif",
  Nunito: "'Nunito',sans-serif", Raleway: "'Raleway',sans-serif",
  'Playfair Display': "'Playfair Display',serif", Merriweather: "'Merriweather',serif",
  'Source Sans 3': "'Source Sans 3',sans-serif", 'Work Sans': "'Work Sans',sans-serif",
  'DM Sans': "'DM Sans',sans-serif", Outfit: "'Outfit',sans-serif",
  'Space Grotesk': "'Space Grotesk',sans-serif", Rubik: "'Rubik',sans-serif",
  Manrope: "'Manrope',sans-serif", 'Josefin Sans': "'Josefin Sans',sans-serif",
  Quicksand: "'Quicksand',sans-serif", Barlow: "'Barlow',sans-serif",
  'Inter Tight': "'Inter Tight',sans-serif", Fraunces: "'Fraunces',Georgia,serif",
  'JetBrains Mono': "'JetBrains Mono',ui-monospace,monospace",
};
const GOOGLE_FONT_FAMILIES = [
  'Inter', 'Poppins', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Nunito', 'Raleway',
  'Playfair Display', 'Merriweather', 'Source Sans 3', 'Work Sans', 'DM Sans', 'Outfit',
  'Space Grotesk', 'Rubik', 'Manrope', 'Josefin Sans', 'Quicksand', 'Barlow',
  'Inter Tight', 'Fraunces', 'JetBrains Mono',
];
const GOOGLE_FONTS_URL = `https://fonts.googleapis.com/css2?${GOOGLE_FONT_FAMILIES.map(f => `family=${f.replace(/ /g, '+')}:wght@400;600;700;800`).join('&')}&display=swap`;
const SIZE_MAP: Record<string, string> = { sm: "1.125rem", md: "1.625rem", lg: "2.25rem", xl: "3rem" };
const WEIGHT_MAP: Record<string, number> = { normal: 400, semibold: 600, bold: 700, extrabold: 800 };
const SUBTITLE_SIZE_MAP: Record<string, string> = { sm: "0.875rem", md: "1rem", lg: "1.125rem" };
const LABEL_SIZE_MAP: Record<string, string> = { sm: "11px", md: "13px", lg: "15px" };
const FIELD_GAP_MAP: Record<string, string> = { compact: "8px", normal: "16px", relaxed: "24px", loose: "32px" };
const INPUT_SIZE_MAP: Record<string, { py: string; px: string; fs: string }> = {
  sm: { py: "7px",  px: "12px", fs: "13px" },
  md: { py: "11px", px: "14px", fs: "14px" },
  lg: { py: "15px", px: "16px", fs: "15px" },
};
const ACCENT_WIDTH_MAP: Record<string, string> = { thin: "2px", normal: "3px", thick: "6px" };
const INPUT_BORDER_MAP: Record<string, string> = { thin: "1px", normal: "1.5px", thick: "2.5px" };
const BTN_SIZE_MAP: Record<string, { py: string; fs: string }> = {
  sm: { py: "8px",  fs: "13px" },
  md: { py: "12px", fs: "15px" },
  lg: { py: "16px", fs: "16px" },
};

const FORM_SKINS = [
  { key: "default" as const, defaults: {} },
  {
    key: "dark" as const,
    defaults: { cardBg: "#1e293b", pageBg: "#0f172a", buttonColor: "#22c55e", labelColor: "#94a3b8", bodyColor: "#f1f5f9", labelUppercase: true, inputBg: "#0f172a", inputBorder: "#334155" },
  },
  {
    key: "minimal" as const,
    defaults: { cardBg: "transparent", pageBg: "#fafafa", buttonColor: "#111827", labelColor: "#6b7280", bodyColor: "#111827", inputBg: "transparent", inputBorder: "rgba(0,0,0,0.12)", noShadow: true },
  },
  {
    key: "glass" as const,
    defaults: { cardBg: "rgba(255,255,255,0.12)", pageBg: "linear-gradient(135deg,#667eea,#764ba2)", buttonColor: "#7c3aed", labelColor: "rgba(255,255,255,0.9)", bodyColor: "#ffffff", inputBg: "rgba(255,255,255,0.08)", inputBorder: "rgba(255,255,255,0.25)", glass: true },
  },
  {
    key: "neon" as const,
    defaults: { cardBg: "#09090b", pageBg: "#09090b", buttonColor: "#7c3aed", labelColor: "#a1a1aa", bodyColor: "#fafafa", inputBg: "#18181b", inputBorder: "#3f3f46" },
  },
  {
    key: "growth_sales" as const,
    // Bone & ember on void — growthsales.ai brand system.
    defaults: {
      cardBg: "#0e0e11", pageBg: "#050507", buttonColor: "#ff3a0e",
      labelColor: "#84848c", bodyColor: "#f1f1f3",
      inputBg: "#1f1f24", inputBorder: "rgba(255,255,255,0.16)",
      buttonTextColor: "#050507",
    },
  },
] as const;

type FormSkinKey = typeof FORM_SKINS[number]["key"];

function getSkinDefaults(skin: FormSkinKey) {
  return FORM_SKINS.find((s) => s.key === skin)?.defaults ?? {};
}

// Detect if a hex color is dark (for auto text color contrast)
function isColorDark(hex: string | undefined): boolean {
  if (!hex || hex === "transparent") return false;
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.45;
}

// Dark mode base defaults (applied when page_mode='dark') — zinc/black palette
const DARK_BASE = {
  cardBg: "#18181b",
  pageBg: "#09090b",
  bodyColor: "#fafafa",
  labelColor: "#a1a1aa",
  inputBg: "#27272a",
  inputBorder: "#3f3f46",
};

function getFormStyle(s: LpFormSettings) {
  const st: LpFormStyle = s.style ?? {};
  const skin = (st.form_skin ?? "default") as FormSkinKey;
  const sd = getSkinDefaults(skin) as Record<string, unknown>;
  const isDarkMode = st.page_mode === "dark";

  // Base layer: skin defaults, boosted by dark mode if enabled
  const baseCardBg = (sd.cardBg as string | undefined) ?? (isDarkMode ? DARK_BASE.cardBg : undefined);
  const baseInputBg = (sd.inputBg as string | undefined) ?? (isDarkMode ? DARK_BASE.inputBg : undefined);
  const baseInputBorder = (sd.inputBorder as string | undefined) ?? (isDarkMode ? DARK_BASE.inputBorder : undefined);
  const baseBodyColor = (sd.bodyColor as string | undefined) ?? (isDarkMode ? DARK_BASE.bodyColor : undefined);
  const baseLabelColor = (sd.labelColor as string | undefined) ?? (isDarkMode ? DARK_BASE.labelColor : undefined);
  const basePageBg = (sd.pageBg as string | undefined) ?? (isDarkMode ? DARK_BASE.pageBg : undefined);

  // User customizations override base
  const cardBg = st.bg_color ?? baseCardBg;
  const inputBg = st.input_bg_color ?? baseInputBg;
  const glass = sd.glass as boolean | undefined;

  // Compute body text color: base bodyColor → or auto-detect from card bg
  const cardIsDark = glass || isColorDark(cardBg ?? "#ffffff");
  const computedBodyColor = baseBodyColor ?? (cardIsDark ? "#f1f5f9" : "#111827");

  // Compute input text color: explicit → or auto-detect from input bg
  const inputIsDark = inputBg ? isColorDark(inputBg) : cardIsDark;
  const computedInputTextColor = st.input_text_color ?? (inputIsDark ? "#e5e7eb" : "#111827");

  return {
    skin,
    isDark: isDarkMode || cardIsDark,
    pageBg: basePageBg,
    cardBg,
    glass,
    noShadow: sd.noShadow as boolean | undefined,
    inputRadius: RADIUS_MAP[st.input_radius ?? "sm"],
    buttonBg: st.button_color ?? (sd.buttonColor as string | undefined),
    buttonTextColor: st.button_text_color ?? (sd.buttonTextColor as string | undefined) ?? "#ffffff",
    buttonRadius: RADIUS_MAP[st.button_radius ?? "sm"],
    buttonFullWidth: st.button_full_width !== false,
    fieldGap: FIELD_GAP_MAP[st.field_gap ?? "normal"],
    labelColor: st.label_color ?? baseLabelColor ?? computedBodyColor,
    labelUppercase: sd.labelUppercase as boolean | undefined,
    bodyColor: computedBodyColor,
    title: st.title,
    subtitle: st.subtitle,
    titleAlign: (st.title_align ?? "left") as React.CSSProperties["textAlign"],
    titleFont: FONT_MAP[st.title_font ?? "sans"],
    titleSize: SIZE_MAP[st.title_size ?? "md"],
    titleColor: st.title_color ?? computedBodyColor,
    subtitleColor: st.subtitle_color ?? baseLabelColor,
    titleWeight: WEIGHT_MAP[st.title_weight ?? "bold"] ?? 700,
    subtitleSize: SUBTITLE_SIZE_MAP[st.subtitle_size ?? "sm"],
    inputSize: INPUT_SIZE_MAP[st.input_size ?? "md"],
    buttonSize: BTN_SIZE_MAP[st.button_size ?? "md"],
    inputBg,
    inputBorder: st.input_border_color ?? baseInputBorder,
    inputBorderWidth: INPUT_BORDER_MAP[st.input_border_width ?? "normal"],
    inputTextColor: computedInputTextColor,
    // Label typography
    labelFont: FONT_MAP[st.label_font ?? "sans"],
    labelWeight: WEIGHT_MAP[st.label_weight ?? "semibold"] ?? 600,
    labelSize: LABEL_SIZE_MAP[st.label_size ?? "md"],
    // Input typography
    inputFont: FONT_MAP[st.input_font ?? "sans"],
    inputFontWeight: WEIGHT_MAP[st.input_font_weight ?? "normal"] ?? 400,
    // Button typography
    buttonFont: FONT_MAP[st.button_font ?? "sans"],
    buttonFontWeight: WEIGHT_MAP[st.button_font_weight ?? "bold"] ?? 700,
    buttonGradient: st.button_gradient ?? false,
    buttonColor2: st.button_color2 ?? "#7c3aed",
    buttonGradientDir: (st.button_gradient_dir ?? "right") as "right" | "diagonal",
    accentColor: st.accent_color,
    accentType: (st.accent_type ?? "solid") as "solid" | "gradient" | "animated",
    accentColor2: st.accent_color2 ?? "#7c3aed",
    accentWidth: ACCENT_WIDTH_MAP[st.accent_width ?? "normal"],
    accentPosition: (st.accent_position ?? "top") as "top" | "bottom",
    badgeEnabled: st.badge_enabled ?? false,
    badgeColor: st.badge_color ?? "#22c55e",
    badgeText: st.badge_text ?? "Online agora",
    badgeIcon: (st.badge_icon ?? "circle") as "circle" | "pulse" | "wave" | "star" | "bolt" | "heart",
  };
}

function getButtonBg(fs: ReturnType<typeof getFormStyle>): string {
  const base = fs.buttonBg ?? "hsl(var(--primary))";
  if (fs.buttonGradient && fs.buttonBg) {
    const angle = fs.buttonGradientDir === "diagonal" ? "135deg" : "90deg";
    return `linear-gradient(${angle}, ${base}, ${fs.buttonColor2})`;
  }
  return base;
}

// Wrapper that hides native arrow and shows a clean custom one
function SelectWrap({
  children,
  arrowColor,
  style,
}: {
  children: React.ReactNode;
  arrowColor?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ position: "relative", display: "block", ...style }}>
      {children}
      <ChevronDown
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          width: 15,
          height: 15,
          color: arrowColor ?? "#6b7280",
          pointerEvents: "none",
          flexShrink: 0,
        }}
      />
    </div>
  );
}

// Radix Select's popup is portaled DOM, not the OS-native listbox — so it can
// actually inherit the form's theme colors, unlike a plain <select> (whose
// open dropdown is OS chrome no CSS can reach). Highlighted-item background
// uses a CSS var set inline per-instance since Radix's [data-highlighted]
// state can't be targeted from inline styles alone.
if (typeof document !== "undefined" && !document.querySelector("style[data-themed-select]")) {
  const style = document.createElement("style");
  style.setAttribute("data-themed-select", "1");
  style.textContent = `[data-radix-select-item][data-highlighted] { background: var(--ts-accent, rgba(127,127,127,0.12)) !important; outline: none; }`;
  document.head.appendChild(style);
}

function ThemedSelect({
  value,
  onChange,
  options,
  placeholder,
  fs,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  fs: ReturnType<typeof getFormStyle>;
  error?: boolean;
}) {
  const accent = fs.buttonBg ?? "#3b82f6";
  const selected = options.find((o) => o.value === value);

  const triggerStyle: React.CSSProperties = {
    borderRadius: fs.inputRadius,
    backgroundColor: fs.inputBg ?? undefined,
    borderColor: error ? "#ef4444" : (fs.inputBorder ?? undefined),
    borderWidth: fs.inputBorder ? fs.inputBorderWidth : "1px",
    borderStyle: "solid",
    color: selected ? fs.inputTextColor : (fs.labelColor ?? "#9ca3af"),
    paddingTop: fs.inputSize.py,
    paddingBottom: fs.inputSize.py,
    paddingLeft: fs.inputSize.px,
    paddingRight: fs.inputSize.px,
    fontSize: fs.inputSize.fs,
    fontFamily: fs.inputFont,
    fontWeight: fs.inputFontWeight,
    width: "100%",
    outline: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    cursor: "pointer",
    boxSizing: "border-box",
  };

  return (
    <SelectPrimitive.Root value={value || undefined} onValueChange={onChange}>
      <SelectPrimitive.Trigger style={triggerStyle} className={error ? "border border-red-400" : undefined}>
        <SelectPrimitive.Value placeholder={placeholder ?? "Selecione..."} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown style={{ width: 15, height: 15, color: fs.labelColor ?? "#6b7280", flexShrink: 0 }} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          style={{
            ["--ts-accent" as string]: `${accent}22`,
            zIndex: 9999,
            overflow: "hidden",
            borderRadius: fs.inputRadius,
            border: `1px solid ${fs.inputBorder ?? "#e5e7eb"}`,
            background: fs.inputBg ?? (fs.isDark ? "#18181b" : "#ffffff"),
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            width: "var(--radix-select-trigger-width)",
            maxHeight: "min(320px, var(--radix-select-content-available-height))",
          }}
        >
          <SelectPrimitive.Viewport style={{ padding: 4 }}>
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "9px 10px",
                  borderRadius: fs.inputRadius,
                  fontSize: fs.inputSize.fs,
                  fontFamily: fs.inputFont,
                  color: fs.inputTextColor,
                  cursor: "pointer",
                }}
              >
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator>
                  <Check style={{ width: 14, height: 14, color: accent, flexShrink: 0 }} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function getAccentBarStyle(fs: ReturnType<typeof getFormStyle>): React.CSSProperties | null {
  if (!fs.accentColor) return null;
  const base: React.CSSProperties = { height: fs.accentWidth, flexShrink: 0, display: "block" };
  if (fs.accentType === "animated") {
    return {
      ...base,
      backgroundImage: `linear-gradient(90deg, ${fs.accentColor}, ${fs.accentColor2}, ${fs.accentColor})`,
      backgroundSize: "200% 100%",
      animation: "accent-shimmer 2s ease-in-out infinite",
    };
  }
  if (fs.accentType === "gradient") {
    return { ...base, backgroundImage: `linear-gradient(90deg, ${fs.accentColor}, ${fs.accentColor2})` };
  }
  return { ...base, backgroundColor: fs.accentColor };
}

// ─── Badge indicator component ───────────────────────────────────────────────

function BadgeIndicator({ icon, color, size = 7 }: { icon: string; color: string; size?: number }) {
  const s = size;
  switch (icon) {
    case "pulse":
      return (
        <span style={{ position: "relative", display: "inline-flex", width: s, height: s, flexShrink: 0 }}>
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", backgroundColor: color, animation: "badge-ping 1.2s cubic-bezier(0,0,0.2,1) infinite", opacity: 0.5 }} />
          <span style={{ position: "relative", width: s, height: s, borderRadius: "50%", backgroundColor: color }} />
        </span>
      );
    case "wave":
      return <span style={{ color, fontSize: s * 1.3, lineHeight: 1, flexShrink: 0, animation: "badge-pulse 1.5s ease-in-out infinite" }}>〰</span>;
    case "star":
      return <span style={{ color, fontSize: s * 1.3, lineHeight: 1, flexShrink: 0, animation: "badge-pulse 1.5s ease-in-out infinite" }}>★</span>;
    case "bolt":
      return <span style={{ color, fontSize: s * 1.3, lineHeight: 1, flexShrink: 0, animation: "badge-pulse 1.5s ease-in-out infinite" }}>⚡</span>;
    case "heart":
      return <span style={{ color, fontSize: s * 1.3, lineHeight: 1, flexShrink: 0, animation: "badge-pulse 1.5s ease-in-out infinite" }}>♥</span>;
    default:
      return <span style={{ width: s, height: s, borderRadius: "50%", backgroundColor: color, flexShrink: 0, animation: "badge-pulse 1.5s ease-in-out infinite" }} />;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicSettings {
  company_name: string;
  logo_url: string | null;
  primary_color: string | null;
}

// ─── Country codes ─────────────────────────────────────────────────────────────

const COUNTRY_FLAGS: Record<string, string> = {
  BR: "🇧🇷", US: "🇺🇸", PT: "🇵🇹", ES: "🇪🇸", AR: "🇦🇷",
  MX: "🇲🇽", CO: "🇨🇴", CL: "🇨🇱", PE: "🇵🇪", UY: "🇺🇾",
};
const COUNTRY_CODES: Record<string, string> = {
  BR: "+55", US: "+1", PT: "+351", ES: "+34", AR: "+54",
  MX: "+52", CO: "+57", CL: "+56", PE: "+51", UY: "+598",
};

// ─── Phone mask helper ────────────────────────────────────────────────────────

/** Masks a phone value based on country. BR: (99) 99999-9999; others: raw digits */
function maskPhone(raw: string, country: string): string {
  const digits = raw.replace(/\D/g, "");
  if (country === "BR") {
    if (digits.length === 0) return "";
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }
  // Non-BR: just allow digits, no special mask
  return digits;
}

/** Strips mask to raw digits only (for storing/submitting) */
function unmaskPhone(masked: string): string {
  return masked.replace(/\D/g, "");
}

/** Detects any phone-like field — covers type:phone, crm_field whatsapp/telefone, and tel type.
 *  Single source of truth: if this returns true, the field MUST get the phone mask. */
function isPhoneLike(field: LpFormField): boolean {
  if (field.type === "phone") return true;
  const crm = field.crm_field ?? "";
  return crm === "pessoa.whatsapp" || crm === "empresa.telefone" || crm === "pessoa.telefone";
}

// ─── Single field renderer ────────────────────────────────────────────────────

function PublicField({
  field,
  value,
  onChange,
  error,
  fs,
}: {
  field: LpFormField;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  fs: ReturnType<typeof getFormStyle>;
}) {
  const [phoneCountry, setPhoneCountry] = useState("BR");

  if (field.type === "hidden") return null;

  const inputStyle: React.CSSProperties = {
    borderRadius: fs.inputRadius,
    backgroundColor: fs.inputBg ?? undefined,
    borderColor: error ? "#ef4444" : (fs.inputBorder ?? undefined),
    borderWidth: fs.inputBorder ? fs.inputBorderWidth : undefined,
    color: fs.inputTextColor,
    paddingTop: fs.inputSize.py,
    paddingBottom: fs.inputSize.py,
    paddingLeft: fs.inputSize.px,
    paddingRight: fs.inputSize.px,
    fontSize: fs.inputSize.fs,
    fontFamily: fs.inputFont,
    fontWeight: fs.inputFontWeight,
    width: "100%",
    outline: "none",
    transition: "border-color 0.15s",
    boxSizing: "border-box" as const,
  };

  const borderFallback = fs.inputBorder ? undefined : "1px solid";
  const borderClass = error
    ? "border border-red-400"
    : fs.inputBorder
    ? ""
    : "border border-border";

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

  const phoneLike = isPhoneLike(field);
  const isWhatsApp = phoneLike || field.crm_field === "pessoa.whatsapp";

  const label = (
    <label style={labelStyle}>
      {isWhatsApp && (
        <svg viewBox="0 0 24 24" fill="currentColor" style={{ display: "inline", width: 14, height: 14, marginRight: 4, color: "#25D366", verticalAlign: "middle" }}>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.126 1.535 5.858L0 24l6.335-1.535A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.846 0-3.574-.49-5.065-1.345l-.363-.214-3.762.911.927-3.667-.237-.377A9.956 9.956 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
        </svg>
      )}
      {field.label}
      {field.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
    </label>
  );

  let input: React.ReactNode;

  if (field.type === "textarea") {
    input = (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={4}
        className={borderClass}
        style={{ ...inputStyle, resize: "none" }}
      />
    );
  } else if (field.type === "select") {
    input = (
      <ThemedSelect
        value={value}
        onChange={onChange}
        options={field.options ?? []}
        fs={fs}
        error={!!error}
      />
    );
  } else if (field.type === "radio") {
    input = (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
        {(field.options ?? []).map((o) => (
          <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div style={{
              width: 16, height: 16, borderRadius: "50%", border: `2px solid ${value === o.value ? (fs.buttonBg ?? "hsl(var(--primary))") : (fs.inputBorder ?? "#d1d5db")}`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {value === o.value && (
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: fs.buttonBg ?? "hsl(var(--primary))" }} />
              )}
            </div>
            <input type="radio" style={{ display: "none" }} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span style={{ fontSize: fs.inputSize.fs, color: fs.bodyColor }}>{o.label}</span>
          </label>
        ))}
      </div>
    );
  } else if (field.type === "checkbox") {
    const selected = value ? value.split(",").filter(Boolean) : [];
    input = (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
        {(field.options ?? []).map((o) => {
          const checked = selected.includes(o.value);
          return (
            <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <div style={{
                width: 16, height: 16, borderRadius: 3, border: `2px solid ${checked ? (fs.buttonBg ?? "hsl(var(--primary))") : (fs.inputBorder ?? "#d1d5db")}`,
                background: checked ? (fs.buttonBg ?? "hsl(var(--primary))") : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {checked && (
                  <svg style={{ width: 10, height: 10, color: "#fff" }} viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <input type="checkbox" style={{ display: "none" }} checked={checked} onChange={() => {
                const next = checked ? selected.filter((v) => v !== o.value) : [...selected, o.value];
                onChange(next.join(","));
              }} />
              <span style={{ fontSize: fs.inputSize.fs, color: fs.bodyColor }}>{o.label}</span>
            </label>
          );
        })}
      </div>
    );
  } else if (phoneLike) {
    const masked = maskPhone(value, phoneCountry);
    return (
      <div style={{ marginBottom: 16 }}>
        {label}
        <div style={{ display: "flex", gap: 8 }}>
          <SelectWrap arrowColor={fs.labelColor ?? undefined} style={{ flexShrink: 0 }}>
            <select
              value={phoneCountry}
              onChange={(e) => {
                setPhoneCountry(e.target.value);
                // Re-mask with new country
                onChange(unmaskPhone(value));
              }}
              className={borderClass}
              style={{ ...inputStyle, width: "auto", appearance: "none", WebkitAppearance: "none", paddingRight: "2rem", cursor: "pointer" }}
            >
              {Object.entries(COUNTRY_FLAGS).map(([code, flag]) => (
                <option key={code} value={code}>{flag} {COUNTRY_CODES[code]}</option>
              ))}
            </select>
          </SelectWrap>
          <input
            type="tel"
            value={masked}
            onChange={(e) => {
              const digits = unmaskPhone(e.target.value);
              const maxLen = phoneCountry === "BR" ? 11 : 15;
              onChange(digits.slice(0, maxLen));
            }}
            placeholder={phoneCountry === "BR" ? "(99) 99999-9999" : field.placeholder ?? "Telefone"}
            className={borderClass}
            style={{ ...inputStyle, flex: 1 }}
          />
        </div>
        {error && <p style={{ marginTop: 4, fontSize: 12, color: "#ef4444" }}>{error}</p>}
      </div>
    );
  } else if (field.type === "number") {
    input = (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        min={field.min}
        max={field.max}
        step={field.step}
        className={cn(borderClass, "w-full")}
        style={inputStyle}
      />
    );
  } else if (field.type === "date") {
    input = (
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(borderClass, "w-full")}
        style={inputStyle}
      />
    );
  } else {
    input = (
      <input
        type={field.type === "email" ? "email" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={cn(borderClass, "w-full")}
        style={inputStyle}
      />
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {label}
      {input}
      {error && <p style={{ marginTop: 4, fontSize: 12, color: "#ef4444" }}>{error}</p>}
    </div>
  );
}

// ─── Submit button ────────────────────────────────────────────────────────────

function SubmitButton({
  fs,
  submitText,
  submitting,
}: {
  fs: ReturnType<typeof getFormStyle>;
  submitText: string;
  submitting: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={submitting}
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
        cursor: submitting ? "not-allowed" : "pointer",
        opacity: submitting ? 0.6 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transition: "opacity 0.15s",
      }}
    >
      {submitting ? (
        <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
      ) : (
        <>
          <Send style={{ width: 16, height: 16 }} />
          {submitText}
        </>
      )}
    </button>
  );
}

// ─── Form card wrapper ────────────────────────────────────────────────────────

function FormCard({
  fs,
  children,
  isEmbed,
}: {
  fs: ReturnType<typeof getFormStyle>;
  children: React.ReactNode;
  isEmbed?: boolean;
}) {
  const accentBar = getAccentBarStyle(fs);

  const wrapStyle: React.CSSProperties = {
    borderRadius: 2,
    overflow: "hidden",
    boxShadow: "none",
    border: isEmbed ? "none" : "1px solid",
    borderColor: isEmbed ? undefined : (fs.glass ? "rgba(255,255,255,0.2)" : "hsl(var(--border))"),
  };

  if (fs.glass) {
    wrapStyle.background = fs.cardBg ?? "rgba(255,255,255,0.12)";
    wrapStyle.backdropFilter = "blur(12px)";
    wrapStyle.WebkitBackdropFilter = "blur(12px)";
  } else if (fs.cardBg) {
    wrapStyle.backgroundColor = fs.cardBg;
  } else {
    wrapStyle.backgroundColor = "#ffffff";
  }

  return (
    <div style={wrapStyle}>
      {accentBar && fs.accentPosition !== "bottom" && (
        <div style={{ ...accentBar }} />
      )}
      <div style={{ padding: "2rem", color: "inherit" }}>
        {children}
      </div>
      {accentBar && fs.accentPosition === "bottom" && (
        <div style={{ ...accentBar }} />
      )}
    </div>
  );
}

// ─── Title + Subtitle ─────────────────────────────────────────────────────────

function FormHeader({ fs }: { fs: ReturnType<typeof getFormStyle> }) {
  if (!fs.title) return null;
  return (
    <div style={{ textAlign: fs.titleAlign, marginBottom: "1.25rem" }}>
      {fs.badgeEnabled && (
        <div style={{ display: "flex", justifyContent: fs.titleAlign === "center" ? "center" : fs.titleAlign === "right" ? "flex-end" : "flex-start", marginBottom: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 9999, border: "1px solid hsl(var(--border))", background: "rgba(255,255,255,0.1)", color: fs.bodyColor ?? undefined }}>
            <BadgeIndicator icon={fs.badgeIcon} color={fs.badgeColor} size={7} />
            {fs.badgeText}
          </span>
        </div>
      )}
      <p style={{
        fontFamily: fs.titleFont,
        fontSize: fs.titleSize,
        color: fs.titleColor,
        fontWeight: fs.titleWeight,
        lineHeight: 1.2,
        margin: 0,
      }}>
        {fs.title}
      </p>
      {fs.subtitle && (
        <p style={{
          color: fs.subtitleColor ?? fs.bodyColor,
          fontSize: fs.subtitleSize,
          marginTop: "0.4rem",
          lineHeight: 1.5,
          margin: "0.4rem 0 0",
          opacity: fs.subtitleColor ? 1 : 0.65,
        }}>
          {fs.subtitle}
        </p>
      )}
    </div>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-[2px] bg-red-50 border border-red-200 text-sm text-red-600 mb-4">
      <AlertCircle className="w-4 h-4 shrink-0" />
      {message}
    </div>
  );
}

// ─── Classic form ─────────────────────────────────────────────────────────────

function ClassicForm({
  form,
  fs,
  onSuccess,
  utmParams,
}: {
  form: LpForm;
  fs: ReturnType<typeof getFormStyle>;
  onSuccess: (res: SubmitResponse) => void;
  utmParams: Record<string, string>;
  isEmbed?: boolean;
}) {
  const visibleFields = form.fields.filter((f) => f.type !== "hidden");
  const hiddenFields = form.fields.filter((f) => f.type === "hidden");
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validate() {
    const errs: Record<string, string> = {};
    for (const f of visibleFields) {
      if (f.required && !values[f.id]?.trim()) errs[f.id] = "Campo obrigatório";
      if (f.type === "email" && values[f.id] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[f.id])) errs[f.id] = "E-mail inválido";
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, string> = { _form_id: form.id, ...utmParams };
      for (const f of [...visibleFields, ...hiddenFields]) payload[f.id] = values[f.id] ?? "";
      const result = await invokeSubmit(payload);
      onSuccess(result);
    } catch (err) {
      console.error("[PublicForm] ClassicForm submit error:", err);
      setSubmitError(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: fs.fieldGap }}>
      <FormHeader fs={fs} />
      {visibleFields.map((field) => (
        <PublicField key={field.id} field={field} value={values[field.id] ?? ""} onChange={(v) => setValues((p) => ({ ...p, [field.id]: v }))} error={errors[field.id]} fs={fs} />
      ))}
      {submitError && <ErrorBanner message={submitError} />}
      <SubmitButton fs={fs} submitText={form.settings?.submit_text || "Enviar"} submitting={submitting} />
    </form>
  );
}

// ─── Steps form ───────────────────────────────────────────────────────────────

function StepsForm({
  form,
  fs,
  onSuccess,
  utmParams,
}: {
  form: LpForm;
  fs: ReturnType<typeof getFormStyle>;
  onSuccess: (res: SubmitResponse) => void;
  utmParams: Record<string, string>;
  isEmbed?: boolean;
}) {
  const steps = form.settings?.steps ?? [];
  const [stepIdx, setStepIdx] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currentStep = steps[stepIdx];
  const stepFields = currentStep
    ? form.fields.filter((f) => f.step_id === currentStep.id && f.type !== "hidden")
    : form.fields.filter((f) => !f.step_id && f.type !== "hidden");
  const hiddenFields = form.fields.filter((f) => f.type === "hidden");
  const isLast = stepIdx === Math.max(steps.length - 1, 0);
  const accentBg = fs.buttonBg ?? "hsl(var(--primary))";

  function validateStep() {
    const errs: Record<string, string> = {};
    for (const f of stepFields) {
      if (f.required && !values[f.id]?.trim()) errs[f.id] = "Campo obrigatório";
      if (f.type === "email" && values[f.id] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[f.id])) errs[f.id] = "E-mail inválido";
    }
    return errs;
  }

  async function handleNext() {
    const errs = validateStep();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    if (!isLast) { setStepIdx((i) => i + 1); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, string> = { _form_id: form.id, ...utmParams };
      for (const f of [...form.fields.filter((f) => f.type !== "hidden"), ...hiddenFields]) payload[f.id] = values[f.id] ?? "";
      const result = await invokeSubmit(payload);
      onSuccess(result);
    } catch (err) {
      console.error("[PublicForm] StepsForm submit error:", err);
      setSubmitError(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: fs.fieldGap }}>
      <FormHeader fs={fs} />
      {steps.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 9999, background: i <= stepIdx ? accentBg : "rgba(0,0,0,0.1)", opacity: i < stepIdx ? 1 : i === stepIdx ? 0.75 : 0.2, transition: "all 0.3s" }} />
          ))}
          <span style={{ fontSize: 11, color: fs.labelColor ?? "#6b7280", marginLeft: 4, flexShrink: 0 }}>
            {stepIdx + 1}/{steps.length}
          </span>
        </div>
      )}
      {currentStep && (
        <p style={{ fontSize: 15, fontWeight: 600, color: fs.bodyColor ?? undefined, marginBottom: 16 }}>{currentStep.title}</p>
      )}
      {stepFields.map((field) => (
        <PublicField key={field.id} field={field} value={values[field.id] ?? ""} onChange={(v) => setValues((p) => ({ ...p, [field.id]: v }))} error={errors[field.id]} fs={fs} />
      ))}
      {submitError && <ErrorBanner message={submitError} />}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {stepIdx > 0 && (
          <button type="button" onClick={() => setStepIdx((i) => i - 1)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-[4px] border border-border text-sm font-semibold hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          disabled={submitting}
          style={{ flex: 1, background: getButtonBg(fs), color: fs.buttonTextColor, borderRadius: fs.buttonRadius, paddingTop: fs.buttonSize.py, paddingBottom: fs.buttonSize.py, fontSize: fs.buttonSize.fs, fontFamily: fs.buttonFont, fontWeight: fs.buttonFontWeight, border: "none", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          {submitting ? <Loader2 style={{ width: 16, height: 16 }} /> : isLast ? <><Send style={{ width: 16, height: 16 }} />{form.settings?.submit_text || "Enviar"}</> : <>Próximo <ChevronRight style={{ width: 16, height: 16 }} /></>}
        </button>
      </div>
    </div>
  );
}

// ─── Chatbot form ─────────────────────────────────────────────────────────────

function ChatbotForm({
  form,
  fs,
  onSuccess,
  utmParams,
}: {
  form: LpForm;
  fs: ReturnType<typeof getFormStyle>;
  onSuccess: (res: SubmitResponse) => void;
  utmParams: Record<string, string>;
  isEmbed?: boolean;
}) {
  const visibleFields = form.fields.filter((f) => f.type !== "hidden");
  const hiddenFields = form.fields.filter((f) => f.type === "hidden");
  const [fieldIdx, setFieldIdx] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [currentInput, setCurrentInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const botName = form.settings?.bot_name || "Bot";
  const botColor = form.settings?.bot_color ?? fs.buttonBg ?? "#4f46e5";
  const currentField = !done && fieldIdx < visibleFields.length ? visibleFields[fieldIdx] : null;

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [fieldIdx]);

  async function handleNext() {
    if (!currentField) return;
    const val = currentInput.trim();
    if (currentField.required && !val) { setError("Por favor, responda para continuar."); return; }
    if (currentField.type === "email" && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setError("E-mail inválido"); return; }
    setError(null);
    const newValues = { ...values, [currentField.id]: val };
    setValues(newValues);
    setCurrentInput("");
    if (fieldIdx < visibleFields.length - 1) { setFieldIdx((i) => i + 1); return; }
    setDone(true);
    setSubmitting(true);
    try {
      const payload: Record<string, string> = { _form_id: form.id, ...utmParams };
      for (const f of [...visibleFields, ...hiddenFields]) payload[f.id] = newValues[f.id] ?? "";
      const result = await invokeSubmit(payload);
      onSuccess(result);
    } catch (err) {
      console.error("[PublicForm] ChatbotForm submit error:", err);
      setDone(false);
      setFieldIdx(visibleFields.length - 1);
      setError(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ borderRadius: 2, border: "1px solid", borderColor: fs.glass ? "rgba(255,255,255,0.2)" : "hsl(var(--border))", overflow: "hidden" }}>
      {/* Bot header */}
      <div style={{ padding: "12px 16px", background: botColor, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>
          {botName.charAt(0).toUpperCase()}
        </div>
        <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{botName}</span>
      </div>
      {/* Chat area */}
      <div style={{ background: "rgba(0,0,0,0.03)", padding: "16px", minHeight: 80, display: "flex", flexDirection: "column", gap: 12 }}>
        {currentField && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: botColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>
              {botName.charAt(0).toUpperCase()}
            </div>
            <div style={{ background: "#fff", borderRadius: "0 8px 8px 8px", padding: "10px 14px", boxShadow: "none", border: "1px solid hsl(var(--border))", maxWidth: "85%" }}>
              <span style={{ fontSize: 14, color: "#111827" }}>
                {currentField.question || currentField.label}
                {currentField.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
              </span>
            </div>
          </div>
        )}
      </div>
      {/* Input */}
      <div style={{ background: "#fff", borderTop: "1px solid hsl(var(--border))", padding: "10px 12px" }}>
        {currentField?.type === "select" ? (
          <div style={{ display: "flex", gap: 8 }}>
            <SelectWrap style={{ flex: 1 }} arrowColor="#6b7280">
              <select
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                className="w-full rounded-[4px] border border-border px-3 py-2 text-sm focus:outline-none"
                style={{ appearance: "none", WebkitAppearance: "none", paddingRight: "2.25rem", cursor: "pointer" }}
              >
                <option value="">Selecione...</option>
                {(currentField.options ?? []).map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </SelectWrap>
            <button onClick={handleNext} style={{ padding: "8px 12px", borderRadius: 4, background: botColor, color: "#fff", border: "none", cursor: "pointer" }}>
              <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
          </div>
        ) : currentField && isPhoneLike(currentField) ? (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="tel"
              value={maskPhone(currentInput, "BR")}
              onChange={(e) => {
                const digits = unmaskPhone(e.target.value).slice(0, 11);
                setCurrentInput(digits);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleNext(); } }}
              placeholder="(99) 99999-9999"
              disabled={submitting}
              className="flex-1 rounded-[4px] border border-border px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
            />
            <button onClick={handleNext} disabled={submitting} style={{ padding: "8px 12px", borderRadius: 4, background: botColor, color: "#fff", border: "none", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}>
              {submitting ? <Loader2 style={{ width: 16, height: 16 }} /> : <ChevronRight style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={currentField?.type === "email" ? "email" : currentField?.type === "number" ? "number" : "text"}
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleNext(); } }}
              placeholder="Digite sua resposta..."
              disabled={submitting}
              className="flex-1 rounded-[4px] border border-border px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
            />
            <button onClick={handleNext} disabled={submitting} style={{ padding: "8px 12px", borderRadius: 4, background: botColor, color: "#fff", border: "none", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}>
              {submitting ? <Loader2 style={{ width: 16, height: 16 }} /> : <ChevronRight style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        )}
        {error && <p style={{ marginTop: 6, fontSize: 12, color: "#ef4444" }}>{error}</p>}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PublicFormPage() {
  const { formId } = useParams<{ formId: string }>();
  const [searchParams] = useSearchParams();

  // Embed detection: explicit param OR auto-detect when loaded inside an iframe
  const isEmbed = searchParams.get("embed") === "1" || (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();

  // In embed mode: strip dark class and body background so the iframe is transparent
  useEffect(() => {
    if (!isEmbed) return;
    document.documentElement.classList.remove("dark");
    document.body.style.background = "transparent";
    return () => { document.body.style.background = ""; };
  }, [isEmbed]);

  // In embed mode: notify parent of content height so the iframe auto-resizes
  useEffect(() => {
    if (!isEmbed) return;
    function sendHeight() {
      const h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      window.parent.postMessage({ type: "lp-resize", height: h }, "*");
    }
    sendHeight();
    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [isEmbed]);

  // Inject Google Fonts + keyframes CSS
  useEffect(() => {
    if (!document.querySelector('link[data-gf-public]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = GOOGLE_FONTS_URL;
      link.setAttribute('data-gf-public', '1');
      document.head.appendChild(link);
    }
    if (!document.querySelector('style[data-form-keyframes]')) {
      const style = document.createElement('style');
      style.setAttribute('data-form-keyframes', '1');
      style.textContent = [
        '@keyframes accent-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }',
        '@keyframes badge-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }',
        '@keyframes badge-ping { 75%, 100% { transform: scale(2); opacity: 0; } }',
      ].join('\n');
      document.head.appendChild(style);
    }
  }, []);

  const [form, setForm] = useState<LpForm | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitRes, setSubmitRes] = useState<SubmitResponse | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  const handleSuccess = (res: SubmitResponse) => {
    setSubmitRes(res);
    setSubmitted(true);
  };

  // ─── Native tracking: UTMs + Click IDs + Meta cookies ─────────────────────
  const utmParams: Record<string, string> = {};

  // UTMs from URL (native — no manual form fields needed)
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = searchParams.get(key);
    if (v) utmParams[key] = v;
  }

  // Click IDs from URL (for conversion tracking)
  const gclid = searchParams.get("gclid");
  const fbclid = searchParams.get("fbclid");
  if (gclid) utmParams._gclid = gclid;
  if (fbclid) utmParams._fbclid = fbclid;

  // Meta cookies (_fbc, _fbp) set by Meta Pixel
  try {
    const cookies = document.cookie.split("; ");
    for (const c of cookies) {
      if (c.startsWith("_fbc=")) utmParams._fbc = c.slice(5);
      else if (c.startsWith("_fbp=")) utmParams._fbp = c.slice(5);
    }
  } catch { /* SSR or cookie access denied — skip silently */ }

  useEffect(() => {
    if (!formId) { setNotFound(true); setLoading(false); return; }
    Promise.all([
      supabase.from("form_pro_forms").select("*").eq("id", formId).single(),
      supabase.from("settings").select("company_name, logo_url, primary_color").limit(1).maybeSingle(),
    ]).then(([formRes, settingsRes]) => {
      if (formRes.error || !formRes.data) { setNotFound(true); }
      else { setForm(formRes.data as unknown as LpForm); }
      if (settingsRes.data) setSettings(settingsRes.data as unknown as PublicSettings);
      setLoading(false);
    });
  }, [formId]);

  if (loading) {
    return (
      <div className={cn(isEmbed ? "flex items-center justify-center p-0" : "min-h-screen flex items-center justify-center")} style={isEmbed ? undefined : { background: "#f9fafb" }}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className={cn(isEmbed ? "flex items-center justify-center p-0" : "min-h-screen flex items-center justify-center p-6")} style={isEmbed ? undefined : { background: "#f9fafb" }}>
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-base font-semibold mb-1">Formulário não encontrado</p>
          <p className="text-sm text-muted-foreground">Este formulário não existe ou foi removido.</p>
        </div>
      </div>
    );
  }

  const fs = getFormStyle(form!.settings ?? { submit_text: "Enviar", success_message: "Obrigado!" });
  const successTitle = form!.settings?.success_title || "Enviado com sucesso!";
  const successMessage = form!.settings?.success_message || "Obrigado! Sua resposta foi registrada.";
  const redirectUrl = form!.settings?.redirect_url || null;
  const formMode = form!.settings?.mode ?? "classic";

  // Page background: use skin pageBg OR neutral fallback
  const pageBg = fs.pageBg ?? "#f4f4f5";
  const accentColor = fs.buttonBg ?? "#2563eb";

  // Shared header: always shown (form + success)
  const pageHeader = (
    <header style={{
      background: fs.isDark ? "rgba(9,9,11,0.92)" : "rgba(255,255,255,0.88)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      borderBottom: "1px solid hsl(var(--border))",
      padding: "14px 24px",
      color: fs.isDark ? "#fafafa" : "#111827",
      flexShrink: 0,
    }}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {settings?.logo_url ? (
          <img
            src={settings.logo_url}
            alt={settings.company_name ?? 'Logo'}
            style={{ height: 36, maxWidth: 200, objectFit: "contain" }}
          />
        ) : settings?.company_name ? (
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>
            {settings.company_name}
          </span>
        ) : (
          <RevOSLogo size="sm" variant="full" />
        )}
      </div>
    </header>
  );

  const pageFooter = (
    <p style={{ textAlign: "center", fontSize: 11, color: fs.isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.25)", marginTop: 20, marginBottom: 8 }}>
      Developed by{" "}
      <a href="https://www.growthsales.ai" target="_blank" rel="noopener noreferrer"
        style={{ fontWeight: 600, color: "inherit", textDecoration: "none" }}>
        growthsales.ai
      </a>
    </p>
  );

  if (submitted) {
    // Resolve which content to show: success_route from backend or fallback defaults
    const route = submitRes?.success_route ?? null;
    const displayTitle = route?.title || successTitle;
    const displayMessage = route?.message || (route?.action === "redirect" ? "" : successMessage);
    const displayRedirect = route?.action === "redirect" ? route.redirect_url : (!route ? redirectUrl : null);
    const isBooking = route?.action === "booking";

    const successContent = (
      <FormCard fs={fs} isEmbed={isEmbed}>
        {isBooking ? (
          /* ── Booking flow: clean layout, no big icon, no "obrigado" before booking ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {!bookingConfirmed && (
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <p style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: fs.bodyColor ?? "#111827",
                  margin: 0,
                  lineHeight: 1.3,
                  fontFamily: fs.titleFont,
                }}>
                  {displayTitle}
                </p>
              </div>
            )}
            {route?.booking_rule_set_id && submitRes?.lead_id && (
              <div style={{ width: "100%" }}>
                <InlineBooking
                  leadId={submitRes.lead_id}
                  ruleSetId={route.booking_rule_set_id}
                  accentColor={accentColor}
                  waConfirmTemplate={route.wa_confirm_template}
                  onStepChange={(s) => { if (s === 2) setBookingConfirmed(true); }}
                  bodyColor={fs.bodyColor}
                  labelColor={fs.labelColor}
                  cardBg={fs.cardBg}
                  inputBg={fs.inputBg}
                  borderColor={fs.inputBorder}
                  isDark={fs.isDark}
                  fontFamily={fs.titleFont}
                />
              </div>
            )}
          </div>
        ) : (
          /* ── Non-booking success: icon + message + redirect ── */
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "8px 0 4px" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: accentColor + "18",
              border: `2px solid ${accentColor}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 20,
              animation: "successPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both",
            }}>
              <CheckCircle2 style={{ width: 38, height: 38, color: accentColor }} />
            </div>

            <p style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: fs.bodyColor ?? "#111827",
              margin: "0 0 10px",
              lineHeight: 1.25,
              fontFamily: fs.titleFont,
            }}>
              {displayTitle}
            </p>

            {displayMessage && (
              <p style={{
                fontSize: "0.9375rem",
                color: fs.labelColor ?? (fs.isDark ? "#a1a1aa" : "#6b7280"),
                margin: "0 0 24px",
                lineHeight: 1.6,
                maxWidth: 360,
              }}>
                {displayMessage}
              </p>
            )}

            {displayRedirect && (
              <a
                href={displayRedirect}
                target={isEmbed ? "_blank" : undefined}
                rel={isEmbed ? "noopener noreferrer" : undefined}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: getButtonBg(fs),
                  color: fs.buttonTextColor,
                  borderRadius: fs.buttonRadius,
                  padding: `${fs.buttonSize.py} 1.5rem`,
                  fontSize: fs.buttonSize.fs,
                  fontFamily: fs.buttonFont,
                  fontWeight: fs.buttonFontWeight,
                  textDecoration: "none",
                  border: "none",
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                Continuar
                <ExternalLink style={{ width: 14, height: 14 }} />
              </a>
            )}
          </div>
        )}
      </FormCard>
    );

    if (isEmbed) {
      return (
        <div style={{ padding: 0, background: "transparent", color: fs.bodyColor }}>
          {successContent}
          <style>{`
            @keyframes successPop {
              from { opacity: 0; transform: scale(0.6); }
              to   { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </div>
      );
    }

    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: pageBg }}>
        {pageHeader}
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
          <div style={{ width: "100%", maxWidth: isBooking ? 560 : 480 }}>
            {successContent}
            {pageFooter}
          </div>
        </main>
        <style>{`
          @keyframes successPop {
            from { opacity: 0; transform: scale(0.6); }
            to   { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    );
  }

  const formContent = (
    <FormCard fs={fs} isEmbed={isEmbed}>
      {formMode === "chatbot" ? (
        <ChatbotForm form={form!} fs={fs} onSuccess={handleSuccess} utmParams={utmParams} isEmbed={isEmbed} />
      ) : formMode === "steps" ? (
        <StepsForm form={form!} fs={fs} onSuccess={handleSuccess} utmParams={utmParams} isEmbed={isEmbed} />
      ) : (
        <ClassicForm form={form!} fs={fs} onSuccess={handleSuccess} utmParams={utmParams} isEmbed={isEmbed} />
      )}
    </FormCard>
  );

  if (isEmbed) {
    return (
      <div style={{ padding: 0, background: "transparent", color: fs.bodyColor }}>
        {formContent}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: pageBg, color: fs.bodyColor }}>
      {pageHeader}
      <main style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px" }}>
        <div style={{ width: "100%", maxWidth: 560 }}>
          {formContent}
          {pageFooter}
        </div>
      </main>
    </div>
  );
}
