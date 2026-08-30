import { useId } from 'react';
import { cn } from '@/lib/utils';

const GS_PATH = "M921.001 706.671L919.622 707.725L920.209 708.15L898.465 723.903L889.106 731.061L888.953 730.795L511.604 1004.19L103 708.15L126.317 691.256L104.876 706.671L512 20V412.399L843.971 652.915L512.001 78.1611V20L921.001 706.671ZM166.956 708.148L511.604 957.849L856.253 708.148L511.604 458.447L166.956 708.148Z";

export function GSSymbol({ size = 24, className }: { size?: number; className?: string }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('block flex-shrink-0', className)}
    >
      <defs>
        <linearGradient id={`gs-${uid}`} x1="22.75" y1="628.32" x2="804.51" y2="198.61" gradientUnits="userSpaceOnUse">
          <stop offset="0.1" stopColor="#FF4400" />
          <stop offset="1" stopColor="#FF1A00" />
        </linearGradient>
      </defs>
      <path fillRule="evenodd" clipRule="evenodd" d={GS_PATH} fill={`url(#gs-${uid})`} />
    </svg>
  );
}

export function GSLockup({ symbolSize = 28, textSize = 13, className }: { symbolSize?: number; textSize?: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center select-none', className)} style={{ gap: symbolSize * 0.22 }}>
      <GSSymbol size={symbolSize} />
      <span style={{
        fontFamily: "'Inter Tight', Inter, sans-serif",
        fontSize: textSize,
        fontWeight: 300,
        letterSpacing: '-0.035em',
        color: 'hsl(var(--foreground))',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}>
        GrowthSales<span style={{ color: '#FF4400', fontStyle: 'italic' }}> CRM</span>
      </span>
    </span>
  );
}
