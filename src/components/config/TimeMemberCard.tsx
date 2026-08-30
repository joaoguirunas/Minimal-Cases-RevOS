
import { useState } from 'react';
import { Clock, User, Trash2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TimeMemberCardProps {
  usuario: {
    id: string;
    nome: string;
    email: string;
    gestor?: boolean;
    super_adm?: boolean;
  };
  horarios: Array<{
    id: string;
    dia_semana: number;
    hora_inicio: string;
    hora_fim: string;
    ativo: boolean;
  }>;
  onRemover: (usuarioId: string) => void;
  onConfigurarHorarios: (usuario: { id: string; nome: string; email: string }) => void;
}

const DIAS_SEMANA = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'
];

const TimeMemberCard = ({ usuario, horarios, onRemover, onConfigurarHorarios }: TimeMemberCardProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const horariosAtivos = horarios.filter(h => h.ativo);
  const diasComHorario = horariosAtivos.length;

  const getHorariosPorDia = () => {
    const horariosPorDia: { [key: number]: Array<{ hora_inicio: string; hora_fim: string }> } = {};
    
    horariosAtivos.forEach(horario => {
      if (!horariosPorDia[horario.dia_semana]) {
        horariosPorDia[horario.dia_semana] = [];
      }
      horariosPorDia[horario.dia_semana].push({
        hora_inicio: horario.hora_inicio,
        hora_fim: horario.hora_fim
      });
    });

    return horariosPorDia;
  };

  const horariosPorDia = getHorariosPorDia();

  return (
    <>
      <Card className="group transition-all duration-200 border-l-4 border-l-primary/20 hover:border-l-primary">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-medium text-sm truncate">{usuario.nome}</h4>
                {usuario.super_adm && (
                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                    Super Admin
                  </Badge>
                )}
                {usuario.gestor && !usuario.super_adm && (
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                    Gestor
                  </Badge>
                )}
              </div>
              
              <p className="text-xs text-muted-foreground mb-3 truncate">{usuario.email}</p>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {diasComHorario > 0 ? `${diasComHorario} dias configurados` : 'Sem horários definidos'}
                  </span>
                </div>

                {diasComHorario > 0 && (
                  <div className="space-y-1">
                    {Object.entries(horariosPorDia)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .slice(0, 2)
                      .map(([dia, intervalos]) => (
                        <div key={dia} className="text-xs">
                          <span className="font-medium text-muted-foreground">
                            {DIAS_SEMANA[parseInt(dia)]}:
                          </span>
                          <span className="ml-1 text-muted-foreground">
                            {intervalos.map(i => `${i.hora_inicio}-${i.hora_fim}`).join(', ')}
                          </span>
                        </div>
                      ))}
                    {Object.keys(horariosPorDia).length > 2 && (
                      <p className="text-xs text-muted-foreground">
                        +{Object.keys(horariosPorDia).length - 2} dias...
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onConfigurarHorarios(usuario)}
                className="h-8 w-8 p-0"
                title="Configurar horários"
              >
                <Settings className="w-3 h-3" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Remover do time"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro do time</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{usuario.nome}</strong> deste time?
              Os horários configurados também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                onRemover(usuario.id);
                setShowDeleteDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TimeMemberCard;
