import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GitMerge, Briefcase, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LeadOption {
  id: string;
  personName: string;
  pipelineName: string;
  stageName: string;
  value?: number | null;
}

interface MergeLeadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadA: LeadOption; // current person's lead
  leadB: LeadOption; // existing (canonical) person's lead
  onConfirm: (keepLeadId: string) => void;
  isLoading?: boolean;
}

function LeadCard({
  lead,
  selected,
  onSelect,
}: {
  lead: LeadOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-[4px] border p-3 transition-colors',
        selected
          ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/30'
          : 'bg-muted border-border hover:border-border',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Briefcase className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{lead.personName}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {lead.pipelineName} › {lead.stageName}
            </p>
            {lead.value != null && lead.value > 0 && (
              <p className="text-[11px] text-primary font-medium mt-0.5">
                R$ {lead.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
        </div>
        <div className={cn(
          'w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors',
          selected ? 'border-primary bg-primary' : 'border-border',
        )}>
          {selected && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
        </div>
      </div>
    </button>
  );
}

export const MergeLeadsModal = ({
  open,
  onOpenChange,
  leadA,
  leadB,
  onConfirm,
  isLoading = false,
}: MergeLeadsModalProps) => {
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leadB.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <GitMerge className="w-4 h-4 text-primary" />
            </div>
            <DialogTitle className="text-base font-semibold">Qual negócio manter?</DialogTitle>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed pl-11">
            Ambos os contatos têm um negócio ativo. Escolha qual manter — o outro será arquivado.
          </p>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-2">
          <LeadCard lead={leadA} selected={selectedLeadId === leadA.id} onSelect={() => setSelectedLeadId(leadA.id)} />
          <LeadCard lead={leadB} selected={selectedLeadId === leadB.id} onSelect={() => setSelectedLeadId(leadB.id)} />

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => onConfirm(selectedLeadId)}
              disabled={isLoading}
              className="flex-1 gap-1.5"
            >
              <GitMerge className="w-3.5 h-3.5" />
              {isLoading ? 'Unificando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MergeLeadsModal;
