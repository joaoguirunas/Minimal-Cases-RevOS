import { useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useNotificationPreferences,
  useUpdateNotificationPreference,
  useSnoozeNotifications,
  ALL_EVENT_TYPES,
  ALL_CHANNELS,
  EVENT_LABELS,
  CHANNEL_LABELS,
  type NotificationEventType,
  type NotificationChannel,
} from "@/hooks/useNotificationPreferences";

// ── Section header ─────────────────────────────────────────────────────────────
const SectionHeader = ({ title }: { title: string }) => (
  <div className="px-5 py-2.5 bg-muted border-b border-border">
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{title}</p>
  </div>
);

// ── Snooze banner ──────────────────────────────────────────────────────────────
const SNOOZE_OPTIONS = [
  { label: "1 hora", hours: 1 },
  { label: "4 horas", hours: 4 },
  { label: "8 horas", hours: 8 },
  { label: "24 horas", hours: 24 },
];

function SnoozeBanner({ snoozedUntil }: { snoozedUntil: string | null }) {
  const snooze = useSnoozeNotifications();
  const [selectedHours, setSelectedHours] = useState("1");

  const isActive = snoozedUntil !== null && new Date(snoozedUntil) > new Date();

  const handleSnooze = async () => {
    const hours = parseInt(selectedHours);
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    try {
      await snooze.mutateAsync(until);
      toast.success(`Notificações pausadas por ${hours}h`);
    } catch {
      toast.error("Erro ao pausar notificações");
    }
  };

  const handleResume = async () => {
    try {
      await snooze.mutateAsync(null);
      toast.success("Notificações retomadas");
    } catch {
      toast.error("Erro ao retomar notificações");
    }
  };

  const formatUntil = (iso: string) =>
    new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  return (
    <div className="border border-border rounded-[2px] overflow-hidden">
      <SectionHeader title="PAUSAR NOTIFICAÇÕES" />
      <div className="px-5 py-4">
        {isActive ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BellOff className="w-4 h-4 text-amber-500" />
              <span className="text-[13px] text-foreground">
                Notificações pausadas até <span className="font-semibold">{formatUntil(snoozedUntil!)}</span>
              </span>
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/5">
                Pausado
              </Badge>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleResume}
              disabled={snooze.isPending}
              className="h-7 text-[12px]"
            >
              {snooze.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Retomar agora"}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
            <span className="text-[12px] text-muted-foreground/70">Pausar todas as notificações por:</span>
            <Select value={selectedHours} onValueChange={setSelectedHours}>
              <SelectTrigger className="h-[30px] text-[12px] w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SNOOZE_OPTIONS.map((o) => (
                  <SelectItem key={o.hours} value={String(o.hours)} className="text-[12px]">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleSnooze}
              disabled={snooze.isPending}
              className="h-[30px] text-[12px]"
            >
              {snooze.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Pausar"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Preferences matrix ─────────────────────────────────────────────────────────
function PreferencesMatrix() {
  const { data: prefs = [], isLoading } = useNotificationPreferences();
  const updatePref = useUpdateNotificationPreference();

  // Build lookup: event+channel → enabled (default true if not set)
  const lookup = new Map<string, boolean>();
  const snoozeMap = new Map<string, string | null>();
  for (const p of prefs) {
    lookup.set(`${p.event_type}:${p.channel}`, p.enabled);
    if (p.snoozed_until) snoozeMap.set(p.user_id, p.snoozed_until);
  }

  const isEnabled = (event: NotificationEventType, channel: NotificationChannel) =>
    lookup.get(`${event}:${channel}`) ?? true;

  // Get global snooze from first pref with snoozed_until
  const snoozedUntil = prefs.find((p) => p.snoozed_until)?.snoozed_until ?? null;

  const handleToggle = async (event_type: NotificationEventType, channel: NotificationChannel, enabled: boolean) => {
    try {
      await updatePref.mutateAsync({ event_type, channel, enabled });
    } catch {
      toast.error("Erro ao salvar preferência");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SnoozeBanner snoozedUntil={snoozedUntil} />

      <div className="border border-border rounded-[2px] overflow-hidden">
        <SectionHeader title="PREFERÊNCIAS POR EVENTO E CANAL" />

        {/* Column headers */}
        <div className="flex items-center px-5 py-2.5 bg-muted/40 border-b border-border">
          <div className="flex-1" />
          {ALL_CHANNELS.map((channel) => (
            <div key={channel} className="w-20 text-center">
              <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide">
                {CHANNEL_LABELS[channel]}
              </span>
            </div>
          ))}
        </div>

        {/* Rows */}
        {ALL_EVENT_TYPES.map((event, i) => (
          <div
            key={event}
            className={cn(
              "flex items-center px-5 py-3.5",
              i < ALL_EVENT_TYPES.length - 1 && "border-b border-border"
            )}
          >
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-foreground">{EVENT_LABELS[event]}</p>
            </div>
            {ALL_CHANNELS.map((channel) => (
              <div key={channel} className="w-20 flex justify-center">
                <Switch
                  checked={isEnabled(event, channel)}
                  onCheckedChange={(checked) => handleToggle(event, channel, checked)}
                  disabled={updatePref.isPending}
                  className="scale-90"
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const NotificacoesConfig = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[15px] font-semibold text-foreground">Central de Notificações</h2>
        <p className="text-[12px] text-muted-foreground/60 mt-0.5">
          Configure quais eventos geram notificações e por qual canal. Preferências são pessoais — cada usuário configura as suas.
        </p>
      </div>
      <PreferencesMatrix />
    </div>
  );
};

export default NotificacoesConfig;
