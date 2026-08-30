import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Clock, Save, Calendar, RotateCcw, User } from "lucide-react";
import { useHorarios, useCriarHorario, useUpdateHorario, useDeleteHorario } from "@/hooks/useHorarios";
import { useUsers } from "@/hooks/useUsersNew";
import HorariosDiaRow from "@/components/config/horarios/HorariosDiaRow";
import { useTranslation } from "@/hooks/useTranslation";

interface IntervaloHorario {
  id?: string;
  horaInicio: string;
  horaFim: string;
}

// Dias da semana em inglês (serão traduzidos dinamicamente)
const diasSemanaKeys = [
  { id: 1, key: "monday", shortKey: "mon" },
  { id: 2, key: "tuesday", shortKey: "tue" },
  { id: 3, key: "wednesday", shortKey: "wed" },
  { id: 4, key: "thursday", shortKey: "thu" },
  { id: 5, key: "friday", shortKey: "fri" },
  { id: 6, key: "saturday", shortKey: "sat" },
  { id: 0, key: "sunday", shortKey: "sun" },
];

const Horarios = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isManager } = useUserPermissions();
  const { data: users = [] } = useUsers();
  
  // Para gestores/admins: permitir selecionar usuário. Para consultores: usar próprio ID
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [horarios, setHorarios] = useState<Record<number, IntervaloHorario[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Traduzir dias da semana dinamicamente
  const diasSemana = diasSemanaKeys.map(dia => ({
    id: dia.id,
    nome: t(`mySchedule.days.${dia.key}`),
    short: t(`mySchedule.daysShort.${dia.shortKey}`)
  }));

  // Inicializar selectedUserId
  useEffect(() => {
    if (!selectedUserId && user?.profile?.id) {
      setSelectedUserId(user.profile.id);
    }
  }, [user?.profile?.id, selectedUserId]);

  const { data: horariosExistentes = [] } = useHorarios(selectedUserId);
  const criarHorario = useCriarHorario();
  const updateHorario = useUpdateHorario();
  const deleteHorario = useDeleteHorario();

  // Filtrar apenas consultores para o seletor (não gestores nem admins)
  const consultores = users.filter(u => 
    !u.gestor && !u.super_adm && (u.active || u.ativo)
  );

  // Calcular estatísticas
  const diasConfigurados = Object.values(horarios).filter(intervalos => intervalos.length > 0).length;
  const totalIntervalos = Object.values(horarios).reduce((acc, intervalos) => acc + intervalos.length, 0);

  // Recarregar horários sempre que o usuário selecionado mudar
  useEffect(() => {
    if (!selectedUserId) return;

    const horariosMap: Record<number, IntervaloHorario[]> = {};

    diasSemana.forEach(dia => {
      const horariosDodia = horariosExistentes.filter(h => h.day_of_week === dia.id && h.is_available);
      horariosMap[dia.id] = horariosDodia.length > 0 
        ? horariosDodia.map(h => ({
            id: h.id,
            horaInicio: h.start_time,
            horaFim: h.end_time
          }))
        : [];
    });

    console.log('📥 Carregando horários do backend para usuário:', selectedUserId);
    setHorarios(horariosMap);
  }, [selectedUserId, horariosExistentes, diasSemana]);

  const adicionarIntervalo = (diaSemana: number) => {
    console.log('📅 Adicionando intervalo para dia:', diaSemana);
    console.log('📅 Horários atuais:', horarios);
    
    setHorarios(prev => {
      const novosHorarios = {
        ...prev,
        [diaSemana]: [
          ...(prev[diaSemana] || []),
          { horaInicio: "09:00", horaFim: "18:00" }
        ]
      };
      console.log('📅 Novos horários:', novosHorarios);
      return novosHorarios;
    });
  };

  const removerIntervalo = (diaSemana: number, index: number) => {
    setHorarios(prev => ({
      ...prev,
      [diaSemana]: prev[diaSemana].filter((_, i) => i !== index)
    }));
  };

  const atualizarIntervalo = (diaSemana: number, index: number, field: 'horaInicio' | 'horaFim', value: string) => {
    setHorarios(prev => ({
      ...prev,
      [diaSemana]: prev[diaSemana].map((intervalo, i) => 
        i === index ? { ...intervalo, [field]: value } : intervalo
      )
    }));
  };

  const resetarHorarios = () => {
    const horariosLimpos: Record<number, IntervaloHorario[]> = {};
    diasSemana.forEach(dia => {
      horariosLimpos[dia.id] = [];
    });
    setHorarios(horariosLimpos);
  };

  const salvarHorarios = async () => {
    if (!selectedUserId) {
      toast.error(t('mySchedule.selectUserError') || "Selecione um usuário");
      return;
    }
    
    setIsSubmitting(true);

    try {
      console.log('🗑️ Deletando horários antigos do usuário:', selectedUserId);
      
      // Deletar todos os horários existentes do usuário selecionado
      const deletePromises = horariosExistentes.map(h => {
        if (h.user_id === selectedUserId) {
          console.log('🗑️ Deletando horário:', h.id);
          return deleteHorario.mutateAsync(h.id);
        }
      });
      await Promise.all(deletePromises.filter(Boolean));
      
      console.log('➕ Criando novos horários...');
      
      // Criar novos horários
      const createPromises = Object.entries(horarios).flatMap(([diaSemana, intervalos]) => {
        const dia = parseInt(diaSemana);
        
        const promises = intervalos.map(intervalo => {
          console.log(`➕ Criando horário: dia ${dia}, ${intervalo.horaInicio} - ${intervalo.horaFim}`);
          return criarHorario.mutateAsync({
            user_id: selectedUserId,
            day_of_week: dia,
            start_time: intervalo.horaInicio,
            end_time: intervalo.horaFim,
            is_available: true
          });
        });
        
        return promises;
      });
      
      await Promise.all(createPromises);
      
      console.log('✅ Horários salvos com sucesso!');
      toast.success(t('mySchedule.saveSuccess') || "Horários salvos com sucesso!");
    } catch (error: any) {
      console.error('❌ Erro ao salvar horários:', error);
      toast.error(t('mySchedule.saveError') || "Erro ao salvar horários");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user?.profile?.id || !selectedUserId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-[4px]">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">{t('mySchedule.title')}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {isManager 
                    ? t('mySchedule.descriptionManager') || "Gerencie os horários de disponibilidade dos consultores"
                    : t('mySchedule.description')
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Dias configurados:</span>
                  <Badge variant="secondary">{diasConfigurados}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Total de intervalos:</span>
                  <Badge variant="secondary">{totalIntervalos}</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Selector for Managers/Admins */}
      {isManager && consultores.length > 0 && (
        <div className="px-6 pt-4 pb-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                {t('mySchedule.selectUser') || "Selecionar Consultor"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedUserId}
                onValueChange={setSelectedUserId}
              >
                <SelectTrigger className="w-full h-[30px] text-xs rounded-[4px]">
                  <SelectValue placeholder={t('mySchedule.selectUserPlaceholder') || "Selecione um consultor"} />
                </SelectTrigger>
                <SelectContent>
                  {consultores.map(consultor => (
                    <SelectItem key={consultor.id} value={consultor.id}>
                      {consultor.name || consultor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={resetarHorarios}
              className="gap-2 h-[30px] rounded-[4px] text-xs"
            >
              <RotateCcw className="w-4 h-4" />
              {t('mySchedule.clearAll')}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={salvarHorarios}
              disabled={isSubmitting}
              className="gap-2 h-[30px] rounded-[4px] text-xs"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? t('common.saving') : t('mySchedule.saveSchedule')}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('mySchedule.weeklyConfig')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {diasSemana.map((dia) => (
                <HorariosDiaRow
                  key={dia.id}
                  dia={dia}
                  intervalos={horarios[dia.id] || []}
                  onIntervaloUpdate={atualizarIntervalo}
                  onIntervaloRemove={removerIntervalo}
                  onIntervaloAdd={adicionarIntervalo}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Horarios;
