import { useEffect } from "react";
import { useSettings } from "@/hooks/useSettings";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Injects brand CSS variables into :root when settings load.
// Called once in the app shell; no-op if no brand colors configured.
export function useBrandColors() {
  const { data: settings } = useSettings();

  useEffect(() => {
    const root = document.documentElement;
    const primary = settings?.brand_primary_color;
    const secondary = settings?.brand_secondary_color;

    if (primary && HEX_RE.test(primary)) {
      root.style.setProperty("--primary", hexToHsl(primary));
    }
    if (secondary && HEX_RE.test(secondary)) {
      root.style.setProperty("--secondary", hexToHsl(secondary));
    }

    const productName = settings?.product_name;
    if (productName) {
      document.title = document.title.replace(/GrowthSales/g, productName);
    }
  }, [settings?.brand_primary_color, settings?.brand_secondary_color, settings?.product_name]);
}
