import { useNavigate } from "react-router-dom";
import { CalendarCheck, CheckCircle2, XCircle, AlertCircle, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarConnectionHealth } from "@/hooks/useCalendarConnectionsHealth";
import ConfigWizardStep, { CtaState } from "../ConfigWizardStep";

interface Step5ConnectProps {
  isFocused: boolean;
  connections: CalendarConnectionHealth[];
  onFinish: () => void;
  onSkip: () => void;
}

export default function Step5Connect({ isFocused, connections, onFinish, onSkip }: Step5ConnectProps) {
  const navigate = useNavigate();
  const hasHealthy = connections.some(c => c.status === 'healthy');

  const handleConnect = () => {
    navigate('/profile');
  };

  const ctaState: CtaState = 'idle';

  return (
    <ConfigWizardStep
      stepNumber={5}
      title="Conectar Google Calendar"
      instruction="Credenciais configuradas! Conecte sua conta Google para usar o Calendar."
      ctaLabel="Concluir configuração"
      ctaState={hasHealthy ? ctaState : 'idle'}
      onCta={onFinish}
      onSkip={onSkip}
      skipLabel="Pular por agora"
      isFocused={isFocused}
    >
      {/* Botão OAuth */}
      <Button
        size="sm"
        variant="outline"
        className="w-full rounded-[4px] h-9 gap-2"
        onClick={handleConnect}
      >
        <CalendarCheck className="w-4 h-4" aria-hidden="true" />
        Conectar minha conta Google
      </Button>

      {/* Lista de conexões */}
      {connections.length > 0 && (
        <div className="border border-border rounded-[4px] bg-card overflow-hidden">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 border-b border-border">
            Conexões ativas
          </p>
          <div className="divide-y divide-border/40">
            {connections.map(c => (
              <div key={c.user_id} className="px-3 py-2.5 flex items-center gap-3">
                <div className="w-[28px] h-[28px] rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
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
                  <Badge variant="outline" className="gap-1 rounded-[3px] text-[10px] text-red-600 border-red-500/30 bg-red-500/5 shrink-0">
                    <XCircle className="w-3 h-3" aria-hidden="true" /> Token expirado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 rounded-[3px] text-[10px] text-muted-foreground border-border shrink-0">
                    <AlertCircle className="w-3 h-3" aria-hidden="true" /> Desconhecido
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Callout Testing mode */}
      <div className="flex items-start gap-2.5 p-3 rounded-[4px] border border-blue-500/20 bg-blue-500/5">
        <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-400">App em modo Testing</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Apenas test users conseguem conectar. Adicione os emails dos consultores ou publique o app para produção.
          </p>
          <a
            href="https://console.cloud.google.com/auth/audience"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir Audience → Test Users (abre em nova aba)"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2"
          >
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
            Audience → Test Users
          </a>
        </div>
      </div>
    </ConfigWizardStep>
  );
}
