import { useRef, useCallback } from 'react';

/**
 * Hook para estabilizar queries e evitar invalidações excessivas
 */
export const useQueryStabilizer = () => {
  const lastInvalidationRef = useRef<Map<string, number>>(new Map());
  const pendingInvalidationsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const stabilizedInvalidate = useCallback((queryClient: any, queryKey: any[], delay: number = 1500) => {
    const keyString = JSON.stringify(queryKey);
    const now = Date.now();
    const lastInvalidation = lastInvalidationRef.current.get(keyString);

    console.log(`📨 STABILIZER: Solicitação de invalidação para ${keyString}`);

    // Rate limiting - evitar invalidações muito frequentes
    if (lastInvalidation && (now - lastInvalidation) < delay) {
      console.log(`⏸️ STABILIZER: Rate limit para query ${keyString} (delay: ${delay}ms)`);
      return;
    }

    // Cancelar invalidação pendente se houver
    const pendingTimeout = pendingInvalidationsRef.current.get(keyString);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      pendingInvalidationsRef.current.delete(keyString);
    }

    // Agendar nova invalidação com debounce
    const timeout = setTimeout(() => {
      console.log(`✅ STABILIZER: Executando invalidação para ${keyString}`);
      queryClient.invalidateQueries({
        queryKey, 
        exact: false,
        refetchType: 'active'
      });
      lastInvalidationRef.current.set(keyString, Date.now());
      pendingInvalidationsRef.current.delete(keyString);
    }, 300);

    pendingInvalidationsRef.current.set(keyString, timeout);
  }, []);

  return { stabilizedInvalidate };
};