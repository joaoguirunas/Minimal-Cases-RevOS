
import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface ErrorRecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  onError?: (error: Error, attempt: number) => void;
  onSuccess?: () => void;
  onMaxRetriesReached?: (error: Error) => void;
}

interface ErrorRecoveryReturn {
  error: Error | null;
  isRetrying: boolean;
  retryCount: number;
  executeWithRetry: <T>(fn: () => Promise<T>) => Promise<T>;
  reset: () => void;
}

export const useErrorRecovery = ({
  maxRetries = 3,
  retryDelay = 1000,
  exponentialBackoff = true,
  onError,
  onSuccess,
  onMaxRetriesReached
}: ErrorRecoveryOptions = {}): ErrorRecoveryReturn => {
  const [error, setError] = useState<Error | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const executeWithRetry = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    // Reset estados
    setError(null);
    setIsRetrying(false);
    setRetryCount(0);

    // Cancelar operação anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    const attemptExecution = async (attempt: number): Promise<T> => {
      try {
        const result = await fn();
        
        if (!abortControllerRef.current?.signal.aborted) {
          setError(null);
          setIsRetrying(false);
          onSuccess?.();
        }
        
        return result;
      } catch (executionError) {
        const err = executionError as Error;
        
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Operation aborted');
        }

        console.error(`Attempt ${attempt} failed:`, err);
        onError?.(err, attempt);

        if (attempt < maxRetries) {
          setRetryCount(attempt);
          setIsRetrying(true);
          setError(err);

          // Calcular delay com backoff exponencial se habilitado
          const delay = exponentialBackoff 
            ? retryDelay * Math.pow(2, attempt - 1)
            : retryDelay;

          console.log(`Retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
          
          // Aguardar antes do retry
          await new Promise(resolve => setTimeout(resolve, delay));

          // Verificar se não foi cancelado durante o delay
          if (abortControllerRef.current?.signal.aborted) {
            throw new Error('Operation aborted');
          }

          return attemptExecution(attempt + 1);
        } else {
          // Máximo de tentativas atingido
          setError(err);
          setIsRetrying(false);
          setRetryCount(maxRetries);
          onMaxRetriesReached?.(err);
          
          toast.error(`Operação falhou após ${maxRetries} tentativas`);
          throw err;
        }
      }
    };

    return attemptExecution(1);
  }, [maxRetries, retryDelay, exponentialBackoff, onError, onSuccess, onMaxRetriesReached]);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setError(null);
    setIsRetrying(false);
    setRetryCount(0);
  }, []);

  return {
    error,
    isRetrying,
    retryCount,
    executeWithRetry,
    reset
  };
};
