// src/components/bi/BiFiltersBar.tsx
import type { CompareKey, PeriodKey } from '@/lib/bi/period';
import { DateRangePicker } from '@/components/ui/date-range-picker';
export interface BiFilters { period: PeriodKey; custom?: { from: Date; to: Date }; compare: CompareKey }
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Hoje' }, { key: '7d', label: '7 dias' }, { key: '30d', label: '30 dias' }, { key: '90d', label: '90 dias' },
  { key: 'month', label: 'Este mês' }, { key: 'last-month', label: 'Mês passado' }, { key: 'custom', label: 'Personalizado' }];
export function BiFiltersBar({ value, onChange }: { value: BiFilters; onChange: (v: BiFilters) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PERIODS.map((p) => (
        <button key={p.key} onClick={() => onChange({ ...value, period: p.key })}
          className={`h-8 px-3 rounded-md text-[12px] border ${value.period === p.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>{p.label}</button>))}
      {value.period === 'custom' && (
        <DateRangePicker className="flex-shrink-0" placeholder="Escolher intervalo" showDaysBadge={false}
          dateRange={value.custom ? { from: value.custom.from, to: value.custom.to } : undefined}
          onDateRangeChange={(r) => { if (r.from && r.to) onChange({ ...value, custom: { from: r.from, to: r.to } }); }} />)}
      <select className="h-8 rounded-md border border-border bg-background px-2 text-[12px]" value={value.compare}
        onChange={(e) => onChange({ ...value, compare: e.target.value as CompareKey })}>
        <option value="previous">vs período anterior</option>
        <option value="year">vs mesmo período do ano passado</option>
      </select>
    </div>
  );
}
