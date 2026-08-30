import { useRef, useEffect } from "react";
import { ExternalLink, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CtaState = 'idle' | 'loading' | 'success' | 'error';

interface ConfigWizardStepProps {
  stepNumber: number;
  title: string;
  instruction: string;
  externalUrl?: string;
  externalLabel?: string;
  children?: React.ReactNode;
  ctaLabel?: string;
  ctaState?: CtaState;
  ctaDisabled?: boolean;
  ctaError?: string;
  onCta: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  isOptional?: boolean;
  isFocused?: boolean;
}

export default function ConfigWizardStep({
  stepNumber,
  title,
  instruction,
  externalUrl,
  externalLabel,
  children,
  ctaLabel = 'Continuar',
  ctaState = 'idle',
  ctaDisabled = false,
  ctaError,
  onCta,
  onSkip,
  skipLabel = 'Já fiz isso',
  isOptional = false,
  isFocused = false,
}: ConfigWizardStepProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (isFocused) titleRef.current?.focus();
  }, [isFocused]);

  return (
    <div className="border border-border rounded-[4px] bg-card p-5 space-y-4">
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Step {stepNumber}{isOptional ? ' (opcional)' : ''}
        </p>
        <h3
          ref={titleRef}
          tabIndex={-1}
          className="text-sm font-semibold text-foreground outline-none"
        >
          {title}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{instruction}</p>
      </div>

      {externalUrl && (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${externalLabel ?? 'Abrir no Google Cloud'} (abre em nova aba)`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline underline-offset-2"
        >
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
          {externalLabel ?? 'Abrir no Google Cloud'}
        </a>
      )}

      {children && <div className="space-y-3">{children}</div>}

      <div className="flex items-center gap-3 pt-1">
        <Button
          size="sm"
          className="rounded-[4px] h-[30px]"
          onClick={onCta}
          disabled={ctaDisabled || ctaState === 'loading' || ctaState === 'success'}
        >
          {ctaState === 'loading' && (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden="true" />
          )}
          {ctaState === 'success' && (
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-500" aria-hidden="true" />
          )}
          {ctaState === 'loading'
            ? 'Validando...'
            : ctaState === 'success'
            ? 'Validado'
            : ctaLabel}
        </Button>
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {skipLabel}
          </button>
        )}
      </div>

      {ctaState === 'error' && ctaError && (
        <p className="text-xs text-destructive flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          {ctaError}
        </p>
      )}
    </div>
  );
}
