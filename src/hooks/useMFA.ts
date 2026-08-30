import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MfaEnrollData, MfaFactorList } from '@/types/mfa';

const MFA_FACTORS_KEY = ['mfa-factors'] as const;

export function useMFA() {
  const queryClient = useQueryClient();

  const { data: factors, isLoading: isLoadingFactors } = useQuery<MfaFactorList>({
    queryKey: MFA_FACTORS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return {
        totp: data?.totp ?? [],
        phone: data?.phone ?? [],
      };
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const enroll = useMutation<MfaEnrollData>({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      return {
        factorId: data.id,
        qrSvg: data.totp.qr_code,
        secret: data.totp.secret,
      };
    },
  });

  const challenge = useMutation<string, Error, { factorId: string }>({
    mutationFn: async ({ factorId }) => {
      const { data, error } = await supabase.auth.mfa.challenge({ factorId });
      if (error) throw error;
      return data.id;
    },
  });

  const verify = useMutation<void, Error, { factorId: string; challengeId: string; code: string }>({
    mutationFn: async ({ factorId, challengeId, code }) => {
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MFA_FACTORS_KEY });
    },
  });

  const generateRecoveryCodes = useMutation<string[]>({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('mfa_recovery_generate');
      if (error) throw error;
      return data as string[];
    },
  });

  /** Returns the current AAL level from the active session. */
  const getAssuranceLevel = async (): Promise<{ currentLevel: string; nextLevel: string }> => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    return { currentLevel: data.currentLevel, nextLevel: data.nextLevel };
  };

  /**
   * Consumes a recovery code and atomically deletes the TOTP factor (server-side).
   * Returns { success: true } on success, { success: false, error: string } on failure.
   * Factor deletion is handled by the RPC (SECURITY DEFINER) — no client unenroll needed.
   */
  const consumeRecoveryCode = useMutation<{ success: boolean; error?: string }, Error, { code: string }>({
    mutationFn: async ({ code }) => {
      const { data, error } = await supabase.rpc('mfa_recovery_consume', { p_code: code });
      if (error) throw error;
      return data as { success: boolean; error?: string };
    },
    onSuccess: (result) => {
      if (result?.success) {
        queryClient.invalidateQueries({ queryKey: MFA_FACTORS_KEY });
      }
    },
  });

  /** Self-unenroll: removes own TOTP factor (requires AAL1 auth). */
  const unenrollSelf = useMutation<void, Error, { factorId: string }>({
    mutationFn: async ({ factorId }) => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MFA_FACTORS_KEY });
    },
  });

  return {
    factors,
    isLoadingFactors,
    isActive: (factors?.totp?.length ?? 0) > 0,
    enroll,
    challenge,
    verify,
    generateRecoveryCodes,
    getAssuranceLevel,
    consumeRecoveryCode,
    unenrollSelf,
  };
}
