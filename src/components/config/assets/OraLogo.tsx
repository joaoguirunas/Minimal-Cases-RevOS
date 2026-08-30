import { cn } from '@/lib/utils';

const BRAND_LABEL = 'João Guirunas';

function OraWave({ height = 100, color = '#F0E6D2', accent = '#B8924B', style }: {
  height?: number; color?: string; accent?: string; style?: React.CSSProperties;
}) {
  const amps = [0.15, 0.30, 0.25, 0.50, 0.40, 0.85];
  const barW = 7, gap = 5.5;
  const N = amps.length;
  const totalW = N * barW + (N - 1) * gap;
  const H = 80;
  const startX = barW / 2;
  const maxH = H * 0.92;
  const peakIdx = amps.indexOf(Math.max(...amps));
  const w = (height * totalW) / H;
  return (
    <svg width={w} height={height} viewBox={`0 0 ${totalW} ${H}`} style={style} aria-hidden="true">
      {amps.map((a, i) => {
        const cx = startX + i * (barW + gap);
        const halfH = Math.max((maxH * a) / 2, barW / 2 + 0.1);
        return (
          <rect key={i} x={cx - barW / 2} y={H / 2 - halfH} width={barW} height={halfH * 2} rx={barW / 2}
            fill={i === peakIdx ? accent : color} opacity={i === peakIdx ? 1 : 0.82} />
        );
      })}
    </svg>
  );
}

function OraWordmark({ height = 80, color = '#F0E6D2', style }: {
  height?: number; color?: string; style?: React.CSSProperties;
}) {
  return (
    <span
      aria-label={BRAND_LABEL}
      style={{
        ...style,
        color,
        fontFamily: "'Outfit', 'Inter Tight', sans-serif",
        fontWeight: 800,
        fontSize: height * 0.7,
        letterSpacing: '-0.02em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {BRAND_LABEL}
    </span>
  );
}

export function OraLockup({ height = 64, color = '#F0E6D2', accent = '#B8924B', wordmarkColor, className }: {
  height?: number; color?: string; accent?: string; wordmarkColor?: string; className?: string;
}) {
  const wmColor = wordmarkColor ?? accent;
  return (
    <div className={cn('inline-flex items-center', className)} style={{ gap: height * 0.32 }}>
      <OraWave height={height * 0.78} color={color} accent={accent} />
      <OraWordmark height={height} color={wmColor} />
    </div>
  );
}

export { OraWave, OraWordmark };
export default OraLockup;
