import { Loader2, AlertCircle } from 'lucide-react';
import { useImportSession } from '@/hooks/useImportSession';

interface ImportProgressCardProps {
  sessionId: string;
}

export default function ImportProgressCard({ sessionId }: ImportProgressCardProps) {
  const { data: session, isError } = useImportSession(sessionId);

  if (isError) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-[4px] bg-destructive/10 border border-destructive/20 text-[13px] text-destructive">
        <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
        Erro ao consultar progresso da importação.
      </div>
    );
  }

  const total     = session?.total_rows   ?? 0;
  const processed = session?.processed    ?? 0;
  const newPeople = session?.new_people   ?? 0;
  const existing  = session?.existing_people ?? 0;
  const failed    = session?.failed_rows  ?? 0;
  const pct       = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="rounded-[4px] border border-border p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 text-primary animate-spin" strokeWidth={1.5} />
        <p className="text-[13px] font-medium text-foreground">Importando contatos...</p>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{processed.toLocaleString('pt-BR')} / {total.toLocaleString('pt-BR')} linhas</span>
          <span>{pct}%</span>
        </div>
      </div>

      {/* Counters */}
      <div className="flex items-center gap-4 text-[12px]">
        <span className="text-emerald-600 dark:text-emerald-400">
          Novos: <strong>{newPeople}</strong>
        </span>
        <span className="text-muted-foreground">
          Já existentes: <strong>{existing}</strong>
        </span>
        {failed > 0 && (
          <span className="text-destructive">
            Falhas: <strong>{failed}</strong>
          </span>
        )}
      </div>
    </div>
  );
}
