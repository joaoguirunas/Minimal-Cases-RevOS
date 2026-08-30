import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock } from "lucide-react";
import HorarioIntervaloInline from "./HorarioIntervaloInline";

interface IntervaloHorario {
  id?: string;
  horaInicio: string;
  horaFim: string;
}

interface HorariosDiaRowProps {
  dia: {
    id: number;
    nome: string;
    short?: string;
  };
  intervalos: IntervaloHorario[];
  onIntervaloUpdate: (diaSemana: number, index: number, field: 'horaInicio' | 'horaFim', value: string) => void;
  onIntervaloRemove: (diaSemana: number, index: number) => void;
  onIntervaloAdd: (diaSemana: number) => void;
}

const HorariosDiaRow = ({
  dia,
  intervalos,
  onIntervaloUpdate,
  onIntervaloRemove,
  onIntervaloAdd
}: HorariosDiaRowProps) => {
  // Função para verificar conflitos entre horários
  const checkConflicts = (intervalos: IntervaloHorario[]) => {
    const conflicts: Record<number, string> = {};
    
    for (let i = 0; i < intervalos.length; i++) {
      const intervalo1 = intervalos[i];
      if (!intervalo1.horaInicio || !intervalo1.horaFim) continue;
      
      const [h1Start, m1Start] = intervalo1.horaInicio.split(':').map(Number);
      const [h1End, m1End] = intervalo1.horaFim.split(':').map(Number);
      const start1 = h1Start * 60 + m1Start;
      const end1 = h1End * 60 + m1End;
      
      for (let j = i + 1; j < intervalos.length; j++) {
        const intervalo2 = intervalos[j];
        if (!intervalo2.horaInicio || !intervalo2.horaFim) continue;
        
        const [h2Start, m2Start] = intervalo2.horaInicio.split(':').map(Number);
        const [h2End, m2End] = intervalo2.horaFim.split(':').map(Number);
        const start2 = h2Start * 60 + m2Start;
        const end2 = h2End * 60 + m2End;
        
        // Verifica sobreposição
        if (start1 < end2 && start2 < end1) {
          const message = `Conflito com horário ${intervalo2.horaInicio} - ${intervalo2.horaFim}`;
          conflicts[i] = message;
          conflicts[j] = `Conflito com horário ${intervalo1.horaInicio} - ${intervalo1.horaFim}`;
        }
      }
    }
    
    return conflicts;
  };

  const conflicts = checkConflicts(intervalos);

  const handleIntervaloUpdate = (index: number, field: 'horaInicio' | 'horaFim', value: string) => {
    onIntervaloUpdate(dia.id, index, field, value);
  };

  const handleIntervaloRemove = (index: number) => {
    onIntervaloRemove(dia.id, index);
  };

  console.log('🔍 HorariosDiaRow render:', { dia: dia.nome, intervalosCount: intervalos.length });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-[2px] flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{dia.nome}</h3>
            <p className="text-sm text-muted-foreground">
              {intervalos.length === 0 ? 'Nenhum horário configurado' : 
               intervalos.length === 1 ? '1 intervalo configurado' :
               `${intervalos.length} intervalos configurados`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {intervalos.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Clock className="w-3 h-3" />
              {intervalos.length}
            </Badge>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🔘 Botão clicado para dia:', dia.id);
              onIntervaloAdd(dia.id);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar Horário
          </Button>
        </div>
      </div>

      <div className="space-y-3 pl-15">
        {intervalos.map((intervalo, index) => {
          console.log('🔍 Renderizando intervalo:', { index, intervalo });
          return (
            <HorarioIntervaloInline
              key={`${dia.id}-${index}`}
              intervalo={intervalo}
              index={index}
              onUpdate={handleIntervaloUpdate}
              onRemove={handleIntervaloRemove}
              hasConflict={!!conflicts[index]}
              conflictMessage={conflicts[index]}
            />
          );
        })}
        {intervalos.length === 0 && (
          <div className="text-sm text-muted-foreground italic">
            Clique em "Adicionar Horário" para configurar este dia
          </div>
        )}
      </div>
    </div>
  );
};

export default HorariosDiaRow;