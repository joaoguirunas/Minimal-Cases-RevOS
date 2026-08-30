import { useState } from 'react';
import { Plus, Users, ChevronRight, CheckCircle2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTimesWithMethods, useUsuariosTimes, useUsuariosDoTenant, Time } from '@/hooks/useTimes';
import { toast } from 'sonner';
import { useCreateTeam, useTeamPipelines } from '@/hooks/useTeamsNew';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCalendarSyncStatus } from '@/hooks/useCalendarSyncStatus';
import GerenciarMembrosTime from './GerenciarMembrosTime';

/** Badge leve mostrando quantos pipelines a equipe atende (0 = todos). */
function TeamPipelinesBadge({ teamId }: { teamId: string }) {
  const { data: pipelineIds = [] } = useTeamPipelines(teamId);
  if (pipelineIds.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/60">
        <Globe className="h-3 w-3" strokeWidth={1.5} />
        Todos os pipelines
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/60">
      <Globe className="h-3 w-3" strokeWidth={1.5} />
      {pipelineIds.length} {pipelineIds.length === 1 ? 'pipeline' : 'pipelines'}
    </span>
  );
}

const TimesConfigV3 = () => {
  const [selectedTime, setSelectedTime] = useState<Time | null>(null);
  const { times, loading, fetchTimes } = useTimesWithMethods();
  const { usuariosTimes, fetchUsuariosTimes } = useUsuariosTimes();
  const { usuarios: usuariosDoTenant } = useUsuariosDoTenant();
  const createTeam = useCreateTeam();
  const { syncStatus } = useCalendarSyncStatus();

  const [novoTimeModalOpen, setNovoTimeModalOpen] = useState(false);
  const [novoTimeNome, setNovoTimeNome] = useState('');

  const getTipoLabel = (tipo: string): string => {
    switch (tipo) {
      case 'suporte': return 'Suporte';
      case 'vendas': return 'Vendas';
      default: return tipo;
    }
  };

  const getTipoColor = (tipo: string): string => {
    switch (tipo) {
      case 'suporte': return 'text-blue-600 dark:text-blue-400 bg-blue-500/8 border-blue-200/30';
      case 'vendas': return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 border-emerald-200/30';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getUsuariosDoTime = (timeId: string) => {
    return usuariosTimes.filter(ut => ut.time_id === timeId);
  };

  const handleNovoTimeSuccess = async () => {
    if (!novoTimeNome.trim()) { toast.error('Nome obrigatório'); return; }
    try {
      await createTeam.mutateAsync({ nome: novoTimeNome, tipo: 'vendas', prioridade: (times?.length || 0) + 1 });
      await Promise.all([fetchTimes(), fetchUsuariosTimes()]);
      setNovoTimeModalOpen(false);
      setNovoTimeNome('');
      toast.success('Equipe criada com sucesso!');
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  if (selectedTime) {
    return (
      <GerenciarMembrosTime
        time={selectedTime}
        onVoltar={() => setSelectedTime(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h1 className="text-[15px] font-semibold text-foreground">Equipes</h1>
            <p className="text-[13px] text-muted-foreground/70 mt-0.5">A carregar...</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-[4px]" />
          ))}
        </div>
      </div>
    );
  }

  const sortedTimes = [...(times || [])].sort((a, b) =>
    (a.nome || a.name || '').localeCompare(b.nome || b.name || '')
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-[15px] font-semibold text-foreground">Equipes</h1>
          <p className="text-[13px] text-muted-foreground/70 mt-0.5">Gerencie as equipes e os horários dos membros</p>
        </div>
        <Button size="sm" onClick={() => setNovoTimeModalOpen(true)} className="gap-1.5 h-[30px] text-[13px]">
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          Nova Equipe
        </Button>
      </div>

      {/* Empty state */}
      {sortedTimes.length === 0 ? (
        <div className="border border-border rounded-[2px] p-8 text-center">
          <Users className="h-8 w-8 mx-auto text-muted-foreground/25 mb-3" strokeWidth={1} />
          <p className="text-[13px] font-medium text-foreground mb-1">Nenhuma equipe criada</p>
          <p className="text-[13px] text-muted-foreground/60 mb-4">Crie a primeira equipe para organizar os seus membros.</p>
          <Button size="sm" onClick={() => setNovoTimeModalOpen(true)} className="gap-1.5 h-[30px] text-[13px]">
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            Criar Primeira Equipe
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {sortedTimes.map((time) => {
            const membrosDoTime = getUsuariosDoTime(time.id);
            const syncedCount = membrosDoTime.filter(ut => {
              const s = syncStatus[ut.usuario_id];
              return s?.google || s?.microsoft;
            }).length;
            const totalCount = membrosDoTime.length;
            const allSynced = totalCount > 0 && syncedCount === totalCount;

            return (
              <div
                key={time.id}
                className="border border-border bg-card rounded-[4px] p-4 hover:border-border transition-all cursor-pointer"
                onClick={() => setSelectedTime(time)}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-[13px] font-medium text-foreground leading-tight flex-1 mr-2">{time.nome}</h3>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none ${getTipoColor(time.tipo)}`}>
                    {getTipoLabel(time.tipo)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60">
                    <Users className="h-3 w-3" strokeWidth={1.5} />
                    {totalCount} {totalCount === 1 ? 'membro' : 'membros'}
                  </span>
                  {totalCount > 0 && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${allSynced ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/50'}`}>
                      <CheckCircle2 className="h-3 w-3" />
                      {syncedCount}/{totalCount} sinc.
                    </span>
                  )}
                  <TeamPipelinesBadge teamId={time.id} />
                </div>

                {time.descricao && (
                  <p className="text-[11px] text-muted-foreground/50 mt-2 line-clamp-1">{time.descricao}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nova equipe */}
      <Dialog open={novoTimeModalOpen} onOpenChange={setNovoTimeModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Equipe</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={novoTimeNome}
                onChange={e => setNovoTimeNome(e.target.value)}
                placeholder="Ex: Time Comercial"
                onKeyDown={e => e.key === 'Enter' && handleNovoTimeSuccess()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoTimeModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleNovoTimeSuccess}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TimesConfigV3;
