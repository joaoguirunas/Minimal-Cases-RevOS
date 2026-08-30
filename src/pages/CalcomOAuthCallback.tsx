import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

type Status = 'loading' | 'success' | 'error';

export default function CalcomOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Conectando Cal.com...');
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
      setTimeout(() => navigate('/profile'), 4000);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('Código de autorização não encontrado.');
      setTimeout(() => navigate('/profile'), 4000);
      return;
    }

    // Validate CSRF state
    const savedState = sessionStorage.getItem('calcomOAuthState');
    if (!savedState || state !== savedState) {
      setStatus('error');
      setMessage('Falha de segurança na autenticação. Tente novamente.');
      setTimeout(() => navigate('/profile'), 4000);
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

      const redirectUri = `${window.location.origin}/oauth/calcom/callback`;
      const codeVerifier = sessionStorage.getItem('calcomCodeVerifier');
      sessionStorage.removeItem('calcomOAuthState');
      sessionStorage.removeItem('calcomCodeVerifier');

      const { data, error: fnError } = await supabase.functions.invoke('calcom-connect', {
        body: { code, redirect_uri: redirectUri, code_verifier: codeVerifier },
      });

      if (fnError || !data?.success) {
        let errMsg = data?.error ?? 'Erro ao conectar Cal.com.';
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
      setMessage(`Cal.com conectado: ${data.username ?? ''}`);
      setTimeout(() => navigate('/profile?section=calendar&connected=calcom'), 2000);
    };

    exchange();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm px-6">
        {status === 'loading' && <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" />}
        {status === 'success' && <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />}
        {status === 'error' && <XCircle className="w-10 h-10 text-red-500 mx-auto" />}
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">
          {status !== 'loading' ? 'Redirecionando...' : 'Aguarde, isso leva alguns segundos.'}
        </p>
      </div>
    </div>
  );
}
