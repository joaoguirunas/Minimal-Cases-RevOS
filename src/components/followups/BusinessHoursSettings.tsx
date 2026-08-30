import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBusinessHoursSettings, useUpdateBusinessHoursSettings, type BusinessHoursSettings } from '@/hooks/useBusinessHours';

const DAYS = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number) {
  return `${String(h).padStart(2, '0')}:00`;
}

function formatDaysSummary(days: number[]) {
  const s = [...days].sort();
  if (JSON.stringify(s) === JSON.stringify([1, 2, 3, 4, 5])) return 'Seg–Sex';
  if (JSON.stringify(s) === JSON.stringify([1, 2, 3, 4, 5, 6])) return 'Seg–Sáb';
  if (JSON.stringify(s) === JSON.stringify([0, 1, 2, 3, 4, 5, 6])) return 'Todos os dias';
  return s.map(d => DAYS.find(x => x.value === d)?.label).filter(Boolean).join(', ');
}

export const BusinessHoursSettings = () => {
  const { data: settings, isLoading } = useBusinessHoursSettings();
  const update = useUpdateBusinessHoursSettings();
  const [isExpanded, setIsExpanded] = useState(false);
  const [draft, setDraft] = useState<BusinessHoursSettings | null>(null);

  useEffect(() => {
    if (settings && !draft) {
      setDraft({ ...settings });
    }
  }, [settings]);

  const upd = (patch: Partial<BusinessHoursSettings>) =>
    setDraft(prev => prev ? { ...prev, ...patch } : prev);

  const toggleDay = (day: number) => {
    if (!draft) return;
    const has = draft.days_of_week.includes(day);
    const next = has
      ? draft.days_of_week.filter(d => d !== day)
      : [...draft.days_of_week, day];
    if (next.length === 0) return; // must have at least one day
    upd({ days_of_week: next });
  };

  const handleSave = () => {
    if (!draft) return;
    update.mutate(draft, { onSuccess: () => setIsExpanded(false) });
  };

  const handleCancel = () => {
    if (settings) setDraft({ ...settings });
    setIsExpanded(false);
  };

  if (isLoading || !settings || !draft) return null;

  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings);

  return (
    <div className="border border-border rounded-[4px] overflow-hidden">
      {/* Header bar */}
      <button
        type="button"
        onClick={() => setIsExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-card hover:bg-white/[0.035] transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" strokeWidth={1.5} />
          <span className="text-[12px] font-semibold text-foreground/80">Horário Comercial</span>

          {/* Status dot */}
          <span className={cn(
            'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none',
            settings.enabled
              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 border-emerald-200/30'
              : 'text-muted-foreground/50 bg-transparent border-border'
          )}>
            <span className={cn('w-1 h-1 rounded-full', settings.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
            {settings.enabled ? 'Ativo' : 'Inativo'}
          </span>

          {settings.enabled && (
            <span className="text-[11px] text-muted-foreground/50">
              {formatDaysSummary(settings.days_of_week)} · {formatHour(settings.start_hour)} – {formatHour(settings.end_hour)}
            </span>
          )}
        </div>

        {isExpanded
          ? <ChevronUp  className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" strokeWidth={1.5} />
          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" strokeWidth={1.5} />
        }
      </button>

      {/* Expanded settings */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4 bg-card/50">

          {/* Enable toggle */}
          <div className="flex items-center gap-2.5">
            <Switch
              id="bh-enabled"
              checked={draft.enabled}
              onCheckedChange={v => upd({ enabled: v })}
            />
            <Label htmlFor="bh-enabled" className="text-[13px]">
              Ativar restrição de horário comercial
            </Label>
          </div>

          <div className={cn('space-y-4', !draft.enabled && 'opacity-40 pointer-events-none')}>

            {/* Days of week */}
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground/60 font-medium uppercase tracking-wide">Dias úteis</p>
              <div className="flex gap-1.5 flex-wrap">
                {DAYS.map(d => {
                  const active = draft.days_of_week.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDay(d.value)}
                      className={cn(
                        'w-9 h-8 rounded-[4px] text-[11px] font-medium border transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/40'
                      )}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hours range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground/60">Abre às</p>
                <select
                  value={draft.start_hour}
                  onChange={e => upd({ start_hour: parseInt(e.target.value, 10) })}
                  className="w-full h-8 rounded-[4px] border border-border bg-background px-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {HOURS.filter(h => h < draft.end_hour).map(h => (
                    <option key={h} value={h}>{formatHour(h)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground/60">Fecha às</p>
                <select
                  value={draft.end_hour}
                  onChange={e => upd({ end_hour: parseInt(e.target.value, 10) })}
                  className="w-full h-8 rounded-[4px] border border-border bg-background px-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {HOURS.filter(h => h > draft.start_hour).map(h => (
                    <option key={h} value={h}>{formatHour(h)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* bh_only_last — global dedup toggle */}
            <div className="flex items-center gap-2.5 pt-1 border-t border-border">
              <Switch
                id="bh-only-last"
                checked={draft.bh_only_last}
                onCheckedChange={v => upd({ bh_only_last: v })}
              />
              <Label htmlFor="bh-only-last" className="text-[13px] leading-snug cursor-pointer">
                Apenas o último
                <span className="block text-[11px] text-muted-foreground/50 font-normal">
                  Se múltiplos follow-ups forem reprogramados para o mesmo horário, envia apenas o mais recente
                </span>
              </Label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1 border-t border-border">
            <Button
              type="button" size="sm" variant="outline"
              onClick={handleCancel}
              className="h-[30px] text-xs rounded-[4px]"
            >
              Cancelar
            </Button>
            <Button
              type="button" size="sm"
              onClick={handleSave}
              disabled={!isDirty || update.isPending}
              className="h-[30px] text-xs rounded-[4px]"
            >
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
