import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { MoreVertical, Play, Pause, Copy, Trash2 } from 'lucide-react';
import { Send } from '@/types/sends';
import StatusBadge from './StatusBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DisparoCardProps {
  send: Send;
  onVerDetalhes: (id: string) => void;
  onPausar: (id: string) => void;
  onDuplicar: (id: string) => void;
  onExcluir: (id: string) => void;
}

export default function DisparoCard({
  send,
  onVerDetalhes,
  onPausar,
  onDuplicar,
  onExcluir,
}: DisparoCardProps) {
  const progressPercentage = send.total_contacts > 0
    ? Math.round(((send.sent_count + send.failed_count) / send.total_contacts) * 100)
    : 0;

  return (
    <Card className="p-6 border border-border bg-card rounded-[2px] transition-all duration-300 hover:border-white/[0.10]">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-[18px] font-['Outfit'] font-semibold mb-2">{send.name}</h3>
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={send.status} size="sm" />
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-[30px] w-[30px] p-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {send.status === 'running' || send.status === 'paused' ? (
                <DropdownMenuItem onClick={() => onPausar(send.id)}>
                  {send.status === 'running' ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Pausar
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Retomar
                    </>
                  )}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={() => onDuplicar(send.id)}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExcluir(send.id)} className="text-[#EF4444]">
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm text-muted-foreground">
          {send.pipeline && (
            <div>Pipeline: {send.pipeline.name} → {send.stage?.name}</div>
          )}
          {send.whatsapp_template && (
            <div>Template: {send.whatsapp_template.name}</div>
          )}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-4 py-3 border-t border-border">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{send.total_contacts}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#00D26A]">{send.sent_count}</div>
            <div className="text-xs text-muted-foreground">Enviados</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[#EF4444]">{send.failed_count}</div>
            <div className="text-xs text-muted-foreground">Falhas</div>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium text-foreground">{progressPercentage}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Action */}
        <Button 
          onClick={() => onVerDetalhes(send.id)}
          variant="outline"
          className="w-full h-[30px] rounded-[4px] text-xs"
        >
          Ver Detalhes
        </Button>
      </div>
    </Card>
  );
}
