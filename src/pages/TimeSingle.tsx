import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTimesWithMethods, useUsuariosTimes } from '@/hooks/useTimes';
import { useDeleteTeam } from '@/hooks/useTeamsNew';
import { toast } from 'sonner';
import MembrosTimeSection from '@/components/config/MembrosTimeSection';
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

const TimeSingle = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { times, loading, atualizarTime } = useTimesWithMethods();
  const { fetchUsuariosTimes } = useUsuariosTimes();
  const deleteTeam = useDeleteTeam();

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState('vendas');
  const [prioridade, setPrioridade] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const time = times?.find(t => t.id === teamId);

  useEffect(() => {
    if (time) {
      setNome(time.nome || time.name || '');
      setDescricao(time.descricao || time.description || '');
      setTipo(time.tipo || 'vendas');
      setPrioridade(time.prioridade || time.priority || 1);
    }
  }, [time]);

  const tipoLabel = tipo === 'suporte' ? 'Suporte' : 'Vendas';

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error('Nome da equipe é obrigatório');
      return;
    }
    if (prioridade < 1) {
      toast.error('Prioridade deve ser maior que 0');
      return;
    }
    setSaving(true);
    try {
      await atualizarTime.mutateAsync({ id: teamId, nome, descricao, tipo, prioridade: Number(prioridade) });
    } catch (error) {
      console.error('Erro ao salvar equipe:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTeam.mutateAsync(teamId!);
      navigate('/settings/general/times');
    } catch (error) {
      console.error('Erro ao excluir equipe:', error);
    }
  };

  if (loading || !time) {
    return (
      <div className="space-y-5 p-6 max-w-4xl">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="h-7 w-20 bg-muted animate-pulse rounded" />
          <div className="h-5 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-56 bg-muted animate-pulse rounded-[4px]" />
        <div className="h-40 bg-muted animate-pulse rounded-[4px]" />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6 max-w-4xl">
      {/* Header breadcrumb */}
      <div className="flex items-center gap-2 pb-4 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          className="h-[30px] px-2 text-[13px] text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/settings/general/times')}
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
          Equipes
        </Button>
        <span className="text-muted-foreground/40 text-[13px]">/</span>
        <span className="text-[13px] font-medium text-foreground">{nome}</span>
        <span className="text-[11px] text-muted-foreground/50 ml-0.5">· {tipoLabel}</span>
      </div>

      {/* Team info form */}
      <div className="border border-border rounded-[4px] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h2 className="text-[13px] font-medium text-foreground">Informações da Equipe</h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Nome *</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Time Comercial"
                className="h-[30px] text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Prioridade *</Label>
              <Input
                type="number"
                min="1"
                value={prioridade}
                onChange={(e) => setPrioridade(Number(e.target.value))}
                className="h-[30px] text-[13px]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-[30px] text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vendas">Vendas</SelectItem>
                <SelectItem value="suporte">Suporte</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição opcional..."
              rows={2}
              className="text-[13px] resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-[30px] px-2 text-[12px] text-destructive/60 hover:text-destructive hover:bg-destructive/8"
              onClick={() => setShowDeleteAlert(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
              Excluir equipe
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-[30px] gap-1.5 text-[13px]">
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" strokeWidth={1.5} />
              )}
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </div>

      {/* Members */}
      <MembrosTimeSection teamId={teamId!} onMembersChange={fetchUsuariosTimes} />

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Equipe</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TimeSingle;
