import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Users, 
  Clock, 
  Shield, 
  Crown, 
  UserMinus, 
  Settings,
  Info
} from 'lucide-react';
import { useTimesWithMethods, useUsuariosTimes, useUsuariosDoTenant } from '@/hooks/useTimes';
import { useHorarios } from '@/hooks/useHorarios';
import HorariosUsuarioModalV4 from '@/components/config/horarios/HorariosUsuarioModalV4';
import CopyableId from '@/components/common/CopyableId';
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
import { toast } from 'sonner';

interface VerMaisTimeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  time?: any;
}

const VerMaisTimeModal = ({ open, onOpenChange, time }: VerMaisTimeModalProps) => {
  const { usuariosTimes, fetchUsuariosTimes } = useUsuariosTimes();
  const { removerUsuarioDoTime } = useTimesWithMethods();
  const { usuarios: usuariosDoTenant } = useUsuariosDoTenant();
  const { data: todosHorarios = [] } = useHorarios();
  
  const [horariosModalOpen, setHorariosModalOpen] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [removerUsuarioDialogOpen, setRemoverUsuarioDialogOpen] = useState(false);
  const [usuarioParaRemover, setUsuarioParaRemover] = useState(null);

  if (!time) return null;

  const getTipoLabel = (tipo: string): string => {
    switch (tipo) {
      case 'suporte': return 'Suporte';
      case 'vendas': return 'Vendas';
      default: return 'Desconhecido';
    }
  };

  const getTipoColor = (tipo: string): string => {
    switch (tipo) {
      case 'suporte': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
      case 'vendas': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800';
      default: return 'bg-muted text-muted-foreground border-muted';
    }
  };

  const getUsuariosDoTime = () => {
    return usuariosTimes.filter(ut => ut.time_id === time.id);
  };

  const getHorariosDoUsuario = (usuarioId: string) => {
    return todosHorarios.filter(h => h.user_id === usuarioId && h.is_available);
  };

  const handleConfigurarHorarios = (usuario: any) => {
    setUsuarioSelecionado({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email
    });
    setHorariosModalOpen(true);
  };

  const handleRemoverUsuario = (usuario: any) => {
    setUsuarioParaRemover(usuario);
    setRemoverUsuarioDialogOpen(true);
  };

  const confirmarRemocaoUsuario = async () => {
    if (!usuarioParaRemover) return;
    
    try {
      await removerUsuarioDoTime.mutateAsync({ userId: usuarioParaRemover.id, teamId: time.id });
      await fetchUsuariosTimes();
      toast.success('Usuário removido do time com sucesso!');
    } catch (error) {
      toast.error('Erro ao remover usuário do time');
    } finally {
      setRemoverUsuarioDialogOpen(false);
      setUsuarioParaRemover(null);
    }
  };

  const membros = getUsuariosDoTime();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] rounded-[4px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-[4px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              {time.nome}
            </DialogTitle>
            <DialogDescription>
              Detalhes completos do time e gerenciamento de membros
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6">
              {/* Informações do Time */}
              <Card className="rounded-[4px]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Info className="w-5 h-5" />
                    Informações do Time
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Nome</label>
                      <p className="text-sm">{time.nome}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Tipo</label>
                      <div className="mt-1">
                        <Badge className={`text-xs rounded-[4px] ${getTipoColor(time.tipo)}`}>
                          {getTipoLabel(time.tipo)}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <div className="mt-1">
                        <Badge variant={time.ativo ? "default" : "secondary"} className="text-xs rounded-[4px]">
                          {time.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Prioridade</label>
                      <p className="text-sm">#{time.prioridade}</p>
                    </div>
                  </div>
                  
                  {time.descricao && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Descrição</label>
                      <p className="text-sm mt-1 p-3 bg-muted rounded-[4px]">{time.descricao}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">ID do Time</label>
                    <div className="mt-1">
                      <CopyableId id={time.id} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Lista de Membros */}
              <Card className="rounded-[4px]">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-base">
                      <Users className="w-5 h-5" />
                      Membros do Time
                    </div>
                    <Badge variant="outline" className="rounded-[4px]">
                      {membros.length} {membros.length === 1 ? 'membro' : 'membros'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {membros.length > 0 ? (
                    <div className="space-y-3">
                      {membros.map((membro) => {
                        const usuario = membro.usuario;
                        if (!usuario) return null;
                        
                        const horariosUsuario = getHorariosDoUsuario(membro.usuario_id);
                        
                        return (
                          <div
                            key={membro.usuario_id}
                            className="flex items-center justify-between p-3 border rounded-[4px] hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-primary/10 rounded-[4px] flex items-center justify-center">
                                <Users className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm">{usuario.nome}</p>
                                  {usuario.super_adm && <Crown className="w-3 h-3 text-amber-500" />}
                                  {usuario.gestor && !usuario.super_adm && <Shield className="w-3 h-3 text-blue-500" />}
                                </div>
                                <p className="text-xs text-muted-foreground">{usuario.email}</p>
                                <div className="flex items-center gap-1 mt-1">
                                  <Clock className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">
                                    {horariosUsuario.length} {horariosUsuario.length === 1 ? 'horário' : 'horários'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleConfigurarHorarios(usuario)}
                                className="gap-2 rounded-[4px]"
                              >
                                <Settings className="w-4 h-4" />
                                Horários
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoverUsuario(usuario)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-[4px]"
                              >
                                <UserMinus className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground">
                        Nenhum membro neste time
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Modal de Horários */}
      {usuarioSelecionado && (
        <HorariosUsuarioModalV4
          open={horariosModalOpen}
          onOpenChange={setHorariosModalOpen}
          usuario={usuarioSelecionado}
        />
      )}

      {/* Dialog de Confirmação de Remoção */}
      <AlertDialog open={removerUsuarioDialogOpen} onOpenChange={setRemoverUsuarioDialogOpen}>
        <AlertDialogContent className="rounded-[4px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário do time</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{usuarioParaRemover?.nome}</strong> do time {time.nome}?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[4px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmarRemocaoUsuario}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-[4px]"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default VerMaisTimeModal;