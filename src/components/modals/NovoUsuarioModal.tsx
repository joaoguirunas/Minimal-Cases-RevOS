import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import WhatsAppInput from '@/components/ui/whatsapp-input';
import { useUsuariosWithMethods } from '@/hooks/useUsuariosWithMethods';
import { useTimesWithMethods } from '@/hooks/useTimes';
import { toast } from 'sonner';
import type { UserType } from '@/types/usuarios';

interface NovoUsuarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriar?: (email: string, senha: string, gestor: boolean, timesSelecionados: string[], nome?: string, whatsapp?: string) => Promise<void>;
}

const NovoUsuarioModal = ({ open, onOpenChange, onCriar }: NovoUsuarioModalProps) => {
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { criarUsuario, fetchUsuarios } = useUsuariosWithMethods();
  const { times } = useTimesWithMethods();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim() || !formData.email.trim()) {
      toast.error('Name and email are required');
      return;
    }

    setIsSubmitting(true);

    try {
      const isManager = formData.userType === 'manager' || formData.userType === 'admin';

      if (onCriar) {
        await onCriar(
          formData.email,
          formData.senha || 'senha123',
          isManager,
          formData.timesSelecionados,
          formData.nome,
          formData.whatsapp
        );
      } else {
        await criarUsuario.mutateAsync({
          email: formData.email,
          senha: formData.senha || 'senha123',
          gestor: isManager,
          timesSelecionados: formData.timesSelecionados,
          nome: formData.nome,
          whatsapp: formData.whatsapp,
          superAdmin: formData.superAdmin,
          userType: formData.userType,
        });
      }

      await fetchUsuarios();
      toast.success('User created successfully!');

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
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Error creating user');
    } finally {
      setIsSubmitting(false);
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
          <DialogTitle>New User</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Name *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Full name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha">Password</Label>
            <Input
              id="senha"
              type="password"
              value={formData.senha}
              onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
              placeholder="Leave empty for default password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <WhatsAppInput
              id="whatsapp"
              value={formData.whatsapp}
              onChange={(value) => setFormData({ ...formData, whatsapp: value })}
              placeholder="11999990000"
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
                <RadioGroupItem value="comercial" id="comercial" />
                <Label htmlFor="comercial" className="cursor-pointer text-sm">Comercial</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-[4px] p-3">
                <RadioGroupItem value="user" id="user" />
                <Label htmlFor="user" className="cursor-pointer text-sm">User</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-[4px] p-3">
                <RadioGroupItem value="manager" id="manager" />
                <Label htmlFor="manager" className="cursor-pointer text-sm">Manager</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-[4px] p-3">
                <RadioGroupItem value="admin" id="admin" />
                <Label htmlFor="admin" className="cursor-pointer text-sm">Admin</Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {formData.userType === 'admin' && "Acesso total ao sistema, configurações e gerenciamento de usuários"}
              {formData.userType === 'manager' && "Gestão de equipe e projetos, sem acesso às configurações do sistema"}
              {formData.userType === 'user' && "Acesso limitado aos registros atribuídos"}
              {formData.userType === 'comercial' && "Vendedor/closer — sem acesso a BI nem Configurações"}
            </p>
          </div>

          {/* TEAMS */}
          {times.length > 0 && (
            <div className="space-y-2">
              <Label>Teams</Label>
              <div className="space-y-2 max-h-32 overflow-y-auto border rounded-[4px] p-3">
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

          <div className="flex items-center justify-between">
            <Label htmlFor="ativo">Active</Label>
            <Switch
              id="ativo"
              checked={formData.ativo}
              onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NovoUsuarioModal;
