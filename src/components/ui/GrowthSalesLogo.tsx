import { cn } from '@/lib/utils';

/**
 * Marca do produto — Minimal Cases (reestilização MC-1, ago/2026).
 *
 * Os nomes exportados (GSSymbol / GSLockup) são mantidos para não tocar nos
 * consumidores (LoginPage, DashLayout, MobileAppHeader, ResetPasswordPage,
 * RevOSLogo). O símbolo é o "M" da Minimal em PNG (preto no tema claro,
 * branco no escuro — assets em /public/logos/minimal-*.png).
 */

export function GSSymbol({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex flex-shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <img
        src="/logos/minimal-black.png"
        alt=""
        className="block h-full w-full object-contain dark:hidden"
        draggable={false}
      />
      <img
        src="/logos/minimal-white.png"
        alt=""
        className="hidden h-full w-full object-contain dark:block"
        draggable={false}
      />
    </span>
  );
}

export function GSLockup({ symbolSize = 28, textSize = 13, className }: { symbolSize?: number; textSize?: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center select-none', className)} style={{ gap: symbolSize * 0.28 }}>
      <GSSymbol size={symbolSize} />
      <span style={{
        fontFamily: "'Archivo', 'Helvetica Neue', Arial, sans-serif",
        fontSize: textSize,
        fontWeight: 600,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'hsl(var(--foreground))',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}>
        Minimal<span style={{ color: 'hsl(var(--primary))' }}> Cases</span>
      </span>
    </span>
  );
}
