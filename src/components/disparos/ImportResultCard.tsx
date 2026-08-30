import { CheckCircle2, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ImportarListaResult } from '@/hooks/useImportarLista';

interface ImportResultCardProps {
  result: ImportarListaResult;
  onReset: () => void;
  onConfirm: () => void;
}

export default function ImportResultCard({
  result,
  onReset,
  onConfirm,
}: ImportResultCardProps) {
  return (
    <div className="rounded-[4px] border border-border p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
        </div>
        <p className="text-[14px] font-semibold text-foreground">Importação concluída</p>
      </div>

      {/* Stats */}
      <div className="space-y-2">
        <div className="flex items-center justify-between py-1.5 border-b border-border/50">
          <span className="text-[12px] text-muted-foreground">Novos cadastros criados</span>
          <span className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
            {result.new_people.toLocaleString('pt-BR')}
          </span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-b border-border/50">
          <span className="text-[12px] text-muted-foreground">Contatos já existentes vinculados</span>
          <span className="text-[13px] font-semibold text-foreground">
            {result.existing_people.toLocaleString('pt-BR')}
          </span>
        </div>
        {result.failed_rows > 0 && (
          <div className="flex items-center justify-between py-1.5 border-b border-border/50">
            <span className="text-[12px] text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.5} />
              Linhas com erro
            </span>
            <span className="text-[13px] font-semibold text-amber-500">
              {result.failed_rows.toLocaleString('pt-BR')}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[12px] font-medium text-foreground">Total para disparo</span>
          <span className="text-[15px] font-bold text-primary">
            {result.total.toLocaleString('pt-BR')}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="h-[30px] text-[12px] gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
          Alterar arquivo
        </Button>
        <Button
          size="sm"
          onClick={onConfirm}
          className="h-[30px] text-[12px] gap-1.5 flex-1"
        >
          Confirmar e configurar disparo
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  );
}
