import { useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, Plus, Settings, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CalendarConnectionHealth } from "@/hooks/useCalendarConnectionsHealth";

interface GoogleSuccessViewProps {
  connections: CalendarConnectionHealth[];
  onAddAccount: () => void;
  onReconfigure: () => void;
  onDisconnectAll: () => void;
}

export default function GoogleSuccessView({
  connections,
  onAddAccount,
  onReconfigure,
  onDisconnectAll,
}: GoogleSuccessViewProps) {
  const navigate = useNavigate();
  const healthyCount = connections.filter(c => c.status === 'healthy').length;

  return (
    <div className="border border-emerald-500/25 rounded-[4px] bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-emerald-500/5 border-b border-emerald-500/20 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-foreground">Google Calendar conectado</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {healthyCount} {healthyCount === 1 ? 'conta ativa' : 'contas ativas'}
          </p>
        </div>
      </div>

      {/* Conexões */}
      {connections.length > 0 && (
        <div className="divide-y divide-border/40">
          {connections.map(c => (
            <div key={c.user_id} className="px-5 py-3 flex items-center gap-3">
              <div className="w-[30px] h-[30px] rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                {c.user_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{c.user_name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{c.google_email}</p>
              </div>
              {c.status === 'healthy' ? (
                <Badge variant="outline" className="gap-1 rounded-[3px] text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/5 shrink-0">
                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> Conectado
                </Badge>
              ) : c.status === 'expired' ? (
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="gap-1 rounded-[3px] text-[10px] text-red-600 border-red-500/30 bg-red-500/5">
                    <XCircle className="w-3 h-3" aria-hidden="true" /> Token expirado
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-[26px] text-[11px] rounded-[3px] px-2"
                    onClick={() => navigate('/profile')}
                  >
                    Reconectar
                  </Button>
                </div>
              ) : (
                <Badge variant="outline" className="gap-1 rounded-[3px] text-[10px] text-muted-foreground border-border shrink-0">
                  <AlertCircle className="w-3 h-3" aria-hidden="true" /> Desconhecido
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ações */}
      <div className="px-5 py-3 border-t border-border flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-[30px] text-xs rounded-[4px] gap-1.5"
          onClick={onAddAccount}
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          Adicionar outra conta
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-[30px] text-xs rounded-[4px] gap-1.5 text-muted-foreground"
          onClick={onReconfigure}
        >
          <Settings className="w-3.5 h-3.5" aria-hidden="true" />
          Reconfigurar credenciais
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-[30px] text-xs rounded-[4px] gap-1.5 text-red-600 hover:text-red-600 hover:bg-red-500/10 ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              Desconectar tudo
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-[4px]">
            <AlertDialogHeader>
              <AlertDialogTitle>Desconectar todas as contas?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação remove todas as conexões Google Calendar. Os consultores precisarão reconectar suas agendas. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-[4px]">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDisconnectAll}
                className="rounded-[4px] bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                Desconectar tudo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
