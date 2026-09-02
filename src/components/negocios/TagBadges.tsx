import { Tag } from 'lucide-react';

export interface LeadTagRef {
  id: string;
  name: string;
  color: string;
}

interface TagBadgesProps {
  tags?: LeadTagRef[] | null;
  /** How many chips to show before collapsing the rest into a "+N". */
  max?: number;
}

const CHIP_BASE =
  'inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md border leading-none';

// Cor da tag é definida pelo usuário (hex dinâmico) — não dá pra usar classe
// Tailwind literal como o CursoBadges faz (paleta fixa em build-time), então
// aplicamos a cor via style inline com opacidade baixa pro fundo/borda.
function tagStyle(hex: string): React.CSSProperties {
  return {
    color: hex,
    backgroundColor: `${hex}1A`, // ~10% opacity
    borderColor: `${hex}33`,     // ~20% opacity
  };
}

export default function TagBadges({ tags, max = 3 }: TagBadgesProps) {
  if (!tags || tags.length === 0) return null;

  const visible = tags.slice(0, max);
  const overflow = tags.slice(max);

  return (
    <>
      {visible.map((t) => (
        <span
          key={t.id}
          className={`${CHIP_BASE} max-w-[110px]`}
          style={tagStyle(t.color)}
          title={t.name}
        >
          <Tag className="h-2.5 w-2.5 shrink-0" strokeWidth={1.5} />
          <span className="truncate">{t.name}</span>
        </span>
      ))}
      {overflow.length > 0 && (
        <span
          className={`${CHIP_BASE} text-muted-foreground bg-muted border-border`}
          title={overflow.map((t) => t.name).join(', ')}
        >
          +{overflow.length}
        </span>
      )}
    </>
  );
}
