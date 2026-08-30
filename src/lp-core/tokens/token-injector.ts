/**
 * Token Injector — generates CSS variable declarations from a ThemePack.
 * Used by both preview (srcDoc) and published runtime (PublicFormPage).
 */

import type { ThemePack, ThemeIntensity, ThemePackTokens } from '../types';
import { THEME_PACK_MAP, resolveThemeTokens } from './theme-packs';

/**
 * Generate a CSS block with :root variables from a theme pack.
 */
export function generateThemeCSS(
  themeId: string,
  intensity: ThemeIntensity = 'medium',
): string {
  const theme = THEME_PACK_MAP.get(themeId);
  if (!theme) return '';

  const tokens = resolveThemeTokens(theme, intensity);
  const vars = Object.entries(tokens)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');

  return `:root {\n${vars}\n}`;
}

/**
 * Generate raw tokens object for a theme (without CSS wrapper).
 */
export function getThemeTokens(
  themeId: string,
  intensity: ThemeIntensity = 'medium',
): ThemePackTokens | null {
  const theme = THEME_PACK_MAP.get(themeId);
  if (!theme) return null;
  return resolveThemeTokens(theme, intensity);
}

/**
 * Generate Google Fonts <link> tag for a theme pack.
 */
export function generateFontLink(themeId: string): string {
  const theme = THEME_PACK_MAP.get(themeId);
  if (!theme) return '';

  const heading = encodeURIComponent(theme.fonts.heading);
  const body = encodeURIComponent(theme.fonts.body);
  const hWeights = theme.fonts.weights.heading;
  const bWeights = theme.fonts.weights.body;

  // Avoid duplicate if heading === body
  if (theme.fonts.heading === theme.fonts.body) {
    const allWeights = [...new Set([...hWeights.split(';'), ...bWeights.split(';')])].join(';');
    return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${heading}:wght@${allWeights}&display=swap" rel="stylesheet">`;
  }

  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${heading}:wght@${hWeights}&family=${body}:wght@${bWeights}&display=swap" rel="stylesheet">`;
}

/**
 * Generate CSS for font-family application based on theme.
 */
export function generateFontCSS(themeId: string): string {
  const theme = THEME_PACK_MAP.get(themeId);
  if (!theme) return '';

  return `
body {
  font-family: '${theme.fonts.body}', sans-serif;
}
h1, h2, h3, h4, h5, h6 {
  font-family: '${theme.fonts.heading}', sans-serif;
}`.trim();
}

/**
 * Generate complete theme injection (CSS vars + fonts + font-family rules).
 */
export function generateFullThemeInjection(
  themeId: string,
  intensity: ThemeIntensity = 'medium',
): { css: string; fontLink: string } {
  const themeCSS = generateThemeCSS(themeId, intensity);
  const fontCSS = generateFontCSS(themeId);
  const fontLink = generateFontLink(themeId);

  return {
    css: themeCSS ? `${themeCSS}\n${fontCSS}` : '',
    fontLink,
  };
}
