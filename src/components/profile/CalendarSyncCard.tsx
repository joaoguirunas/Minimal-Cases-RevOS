import { useState } from 'react';
import { CalendarCheck, CalendarX, Loader2, Plus, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  useCalendarConnections,
  useDisconnectCalendar,
  usePatchCalendarSync,
  type CalendarConnection,
} from '@/hooks/useCalendarConnections';
import { useGoogleOAuthConfig } from '@/hooks/useGoogleOAuthConfig';
import { useCalcomConnection, useDisconnectCalcom, usePatchCalcomSettings } from '@/hooks/useCalcomConnection';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SYNC_TOOLTIP =
  'Quando ativado, agendamentos criados pelo Growth Sales são adicionados a este calendário. Quando desativado, o calendário é usado apenas para verificar disponibilidade.';

function isGoogle(conn: CalendarConnection) {
  return conn.provider === 'google' || (!!conn.google_email && conn.provider !== 'microsoft');
}

function connectionEmail(conn: CalendarConnection) {
  return isGoogle(conn) ? conn.google_email : conn.ms_email;
}

export function CalendarSyncCard() {
  const { data: connections, isLoading } = useCalendarConnections();
  const disconnect = useDisconnectCalendar();
  const patchSync = usePatchCalendarSync();
  const { data: googleConfig } = useGoogleOAuthConfig();
  const { data: msConfig } = useQuery({
    queryKey: ['ms-oauth-config'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: async () => { const { data } = await (supabase as any).from('bi_settings').select('ms_client_id').eq('singleton', true).maybeSingle(); return data ?? null; },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: calcomConn } = useCalcomConnection();
  const disconnectCalcom = useDisconnectCalcom();
  const patchCalcom = usePatchCalcomSettings();

  const [addOpen, setAddOpen] = useState(false);

  const handleConnectCalcom = async () => {
    const clientId = '3e2ebcc258be7431d30bcd255c4d46ac1fb3171738e3e247caf309f80ed08bd2';
    const redirectUri = `${window.location.origin}/oauth/calcom/callback`;
    const state = crypto.randomUUID();

    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const codeVerifier = btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const encoder = new TextEncoder();
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    sessionStorage.setItem('calcomOAuthState', state);
    sessionStorage.setItem('calcomCodeVerifier', codeVerifier);

    const scopes = [
      'BOOKING_READ', 'BOOKING_WRITE',
      'EVENT_TYPE_READ',
      'SCHEDULE_READ',
      'APPS_READ',
      'WEBHOOK_READ', 'WEBHOOK_WRITE',
      'PROFILE_READ',
    ].join(' ');

    const authUrl =
      `https://app.cal.com/auth/oauth2/authorize` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&state=${state}` +
      `&code_challenge=${codeChallenge}` +
      `&code_challenge_method=S256`;

    window.location.href = authUrl;
  };

  const handleDisconnectCalcom = async () => {
    try {
      await disconnectCalcom.mutateAsync();
      toast.success('Cal.com desconectado.');
    } catch {
      toast.error('Erro ao desconectar Cal.com.');
    }
  };

  const handleConnectGoogleCalendar = () => {
    const clientId = googleConfig?.google_client_id ?? import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toast.error('Google não configurado. O administrador deve configurar em Configurações → Google.');
      return;
    }
    const redirectUri = `${window.location.origin}/oauth/google/callback`;
    const state = crypto.randomUUID();
    sessionStorage.setItem('googleCalendarOAuthState', state);
    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' ');
    const authUrl =
      `https://accounts.google.com/o/oauth2/auth` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&response_type=code&access_type=offline&prompt=consent` +
      `&state=${state}`;
    window.location.href = authUrl;
  };

  const handleConnectMSTeams = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientId = (msConfig as any)?.ms_client_id ?? import.meta.env.VITE_MS_CLIENT_ID;
    if (!clientId) {
      toast.error('Microsoft Teams não configurado. O administrador deve configurar em Configurações → Microsoft Teams.');
      return;
    }
    const redirectUri = `${window.location.origin}/oauth/microsoft/callback`;
    const state = crypto.randomUUID();
    sessionStorage.setItem('msTeamsOAuthState', state);
    const scopes = ['OnlineMeetings.ReadWrite', 'offline_access', 'User.Read'].join(' ');
    const authUrl =
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&response_type=code&prompt=consent` +
      `&state=${state}`;
    window.location.href = authUrl;
  };

  const handleDisconnect = async (id: string) => {
    try {
      await disconnect.mutateAsync(id);
      toast.success('Calendário desconectado.');
    } catch {
      toast.error('Erro ao desconectar calendário.');
    }
  };

  const handleToggleSync = async (id: string, sync_booking: boolean) => {
    try {
      await patchSync.mutateAsync({ id, sync_booking });
    } catch {
      toast.error('Erro ao atualizar sincronização.');
    }
  };

  const list = connections ?? [];

  return (
    <Card className="p-6 rounded-[2px]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold">Calendário &amp; Videoconferência</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Conecte uma ou mais contas de Google Agenda e Microsoft Teams para verificar
            disponibilidade e gerar links de reunião automaticamente.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-[4px] h-[30px] text-xs shrink-0"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Adicionar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Verificando conexões...
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 rounded-[4px] border border-dashed border-border text-center">
          <CalendarX className="w-6 h-6 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Nenhum calendário conectado</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Conecte uma conta para gerar links de reunião e checar disponibilidade.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-[4px] h-[30px] text-xs"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Conectar calendário
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((conn) => {
            const google = isGoogle(conn);
            const email = connectionEmail(conn);
            const togglePending = patchSync.isPending && patchSync.variables?.id === conn.id;
            const disconnectPending = disconnect.isPending && disconnect.variables === conn.id;
            return (
              <div
                key={conn.id}
                className={`p-3 rounded-[4px] border ${google ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-blue-500/30 bg-blue-500/5'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CalendarCheck className={`w-4 h-4 shrink-0 ${google ? 'text-emerald-500' : 'text-blue-500'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{email}</p>
                      <p className="text-xs text-muted-foreground">
                        {google ? 'Google Agenda' : 'Microsoft Teams'}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-[4px] h-[30px] text-xs text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0"
                    onClick={() => handleDisconnect(conn.id)}
                    disabled={disconnectPending}
                  >
                    {disconnectPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarX className="w-3.5 h-3.5 mr-1.5" />}
                    Desconectar
                  </Button>
                </div>

                <div className="mt-3 pt-3 border-t border-border/60 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-1.5 min-w-0">
                    <span className="text-xs text-muted-foreground leading-snug text-balance">
                      Sincronizar com Growth Sales
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-muted-foreground hover:text-foreground shrink-0 mt-px" aria-label="Sobre a sincronização">
                          <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[260px] text-xs">
                        {SYNC_TOOLTIP}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    checked={conn.sync_booking}
                    disabled={togglePending}
                    onCheckedChange={(checked) => handleToggleSync(conn.id, checked)}
                    aria-label="Sincronizar com eventos Growth Sales"
                    className="shrink-0 mt-px"
                  />
                </div>
              </div>
            );
          })}

          {/* Cal.com card hidden until OAuth approval */}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-[4px] sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Adicionar calendário</DialogTitle>
            <DialogDescription>
              Escolha o provedor para conectar uma nova conta.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setAddOpen(false); handleConnectGoogleCalendar(); }}
              className="flex items-center gap-3 p-3 rounded-[4px] border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-left transition-colors"
            >
              <CalendarCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Google Calendar</p>
                <p className="text-xs text-muted-foreground">Sincronize eventos e gere links Google Meet</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => { setAddOpen(false); handleConnectMSTeams(); }}
              className="flex items-center gap-3 p-3 rounded-[4px] border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-left transition-colors"
            >
              <CalendarCheck className="w-5 h-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Microsoft Teams</p>
                <p className="text-xs text-muted-foreground">Crie reuniões Teams automaticamente</p>
              </div>
            </button>
            {/* Cal.com option hidden until OAuth approval */}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
