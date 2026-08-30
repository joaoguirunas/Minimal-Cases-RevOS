
import { useState } from 'react';
import { Clock, User, Trash2, Settings, Crown, Shield } from 'lucide-react';
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
import CopyableId from '@/components/common/CopyableId';

interface MembroCardProps {
  usuario: {
    id: string;
    nome: string;
    email: string;
    gestor?: boolean;
    super_adm?: boolean;
  };
  horariosCount: number;
  onRemover: (usuarioId: string) => void;
  onConfigurarHorarios: (usuario: { id: string; nome: string; email: string }) => void;
}

const MembroCard = ({ usuario, horariosCount, onRemover, onConfigurarHorarios }: MembroCardProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <>
      <Card className="group transition-all duration-200 border-l-4 border-l-primary/20 hover:border-l-primary">
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header com nome e badges */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-primary font-medium text-sm flex-shrink-0">
                  {usuario.nome?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm truncate">{usuario.nome}</h4>
                    {usuario.super_adm && <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                    {usuario.gestor && !usuario.super_adm && <Shield className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{usuario.email}</p>
                  <div className="mt-2">
                    <CopyableId id={usuario.id} label="ID do Usuário" />
                  </div>
                </div>
              </div>
            </div>

            {/* Informações de horários */}
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground">
                {horariosCount > 0 ? `${horariosCount} horários configurados` : 'Sem horários definidos'}
              </span>
            </div>

            {/* Botões de ação */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onConfigurarHorarios(usuario)}
                className="flex-1 h-8 text-xs gap-1"
              >
                <Clock className="w-3 h-3" />
                Horários
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="h-8 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
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
              Esta ação não pode ser desfeita.
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

export default MembroCard;
