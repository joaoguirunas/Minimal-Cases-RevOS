
import { useState, useEffect } from 'react';
import { ArrowLeft, Users, Clock, Mail, Shield, Crown, Edit3, Save, X, Trash2, Plus, UserCheck, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useTimesWithMethods, useUsuariosDoTenant, useUsuariosTimes, Time } from '@/hooks/useTimes';
import { useHorarios } from '@/hooks/useHorarios';
import { useTeamPipelines, useSetTeamPipelines, useTeamTags, useSetTeamTags } from '@/hooks/useTeamsNew';
import { useSetUserTeamPriority } from '@/hooks/useUsersTeams';
import { useLeadsPipelines } from '@/hooks/useLeadsPipelines';
import { useLeadTags } from '@/hooks/useLeadTags';
import HorariosUsuarioModalV4 from '@/components/config/horarios/HorariosUsuarioModalV4';
import { toast } from 'sonner';

interface GerenciarMembrosTimeProps {
  time: Time;
  onVoltar: () => void;
}

const GerenciarMembrosTime = ({ time, onVoltar }: GerenciarMembrosTimeProps) => {
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [horariosModalOpen, setHorariosModalOpen] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<{
    id: string;
    nome: string;
    email: string;
  } | null>(null);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [isUpdatingTime, setIsUpdatingTime] = useState(false);
  const [timeData, setTimeData] = useState({
    nome: time.nome,
    tipo: time.tipo,
    prioridade: time.prioridade,
    ativo: time.ativo
  });

  const { adicionarUsuarioAoTime, removerUsuarioDoTime, atualizarTime } = useTimesWithMethods();
  const { usuarios: usuariosDoTenant } = useUsuariosDoTenant();
  const { usuariosTimes, fetchUsuariosTimes } = useUsuariosTimes();
  const { data: todosHorarios = [] } = useHorarios();
  const { data: todosPipelines = [] } = useLeadsPipelines();
  const { data: pipelinesDoTime = [] } = useTeamPipelines(time.id);
  const setTeamPipelines = useSetTeamPipelines();
  const { tags: todasTags = [] } = useLeadTags();
  const { data: tagsDoTime = [] } = useTeamTags(time.id);
  const setTeamTags = useSetTeamTags();
  const setUserTeamPriority = useSetUserTeamPriority();

  const [selectedPipelineIds, setSelectedPipelineIds] = useState<string[]>([]);
  useEffect(() => {
    setSelectedPipelineIds(pipelinesDoTime);
  }, [pipelinesDoTime]);

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  useEffect(() => {
    setSelectedTagIds(tagsDoTime);
  }, [tagsDoTime]);

  const membrosDoTime = usuariosTimes.filter(ut => ut.time_id === time.id);
  const usuariosDisponiveis = usuariosDoTenant.filter(u =>
    !membrosDoTime.some(m => m.usuario_id === u.id)
  );

  const handlePipelineToggle = (pipelineId: string) => {
    setSelectedPipelineIds(prev =>
      prev.includes(pipelineId)
        ? prev.filter(id => id !== pipelineId)
        : [...prev, pipelineId]
    );
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleTogglePrioridade = async (usuarioId: string, prioridadeAtual: boolean) => {
    try {
      await setUserTeamPriority.mutateAsync({ userId: usuarioId, teamId: time.id, isPriority: !prioridadeAtual });
      await fetchUsuariosTimes();
      toast.success(!prioridadeAtual ? 'Membro marcado como prioridade!' : 'Prioridade removida.');
    } catch (error) {
      console.error('Erro ao atualizar prioridade:', error);
      toast.error('Erro ao atualizar prioridade');
    }
  };

  const handleMemberToggle = (usuarioId: string) => {
    setSelectedMembers(prev => 
      prev.includes(usuarioId) 
        ? prev.filter(id => id !== usuarioId)
        : [...prev, usuarioId]
    );
  };

  const handleAdicionarMembros = async () => {
    if (selectedMembers.length === 0) return;

    setIsAddingMembers(true);
    try {
      for (const usuarioId of selectedMembers) {
        await adicionarUsuarioAoTime.mutateAsync({ userId: usuarioId, teamId: time.id });
      }
      setSelectedMembers([]);
      await fetchUsuariosTimes();
      toast.success(`${selectedMembers.length} ${selectedMembers.length === 1 ? 'membro adicionado' : 'membros adicionados'} com sucesso!`);
    } catch (error) {
      console.error('Erro ao adicionar membros:', error);
      toast.error('Erro ao adicionar membros ao time');
    } finally {
      setIsAddingMembers(false);
    }
  };

  const handleRemoverMembro = async (usuarioId: string) => {
    try {
      await removerUsuarioDoTime.mutateAsync({ userId: usuarioId, teamId: time.id });
      await fetchUsuariosTimes();
      toast.success('Membro removido do time com sucesso!');
    } catch (error) {
      console.error('Erro ao remover membro:', error);
      toast.error('Erro ao remover membro do time');
    }
  };

  const handleConfigureSchedule = (usuario: { id: string; nome: string; email: string }) => {
    setUsuarioSelecionado(usuario);
    setHorariosModalOpen(true);
  };

  const handleUpdateTime = async () => {
    if (!timeData.nome.trim() || !timeData.tipo) {
      toast.error("Nome e tipo são obrigatórios");
      return;
    }

    if (timeData.prioridade < 1) {
      toast.error("Prioridade deve ser maior que 0");
      return;
    }

    setIsUpdatingTime(true);
    try {
      await atualizarTime.mutateAsync({
        id: time.id,
        nome: timeData.nome.trim(),
        tipo: timeData.tipo as 'suporte' | 'vendas',
        prioridade: timeData.prioridade
      });
      await setTeamPipelines.mutateAsync({ teamId: time.id, pipelineIds: selectedPipelineIds });
      await setTeamTags.mutateAsync({ teamId: time.id, tagIds: selectedTagIds });

      Object.assign(time, timeData);
      setIsEditingTime(false);
      toast.success('Time atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar time:', error);
      toast.error('Erro ao atualizar time');
    } finally {
      setIsUpdatingTime(false);
    }
  };

  const handleCancelEdit = () => {
    setTimeData({
      nome: time.nome,
      tipo: time.tipo,
      prioridade: time.prioridade,
      ativo: time.ativo
    });
    setIsEditingTime(false);
  };

  const getHorariosDoUsuario = (usuarioId: string) => {
    return todosHorarios.filter(h => h.user_id === usuarioId && h.is_available);
  };

  const getTipoColor = (tipo: Time['tipo']): string => {
    switch (tipo) {
      case 'suporte':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'vendas':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };

  const getTipoLabel = (tipo: Time['tipo']): string => {
    switch (tipo) {
      case 'suporte':
        return 'Suporte';
      case 'vendas':
        return 'Vendas';
      default:
        return 'Desconhecido';
    }
  };

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={onVoltar}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-[4px] bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold">{time.nome}</h1>
                <Badge variant="outline" className={getTipoColor(time.tipo)}>
                  {getTipoLabel(time.tipo)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Gerencie membros e configurações do time
              </p>
            </div>
          </div>
          
          <Button
            variant="outline"
            onClick={() => setIsEditingTime(!isEditingTime)}
            className="gap-2"
          >
            <Edit3 className="w-4 h-4" />
            {isEditingTime ? 'Cancelar' : 'Editar Time'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Configurações do Time */}
          <div className="lg:col-span-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4" />
                  Configurações do Time
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditingTime ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome do Time</Label>
                      <Input
                        id="nome"
                        value={timeData.nome}
                        onChange={(e) => setTimeData({ ...timeData, nome: e.target.value })}
                        disabled={isUpdatingTime}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="prioridade">Prioridade</Label>
                      <Input
                        id="prioridade"
                        type="number"
                        min="1"
                        value={timeData.prioridade}
                        onChange={(e) => setTimeData({ ...timeData, prioridade: parseInt(e.target.value) || 1 })}
                        disabled={isUpdatingTime}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>Tipo do Time</Label>
                      <RadioGroup 
                        value={timeData.tipo} 
                        onValueChange={(value: 'suporte' | 'vendas') => setTimeData({ ...timeData, tipo: value })}
                        disabled={isUpdatingTime}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="suporte" id="suporte" />
                          <Label htmlFor="suporte">Suporte</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="vendas" id="vendas" />
                          <Label htmlFor="vendas">Vendas</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="ativo">Time Ativo</Label>
                      <Switch
                        id="ativo"
                        checked={timeData.ativo}
                        onCheckedChange={(checked) => setTimeData({ ...timeData, ativo: checked })}
                        disabled={isUpdatingTime}
                      />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Pipelines Atendidos</Label>
                      <p className="text-xs text-muted-foreground">
                        Nenhum selecionado = equipe atende todos os pipelines.
                      </p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {todosPipelines.map((pipeline) => (
                          <div
                            key={pipeline.id}
                            className="flex items-center space-x-2 p-1.5 rounded-[2px] hover:bg-muted cursor-pointer"
                            onClick={() => handlePipelineToggle(pipeline.id)}
                          >
                            <Checkbox
                              checked={selectedPipelineIds.includes(pipeline.id)}
                              onCheckedChange={() => handlePipelineToggle(pipeline.id)}
                              disabled={isUpdatingTime}
                            />
                            <span className="text-sm">{pipeline.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Tags Visíveis</Label>
                      <p className="text-xs text-muted-foreground">
                        Nenhuma selecionada = equipe enxerga todas as tags.
                      </p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {todasTags.map((tag) => (
                          <div
                            key={tag.id}
                            className="flex items-center space-x-2 p-1.5 rounded-[2px] hover:bg-muted cursor-pointer"
                            onClick={() => handleTagToggle(tag.id)}
                          >
                            <Checkbox
                              checked={selectedTagIds.includes(tag.id)}
                              onCheckedChange={() => handleTagToggle(tag.id)}
                              disabled={isUpdatingTime}
                            />
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="text-sm">{tag.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={isUpdatingTime}
                        size="sm"
                        className="flex-1"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleUpdateTime}
                        disabled={isUpdatingTime}
                        size="sm"
                        className="flex-1"
                      >
                        <Save className="w-4 h-4 mr-1" />
                        Salvar
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">TIPO</Label>
                      <p className="font-medium">{getTipoLabel(time.tipo)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">PRIORIDADE</Label>
                      <p className="font-medium">#{time.prioridade}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">STATUS</Label>
                      <p className="font-medium">{time.ativo ? 'Ativo' : 'Inativo'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">MEMBROS</Label>
                      <p className="font-medium">{membrosDoTime.length}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">PIPELINES ATENDIDOS</Label>
                      {pipelinesDoTime.length === 0 ? (
                        <p className="font-medium">Todos os pipelines</p>
                      ) : (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {todosPipelines
                            .filter((p) => pipelinesDoTime.includes(p.id))
                            .map((p) => (
                              <Badge key={p.id} variant="outline" className="text-xs">{p.name}</Badge>
                            ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">TAGS VISÍVEIS</Label>
                      {tagsDoTime.length === 0 ? (
                        <p className="font-medium">Todas as tags</p>
                      ) : (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {todasTags
                            .filter((t) => tagsDoTime.includes(t.id))
                            .map((t) => (
                              <Badge key={t.id} variant="outline" className="text-xs gap-1">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                                {t.name}
                              </Badge>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Membros e Adicionar */}
          <div className="lg:col-span-8 space-y-6">
            {/* Membros Atuais */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Membros da Equipe
                  </div>
                  <Badge variant="secondary">
                    {membrosDoTime.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {membrosDoTime.length > 0 ? (
                  <div className="space-y-3">
                    {membrosDoTime.map((membro) => {
                      const horarios = getHorariosDoUsuario(membro.usuario_id);
                      const usuario = membro.usuario;
                      if (!usuario) return null;
                      
                      return (
                        <div
                          key={membro.usuario_id}
                          className="flex items-center justify-between p-3 rounded-[2px] border hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                              {usuario.nome?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">
                                  {usuario.nome || 'Nome não encontrado'}
                                </p>
                                {usuario.super_adm && (
                                  <Crown className="w-3 h-3 text-amber-500" />
                                )}
                                {usuario.gestor && !usuario.super_adm && (
                                  <Shield className="w-3 h-3 text-blue-500" />
                                )}
                                {membro.is_priority && (
                                  <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-200 bg-amber-50">
                                    <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                    Prioridade
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="truncate">{usuario.email || 'Email não encontrado'}</span>
                                <span>•</span>
                                <span>{horarios.length} horários</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTogglePrioridade(membro.usuario_id, !!membro.is_priority)}
                              title={membro.is_priority ? 'Remover prioridade' : 'Marcar como prioridade'}
                              className={membro.is_priority ? 'gap-1 text-amber-600 hover:bg-amber-50' : 'gap-1 text-muted-foreground hover:bg-muted'}
                            >
                              <Star className={membro.is_priority ? 'w-3 h-3 fill-amber-500' : 'w-3 h-3'} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleConfigureSchedule({
                                id: membro.usuario_id,
                                nome: usuario.nome || 'Nome não encontrado',
                                email: usuario.email || 'Email não encontrado'
                              })}
                              className="gap-1 text-primary hover:bg-primary/10"
                            >
                              <Clock className="w-3 h-3" />
                              Horários
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoverMembro(membro.usuario_id)}
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum membro no time</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Adicionar Membros */}
            {usuariosDisponiveis.length > 0 && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      Adicionar Membros
                    </div>
                    {selectedMembers.length > 0 && (
                      <Badge variant="secondary">
                        {selectedMembers.length} selecionado{selectedMembers.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <ScrollArea className="max-h-80">
                    <div className="space-y-2 pr-4">
                      {usuariosDisponiveis.map((usuario) => (
                        <div
                          key={usuario.id}
                          className={`flex items-center space-x-3 p-3 border rounded-[2px] cursor-pointer transition-all hover:bg-muted ${
                            selectedMembers.includes(usuario.id)
                              ? 'border-primary bg-primary/5'
                              : 'hover:border-primary/30'
                          }`}
                          onClick={() => handleMemberToggle(usuario.id)}
                        >
                          <Checkbox
                            checked={selectedMembers.includes(usuario.id)}
                            onCheckedChange={() => handleMemberToggle(usuario.id)}
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm truncate">
                                {usuario.nome}
                              </p>
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
                            <p className="text-xs text-muted-foreground truncate">
                              {usuario.email}
                            </p>
                          </div>

                          {selectedMembers.includes(usuario.id) && (
                            <UserCheck className="w-4 h-4 text-primary" />
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {selectedMembers.length > 0 && (
                    <>
                      <Separator />
                      <div className="flex justify-end">
                        <Button
                          onClick={handleAdicionarMembros}
                          disabled={isAddingMembers}
                          className="gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          {isAddingMembers ? 'Adicionando...' : `Adicionar ${selectedMembers.length} ${selectedMembers.length === 1 ? 'Membro' : 'Membros'}`}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <HorariosUsuarioModalV4
        open={horariosModalOpen}
        onOpenChange={setHorariosModalOpen}
        usuario={usuarioSelecionado}
      />
    </>
  );
};

export default GerenciarMembrosTime;
