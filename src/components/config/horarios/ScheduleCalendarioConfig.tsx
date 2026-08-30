import { CalendarSyncCard } from '@/components/profile/CalendarSyncCard';

export default function ScheduleCalendarioConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Calendário &amp; Videoconferência</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sincronize seu calendário para gerar links de reunião automaticamente ao agendar.
        </p>
      </div>
      <CalendarSyncCard />
    </div>
  );
}
