
import { Button } from '@/components/ui/button';
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

interface ArquivarPessoaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: () => void;
  nomePessoa: string;
  isLoading?: boolean;
}

const ArquivarPessoaModal = ({ 
  open, 
  onOpenChange, 
  onConfirmar,
  nomePessoa,
  isLoading = false
}: ArquivarPessoaModalProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Arquivamento</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja arquivar a pessoa "{nomePessoa}"? 
            A pessoa será movida para a lista de arquivados e não aparecerá mais na lista principal.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirmar}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? 'Arquivando...' : 'Arquivar Pessoa'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ArquivarPessoaModal;
