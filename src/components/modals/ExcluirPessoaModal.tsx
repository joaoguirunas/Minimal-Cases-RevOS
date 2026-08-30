
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

interface ExcluirPessoaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: () => void;
  nomePessoa: string;
}

const ExcluirPessoaModal = ({ 
  open, 
  onOpenChange, 
  onConfirmar,
  nomePessoa 
}: ExcluirPessoaModalProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-[4px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[#1C1C1E] font-semibold">
            Excluir Pessoa Definitivamente
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[#5F6368]">
            <strong>ATENÇÃO:</strong> Esta ação irá excluir permanentemente:
            <br /><br />
            • A pessoa "{nomePessoa}"
            <br />
            • Todos os negócios associados
            <br />
            • Todas as reuniões/agendamentos
            <br />
            • Todas as mensagens e conversas
            <br />
            • Todos os arquivos e notas
            <br /><br />
            <strong>Esta ação NÃO PODE ser desfeita.</strong> Tem certeza que deseja continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-[4px] border-[#E5E7EB] text-[#5F6368]">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirmar}
            className="bg-[#FF647C] text-white hover:bg-[#FF5366] rounded-[4px]"
          >
            Excluir Definitivamente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ExcluirPessoaModal;
