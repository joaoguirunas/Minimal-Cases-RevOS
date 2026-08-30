import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardNegociosDataType, DashboardFiltersType } from './useStubsAll';

export const useDashboardNegociosOptimized = (filters: DashboardFiltersType = {}, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['dashboard-negocios-optimized-v10-no-tenant', JSON.stringify(filters)],
    queryFn: async (): Promise<DashboardNegociosDataType> => {
      console.log('Dashboard Negócios OTIMIZADO - Iniciando consulta SEM TENANT:', { filters });

      // Preparar parâmetros para a função PostgreSQL
      let dataInicio = null;
      let dataFim = null;
      
      // Calcular período - apenas 'all' ou 'personalizado'
      if (filters.dataInicio && filters.dataFim) {
        // Período personalizado com datas customizadas
        dataInicio = filters.dataInicio;
        dataFim = filters.dataFim;
      }
      // Se period === 'all' ou não especificado, não aplica filtro de data

      try {
        // Query direta na tabela leads (sem tenant)
        let baseQuery = (supabase as any)
          .from('leads')
          .select(`
            id, value, status, created_at, user_id, leads_loss_reasons_id, loss_reason,
            leads_stages!inner(name, order_index, color, leads_pipelines_id)
          `);

        // Aplicar filtros
        if (filters.pipelineId) baseQuery = baseQuery.eq('leads_stages.leads_pipelines_id', filters.pipelineId);
        if (filters.stageId) baseQuery = baseQuery.eq('leads_stages_id', filters.stageId);
        if (filters.status) baseQuery = baseQuery.eq('status', filters.status);
        if (filters.responsavel) baseQuery = baseQuery.eq('user_id', filters.responsavel);

        if (dataInicio && dataFim) {
          baseQuery = baseQuery.gte('created_at', dataInicio).lte('created_at', dataFim);
        }

        // Filtro de score removido - campo não existe mais na tabela clients_people

        // Executar query - dados completos sem tenant
        console.log('🚀 Dashboard Negócios - Executando query sem tenant...');
        
        const { data: leads, error: queryError } = await baseQuery;

        if (queryError) {
          console.error('❌ Dashboard Negócios - Erro na query:', queryError);
          throw queryError;
        }

        console.log('✅ Dashboard Negócios - Query executada com SUCESSO:', {
          totalRegistros: leads?.length || 0,
          amostraIds: leads?.slice(0, 3).map(l => ({ id: l.id, status: l.status })) || []
        });

        // Processar dados
        const totalLeads = leads?.length || 0;
        const valorTotal = leads?.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0) || 0;
        
        const leadsGanhos = leads?.filter(lead => lead.status === 'won').length || 0;
        const leadsPerdidos = leads?.filter(lead => lead.status === 'lost').length || 0;
        const leadsEmAndamento = leads?.filter(lead => lead.status === 'in_progress').length || 0;
        
        const ticketMedio = totalLeads > 0 ? valorTotal / totalLeads : 0;
        const taxaConversao = totalLeads > 0 ? (leadsGanhos / totalLeads) * 100 : 0;

        // Processar dados - LÓGICA DO FUNIL
        const leadsPorEstagioRaw = leads?.reduce((acc: any[], lead) => {
          const stageName = (lead.leads_stages as any)?.name || 'Sem estágio';
          const stageOrder = (lead.leads_stages as any)?.order_index || 999;
          const stageCor = (lead.leads_stages as any)?.color || '#3B82F6';
          const existing = acc.find(item => item.stage_nome === stageName);
          const valor = Number(lead.value) || 0;
          
          if (existing) {
            existing.count++;
            existing.valor_total += valor;
            if (lead.status === 'won') existing.ganhos++;
            else if (lead.status === 'lost') existing.perdas++;
            else existing.em_andamento++;
          } else {
            acc.push({ 
              stage_nome: stageName, 
              count: 1, 
              valor_total: valor,
              ganhos: lead.status === 'won' ? 1 : 0,
              perdas: lead.status === 'lost' ? 1 : 0,
              em_andamento: lead.status === 'in_progress' ? 1 : 0,
              ordem: stageOrder,
              cor: stageCor,
            });
          }
          return acc;
        }, [])?.sort((a, b) => a.ordem - b.ordem) || [];

        // Aplicar lógica do funil corretamente: cada etapa deve mostrar quantos leads passaram por ela
        // Primeiro, ordenar por ordem para garantir sequência correta
        const stagesOrdenados = leadsPorEstagioRaw.sort((a, b) => a.ordem - b.ordem);
        
        const leadsPorEstagio = stagesOrdenados.map((currentStage, index) => {
          return {
            stage_nome: currentStage.stage_nome,
            count: currentStage.count,
            valor_total: currentStage.valor_total,
            ganhos: currentStage.ganhos,
            perdas: currentStage.perdas,
            em_andamento: currentStage.em_andamento,
            ordem: currentStage.ordem,
            cor: currentStage.cor,
            percentual: 0,
            percentual_valor: 0
          };
        });

        const leadsPorStatus = leads?.reduce((acc: any[], lead) => {
          const existing = acc.find(item => item.status === lead.status);
          const valor = Number(lead.value) || 0;
          
          if (existing) {
            existing.count++;
            existing.valor_total += valor;
          } else {
            acc.push({ 
              status: lead.status, 
              count: 1, 
              valor_total: valor,
              percentual: 0,
              percentual_valor: 0
            });
          }
          return acc;
        }, []) || [];

        // Motivos de perda - agrupar por leads_loss_reasons_id / loss_reason
        let motivosPerda: any[] = [];
        const perdidos = (leads || []).filter(l => l.status === 'lost');
        if (perdidos.length) {
          const { data: reasons } = await (supabase as any)
            .from('leads_loss_reasons')
            .select('id, name, active');

          const nameById: Record<string, string> = {};
          (reasons || []).forEach((r: any) => { if (r?.id) nameById[r.id] = r.name; });

          const counts: Record<string, number> = {};
          perdidos.forEach((lead: any) => {
            const id = lead.leads_loss_reasons_id as string | null;
            const display = (id && nameById[id]) || lead.loss_reason || 'Não informado';
            counts[display] = (counts[display] || 0) + 1;
          });

          motivosPerda = Object.entries(counts)
            .map(([motivo, count]) => ({ motivo, count }))
            .sort((a, b) => b.count - a.count);
        }


        return {
          totalLeads,
          valorTotal,
          leadsGanhos,
          leadsPerdidos,
          leadsEmAndamento,
          ticketMedio,
          taxaConversao,
          leadsPorEstagio,
          leadsPorStatus,
          motivosPerda,
        };
      } catch (error) {
        console.error('❌ Dashboard Negócios - Erro geral:', error);
        throw error;
      }
    },
    enabled: enabled,
    staleTime: 5 * 60 * 1000, // Cache válido por 5 minutos
    gcTime: 10 * 60 * 1000, // Garbage collection em 10 minutos
    retry: 2, // Tentar novamente 2 vezes em caso de erro
    retryDelay: 1000, // Aguardar 1 segundo entre tentativas
  });
};