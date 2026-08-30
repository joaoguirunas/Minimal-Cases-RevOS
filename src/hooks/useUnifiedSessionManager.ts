import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SessionManagerOptions {
  heartbeatInterval?: number; // minutos
  activityThreshold?: number; // minutos
  refreshThreshold?: number; // minutos antes da expiração
  onReconnect?: () => void;
  onDisconnect?: () => void;
  onSessionExpiring?: (minutesLeft: number) => void;
}

interface SessionStatus {
  isConnected: boolean;
  sessionValid: boolean;
  minutesLeft: number | null;
  isRefreshing: boolean;
  retryAttempts: number;
}

export const useUnifiedSessionManager = (options: SessionManagerOptions = {}) => {
  const {
    heartbeatInterval = 15, // 15 minutos (mais espaçado para evitar pings desnecessários)
    activityThreshold = 60, // 60 minutos (usuário precisa estar muito tempo inativo)
    refreshThreshold = 30, // 30 minutos antes da expiração
    onReconnect,
    onDisconnect,
    onSessionExpiring
  } = options;

  // Estados consolidados
  const [status, setStatus] = useState<SessionStatus>({
    isConnected: true,
    sessionValid: true,
    minutesLeft: null,
    isRefreshing: false,
    retryAttempts: 0
  });

  // Refs para controle
  const lastActivityRef = useRef<number>(Date.now());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPingInProgressRef = useRef(false);
  const lastToastShownRef = useRef<number>(0);

  // Função para atualizar atividade (com throttling)
  const updateActivity = useCallback(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastActivityRef.current;
    
    // Throttle: só atualiza se passou mais de 30 segundos
    if (timeSinceLastUpdate > 30000) {
      console.log('🔄 SessionManager: Atividade atualizada');
      lastActivityRef.current = now;
      
      // Reset retry attempts quando há atividade
      setStatus(prev => ({ 
        ...prev, 
        retryAttempts: 0,
        isConnected: true 
      }));
    }
  }, []);

  // Verificação robusta de sessão
  const checkSessionStatus = useCallback(async (): Promise<boolean> => {
    try {
      console.log('🔍 SessionManager: Verificando status da sessão...');
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ SessionManager: Erro ao verificar sessão:', error);
        return false;
      }

      if (!session) {
        console.warn('⚠️ SessionManager: Nenhuma sessão encontrada');
        setStatus(prev => ({ 
          ...prev, 
          sessionValid: false, 
          minutesLeft: null 
        }));
        return false;
      }

      // Se não há expires_at, assumir que a sessão é válida mas verificar o user
      if (!session.expires_at) {
        console.log('ℹ️ SessionManager: Sessão sem expires_at, verificando user...');
        const isValid = !!session.user && !!session.access_token;
        setStatus(prev => ({ 
          ...prev, 
          sessionValid: isValid, 
          minutesLeft: isValid ? 999 : null // Valor alto para indicar sessão sem expiração definida
        }));
        return isValid;
      }

      const expiresAt = new Date(session.expires_at * 1000);
      const now = new Date();
      const msLeft = expiresAt.getTime() - now.getTime();
      const minutesRemaining = Math.floor(msLeft / (1000 * 60));

      console.log(`⏰ SessionManager: Sessão expira em ${minutesRemaining} minutos`);

      setStatus(prev => ({ 
        ...prev, 
        sessionValid: minutesRemaining > 0,
        minutesLeft: minutesRemaining 
      }));

      // Notificar sobre expiração apenas para sessões com tempo definido e próximas do limite
      if (minutesRemaining <= 15 && minutesRemaining > 0 && minutesRemaining < 999) {
        const now = Date.now();
        const timeSinceLastToast = now - lastToastShownRef.current;
        
        // Mostrar toast apenas se passou mais de 10 minutos do último
        if (timeSinceLastToast > 10 * 60 * 1000) {
          onSessionExpiring?.(minutesRemaining);
          lastToastShownRef.current = now;
        }
      }

      // Refresh proativo apenas se há tempo definido e não é sessão "infinita"
      if (minutesRemaining <= refreshThreshold && minutesRemaining > 5 && minutesRemaining < 999) {
        console.log('🔄 SessionManager: Iniciando refresh proativo da sessão');
        await refreshSession();
      }

      return minutesRemaining > 0;
    } catch (error) {
      console.error('❌ SessionManager: Erro crítico na verificação:', error);
      return false;
    }
  }, [refreshThreshold, onSessionExpiring]);

  // Refresh de sessão otimizado
  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (status.isRefreshing) {
      console.log('⏭️ SessionManager: Refresh já em andamento, ignorando');
      return true;
    }

    setStatus(prev => ({ ...prev, isRefreshing: true }));
    
    try {
      console.log('🔄 SessionManager: Renovando sessão...');
      
      const { error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('❌ SessionManager: Erro no refresh:', error);
        
        if (error.message.includes('refresh_token_not_found')) {
          console.log('🚨 SessionManager: Token não encontrado, usuário deve fazer login');
          toast.error('Sessão expirada', {
            description: 'Por favor, faça login novamente',
            action: {
              label: 'Login',
              onClick: () => window.location.href = '/login'
            }
          });
          return false;
        }
        
        throw error;
      }

      console.log('✅ SessionManager: Sessão renovada com sucesso');
      
      setStatus(prev => ({ 
        ...prev, 
        sessionValid: true,
        isConnected: true,
        retryAttempts: 0 
      }));
      
      return true;
    } catch (error) {
      console.error('❌ SessionManager: Falha no refresh:', error);
      return false;
    } finally {
      setStatus(prev => ({ ...prev, isRefreshing: false }));
    }
  }, [status.isRefreshing]);

  // Ping inteligente com backoff exponencial (não bloqueia UI)
  const ping = useCallback(async (): Promise<void> => {
    if (isPingInProgressRef.current) {
      console.log('⏭️ SessionManager: Ping já em andamento');
      return;
    }

    // Verificar se usuário está inativo
    const timeSinceActivity = Date.now() - lastActivityRef.current;
    const isInactive = timeSinceActivity > activityThreshold * 60 * 1000;
    
    if (isInactive) {
      console.log(`😴 SessionManager: Usuário inativo há ${Math.floor(timeSinceActivity / (60 * 1000))} minutos, pulando ping`);
      // Marcar como conectado mesmo sem ping para não bloquear UI
      setStatus(prev => ({ ...prev, isConnected: true }));
      return;
    }

    isPingInProgressRef.current = true;

    try {
      console.log('🏓 SessionManager: Executando ping...');
      
      const sessionValid = await checkSessionStatus();
      
      if (sessionValid) {
        setStatus(prev => ({ 
          ...prev, 
          isConnected: true, 
          retryAttempts: 0 
        }));
        
        // Notificar reconexão se estava desconectado
        if (!status.isConnected) {
          console.log('🔄 SessionManager: Conexão reestabelecida');
          onReconnect?.();
        }
      } else {
        throw new Error('Sessão inválida');
      }
      
    } catch (error) {
      console.error('❌ SessionManager: Ping falhou:', error);
      
      const newRetryAttempts = status.retryAttempts + 1;
      setStatus(prev => ({ 
        ...prev, 
        isConnected: false,
        retryAttempts: newRetryAttempts 
      }));

      // Notificar desconexão apenas na primeira falha
      if (status.retryAttempts === 0) {
        onDisconnect?.();
      }

      // Retry com backoff exponencial
      if (newRetryAttempts < 3) {
        const retryDelay = Math.min(5000 * Math.pow(2, newRetryAttempts), 30000);
        console.log(`🔄 SessionManager: Tentativa ${newRetryAttempts}, retry em ${retryDelay}ms`);
        
        retryTimeoutRef.current = setTimeout(() => {
          isPingInProgressRef.current = false;
          ping();
        }, retryDelay);
      }
    } finally {
      if (!retryTimeoutRef.current) {
        isPingInProgressRef.current = false;
      }
    }
  }, [activityThreshold, status.isConnected, status.retryAttempts, checkSessionStatus, onReconnect, onDisconnect]);

  // Activity listeners com debounce
  useEffect(() => {
    const debouncedUpdateActivity = (() => {
      let timeoutId: NodeJS.Timeout;
      return () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(updateActivity, 1000); // 1 segundo de debounce
      };
    })();

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, debouncedUpdateActivity, { passive: true });
    });

    // Listener para visibilitychange
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('👁️ SessionManager: Tab ficou visível, atualizando atividade');
        updateActivity();
        
        // NÃO fazer ping imediato ao voltar para evitar loading desnecessário
        // O heartbeat periódico já vai cuidar disso
      } else {
        console.log('👁️ SessionManager: Tab ficou oculto (minimizado)');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, debouncedUpdateActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updateActivity, ping]);

  // Heartbeat otimizado
  useEffect(() => {
    console.log(`🚀 SessionManager: Iniciando heartbeat (${heartbeatInterval} min)`);
    
    heartbeatIntervalRef.current = setInterval(() => {
      console.log('💓 SessionManager: Heartbeat executando');
      ping();
    }, heartbeatInterval * 60 * 1000);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [heartbeatInterval, ping]);

  // Verificação de sessão periódica
  useEffect(() => {
    console.log('🕐 SessionManager: Iniciando verificação periódica de sessão');
    
    sessionCheckIntervalRef.current = setInterval(() => {
      console.log('🔍 SessionManager: Verificação periódica executando');
      checkSessionStatus();
    }, 5 * 60 * 1000); // A cada 5 minutos

    return () => {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
    };
  }, [checkSessionStatus]);

  // Cleanup geral
  useEffect(() => {
    return () => {
      console.log('🧹 SessionManager: Limpando recursos');
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...status,
    updateActivity,
    refreshSession,
    ping: () => {
      if (!isPingInProgressRef.current) {
        ping();
      }
    }
  };
};