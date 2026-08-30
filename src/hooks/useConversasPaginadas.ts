import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useConversasSimples } from './useConversasSimples';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

interface FiltrosConversas {
  tenantId: string;
  searchTerm?: string;
  statusAtendimento?: string;
  atendimentoIA?: string;
  dateRange?: DateRange;
  filtroPipeline?: string;
  filtroEtapa?: string;
  filtroResponsavel?: string;
  filtroTime?: string;
  filtroTag?: string;
}

const ITEMS_PER_PAGE = 20;

export const useConversasPaginadas = (filtros: FiltrosConversas) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [accumulatedData, setAccumulatedData] = useState<any[]>([]);
  
  // Ref para rastrear a assinatura de filtros anterior
  const prevFiltersSignatureRef = useRef<string>('');
  // Ref para rastrear se já processamos os dados atuais
  const processedDataRef = useRef<string>('');

  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  // NOVO SISTEMA SIMPLIFICADO DE FILTRO DE DATA - COM ESTABILIZAÇÃO
  const filtroDataFormatado = useMemo(() => {
    if (filtros.dateRange?.from && filtros.dateRange?.to) {
      const from = format(filtros.dateRange.from, 'yyyy-MM-dd');
      const to = format(filtros.dateRange.to, 'yyyy-MM-dd');
      const formatted = `${from}_${to}`;
      console.log('📅 useConversasPaginadas: APLICANDO FILTRO DE PERÍODO:', { from, to, formatted });
      return formatted;
    } else {
      console.log('📅 useConversasPaginadas: SEM filtro de data - buscando TODO O HISTÓRICO');
      return null;
    }
  }, [
    filtros.dateRange?.from?.getTime(),
    filtros.dateRange?.to?.getTime()
  ]);

  // Criar assinatura estável de filtros para detectar mudanças
  const filtersSignature = useMemo(() => {
    return JSON.stringify({
      tenantId: filtros.tenantId,
      searchTerm: filtros.searchTerm || '',
      statusAtendimento: filtros.statusAtendimento || '',
      atendimentoIA: filtros.atendimentoIA || '',
      filtroData: filtroDataFormatado || '',
      filtroPipeline: filtros.filtroPipeline || '',
      filtroEtapa: filtros.filtroEtapa || '',
      filtroResponsavel: filtros.filtroResponsavel || '',
      filtroTime: filtros.filtroTime || '',
      filtroTag: filtros.filtroTag || ''
    });
  }, [
    filtros.tenantId,
    filtros.searchTerm,
    filtros.statusAtendimento,
    filtros.atendimentoIA,
    filtroDataFormatado,
    filtros.filtroPipeline,
    filtros.filtroEtapa,
    filtros.filtroResponsavel,
    filtros.filtroTime,
    filtros.filtroTag
  ]);

  // Reset interno quando filtros mudarem
  useEffect(() => {
    const prevSignature = prevFiltersSignatureRef.current;
    
    if (prevSignature && prevSignature !== filtersSignature) {
      console.log('🔄 useConversasPaginadas: FILTROS MUDARAM - Reset interno automático');
      setCurrentPage(1);
      setAccumulatedData([]);
      processedDataRef.current = '';
    }
    
    prevFiltersSignatureRef.current = filtersSignature;
  }, [filtersSignature]);

  // Chamada para useConversasSimples COM TODOS OS FILTROS
  const { data: queryResult, isLoading, isFetching, dataUpdatedAt, refetch: refetchQuery } = useConversasSimples({
    tenantId: filtros.tenantId,
    searchTerm: filtros.searchTerm,
    statusAtendimento: filtros.statusAtendimento,
    filtroData: filtroDataFormatado,
    filtroResponsavel: filtros.filtroResponsavel,
    filtroPipeline: filtros.filtroPipeline,
    filtroEtapa: filtros.filtroEtapa,
    atendimentoIA: filtros.atendimentoIA,
    filtroTime: filtros.filtroTime,
    filtroTag: filtros.filtroTag,
    limit: ITEMS_PER_PAGE,
    offset: offset
  });

  const currentPageData = queryResult?.data || [];
  const totalCount = queryResult?.count || 0;

  // Criar assinatura única dos dados recebidos para detectar mudanças reais
  // Incluir dataUpdatedAt para forçar atualização quando dados internos mudam (ex: stage)
  const dataSignature = useMemo(() => {
    if (!currentPageData || currentPageData.length === 0) return '';
    return `${currentPage}_${dataUpdatedAt}_${currentPageData.map(p => p.id).join(',')}`;
  }, [currentPageData, currentPage, dataUpdatedAt]);

  console.log(`📊 useConversasPaginadas: ${currentPageData.length} pessoas recebidas, page=${currentPage}, loading=${isLoading}, fetching=${isFetching}, totalCount=${totalCount}`);

  // Acumular dados quando nova página é carregada OU quando dados mudam
  useEffect(() => {
    // Ignorar APENAS se está carregando pela primeira vez
    if (isLoading) {
      console.log('⏳ useConversasPaginadas: Query carregando inicial, aguardando...');
      return;
    }

    // Log para debug
    console.log('🔍 useConversasPaginadas: Verificando dados para processar', {
      currentPageDataLength: currentPageData?.length || 0,
      currentPage,
      accumulatedDataLength: accumulatedData.length,
      dataSignature: dataSignature.substring(0, 50) + '...',
      processedRef: (processedDataRef.current || '').substring(0, 50) + '...'
    });

    // Se não há dados E é página 1, limpar accumulated
    if (!currentPageData || currentPageData.length === 0) {
      if (currentPage === 1 && accumulatedData.length > 0) {
        console.log('📊 useConversasPaginadas: Página 1 sem dados - limpando accumulated');
        setAccumulatedData([]);
        processedDataRef.current = dataSignature || 'empty';
      }
      return;
    }

    // Ignorar se já processamos esses mesmos dados
    if (dataSignature && dataSignature === processedDataRef.current) {
      console.log('⏭️ useConversasPaginadas: Dados já processados, ignorando');
      return;
    }

    console.log('📊 useConversasPaginadas: Effect disparado - PROCESSANDO DADOS', {
      currentPage,
      currentPageDataLength: currentPageData.length,
      accumulatedLength: accumulatedData.length
    });

    if (currentPage === 1) {
      // Página 1: sempre sobrescrever
      console.log('📄 Página 1: Definindo accumulatedData com', currentPageData.length, 'itens');
      setAccumulatedData([...currentPageData]);
    } else {
      // Páginas seguintes: acumular apenas dados únicos
      console.log('📄 Página', currentPage, ': Acumulando', currentPageData.length, 'novos itens');
      setAccumulatedData(prev => {
        const existingIds = new Set(prev.map(item => item.id));
        const uniqueNewData = currentPageData.filter(item => !existingIds.has(item.id));
        const newCombinedData = [...prev, ...uniqueNewData];
        
        console.log('✅ Dados acumulados:', {
          anteriores: prev.length,
          novos: uniqueNewData.length,
          total: newCombinedData.length
        });
        
        // Reordenar por data da última mensagem (decrescente)
        return newCombinedData.sort((a, b) => {
          const dateA = new Date(a.data_ultima_mensagem).getTime();
          const dateB = new Date(b.data_ultima_mensagem).getTime();
          return dateB - dateA;
        });
      });
    }

    // Marcar dados como processados
    processedDataRef.current = dataSignature;
  }, [currentPageData, currentPage, isLoading, dataSignature]);

  const loadMore = useCallback(() => {
    console.log('🔄 loadMore chamado - Estado atual:', {
      isLoading,
      isFetching,
      accumulatedLength: accumulatedData.length,
      totalCount,
      currentPage,
      canLoadMore: !isLoading && !isFetching && accumulatedData.length < totalCount
    });
    
    if (!isLoading && !isFetching && accumulatedData.length < totalCount) {
      console.log(`🔄 Carregando mais dados - Página atual: ${currentPage}`);
      setCurrentPage(prev => prev + 1);
    }
  }, [isLoading, isFetching, accumulatedData.length, totalCount, currentPage]);

  const resetPagination = useCallback(() => {
    setCurrentPage(1);
    setAccumulatedData([]);
    processedDataRef.current = '';
  }, []);

  const refetchData = useCallback(() => {
    setCurrentPage(1);
    setAccumulatedData([]);
    processedDataRef.current = '';
    refetchQuery(); // trigger actual network request
  }, [refetchQuery]);

  const hasMore = accumulatedData.length < totalCount && !isLoading && !isFetching;

  return {
    data: accumulatedData,
    totalCount,
    isLoading: isLoading && currentPage === 1,
    hasMore,
    loadMore,
    resetPagination,
    refetch: refetchData,
    currentPage
  };
};
