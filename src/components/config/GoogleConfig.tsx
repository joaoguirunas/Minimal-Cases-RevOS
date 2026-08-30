import { useSettings } from "@/hooks/useSettings";
import { useCalendarConnectionsHealth } from "@/hooks/useCalendarConnectionsHealth";
import { useUpdateSettings } from "@/hooks/useSettings";
import { Loader2 } from "lucide-react";
import GoogleWizard, { WizardState } from "./wizard/GoogleWizard";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export default function GoogleConfig() {
  const { data: settings, isLoading } = useSettings();
  const { data: connections = [] } = useCalendarConnectionsHealth();
  const saveSettings = useUpdateSettings();
  const queryClient = useQueryClient();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  const isIdSaved = !!settings?.google_client_id;
  const isSecretSaved = !!settings?.google_client_secret;
  const hasHealthy = connections.some(c => c.status === 'healthy');
  const hasConnections = connections.length > 0;

  const wizardState: WizardState = (() => {
    if (!isIdSaved && !isSecretSaved) return 'unconfigured';
    if (isIdSaved && !isSecretSaved) return 'returning';
    if (isIdSaved && isSecretSaved && hasHealthy) return 'healthy';
    if (isIdSaved && isSecretSaved && hasConnections && !hasHealthy) return 'error';
    return 'configured';
  })();

  const handleDisconnectAll = async () => {
    await (supabase as any)
      .from('user_calendar_connections')
      .update({ is_active: false })
      .neq('user_id', '00000000-0000-0000-0000-000000000000');
    queryClient.invalidateQueries({ queryKey: ['calendar-connections-health'] });
  };

  return (
    <GoogleWizard
      wizardState={wizardState}
      isIdSaved={isIdSaved}
      isSecretSaved={isSecretSaved}
      connections={connections}
      onDisconnectAll={handleDisconnectAll}
    />
  );
}
