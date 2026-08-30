import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { useMFA } from '@/hooks/useMFA';

type Step = 'totp' | 'recovery';

const MfaVerify = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from: string = (location.state as { from?: string })?.from ?? '/';

  const { factors, challenge, verify, consumeRecoveryCode } = useMFA();
  const [step, setStep] = useState<Step>('totp');
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [totpCountdown, setTotpCountdown] = useState(0);
  const [isProcessingRecovery, setIsProcessingRecovery] = useState(false);

  const factorId = factors?.totp?.[0]?.id ?? '';
  const isPending = challenge.isPending || verify.isPending;

  useEffect(() => {
    if (step !== 'totp') return;
    const update = () => setTotpCountdown(Math.floor(30 - ((Date.now() / 1000) % 30)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [step]);

  const handleVerifyTotp = useCallback(async () => {
    if (code.length !== 6 || !factorId) return;
    setError(null);

    try {
      const challengeId = await challenge.mutateAsync({ factorId });
      await verify.mutateAsync({ factorId, challengeId, code });
      navigate(from, { replace: true });
    } catch {
      setError('Código inválido. Tente o próximo código do app autenticador.');
      setCode('');
    }
  }, [code, factorId, challenge, verify, navigate, from]);

  useEffect(() => {
    if (code.length === 6 && step === 'totp') {
      handleVerifyTotp();
    }
  }, [code, step, handleVerifyTotp]);

  const handleRecovery = async () => {
    const trimmed = recoveryCode.trim().toUpperCase();
    if (!trimmed) return;
    setError(null);
    setIsProcessingRecovery(true);

    try {
      const result = await consumeRecoveryCode.mutateAsync({ code: trimmed });
      if (!result?.success) {
        const msg = result?.error === 'factor_not_found'
          ? 'Autenticador não encontrado. Contate o administrador.'
          : 'Código de recuperação inválido ou já utilizado.';
        setError(msg);
        setIsProcessingRecovery(false);
        return;
      }

      toast.success('Código validado. Configure um novo autenticador para continuar.');
      navigate('/settings/mfa-setup', { replace: true });
    } catch {
      setError('Erro ao processar código de recuperação. Tente novamente.');
      setIsProcessingRecovery(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-[20px] font-semibold text-foreground">
            Verificação em dois fatores
          </h1>
          <p className="text-[13px] text-muted-foreground/70 mt-1.5">
            {step === 'totp'
              ? 'Insira o código do seu app autenticador para continuar.'
              : 'Insira um código de recuperação para acessar sua conta.'}
          </p>
        </div>

        <div className="border border-border rounded-[4px] bg-card">
          {/* TOTP step */}
          {step === 'totp' && (
            <div className="p-6 space-y-5">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  autoFocus
                  autoComplete="one-time-code"
                  aria-label="Código de 6 dígitos do autenticador"
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

              <p className="text-[11px] text-muted-foreground text-center">
                O código muda a cada 30 segundos. Restam {totpCountdown}s.
              </p>

              {error && (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-[4px] px-3 py-2 text-center"
                >
                  {error}
                </p>
              )}

              <Button
                className="w-full"
                onClick={handleVerifyTotp}
                disabled={code.length !== 6 || isPending || !factorId}
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verificar'}
              </Button>

              <button
                type="button"
                onClick={() => { setStep('recovery'); setCode(''); setError(null); }}
                className="w-full text-[12px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Usar código de recuperação
              </button>
            </div>
          )}

          {/* Recovery step */}
          {step === 'recovery' && (
            <div className="p-6 space-y-4">
              <div>
                <p className="text-[13px] font-medium text-foreground mb-1">
                  Código de recuperação
                </p>
                <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
                  Insira um dos 10 códigos que você salvou durante a configuração do MFA.
                  Após validar, seu autenticador será removido e você poderá cadastrar um novo.
                </p>
              </div>

              <input
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                className="w-full h-10 px-3 text-[13px] font-mono tracking-wider border border-border rounded-[4px] bg-background text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={(e) => e.key === 'Enter' && handleRecovery()}
              />

              {error && (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-[4px] px-3 py-2"
                >
                  {error}
                </p>
              )}

              <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                Atenção: após usar um código de recuperação, seu autenticador TOTP será removido
                e você precisará configurar um novo.
              </p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setStep('totp'); setRecoveryCode(''); setError(null); }}
                  disabled={isProcessingRecovery}
                >
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleRecovery}
                  disabled={!recoveryCode.trim() || isProcessingRecovery}
                >
                  {isProcessingRecovery ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Validar código'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground/50 text-center">
          Problemas? Contate o administrador da conta.
        </p>
      </div>
    </div>
  );
};

export default MfaVerify;
