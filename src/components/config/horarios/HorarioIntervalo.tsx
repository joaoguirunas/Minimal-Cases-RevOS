
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface HorarioIntervalo {
  id?: string;
  horaInicio: string;
  horaFim: string;
}

interface HorarioIntervaloProps {
  intervalo: HorarioIntervalo;
  index: number;
  onUpdate: (index: number, field: 'horaInicio' | 'horaFim', value: string) => void;
  onRemove: (index: number) => void;
  hasConflict?: boolean;
  conflictMessage?: string;
}

const HorarioIntervalo = ({
  intervalo,
  index,
  onUpdate,
  onRemove,
  hasConflict,
  conflictMessage
}: HorarioIntervaloProps) => {
  const isValid = () => {
    if (!intervalo.horaInicio || !intervalo.horaFim) return false;
    
    const [hInicio, mInicio] = intervalo.horaInicio.split(':').map(Number);
    const [hFim, mFim] = intervalo.horaFim.split(':').map(Number);
    const inicioMinutos = hInicio * 60 + mInicio;
    const fimMinutos = hFim * 60 + mFim;
    
    return fimMinutos > inicioMinutos;
  };

  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 p-2 border bg-background transition-colors ${
        hasConflict ? 'border-destructive/30 bg-destructive/5' : 
        !isValid() ? 'border-orange-300 bg-orange-50' : 
        'border-border'
      }`}>
        <div className="flex-1 grid grid-cols-2 gap-2">
          <Input
            type="time"
            value={intervalo.horaInicio}
            onChange={(e) => onUpdate(index, 'horaInicio', e.target.value)}
            className="h-7 text-xs border-0 bg-transparent p-1"
          />
          <Input
            type="time"
            value={intervalo.horaFim}
            onChange={(e) => onUpdate(index, 'horaFim', e.target.value)}
            className="h-7 text-xs border-0 bg-transparent p-1"
          />
        </div>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
      
      {hasConflict && conflictMessage && (
        <Alert variant="destructive" className="py-1">
          <AlertTriangle className="h-3 w-3" />
          <AlertDescription className="text-xs">
            {conflictMessage}
          </AlertDescription>
        </Alert>
      )}
      
      {!hasConflict && !isValid() && intervalo.horaInicio && intervalo.horaFim && (
        <Alert variant="destructive" className="py-1">
          <AlertTriangle className="h-3 w-3" />
          <AlertDescription className="text-xs">
            Horário inválido
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default HorarioIntervalo;
