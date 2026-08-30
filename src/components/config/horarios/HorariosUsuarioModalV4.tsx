
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Save, X, User, Calendar, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useHorarios, useCriarHorario, useDeleteHorario } from "@/hooks/useHorarios";
import { toast } from "sonner";
import HorariosDiaCard from "./HorariosDiaCard";

interface HorariosUsuarioModalV4Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuario: {
    id: string;
    nome: string;
    email: string;
  } | null;
}

interface IntervaloHorario {
  id?: string;
  horaInicio: string;
  horaFim: string;
}

const diasSemana = [
  { id: 1, nome: "Segunda-feira", short: "SEG" },
  { id: 2, nome: "Terça-feira", short: "TER" },
  { id: 3, nome: "Quarta-feira", short: "QUA" },
  { id: 4, nome: "Quinta-feira", short: "QUI" },
  { id: 5, nome: "Sexta-feira", short: "SEX" },
  { id: 6, nome: "Sábado", short: "SAB" },
  { id: 0, nome: "Domingo", short: "DOM" },
];

const HorariosUsuarioModalV4 = ({ open, onOpenChange, usuario }: HorariosUsuarioModalV4Props) => {
  const [horariosPorDia, setHorariosPorDia] = useState<Record<number, IntervaloHorario[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const { data: horariosExistentes = [], refetch } = useHorarios(usuario?.id);
  const criarHorario = useCriarHorario();
  const deleteHorario = useDeleteHorario();

  // Inicializar horários por dia
  useEffect(() => {
    if (open && usuario) {
      const novoHorariosPorDia: Record<number, IntervaloHorario[]> = {};
      
      // Inicializar todos os dias com array vazio
      diasSemana.forEach(dia => {
        novoHorariosPorDia[dia.id] = [];
      });
      
      // Carregar horários existentes
      horariosExistentes
        .filter(h => h.user_id === usuario.id && h.is_available)
        .forEach(h => {
          if (!novoHorariosPorDia[h.day_of_week]) {
            novoHorariosPorDia[h.day_of_week] = [];
          }
          novoHorariosPorDia[h.day_of_week].push({
            id: h.id,
            horaInicio: h.start_time,
            horaFim: h.end_time
          });
        });
      
      setHorariosPorDia(novoHorariosPorDia);
      setErrors([]);
    }
  }, [open, usuario, horariosExistentes]);

  const handleIntervaloUpdate = (diaSemana: number, index: number, field: 'horaInicio' | 'horaFim', value: string) => {
    setHorariosPorDia(prev => ({
      ...prev,
      [diaSemana]: prev[diaSemana].map((intervalo, i) => 
        i === index ? { ...intervalo, [field]: value } : intervalo
      )
    }));
  };

  const handleIntervaloRemove = (diaSemana: number, index: number) => {
    setHorariosPorDia(prev => ({
      ...prev,
      [diaSemana]: prev[diaSemana].filter((_, i) => i !== index)
    }));
  };

  const handleIntervaloAdd = (diaSemana: number) => {
    const ultimoHorario = horariosPorDia[diaSemana]?.[horariosPorDia[diaSemana].length - 1];
    const horaInicio = ultimoHorario ? 
      String(parseInt(ultimoHorario.horaFim.split(':')[0]) + 1).padStart(2, '0') + ':00' : 
      '09:00';
    
    setHorariosPorDia(prev => ({
      ...prev,
      [diaSemana]: [
        ...(prev[diaSemana] || []),
        { horaInicio, horaFim: '18:00' }
      ]
    }));
  };

  const validarHorarios = (): boolean => {
    const novosErros: string[] = [];
    let totalHorarios = 0;

    Object.entries(horariosPorDia).forEach(([dia, intervalos]) => {
      const nomeDia = diasSemana.find(d => d.id === parseInt(dia))?.nome || 'Desconhecido';
      
      intervalos.forEach((intervalo, index) => {
        totalHorarios++;
        
        if (!intervalo.horaInicio || !intervalo.horaFim) {
          novosErros.push(`${nomeDia} - Horário ${index + 1}: Preencha início e fim`);
          return;
        }

        const [hInicio, mInicio] = intervalo.horaInicio.split(':').map(Number);
        const [hFim, mFim] = intervalo.horaFim.split(':').map(Number);
        const inicioMinutos = hInicio * 60 + mInicio;
        const fimMinutos = hFim * 60 + mFim;

        if (fimMinutos <= inicioMinutos) {
          novosErros.push(`${nomeDia} - Horário ${index + 1}: Fim deve ser posterior ao início`);
        }
      });
    });

    if (totalHorarios === 0) {
      novosErros.push('Configure pelo menos um horário');
    }

    setErrors(novosErros);
    return novosErros.length === 0;
  };

  const handleSubmit = async () => {
    if (!usuario) return;
    
    if (!validarHorarios()) {
      toast.error("Corrija os erros antes de salvar");
      return;
    }

    setIsSubmitting(true);

    try {
      // Deletar todos os horários existentes do usuário
      const horariosParaDeletar = horariosExistentes.filter(h => h.user_id === usuario.id);
      for (const horario of horariosParaDeletar) {
        await deleteHorario.mutateAsync(horario.id);
      }

      // Criar novos horários
      for (const [diaSemana, intervalos] of Object.entries(horariosPorDia)) {
        const dia = parseInt(diaSemana);
        
        for (const intervalo of intervalos) {
          if (intervalo.horaInicio && intervalo.horaFim) {
            await criarHorario.mutateAsync({
              user_id: usuario.id,
              day_of_week: dia,
              start_time: intervalo.horaInicio,
              end_time: intervalo.horaFim,
              is_available: true
            });
          }
        }
      }

      await refetch();
      toast.success('Horários salvos com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar horários:', error);
      toast.error('Erro ao salvar horários');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTotalHorarios = () => {
    return Object.values(horariosPorDia).reduce((total, intervalos) => total + intervalos.length, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-[2px] bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
              <Clock className="w-[30px] h-[30px] text-primary" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold">
                Configurar Horários de Atendimento
              </DialogTitle>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{usuario?.nome}</span>
                  <span className="text-muted-foreground">•</span>
                  <span>{usuario?.email}</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground bg-primary/5 px-2 py-1 rounded-full">
                  <Calendar className="w-4 h-4" />
                  <span className="font-medium">{getTotalHorarios()}</span>
                  <span>{getTotalHorarios() === 1 ? 'horário' : 'horários'}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {errors.length > 0 && (
          <Alert variant="destructive" className="flex-shrink-0">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                {errors.slice(0, 3).map((error, index) => (
                  <div key={index} className="text-sm">{error}</div>
                ))}
                {errors.length > 3 && (
                  <div className="text-sm">... e mais {errors.length - 3} {errors.length - 3 === 1 ? 'erro' : 'erros'}</div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 p-1">
              {diasSemana.map((dia) => (
                <HorariosDiaCard
                  key={dia.id}
                  dia={dia}
                  intervalos={horariosPorDia[dia.id] || []}
                  onIntervaloUpdate={handleIntervaloUpdate}
                  onIntervaloRemove={handleIntervaloRemove}
                  onIntervaloAdd={handleIntervaloAdd}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-3 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            disabled={isSubmitting}
            className="gap-2 px-6"
          >
            <X className="w-4 h-4" />
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || getTotalHorarios() === 0} 
            className="min-w-[180px] gap-2 px-6"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "Salvando..." : "Salvar Horários"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default HorariosUsuarioModalV4;
