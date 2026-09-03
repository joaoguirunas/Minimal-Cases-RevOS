import { X } from 'lucide-react';
import { Chip } from '@/components/ui/chip';

export interface ActiveFilter { key: string; label: string; onClear: () => void }

export default function ActiveFilterChips({ items, onClearAll }: { items: ActiveFilter[]; onClearAll: () => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap px-4 pb-2">
      {items.map((f) => (
        <button key={f.key} type="button" onClick={f.onClear} aria-label={`Remover filtro ${f.label}`} className="group">
          <Chip size="md" className="group-hover:border-foreground/30">
            {f.label}<X className="h-3 w-3 opacity-60 group-hover:opacity-100" strokeWidth={1.5} />
          </Chip>
        </button>
      ))}
      <button type="button" onClick={onClearAll} className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-4 ml-1">Limpar tudo</button>
    </div>
  );
}
