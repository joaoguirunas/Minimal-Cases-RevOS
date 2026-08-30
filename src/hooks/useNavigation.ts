
import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLoading } from '@/contexts/LoadingContext';
import { useErrorRecovery } from '@/hooks/useErrorRecovery';

interface NavigationOptions {
  loadingMessage?: string;
  preload?: boolean;
  clearCache?: boolean;
}

export const useNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setLoading } = useLoading();
  const { executeWithRetry } = useErrorRecovery({
    maxRetries: 2,
    retryDelay: 500
  });

  const navigateTo = useCallback(async (
    path: string, 
    options: NavigationOptions = {}
  ) => {
    const {
      loadingMessage = 'Navegando...',
      preload = false,
      clearCache = false
    } = options;

    try {
      setLoading('navigation', true, loadingMessage);

      await executeWithRetry(async () => {
        // Preload da rota se solicitado
        if (preload) {
          // Implementar preload logic aqui se necessário
          console.log('Preloading route:', path);
        }

        // Limpar cache se solicitado
        if (clearCache) {
          // Implementar cache clearing se necessário
          console.log('Clearing cache for navigation');
        }

        // Navegar
        navigate(path);
        
        // Pequeno delay para garantir que a navegação aconteça
        await new Promise(resolve => setTimeout(resolve, 100));
      });
    } catch (error) {
      console.error('Erro na navegação:', error);
    } finally {
      setLoading('navigation', false);
    }
  }, [navigate, setLoading, executeWithRetry]);

  const isCurrentPath = useCallback((path: string) => {
    return location.pathname === path;
  }, [location.pathname]);

  const goBack = useCallback(() => {
    try {
      setLoading('navigation', true, 'Voltando...');
      window.history.back();
      setTimeout(() => setLoading('navigation', false), 500);
    } catch (error) {
      console.error('Erro ao voltar:', error);
      setLoading('navigation', false);
    }
  }, [setLoading]);

  return {
    navigateTo,
    isCurrentPath,
    goBack,
    currentPath: location.pathname
  };
};
