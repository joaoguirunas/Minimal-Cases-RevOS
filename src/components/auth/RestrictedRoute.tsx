
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, RefreshCw } from 'lucide-react';

interface RestrictedRouteProps {
  children: ReactNode;
  requireGestor?: boolean;
}

const PROFILE_NULL_TIMEOUT_MS = 5_000;

const RestrictedRoute = ({
  children,
  requireGestor = false,
}: RestrictedRouteProps) => {
  const { user, profileRetryExhausted, refreshProfile } = useAuth();

  const [profileNullTimedOut, setProfileNullTimedOut] = useState(false);
  const profileNullTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user?.profile) {
      profileNullTimer.current = setTimeout(() => setProfileNullTimedOut(true), PROFILE_NULL_TIMEOUT_MS);
    } else {
      if (profileNullTimer.current) clearTimeout(profileNullTimer.current);
      setProfileNullTimedOut(false);
    }
    return () => { if (profileNullTimer.current) clearTimeout(profileNullTimer.current); };
  }, [user?.profile]);

  if (!user?.profile) {
    if (profileNullTimedOut || profileRetryExhausted) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
              <CardTitle>Perfil indisponível</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-center">
              <p className="text-muted-foreground text-sm">
                Não foi possível carregar seu perfil. Verifique sua conexão e tente novamente.
              </p>
              <Button onClick={refreshProfile} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Recarregar perfil
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (user.profile.isProvisional) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-orange-800 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Carregando seu perfil... Algumas permissões podem estar incompletas.</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-orange-300 text-orange-800 hover:bg-orange-100"
            onClick={refreshProfile}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Recarregar
          </Button>
        </div>
        {children}
      </div>
    );
  }

  if (requireGestor && !user.profile.gestor && !user.profile.super_adm) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle>Acesso Restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center">
              Você não tem permissão para acessar esta área.
              Apenas gestores e administradores podem visualizar este conteúdo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default RestrictedRoute;
