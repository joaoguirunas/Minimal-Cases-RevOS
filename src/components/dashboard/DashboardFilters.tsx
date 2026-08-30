import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarRange } from "lucide-react";
import { DateRangeFilter } from "./DateRangeFilter";
import { usePipelines } from "@/hooks/usePipelines";
import { DateRange } from "react-day-picker";

const PERIODS = [
  { value: 'today',     label: 'Hoje' },
  { value: 'week',      label: 'Semana' },
  { value: 'last-week', label: 'Sem. passada' },
  { value: 'month',     label: 'Mês' },
  { value: '90d',       label: '3 meses' },
];

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Score color coding
function scoreColor(s: number) {
  if (s >= 8) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700';
  if (s >= 5) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700';
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700';
}

interface DashboardFiltersProps {
  periodFilter: string;
  customDateRange: DateRange | undefined;
  pipelineFilter: string;
  scoreFilter: number[];
  onPeriodChange: (value: string) => void;
  onCustomDateRangeChange: (range: DateRange | undefined) => void;
  onPipelineChange: (value: string) => void;
  onScoreChange: (scores: number[]) => void;
  onClearFilters?: () => void;
}

export const DashboardFilters = ({
  periodFilter,
  customDateRange,
  pipelineFilter,
  scoreFilter,
  onPeriodChange,
  onCustomDateRangeChange,
  onPipelineChange,
  onScoreChange,
}: DashboardFiltersProps) => {
  const [showCustom, setShowCustom] = useState(false);
  const { pipelines, isLoading: pipelinesLoading } = usePipelines();

  const handlePeriodClick = (value: string) => {
    if (value === 'custom') {
      setShowCustom(!showCustom);
      return;
    }
    setShowCustom(false);
    onPeriodChange(value);
  };

  const toggleScore = (s: number) => {
    if (scoreFilter.includes(s)) {
      onScoreChange(scoreFilter.filter(x => x !== s));
    } else {
      onScoreChange([...scoreFilter, s]);
    }
  };

  const activePeriodLabel = periodFilter === 'personalizado'
    ? customDateRange?.from && customDateRange?.to
      ? `${customDateRange.from.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${customDateRange.to.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
      : 'Personalizado'
    : null;

  return (
    <div className="space-y-3">
      {/* ── Main filter bar ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">

        {/* Period pills */}
        <div className="flex items-center gap-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => handlePeriodClick(p.value)}
              className={`
                h-[30px] px-3 text-xs font-semibold rounded-[4px] border transition-all duration-150
                ${periodFilter === p.value
                  ? 'bg-foreground text-background border-foreground '
                  : 'bg-card text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground'
                }
              `}
            >
              {p.label}
            </button>
          ))}
          {/* Custom date button */}
          <button
            onClick={() => handlePeriodClick('custom')}
            className={`
              h-[30px] px-3 text-xs font-semibold rounded-[4px] border transition-all duration-150 flex items-center gap-1.5
              ${periodFilter === 'personalizado'
                ? 'bg-foreground text-background border-foreground '
                : 'bg-card text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground'
              }
            `}
          >
            <CalendarRange className="w-3 h-3" />
            {activePeriodLabel ?? 'Customizado'}
          </button>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-border hidden sm:block" />

        {/* Pipeline select */}
        {!pipelinesLoading && pipelines.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Pipeline</span>
            <Select value={pipelineFilter} onValueChange={onPipelineChange}>
              <SelectTrigger className="h-[30px] text-xs border-border bg-card text-foreground w-auto min-w-[130px] rounded-[4px] font-medium focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="all" className="text-xs">Todos os pipelines</SelectItem>
                {pipelines.map(p => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Divider */}
        {!pipelinesLoading && pipelines.length > 0 && (
          <div className="h-5 w-px bg-border hidden sm:block" />
        )}

        {/* Score chips */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Score</span>
          <div className="flex items-center gap-1 flex-wrap">
            {SCORES.map(s => (
              <button
                key={s}
                onClick={() => toggleScore(s)}
                className={`
                  w-7 h-7 text-xs font-bold rounded-[4px] border transition-all duration-150
                  ${scoreFilter.includes(s)
                    ? scoreColor(s) + ' '
                    : 'bg-card text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'
                  }
                `}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ── Custom date range (slides in) ─────────────────────────────── */}
      {(showCustom || periodFilter === 'personalizado') && (
        <div className="flex items-center gap-3 pl-1">
          <span className="text-xs text-muted-foreground">Período:</span>
          <DateRangeFilter
            dateRange={customDateRange}
            onDateRangeChange={(range) => {
              onCustomDateRangeChange(range);
              if (range?.from && range?.to) onPeriodChange('personalizado');
            }}
            className="w-auto"
          />
        </div>
      )}
    </div>
  );
};
