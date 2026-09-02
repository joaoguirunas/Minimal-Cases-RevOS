import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, EyeOff, AlertTriangle, Mail, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { useConfiguracoesGerais } from '@/hooks/useConfiguracoesGerais';
import { GSSymbol } from '@/components/ui/GrowthSalesLogo';

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [linkError, setLinkError] = useState<{ code: string; description: string } | null>(null);
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [showResendForm, setShowResendForm] = useState(false);
  const navigate = useNavigate();
  const { data: config } = useConfiguracoesGerais();

  useEffect(() => {
    const checkSessionAndTokens = async () => {
      setIsCheckingSession(true);
      
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.substring(1));
      
      const errorCode = hashParams.get('error_code');
      const errorDescription = hashParams.get('error_description');
      const error = hashParams.get('error');
      
      if (error || errorCode) {
        console.log('❌ Erro detectado no link:', { error, errorCode, errorDescription });
        setLinkError({
          code: errorCode || error || 'unknown',
          description: errorDescription?.replace(/\+/g, ' ') || 'Erro desconhecido'
        });
        setIsCheckingSession(false);
        return;
      }
      
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const recoveryType = hashParams.get('type');
      
      console.log('🔑 Tokens detectados:', { 
        accessToken: !!accessToken, 
        refreshToken: !!refreshToken,
        type: recoveryType 
      });
      
      if (accessToken && refreshToken && recoveryType === 'recovery') {
        console.log('✅ Fluxo de recuperação válido, configurando sessão');
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        
        if (sessionError) {
          console.error('❌ Erro ao configurar sessão:', sessionError);
          setLinkError({
            code: 'session_error',
            description: sessionError.message
          });
        } else {
          setHasValidSession(true);
          window.history.replaceState(null, '', window.location.pathname);
        }
        setIsCheckingSession(false);
        return;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('✅ Sessão existente encontrada');
        setHasValidSession(true);
      } else {
        console.log('⚠️ Nenhuma sessão válida encontrada');
        if (!accessToken && !refreshToken) {
          setLinkError({
            code: 'no_tokens',
            description: 'Link de recuperação inválido ou incompleto'
          });
        }
      }
      
      setIsCheckingSession(false);
    };
    
    checkSessionAndTokens();
  }, []);

  const getErrorMessage = (code: string): string => {
    switch (code) {
      case 'otp_expired':
        return 'O link de recuperação expirou ou já foi utilizado. Por favor, solicite um novo link.';
      case 'access_denied':
        return 'Acesso negado. O link pode ter expirado ou já foi utilizado.';
      case 'session_error':
        return 'Erro ao processar o link de recuperação. Por favor, solicite um novo link.';
      case 'no_tokens':
        return 'Link de recuperação inválido. Por favor, solicite um novo link através da página de login.';
      default:
        return 'O link de recuperação é inválido ou expirou. Por favor, solicite um novo link.';
    }
  };

  const handleResendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resendEmail) {
      toast.error('Por favor, informe seu email');
      return;
    }
    
    setIsResending(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resendEmail, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (error) {
        if (error.message.includes('security purposes')) {
          toast.error('Por segurança, aguarde alguns segundos antes de solicitar novamente.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Email enviado! Verifique sua caixa de entrada.');
        setShowResendForm(false);
        setResendEmail('');
      }
    } catch (error) {
      console.error('Erro ao reenviar email:', error);
      toast.error('Erro ao enviar email');
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        toast.error(error.message);
      } else {
        setSuccess(true);
        toast.success('Senha redefinida com sucesso!');
        
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      toast.error('Erro interno do servidor');
    } finally {
      setIsLoading(false);
    }
  };

  const Logo = () => (
    <div className="flex items-center justify-center mb-2">
      {config?.logo_url ? (
        <img 
          src={config.logo_url}
          alt={config.company_name || 'Logo'}
          className="max-w-[200px] max-h-[100px] object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <GSSymbol size={64} />
      )}
    </div>
  );

  // Loading state
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-lg">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Logo />
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Verificando link de recuperação...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state - invalid/expired link
  if (linkError && !hasValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-lg">
          <CardHeader className="space-y-4">
            <Logo />
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">
                Link Inválido
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {getErrorMessage(linkError.code)}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {!showResendForm ? (
              <>
                <Button 
                  onClick={() => setShowResendForm(true)}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Solicitar Novo Link
                </Button>
                <Button 
                  onClick={() => navigate('/login')} 
                  variant="outline"
                  className="w-full rounded-lg"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao Login
                </Button>
              </>
            ) : (
              <form onSubmit={handleResendEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resendEmail" className="text-foreground font-medium">Seu Email</Label>
                  <Input
                    id="resendEmail"
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="seu@email.com"
                    disabled={isResending}
                    required
                    className="rounded-lg"
                  />
                </div>
                <Button 
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
                  disabled={isResending}
                >
                  {isResending ? 'Enviando...' : 'Enviar Link de Recuperação'}
                  {!isResending && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
                <Button 
                  type="button"
                  onClick={() => setShowResendForm(false)}
                  variant="ghost"
                  className="w-full"
                >
                  Cancelar
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md rounded-lg">
          <CardHeader className="space-y-4">
            <Logo />
            <div className="flex justify-center">
              <div className="rounded-full bg-green-500/10 p-3">
                <Check className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">
                Senha Redefinida!
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Sua senha foi atualizada com sucesso. Redirecionando...
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center mb-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
            <Button 
              onClick={() => navigate('/login')} 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
            >
              Ir para o Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Password reset form
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md rounded-lg">
        <CardHeader className="space-y-4">
          <Logo />
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground">
              Redefinir Senha
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Digite sua nova senha
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-medium">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  required
                  minLength={6}
                  className="pr-10 rounded-lg"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Mínimo 6 caracteres
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground font-medium">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                required
                minLength={6}
                className="rounded-lg"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg" 
              disabled={isLoading}
            >
              {isLoading ? 'Redefinindo...' : 'Redefinir Senha'}
            </Button>

            <div className="pt-2">
              <Button 
                type="button"
                onClick={() => navigate('/login')} 
                variant="outline"
                className="w-full rounded-lg"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao Login
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
