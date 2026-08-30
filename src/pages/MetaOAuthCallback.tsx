import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

type Status = 'loading' | 'success' | 'error';

export default function MetaOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Conectando sua conta Meta Ads...');
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    const rawReturnTo = sessionStorage.getItem('meta_oauth_return');
    sessionStorage.removeItem('meta_oauth_return');

    // FIX: Validate returnTo to prevent open redirect attacks
    const isSafeRedirect = (url: string | null): boolean => {
      if (!url) return false;
      // Only allow relative paths (starting with /)
      if (url.startsWith('/') && !url.startsWith('//')) return true;
      return false;
    };

    const returnTo = isSafeRedirect(rawReturnTo) ? rawReturnTo : null;
    const defaultRedirect = returnTo ?? '/settings/general/integracoes?tab=meta-ads';

    // User denied permission
    if (error) {
      const msg = errorDescription ?? 'Autorização negada pelo usuário.';
      setStatus('error');
      setMessage(msg);
      toast.error(msg);
      setTimeout(() => navigate(defaultRedirect), 3000);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('Código de autorização não encontrado.');
      toast.error('Código de autorização não encontrado na URL.');
      setTimeout(() => navigate(defaultRedirect), 3000);
      return;
    }

    // Validate state to prevent CSRF
    const savedState = sessionStorage.getItem('meta_oauth_state');
    if (state !== savedState) {
      setStatus('error');
      setMessage('Falha de segurança na autenticação. Tente novamente.');
      toast.error('CSRF state mismatch — tente novamente.');
      setTimeout(() => navigate(defaultRedirect), 3000);
      return;
    }
    sessionStorage.removeItem('meta_oauth_state');

    const redirectUri = `${window.location.origin}/oauth/meta/callback`;

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

        const { data, error: fnError } = await supabase.functions.invoke('bi-meta-oauth', {
          body: { code, redirect_uri: redirectUri },
        });

        if (fnError || !data?.success) {
          const errMsg = data?.error ?? fnError?.message ?? 'Erro ao conectar conta Meta.';
          console.error('[MetaOAuth] Error:', errMsg);
          setStatus('error');
          setMessage(errMsg);
          toast.error(`Meta OAuth falhou: ${errMsg}`, { duration: 8000 });
          setTimeout(() => navigate(defaultRedirect), 5000);
          return;
        }

        if (!data.access_token) {
          setStatus('error');
          setMessage('Token de acesso não retornado pela Meta.');
          toast.error('Token não retornado — verifique as credenciais do App Meta.');
          setTimeout(() => navigate(defaultRedirect), 5000);
          return;
        }

        if (returnTo) {
          // Coming from Lead Forms — store token separately for MetaPageSelector
          sessionStorage.setItem('meta_leadforms_oauth_pending', JSON.stringify({
            access_token: data.access_token,
          }));
          setStatus('success');
          setMessage('Autorizado! Selecione a Page para receber leads.');
          toast.success('Meta autorizado! Redirecionando...');
          setTimeout(() => navigate(returnTo), 2000);
        } else {
          // Default Ads flow
          sessionStorage.setItem('meta_oauth_pending', JSON.stringify({
            accounts: data.accounts ?? [],
            access_token: data.access_token,
            refresh_token: null,
            token_expires_at: data.token_expires_at,
          }));

          const count = data.accounts?.length ?? 0;
          setStatus('success');
          setMessage(
            count > 0
              ? `${count} conta${count > 1 ? 's' : ''} encontrada${count > 1 ? 's' : ''}. Selecione quais deseja adicionar.`
              : 'Autorizado! Nenhuma conta de anúncio encontrada.'
          );
          toast.success('Meta Ads autorizado!');
          setTimeout(() => navigate('/settings/general/integracoes?tab=meta-ads'), 2000);
        }
      } catch (err) {
        const errMsg = (err as Error).message ?? 'Erro inesperado';
        console.error('[MetaOAuth] Unexpected error:', err);
        setStatus('error');
        setMessage(errMsg);
        toast.error(`Erro inesperado: ${errMsg}`, { duration: 8000 });
        setTimeout(() => navigate(defaultRedirect), 5000);
      }
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
