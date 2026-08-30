import { useState } from 'react';
import { UserPlus, Users, ChevronDown, ChevronRight, Clock, UserMinus, Plus, UserCheck, Calendar, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUsuariosTimes, useUsuariosDoTenant } from '@/hooks/useTimes';
import { useTimesWithMethods } from '@/hooks/useTimes';
import { useCalendarSyncStatus } from '@/hooks/useCalendarSyncStatus';
import HorariosInlineEditor from './horarios/HorariosInlineEditor';
import { toast } from 'sonner';

interface MembrosTimeSectionProps {
  teamId: string;
  onMembersChange?: () => void;
}

const MembrosTimeSection = ({ teamId, onMembersChange }: MembrosTimeSectionProps) => {
  const { usuariosTimes } = useUsuariosTimes();
  const { usuarios: usuariosDoTenant } = useUsuariosDoTenant();
  const { removerUsuarioDoTime, adicionarUsuarioAoTime } = useTimesWithMethods();
  const { syncStatus } = useCalendarSyncStatus();

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isAddingMembers, setIsAddingMembers] = useState(false);

  const membrosDoTime = usuariosTimes.filter(ut => ut.time_id === teamId);
  const currentMemberIds = membrosDoTime.map(ut => ut.usuario_id);
  const usuariosDisponiveis = usuariosDoTenant.filter(u => !currentMemberIds.includes(u.id));

  const handleToggleExpand = (userId: string) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };

  const handleRemoverUsuario = async (usuarioId: string, nomeUsuario: string) => {
    try {
      await removerUsuarioDoTime.mutateAsync({ userId: usuarioId, teamId });
      onMembersChange?.();
      toast.success(`${nomeUsuario} removido da equipe`);
    } catch (error) {
      console.error('Erro ao remover usuário:', error);
      toast.error('Erro ao remover membro');
    }
  };

  const handleMemberToggle = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleAddMembers = async () => {
    if (selectedMembers.length === 0) return;
    setIsAddingMembers(true);
    try {
      for (const userId of selectedMembers) {
        await adicionarUsuarioAoTime.mutateAsync({ userId, teamId });
      }
      setSelectedMembers([]);
      onMembersChange?.();
      toast.success(`${selectedMembers.length} membro(s) adicionado(s)`);
    } catch (error) {
      console.error('Erro ao adicionar membros:', error);
      toast.error('Erro ao adicionar membros');
    } finally {
      setIsAddingMembers(false);
    }
  };

  return (
    <div className="border border-border rounded-[4px] overflow-hidden">
      {/* Section header */}
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
        <Users className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
        <h2 className="text-[13px] font-medium text-foreground">Membros</h2>
        <span className="text-[11px] text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded-full leading-none">
          {membrosDoTime.length}
        </span>
      </div>

      {/* Members list */}
      {membrosDoTime.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <Users className="h-[30px] w-[30px] mx-auto text-muted-foreground/20 mb-2" strokeWidth={1} />
          <p className="text-[13px] text-muted-foreground/60">Nenhum membro ainda.</p>
          <p className="text-[12px] text-muted-foreground/40 mt-0.5">Adicione membros abaixo.</p>
        </div>
      ) : (
        <div>
          {membrosDoTime.map((ut, index) => {
            const usuario = ut.usuario;
            if (!usuario) return null;
            const isExpanded = expandedUserId === usuario.id;
            const sync = syncStatus[usuario.id] ?? { google: false, microsoft: false };

            return (
              <div key={usuario.id} className={index < membrosDoTime.length - 1 ? 'border-b border-border' : ''}>
                <div className="px-5 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      className="text-muted-foreground/40 hover:text-muted-foreground transition-colors flex-shrink-0"
                      onClick={() => handleToggleExpand(usuario.id)}
                    >
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-normal text-foreground truncate">
                          {usuario.nome || usuario.name}
                        </span>
                        {usuario.super_adm && (
                          <span className="inline-flex items-center text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-500/8 border border-purple-200/30 px-1.5 py-0.5 rounded-full leading-none">
                            Admin
                          </span>
                        )}
                        {usuario.gestor && !usuario.super_adm && (
                          <span className="inline-flex items-center text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/8 border border-blue-200/30 px-1.5 py-0.5 rounded-full leading-none">
                            Gestor
                          </span>
                        )}
                        {sync.google && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 border border-emerald-200/30 px-1.5 py-0.5 rounded-full leading-none">
                            <Calendar className="w-2.5 h-2.5" strokeWidth={1.5} />
                            GCal
                          </span>
                        )}
                        {sync.microsoft && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/8 border border-blue-200/30 px-1.5 py-0.5 rounded-full leading-none">
                            <Video className="w-2.5 h-2.5" strokeWidth={1.5} />
                            Teams
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground/50 mt-0.5 truncate">
                        {usuario.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-[30px] px-2 text-[11px] text-muted-foreground/60 hover:text-foreground gap-1"
                      onClick={() => handleToggleExpand(usuario.id)}
                    >
                      <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Horários
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-[30px] w-[30px] p-0 text-muted-foreground/40 hover:text-destructive"
                      onClick={() => handleRemoverUsuario(usuario.id, usuario.nome || usuario.name)}
                    >
                      <UserMinus className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border bg-muted px-5 py-4">
                    <HorariosInlineEditor userId={usuario.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add members section */}
      {usuariosDisponiveis.length > 0 && (
        <>
          <div className="px-5 py-3.5 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              <span className="text-[13px] font-medium text-foreground">Adicionar Membros</span>
              {selectedMembers.length > 0 && (
                <span className="text-[11px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full leading-none">
                  {selectedMembers.length} selecionado{selectedMembers.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {selectedMembers.length > 0 && (
              <Button
                size="sm"
                onClick={handleAddMembers}
                disabled={isAddingMembers}
                className="h-[30px] gap-1.5 text-[12px]"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                {isAddingMembers ? 'Adicionando...' : `Adicionar ${selectedMembers.length}`}
              </Button>
            )}
          </div>

          <div className="px-5 pb-4">
            <ScrollArea className="h-52">
              <div className="space-y-1 pr-3">
                {usuariosDisponiveis.map((usuario) => {
                  const isSelected = selectedMembers.includes(usuario.id);
                  return (
                    <div
                      key={usuario.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-[4px] cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary/5 border border-primary/20'
                          : 'hover:bg-muted border border-transparent'
                      }`}
                      onClick={() => handleMemberToggle(usuario.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleMemberToggle(usuario.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-normal text-foreground truncate">
                            {usuario.nome || usuario.name}
                          </span>
                          {usuario.super_adm && (
                            <span className="inline-flex items-center text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-500/8 border border-purple-200/30 px-1.5 py-0.5 rounded-full leading-none">
                              Admin
                            </span>
                          )}
                          {usuario.gestor && !usuario.super_adm && (
                            <span className="inline-flex items-center text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/8 border border-blue-200/30 px-1.5 py-0.5 rounded-full leading-none">
                              Gestor
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground/50 truncate">{usuario.email}</p>
                      </div>
                      {isSelected && <UserCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
};

export default MembrosTimeSection;
