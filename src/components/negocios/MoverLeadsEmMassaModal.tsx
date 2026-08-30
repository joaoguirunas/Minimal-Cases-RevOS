import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight } from 'lucide-react';
import { Stage } from '@/hooks/usePipelines';
import { useMoverLeadsEmMassa } from '@/hooks/useMoverLeadsEmMassa';

interface MoverLeadsEmMassaModalProps {
  open: boolean;
  onClose: () => void;
  stages: Stage[];
  defaultFromStageId?: string | null;
}

export default function MoverLeadsEmMassaModal({ open, onClose, stages, defaultFromStageId }: MoverLeadsEmMassaModalProps) {
  const [fromStageId, setFromStageId] = useState<string>(defaultFromStageId || '');
  const [toStageId, setToStageId] = useState<string>('');
  const [quantidade, setQuantidade] = useState<string>('10');
  const moverLeads = useMoverLeadsEmMassa();

  const stagesOrdenadas = useMemo(
    () => [...stages].sort((a, b) => (a.order_index ?? a.ordem ?? 0) - (b.order_index ?? b.ordem ?? 0)),
    [stages],
  );

  const handleClose = () => {
    if (moverLeads.isPending) return;
    onClose();
  };

  const handleConfirm = async () => {
    const n = parseInt(quantidade, 10);
    if (!fromStageId || !toStageId || !n || n < 1) return;
    if (fromStageId === toStageId) return;

    await moverLeads.mutateAsync({ fromStageId, toStageId, quantidade: n });
    onClose();
  };

  const isValid = !!fromStageId && !!toStageId && fromStageId !== toStageId && parseInt(quantidade, 10) > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold">Mover leads em massa</DialogTitle>
          <p className="text-[13px] text-muted-foreground/70 mt-0.5">
            Move os leads mais antigos (em andamento) de uma etapa pra outra, de uma vez.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Quantidade de leads</Label>
            <Input
              type="number"
              min={1}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="h-[32px] text-[13px]"
              disabled={moverLeads.isPending}
            />
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">De</Label>
              <Select value={fromStageId} onValueChange={setFromStageId} disabled={moverLeads.isPending}>
                <SelectTrigger className="h-[32px] text-[13px]">
                  <SelectValue placeholder="Etapa de origem" />
                </SelectTrigger>
                <SelectContent>
                  {stagesOrdenadas.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>{stage.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ArrowRight className="w-4 h-4 text-muted-foreground/40 mb-2" strokeWidth={1.5} />

            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Para</Label>
              <Select value={toStageId} onValueChange={setToStageId} disabled={moverLeads.isPending}>
                <SelectTrigger className="h-[32px] text-[13px]">
                  <SelectValue placeholder="Etapa de destino" />
                </SelectTrigger>
                <SelectContent>
                  {stagesOrdenadas.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id} disabled={stage.id === fromStageId}>
                      {stage.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/50">
            Cada lead movido dispara o follow-up automático da etapa de destino normalmente (se houver um configurado).
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={moverLeads.isPending}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!isValid || moverLeads.isPending}>
            {moverLeads.isPending ? 'Movendo...' : 'Mover leads'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
