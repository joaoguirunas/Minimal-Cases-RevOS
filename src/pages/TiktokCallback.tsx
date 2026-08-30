import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

type Status = 'loading' | 'success' | 'error';

const DEFAULT_REDIRECT = '/settings/general/integracoes?tab=tiktok';

export default function TiktokCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Conectando sua conta TikTok...');
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const code  = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // User denied / platform returned error
    if (error) {
      const msg = errorDescription ?? 'Autorização negada pelo usuário.';
      setStatus('error');
      setMessage(msg);
      toast.error(msg);
      setTimeout(() => navigate(DEFAULT_REDIRECT), 3000);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('Código de autorização não encontrado na URL.');
      toast.error('Código de autorização não encontrado na URL.');
      setTimeout(() => navigate(DEFAULT_REDIRECT), 3000);
      return;
    }

    // Validate CSRF state
    const savedState = sessionStorage.getItem('tiktok_oauth_state');
    if (state && savedState && state !== savedState) {
      setStatus('error');
      setMessage('Falha de segurança na autenticação. Tente novamente.');
      toast.error('CSRF state mismatch — tente novamente.');
      setTimeout(() => navigate(DEFAULT_REDIRECT), 3000);
      return;
    }
    sessionStorage.removeItem('tiktok_oauth_state');

    const redirectUri = `${window.location.origin}/tiktok/callback`;

    const exchange = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setStatus('error');
          setMessage('Sessão expirada. Faça login novamente.');
          toast.error('Sessão expirada.');
          setTimeout(() => navigate('/login'), 2000);
          return;
        }

        const { data, error: fnError } = await supabase.functions.invoke(
          'tiktok-oauth-callback',
          { body: { code, state, redirect_uri: redirectUri } },
        );

        if (fnError || !data?.success) {
          const errMsg = data?.error ?? fnError?.message ?? 'Erro ao conectar conta TikTok.';
          console.error('[TikTokOAuth] Error:', errMsg);
          setStatus('error');
          setMessage(errMsg);
          toast.error(`TikTok OAuth falhou: ${errMsg}`, { duration: 8000 });
          setTimeout(() => navigate(DEFAULT_REDIRECT), 5000);
          return;
        }

        setStatus('success');
        setMessage('Conta TikTok conectada com sucesso!');
        toast.success('TikTok conectado!');
        setTimeout(() => navigate(DEFAULT_REDIRECT + '&connected=1'), 2000);
      } catch (err) {
        const errMsg = (err as Error).message ?? 'Erro inesperado';
        console.error('[TikTokOAuth] Unexpected error:', err);
        setStatus('error');
        setMessage(errMsg);
        toast.error(`Erro inesperado: ${errMsg}`, { duration: 8000 });
        setTimeout(() => navigate(DEFAULT_REDIRECT), 5000);
      }
    };

    exchange();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="rounded-[6px] border border-border bg-card p-10 text-center space-y-4 max-w-sm w-full mx-6 shadow-sm">
        {/* TikTok logo-ish indicator */}
        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          {status === 'loading' && (
            <Loader2 className="w-6 h-6 text-primary animate-spin" strokeWidth={1.5} />
          )}
          {status === 'success' && (
            <CheckCircle className="w-6 h-6 text-emerald-500" strokeWidth={1.5} />
          )}
          {status === 'error' && (
            <XCircle className="w-6 h-6 text-destructive" strokeWidth={1.5} />
          )}
        </div>

        <div className="space-y-1">
          <p className="text-[14px] font-semibold text-foreground">TikTok</p>
          <p className="text-[13px] text-muted-foreground">{message}</p>
        </div>

        <p className="text-[11px] text-muted-foreground/60">
          {status === 'loading'
            ? 'Aguarde, isso leva alguns segundos...'
            : 'Redirecionando...'}
        </p>
      </div>
    </div>
  );
}
