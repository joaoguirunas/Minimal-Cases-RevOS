import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, AlertTriangle, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface HorarioIntervalo {
  id?: string;
  horaInicio: string;
  horaFim: string;
}

interface HorarioIntervaloInlineProps {
  intervalo: HorarioIntervalo;
  index: number;
  onUpdate: (index: number, field: 'horaInicio' | 'horaFim', value: string) => void;
  onRemove: (index: number) => void;
  hasConflict?: boolean;
  conflictMessage?: string;
}

const HorarioIntervaloInline = ({
  intervalo,
  index,
  onUpdate,
  onRemove,
  hasConflict,
  conflictMessage
}: HorarioIntervaloInlineProps) => {
  const isValid = () => {
    if (!intervalo.horaInicio || !intervalo.horaFim) return false;
    
    const [hInicio, mInicio] = intervalo.horaInicio.split(':').map(Number);
    const [hFim, mFim] = intervalo.horaFim.split(':').map(Number);
    const inicioMinutos = hInicio * 60 + mInicio;
    const fimMinutos = hFim * 60 + mFim;
    
    return fimMinutos > inicioMinutos;
  };

  const getDuration = () => {
    if (!isValid()) return null;
    
    const [hInicio, mInicio] = intervalo.horaInicio.split(':').map(Number);
    const [hFim, mFim] = intervalo.horaFim.split(':').map(Number);
    const inicioMinutos = hInicio * 60 + mInicio;
    const fimMinutos = hFim * 60 + mFim;
    const duracao = fimMinutos - inicioMinutos;
    
    const horas = Math.floor(duracao / 60);
    const minutos = duracao % 60;
    
    if (horas === 0) return `${minutos}min`;
    if (minutos === 0) return `${horas}h`;
    return `${horas}h ${minutos}min`;
  };

  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-4 p-4 bg-background border transition-colors ${
        hasConflict ? 'border-destructive/30 bg-destructive/5' : 
        !isValid() ? 'border-orange-300 bg-orange-50' : 
        'border-border hover:border-border-hover'
      }`}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Intervalo {index + 1}</span>
        </div>
        
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Início:</label>
            <Input
              type="time"
              value={intervalo.horaInicio}
              onChange={(e) => onUpdate(index, 'horaInicio', e.target.value)}
              className="w-32"
            />
          </div>
          
          <div className="text-muted-foreground">até</div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Fim:</label>
            <Input
              type="time"
              value={intervalo.horaFim}
              onChange={(e) => onUpdate(index, 'horaFim', e.target.value)}
              className="w-32"
            />
          </div>
          
          {isValid() && getDuration() && (
            <Badge variant="outline" className="gap-1">
              <Clock className="w-3 h-3" />
              {getDuration()}
            </Badge>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      
      {hasConflict && conflictMessage && (
        <Alert variant="destructive" className="ml-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {conflictMessage}
          </AlertDescription>
        </Alert>
      )}
      
      {!hasConflict && !isValid() && intervalo.horaInicio && intervalo.horaFim && (
        <Alert variant="destructive" className="ml-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Horário inválido: o horário de fim deve ser posterior ao horário de início
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default HorarioIntervaloInline;