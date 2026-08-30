
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConvidarUsuarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConvidar: (nome: string, email: string) => void;
}

const ConvidarUsuarioModal = ({ 
  open, 
  onOpenChange, 
  onConvidar 
}: ConvidarUsuarioModalProps) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');

  const handleConvidar = () => {
    if (nome.trim() && email.trim()) {
      onConvidar(nome.trim(), email.trim());
      setNome('');
      setEmail('');
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setNome('');
    setEmail('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Convidar Usuário</DialogTitle>
          <DialogDescription>
            Envie um convite para um novo usuário acessar o sistema.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="nome">Nome completo</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Digite o nome completo"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Digite o e-mail"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleConvidar} disabled={!nome.trim() || !email.trim()}>
            Enviar Convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConvidarUsuarioModal;
