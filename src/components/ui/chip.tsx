import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ChipTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'violet';
export type ChipSize = 'sm' | 'md';

const TONE: Record<ChipTone, string> = {
  neutral: 'text-muted-foreground bg-muted border-border',
  info:    'text-sky-500 bg-sky-500/10 border-sky-500/25',
  success: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/25',
  warning: 'text-amber-500 bg-amber-500/10 border-amber-500/25',
  danger:  'text-red-500 bg-red-500/10 border-red-500/25',
  violet:  'text-violet-400 bg-violet-400/10 border-violet-400/25',
};
const SIZE: Record<ChipSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-0.5 [&>svg]:h-2.5 [&>svg]:w-2.5',
  md: 'text-[11px] px-2 py-0.5 gap-1 [&>svg]:h-3 [&>svg]:w-3',
};

export interface ChipProps {
  tone?: ChipTone;
  size?: ChipSize;
  icon?: ElementType;
  title?: string;
  className?: string;
  children: ReactNode;
}

/** Chip de estado/metadado. Cor = tom semântico; padrão neutro. */
export function Chip({ tone = 'neutral', size = 'sm', icon: Icon, title, className, children }: ChipProps) {
  return (
    <span
      title={title}
      className={cn('inline-flex items-center rounded-full border font-medium leading-none whitespace-nowrap', TONE[tone], SIZE[size], className)}
    >
      {Icon ? <Icon strokeWidth={1.5} aria-hidden /> : null}
      {children}
    </span>
  );
}
