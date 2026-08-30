import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface VersionRestoreModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  versao: number | null;
  isLoading: boolean;
}

export const VersionRestoreModal = ({ 
  open, 
  onClose, 
  onConfirm, 
  versao, 
  isLoading 
}: VersionRestoreModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Confirmar Restauração
          </DialogTitle>
          <DialogDescription>
            Deseja restaurar a versão {versao} do agente?
          </DialogDescription>
        </DialogHeader>
        
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção:</strong> A versão atual será salva automaticamente 
            antes da restauração. Esta ação não pode ser desfeita diretamente, 
            mas você poderá restaurar qualquer versão através do histórico.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Restaurando...' : 'Confirmar Restauração'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};