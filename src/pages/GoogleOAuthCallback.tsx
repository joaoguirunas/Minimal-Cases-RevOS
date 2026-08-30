import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

type Status = 'loading' | 'success' | 'error';

export default function GoogleOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Conectando conta Google...');
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage('Autorização negada pelo usuário.');
      setTimeout(() => navigate('/bipro'), 3000);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('Código de autorização não encontrado.');
      setTimeout(() => navigate('/bipro'), 3000);
      return;
    }

    const redirectUri = `${window.location.origin}/oauth/google/callback`;

    // === Check which OAuth flow this is: Calendar or Ads ===
    const calendarState = sessionStorage.getItem('googleCalendarOAuthState');
    const adsState = sessionStorage.getItem('google_oauth_state');

    const isCalendarFlow = calendarState && state === calendarState;
    const isAdsFlow = adsState && state === adsState;

    if (!isCalendarFlow && !isAdsFlow) {
      setStatus('error');
      setMessage('Falha de segurança na autenticação. Tente novamente.');
      setTimeout(() => navigate('/bipro'), 3000);
      return;
    }

    const exchange = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus('error');
        setMessage('Sessão expirada. Faça login novamente.');
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      // === Google Calendar flow ===
      if (isCalendarFlow) {
        sessionStorage.removeItem('googleCalendarOAuthState');
        setMessage('Conectando Google Agenda...');

        const { data, error: fnError } = await supabase.functions.invoke('google-cal-connect', {
          body: { code, redirect_uri: redirectUri },
        });

        if (fnError || !data?.success) {
          // Try to extract the real error message from the edge function response
          let errMsg = data?.error ?? 'Erro ao conectar Google Agenda.';
          if (!data?.error && fnError) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const body = await (fnError as any).context?.json?.();
              errMsg = body?.error ?? fnError.message ?? errMsg;
            } catch {
              errMsg = fnError.message ?? errMsg;
            }
          }
          setStatus('error');
          setMessage(errMsg);
          setTimeout(() => navigate('/profile'), 4000);
          return;
        }

        setStatus('success');
        setMessage(`Google Agenda conectado: ${data.google_email}`);
        setTimeout(() => navigate('/profile?section=calendar&connected=true'), 2000);
        return;
      }

      // === Google Ads flow ===
      sessionStorage.removeItem('google_oauth_state');
      setMessage('Conectando Google Ads...');

      const { data, error: fnError } = await supabase.functions.invoke('bi-google-oauth', {
        body: { code, redirect_uri: redirectUri },
      });

      if (fnError || !data?.success) {
        setStatus('error');
        setMessage(data?.error ?? fnError?.message ?? 'Erro ao conectar conta Google Ads.');
        setTimeout(() => navigate('/settings/general/integracoes?tab=google-ads'), 4000);
        return;
      }

      // Store pending accounts + tokens for selection in AdsConfig (read on mount)
      sessionStorage.setItem('google_oauth_pending', JSON.stringify({
        accounts: data.accounts ?? [],
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_expires_at: data.token_expires_at,
        has_developer_token: data.has_developer_token ?? false,
        enable_api_url: data.enable_api_url ?? undefined,
      }));

      const count = data.accounts?.length ?? 0;
      setStatus('success');
      setMessage(
        count > 0
          ? `${count} conta${count > 1 ? 's' : ''} encontrada${count > 1 ? 's' : ''}. Selecione quais deseja adicionar.`
          : 'Autorizado! Insira o Customer ID da sua conta Google Ads para concluir.'
      );
      setTimeout(() => navigate('/settings/general/integracoes?tab=google-ads'), 2000);
    };

    exchange();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm px-6">
        {status === 'loading' && (
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
        )}
        {status === 'success' && (
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
        )}
        {status === 'error' && (
          <XCircle className="w-10 h-10 text-red-500 mx-auto" />
        )}
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">
          {status !== 'loading' ? 'Redirecionando...' : 'Aguarde, isso leva alguns segundos.'}
        </p>
      </div>
    </div>
  );
}
