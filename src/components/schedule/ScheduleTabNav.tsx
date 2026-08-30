import { useLocation, Link } from 'react-router-dom';
import { CalendarDays, Zap, CalendarCheck2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Agendamentos', to: '/schedule',                        icon: CalendarDays },
  { label: 'Automações (Config)',   to: '/settings/schedule/automacoes',    icon: Zap },
  { label: 'Calendário',   to: '/schedule/calendario',              icon: CalendarCheck2 },
];

export function ScheduleTabNav() {
  const { pathname } = useLocation();

  return (
    <div className="flex-none h-[45px] border-b border-border bg-zinc-100 dark:bg-zinc-950 shrink-0">
      <div className="flex items-center h-full px-6">
        {tabs.map(({ label, to, icon: Icon }) => {
          const active = to === '/schedule' ? pathname === '/schedule' : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-1.5 px-4 h-full text-[13px] font-medium transition-colors border-b-2',
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
