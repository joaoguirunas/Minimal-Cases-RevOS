import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { useMFA } from '@/hooks/useMFA';
import { RecoveryCodesDisplay } from '@/components/auth/RecoveryCodesDisplay';
import { useAuth } from '@/hooks/useAuth';

type Step = 'verify' | 'codes';

const MfaRecoveryRegenerate = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { factors, challenge, verify, generateRecoveryCodes } = useMFA();

  const [step, setStep] = useState<Step>('verify');
  const [code, setCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [newCodes, setNewCodes] = useState<string[]>([]);

  const factorId = factors?.totp?.[0]?.id ?? '';

  const handleVerify = useCallback(async () => {
    if (code.length !== 6 || !factorId) return;
    setVerifyError(null);

    try {
      const challengeId = await challenge.mutateAsync({ factorId });
      await verify.mutateAsync({ factorId, challengeId, code });
      const codes = await generateRecoveryCodes.mutateAsync(undefined);
      setNewCodes(codes);
      setStep('codes');
    } catch {
      setVerifyError('Código inválido. Tente o próximo código do app autenticador.');
      setCode('');
    }
  }, [code, factorId, challenge, verify, generateRecoveryCodes]);

  useEffect(() => {
    if (code.length === 6 && step === 'verify') {
      handleVerify();
    }
  }, [code, step, handleVerify]);

  const isPending = challenge.isPending || verify.isPending || generateRecoveryCodes.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-[20px] font-semibold text-foreground">
            Regenerar códigos de recuperação
          </h1>
          <p className="text-[13px] text-muted-foreground/70 mt-1.5">
            {step === 'verify'
              ? 'Por segurança, confirme sua identidade com o código do seu app autenticador.'
              : 'Seus novos códigos foram gerados. Os anteriores foram invalidados.'}
          </p>
        </div>

        <div className="border border-border rounded-[4px] bg-card">
          {/* Step: verify */}
          {step === 'verify' && (
            <div className="p-6 space-y-5">
              <div>
                <p className="text-[13px] font-medium text-foreground mb-1">
                  Código de 6 dígitos
                </p>
                <p className="text-[12px] text-muted-foreground/70">
                  Abra o app autenticador e insira o código atual.
                </p>
              </div>

              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  autoFocus
                  autoComplete="one-time-code"
                  aria-label="Código de 6 dígitos"
                  disabled={isPending}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {verifyError && (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-[4px] px-3 py-2"
                >
                  {verifyError}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/profile')}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleVerify}
                  disabled={code.length !== 6 || isPending || !factorId}
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Confirmar'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step: codes */}
          {step === 'codes' && (
            <div className="p-6">
              <RecoveryCodesDisplay
                codes={newCodes}
                email={user?.email}
                additionalWarning="Os códigos anteriores foram invalidados. Apenas estes novos são válidos."
                onConfirmed={() => {
                  toast.success('Códigos de recuperação atualizados!');
                  navigate('/profile');
                }}
                confirmLabel="Concluir"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MfaRecoveryRegenerate;
