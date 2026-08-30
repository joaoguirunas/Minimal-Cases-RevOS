import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NotificationEventType =
  | "lead_assigned"
  | "followup_due"
  | "meeting_scheduled"
  | "transcript_ready"
  | "word_spotting_triggered";

export type NotificationChannel = "in_app" | "email" | "whatsapp";

export interface NotificationPreference {
  id: string;
  user_id: string;
  event_type: NotificationEventType;
  channel: NotificationChannel;
  enabled: boolean;
  snoozed_until: string | null;
}

// Canonical defaults — all enabled, no snooze
export const ALL_EVENT_TYPES: NotificationEventType[] = [
  "lead_assigned",
  "followup_due",
  "meeting_scheduled",
  "transcript_ready",
  "word_spotting_triggered",
];

export const ALL_CHANNELS: NotificationChannel[] = ["in_app", "email", "whatsapp"];

export const EVENT_LABELS: Record<NotificationEventType, string> = {
  lead_assigned: "Novo lead atribuído",
  followup_due: "Follow-up vencendo (24h)",
  meeting_scheduled: "Reunião agendada",
  transcript_ready: "Transcrição pronta",
  word_spotting_triggered: "Word spotting disparado",
};

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  in_app: "In-app",
  email: "Email",
  whatsapp: "WhatsApp",
};

export function useNotificationPreferences() {
  return useQuery<NotificationPreference[]>({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_notification_preferences")
        .select("*");

      if (error) throw error;
      return (data ?? []) as NotificationPreference[];
    },
    staleTime: 60 * 1000,
  });
}

export function useUpdateNotificationPreference() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      event_type,
      channel,
      enabled,
    }: {
      event_type: NotificationEventType;
      channel: NotificationChannel;
      enabled: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_notification_preferences")
        .upsert(
          { user_id: user.id, event_type, channel, enabled, updated_at: new Date().toISOString() },
          { onConflict: "user_id,event_type,channel" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });
}

export function useSnoozeNotifications() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (snoozedUntil: string | null) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upsert a snooze sentinel row for each event/channel combination
      const rows = ALL_EVENT_TYPES.flatMap((event_type) =>
        ALL_CHANNELS.map((channel) => ({
          user_id: user.id,
          event_type,
          channel,
          enabled: true,
          snoozed_until: snoozedUntil,
          updated_at: new Date().toISOString(),
        }))
      );

      const { error } = await supabase
        .from("user_notification_preferences")
        .upsert(rows, { onConflict: "user_id,event_type,channel" });

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });
}
