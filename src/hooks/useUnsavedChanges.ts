import { useEffect, useState, useCallback, useRef } from 'react';

interface UseUnsavedChangesReturn {
  showConfirmDialog: boolean;
  handleAttemptClose: () => boolean; // Returns true if should proceed, false if blocked
  handleConfirmLeave: () => void;
  handleCancelLeave: () => void;
}

export function useUnsavedChanges(
  hasChanges: boolean,
  onConfirmLeave?: () => void
): UseUnsavedChangesReturn {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const pendingCloseRef = useRef(false);

  // Proteção contra fechamento/reload da aba
  useEffect(() => {
    if (!hasChanges) return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // Função para tentar fechar - retorna true se pode fechar, false se bloqueado
  const handleAttemptClose = useCallback(() => {
    if (hasChanges) {
      setShowConfirmDialog(true);
      pendingCloseRef.current = true;
      return false; // Bloqueia o fechamento
    }
    return true; // Permite o fechamento
  }, [hasChanges]);

  const handleConfirmLeave = useCallback(() => {
    setShowConfirmDialog(false);
    pendingCloseRef.current = false;
    onConfirmLeave?.();
  }, [onConfirmLeave]);

  const handleCancelLeave = useCallback(() => {
    setShowConfirmDialog(false);
    pendingCloseRef.current = false;
  }, []);

  return { 
    showConfirmDialog,
    handleAttemptClose,
    handleConfirmLeave, 
    handleCancelLeave 
  };
}
