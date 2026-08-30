import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Square, RotateCcw, Trash2 } from 'lucide-react';
import { Send } from '@/types/sends';
import { useAtualizarSend } from '@/hooks/useSendMutations';
import { useResetSendStats } from '@/hooks/useResetSendStats';
import { useSendDispatch } from '@/hooks/useSendDispatch';
import { ResetStatsModal } from './ResetStatsModal';
import { toast } from 'sonner';

interface DisparoControlsProps {
  send: Send;
  onCountdownChange?: (seconds: number) => void;
}

export default function DisparoControls({ send }: DisparoControlsProps) {
  const [showResetModal, setShowResetModal] = useState(false);
  const { mutate: updateSend, isPending: isUpdating } = useAtualizarSend();
  const { mutate: resetStats, isPending: isResetting } = useResetSendStats();
  const { mutate: startFirstBatch, isPending: isDispatching } = useSendDispatch();

  const handleStart = () => {
    updateSend(
      { id: send.id, data: { status: 'running', started_at: new Date().toISOString() } },
      {
        onSuccess: () => {
          // Kick first batch immediately; pg_cron handles subsequent batches
          startFirstBatch(
            { sendId: send.id },
            {
              onSuccess: (data) => {
                if ((data.processed ?? 0) === 0) {
                  // No contacts were dispatched — revert so the user can investigate
                  updateSend({ id: send.id, data: { status: 'draft', started_at: null } });
                  toast.error('Nenhum contato pendente encontrado. Verifique se a lista foi importada corretamente.');
                } else {
                  toast.success('Disparo iniciado!');
                }
              },
              onError: (err: Error) => {
                // Revert status back to draft so the user can fix the issue and retry
                updateSend({ id: send.id, data: { status: 'draft', started_at: null } });
                toast.error('Erro ao iniciar disparo: ' + err.message);
              },
            },
          );
        },
        onError: () => toast.error('Erro ao iniciar disparo'),
      }
    );
  };

  const handleStop = () => {
    // Updating status to 'paused' in DB is enough — pg_cron skips non-running sends
    updateSend(
      { id: send.id, data: { status: 'paused' } },
      {
        onSuccess: () => toast.success('Disparo pausado!'),
        onError: () => toast.error('Erro ao pausar disparo'),
      }
    );
  };

  const handleComplete = () => {
    updateSend(
      { id: send.id, data: { status: 'completed', completed_at: new Date().toISOString() } },
      {
        onSuccess: () => toast.success('Disparo finalizado!'),
        onError: () => toast.error('Erro ao finalizar disparo'),
      }
    );
  };

  const handleReopen = () => {
    updateSend(
      { id: send.id, data: { status: 'draft', completed_at: null } },
      {
        onSuccess: () => toast.success('Disparo reaberto!'),
        onError: () => toast.error('Erro ao reabrir disparo'),
      }
    );
  };

  const handleResetStats = () => {
    resetStats(send.id, {
      onSuccess: () => setShowResetModal(false),
    });
  };

  const canStart = ['draft', 'scheduled'].includes(send.status);
  const canResume = send.status === 'paused';
  const canPause = send.status === 'running';
  const canStop = send.status === 'running';
  const canReopen = send.status === 'completed';
  const canReset = send.status !== 'running';
  const isProcessing = isDispatching || isUpdating || isResetting;

  return (
    <>
      <Card className="p-6 border border-border bg-card rounded-[2px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-[18px] font-['Outfit'] font-semibold mb-2">Controles do Disparo</h3>
              <p className="text-sm text-muted-foreground">Gerencie a execução e estatísticas</p>
            </div>
            {send.status === 'running' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Rodando em background
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {canStart && (
              <Button onClick={handleStart} disabled={isProcessing} className="h-[30px] rounded-[4px] text-xs gap-2">
                <Play className="w-4 h-4" />
                Iniciar Disparo
              </Button>
            )}

            {canResume && (
              <Button onClick={handleStart} disabled={isProcessing} className="h-[30px] rounded-[4px] text-xs gap-2">
                <Play className="w-4 h-4" />
                Retomar Disparo
              </Button>
            )}

            {canPause && (
              <Button onClick={handleStop} disabled={isProcessing} variant="outline" className="h-[30px] rounded-[4px] text-xs gap-2">
                <Square className="w-4 h-4" />
                Pausar
              </Button>
            )}

            {canStop && (
              <Button onClick={handleComplete} disabled={isProcessing} variant="destructive" className="h-[30px] rounded-[4px] text-xs gap-2">
                <Square className="w-4 h-4" />
                Parar Disparo
              </Button>
            )}

            {canReopen && (
              <Button onClick={handleReopen} disabled={isProcessing} variant="outline" className="h-[30px] rounded-[4px] text-xs gap-2">
                <RotateCcw className="w-4 h-4" />
                Reabrir
              </Button>
            )}

            {canReset && (
              <Button
                onClick={() => setShowResetModal(true)}
                disabled={isProcessing}
                variant="outline"
                className="h-[30px] rounded-[4px] text-xs gap-2 ml-auto text-[#F59E0B] border-[#F59E0B]/20 hover:bg-[#F59E0B]/10"
              >
                <Trash2 className="w-4 h-4" />
                Resetar Estatísticas
              </Button>
            )}
          </div>

          {isProcessing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Processando operação...
            </div>
          )}
        </div>
      </Card>

      <ResetStatsModal
        open={showResetModal}
        onOpenChange={setShowResetModal}
        onConfirm={handleResetStats}
        isLoading={isResetting}
      />
    </>
  );
}
