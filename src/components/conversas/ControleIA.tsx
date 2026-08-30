import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { useUpdatePessoa } from "@/hooks/usePessoasReal";
import { Bot, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from "@/integrations/supabase/client";
import { useAgentEligibility } from "@/hooks/useAgentEligibility";

interface ControleIAProps {
  pessoa: {
    id: string;
    nome?: string;
    name?: string;
    atendimento_ia?: boolean;
    ai_enabled?: boolean;        // DB column name (from useConversasSimples)
    whatsapp?: string;
    email?: string;
    documento?: string;
    status_atendimento?: string;
    observacoes?: string;
    aceita_ligacao?: boolean;
    tenant_id?: string;
    created_at?: string;
    updated_at?: string;
    negocios?: Array<{ id: string; }>;
  };
  tenantId: string;
}

const ControleIA = ({ pessoa, tenantId }: ControleIAProps) => {
  const { t } = useTranslation();
  const updatePessoa = useUpdatePessoa();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Lê tanto atendimento_ia (view legada) quanto ai_enabled (DB direto via useConversasSimples)
  const resolvedIA = pessoa.atendimento_ia ?? pessoa.ai_enabled ?? true;

  // Estado local para reatividade imediata do switch
  const [iaLocal, setIaLocal] = useState(resolvedIA);

  // Realtime: ai_processing_lock — shows when AI agent is actively processing
  const [aiIsProcessing, setAiIsProcessing] = useState(false);

  // Agent eligibility — which agent (if any) matches this lead's criteria
  const eligibility = useAgentEligibility(pessoa.id);

  useEffect(() => {
    if (!pessoa.id) return;
    // Fetch initial lock state
    supabase
      .from('clients_people')
      .select('ai_processing_lock')
      .eq('id', pessoa.id)
      .single()
      .then(({ data }) => setAiIsProcessing(data?.ai_processing_lock ?? false));

    const channel = supabase
      .channel(`controle-ia-lock-${pessoa.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'clients_people', filter: `id=eq.${pessoa.id}` },
        (payload: any) => setAiIsProcessing(payload.new?.ai_processing_lock ?? false),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pessoa.id]);

  // Sincronizar quando a prop mudar (ex: dados recarregados do servidor)
  useEffect(() => {
    setIaLocal(pessoa.atendimento_ia ?? pessoa.ai_enabled ?? true);
  }, [pessoa.atendimento_ia, pessoa.ai_enabled, pessoa.id]);

  const handleToggleIA = async (ativado: boolean) => {
    const valorAnterior = iaLocal;
    
    // Atualização visual imediata
    setIaLocal(ativado);
    
    try {
      console.log('🤖 ControleIA: Atualizando controle de IA', {
        pessoaId: pessoa.id,
        iaAtual: pessoa.atendimento_ia,
        novaIA: ativado,
        tenantId
      });

      if (!pessoa.id || !tenantId) {
        throw new Error('Dados obrigatórios em falta: ID da pessoa ou tenant');
      }

      if (ativado === resolvedIA) {
        console.log('IA já é o mesmo valor, cancelando atualização');
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
                ? { ...p, atendimento_ia: ativado, ai_enabled: ativado }
                : p
            )
          };
        }
      );

      // Atualizar a pessoa
      await updatePessoa.mutateAsync({
        id: pessoa.id,
        atendimento_ia: ativado
      });

      console.log('✅ ControleIA: ai_enabled atualizado na pessoa');

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

      // CRÍTICO: Invalidar can-send-message para refletir mudanças na IA
      await queryClient.invalidateQueries({ 
        queryKey: ['can-send-message'],
        exact: false,
        refetchType: 'active'
      });

      // Forçar refetch das queries ativas
      await queryClient.refetchQueries({ 
        queryKey: ['conversas-simples-v4'],
        exact: false,
        type: 'active'
      });
      
      console.log('🔄 ControleIA: Cache invalidado e refetch solicitado', {
        component: 'ControleIA',
        pessoaId: pessoa.id,
        campo: 'atendimento_ia',
        novoValor: ativado
      });
      
      console.log('✅ ControleIA: IA atualizada com sucesso', {
        pessoaId: pessoa.id,
        novoValor: ativado
      });
      
      toast({
        title: t('conversations.updateSuccess'),
        description: `${t('conversations.sidebar.aiControl')} ${ativado ? t('conversations.sidebar.aiEnabled') : t('conversations.sidebar.aiDisabled')}`,
      });
    } catch (error: any) {
      // Reverter estado visual em caso de erro
      setIaLocal(valorAnterior);
      
      console.error('❌ ControleIA: Erro ao atualizar IA', {
        error: error.message,
        stack: error.stack
      });
      
      if (error.message?.includes('row-level security') || error.message?.includes('RLS')) {
        console.error('ERRO DE RLS: O usuário não tem permissão para atualizar esta pessoa');
        toast({
          title: t('conversations.updateError'),
          description: t('conversations.sidebar.permissionError'),
          variant: "destructive",
        });
      } else {
        toast({
          title: t('conversations.updateError'),
          description: error?.message || t('conversations.sidebar.cannotUpdateAI'),
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="font-semibold text-sm flex items-center gap-1.5">
          <Bot className={`w-4 h-4 ${iaLocal && aiIsProcessing ? 'text-violet-500 animate-pulse' : iaLocal ? 'text-violet-500' : 'text-muted-foreground'}`} />
          {t('conversations.sidebar.aiControl')}
        </h4>
        <Switch
          checked={iaLocal}
          onCheckedChange={handleToggleIA}
          disabled={updatePessoa.isPending}
        />
      </div>

      {/* AI status indicator */}
      {iaLocal && (
        <>
          {!eligibility.loading && (eligibility.agent && eligibility.scoreOk ? (
            /* Agent matched + score OK → show active/processing pill */
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-[2px] text-[11px] font-medium transition-colors ${
              aiIsProcessing
                ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                : 'bg-card text-muted-foreground/60'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                aiIsProcessing ? 'bg-violet-500 animate-pulse' : 'bg-emerald-500'
              }`} />
              <span className="truncate max-w-[140px]">
                {aiIsProcessing ? 'Respondendo...' : eligibility.agent.name}
              </span>
            </div>
          ) : eligibility.agent && !eligibility.scoreOk ? (
            /* Agent found but score gate blocks */
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-[2px] bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-medium">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[140px]">{eligibility.agent.name} — score inelegível</span>
            </div>
          ) : (
            /* No agent matches */
            <div className="flex items-start gap-1.5 px-2 py-1 rounded-[2px] bg-card text-muted-foreground/50 text-[11px]">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              <span className="leading-tight">
                {eligibility.diagnostics[0] ?? 'Sem agente configurado'}
              </span>
            </div>
          ))}
        </>
      )}

      {updatePessoa.isPending && (
        <div className="text-xs text-muted-foreground mt-1">{t('conversations.sidebar.saving')}</div>
      )}
    </div>
  );
};

export default ControleIA;
