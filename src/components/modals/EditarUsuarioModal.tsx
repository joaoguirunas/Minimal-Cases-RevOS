import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTimesWithMethods } from '@/hooks/useTimes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Usuario, UserType } from '@/types/usuarios';
import WhatsAppInput from '@/components/ui/whatsapp-input';

interface EditarUsuarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (usuario: Usuario) => Promise<void>;
  usuario?: Usuario | null;
}

const EditarUsuarioModal = ({ 
  open, 
  onOpenChange, 
  onSave,
  usuario
}: EditarUsuarioModalProps) => {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    whatsapp: '',
    senha: '',
    userType: 'user' as UserType,
    superAdmin: false,
    ativo: true,
    timesSelecionados: [] as string[]
  });
  const [timesOriginais, setTimesOriginais] = useState<string[]>([]);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const { times } = useTimesWithMethods();

  useEffect(() => {
    if (usuario && open) {
      // usuario.user_type já vem resolvido corretamente pelo caller
      // (UsuariosConfig.resolveUserType) — usar direto, sem reinterpretar.
      const userType: UserType = usuario.user_type ?? 'user';

      setFormData({
        nome: usuario.nome,
        email: usuario.email,
        whatsapp: usuario.whatsapp || '',
        senha: '',
        userType,
        superAdmin: usuario.super_adm || false,
        ativo: usuario.ativo,
        timesSelecionados: [],
      });

      fetchTimesUsuario(usuario.id);
    } else if (!open) {
      setFormData({
        nome: '',
        email: '',
        whatsapp: '',
        senha: '',
        userType: 'user',
        superAdmin: false,
        ativo: true,
        timesSelecionados: [],
      });
      setTimesOriginais([]);
    }
  }, [usuario?.id, open]);

  const fetchTimesUsuario = async (usuarioId: string) => {
    try {
      const { data, error } = await supabase
        .from('settings_users_teams')
        .select('team_id')
        .eq('user_id', usuarioId);

      if (error) throw error;
      
      const timeIds = data?.map(item => item.team_id) || [];
      setTimesOriginais(timeIds);
      setFormData(prev => ({ ...prev, timesSelecionados: timeIds }));
    } catch (error) {
      console.error('Erro ao buscar times do usuário:', error);
    }
  };

  const updateUserPassword = async (userId: string, newPassword: string) => {
    try {
      setIsUpdatingPassword(true);
      const { data, error } = await supabase.functions.invoke('update-user-password', {
        body: { userId, newPassword }
      });
      if (error) throw new Error(error.message || 'Erro ao chamar função de alteração de senha');
      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido ao alterar senha');
      return { success: true };
    } catch (error: any) {
      throw error;
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const updateUserEmail = async (userId: string, newEmail: string, targetUserAuthId: string) => {
    try {
      setIsUpdatingEmail(true);
      const { data, error } = await supabase.functions.invoke('update-user-email', {
        body: { userId, newEmail, targetUserAuthId }
      });
      if (error) throw new Error(error.message || 'Erro ao chamar função de alteração de email');
      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido ao alterar email');
      return { success: true };
    } catch (error: any) {
      throw error;
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleSave = async () => {
    if (!usuario) return;

    try {
      const emailChanged = formData.email.trim() !== usuario.email;

      if (emailChanged) {
        if (!usuario.auth_user_id) {
          toast.error('Não é possível alterar o email: usuário não vinculado ao sistema de autenticação');
          return;
        }
        try {
          await updateUserEmail(usuario.id, formData.email.trim(), usuario.auth_user_id);
          toast.success('Email atualizado com sucesso!');
        } catch (emailError: any) {
          toast.error(`Erro ao alterar email: ${emailError.message}`);
          return;
        }
      }

      const isGestor = formData.userType === 'manager' || formData.userType === 'admin';

      await onSave({
        ...usuario,
        nome: formData.nome.trim(),
        email: formData.email.trim(),
        whatsapp: formData.whatsapp,
        gestor: isGestor,
        super_adm: formData.userType === 'admin' || formData.superAdmin,
        ativo: formData.ativo,
        user_type: formData.userType
      });

      if (formData.senha.trim()) {
        if (!usuario.auth_user_id) {
          toast.error('Não é possível alterar a senha: usuário não vinculado ao sistema de autenticação');
          return;
        }
        try {
          await updateUserPassword(usuario.id, formData.senha.trim());
        } catch (passwordError: any) {
          toast.error(`Usuário atualizado, mas houve erro ao alterar a senha: ${passwordError.message}`);
        }
      }

      // Handle team updates
      const timesParaRemover = timesOriginais.filter(timeId => 
        !formData.timesSelecionados.includes(timeId)
      );
      
      for (const timeId of timesParaRemover) {
        await supabase
          .from('settings_users_teams')
          .delete()
          .eq('user_id', usuario.id)
          .eq('team_id', timeId);
      }

      const novosTimesParaAdicionar = formData.timesSelecionados.filter(timeId => 
        !timesOriginais.includes(timeId)
      );

      if (novosTimesParaAdicionar.length > 0) {
        const timesData = novosTimesParaAdicionar.map(timeId => ({
          user_id: usuario.id,
          team_id: timeId
        }));

        await supabase
          .from('settings_users_teams')
          .insert(timesData);
      }
      
      toast.success('Usuário atualizado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      toast.error('Erro ao salvar usuário');
    }
  };

  const handleTimeChange = (timeId: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        timesSelecionados: [...prev.timesSelecionados, timeId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        timesSelecionados: prev.timesSelecionados.filter(id => id !== timeId)
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Altere as informações do usuário.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome Completo</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="João Silva"
            />
          </div>

          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="joao@empresa.com"
            />
          </div>

          <div>
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <WhatsAppInput
              id="whatsapp"
              value={formData.whatsapp}
              onChange={(value) => setFormData({ ...formData, whatsapp: value })}
              placeholder="11999990000"
            />
          </div>

          <div>
            <Label htmlFor="senha">Nova Senha (opcional)</Label>
            <Input
              id="senha"
              type="password"
              value={formData.senha}
              onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
              placeholder="Deixe em branco para manter a senha atual"
              disabled={isUpdatingPassword}
            />
          </div>

          <div className="space-y-3">
            <Label>Tipo de Usuário</Label>
            <RadioGroup
              value={formData.userType}
              onValueChange={(value: UserType) => setFormData(prev => ({
                ...prev,
                userType: value,
                superAdmin: value === 'admin',
              }))}
              className="grid grid-cols-2 gap-2"
            >
              <div className="flex items-center space-x-2 border rounded-[4px] p-3">
                <RadioGroupItem value="comercial" id="edit-comercial" />
                <Label htmlFor="edit-comercial" className="cursor-pointer text-sm">Comercial</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-[4px] p-3">
                <RadioGroupItem value="user" id="edit-user" />
                <Label htmlFor="edit-user" className="cursor-pointer text-sm">User</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-[4px] p-3">
                <RadioGroupItem value="manager" id="edit-manager" />
                <Label htmlFor="edit-manager" className="cursor-pointer text-sm">Manager</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-[4px] p-3">
                <RadioGroupItem value="admin" id="edit-admin" />
                <Label htmlFor="edit-admin" className="cursor-pointer text-sm">Admin</Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {formData.userType === 'admin' && "Acesso total ao sistema, configurações e gerenciamento de usuários"}
              {formData.userType === 'manager' && "Gestão de equipe e projetos, sem acesso às configurações do sistema"}
              {formData.userType === 'user' && "Acesso limitado aos registros atribuídos"}
              {formData.userType === 'comercial' && "Vendedor/closer — sem acesso a BI nem Configurações"}
            </p>
          </div>

          {/* Super Admin */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="superAdmin"
              checked={formData.superAdmin}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, superAdmin: checked as boolean }))}
            />
            <div>
              <Label htmlFor="superAdmin" className="text-sm">Super Admin</Label>
              <p className="text-xs text-muted-foreground">
                Acesso total ao sistema e gerenciamento de usuários
              </p>
            </div>
          </div>

          {/* TEAMS */}
          {times.length > 0 && (
            <div>
              <Label>Times/Equipes</Label>
              <div className="space-y-2 max-h-32 overflow-y-auto border rounded-[4px] p-2">
                {times.map((time) => (
                  <div key={time.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`time-${time.id}`}
                      checked={formData.timesSelecionados.includes(time.id)}
                      onCheckedChange={(checked) => handleTimeChange(time.id, checked as boolean)}
                    />
                    <Label 
                      htmlFor={`time-${time.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {time.nome} ({time.tipo})
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="ativo"
              checked={formData.ativo}
              onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked as boolean })}
            />
            <Label htmlFor="ativo">Usuário Ativo</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!formData.nome.trim() || !formData.email.trim() || isUpdatingPassword || isUpdatingEmail}
          >
            {(isUpdatingPassword || isUpdatingEmail) ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditarUsuarioModal;
