import { useState, useRef, useCallback } from 'react';

interface MessageAttempt {
  id: string;
  message: string;
  leadId: string;
  timestamp: number;
  status: 'sending' | 'success' | 'failed' | 'duplicate';
  error?: string;
}

interface SendingState {
  isActive: boolean;
  attempts: MessageAttempt[];
  rateLimitUntil?: number;
  duplicatePreventionActive: boolean;
}

/**
 * Hook para monitoramento avançado de envio de mensagens
 * Previne spam, duplicatas e fornece feedback em tempo real
 */
export const useMessageSendingMonitor = () => {
  const [sendingState, setSendingState] = useState<SendingState>({
    isActive: false,
    attempts: [],
    duplicatePreventionActive: false
  });
  
  const lastAttemptRef = useRef<number>(0);
  const pendingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Limpar tentativas antigas (últimos 30 segundos)
  const cleanOldAttempts = useCallback(() => {
    const now = Date.now();
    const thirtySecondsAgo = now - 30000;
    
    setSendingState(prev => ({
      ...prev,
      attempts: prev.attempts.filter(attempt => attempt.timestamp > thirtySecondsAgo)
    }));
  }, []);

  // Verificar se pode enviar mensagem
  const canSendMessage = useCallback((message: string, leadId: string): { canSend: boolean; reason?: string } => {
    cleanOldAttempts();
    
    const now = Date.now();
    const trimmedMessage = message.trim();
    
    // 1. Verificar se está em rate limit
    if (sendingState.rateLimitUntil && now < sendingState.rateLimitUntil) {
      const secondsLeft = Math.ceil((sendingState.rateLimitUntil - now) / 1000);
      return {
        canSend: false,
        reason: `Aguarde ${secondsLeft} segundos antes de enviar outra mensagem`
      };
    }
    
    // 2. Verificar duplicatas recentes
    const recentDuplicate = sendingState.attempts.find(attempt => 
      attempt.leadId === leadId &&
      attempt.message.trim() === trimmedMessage &&
      (now - attempt.timestamp) < 30000
    );
    
    if (recentDuplicate) {
      return {
        canSend: false,
        reason: 'Esta mensagem já foi enviada recentemente'
      };
    }
    
    // 3. Verificar rate limiting (máximo 5 mensagens em 30 segundos)
    const recentAttempts = sendingState.attempts.filter(attempt => 
      attempt.leadId === leadId &&
      (now - attempt.timestamp) < 30000
    );
    
    if (recentAttempts.length >= 5) {
      const rateLimitUntil = now + 10000; // 10 segundos de cooldown
      setSendingState(prev => ({
        ...prev,
        rateLimitUntil
      }));
      return {
        canSend: false,
        reason: 'Muitas mensagens enviadas rapidamente. Aguarde 10 segundos.'
      };
    }
    
    // 4. Verificar intervalo mínimo entre mensagens (2 segundos)
    if (now - lastAttemptRef.current < 2000) {
      return {
        canSend: false,
        reason: 'Aguarde alguns segundos entre mensagens'
      };
    }
    
    return { canSend: true };
  }, [sendingState, cleanOldAttempts]);

  // Registrar tentativa de envio
  const registerSendAttempt = useCallback((message: string, leadId: string): string => {
    const attemptId = `${Date.now()}-${Math.random()}`;
    const now = Date.now();
    
    const attempt: MessageAttempt = {
      id: attemptId,
      message: message.trim(),
      leadId,
      timestamp: now,
      status: 'sending'
    };
    
    setSendingState(prev => ({
      ...prev,
      isActive: true,
      attempts: [...prev.attempts, attempt],
      duplicatePreventionActive: true
    }));
    
    lastAttemptRef.current = now;
    
    // Auto-limpeza após 30 segundos
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
    }
    
    pendingTimeoutRef.current = setTimeout(() => {
      cleanOldAttempts();
      setSendingState(prev => ({
        ...prev,
        isActive: false,
        duplicatePreventionActive: false
      }));
    }, 30000);
    
    return attemptId;
  }, [cleanOldAttempts]);

  // Marcar envio como bem-sucedido
  const markSendSuccess = useCallback((attemptId: string) => {
    setSendingState(prev => ({
      ...prev,
      isActive: false,
      attempts: prev.attempts.map(attempt => 
        attempt.id === attemptId 
          ? { ...attempt, status: 'success' as const }
          : attempt
      )
    }));
    
    console.log('✅ MONITOR: Envio marcado como bem-sucedido:', attemptId);
  }, []);

  // Marcar envio como falhou
  const markSendFailure = useCallback((attemptId: string, error: string) => {
    setSendingState(prev => ({
      ...prev,
      isActive: false,
      attempts: prev.attempts.map(attempt => 
        attempt.id === attemptId 
          ? { ...attempt, status: 'failed' as const, error }
          : attempt
      )
    }));
    
    console.warn('❌ MONITOR: Envio marcado como falha:', attemptId, error);
  }, []);

  // Marcar como duplicata
  const markAsDuplicate = useCallback((attemptId: string) => {
    setSendingState(prev => ({
      ...prev,
      isActive: false,
      attempts: prev.attempts.map(attempt => 
        attempt.id === attemptId 
          ? { ...attempt, status: 'duplicate' as const }
          : attempt
      )
    }));
    
    console.log('🔄 MONITOR: Envio marcado como duplicata:', attemptId);
  }, []);

  // Limpar estado
  const resetState = useCallback(() => {
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
    }
    
    setSendingState({
      isActive: false,
      attempts: [],
      duplicatePreventionActive: false
    });
    
    lastAttemptRef.current = 0;
  }, []);

  // Estatísticas úteis
  const stats = {
    totalAttempts: sendingState.attempts.length,
    successfulSends: sendingState.attempts.filter(a => a.status === 'success').length,
    failedSends: sendingState.attempts.filter(a => a.status === 'failed').length,
    duplicates: sendingState.attempts.filter(a => a.status === 'duplicate').length,
    isCurrentlySending: sendingState.isActive,
    isDuplicatePreventionActive: sendingState.duplicatePreventionActive,
    timeUntilCanSend: sendingState.rateLimitUntil ? Math.max(0, sendingState.rateLimitUntil - Date.now()) : 0
  };

  return {
    canSendMessage,
    registerSendAttempt,
    markSendSuccess,
    markSendFailure,
    markAsDuplicate,
    resetState,
    stats,
    sendingState
  };
};