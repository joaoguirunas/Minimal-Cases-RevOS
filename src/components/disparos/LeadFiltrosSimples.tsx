import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { SendFilters } from '@/types/sends';
import { usePipelines } from '@/hooks/usePipelines';
import { useUsuarios } from '@/hooks/useUsuarios';

interface LeadFiltrosSimplezProps {
  filters: SendFilters;
  onFilterChange: (newFilters: Partial<SendFilters>) => void;
}

export default function LeadFiltrosSimples({ filters, onFilterChange }: LeadFiltrosSimplezProps) {
  const { pipelines, stages: allStages } = usePipelines();
  const { data: usuarios } = useUsuarios();

  const stages = allStages?.filter(s => s.leads_pipelines_id === filters.pipeline_id) || [];

  const leadStatuses = [
    { value: 'in_progress', label: 'Em Andamento' },
    { value: 'won', label: 'Ganho' },
    { value: 'lost', label: 'Perdido' }
  ];

  return (
    <div className="space-y-6">
      {/* Pipeline - Obrigatório */}
      <Card className="p-6 border border-border bg-card rounded-[2px]">
        <Label className="font-semibold mb-3 block">Pipeline *</Label>
        <Select
          value={filters.pipeline_id || ''}
          onValueChange={(v) => {
            onFilterChange({
              pipeline_id: v,
              stage_ids: undefined // Reset stages quando muda pipeline
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um pipeline" />
          </SelectTrigger>
          <SelectContent>
            {pipelines?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Etapa - Simples Select */}
      {filters.pipeline_id && (
        <Card className="p-6 border border-border bg-card rounded-[2px]">
          <Label className="font-semibold mb-3 block">Etapa (Opcional)</Label>
          <Select
            value={filters.stage_ids?.[0] || ''}
            onValueChange={(v) => onFilterChange({ stage_ids: v ? [v] : undefined })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Qualquer etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer etapa</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>
      )}

      {/* Score - Matrizes do Sistema */}
      <Card className="p-6 border border-border bg-card rounded-[2px]">
        <Label className="font-semibold mb-4 block">Scores (Opcional)</Label>
        <div className="space-y-3">
          <div>
            <Label className="text-sm text-muted-foreground">Matriz</Label>
            <Select value={filters.score_matrix_id || ''} onValueChange={(v) => onFilterChange({ score_matrix_id: v || undefined })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione matriz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer matriz</SelectItem>
                {/* As matrizes virão de um hook, por enquanto placeholder */}
                <SelectItem value="1">Matriz 1</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm text-muted-foreground">Framing</Label>
            <Select value={filters.score_framing_id || ''} onValueChange={(v) => onFilterChange({ score_framing_id: v || undefined })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione framing" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer framing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm text-muted-foreground">Objetivo</Label>
            <Select value={filters.score_objective_id || ''} onValueChange={(v) => onFilterChange({ score_objective_id: v || undefined })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione objetivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer objetivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Status */}
      <Card className="p-6 border border-border bg-card rounded-[2px]">
        <Label className="font-semibold mb-4 block">Status (Opcional)</Label>
        <div className="space-y-3">
          {leadStatuses.map((status) => (
            <div key={status.value} className="flex items-center gap-3">
              <Checkbox
                id={status.value}
                checked={filters.lead_status?.includes(status.value as any) || false}
                onCheckedChange={(checked) => {
                  const current = filters.lead_status || [];
                  const newStatus = checked
                    ? [...current, status.value as any]
                    : current.filter(s => s !== status.value);
                  onFilterChange({ lead_status: newStatus.length > 0 ? newStatus : undefined });
                }}
              />
              <Label htmlFor={status.value} className="text-sm cursor-pointer">
                {status.label}
              </Label>
            </div>
          ))}
        </div>
      </Card>

      {/* Responsáveis */}
      <Card className="p-6 border border-border bg-card rounded-[2px]">
        <Label className="font-semibold mb-4 block">Responsáveis (Opcional)</Label>
        <div className="space-y-3">
          {usuarios?.map((user) => (
            <div key={user.id} className="flex items-center gap-3">
              <Checkbox
                id={user.id}
                checked={filters.user_id?.includes(user.id) || false}
                onCheckedChange={(checked) => {
                  const current = filters.user_id || [];
                  const newUsers = checked
                    ? [...current, user.id]
                    : current.filter(u => u !== user.id);
                  onFilterChange({ user_id: newUsers.length > 0 ? newUsers : undefined });
                }}
              />
              <Label htmlFor={user.id} className="text-sm cursor-pointer">
                {user.name}
              </Label>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
