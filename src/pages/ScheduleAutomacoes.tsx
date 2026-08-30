import { useState, useMemo } from 'react';
import {
  Zap, Plus, Trash2, Loader2, ArrowRight, ChevronDown,
  CalendarCheck, CalendarX, CalendarClock, UserCheck, UserX, CalendarPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useScheduleAutomations,
  useCreateScheduleAutomation,
  useUpdateScheduleAutomation,
  useDeleteScheduleAutomation,
  type TriggerStatus,
  type ScheduleAutomationUpsert,
} from '@/hooks/useScheduleAutomations';
import { usePipelines, type Pipeline, type Stage } from '@/hooks/usePipelines';

// ── Trigger config ───────────────────────────────────────────────────────────

interface TriggerMeta {
  label: string;
  icon: React.ElementType;
  color: string;
}

const TRIGGER_META: Record<TriggerStatus, TriggerMeta> = {
  criado:      { label: 'Criado',      icon: CalendarPlus,  color: 'text-blue-500' },
  confirmado:  { label: 'Confirmado',  icon: CalendarCheck, color: 'text-emerald-500' },
  cancelado:   { label: 'Cancelado',   icon: CalendarX,     color: 'text-rose-500' },
  reagendado:  { label: 'Reagendado',  icon: CalendarClock, color: 'text-amber-500' },
  realizado:   { label: 'Realizado',   icon: UserCheck,     color: 'text-green-600' },
  no_show:     { label: 'No-Show',     icon: UserX,         color: 'text-red-500' },
};

const TRIGGER_OPTIONS: TriggerStatus[] = ['criado', 'confirmado', 'cancelado', 'reagendado', 'realizado', 'no_show'];

// ── Main component ───────────────────────────────────────────────────────────

export default function ScheduleAutomacoes() {
  const { data: automations = [], isLoading } = useScheduleAutomations();
  const createMutation = useCreateScheduleAutomation();
  const updateMutation = useUpdateScheduleAutomation();
  const deleteMutation = useDeleteScheduleAutomation();
  const { pipelines, stages, isLoading: pipelinesLoading } = usePipelines();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<ScheduleAutomationUpsert>>({
    trigger_status: undefined,
    pipeline_id: undefined,
    target_pipeline_id: undefined,
    target_stage_id: undefined,
    is_active: true,
  });

  // Group automations by pipeline
  const grouped = useMemo(() => {
    const map = new Map<string, typeof automations>();
    for (const a of automations) {
      const existing = map.get(a.pipeline_id) ?? [];
      existing.push(a);
      map.set(a.pipeline_id, existing);
    }
    return map;
  }, [automations]);

  const getPipelineName = (id: string) =>
    pipelines.find(p => p.id === id)?.name ?? 'Pipeline desconhecido';

  const getStageName = (id: string) =>
    stages.find(s => s.id === id)?.name ?? 'Etapa desconhecida';

  const targetStages = useMemo(() => {
    if (!formData.target_pipeline_id) return [];
    return stages.filter(s => s.pipeline_id === formData.target_pipeline_id || s.leads_pipelines_id === formData.target_pipeline_id);
  }, [formData.target_pipeline_id, stages]);

  const canSave =
    formData.trigger_status &&
    formData.pipeline_id &&
    formData.target_pipeline_id &&
    formData.target_stage_id;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      await createMutation.mutateAsync(formData as ScheduleAutomationUpsert);
      toast.success('Automação criada');
      setShowForm(false);
      setFormData({ trigger_status: undefined, pipeline_id: undefined, target_pipeline_id: undefined, target_stage_id: undefined, is_active: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar';
      toast.error(msg);
    }
  };

  const handleToggle = (id: string, current: boolean) => {
    updateMutation.mutate(
      { id, is_active: !current },
      { onError: (e) => toast.error(e.message) },
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm('Remover esta automação?')) return;
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success('Automação removida'),
      onError: (e) => toast.error(e.message),
    });
  };

  const loading = isLoading || pipelinesLoading;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Automações de Agendamento</h2>
          <p className="text-[13px] text-white/55 mt-0.5">
            Mova leads automaticamente quando o status de um agendamento mudar
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm(true)}
          disabled={showForm}
          className="h-[30px] text-xs rounded-[4px] gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova Regra
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* ── New rule form ─────────────────────────────────────── */}
        {showForm && (
          <div className="border border-primary/30 rounded-[2px] bg-card p-4 space-y-4">
            <p className="text-[13px] font-semibold text-foreground">Nova regra de automação</p>

            <div className="grid grid-cols-2 gap-3">
              {/* Trigger status */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground">Quando agendamento for</label>
                <Select
                  value={formData.trigger_status ?? ''}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, trigger_status: v as TriggerStatus }))}
                >
                  <SelectTrigger className="h-[30px] text-[13px]">
                    <SelectValue placeholder="Selecionar status…" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{TRIGGER_META[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Source pipeline */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground">Do pipeline</label>
                <Select
                  value={formData.pipeline_id ?? ''}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, pipeline_id: v }))}
                >
                  <SelectTrigger className="h-[30px] text-[13px]">
                    <SelectValue placeholder="Pipeline de origem…" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target pipeline */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground">Mover para pipeline</label>
                <Select
                  value={formData.target_pipeline_id ?? ''}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, target_pipeline_id: v, target_stage_id: undefined }))}
                >
                  <SelectTrigger className="h-[30px] text-[13px]">
                    <SelectValue placeholder="Pipeline destino…" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target stage */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground">Etapa destino</label>
                <Select
                  value={formData.target_stage_id ?? ''}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, target_stage_id: v }))}
                  disabled={!formData.target_pipeline_id}
                >
                  <SelectTrigger className="h-[30px] text-[13px]">
                    <SelectValue placeholder={formData.target_pipeline_id ? 'Selecionar etapa…' : 'Selecione pipeline primeiro'} />
                  </SelectTrigger>
                  <SelectContent>
                    {targetStages.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowForm(false); setFormData({ trigger_status: undefined, pipeline_id: undefined, target_pipeline_id: undefined, target_stage_id: undefined, is_active: true }); }}
                className="h-[30px] text-xs rounded-[4px]"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!canSave || createMutation.isPending}
                className="h-[30px] text-xs rounded-[4px] gap-1.5"
              >
                {createMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                Salvar Regra
              </Button>
            </div>
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────── */}
        {!loading && automations.length === 0 && !showForm && (
          <div className="border border-dashed border-border rounded-[2px] py-14 flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Zap className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[13px] font-medium text-foreground">Nenhuma automação configurada</p>
              <p className="text-[11px] text-white/40 mt-1 max-w-xs mx-auto leading-relaxed">
                Configure regras para mover leads automaticamente quando agendamentos mudarem de status
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(true)}
              className="h-[30px] text-xs rounded-[4px] gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Criar primeira regra
            </Button>
          </div>
        )}

        {/* ── Rules grouped by pipeline ─────────────────────────── */}
        {!loading && Array.from(grouped.entries()).map(([pipelineId, rules]) => (
          <div key={pipelineId} className="border border-border rounded-[2px] overflow-hidden">
            {/* Pipeline header */}
            <div className="px-4 py-2.5 bg-muted border-b border-border">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
                {getPipelineName(pipelineId)}
              </p>
            </div>

            {/* Rules */}
            <div className="divide-y divide-white/[0.06]">
              {rules.map((rule) => {
                const trigger = TRIGGER_META[rule.trigger_status];
                const TriggerIcon = trigger.icon;
                return (
                  <div
                    key={rule.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 transition-colors',
                      !rule.is_active && 'opacity-50',
                    )}
                  >
                    {/* Toggle */}
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => handleToggle(rule.id, rule.is_active)}
                      className="shrink-0"
                    />

                    {/* Trigger */}
                    <div className="flex items-center gap-1.5 min-w-[120px]">
                      <TriggerIcon className={cn('w-3.5 h-3.5', trigger.color)} strokeWidth={1.5} />
                      <span className="text-[13px] font-medium text-foreground">{trigger.label}</span>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />

                    {/* Target */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-[13px] text-foreground truncate">
                        {getPipelineName(rule.target_pipeline_id)}
                      </span>
                      <ChevronDown className="w-3 h-3 text-muted-foreground/40 -rotate-90 shrink-0" />
                      <span className="text-[13px] text-primary font-medium truncate">
                        {getStageName(rule.target_stage_id)}
                      </span>
                    </div>

                    {/* Delete */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-[30px] w-[30px] rounded-[4px] shrink-0"
                      onClick={() => handleDelete(rule.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" strokeWidth={1.5} />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
