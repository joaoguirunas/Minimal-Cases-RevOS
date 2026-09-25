// src/components/bi/ui/RfmTreemap.tsx
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { squarify } from '@/lib/bi/squarify';
import { segmentMeta } from '@/lib/bi/segments';
import { fmtBRL } from '@/components/dashboard/bipro-shared';

type Seg = { segment: string; customers: number; revenue: number; share: number };
const H = 320;

export function RfmTreemap({ segments, selected, onSelect }: { segments: Seg[]; selected: string | null; onSelect: (s: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  const [hover, setHover] = useState<string | null>(null);
  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const h = w < 500 ? 420 : H;
  const tiles = useMemo(() => squarify(segments.map((s) => ({ value: s.customers, data: s })), w, h), [segments, w, h]);
  // o contêiner é sempre renderizado para o ResizeObserver medir a largura desde o início
  if (tiles.length === 0) return <div ref={box} className="w-full"><p className="text-[12px] text-muted-foreground py-10 text-center">Sem clientes ainda.</p></div>;
  const hot = tiles.find((t) => t.data.segment === (hover ?? selected));
  return (
    <div ref={box} className="relative w-full">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block" role="img" aria-label="Matriz RFM: área = número de clientes"
        onPointerLeave={() => setHover(null)}>
        {tiles.map((t) => {
          const meta = segmentMeta(t.data.segment);
          const on = selected === t.data.segment;
          const dim = selected != null && !on;
          const big = t.w > 90 && t.h > 44;
          return (
            <g key={t.data.segment} style={{ cursor: 'pointer', opacity: dim ? 0.45 : 1, transition: 'opacity 150ms' }}
              onPointerEnter={() => setHover(t.data.segment)} onClick={() => onSelect(on ? null : t.data.segment)}>
              <rect x={t.x + 1} y={t.y + 1} width={Math.max(0, t.w - 2)} height={Math.max(0, t.h - 2)} rx={6}
                fill={meta.tone} fillOpacity={0.85} stroke={on ? 'hsl(var(--foreground))' : 'transparent'} strokeWidth={2} />
              {big ? (
                <>
                  <text x={t.x + 10} y={t.y + 20} fontSize={12} fontWeight={600} fill="#fff">{t.data.segment}</text>
                  <text x={t.x + 10} y={t.y + 36} fontSize={11} fill="#fff" fillOpacity={0.9} className="tabular-nums">
                    {t.data.customers.toLocaleString('pt-BR')} · {(t.data.share * 100).toFixed(1).replace('.', ',')}%
                  </text>
                </>
              ) : t.w > 36 && t.h > 18 ? (
                <text x={t.x + t.w / 2} y={t.y + t.h / 2 + 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#fff">
                  {(t.data.share * 100).toFixed(0)}%
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hot && (
        <div className="pointer-events-none absolute right-2 top-2 z-10 w-56 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-sm">
          <p className="text-[12px] font-semibold">{hot.data.segment}</p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {hot.data.customers.toLocaleString('pt-BR')} clientes · {fmtBRL(hot.data.revenue)}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{segmentMeta(hot.data.segment).action}</p>
        </div>
      )}
    </div>
  );
}
