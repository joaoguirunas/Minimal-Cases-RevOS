
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdatePessoa } from "@/hooks/usePessoasReal";
import { User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";

interface StatusAtendimentoProps {
  pessoa: {
    id: string;
    nome: string;
    status_atendimento?: string;
    whatsapp?: string;
    email?: string;
    documento?: string;
    observacoes?: string;
    aceita_ligacao?: boolean;
    created_at?: string;
    updated_at?: string;
  };
}

const StatusAtendimento = ({ pessoa }: StatusAtendimentoProps) => {
  const { t } = useTranslation();
  const updatePessoa = useUpdatePessoa();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleStatusChange = async (novoStatus: string) => {
    try {
      console.log('🔄 StatusAtendimento: Atualizando status de atendimento', {
        pessoaId: pessoa.id,
        statusAtual: pessoa.status_atendimento,
        novoStatus,
      });

      if (!pessoa.id) {
        throw new Error('Missing required data: Person ID');
      }

      if (novoStatus === pessoa.status_atendimento) {
        console.log('Status is already the same, canceling update');
        return;
      }

      // Optimistic update - atualizar UI imediatamente
      queryClient.setQueryData(
        ['conversas-simples-v4'], 
        (old: any) => {
          if (!old?.data) return old;
          
          return {
            ...old,
            data: old.data.map((p: any) => 
              p.id === pessoa.id 
                ? { ...p, status_atendimento: novoStatus, service_status: novoStatus }
                : p
            )
          };
        }
      );

      await updatePessoa.mutateAsync({
        id: pessoa.id,
        status_atendimento: novoStatus
      });

      // Invalidar queries específicas com prefixo parcial
      await queryClient.invalidateQueries({ 
        queryKey: ['conversas-simples-v4'], 
        exact: false,
        refetchType: 'active'
      });

      await queryClient.invalidateQueries({ 
        queryKey: ['conversas-paginadas'], 
        exact: false,
        refetchType: 'active'
      });

      // Forçar refetch das queries ativas
      await queryClient.refetchQueries({ 
        queryKey: ['conversas-simples-v4'],
        exact: false,
        type: 'active'
      });
      
      console.log('🔄 StatusAtendimento: Cache invalidado e refetch solicitado', {
        component: 'StatusAtendimento',
        pessoaId: pessoa.id,
        campo: 'status_atendimento',
        novoValor: novoStatus
      });
      
      console.log('✅ StatusAtendimento: Status atualizado com sucesso');
      
      toast({
        title: t('conversations.updateSuccess'),
        description: `${t('conversations.sidebar.status')} ${novoStatus === 'open' ? t('conversations.sidebar.open') : t('conversations.sidebar.closed')}`,
      });
    } catch (error: any) {
      console.error('❌ StatusAtendimento: Erro ao atualizar status', {
        error: error.message,
        stack: error.stack
      });
      
      if (error.message?.includes('row-level security') || error.message?.includes('RLS')) {
        console.error('RLS ERROR: User does not have permission to update this person');
        toast({
          title: t('conversations.updateError'),
          description: t('conversations.sidebar.permissionError'),
          variant: "destructive",
        });
      } else {
        toast({
          title: t('conversations.updateError'),
          description: error?.message || t('conversations.sidebar.cannotUpdateStatus'),
          variant: "destructive",
        });
      }
    }
  };

  const statusAtual = pessoa.status_atendimento || 'open';

  return (
    <div>
      <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
        <User className="w-4 h-4" />
        {t('conversations.sidebar.serviceStatus')}
      </h4>
      
      <Select
        value={statusAtual}
        onValueChange={handleStatusChange}
        disabled={updatePessoa.isPending}
      >
        <SelectTrigger className="h-8 bg-background border border-border">
          <SelectValue placeholder={t('conversations.sidebar.serviceStatus')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">{t('conversations.sidebar.open')}</SelectItem>
          <SelectItem value="closed">{t('conversations.sidebar.closed')}</SelectItem>
        </SelectContent>
      </Select>
      
      {updatePessoa.isPending && (
        <div className="text-xs text-muted-foreground mt-1">{t('conversations.sidebar.saving')}</div>
      )}
    </div>
  );
};

export default StatusAtendimento;
