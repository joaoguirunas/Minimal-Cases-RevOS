import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useQueryStabilizer } from '@/hooks/useQueryStabilizer';
import { useRealtimeHeartbeat } from '@/hooks/useRealtimeHeartbeat';

interface RealtimeContextType {
  isConnected: boolean;
  reconnect: () => void;
  enableConversasRealtime: (tenantId: string) => void;
  disableConversasRealtime: () => void;
  enableAgendamentosRealtime: (tenantId: string) => void;
  disableAgendamentosRealtime: () => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const { stabilizedInvalidate } = useQueryStabilizer();
  const [isConnected, setIsConnected] = useState(false);
  
  const channelRef = useRef<any>(null);
  const connectionAttempts = useRef(0);
  const maxConnectionAttempts = 50;
  const currentTenantRef = useRef<string | null>(null);
  const lastEventTimestampRef = useRef<Map<string, number>>(new Map());
  const lastActivityRef = useRef<number>(Date.now());

  // Heartbeat para manter conexão ativa
  const { isHealthy } = useRealtimeHeartbeat({
    enabled: isConnected,
    interval: 45, // 45 segundos
    maxFailures: 2,
    onDisconnect: () => {
      console.log('💀 HEARTBEAT: Desconexão detectada, tentando reconectar...');
      setIsConnected(false);
      if (currentTenantRef.current) {
        setTimeout(() => connectRealtime(currentTenantRef.current), 2000);
      }
    },
    onReconnect: () => {
      console.log('💚 HEARTBEAT: Reconexão bem-sucedida');
    }
  });

  // Handler ultra otimizado com filtros avançados
  const handleDataChange = useCallback((payload: any, tenantId: string) => {
    const eventKey = `${payload.table}_${payload.eventType}_${payload.new?.id || payload.old?.id}`;
    const now = Date.now();
    const lastEvent = lastEventTimestampRef.current.get(eventKey);

    // Rate limiting mais agressivo
    if (lastEvent && (now - lastEvent) < 3000) {
      console.log(`🛑 REALTIME: Evento duplicado ignorado: ${eventKey} (rate limit 3s)`);
      return;
    }

    lastEventTimestampRef.current.set(eventKey, now);

    console.log('📡 REALTIME: Evento processado:', {
      table: payload.table,
      eventType: payload.eventType,
      tenantId,
      recordId: payload.new?.id || payload.old?.id,
      timestamp: new Date(now).toISOString()
    });

    // Atualizar atividade
    lastActivityRef.current = Date.now();

    // Invalidação inteligente por tipo de evento
    if (payload.table === 'messages') {
      console.log('🔄 REALTIME: Invalidando queries para mensagem:', payload.eventType);
      if (payload.eventType === 'INSERT') {
        // Para novos inserts, usar delay maior para evitar conflito
        stabilizedInvalidate(queryClient, ['conversas-simples-v5'], 3000);
        stabilizedInvalidate(queryClient, ['mensagens-por-pessoa-v2'], 2500);
        stabilizedInvalidate(queryClient, ['dashboard-conversas-v5', tenantId], 3500);
        console.log('🔄 REALTIME: Invalidando conversas-simples-v5 para INSERT - tenantId:', tenantId);
      } else if (payload.eventType === 'UPDATE') {
        // Updates são menos críticos
        stabilizedInvalidate(queryClient, ['mensagens-por-pessoa-v2'], 1500);
        stabilizedInvalidate(queryClient, ['dashboard-conversas-v5', tenantId], 2000);
      }
    }

    if (payload.table === 'clients_people' || payload.table === 'leads') {
      console.log('🔄 REALTIME: Invalidando queries para pessoas/leads:', payload.table);
      stabilizedInvalidate(queryClient, ['conversas-simples-v5'], 2000);
      // Só revalida o kanban se ele estiver montado (com observers). Sem o guard de
      // active, a query do kanban ficaria marcada como invalidada enquanto o usuário
      // está em NegocioSingle e re-buscaria TODOS os leads ao voltar.
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'negocios-pipeline' && query.getObserversCount() > 0,
      });
      stabilizedInvalidate(queryClient, ['dashboard-conversas-v5', tenantId], 2500);
    }
  }, [queryClient, stabilizedInvalidate]);

  // Função principal para conectar realtime
  const connectRealtime = useCallback((tenantId: string) => {
    console.log('🔌 REALTIME: Conectando para tenant:', tenantId);

    if (connectionAttempts.current >= maxConnectionAttempts) {
      console.log('❌ REALTIME: Máximo de tentativas atingido');
      return;
    }

    connectionAttempts.current++;
    currentTenantRef.current = tenantId;

    try {
      // Remover canal existente se houver
      if (channelRef.current) {
        console.log('🔌 REALTIME: Removendo canal existente');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // Criar novo canal — schema moderno (clients_people, leads).
      // Subscrições legadas (crm_pessoas, crm_leads) removidas em AUDIT-FIX-10
      // por estarem mortas (frontend e edge functions usam schema moderno).
      const channel = supabase
        .channel(`tenant-changes-${tenantId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'clients_people',
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload) => handleDataChange(payload, tenantId)
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'leads',
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload) => handleDataChange(payload, tenantId)
        );

      channelRef.current = channel;

      channel.subscribe((status) => {
        console.log('📡 REALTIME: Status da conexão:', status);
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          connectionAttempts.current = 0; // Reset attempts on success
          console.log('✅ REALTIME: Conectado com sucesso ao tenant:', tenantId);
          
          // Forçar reconexão imediata se havia falha antes
          lastActivityRef.current = Date.now();
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          console.error('❌ REALTIME: Erro na conexão - tentativa:', connectionAttempts.current);
          
          // Retry logic with exponential backoff - menos agressivo
          if (connectionAttempts.current < maxConnectionAttempts) {
            const retryDelay = Math.min(2000 * Math.pow(1.5, connectionAttempts.current), 15000);
            console.log(`🔄 REALTIME: Tentando reconectar em ${retryDelay}ms`);
            setTimeout(() => {
              if (currentTenantRef.current === tenantId) {
                connectRealtime(tenantId);
              }
            }, retryDelay);
          } else {
            console.error('❌ REALTIME: Máximo de tentativas atingido, parando tentativas automáticas');
          }
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          console.log('🔌 REALTIME: Conexão fechada - tentando reconectar');
          
          // Tentar reconectar após conexão fechada
          setTimeout(() => {
            if (currentTenantRef.current === tenantId && connectionAttempts.current < maxConnectionAttempts) {
              connectRealtime(tenantId);
            }
          }, 3000);
        }
      });

    } catch (error) {
      console.error('❌ REALTIME: Erro ao configurar canal:', error);
      setIsConnected(false);
      
      // Retry after delay
      setTimeout(() => {
        if (currentTenantRef.current === tenantId) {
          connectRealtime(tenantId);
        }
      }, 5000);
    }
  }, [handleDataChange]);

  const reconnect = useCallback(() => {
    console.log('🔄 REALTIME: Reconectando...');
    connectionAttempts.current = 0;
    if (currentTenantRef.current) {
      connectRealtime(currentTenantRef.current);
    }
  }, [connectRealtime]);

  const enableConversasRealtime = useCallback((tenantId: string) => {
    console.log('⚡ REALTIME: Habilitando para conversas, tenant:', tenantId);
    connectRealtime(tenantId);
  }, [connectRealtime]);

  const disableConversasRealtime = useCallback(() => {
    console.log('⏸️ REALTIME: Desabilitando conversas');
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    setIsConnected(false);
    currentTenantRef.current = null;
    connectionAttempts.current = 0;
  }, []);

  const enableAgendamentosRealtime = useCallback((tenantId: string) => {
    console.log('⚡ REALTIME: Agendamentos realtime não implementado para tenant:', tenantId);
  }, []);

  const disableAgendamentosRealtime = useCallback(() => {
    console.log('⏸️ REALTIME: Desabilitando agendamentos realtime');
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      console.log('🧹 REALTIME: Limpeza do provider');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      lastEventTimestampRef.current.clear();
    };
  }, []);

  // Debug effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (isConnected && currentTenantRef.current) {
        const timeSinceActivity = Date.now() - lastActivityRef.current;
        console.log('⚡ Status do realtime:', {
          isConnected,
          isHealthy,
          tenantId: currentTenantRef.current,
          reconnectExists: !!reconnect,
          timeSinceLastActivity: `${Math.round(timeSinceActivity / 1000)}s`,
          connectionAttempts: connectionAttempts.current
        });
      }
    }, 30000); // Log status every 30 seconds

    return () => clearInterval(interval);
  }, [isConnected, isHealthy, reconnect]);

  const value: RealtimeContextType = {
    isConnected,
    reconnect,
    enableConversasRealtime,
    disableConversasRealtime,
    enableAgendamentosRealtime,
    disableAgendamentosRealtime,
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtimeManager = () => {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error('useRealtimeManager must be used within a RealtimeProvider');
  }
  return context;
};