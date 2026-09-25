import { format, isSameDay, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Mesmo dia no calendário local. */
export function sameDay(a: string, b: string): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/** "Hoje", "Ontem", "segunda-feira" (últimos 7 dias) ou "22 de setembro de 2026". */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (isSameDay(d, now)) return 'Hoje';
  if (differenceInCalendarDays(now, d) === 1) return 'Ontem';
  if (differenceInCalendarDays(now, d) < 7) return format(d, "EEEE", { locale: ptBR });
  return format(d, d.getFullYear() === now.getFullYear() ? "d 'de' MMMM" : "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

/** Separador de dia na linha do tempo da conversa. */
export function MessageDaySeparator({ date }: { date: string }) {
  return (
    <div className="sticky top-0 z-10 flex justify-center py-1 pointer-events-none select-none" role="separator" aria-label={dayLabel(date)}>
      <span className="rounded-full border border-border/50 bg-background/90 backdrop-blur px-3 py-0.5 text-[11px] font-medium text-muted-foreground first-letter:uppercase shadow-sm">
        {dayLabel(date)}
      </span>
    </div>
  );
}
