import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2, Copy, Check, Smartphone, Wifi, Clock } from 'lucide-react';
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
import type { MfaEnrollStep } from '@/types/mfa';

const STEPS: { label: string; key: MfaEnrollStep }[] = [
  { label: 'Intro', key: 'intro' },
  { label: 'QR code', key: 'qr' },
  { label: 'Código', key: 'verify' },
  { label: 'Recuperação', key: 'recovery' },
];

const MfaSetup = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { enroll, challenge, verify, generateRecoveryCodes } = useMFA();

  const [step, setStep] = useState<MfaEnrollStep>('intro');
  const [factorId, setFactorId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [qrSvg, setQrSvg] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [totpCountdown, setTotpCountdown] = useState(0);

  useEffect(() => {
    if (step !== 'verify') return;
    const update = () => setTotpCountdown(Math.floor(30 - ((Date.now() / 1000) % 30)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [step]);

  const handleStart = async () => {
    try {
      const data = await enroll.mutateAsync(undefined);
      setFactorId(data.factorId);
      setQrSvg(data.qrSvg);
      setSecret(data.secret);
      setStep('qr');
    } catch {
      toast.error('Erro ao iniciar configuração de MFA. Tente novamente.');
    }
  };

  const handleProceedToVerify = async () => {
    try {
      const id = await challenge.mutateAsync({ factorId });
      setChallengeId(id);
      setStep('verify');
    } catch {
      toast.error('Erro ao criar desafio MFA. Tente novamente.');
    }
  };

  const handleVerify = useCallback(async () => {
    if (code.length !== 6) return;
    setVerifyError(null);
    try {
      await verify.mutateAsync({ factorId, challengeId, code });
      const codes = await generateRecoveryCodes.mutateAsync(undefined);
      setRecoveryCodes(codes);
      setStep('recovery');
    } catch {
      setVerifyError('Código inválido. Tente o próximo.');
      setCode('');
    }
  }, [code, factorId, challengeId, verify, generateRecoveryCodes]);

  useEffect(() => {
    if (code.length === 6 && step === 'verify') {
      handleVerify();
    }
  }, [code, step, handleVerify]);

  const handleCopySecret = async () => {
    await navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 1800);
  };

  const handleFinish = () => {
    toast.success('MFA configurado com sucesso!');
    navigate('/profile');
  };

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-[20px] font-semibold text-foreground">
            Configurar Autenticação em Dois Fatores
          </h1>
          <p className="text-[13px] text-muted-foreground/70 mt-1.5">
            Adicione uma camada extra de segurança à sua conta.
          </p>
        </div>

        {/* Step indicator */}
        {step !== 'intro' && step !== 'done' && (
          <nav aria-label="Progresso de configuração MFA" className="flex items-center justify-center gap-0">
            {STEPS.map((s, i) => {
              const isDone = i < currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={s.key} className="flex items-center">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors ${
                        isDone
                          ? 'bg-emerald-500 text-white'
                          : isCurrent
                          ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                          : 'bg-muted text-muted-foreground'
                      }`}
                      aria-current={isCurrent ? 'step' : undefined}
                    >
                      {i + 1}
                    </div>
                    <span className={`text-[10px] ${isCurrent ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`w-8 h-px mb-4 mx-1 transition-colors ${isDone ? 'bg-emerald-500' : 'bg-border'}`}
                    />
                  )}
                </div>
              );
            })}
          </nav>
        )}

        <div className="border border-border rounded-[4px] bg-card">
          {/* Step: intro */}
          {step === 'intro' && (
            <div className="p-6 space-y-5">
              <div>
                <p className="text-[14px] font-semibold text-foreground">
                  Ativar autenticação em dois fatores
                </p>
                <p className="text-[12px] text-muted-foreground/70 mt-1 leading-relaxed">
                  Adicione uma camada extra de segurança. Você precisará de um app autenticador
                  como Google Authenticator, Authy ou 1Password.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  O que você vai precisar:
                </p>
                {[
                  { icon: Smartphone, label: 'Smartphone com app autenticador' },
                  { icon: Wifi, label: 'Acesso à internet' },
                  { icon: Clock, label: '~5 minutos' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[12px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>

              <Button
                className="w-full"
                onClick={handleStart}
                disabled={enroll.isPending}
              >
                {enroll.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando QR code...
                  </>
                ) : (
                  'Iniciar configuração'
                )}
              </Button>
            </div>
          )}

          {/* Step: qr */}
          {step === 'qr' && (
            <div className="p-6 space-y-5">
              <div>
                <p className="text-[13px] font-medium text-foreground mb-1">
                  Escaneie o QR code
                </p>
                <p className="text-[12px] text-muted-foreground/70">
                  Abra seu app autenticador e escaneie o código abaixo.
                </p>
              </div>

              {qrSvg ? (
                <div className="flex justify-center">
                  <div
                    className="bg-white p-3 rounded-[4px] inline-block"
                    role="img"
                    aria-label="QR code para configurar autenticador MFA"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
                </div>
              )}

              {secret && (
                <div>
                  <p className="text-[12px] text-muted-foreground/70 mb-1.5">
                    Não consegue escanear? Digite o código manualmente:
                  </p>
                  <div className="flex items-center gap-2">
                    <code
                      className="flex-1 text-[11px] font-mono bg-muted px-2 py-1 rounded-[3px] border border-border break-all select-all"
                      aria-label="Chave secreta manual para configurar autenticador"
                    >
                      {secret}
                    </code>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={handleCopySecret}
                    >
                      {copiedSecret ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep('intro')}
                >
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleProceedToVerify}
                  disabled={!qrSvg || challenge.isPending}
                >
                  {challenge.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Já escaneiei'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step: verify */}
          {step === 'verify' && (
            <div className="p-6 space-y-5">
              <div>
                <p className="text-[13px] font-medium text-foreground mb-1">
                  Confirme o código
                </p>
                <p className="text-[12px] text-muted-foreground/70">
                  Digite o código de 6 dígitos do seu app autenticador.
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
                  disabled={verify.isPending || generateRecoveryCodes.isPending}
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

              {verifyError && (
                <p
                  role="alert"
                  className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-[4px] px-3 py-2"
                >
                  {verifyError}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setStep('qr');
                    setCode('');
                    setVerifyError(null);
                  }}
                >
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleVerify}
                  disabled={code.length !== 6 || verify.isPending || generateRecoveryCodes.isPending}
                >
                  {verify.isPending || generateRecoveryCodes.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Verificar'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step: recovery */}
          {step === 'recovery' && (
            <div className="p-6">
              <p className="text-[13px] font-medium text-foreground mb-4">
                Salve seus códigos de recuperação
              </p>
              <RecoveryCodesDisplay
                codes={recoveryCodes}
                email={user?.email}
                onConfirmed={handleFinish}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MfaSetup;
