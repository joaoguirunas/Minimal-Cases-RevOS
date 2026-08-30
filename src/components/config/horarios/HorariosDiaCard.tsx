
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, Clock } from "lucide-react";
import HorarioIntervalo from "./HorarioIntervalo";

interface IntervaloHorario {
  id?: string;
  horaInicio: string;
  horaFim: string;
}

interface HorariosDiaCardProps {
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

const HorariosDiaCard = ({
  dia,
  intervalos,
  onIntervaloUpdate,
  onIntervaloRemove,
  onIntervaloAdd
}: HorariosDiaCardProps) => {
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

  return (
    <Card className="bg-card border">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center justify-between">
          <span>{dia.short || dia.nome}</span>
          {intervalos.length > 0 && (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-1 font-normal">
              {intervalos.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-3">
        {intervalos.length > 0 ? (
          <div className="space-y-2">
            {intervalos.map((intervalo, index) => (
              <HorarioIntervalo
                key={index}
                intervalo={intervalo}
                index={index}
                onUpdate={handleIntervaloUpdate}
                onRemove={handleIntervaloRemove}
                hasConflict={!!conflicts[index]}
                conflictMessage={conflicts[index]}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-xs">Nenhum horário</p>
          </div>
        )}
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onIntervaloAdd(dia.id)}
          className="w-full gap-2 text-xs h-8"
        >
          <Plus className="w-3 h-3" />
          Adicionar
        </Button>
      </CardContent>
    </Card>
  );
};

export default HorariosDiaCard;
