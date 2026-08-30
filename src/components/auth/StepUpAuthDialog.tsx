import { useState, useCallback, useEffect } from 'react';
import { Loader2, Shield } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp';
import { useMFA } from '@/hooks/useMFA';

interface StepUpAuthDialogProps {
  open: boolean;
  onVerified: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}

export function StepUpAuthDialog({
  open,
  onVerified,
  onCancel,
  title = 'Confirmar identidade',
  description = 'Por segurança, confirme com o código do seu app autenticador.',
}: StepUpAuthDialogProps) {
  const { factors, challenge, verify } = useMFA();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const factorId = factors?.totp?.[0]?.id ?? '';
  const isPending = challenge.isPending || verify.isPending;

  useEffect(() => {
    if (!open) {
      setCode('');
      setError(null);
    }
  }, [open]);

  const handleVerify = useCallback(async () => {
    if (code.length !== 6 || !factorId) return;
    setError(null);

    try {
      const challengeId = await challenge.mutateAsync({ factorId });
      await verify.mutateAsync({ factorId, challengeId, code });
      onVerified();
    } catch {
      setError('Código inválido. Tente o próximo código do app autenticador.');
      setCode('');
    }
  }, [code, factorId, challenge, verify, onVerified]);

  useEffect(() => {
    if (code.length === 6 && open && !isPending) {
      handleVerify();
    }
  }, [code, open, isPending, handleVerify]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-sm rounded-[4px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-primary" />
            <DialogTitle className="text-[15px]">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-[12px] text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
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

          {error && (
            <p
              role="alert"
              aria-live="assertive"
              className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-[4px] px-3 py-2 text-center"
            >
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-[4px]"
              onClick={onCancel}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 rounded-[4px]"
              onClick={handleVerify}
              disabled={code.length !== 6 || isPending || !factorId}
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verificar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
