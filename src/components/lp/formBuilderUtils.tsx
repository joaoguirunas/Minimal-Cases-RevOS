import React, { useState } from "react";
import { ChevronDown, Paperclip } from "lucide-react";
import type { LpFormField, LpFormSettings, LpFormStyle } from "@/hooks/useLpForms";
import { cn } from "@/lib/utils";

// ─── Form style resolver ──────────────────────────────────────────────────────

export const RADIUS_MAP: Record<string, string> = { none: '0px', sm: '4px', md: '8px', full: '9999px' };
const FONT_MAP: Record<string, string> = {
  sans: 'system-ui,sans-serif', serif: 'Georgia,serif', mono: 'monospace',
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
export const GOOGLE_FONT_FAMILIES = [
  'Inter', 'Poppins', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Nunito', 'Raleway',
  'Source Sans 3', 'Work Sans', 'DM Sans', 'Outfit',
  'Space Grotesk', 'Rubik', 'Manrope', 'Josefin Sans', 'Quicksand', 'Barlow',
  'Inter Tight', 'JetBrains Mono',
];
export const GOOGLE_FONTS_URL = `https://fonts.googleapis.com/css2?${GOOGLE_FONT_FAMILIES.map(f => `family=${f.replace(/ /g, '+')}:wght@400;600;700;800`).join('&')}&display=swap`;
export const FONT_OPTIONS = [
  { key: 'sans', label: 'Sans Serif' }, { key: 'serif', label: 'Serif' }, { key: 'mono', label: 'Mono' },
  ...GOOGLE_FONT_FAMILIES.map(f => ({ key: f, label: f })),
];
export const FIELD_GAP_MAP: Record<string, string> = { compact: '8px', normal: '16px', relaxed: '24px', loose: '32px' };
const FIELD_GAP_PREVIEW_MAP: Record<string, string> = { compact: '4px', normal: '8px', relaxed: '12px', loose: '16px' };
const SIZE_MAP: Record<string, string> = { sm: '1.125rem', md: '1.625rem', lg: '2.25rem', xl: '3rem' };
export const WEIGHT_MAP: Record<string, number> = { normal: 400, semibold: 600, bold: 700, extrabold: 800 };
const PREVIEW_TITLE_SIZE_MAP: Record<string, string> = { sm: '0.72rem', md: '0.9rem', lg: '1.1rem', xl: '1.35rem' };
const LABEL_SIZE_MAP: Record<string, string> = { sm: '11px', md: '13px', lg: '15px' };
const SUBTITLE_SIZE_MAP: Record<string, string> = { sm: '0.8rem', md: '0.95rem', lg: '1.1rem' };
// input_size → [paddingY, paddingX, fontSize, previewPy]
const INPUT_SIZE_MAP: Record<string, { py: string; px: string; fs: string; previewPy: string }> = {
  sm: { py: '7px',  px: '12px', fs: '13px', previewPy: '3px' },
  md: { py: '11px', px: '14px', fs: '14px', previewPy: '6px' },
  lg: { py: '15px', px: '16px', fs: '15px', previewPy: '10px' },
};
export const ACCENT_WIDTH_MAP: Record<string, string> = { thin: '2px', normal: '3px', thick: '6px' };
// input_border_width → border px
const INPUT_BORDER_MAP: Record<string, string> = { thin: '1px', normal: '1.5px', thick: '2.5px' };
// button_size → [paddingY, fontSize]
export const BTN_SIZE_MAP: Record<string, { py: string; fs: string }> = {
  sm: { py: '8px',  fs: '13px' },
  md: { py: '12px', fs: '15px' },
  lg: { py: '16px', fs: '16px' },
};

// ─── Country codes for phone fields ──────────────────────────────────────────

const COUNTRIES = [
  { code: 'BR', dial: '+55',  flag: '🇧🇷', name: 'Brasil'        },
  { code: 'US', dial: '+1',   flag: '🇺🇸', name: 'EUA'           },
  { code: 'PT', dial: '+351', flag: '🇵🇹', name: 'Portugal'      },
  { code: 'ES', dial: '+34',  flag: '🇪🇸', name: 'Espanha'       },
  { code: 'GB', dial: '+44',  flag: '🇬🇧', name: 'Reino Unido'   },
  { code: 'AR', dial: '+54',  flag: '🇦🇷', name: 'Argentina'     },
  { code: 'MX', dial: '+52',  flag: '🇲🇽', name: 'México'        },
  { code: 'CO', dial: '+57',  flag: '🇨🇴', name: 'Colômbia'      },
  { code: 'CL', dial: '+56',  flag: '🇨🇱', name: 'Chile'         },
  { code: 'PE', dial: '+51',  flag: '🇵🇪', name: 'Peru'          },
  { code: 'VE', dial: '+58',  flag: '🇻🇪', name: 'Venezuela'     },
  { code: 'UY', dial: '+598', flag: '🇺🇾', name: 'Uruguai'       },
  { code: 'PY', dial: '+595', flag: '🇵🇾', name: 'Paraguai'      },
  { code: 'BO', dial: '+591', flag: '🇧🇴', name: 'Bolívia'       },
  { code: 'EC', dial: '+593', flag: '🇪🇨', name: 'Equador'       },
  { code: 'DE', dial: '+49',  flag: '🇩🇪', name: 'Alemanha'      },
  { code: 'FR', dial: '+33',  flag: '🇫🇷', name: 'França'        },
  { code: 'IT', dial: '+39',  flag: '🇮🇹', name: 'Itália'        },
  { code: 'NL', dial: '+31',  flag: '🇳🇱', name: 'Holanda'       },
  { code: 'CH', dial: '+41',  flag: '🇨🇭', name: 'Suíça'         },
  { code: 'JP', dial: '+81',  flag: '🇯🇵', name: 'Japão'         },
  { code: 'CN', dial: '+86',  flag: '🇨🇳', name: 'China'         },
  { code: 'IN', dial: '+91',  flag: '🇮🇳', name: 'Índia'         },
  { code: 'AU', dial: '+61',  flag: '🇦🇺', name: 'Austrália'     },
  { code: 'ZA', dial: '+27',  flag: '🇿🇦', name: 'África do Sul' },
  { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'Emirados'      },
  { code: 'AO', dial: '+244', flag: '🇦🇴', name: 'Angola'        },
  { code: 'MZ', dial: '+258', flag: '🇲🇿', name: 'Moçambique'    },
  { code: 'CV', dial: '+238', flag: '🇨🇻', name: 'Cabo Verde'    },
] as const;

type CountryCode = typeof COUNTRIES[number]['code'];

function formatPhone(countryCode: CountryCode, digits: string): string {
  if (countryCode === 'BR') {
    const d = digits.slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  }
  // Generic grouping for other countries
  const d = digits.slice(0, 12);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)} ${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6)}`;
  return `${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6,9)} ${d.slice(9)}`;
}

function PhoneFieldInput({
  value, onChange, radius, extraStyle, required,
}: {
  value: string;
  onChange: (v: string) => void;
  radius: string;
  extraStyle?: React.CSSProperties;
  required?: boolean;
}) {
  const [countryCode, setCountryCode] = useState<CountryCode>('BR');
  const country = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0];

  function handlePhone(raw: string) {
    const digits = raw.replace(/\D/g, '');
    onChange(formatPhone(countryCode, digits));
  }

  function handleCountryChange(code: string) {
    setCountryCode(code as CountryCode);
    // Reset phone value when country changes
    onChange('');
  }

  const inputStyle: React.CSSProperties = {
    borderRadius: `0 ${radius} ${radius} 0`,
    ...extraStyle,
    borderLeft: 'none',
    padding: extraStyle?.padding ?? '8px 12px',
  };

  return (
    <div className="flex items-stretch" style={{ borderRadius: radius, overflow: 'hidden' }}>
      <select
        value={countryCode}
        onChange={(e) => handleCountryChange(e.target.value)}
        className="border border-r-0 border-border bg-muted text-xs font-semibold text-muted-foreground cursor-pointer shrink-0 focus:outline-none"
        style={{
          borderRadius: `${radius} 0 0 ${radius}`,
          paddingLeft: '6px',
          paddingRight: '4px',
          backgroundColor: extraStyle?.backgroundColor ? undefined : undefined,
          borderColor: extraStyle?.borderColor ?? undefined,
          borderWidth: extraStyle?.borderWidth ?? undefined,
          minWidth: '72px',
          fontSize: '12px',
        }}
        title="Selecionar país"
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.dial}
          </option>
        ))}
      </select>
      <input
        type="tel"
        value={value}
        onChange={(e) => handlePhone(e.target.value)}
        placeholder={countryCode === 'BR' ? '(11) 99999-9999' : '000 000 0000'}
        required={required}
        className="w-full text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
        style={inputStyle}
      />
    </div>
  );
}

// ─── Form Skins ───────────────────────────────────────────────────────────────

export const FORM_SKINS = [
  {
    key: 'default' as const,
    label: 'Padrão',
    thumb: { wrap: '#ffffff', input: '#f9fafb', btn: '#4f46e5' },
    defaults: {},
  },
  {
    key: 'dark' as const,
    label: 'Dark',
    thumb: { wrap: '#1e293b', input: '#0f172a', btn: '#22c55e' },
    defaults: {
      cardBg: '#1e293b', pageBg: '#0f172a', buttonColor: '#22c55e',
      labelColor: '#94a3b8', bodyColor: '#f1f5f9', labelUppercase: true,
      inputBg: '#0f172a', inputBorder: '#334155', accentBar: 'linear-gradient(90deg,#3b82f6,#8b5cf6)',
      focusColor: '#3b82f6',
    },
  },
  {
    key: 'minimal' as const,
    label: 'Minimal',
    thumb: { wrap: '#fafafa', input: 'transparent', btn: '#111827' },
    defaults: {
      cardBg: 'transparent', pageBg: '#fafafa', buttonColor: '#111827',
      labelColor: '#6b7280', bodyColor: '#111827',
      inputBg: 'transparent', inputBorder: 'rgba(0,0,0,0.12)', noShadow: true,
    },
  },
  {
    key: 'glass' as const,
    label: 'Glass',
    thumb: { wrap: 'linear-gradient(135deg,#667eea,#764ba2)', input: 'rgba(255,255,255,0.25)', btn: '#7c3aed' },
    defaults: {
      cardBg: 'rgba(255,255,255,0.12)', pageBg: 'linear-gradient(135deg,#667eea,#764ba2)', buttonColor: '#7c3aed',
      labelColor: 'rgba(255,255,255,0.9)', bodyColor: '#ffffff',
      inputBg: 'rgba(255,255,255,0.08)', inputBorder: 'rgba(255,255,255,0.25)', glass: true,
      accentBar: 'linear-gradient(90deg,#667eea,#764ba2)',
    },
  },
  {
    key: 'neon' as const,
    label: 'Neon',
    thumb: { wrap: '#09090b', input: '#18181b', btn: '#7c3aed' },
    defaults: {
      cardBg: '#09090b', pageBg: '#09090b', buttonColor: '#7c3aed',
      labelColor: '#a1a1aa', bodyColor: '#fafafa',
      inputBg: '#18181b', inputBorder: '#3f3f46', focusColor: '#7c3aed',
    },
  },
  {
    key: 'growth_sales' as const,
    label: 'Growth Sales',
    thumb: { wrap: '#050507', input: '#1f1f24', btn: '#ff3a0e' },
    defaults: {
      // Bone & ember on void — growthsales.ai brand system.
      cardBg: '#0e0e11', pageBg: '#050507', buttonColor: '#ff3a0e',
      labelColor: '#84848c', bodyColor: '#f1f1f3',
      inputBg: '#1f1f24', inputBorder: 'rgba(255,255,255,0.16)',
      buttonTextColor: '#050507',
    },
  },
] as const;

export type FormSkinKey = typeof FORM_SKINS[number]['key'];

function getSkinDefaults(skin: FormSkinKey) {
  return FORM_SKINS.find((s) => s.key === skin)?.defaults ?? {};
}

export function getFormStyle(s: LpFormSettings) {
  const st = s.style ?? {};
  const skin = (st.form_skin ?? 'default') as FormSkinKey;
  const sd = getSkinDefaults(skin) as Record<string, unknown>;

  return {
    skin,
    bg: st.bg_color ?? (sd.cardBg as string | undefined),
    inputRadius: RADIUS_MAP[st.input_radius ?? 'sm'],
    buttonBg: st.button_color ?? (sd.buttonColor as string | undefined),
    buttonTextColor: st.button_text_color ?? (sd.buttonTextColor as string | undefined) ?? '#ffffff',
    buttonRadius: RADIUS_MAP[st.button_radius ?? 'sm'],
    buttonFullWidth: st.button_full_width !== false,
    fieldGap: FIELD_GAP_MAP[st.field_gap ?? 'normal'],
    fieldGapPreview: FIELD_GAP_PREVIEW_MAP[st.field_gap ?? 'normal'],
    labelColor: st.label_color ?? (sd.labelColor as string | undefined),
    title: st.title,
    subtitle: st.subtitle,
    titleAlign: (st.title_align ?? 'left') as React.CSSProperties['textAlign'],
    titleFont: FONT_MAP[st.title_font ?? 'sans'],
    titleSize: SIZE_MAP[st.title_size ?? 'md'],
    titleColor: st.title_color ?? (sd.bodyColor as string | undefined),
    subtitleColor: st.subtitle_color ?? (sd.labelColor as string | undefined),
    // Skin extras
    pageBg: sd.pageBg as string | undefined,
    bodyColor: sd.bodyColor as string | undefined,
    inputBg: sd.inputBg as string | undefined,
    inputBorder: sd.inputBorder as string | undefined,
    labelUppercase: sd.labelUppercase as boolean | undefined,
    accentBar: sd.accentBar as string | undefined,
    glass: sd.glass as boolean | undefined,
    noShadow: sd.noShadow as boolean | undefined,
    // Typography & sizing
    titleWeight: WEIGHT_MAP[st.title_weight ?? 'bold'] ?? 700,
    previewTitleSize: PREVIEW_TITLE_SIZE_MAP[st.title_size ?? 'md'],
    subtitleSize: SUBTITLE_SIZE_MAP[st.subtitle_size ?? 'sm'],
    inputSize: INPUT_SIZE_MAP[st.input_size ?? 'md'],
    buttonSize: BTN_SIZE_MAP[st.button_size ?? 'md'],
    // Label typography
    labelFont: FONT_MAP[st.label_font ?? 'sans'],
    labelWeight: WEIGHT_MAP[st.label_weight ?? 'semibold'] ?? 600,
    labelSize: LABEL_SIZE_MAP[st.label_size ?? 'md'],
    // Input typography
    inputFont: FONT_MAP[st.input_font ?? 'sans'],
    inputFontWeight: WEIGHT_MAP[st.input_font_weight ?? 'normal'] ?? 400,
    // Button typography
    buttonFont: FONT_MAP[st.button_font ?? 'sans'],
    buttonFontWeight: WEIGHT_MAP[st.button_font_weight ?? 'bold'] ?? 700,
    // Input field customization (overrides skin)
    inputBgColor: st.input_bg_color,
    inputBorderColor: st.input_border_color,
    inputBorderWidth: INPUT_BORDER_MAP[st.input_border_width ?? 'normal'],
    inputTextColor: st.input_text_color,
    // Button gradient
    buttonGradient: st.button_gradient ?? false,
    buttonColor2: st.button_color2 ?? '#7c3aed',
    buttonGradientDir: (st.button_gradient_dir ?? 'right') as 'right' | 'diagonal',
    // Accent line
    accentColor: st.accent_color,
    accentType: (st.accent_type ?? 'solid') as 'solid' | 'gradient' | 'animated',
    accentColor2: st.accent_color2 ?? '#7c3aed',
    accentWidth: ACCENT_WIDTH_MAP[st.accent_width ?? 'normal'],
    accentPosition: (st.accent_position ?? 'top') as 'top' | 'bottom',
    // Badge
    badgeEnabled: st.badge_enabled ?? false,
    badgeColor: st.badge_color ?? '#22c55e',
    badgeText: st.badge_text ?? 'Online agora',
    badgeIcon: (st.badge_icon ?? 'circle') as 'circle' | 'pulse' | 'wave' | 'star' | 'bolt' | 'heart',
    // Page mode
    pageMode: (st.page_mode ?? 'light') as 'light' | 'dark',
  };
}

// ─── Accent bar helper ────────────────────────────────────────────────────────

export function getAccentBarStyle(fs: ReturnType<typeof getFormStyle>): React.CSSProperties | null {
  if (!fs.accentColor) return null;
  const h = fs.accentWidth;
  const base: React.CSSProperties = { height: h, flexShrink: 0 };
  if (fs.accentType === 'animated') {
    return {
      ...base,
      backgroundImage: `linear-gradient(90deg, ${fs.accentColor}, ${fs.accentColor2}, ${fs.accentColor})`,
      backgroundSize: '200% 100%',
      animation: 'accent-shimmer 2s ease-in-out infinite',
    };
  }
  if (fs.accentType === 'gradient') {
    return { ...base, backgroundImage: `linear-gradient(90deg, ${fs.accentColor}, ${fs.accentColor2})` };
  }
  return { ...base, backgroundColor: fs.accentColor };
}

// ─── Button background helper (solid or gradient) ─────────────────────────────

export function getButtonBg(fs: ReturnType<typeof getFormStyle>): string {
  const base = fs.buttonBg || 'hsl(var(--primary))';
  if (fs.buttonGradient && fs.buttonBg) {
    const angle = fs.buttonGradientDir === 'diagonal' ? '135deg' : '90deg';
    return `linear-gradient(${angle}, ${base}, ${fs.buttonColor2})`;
  }
  return base;
}

// ─── Field label helper ───────────────────────────────────────────────────────

export function FieldLabel({ field, required, color }: { field: LpFormField; required?: boolean; color?: string }) {
  const isWhatsApp = field.type === "phone" || field.crm_field === "pessoa.whatsapp";
  return (
    <span className="inline-flex items-center gap-1" style={{ color: color || undefined }}>
      {isWhatsApp && (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-[#25D366] shrink-0">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.126 1.535 5.858L0 24l6.335-1.535A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.846 0-3.574-.49-5.065-1.345l-.363-.214-3.762.911.927-3.667-.237-.377A9.956 9.956 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
        </svg>
      )}
      {field.label || "Campo"}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </span>
  );
}

// ─── Test input renderer ──────────────────────────────────────────────────────

export function renderTestInput(
  field: LpFormField,
  value: string,
  onChange: (v: string) => void,
  radius = '4px',
  extraStyle?: React.CSSProperties
) {
  const base = "w-full text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors";
  const style: React.CSSProperties = { borderRadius: radius, padding: '8px 12px', ...extraStyle };

  if (field.type === "textarea") {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || ""}
        rows={3}
        className={cn(base, "resize-none")}
        style={style}
      />
    );
  }
  if (field.type === "select") {
    return (
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(base, "appearance-none pr-8 cursor-pointer")}
          style={style}
        >
          <option value="">Selecione...</option>
          {(field.options ?? []).map((o, i) => (
            <option key={i} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      </div>
    );
  }
  if (field.type === "radio") {
    return (
      <div className="space-y-2">
        {(field.options ?? []).map((o, i) => (
          <label key={i} className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input
              type="radio"
              name={field.id}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="w-4 h-4 accent-indigo-500"
            />
            {o.label}
          </label>
        ))}
      </div>
    );
  }
  if (field.type === "checkbox") {
    const selected = value ? value.split(",").filter(Boolean) : [];
    return (
      <div className="space-y-2">
        {(field.options ?? []).map((o, i) => (
          <label key={i} className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              value={o.value}
              checked={selected.includes(o.value)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...selected, o.value]
                  : selected.filter((v) => v !== o.value);
                onChange(next.join(","));
              }}
              className="w-4 h-4 accent-indigo-500"
            />
            {o.label}
          </label>
        ))}
      </div>
    );
  }
  if (field.type === "phone") {
    return (
      <PhoneFieldInput
        value={value}
        onChange={onChange}
        radius={radius}
        extraStyle={extraStyle}
        required={field.required}
      />
    );
  }
  if (field.type === "number") {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || ""}
        required={field.required}
        min={field.min}
        max={field.max}
        step={field.step ?? 1}
        className={base}
        style={style}
      />
    );
  }
  if (field.type === "file") {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed border-border rounded-[4px] bg-muted py-4 px-3 cursor-pointer hover:border-primary/60 transition-colors"
        style={{ borderRadius: radius }}
        onClick={() => (document.getElementById(`sim-file-${field.id}`) as HTMLInputElement)?.click()}
      >
        <input
          id={`sim-file-${field.id}`}
          type="file"
          className="hidden"
          accept={field.accept}
          onChange={(e) => onChange(e.target.files?.[0]?.name ?? "")}
        />
        {value ? (
          <span className="text-xs font-medium text-primary truncate max-w-full">{value}</span>
        ) : (
          <>
            <Paperclip className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {field.placeholder || "Clique para selecionar arquivo"}
              {field.max_size_mb ? ` (máx. ${field.max_size_mb}MB)` : ""}
            </span>
          </>
        )}
      </div>
    );
  }
  return (
    <input
      type={field.type === "email" ? "email" : field.type === "date" ? "date" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder || ""}
      required={field.required}
      className={base}
      style={style}
    />
  );
}

// ─── Condition evaluation ─────────────────────────────────────────────────────
/**
 * Returns true if the field should be visible given the current form values.
 * A field with no conditions is always visible.
 * All conditions are ANDed together.
 */
export function evalFieldVisible(field: LpFormField, values: Record<string, string>): boolean {
  if (!field.conditions?.length) return true;
  return field.conditions.every((cond) => {
    const actual = values[cond.trigger_field_id]?.trim() ?? "";
    const matches = actual.toLowerCase() === cond.trigger_value.toLowerCase();
    return cond.action === "show" ? matches : !matches;
  });
}
