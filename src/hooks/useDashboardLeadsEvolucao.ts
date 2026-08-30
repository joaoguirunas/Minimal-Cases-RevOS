import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface LeadEvolucaoData {
  periodo: string;
  totalLeads: number;
  leadsGanhos: number;
  leadsPerdidos: number;
  leadsEmAndamento: number;
  valorTotal: number;
}

interface DashboardLeadsEvolucaoData {
  evolucaoPorPeriodo: LeadEvolucaoData[];
  granularidade: 'diario' | 'semanal' | 'mensal';
  isLimitedData?: boolean; // Flag para indicar dados limitados por timeout
}


export const useDashboardLeadsEvolucao = (filters: any = {}, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['dashboard-leads-evolucao-no-tenant', filters],
    queryFn: async (): Promise<DashboardLeadsEvolucaoData> => {

      console.log('🔍 useDashboardLeadsEvolucao - Iniciando consulta SEM TENANT:', {
        filters,
        timestamp: new Date().toISOString()
      });

      console.log('🔍 Período detectado:', filters.period);
      console.log('🔍 Data início/fim custom:', filters.dataInicio, filters.dataFim);

      // Calcular período baseado nos filtros - apenas 'all' ou 'personalizado'
      let dataInicio = null;
      let dataFim = null;
      
      if (filters.dataInicio && filters.dataFim) {
        // Período personalizado com datas customizadas
        const startDate = new Date(filters.dataInicio);
        const endDate = new Date(filters.dataFim);
        
        // Ajustar para início do dia no timezone brasileiro
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        
        dataInicio = startDate.toISOString();
        dataFim = endDate.toISOString();
        
        console.log('🔍 Período personalizado ajustado:', {
          filtroOriginal: { dataInicio: filters.dataInicio, dataFim: filters.dataFim },
          ajustado: { dataInicio, dataFim }
        });
      }
      // Se period === 'all' ou não especificado, não aplica filtro de data (busca tudo)

      // Query direta sem tenant
      let baseQuery = (supabase as any)
        .from('leads')
        .select('id, value, status, created_at, leads_stages_id, user_id');

      // Aplicar filtros
      if (filters.pipelineId) {
        baseQuery = baseQuery
          .select('id, value, status, created_at, leads_stages_id, user_id, leads_stages!inner(leads_pipelines_id)')
          .eq('leads_stages.leads_pipelines_id', filters.pipelineId);
      }
      if (filters.stageId) baseQuery = baseQuery.eq('leads_stages_id', filters.stageId);
      if (filters.status) baseQuery = baseQuery.eq('status', filters.status);
      if (filters.responsavel) baseQuery = baseQuery.eq('user_id', filters.responsavel);
      if (dataInicio && dataFim) {
        baseQuery = baseQuery.gte('created_at', dataInicio).lte('created_at', dataFim);
      }

      // Filtro de score
      if (filters.scores && filters.scores.length > 0) {
        baseQuery = baseQuery
          .select('id, value, status, created_at, leads_stages_id, user_id, clients_people!inner(score)')
          .in('clients_people.score', filters.scores);
      }

      const { data: leads, error } = await baseQuery;

      if (error) {
        console.error('❌ Erro ao buscar leads:', error);
        throw new Error(`Erro ao buscar dados: ${error.message}`);
      }

      // Determinar granularidade baseada no período analisado
      let granularidade: 'diario' | 'semanal' | 'mensal' = 'mensal';
      
      if (dataInicio && dataFim) {
        const inicio = new Date(dataInicio);
        const fim = new Date(dataFim);
        const diffDias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        
        // Se o período for <= 35 dias (aproximadamente 1 mês), usar granularidade semanal
        if (diffDias <= 35) {
          granularidade = 'semanal';
        }
        
        console.log('📊 Granularidade determinada:', { diffDias, granularidade });
      }

      // Função para obter a chave do período baseado na granularidade
      const getPeriodoKey = (date: Date, gran: 'diario' | 'semanal' | 'mensal'): string => {
        if (gran === 'mensal') {
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else if (gran === 'semanal') {
          // Calcular início da semana (domingo)
          const d = new Date(date);
          const day = d.getDay();
          const diff = d.getDate() - day;
          const weekStart = new Date(d.setDate(diff));
          weekStart.setHours(0, 0, 0, 0);
          return weekStart.toISOString().split('T')[0];
        }
        return date.toISOString().split('T')[0];
      };

      // Agrupar por período
      const leadsGrouped = (leads || []).reduce((acc: any, lead: any) => {
        const date = new Date(lead.created_at);
        const periodo = getPeriodoKey(date, granularidade);
        
        if (!acc[periodo]) {
          acc[periodo] = {
            totalLeads: 0,
            leadsGanhos: 0,
            leadsPerdidos: 0,
            leadsEmAndamento: 0,
            valorTotal: 0
          };
        }
        
        acc[periodo].totalLeads++;
        acc[periodo].valorTotal += Number(lead.value || 0);
        if (lead.status === 'won') acc[periodo].leadsGanhos++;
        if (lead.status === 'lost') acc[periodo].leadsPerdidos++;
        if (lead.status === 'in_progress') acc[periodo].leadsEmAndamento++;
        
        return acc;
      }, {});

      const evolucaoPorPeriodo = Object.entries(leadsGrouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([periodo, data]: [string, any]) => ({
          periodo: formatPeriodo(periodo, granularidade),
          totalLeads: data.totalLeads,
          leadsGanhos: data.leadsGanhos,
          leadsPerdidos: data.leadsPerdidos,
          leadsEmAndamento: data.leadsEmAndamento,
          valorTotal: data.valorTotal,
        }));

      return {
        evolucaoPorPeriodo,
        granularidade,
      };
    },
    enabled: enabled,
  });
};


function formatPeriodo(periodo: string, granularidade: 'diario' | 'semanal' | 'mensal'): string {
  switch (granularidade) {
    case 'diario':
      const date = new Date(periodo);
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    
    case 'semanal':
      const startDate = new Date(periodo);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      
      const startDay = startDate.getDate().toString().padStart(2, '0');
      const startMonth = (startDate.getMonth() + 1).toString().padStart(2, '0');
      const endDay = endDate.getDate().toString().padStart(2, '0');
      const endMonth = (endDate.getMonth() + 1).toString().padStart(2, '0');
      
      return `${startDay}/${startMonth} - ${endDay}/${endMonth}`;
    
    case 'mensal':
      const [year, month] = periodo.split('-');
      const monthNames = [
        'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
        'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
      ];
      return `${monthNames[parseInt(month) - 1]}/${year}`;
    
    default:
      return periodo;
  }
}