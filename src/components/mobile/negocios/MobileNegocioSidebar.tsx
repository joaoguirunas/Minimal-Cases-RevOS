import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose
} from '@/components/ui/sheet';
import {
  DollarSign, GitBranch, User, Building2, Check, X, Edit2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Negocio } from '@/hooks/useNegocios';
import { type Pipeline, type Stage } from '@/hooks/usePipelines';

type NegocioUpdate = Partial<Negocio> & { id: string };

interface MobileNegocioSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  negocio: Negocio;
  pipelines: Pipeline[];
  stages: Stage[];
  onUpdateNegocio: (data: NegocioUpdate) => Promise<void>;
}

export const MobileNegocioSidebar = ({
  open,
  onOpenChange,
  negocio,
  pipelines,
  stages,
  onUpdateNegocio,
}: MobileNegocioSidebarProps) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const currentPipeline = pipelines?.find((p) => p.id === negocio?.leads_pipelines_id);
  const currentStage = stages?.find((s) => s.id === negocio?.leads_stages_id);
  const pipelineStages = stages?.filter((s) => s.leads_pipelines_id === negocio?.leads_pipelines_id) || [];

  const startEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const saveEdit = async (field: string) => {
    if (!negocio) return;
    const updates: NegocioUpdate = { id: negocio.id };
    if (field === 'value') updates.value = parseFloat(editValue) || 0;
    await onUpdateNegocio(updates);
    cancelEdit();
  };

  const handlePipelineChange = async (pipelineId: string) => {
    if (!negocio) return;
    const newStages = stages?.filter((s) => s.leads_pipelines_id === pipelineId) || [];
    const firstStage = newStages.sort((a, b) => (a.order_index || 0) - (b.order_index || 0))[0];
    await onUpdateNegocio({
      id: negocio.id,
      leads_pipelines_id: pipelineId,
      leads_stages_id: firstStage?.id,
    });
  };

  const handleStageChange = async (stageId: string) => {
    if (!negocio) return;
    await onUpdateNegocio({ id: negocio.id, leads_stages_id: stageId });
  };

  if (!negocio) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-[12px] px-4 pb-8">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="text-base">Detalhes do Negócio</SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto mt-4 space-y-5">
          {/* Valor */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Valor
            </label>
            {editingField === 'value' ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="h-10 text-sm"
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" onClick={() => saveEdit('value')}>
                  <Check className="h-4 w-4 text-emerald-600" />
                </Button>
                <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" onClick={cancelEdit}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => startEdit('value', String(negocio.value || 0))}
                className="w-full flex items-center justify-between p-2.5 rounded-[4px] border border-border bg-card min-h-[44px] text-sm"
              >
                <span className="font-medium">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(negocio.value || 0)}
                </span>
                <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Pipeline */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" /> Pipeline
            </label>
            <Select value={negocio.leads_pipelines_id || ''} onValueChange={handlePipelineChange}>
              <SelectTrigger className="h-11 min-h-[44px] text-sm">
                <SelectValue placeholder="Selecionar pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name || p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Etapa */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Etapa</label>
            <Select value={negocio.leads_stages_id || ''} onValueChange={handleStageChange}>
              <SelectTrigger className="h-11 min-h-[44px] text-sm">
                <SelectValue placeholder="Selecionar etapa" />
              </SelectTrigger>
              <SelectContent>
                {pipelineStages
                  .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        {s.color && (
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        )}
                        {s.name || s.nome}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Responsável */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Responsável
            </label>
            <div className="p-2.5 rounded-[4px] border border-border bg-card min-h-[44px] text-sm flex items-center">
              {typeof negocio.responsavel === 'string'
                ? negocio.responsavel
                : negocio.responsavel?.nome || negocio.responsavel?.name || 'Não atribuído'}
            </div>
          </div>

          {/* Empresa */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Empresa
            </label>
            <div className="p-2.5 rounded-[4px] border border-border bg-card min-h-[44px] text-sm flex items-center">
              {negocio.empresa?.trade_name || negocio.empresa?.nome || 'Sem empresa'}
            </div>
          </div>

          {/* Contacto */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Contacto
            </label>
            <div className="p-2.5 rounded-[4px] border border-border bg-card min-h-[44px] text-sm space-y-1">
              <div className="font-medium">
                {negocio.pessoa?.nome || negocio.pessoa?.name || 'Sem contacto'}
              </div>
              {negocio.pessoa?.email && (
                <div className="text-muted-foreground text-xs">{negocio.pessoa.email}</div>
              )}
              {negocio.pessoa?.whatsapp && (
                <div className="text-muted-foreground text-xs">{negocio.pessoa.whatsapp}</div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
