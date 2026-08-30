import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MfaGraceBannerProps {
  graceUntil?: string;
  onDismiss: () => void;
}

export function MfaGraceBanner({ graceUntil, onDismiss }: MfaGraceBannerProps) {
  const daysLeft = graceUntil
    ? Math.ceil((new Date(graceUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const urgency =
    daysLeft !== null && daysLeft <= 1
      ? 'critical'
      : daysLeft !== null && daysLeft <= 3
      ? 'warning'
      : 'info';

  const deadlineText =
    daysLeft === null
      ? 'Configure o mais breve possível'
      : daysLeft <= 0
      ? 'O prazo expirou.'
      : daysLeft === 1
      ? 'Último dia para configurar.'
      : `Configure em até ${daysLeft} dias`;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'sticky top-0 z-40 flex items-center gap-3 px-4 py-2.5 border-b text-sm',
        urgency === 'critical' &&
          'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400',
        urgency === 'warning' &&
          'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400',
        urgency === 'info' &&
          'bg-amber-500/[0.08] border-amber-500/20 text-amber-700 dark:text-amber-400',
      )}
    >
      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
      <p className="flex-1 text-xs">
        Sua conta requer autenticação em dois fatores (MFA).{' '}
        <strong>{deadlineText}</strong> para continuar acessando.
      </p>
      <a
        href="/settings/mfa-setup"
        className="shrink-0 text-xs font-medium underline underline-offset-2 hover:no-underline"
      >
        Configurar agora
      </a>
      <button
        onClick={onDismiss}
        aria-label="Dispensar aviso de MFA (volta no próximo login)"
        className="shrink-0 p-1 rounded-[3px] hover:bg-black/10 transition-colors"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
