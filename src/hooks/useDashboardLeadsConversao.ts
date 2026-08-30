import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface LeadConversaoData {
  periodo: string;
  totalLeads: number;
  totalAgendamentos: number;
  percentualConversao: number;
  valorTotalLeads: number;
  valorLeadsComAgendamento: number;
}

interface DashboardLeadsConversaoData {
  resumo: {
    totalLeads: number;
    totalAgendamentos: number;
    percentualGeral: number;
    valorTotal: number;
    valorComAgendamentos: number;
  };
  conversaoPorPeriodo: LeadConversaoData[];
  isLimitedData?: boolean; // Flag para indicar dados limitados por timeout
}


interface LeadsConversaoFilters {
  dataInicio?: string;
  dataFim?: string;
  pipelineId?: string;
  stageId?: string;
  status?: string;
  responsavel?: string;
  scores?: number[];
}

export const useDashboardLeadsConversao = (filters: LeadsConversaoFilters = {}, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['dashboard-leads-conversao-no-tenant', filters],
    queryFn: async (): Promise<DashboardLeadsConversaoData> => {

      console.log('🔍 useDashboardLeadsConversao - Iniciando consulta SEM TENANT:', {
        filters,
        timestamp: new Date().toISOString()
      });

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

      // Query leads e reuniões
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let leadsQuery: any = supabase
        .from('leads')
        .select('id, value, created_at, leads_stages_id, status, user_id');

      if (filters.pipelineId) {
        leadsQuery = leadsQuery
          .select('id, value, created_at, leads_stages_id, status, user_id, leads_stages!inner(leads_pipelines_id)')
          .eq('leads_stages.leads_pipelines_id', filters.pipelineId);
      }
      if (filters.stageId) leadsQuery = leadsQuery.eq('leads_stages_id', filters.stageId);
      if (filters.status) leadsQuery = leadsQuery.eq('status', filters.status);
      if (filters.responsavel) leadsQuery = leadsQuery.eq('user_id', filters.responsavel);
      if (dataInicio && dataFim) {
        leadsQuery = leadsQuery.gte('created_at', dataInicio).lte('created_at', dataFim);
      }

      // Filtro de score
      if (filters.scores && filters.scores.length > 0) {
        leadsQuery = leadsQuery
          .select('id, value, created_at, leads_stages_id, status, user_id, clients_people!inner(score)')
          .in('clients_people.score', filters.scores);
      }

      const { data: leads, error: leadsError } = await leadsQuery;
      
      if (leadsError) {
        console.error('❌ Erro ao buscar leads:', leadsError);
        throw leadsError;
      }

      const { data: meetings, error: meetingsError } = await supabase
        .from('meetings')
        .select('lead_id, date');

      if (meetingsError) {
        console.error('❌ Erro ao buscar reuniões:', meetingsError);
        throw meetingsError;
      }

      const leadsComAgendamento = new Set((meetings || []).map(m => m.lead_id));
      const totalLeads = leads?.length || 0;
      const totalAgendamentos = leadsComAgendamento.size;
      const percentualGeral = totalLeads > 0 ? (totalAgendamentos / totalLeads) * 100 : 0;

      const conversaoPorPeriodo = [{
        periodo: 'Geral',
        totalLeads,
        totalAgendamentos,
        percentualConversao: percentualGeral,
        valorTotalLeads: 0,
        valorLeadsComAgendamento: 0,
      }];

      return {
        resumo: {
          totalLeads,
          totalAgendamentos,
          percentualGeral,
          valorTotal: 0,
          valorComAgendamentos: 0,
        },
        conversaoPorPeriodo,
      };
    },
    enabled: enabled,
  });
};


function formatPeriodo(periodo: string, isMonthly: boolean): string {
  if (isMonthly) {
    const [year, month] = periodo.split('-');
    const monthNames = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];
    return `${monthNames[parseInt(month) - 1]}/${year}`;
  } else {
    const date = new Date(periodo);
    const endDate = new Date(date);
    endDate.setDate(date.getDate() + 6);
    
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')} - ${endDate.getDate().toString().padStart(2, '0')}/${(endDate.getMonth() + 1).toString().padStart(2, '0')}`;
  }
}