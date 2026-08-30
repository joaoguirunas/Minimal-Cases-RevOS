import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type StepUpStatus = 'idle' | 'required' | 'verifying' | 'granted' | 'error';

interface UseStepUpAuthReturn {
  status: StepUpStatus;
  isDialogOpen: boolean;
  /** Call before a sensitive action. If AAL2 is already active, runs `onGranted` immediately. */
  requireStepUp: (onGranted: () => void) => Promise<void>;
  /** Called by the dialog when TOTP is verified successfully. */
  onVerified: () => void;
  /** Called by the dialog on cancel. */
  onCancel: () => void;
  error: string | null;
}

const AAL2_WINDOW_MS = 5 * 60 * 1000;

export function useStepUpAuth(): UseStepUpAuthReturn {
  const [status, setStatus] = useState<StepUpStatus>('idle');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const grantedCallbackRef = useRef<(() => void) | null>(null);
  const lastGrantedAtRef = useRef<number | null>(null);

  const requireStepUp = useCallback(async (onGranted: () => void) => {
    setError(null);

    // If still within the AAL2 window, run the callback immediately
    if (lastGrantedAtRef.current && Date.now() - lastGrantedAtRef.current < AAL2_WINDOW_MS) {
      onGranted();
      return;
    }

    // Check actual session AAL level
    const { data, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) {
      setStatus('error');
      setError('Erro ao verificar nível de autenticação.');
      return;
    }

    if (data.currentLevel === 'aal2') {
      lastGrantedAtRef.current = Date.now();
      onGranted();
      return;
    }

    // AAL2 needed — open dialog
    grantedCallbackRef.current = onGranted;
    setStatus('required');
    setIsDialogOpen(true);
  }, []);

  const onVerified = useCallback(() => {
    lastGrantedAtRef.current = Date.now();
    setStatus('granted');
    setIsDialogOpen(false);
    grantedCallbackRef.current?.();
    grantedCallbackRef.current = null;
    setTimeout(() => setStatus('idle'), 100);
  }, []);

  const onCancel = useCallback(() => {
    setStatus('idle');
    setIsDialogOpen(false);
    grantedCallbackRef.current = null;
  }, []);

  return { status, isDialogOpen, requireStepUp, onVerified, onCancel, error };
}
