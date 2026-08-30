import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const {
    user,
    isLoading,
    isPasswordRecovery,
    refreshProfile,
    signOut
  } = useAuth();
  const navigate = useNavigate();
  const { data: settings } = useSettings();
  const [mfaChecked, setMfaChecked] = useState(false);
  const [mfaChecking, setMfaChecking] = useState(false);
  const [mfaTimedOut, setMfaTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      console.log('🔒 Redirecionando para login');
      navigate('/login', { replace: true });
    }
  }, [user, isLoading, navigate]);

  // Redirecionar para reset-password se for fluxo de recuperação
  useEffect(() => {
    if (user && isPasswordRecovery && window.location.pathname !== '/reset-password') {
      navigate('/reset-password', { replace: true });
    }
  }, [user, isPasswordRecovery, navigate]);

  // Redirecionamento automático para usuários autenticados na página de login (exceto recovery)
  useEffect(() => {
    if (user && window.location.pathname === '/login' && !isPasswordRecovery) {
      navigate('/bipro', { replace: true });
    }
  }, [user, isPasswordRecovery, navigate]);

  // MFA guard: redirect gestores to /mfa-verify (AAL2 challenge) or /settings/mfa-setup (enrollment)
  useEffect(() => {
    if (!user?.profile || !settings || mfaChecked) return;

    const mfaExemptPaths = ['/settings/mfa-setup', '/settings/mfa-recovery-regenerate', '/settings/mfa-verify'];
    if (mfaExemptPaths.includes(window.location.pathname)) { setMfaChecked(true); return; }

    const isGestor = user.profile.gestor || user.profile.super_adm;
    const requiresMfa = settings.require_mfa_for_gestores ?? false;
    if (!isGestor || !requiresMfa) { setMfaChecked(true); return; }

    // Block children until async MFA check resolves
    setMfaChecking(true);
    setMfaTimedOut(false);

    const runMfaCheck = async () => {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const hasTotp = (factorsData?.totp ?? []).some((f) => f.status === 'verified');

      if (!hasTotp) {
        navigate('/settings/mfa-setup', { replace: true });
        setMfaChecked(true);
        setMfaChecking(false);
        return;
      }

      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData && aalData.currentLevel !== 'aal2') {
        navigate('/settings/mfa-verify', {
          replace: true,
          state: { from: window.location.pathname },
        });
      }
      setMfaChecked(true);
      setMfaChecking(false);
    };

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('mfa_timeout')), 5000)
    );

    Promise.race([runMfaCheck(), timeoutPromise]).catch((e: Error) => {
      if (e.message === 'mfa_timeout') {
        setMfaTimedOut(true);
        setMfaChecking(false);
      }
    });
  }, [user, settings, navigate, mfaChecked]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="text-center space-y-4">
          <div className="relative">
            <LoadingSpinner size="large" />
            <Loader2 className="w-4 h-4 animate-spin absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[#3366FF]" />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#6B7280] font-medium">Carregando sistema...</p>
            <p className="text-xs text-[#9CA3AF]">Por favor aguarde</p>
          </div>
        </div>
      </div>
    );
  }

  // Se não há usuário, não renderizar nada (o useEffect vai redirecionar)
  if (!user) {
    return null;
  }

  // Erro no perfil - mais tolerante
  if (!user.profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <Card className="max-w-md mx-auto p-6 border-orange-200 bg-orange-50 rounded-[4px]">
          <div className="text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-orange-600 mx-auto" />
            <h2 className="text-lg font-semibold text-orange-900">Perfil Incompleto</h2>
            <p className="text-orange-700 text-sm">
              Seu perfil não foi carregado completamente. Isso pode acontecer devido à conexão lenta.
            </p>
            <div className="space-y-2">
              <Button 
                onClick={refreshProfile} 
                className="w-full bg-[#3366FF] hover:bg-[#2952CC] text-white rounded-[4px]"
                disabled={isLoading}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {isLoading ? 'Carregando...' : 'Tentar Novamente'}
              </Button>
              
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline" 
                className="w-full rounded-[4px] border-[#E5E7EB]"
              >
                Recarregar Página
              </Button>
              
              <Button onClick={signOut} variant="ghost" className="w-full text-xs">
                Fazer Logout
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // MFA timed out — show retry UI
  if (mfaTimedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <Card className="max-w-md mx-auto p-6 border-orange-200 bg-orange-50 rounded-[4px]">
          <div className="text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-orange-600 mx-auto" />
            <h2 className="text-lg font-semibold text-orange-900">Verificação MFA lenta</h2>
            <p className="text-orange-700 text-sm">
              A verificação de autenticação demorou mais que o esperado.
            </p>
            <Button
              onClick={() => { setMfaTimedOut(false); setMfaChecked(false); }}
              className="w-full bg-[#3366FF] hover:bg-[#2952CC] text-white rounded-[4px]"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar novamente
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Block render while MFA async check is in flight
  if (mfaChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="text-center space-y-4">
          <div className="relative">
            <LoadingSpinner size="large" />
            <Loader2 className="w-4 h-4 animate-spin absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[#3366FF]" />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-[#6B7280] font-medium">Verificando autenticação...</p>
            <p className="text-xs text-[#9CA3AF]">Por favor aguarde</p>
          </div>
        </div>
      </div>
    );
  }

  // Sistema single-tenant - usuário autenticado pode acessar
  return <>{children}</>;
};

export default ProtectedRoute;