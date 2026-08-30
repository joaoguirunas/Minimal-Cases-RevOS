import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, User, Mail, Lock, CheckCircle } from 'lucide-react';
import WhatsAppInput from '@/components/ui/whatsapp-input';

const FinalizarCadastro = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [conviteValido, setConviteValido] = useState(false);
  const [verificandoConvite, setVerificandoConvite] = useState(true);
  
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    whatsapp: '',
    senha: '',
    confirmarSenha: ''
  });

  const inviteId = searchParams.get('invite');
  const emailParam = searchParams.get('email');

  useEffect(() => {
    verificarConvite();
  }, [inviteId, emailParam]);

  const verificarConvite = async () => {
    if (!inviteId || !emailParam) {
      toast.error('Link de convite inválido');
      navigate('/');
      return;
    }

    try{
      setVerificandoConvite(true);
      
      // Verificar se o convite existe e está válido
      const { data: usuario, error } = await supabase
        .from('settings_users')
        .select('*')
        .eq('id', inviteId)
        .eq('email', emailParam)
        .is('auth_user_id', null)
        .single();

      if (error || !usuario) {
        toast.error('Convite inválido ou já foi utilizado');
        navigate('/');
        return;
      }

      setFormData(prev => ({
        ...prev,
        nome: usuario.name === usuario.email ? '' : (usuario.name || ''),
        email: usuario.email,
        whatsapp: usuario.phone || ''
      }));
      
      setConviteValido(true);
    } catch (error) {
      console.error('Erro ao verificar convite:', error);
      toast.error('Erro ao verificar convite');
      navigate('/');
    } finally {
      setVerificandoConvite(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    
    if (!formData.senha || formData.senha.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    if (formData.senha !== formData.confirmarSenha) {
      toast.error('As senhas não coincidem');
      return;
    }

    setLoading(true);

    try {
      // Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.senha,
        options: {
          data: {
            full_name: formData.nome
          }
        }
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Erro ao criar usuário');
      }

      // Atualizar o registro do usuário com o auth_user_id e dados atualizados
      const { error: updateError } = await supabase
        .from('settings_users')
        .update({
          name: formData.nome,
          phone: formData.whatsapp || null,
          auth_user_id: authData.user.id
        })
        .eq('id', inviteId);

      if (updateError) throw updateError;

      toast.success('Cadastro finalizado com sucesso! Você pode fazer login agora.');
      navigate('/');
      
    } catch (error) {
      console.error('Erro ao finalizar cadastro:', error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('already registered')) {
        toast.error('Este e-mail já possui uma conta. Faça login.');
      } else {
        toast.error('Erro ao finalizar cadastro: ' + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (verificandoConvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 w-full max-w-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Verificando convite...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!conviteValido) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Finalizar Cadastro</h1>
          <p className="text-muted-foreground mt-2">Complete seus dados para acessar o sistema</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="nome" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Nome Completo
            </Label>
            <Input
              id="nome"
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Seu nome completo"
              disabled={loading}
              required
            />
          </div>

          <div>
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              disabled
              className="bg-muted"
            />
          </div>

          <div>
            <Label htmlFor="whatsapp">WhatsApp (opcional)</Label>
            <WhatsAppInput
              id="whatsapp"
              value={formData.whatsapp}
              onChange={(value) => setFormData({ ...formData, whatsapp: value })}
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="senha" className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Senha
            </Label>
            <div className="relative">
              <Input
                id="senha"
                type={showPassword ? "text" : "password"}
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                placeholder="Mínimo 6 caracteres"
                disabled={loading}
                required
                minLength={6}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="confirmarSenha">Confirmar Senha</Label>
            <div className="relative">
              <Input
                id="confirmarSenha"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmarSenha}
                onChange={(e) => setFormData({ ...formData, confirmarSenha: e.target.value })}
                placeholder="Confirme sua senha"
                disabled={loading}
                required
                minLength={6}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Finalizando..." : "Finalizar Cadastro"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Já tem uma conta?{' '}
            <Button
              variant="link"
              className="p-0 h-auto font-normal"
              onClick={() => navigate('/')}
            >
              Fazer login
            </Button>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default FinalizarCadastro;
