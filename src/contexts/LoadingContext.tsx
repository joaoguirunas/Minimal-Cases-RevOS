
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface LoadingState {
  isLoading: boolean;
  message: string;
  timestamp: number;
}

interface LoadingContextType {
  isLoading: boolean;
  loadingMessage: string;
  loadingStates: Map<string, LoadingState>;
  setLoading: (key: string, loading: boolean, message?: string) => void;
  setPageLoading: (loading: boolean, message?: string) => void;
  clearLoading: (key: string) => void;
  clearAllLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | null>(null);

interface LoadingProviderProps {
  children: ReactNode;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [loadingStates, setLoadingStates] = useState<Map<string, LoadingState>>(new Map());
  const [pageLoading, setPageLoadingState] = useState<LoadingState>({
    isLoading: false,
    message: '',
    timestamp: 0
  });

  const setLoading = useCallback((key: string, loading: boolean, message = 'Carregando...') => {
    setLoadingStates(prev => {
      const newMap = new Map(prev);
      if (loading) {
        newMap.set(key, {
          isLoading: true,
          message,
          timestamp: Date.now()
        });
        
        // Timeout automático de 30 segundos
        setTimeout(() => {
          setLoadingStates(current => {
            const updated = new Map(current);
            const state = updated.get(key);
            if (state && Date.now() - state.timestamp >= 30000) {
              console.warn(`Loading timeout for key: ${key}`);
              updated.delete(key);
            }
            return updated;
          });
        }, 30000);
        
      } else {
        newMap.delete(key);
      }
      return newMap;
    });
  }, []);

  const setPageLoading = useCallback((loading: boolean, message = 'Carregando...') => {
    setPageLoadingState({
      isLoading: loading,
      message,
      timestamp: Date.now()
    });

    if (loading) {
      // Timeout automático de 30 segundos para page loading
      setTimeout(() => {
        setPageLoadingState(current => {
          if (current.isLoading && Date.now() - current.timestamp >= 30000) {
            console.warn('Page loading timeout');
            return { isLoading: false, message: '', timestamp: 0 };
          }
          return current;
        });
      }, 30000);
    }
  }, []);

  const clearLoading = useCallback((key: string) => {
    setLoadingStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(key);
      return newMap;
    });
  }, []);

  const clearAllLoading = useCallback(() => {
    setLoadingStates(new Map());
    setPageLoadingState({ isLoading: false, message: '', timestamp: 0 });
  }, []);

  // Determinar estado global de loading
  const isLoading = pageLoading.isLoading || Array.from(loadingStates.values()).some(state => state.isLoading);
  const loadingMessage = pageLoading.isLoading 
    ? pageLoading.message 
    : Array.from(loadingStates.values()).find(state => state.isLoading)?.message || '';

  const value: LoadingContextType = {
    isLoading,
    loadingMessage,
    loadingStates,
    setLoading,
    setPageLoading,
    clearLoading,
    clearAllLoading
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading deve ser usado dentro de um LoadingProvider');
  }
  return context;
};
