import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useMFA } from '@/hooks/useMFA';

export function MfaSection() {
  const { isActive, isLoadingFactors } = useMFA();

  if (isLoadingFactors) {
    return (
      <div className="border border-border rounded-[4px] bg-card">
        <div className="px-5 py-4">
          <p className="text-sm font-semibold text-foreground">Autenticação em dois fatores</p>
          <div className="h-4 w-32 bg-muted animate-pulse rounded mt-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-[4px] bg-card divide-y divide-border">
      <div className="px-5 py-4">
        <p className="text-sm font-semibold text-foreground">Autenticação em dois fatores</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Proteja sua conta com um segundo fator de autenticação.
        </p>
      </div>

      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status:</span>
          {isActive ? (
            <Badge
              variant="outline"
              className="gap-1 text-emerald-600 border-emerald-500/30 bg-emerald-500/5 rounded-[3px] text-[11px]"
            >
              <CheckCircle2 className="w-3 h-3" />
              Ativo — TOTP
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 text-muted-foreground border-border rounded-[3px] text-[11px]"
            >
              <AlertCircle className="w-3 h-3" />
              Não configurado
            </Badge>
          )}
        </div>
        {!isActive && (
          <Button size="sm" variant="outline" className="rounded-[4px] h-[30px] text-xs" asChild>
            <a href="/settings/mfa-setup">Ativar MFA</a>
          </Button>
        )}
      </div>

      {isActive && (
        <>
          <div className="px-5 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-foreground">Códigos de recuperação</p>
              <p className="text-[11px] text-muted-foreground">Regenere se perdeu os originais.</p>
            </div>
            <Button size="sm" variant="outline" className="rounded-[4px] h-[30px] text-xs shrink-0" asChild>
              <a href="/settings/mfa-recovery-regenerate">Regenerar</a>
            </Button>
          </div>

          <div className="px-5 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-foreground">Desativar MFA</p>
              <p className="text-[11px] text-muted-foreground">Requer confirmação adicional.</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-[4px] h-[30px] text-xs"
                    disabled
                    aria-disabled="true"
                  >
                    Desativar
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                Disponível em breve (AUTH-V2-03c)
              </TooltipContent>
            </Tooltip>
          </div>
        </>
      )}
    </div>
  );
}
