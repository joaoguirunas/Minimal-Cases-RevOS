import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface HeartbeatOptions {
  enabled: boolean;
  interval?: number; // em segundos, default 30s
  maxFailures?: number; // default 3
  onDisconnect?: () => void;
  onReconnect?: () => void;
}

/**
 * Hook para manter heartbeat do realtime e detectar desconexões
 */
export const useRealtimeHeartbeat = (options: HeartbeatOptions) => {
  const {
    enabled,
    interval = 30,
    maxFailures = 3,
    onDisconnect,
    onReconnect
  } = options;

  const heartbeatRef = useRef<number>();
  const failureCountRef = useRef(0);
  const lastPongRef = useRef<number>(Date.now());
  const isConnectedRef = useRef(true);

  const sendPing = useCallback(async () => {
    try {
      console.log('💓 HEARTBEAT: Enviando ping...');
      
      // Teste simples de conectividade
      const { data, error } = await supabase
        .from('settings_users')
        .select('id')
        .limit(1)
        .single();

      if (!error) {
        lastPongRef.current = Date.now();
        failureCountRef.current = 0;
        
        if (!isConnectedRef.current) {
          console.log('💚 HEARTBEAT: Conexão restaurada');
          isConnectedRef.current = true;
          onReconnect?.();
        }
      } else {
        throw error;
      }
    } catch (error) {
      failureCountRef.current++;
      console.warn(`💔 HEARTBEAT: Falha ${failureCountRef.current}/${maxFailures}:`, error);
      
      if (failureCountRef.current >= maxFailures && isConnectedRef.current) {
        console.error('💀 HEARTBEAT: Conexão perdida após múltiplas falhas');
        isConnectedRef.current = false;
        onDisconnect?.();
      }
    }
  }, [maxFailures, onDisconnect, onReconnect]);

  useEffect(() => {
    if (!enabled) {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      return;
    }

    console.log(`💓 HEARTBEAT: Iniciando com intervalo de ${interval}s`);
    
    // Primeiro ping imediato
    sendPing();
    
    // Configurar intervalo
    heartbeatRef.current = window.setInterval(sendPing, interval * 1000);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [enabled, interval, sendPing]);

  return {
    lastPong: lastPongRef.current,
    failureCount: failureCountRef.current,
    isHealthy: isConnectedRef.current && failureCountRef.current === 0
  };
};