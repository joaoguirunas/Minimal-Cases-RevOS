/**
 * LP PRO™ Theme Packs — 5 premium themes with full CSS token definitions.
 * Each theme provides colors, fonts, shadows, radius, and blur values.
 */

import type { ThemePack } from '../types';

export const THEME_PACKS: ThemePack[] = [
  // ── 1. Tech Premium Dark ───────────────────────────────────────────────────
  {
    id: 'tech-premium-dark',
    name: 'Tech Premium Dark',
    category: 'dark',
    fonts: {
      heading: 'Space Grotesk',
      body: 'Inter',
      weights: { heading: '500;700', body: '400;500;600' },
    },
    tokens: {
      '--lp-bg':            '#0a0a0f',
      '--lp-bg-alt':        '#111118',
      '--lp-surface':       '#1a1a24',
      '--lp-surface-alt':   '#22222e',
      '--lp-text':          '#f0f0f5',
      '--lp-text-muted':    '#8888a0',
      '--lp-primary':       '#6c5ce7',
      '--lp-primary-hover': '#7c6df7',
      '--lp-accent':        '#00cec9',
      '--lp-border':        'rgba(255,255,255,0.08)',
      '--lp-shadow-sm':     '0 1px 3px rgba(0,0,0,0.3)',
      '--lp-shadow-md':     '0 4px 12px rgba(0,0,0,0.4)',
      '--lp-shadow-lg':     '0 12px 28px rgba(0,0,0,0.5)',
      '--lp-radius':        '8px',
      '--lp-radius-lg':     '16px',
      '--lp-blur':          '10px',
    },
    intensityOverrides: {
      low: {
        '--lp-shadow-sm': '0 1px 2px rgba(0,0,0,0.2)',
        '--lp-shadow-md': '0 2px 6px rgba(0,0,0,0.25)',
        '--lp-shadow-lg': '0 6px 14px rgba(0,0,0,0.3)',
        '--lp-blur':      '4px',
      },
      high: {
        '--lp-shadow-sm': '0 2px 4px rgba(108,92,231,0.15)',
        '--lp-shadow-md': '0 8px 24px rgba(108,92,231,0.2)',
        '--lp-shadow-lg': '0 20px 48px rgba(108,92,231,0.3)',
        '--lp-blur':      '20px',
      },
    },
  },

  // ── 2. Editorial Clean ─────────────────────────────────────────────────────
  {
    id: 'editorial-clean',
    name: 'Editorial Clean',
    category: 'light',
    fonts: {
      heading: 'Playfair Display',
      body: 'Source Sans 3',
      weights: { heading: '600;700', body: '400;600' },
    },
    tokens: {
      '--lp-bg':            '#fefefe',
      '--lp-bg-alt':        '#f8f7f4',
      '--lp-surface':       '#ffffff',
      '--lp-surface-alt':   '#f4f3f0',
      '--lp-text':          '#1a1a1a',
      '--lp-text-muted':    '#6b6b6b',
      '--lp-primary':       '#c2185b',
      '--lp-primary-hover': '#d81b60',
      '--lp-accent':        '#bf8a30',
      '--lp-border':        'rgba(0,0,0,0.08)',
      '--lp-shadow-sm':     '0 1px 2px rgba(0,0,0,0.04)',
      '--lp-shadow-md':     '0 4px 8px rgba(0,0,0,0.06)',
      '--lp-shadow-lg':     '0 10px 20px rgba(0,0,0,0.08)',
      '--lp-radius':        '4px',
      '--lp-radius-lg':     '8px',
      '--lp-blur':          '8px',
    },
    intensityOverrides: {
      low: {
        '--lp-shadow-sm': '0 1px 1px rgba(0,0,0,0.02)',
        '--lp-shadow-md': '0 2px 4px rgba(0,0,0,0.03)',
        '--lp-shadow-lg': '0 4px 8px rgba(0,0,0,0.04)',
        '--lp-blur':      '4px',
      },
      high: {
        '--lp-shadow-sm': '0 1px 3px rgba(0,0,0,0.08)',
        '--lp-shadow-md': '0 6px 16px rgba(0,0,0,0.1)',
        '--lp-shadow-lg': '0 16px 36px rgba(0,0,0,0.14)',
        '--lp-blur':      '14px',
      },
    },
  },

  // ── 3. Bold Contrast ───────────────────────────────────────────────────────
  {
    id: 'bold-contrast',
    name: 'Bold Contrast',
    category: 'light',
    fonts: {
      heading: 'Sora',
      body: 'DM Sans',
      weights: { heading: '600;800', body: '400;500;700' },
    },
    tokens: {
      '--lp-bg':            '#ffffff',
      '--lp-bg-alt':        '#f5f5f5',
      '--lp-surface':       '#ffffff',
      '--lp-surface-alt':   '#f0f0f0',
      '--lp-text':          '#0d0d0d',
      '--lp-text-muted':    '#555555',
      '--lp-primary':       '#0d0d0d',
      '--lp-primary-hover': '#333333',
      '--lp-accent':        '#ff4444',
      '--lp-border':        'rgba(0,0,0,0.12)',
      '--lp-shadow-sm':     '0 1px 3px rgba(0,0,0,0.1)',
      '--lp-shadow-md':     '0 4px 12px rgba(0,0,0,0.12)',
      '--lp-shadow-lg':     '0 12px 28px rgba(0,0,0,0.16)',
      '--lp-radius':        '6px',
      '--lp-radius-lg':     '12px',
      '--lp-blur':          '10px',
    },
    intensityOverrides: {
      low: {
        '--lp-shadow-sm': '0 1px 2px rgba(0,0,0,0.06)',
        '--lp-shadow-md': '0 2px 6px rgba(0,0,0,0.08)',
        '--lp-shadow-lg': '0 6px 14px rgba(0,0,0,0.1)',
        '--lp-blur':      '4px',
      },
      high: {
        '--lp-shadow-sm': '0 2px 4px rgba(0,0,0,0.14)',
        '--lp-shadow-md': '0 8px 20px rgba(0,0,0,0.2)',
        '--lp-shadow-lg': '0 20px 44px rgba(0,0,0,0.26)',
        '--lp-blur':      '16px',
      },
    },
  },

  // ── 4. Minimal Luxury ──────────────────────────────────────────────────────
  {
    id: 'minimal-luxury',
    name: 'Minimal Luxury',
    category: 'light',
    fonts: {
      heading: 'Cormorant Garamond',
      body: 'Nunito Sans',
      weights: { heading: '500;700', body: '400;600' },
    },
    tokens: {
      '--lp-bg':            '#faf9f7',
      '--lp-bg-alt':        '#f5f3ef',
      '--lp-surface':       '#ffffff',
      '--lp-surface-alt':   '#f0ece6',
      '--lp-text':          '#2c2c2c',
      '--lp-text-muted':    '#7a7a7a',
      '--lp-primary':       '#8b6f47',
      '--lp-primary-hover': '#a0825a',
      '--lp-accent':        '#c9a96e',
      '--lp-border':        'rgba(139,111,71,0.12)',
      '--lp-shadow-sm':     '0 1px 2px rgba(0,0,0,0.04)',
      '--lp-shadow-md':     '0 3px 8px rgba(0,0,0,0.06)',
      '--lp-shadow-lg':     '0 8px 20px rgba(0,0,0,0.08)',
      '--lp-radius':        '4px',
      '--lp-radius-lg':     '8px',
      '--lp-blur':          '8px',
    },
    intensityOverrides: {
      low: {
        '--lp-shadow-sm': '0 0 0 transparent',
        '--lp-shadow-md': '0 1px 3px rgba(0,0,0,0.03)',
        '--lp-shadow-lg': '0 4px 10px rgba(0,0,0,0.05)',
        '--lp-blur':      '2px',
      },
      high: {
        '--lp-shadow-sm': '0 1px 3px rgba(139,111,71,0.08)',
        '--lp-shadow-md': '0 6px 18px rgba(139,111,71,0.12)',
        '--lp-shadow-lg': '0 14px 36px rgba(139,111,71,0.16)',
        '--lp-blur':      '14px',
      },
    },
  },

  // ── 5. Startup Modern ──────────────────────────────────────────────────────
  {
    id: 'startup-modern',
    name: 'Startup Modern',
    category: 'light',
    fonts: {
      heading: 'Plus Jakarta Sans',
      body: 'Inter',
      weights: { heading: '600;800', body: '400;500' },
    },
    tokens: {
      '--lp-bg':            '#ffffff',
      '--lp-bg-alt':        '#f8fafc',
      '--lp-surface':       '#ffffff',
      '--lp-surface-alt':   '#f1f5f9',
      '--lp-text':          '#0f172a',
      '--lp-text-muted':    '#64748b',
      '--lp-primary':       '#6366f1',
      '--lp-primary-hover': '#818cf8',
      '--lp-accent':        '#f59e0b',
      '--lp-border':        'rgba(0,0,0,0.06)',
      '--lp-shadow-sm':     '0 1px 2px rgba(0,0,0,0.05)',
      '--lp-shadow-md':     '0 4px 12px rgba(99,102,241,0.08)',
      '--lp-shadow-lg':     '0 12px 28px rgba(99,102,241,0.12)',
      '--lp-radius':        '12px',
      '--lp-radius-lg':     '20px',
      '--lp-blur':          '12px',
    },
    intensityOverrides: {
      low: {
        '--lp-shadow-sm': '0 1px 1px rgba(0,0,0,0.03)',
        '--lp-shadow-md': '0 2px 6px rgba(0,0,0,0.05)',
        '--lp-shadow-lg': '0 6px 14px rgba(0,0,0,0.07)',
        '--lp-blur':      '6px',
      },
      high: {
        '--lp-shadow-sm': '0 2px 4px rgba(99,102,241,0.1)',
        '--lp-shadow-md': '0 8px 24px rgba(99,102,241,0.16)',
        '--lp-shadow-lg': '0 20px 48px rgba(99,102,241,0.22)',
        '--lp-blur':      '20px',
      },
    },
  },
];

/** Quick lookup by ID */
export const THEME_PACK_MAP = new Map(THEME_PACKS.map((t) => [t.id, t]));

/** Get theme with intensity applied */
export function resolveThemeTokens(
  theme: ThemePack,
  intensity: 'low' | 'medium' | 'high' = 'medium',
): ThemePack['tokens'] {
  if (intensity === 'medium') return theme.tokens;
  const overrides = theme.intensityOverrides?.[intensity] ?? {};
  return { ...theme.tokens, ...overrides };
}
