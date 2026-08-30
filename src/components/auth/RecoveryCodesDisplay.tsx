import { useState } from 'react';
import { AlertTriangle, Copy, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface RecoveryCodesDisplayProps {
  codes: string[];
  email?: string;
  additionalWarning?: string;
  onConfirmed: () => void;
  confirmLabel?: string;
}

export function RecoveryCodesDisplay({
  codes,
  email,
  additionalWarning,
  onConfirmed,
  confirmLabel = 'Concluir configuração',
}: RecoveryCodesDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [codesSaved, setCodesSaved] = useState(false);

  const handleCopyAll = async () => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const now = new Date();
    const content = [
      `Códigos de recuperação MFA${email ? ` — ${email}` : ''} — ${now.toLocaleDateString('pt-BR')}`,
      `Gerados em: ${now.toISOString()}`,
      '',
      ...codes,
      '',
      'IMPORTANTE: Guarde em local seguro. Cada código só pode ser usado uma vez.',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mfa-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Amber callout */}
      <div className="flex items-start gap-3 p-4 rounded-[4px] border border-amber-500/30 bg-amber-500/[0.08]">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            Estes códigos serão mostrados APENAS UMA VEZ
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Se você perder o acesso ao app autenticador, estes códigos de recuperação
            serão a única forma de entrar na conta. Guarde-os em local seguro
            (gerenciador de senhas, cofre, etc.).
          </p>
          {additionalWarning && (
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mt-1">
              {additionalWarning}
            </p>
          )}
        </div>
      </div>

      {/* Codes grid */}
      <div className="bg-muted rounded-[4px] p-4">
        <ul aria-label="Códigos de recuperação MFA" className="grid grid-cols-2 gap-2">
          {codes.map((code, i) => (
            <li key={i}>
              <code
                aria-label={`Código ${i + 1}: ${code.replace('-', ' ')}`}
                className="text-[13px] font-mono text-foreground tracking-widest select-all block"
              >
                {code}
              </code>
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="rounded-[4px] h-8 gap-1.5 text-xs"
          onClick={handleCopyAll}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          {copied ? 'Copiado!' : 'Copiar todos'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-[4px] h-8 gap-1.5 text-xs"
          onClick={handleDownload}
        >
          <Download className="w-3.5 h-3.5" />
          Baixar .txt
        </Button>
      </div>

      {/* Mandatory checkbox */}
      <div className="flex items-start gap-2.5 p-3 border border-border rounded-[4px] bg-card">
        <Checkbox
          id="codes-saved"
          checked={codesSaved}
          onCheckedChange={(val) => setCodesSaved(Boolean(val))}
          aria-required="true"
          className="mt-0.5"
        />
        <label htmlFor="codes-saved" className="text-sm text-foreground leading-snug cursor-pointer">
          Salvei os códigos em local seguro
        </label>
      </div>

      <Button
        className="w-full rounded-[4px]"
        disabled={!codesSaved}
        aria-disabled={!codesSaved}
        onClick={onConfirmed}
      >
        {confirmLabel}
      </Button>

      {!codesSaved && (
        <p className="text-[11px] text-muted-foreground text-center">
          Confirme que salvou os códigos para continuar.
        </p>
      )}
    </div>
  );
}
