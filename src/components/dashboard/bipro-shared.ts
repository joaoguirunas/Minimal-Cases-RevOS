// ── Shared BIPRO formatters, animation variants & design tokens ────────────
// Single source of truth for all BI PRO tabs

import React from 'react';
import { cn } from '@/lib/utils';

// ── BIProFeedback — reusable error/empty/nodata state ─────────────────────
export interface BIProFeedbackProps {
  variant: 'error' | 'empty' | 'nodata';
  title: string;
  description?: string;
  icon?: React.ElementType;
  action?: { label: string; onClick: () => void };
}

export function BIProFeedback({ variant, title, description, icon: Icon, action }: BIProFeedbackProps) {
  const palette = variant === 'error'
    ? { bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-200 dark:border-red-900', text: 'text-red-600 dark:text-red-400', sub: 'text-red-500/70 dark:text-red-400/60' }
    : variant === 'empty'
    ? { bg: 'bg-muted', border: 'border-border', text: 'text-muted-foreground', sub: 'text-muted-foreground' }
    : { bg: 'bg-muted', border: 'border-border', text: 'text-muted-foreground', sub: 'text-muted-foreground' };

  return React.createElement('div', {
    className: `flex flex-col items-center justify-center gap-3 py-10 px-6 rounded-md border ${palette.border} ${palette.bg} text-center`,
  },
    Icon && React.createElement(Icon, { className: `w-8 h-8 ${palette.text} opacity-60` }),
    React.createElement('p', { className: `text-[13px] font-semibold ${palette.text}` }, title),
    description && React.createElement('p', { className: `text-[11px] ${palette.sub} max-w-xs` }, description),
    action && React.createElement('button', {
      onClick: action.onClick,
      className: 'mt-1 text-[11px] font-medium text-primary hover:text-primary/80 underline underline-offset-2 transition-colors',
    }, action.label),
  );
}

// ── Formatters ──────────────────────────────────────────────────────────────
export const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v);

export const fmtK = (v: number) => {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}K`;
  return fmtBRL(v);
};

export const fmtBRL2 = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v);

export const fmtPct = (v: number) => `${v.toFixed(1)}%`;
export const fmtNum = (v: number) => new Intl.NumberFormat('pt-BR').format(v);
export const fmtNumK = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat('pt-BR').format(v);
};
export const fmtDays = (v: number | null) => v !== null ? `${Math.round(v)}d` : '—';

// ── Animation variants ──────────────────────────────────────────────────────
export const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

export const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

export const rowVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 240, damping: 26 } },
};

// ── Status colors (semantic, for badges) ────────────────────────────────────
export const STATUS_COLORS = {
  good:   { text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800' },
  medium: { text: 'text-amber-700 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-950/30',     border: 'border-amber-200 dark:border-amber-800'     },
  bad:    { text: 'text-red-600 dark:text-red-400',          bg: 'bg-red-50 dark:bg-red-950/30',         border: 'border-red-200 dark:border-red-800'          },
} as const;

// ── Section card design tokens ──────────────────────────────────────────────
export const SECTION_SHADOW = '';
export const CARD_BASE = 'border border-border bg-card rounded-md overflow-hidden';
export const SECTION_CARD = CARD_BASE;
export const TABLE_HEADER = 'text-[11px] font-semibold text-muted-foreground uppercase tracking-wide';

// ── Responsive grid tokens ───────────────────────────────────────────────────
export const GRID_KPIS_3 = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';
export const GRID_KPIS_4 = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4';
export const GRID_KPIS_5 = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4';
export const GRID_2COL = 'grid grid-cols-1 lg:grid-cols-2 gap-4';
export const GRID_SEC_KPIS = 'grid grid-cols-2 gap-3';

// ── Skeleton helpers ─────────────────────────────────────────────────────────
export function SkeletonBlock({ height, className }: { height: number | string; className?: string }) {
  return React.createElement('div', {
    className: `rounded-md animate-pulse border border-border bg-muted ${className ?? ''}`,
    style: { height: typeof height === 'number' ? height : undefined, minHeight: typeof height === 'string' ? height : undefined },
  });
}

export function SkeletonKPIGrid({ cols = 3, cardHeight = 36 }: { cols?: 3 | 4 | 5; cardHeight?: number }) {
  const gridClass = cols === 5 ? GRID_KPIS_5 : cols === 4 ? GRID_KPIS_4 : GRID_KPIS_3;
  return React.createElement('div', { className: `${gridClass} animate-pulse` },
    ...Array.from({ length: cols }, (_, i) =>
      React.createElement('div', {
        key: i,
        className: 'rounded-md border border-border bg-muted',
        style: { height: `${cardHeight * 4}px` },
      })
    )
  );
}

// ── Empty state for data sections ────────────────────────────────────────────
export function BIProEmptySection({ title, description, icon }: { title: string; description?: string; icon?: React.ElementType }) {
  const Icon = icon;
  return React.createElement('div', {
    className: `flex flex-col items-center justify-center gap-2 py-12 px-6 text-center ${CARD_BASE}`,
  },
    Icon && React.createElement(Icon, { className: 'w-10 h-10 text-muted-foreground/30' }),
    React.createElement('p', { className: 'text-[13px] font-medium text-muted-foreground' }, title),
    description && React.createElement('p', { className: 'text-[11px] text-muted-foreground/60 max-w-sm' }, description),
  );
}

// ── SectionCard — unified container for BI PRO sections (spec §3.1) ─────────
export interface SectionCardProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function SectionCard({ title, subtitle, badge, right, children, className }: SectionCardProps) {
  return React.createElement('div', {
    className: cn('border border-border bg-card rounded-md overflow-hidden', className),
  },
    React.createElement('div', {
      className: 'px-6 py-5 border-b border-border flex items-center justify-between gap-4',
    },
      React.createElement('div', { className: 'min-w-0' },
        React.createElement('h3', { className: 'text-[15px] font-semibold text-foreground' }, title),
        subtitle && React.createElement('p', { className: 'text-[12px] text-muted-foreground mt-0.5' }, subtitle),
      ),
      (badge || right) && React.createElement('div', { className: 'flex items-center gap-2 flex-shrink-0' },
        badge && React.createElement('span', {
          className: 'text-[11px] font-medium text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full',
        }, badge),
        right,
      ),
    ),
    children,
  );
}

// ── MetricCell — unified KPI cell (spec §3.2) ───────────────────────────────
export interface MetricCellProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string; // tailwind text-* class for value color (when status is critical)
  icon?: React.ElementType;
  className?: string;
}

export function MetricCell({ label, value, sub, accent, icon: Icon, className }: MetricCellProps) {
  return React.createElement('div', {
    className: cn('flex items-start gap-3 min-w-0 px-5 py-4', className),
  },
    Icon && React.createElement('div', {
      className: 'flex items-center justify-center w-9 h-9 rounded-md bg-muted shrink-0',
    },
      React.createElement(Icon, { className: 'w-4 h-4 text-muted-foreground' }),
    ),
    React.createElement('div', { className: 'flex flex-col gap-1 min-w-0' },
      React.createElement('span', {
        className: 'text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate',
      }, label),
      React.createElement('span', {
        className: cn(
          'text-[22px] font-semibold leading-none tabular-nums tracking-tight',
          accent || 'text-foreground',
        ),
      }, value),
      sub && React.createElement('span', {
        className: 'text-[11px] text-muted-foreground tabular-nums',
      }, sub),
    ),
  );
}

// ── BadgePill — unified count/status pill (spec §3.3) ───────────────────────
export type BadgePillVariant = 'default' | 'good' | 'warning' | 'bad' | 'info';

const BADGE_PILL_VARIANTS: Record<BadgePillVariant, string> = {
  default: 'bg-muted/60 text-muted-foreground',
  good:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  bad:     'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  info:    'bg-primary/10 text-primary',
};

export interface BadgePillProps {
  children: React.ReactNode;
  variant?: BadgePillVariant;
  className?: string;
}

export function BadgePill({ children, variant = 'default', className }: BadgePillProps) {
  return React.createElement('span', {
    className: cn(
      'inline-flex items-center gap-1 text-[11px] font-medium tabular-nums px-2 py-0.5 rounded-full',
      BADGE_PILL_VARIANTS[variant],
      className,
    ),
  }, children);
}

// ── FilterChip — unified filter button with optional count (spec §3.5) ──────
export interface FilterChipProps {
  active?: boolean;
  count?: number | null;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  'aria-label'?: string;
}

export function FilterChip({ active = false, count, children, onClick, className, ...rest }: FilterChipProps) {
  return React.createElement('button', {
    onClick,
    'aria-pressed': active,
    className: cn(
      'inline-flex items-center gap-2 text-[12px] font-medium px-3 py-1.5 rounded-md border transition-colors',
      active
        ? 'border-primary/30 bg-primary/10 text-primary'
        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40',
      className,
    ),
    ...rest,
  },
    children,
    count != null && React.createElement('span', {
      className: cn(
        'text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded',
        active ? 'bg-primary/15 text-primary' : 'bg-muted/60 text-muted-foreground',
      ),
    }, count),
  );
}
