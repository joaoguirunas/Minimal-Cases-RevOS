import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useConfiguracoesGerais } from '@/hooks/useConfiguracoesGerais';
import { toast } from 'sonner';
import { Eye, EyeOff, RefreshCw, ArrowRight, AlertTriangle, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { logger } from '@/utils/logger';
import { GSSymbol } from '@/components/ui/GrowthSalesLogo';

const RATE_LIMIT_BLOCK_SECONDS = 30;
const FAILED_ATTEMPTS_BEFORE_BLOCK = 3;

function parseLoginError(error: string | undefined | null): string {
  if (!error) return 'Erro ao fazer login';
  const lower = error.toLowerCase();
  if (lower.includes('over_email_send_rate_limit') || lower.includes('email rate limit')) {
    return 'Muitas tentativas de recuperação de senha. Aguarde alguns minutos.';
  }
  if (lower.includes('too_many_requests') || lower.includes('rate limit') || lower.includes('429')) {
    return 'Muitas tentativas. Tente novamente em alguns minutos.';
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Email ou senha incorretos.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirme seu email antes de fazer login.';
  }
  if (lower.includes('user not found')) {
    return 'Usuário não encontrado.';
  }
  return error;
}

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetInProgress, setResetInProgress] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [blockedSecondsLeft, setBlockedSecondsLeft] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { user, signIn, resetPassword, emergencyReset, isLoading, initError } = useAuth();
  const { data: config } = useConfiguracoesGerais();
  const navigate = useNavigate();

  const isBlocked = blockedSecondsLeft > 0;

  const startCountdown = useCallback(() => {
    setBlockedSecondsLeft(RATE_LIMIT_BLOCK_SECONDS);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setBlockedSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Redirecionar usuários já autenticados
  useEffect(() => {
    if (user && !isLoading) {
      console.log('✅ Usuário já autenticado, redirecionando para dashboard');
      navigate('/bipro', { replace: true });
    }
  }, [user, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isBlocked) return;

    if (!email.trim() || !password.trim()) {
      toast.error('Digite email e senha');
      return;
    }

    const startTime = performance.now();
    logger.perf('Login iniciado', 0);

    try {
      const { error } = await signIn(email, password);

      const duration = performance.now() - startTime;
      logger.perf('Login completo', duration);

      if (error) {
        const message = parseLoginError(error);
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        if (newAttempts >= FAILED_ATTEMPTS_BEFORE_BLOCK) {
          startCountdown();
          toast.error(`${message} Botão bloqueado por ${RATE_LIMIT_BLOCK_SECONDS}s.`);
        } else {
          toast.error(message);
        }
      } else {
        setFailedAttempts(0);
        toast.success('Login realizado com sucesso!');
        navigate('/bipro', { replace: true });
      }
    } catch (err) {
      const duration = performance.now() - startTime;
      logger.perf('Login falhou', duration);
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= FAILED_ATTEMPTS_BEFORE_BLOCK) {
        startCountdown();
        toast.error(`Erro ao fazer login. Botão bloqueado por ${RATE_LIMIT_BLOCK_SECONDS}s.`);
      } else {
        toast.error('Erro ao fazer login');
      }
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail.trim()) {
      toast.error('Digite seu email');
      return;
    }

    setResetInProgress(true);
    try {
      const { error } = await resetPassword(resetEmail);
      
      if (error) {
        toast.error(error);
      } else {
        toast.success('Link enviado para seu email!');
        setResetPasswordOpen(false);
      }
    } catch (error) {
      toast.error('Erro ao solicitar redefinição');
    } finally {
      setResetInProgress(false);
    }
  };

  const handleClearCacheAndRestart = () => {
    console.log('🧹 Limpeza completa de cache');
    
    // Limpar absolutamente tudo
    localStorage.clear();
    sessionStorage.clear();
    
    // Limpar cookies relacionados ao Supabase
    document.cookie.split(";").forEach(cookie => {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
      if (name.includes('supabase') || name.includes('sb-')) {
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      }
    });
    
    // Limpar service workers
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => registration.unregister());
      });
    }
    
    // Limpar cache do browser
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    
    toast.success('Cache limpo completamente!');
    
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md rounded-[4px]">
        <CardHeader className="space-y-4">
          {/* Logo */}
          <div className="flex items-center justify-center mb-2">
            {config?.logo_url ? (
              <img 
                src={config.logo_url}
                alt={config.company_name || 'Logo'}
                className="max-w-[200px] max-h-[100px] object-contain"
                onError={(e) => {
                  // Fallback se o logo não carregar
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <GSSymbol size={64} />
            )}
          </div>
          
          {initError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-[4px] p-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <p className="text-destructive text-sm">{initError}</p>
              </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="email"
                className="rounded-[4px]"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-medium">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pr-10 rounded-[4px]"
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              
              <div className="flex justify-end">
                <Button 
                  variant="link" 
                  className="text-xs text-primary px-0"
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetPasswordOpen(true);
                  }}
                >
                  Esqueceu sua senha?
                </Button>
              </div>
            </div>

            {isBlocked && (
              <div className="flex items-center gap-2 text-[12px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-[4px] px-3 py-2">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Muitas tentativas. Aguarde <span className="font-semibold tabular-nums">{blockedSecondsLeft}s</span> para tentar novamente.</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || isBlocked}
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <div className="pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                handleClearCacheAndRestart();
                emergencyReset();
              }}
              disabled={isLoading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Resolver Problemas de Acesso
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-3">
              Use se estiver com dificuldades para entrar
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground/50 text-center mt-4 space-x-3">
        <a href="/termos-de-servico" className="hover:text-muted-foreground transition-colors">Termos de Serviço</a>
        <span>&middot;</span>
        <a href="/politica-de-privacidade" className="hover:text-muted-foreground transition-colors">Política de Privacidade</a>
      </p>

      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent className="sm:max-w-md rounded-[4px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Recuperar Senha</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Digite seu email para receber um link de redefinição.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-foreground font-medium">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="seu@email.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                disabled={resetInProgress}
                className="rounded-[4px]"
              />
            </div>
            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetPasswordOpen(false)}
                disabled={resetInProgress}
                className="rounded-[4px]"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={resetInProgress} 
              >
                {resetInProgress ? 'Enviando...' : 'Enviar'}
                {!resetInProgress && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginPage;
