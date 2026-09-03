import type { ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export default function MoreFiltersPopover({ count, children }: { count: number; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-[30px] gap-1.5 text-[12px] rounded-lg">
          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
          Filtros
          {count > 0 && <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] px-1 tabular-nums">{count}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[560px] p-4 rounded-xl">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Mais filtros</p>
        <div className="grid grid-cols-2 gap-3">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
