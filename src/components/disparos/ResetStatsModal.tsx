import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface ResetStatsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export function ResetStatsModal({ 
  open, 
  onOpenChange, 
  onConfirm, 
  isLoading 
}: ResetStatsModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-[4px] bg-yellow-500/10">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <AlertDialogTitle>Resetar Estatísticas</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3">
            <p>Esta ação irá resetar todas as estatísticas do disparo:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Contadores de enviados e falhas serão zerados</li>
              <li>Status de todos os contatos voltará para "pendente"</li>
              <li>Histórico de envio será limpo</li>
              <li>Mensagens de erro serão removidas</li>
            </ul>
            <p className="font-medium text-yellow-600 dark:text-yellow-500">
              ⚠️ Esta ação não pode ser desfeita!
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isLoading}
            className="bg-[#F59E0B] hover:bg-[#F59E0B]/90"
          >
            {isLoading ? 'Resetando...' : 'Sim, Resetar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
