import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, UserCircle, Users } from 'lucide-react';
import { useTimesDisponiveis, useUsuariosPorTime, useAtualizarAtribuicao, validateUserInTeam } from '@/hooks/useAtribuicaoNegocio';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AtribuirTimeResponsavelProps {
  negocio: {
    id: string;
    teams_id?: string | null;
    user_id?: string | null;
  };
  compact?: boolean;
}

export const AtribuirTimeResponsavel = ({ negocio, compact = false }: AtribuirTimeResponsavelProps) => {
  const { t } = useTranslation();
  const [selectedTimeId, setSelectedTimeId] = useState<string>(negocio.teams_id || 'none');
  const [selectedUserId, setSelectedUserId] = useState<string>(negocio.user_id || 'none');

  const { data: times = [], isLoading: loadingTimes } = useTimesDisponiveis();
  const { data: usuarios = [], isLoading: loadingUsuarios } = useUsuariosPorTime(selectedTimeId);
  const atualizarAtribuicao = useAtualizarAtribuicao();

  // Sync local state with prop changes
  useEffect(() => {
    setSelectedTimeId(negocio.teams_id || 'none');
    setSelectedUserId(negocio.user_id || 'none');
  }, [negocio.teams_id, negocio.user_id]);

  const handleTimeChange = async (newTimeId: string) => {
    try {
      const actualTimeId = newTimeId === 'none' ? null : newTimeId;
      
      // Check if current responsible is in the new team
      const currentUserId = negocio.user_id;
      let clearResponsible = false;

      if (currentUserId && actualTimeId) {
        const isUserInTeam = await validateUserInTeam(currentUserId, actualTimeId);
        if (!isUserInTeam) {
          clearResponsible = true;
        }
      }

      // Update team and optionally clear responsible
      await atualizarAtribuicao.mutateAsync({
        negocioId: negocio.id,
        timeId: actualTimeId,
        usuarioId: clearResponsible ? null : undefined,
      });

      setSelectedTimeId(newTimeId);
      if (clearResponsible) {
        setSelectedUserId('none');
        toast.info(t('assignment.responsibleCleared'));
      }
      toast.success(t('assignment.teamUpdated'));
    } catch (error) {
      console.error('Error updating team:', error);
      toast.error(t('assignment.errorUpdatingTeam'));
    }
  };

  const handleResponsibleChange = async (newUserId: string) => {
    try {
      const actualUserId = newUserId === 'none' ? null : newUserId;
      
      // Validate that user belongs to the selected team
      if (selectedTimeId && selectedTimeId !== 'none' && actualUserId) {
        const isValid = await validateUserInTeam(actualUserId, selectedTimeId);
        if (!isValid) {
          toast.error(t('assignment.invalidAssignment'));
          return;
        }
      }

      await atualizarAtribuicao.mutateAsync({
        negocioId: negocio.id,
        usuarioId: actualUserId,
      });

      setSelectedUserId(newUserId);
      toast.success(t('assignment.responsibleUpdated'));
    } catch (error) {
      console.error('Error updating responsible:', error);
      toast.error(t('assignment.errorUpdatingResponsible'));
    }
  };

  const content = (
    <div className="space-y-3">
      {/* Team Selector */}
      <div>
        <Label className="text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground mb-2 block flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          {t('assignment.team')}
        </Label>
        <Select
          value={selectedTimeId}
          onValueChange={handleTimeChange}
          disabled={loadingTimes || atualizarAtribuicao.isPending}
        >
          <SelectTrigger className="h-9 rounded-[4px]">
            <SelectValue placeholder={t('assignment.selectTeam')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              {t('assignment.noTeam')}
            </SelectItem>
            {times.map((time) => (
              <SelectItem key={time.id} value={time.id}>
                {time.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Responsible Selector */}
      <div>
        <Label
          className={cn(
            "text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground mb-2 block flex items-center gap-2",
            (selectedTimeId === 'none' || !selectedTimeId) && "opacity-50"
          )}
        >
          <UserCircle className="w-4 h-4" />
          {t('assignment.responsible')}
        </Label>
        <Select
          value={selectedUserId}
          onValueChange={handleResponsibleChange}
          disabled={selectedTimeId === 'none' || !selectedTimeId || loadingUsuarios || atualizarAtribuicao.isPending}
        >
          <SelectTrigger
            className={cn(
              "h-9 rounded-[4px]",
              (selectedTimeId === 'none' || !selectedTimeId) && "opacity-50 cursor-not-allowed"
            )}
          >
            <SelectValue
              placeholder={
                selectedTimeId && selectedTimeId !== 'none'
                  ? t('assignment.selectResponsible')
                  : t('assignment.selectTeamFirst')
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              {t('assignment.noResponsible')}
            </SelectItem>
            {usuarios.map((usuario) => (
              <SelectItem key={usuario.id} value={usuario.id}>
                {usuario.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(selectedTimeId === 'none' || !selectedTimeId) && (
          <p className="text-xs text-muted-foreground mt-1">
            {t('assignment.selectTeamFirstHelp')}
          </p>
        )}
      </div>
    </div>
  );

  if (compact) {
    return content;
  }

  return (
    <Card className="border border-border transition-all duration-300 rounded-[2px] border-l-4 border-l-blue-500">
      <CardHeader className="pb-3 p-6">
        <CardTitle className="text-[18px] font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          {t('assignment.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0">{content}</CardContent>
    </Card>
  );
};
