import { GraduationCap } from 'lucide-react';

export interface Curso {
  product_id: string;
  product_name: string;
}

interface CursoBadgesProps {
  cursos?: Curso[] | null;
  /** How many chips to show before collapsing the rest into a "+N". */
  max?: number;
}

// Base chip shape shared by every product color — only the color classes vary.
const CHIP_BASE =
  'inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] border leading-none';

// Fixed palette, one entry per product (deterministic by product_id hash so the
// same product always gets the same color across kanban/detail/config screens).
// Tailwind class names must stay literal (JIT scans source text) — never build
// these strings dynamically.
const PALETTE: { chip: string; dot: string }[] = [
  { chip: 'text-amber-400 bg-amber-400/10 border-amber-400/20', dot: 'bg-amber-400' },
  { chip: 'text-sky-400 bg-sky-400/10 border-sky-400/20', dot: 'bg-sky-400' },
  { chip: 'text-violet-400 bg-violet-400/10 border-violet-400/20', dot: 'bg-violet-400' },
  { chip: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', dot: 'bg-emerald-400' },
  { chip: 'text-rose-400 bg-rose-400/10 border-rose-400/20', dot: 'bg-rose-400' },
  { chip: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20', dot: 'bg-cyan-400' },
  { chip: 'text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/20', dot: 'bg-fuchsia-400' },
  { chip: 'text-lime-400 bg-lime-400/10 border-lime-400/20', dot: 'bg-lime-400' },
  { chip: 'text-orange-400 bg-orange-400/10 border-orange-400/20', dot: 'bg-orange-400' },
  { chip: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20', dot: 'bg-indigo-400' },
];

/** Deterministic color for a given Kiwify product_id — same product, same color, everywhere. */
export function productColor(productId: string): { chip: string; dot: string } {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = (hash * 31 + productId.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function CursoBadges({ cursos, max = 2 }: CursoBadgesProps) {
  if (!cursos || cursos.length === 0) return null;

  const visible = cursos.slice(0, max);
  const overflow = cursos.slice(max);

  return (
    <>
      {visible.map((c) => (
        <span
          key={c.product_id}
          className={`${CHIP_BASE} ${productColor(c.product_id).chip} max-w-[130px]`}
          title={c.product_name}
        >
          <GraduationCap className="h-2.5 w-2.5 shrink-0" strokeWidth={1.5} />
          <span className="truncate">{c.product_name}</span>
        </span>
      ))}
      {overflow.length > 0 && (
        <span
          className={`${CHIP_BASE} text-muted-foreground bg-muted border-border`}
          title={overflow.map((c) => c.product_name).join(', ')}
        >
          +{overflow.length}
        </span>
      )}
    </>
  );
}
