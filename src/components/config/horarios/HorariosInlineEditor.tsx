import { useState, useEffect } from 'react';
import { Plus, X, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSchedules, useCreateSchedule, useUpdateSchedule, useDeleteSchedule } from '@/hooks/useSchedules';
import { toast } from 'sonner';

interface HorariosInlineEditorProps {
  userId: string;
}

const DIAS_SEMANA = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

interface Intervalo {
  id?: string;
  start_time: string;
  end_time: string;
}

const HorariosInlineEditor = ({ userId }: HorariosInlineEditorProps) => {
  const { data: schedules, isLoading, refetch } = useSchedules(userId);
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();
  
  const [intervalos, setIntervalos] = useState<Record<number, Intervalo[]>>({});
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1); // Segunda-feira por padrão

  useEffect(() => {
    if (schedules) {
      const grouped: Record<number, Intervalo[]> = {};
      schedules.forEach(schedule => {
        if (!grouped[schedule.day_of_week]) {
          grouped[schedule.day_of_week] = [];
        }
        grouped[schedule.day_of_week].push({
          id: schedule.id,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
        });
      });
      setIntervalos(grouped);
    }
  }, [schedules]);

  const handleAddIntervalo = (dia: number) => {
    setIntervalos(prev => ({
      ...prev,
      [dia]: [...(prev[dia] || []), { start_time: '09:00', end_time: '18:00' }]
    }));
  };

  const handleRemoveIntervalo = async (dia: number, index: number) => {
    const intervalo = intervalos[dia]?.[index];
    if (intervalo?.id) {
      setSaving(true);
      try {
        await deleteSchedule.mutateAsync(intervalo.id);
        await refetch();
        toast.success('Horário removido com sucesso!');
      } catch (error) {
        toast.error('Erro ao remover horário');
      } finally {
        setSaving(false);
      }
    } else {
      setIntervalos(prev => ({
        ...prev,
        [dia]: prev[dia].filter((_, i) => i !== index)
      }));
    }
  };

  const handleUpdateIntervalo = (dia: number, index: number, field: 'start_time' | 'end_time', value: string) => {
    setIntervalos(prev => {
      const updated = [...(prev[dia] || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, [dia]: updated };
    });
  };

  const handleSaveIntervalo = async (dia: number, index: number) => {
    const intervalo = intervalos[dia]?.[index];
    if (!intervalo) return;

    if (intervalo.start_time >= intervalo.end_time) {
      toast.error('Hora de início deve ser menor que hora de fim');
      return;
    }

    setSaving(true);
    try {
      if (intervalo.id) {
        // Atualizar existente
        await updateSchedule.mutateAsync({
          id: intervalo.id,
          start_time: intervalo.start_time,
          end_time: intervalo.end_time,
        });
      } else {
        // Criar novo
        await createSchedule.mutateAsync({
          user_id: userId,
          day_of_week: dia,
          start_time: intervalo.start_time,
          end_time: intervalo.end_time,
          is_available: true,
        });
      }
      await refetch();
      toast.success('Horário salvo!');
    } catch (error) {
      toast.error('Erro ao salvar horário');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={selectedDay.toString()} onValueChange={(v) => setSelectedDay(Number(v))}>
        <TabsList className="grid grid-cols-7 w-full">
          {DIAS_SEMANA.map((dia) => (
            <TabsTrigger key={dia.value} value={dia.value.toString()} className="text-xs">
              {dia.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {DIAS_SEMANA.map((dia) => (
          <TabsContent key={dia.value} value={dia.value.toString()} className="space-y-2 mt-4">
            {intervalos[dia.value]?.length > 0 ? (
              intervalos[dia.value].map((intervalo, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-background rounded border">
                  <Input
                    type="time"
                    value={intervalo.start_time}
                    onChange={(e) => handleUpdateIntervalo(dia.value, index, 'start_time', e.target.value)}
                    className="w-28"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="time"
                    value={intervalo.end_time}
                    onChange={(e) => handleUpdateIntervalo(dia.value, index, 'end_time', e.target.value)}
                    className="w-28"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSaveIntervalo(dia.value, index)}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveIntervalo(dia.value, index)}
                    disabled={saving}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Nenhum horário configurado para {dia.label.toLowerCase()}
              </div>
            )}
            
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => handleAddIntervalo(dia.value)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar horário
            </Button>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default HorariosInlineEditor;
