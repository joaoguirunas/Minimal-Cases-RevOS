import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserPermissions } from './useUserPermissions';
import { startOfDay, endOfDay } from 'date-fns';

interface DashboardConversasFilters {
  dateRange?: {
    from: Date | undefined;
    to: Date | undefined;
  };
  responsavel?: string;
  scores: number[];
}

// Date calculation utility
function calculatePeriodDates(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  let startDate: Date;
  const endDate: Date = endOfDay(now);

  switch (period) {
    case 'today':
      startDate = startOfDay(now);
      break;
    case 'week':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), quarterStartMonth, 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case 'all':
    default:
      startDate = new Date('2020-01-01');
      break;
  }

  return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
}

// Data structures
export interface DashboardConversasData {
  totalMensagens: number;
  mensagensHumanas: number;
  mensagensIA: number;
  mensagensFollowups: number;
  mensagensClientes: number;
  totalConversas: number;
  conversasAbandonadas: number;
  tempoMedioIA: number;
  tempoMedioCliente: number;
  quantidadeChamadas: number;
  evolucaoMensagens: Array<any>;
  evolucaoConversas: Array<any>;
  mensagensPorOrigem: Array<{ origem: string; count: number }>;
  mensagensPorTipo: Array<{ tipo: string; count: number }>;
  conversasPorPessoa: Array<{
    pessoa_nome: string;
    total_mensagens: number;
    ultima_mensagem: string;
  }>;
}

// Data fetching function with direct queries
const fetchDashboardData = async (
  startDate: string,
  endDate: string,
  responsavel?: string,
  scores?: number[],
  isManager: boolean = true,
  currentUserId?: string
): Promise<DashboardConversasData> => {
  console.log('🔍 Dashboard Conversas - Fetching data:', {
    startDate,
    endDate,
    responsavel,
    scores,
    isManager,
    currentUserId
  });

  // Build base query for messages with leads join
  let messagesQuery = supabase
    .from('messages')
    .select(`
      id,
      content,
      from_contact,
      channel,
      message_type,
      created_at,
      people_id,
      followup_id,
      leads!inner(user_id)
    `)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Apply hierarchical filter: non-managers see only their data
  if (!isManager && currentUserId) {
    messagesQuery = messagesQuery.eq('leads.user_id', currentUserId);
    console.log('🔒 Applying user filter:', currentUserId);
  }

  // Apply responsible filter if provided
  if (responsavel && responsavel !== 'all') {
    messagesQuery = messagesQuery.eq('leads.user_id', responsavel);
    console.log('👤 Applying responsible filter:', responsavel);
  }

  const { data: messages, error: messagesError } = await messagesQuery;

  if (messagesError) {
    console.error('❌ Error fetching messages:', messagesError);
    throw messagesError;
  }

  console.log('✅ Messages fetched:', messages?.length || 0);

  // Now fetch people data separately to apply score filter
  const peopleIds = [...new Set(messages?.map(m => m.people_id).filter(Boolean))];
  
  const peopleQuery = supabase
    .from('clients_people')
    .select('id, name')
    .in('id', peopleIds);

  // Score filter removed - field no longer exists
  // if (scores && scores.length > 0) {
  //   peopleQuery = peopleQuery.in('score', scores);
  // }

  const { data: people, error: peopleError } = await peopleQuery;

  if (peopleError) {
    console.error('❌ Error fetching people:', peopleError);
    throw peopleError;
  }

  // Create a map of valid people IDs (after score filter)
  const validPeopleIds = new Set(people?.map(p => p.id) || []);
  const peopleMap = new Map(people?.map(p => [p.id, p]) || []);

  // Filter messages to only include those with valid people (respecting score filter)
  const filteredMessages = messages?.filter(m => m.people_id && validPeopleIds.has(m.people_id)) || [];

  console.log('📊 Filtered messages after score filter:', filteredMessages.length);

  // Process data for aggregations
  const totalMensagens = filteredMessages.length;
  const totalChamadas = filteredMessages.filter(m => m.message_type === 'audio').length;
  const followupsEnviados = filteredMessages.filter(m => m.followup_id !== null).length;

  // Count by from_contact
  const mensagensIA = filteredMessages.filter(m => m.from_contact === 'ai').length;
  const mensagensCliente = filteredMessages.filter(m => m.from_contact === 'client').length;
  const mensagensHumana = filteredMessages.filter(m => m.from_contact === 'human').length;

  // Group by channel (origin)
  const mensagensPorOrigem = filteredMessages.reduce((acc, msg) => {
    const origem = msg.channel || 'unknown';
    const existing = acc.find(item => item.origem === origem);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ origem, count: 1 });
    }
    return acc;
  }, [] as Array<{ origem: string; count: number }>);

  // Group by message type
  const mensagensPorTipo = [
    { tipo: 'IA', count: mensagensIA },
    { tipo: 'Cliente', count: mensagensCliente },
    { tipo: 'Humana', count: mensagensHumana }
  ].filter(item => item.count > 0);

  // Group by person for conversations
  const conversasPorPessoaMap = filteredMessages.reduce((acc, msg) => {
    const pessoaId = msg.people_id;
    if (!pessoaId) return acc;

    const pessoa = peopleMap.get(pessoaId);
    if (!pessoa) return acc;

    const existing = acc.get(pessoaId);
    if (existing) {
      existing.total_mensagens++;
      // Keep the most recent message
      if (new Date(msg.created_at) > new Date(existing.ultima_mensagem)) {
        existing.ultima_mensagem = msg.created_at;
      }
    } else {
      acc.set(pessoaId, {
        pessoa_nome: pessoa.name || 'Unknown',
        ultima_mensagem: msg.created_at,
        total_mensagens: 1
      });
    }
    return acc;
  }, new Map<string, { pessoa_nome: string; ultima_mensagem: string; total_mensagens: number }>());

  const conversasPorPessoa = Array.from(conversasPorPessoaMap.values()).sort((a, b) => 
    new Date(b.ultima_mensagem).getTime() - new Date(a.ultima_mensagem).getTime()
  );

  const totalConversas = conversasPorPessoa.length;

  console.log('✅ Dashboard data processed:', {
    totalMensagens,
    totalConversas,
    mensagensIA,
    mensagensCliente,
    mensagensHumana
  });

  return {
    totalMensagens,
    mensagensHumanas: mensagensHumana,
    mensagensIA,
    mensagensClientes: mensagensCliente,
    mensagensFollowups: followupsEnviados,
    quantidadeChamadas: totalChamadas,
    totalConversas,
    conversasAbandonadas: 0,
    tempoMedioIA: 0,
    tempoMedioCliente: 0,
    evolucaoMensagens: [],
    evolucaoConversas: [],
    mensagensPorOrigem,
    mensagensPorTipo,
    conversasPorPessoa
  };
};

export const useDashboardConversas = (
  period: string = 'all',
  filters?: DashboardConversasFilters,
  enabled: boolean = true
) => {
  const { isManager, currentUserId } = useUserPermissions();

  console.log('📊 Dashboard Conversas - Hierarchical filter:', {
    isManager,
    currentUserId,
    filtroResponsavel: filters?.responsavel
  });

  // Calculate date range
  let startDate: string;
  let endDate: string;

  if (filters?.dateRange?.from && filters?.dateRange?.to) {
    startDate = startOfDay(filters.dateRange.from).toISOString();
    endDate = endOfDay(filters.dateRange.to).toISOString();
  } else if (period !== 'custom') {
    const dates = calculatePeriodDates(period);
    startDate = dates.startDate;
    endDate = dates.endDate;
  } else {
    // Custom period but no dates provided - return empty data
    startDate = '';
    endDate = '';
  }

  return useQuery({
    queryKey: [
      'dashboard-conversas-direct',
      period,
      startDate,
      endDate,
      filters?.responsavel,
      filters?.scores?.join(','),
      isManager,
      currentUserId
    ],
    queryFn: async () => {
      // If custom period without dates, return empty data
      if (period === 'custom' && (!filters?.dateRange?.from || !filters?.dateRange?.to)) {
        return {
          totalMensagens: 0,
          mensagensHumanas: 0,
          mensagensIA: 0,
          mensagensFollowups: 0,
          mensagensClientes: 0,
          totalConversas: 0,
          conversasAbandonadas: 0,
          tempoMedioIA: 0,
          tempoMedioCliente: 0,
          quantidadeChamadas: 0,
          evolucaoMensagens: [],
          evolucaoConversas: [],
          mensagensPorOrigem: [],
          mensagensPorTipo: [],
          conversasPorPessoa: []
        };
      }

      console.log('🔄 Dashboard Conversas - Fetching data with params:', {
        period,
        startDate,
        endDate,
        responsavel: filters?.responsavel,
        scores: filters?.scores,
        isManager,
        currentUserId
      });

      return await fetchDashboardData(
        startDate,
        endDate,
        filters?.responsavel,
        filters?.scores,
        isManager,
        currentUserId
      );
    },
    enabled: enabled && (period !== 'custom' || !!(filters?.dateRange?.from && filters?.dateRange?.to)),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 2,
    refetchInterval: false,
  });
};
