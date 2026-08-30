import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Plus, Search, Play, Pause, Square, Copy, Trash2, Eye, Users,
  MoreVertical, RotateCcw, Send as SendIcon, CheckCircle2, TrendingUp,
} from 'lucide-react';
import { useSends } from '@/hooks/useSends';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAtualizarSend, useDeletarSend, useDuplicarSend } from '@/hooks/useSendMutations';
import { SendStatus } from '@/types/sends';
import type { Send } from '@/types/sends';
import StandardPageLoader from '@/components/loading/StandardPageLoader';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

// ─── Status display ───────────────────────────────────────────────────────────
const STATUS_MAP: Record<SendStatus, { label: string; color: string }> = {
  draft:     { label: 'Rascunho',     color: 'bg-muted text-muted-foreground border-border' },
  scheduled: { label: 'Agendado',     color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  running:   { label: 'Em andamento', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  paused:    { label: 'Pausado',      color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  completed: { label: 'Concluído',    color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  failed:    { label: 'Falhou',       color: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

const getProgress = (send: Send) => {
  if (!send.total_contacts) return 0;
  return Math.round(((send.sent_count + send.failed_count) / send.total_contacts) * 100);
};

// ─── Compact KPI card ─────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <Card className="flex items-center gap-4 px-5 py-4 border border-border bg-card rounded-[2px]">
      <div className="w-9 h-9 rounded-[4px] bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-[22px] font-semibold leading-none text-foreground">{value.toLocaleString('pt-BR')}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </Card>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Disparos() {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<SendStatus | 'all'>('all');
  const navigate = useNavigate();
  const { isManager, currentUserId } = useUserPermissions();

  const { data: sends, isLoading, isError, error } = useSends({
    search,
    status: statusFilter === 'all' ? undefined : statusFilter,
    createdBy: !isManager && currentUserId ? currentUserId : undefined,
  });

  const { mutate: updateSend, isPending: isUpdating } = useAtualizarSend();
  const { mutate: deletarSend } = useDeletarSend();
  const { mutate: duplicarSend, isPending: isDuplicating } = useDuplicarSend();

  // ── KPI summary ──────────────────────────────────────────────────────────
  const kpis = React.useMemo(() => {
    if (!sends) return { total: 0, running: 0, completed: 0, totalSent: 0 };
    return {
      total:      sends.length,
      running:    sends.filter(s => s.status === 'running').length,
      completed:  sends.filter(s => s.status === 'completed').length,
      totalSent:  sends.reduce((acc, s) => acc + (s.sent_count || 0), 0),
    };
  }, [sends]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleAtivar = (send: Send) => {
    updateSend(
      { id: send.id, data: { status: 'running', started_at: new Date().toISOString() } },
      {
        onSuccess: () => {
          toast.success('Disparo ativado!');
          navigate(`/send/${send.id}`);
        },
      }
    );
  };

  const handlePausar = (send: Send) => {
    updateSend(
      { id: send.id, data: { status: 'paused' } },
      { onSuccess: () => toast.success('Disparo pausado') }
    );
  };

  const handleRetomar = (send: Send) => {
    updateSend(
      { id: send.id, data: { status: 'running' } },
      {
        onSuccess: () => {
          toast.success('Disparo retomado!');
          navigate(`/send/${send.id}`);
        },
      }
    );
  };

  const handleParar = (send: Send) => {
    if (!confirm(`Parar "${send.name}"? A campanha será marcada como concluída.`)) return;
    updateSend(
      { id: send.id, data: { status: 'completed', completed_at: new Date().toISOString() } },
      { onSuccess: () => toast.success('Disparo encerrado') }
    );
  };

  const handleExcluir = (send: Send) => {
    if (!confirm(`Excluir "${send.name}"? Esta ação não pode ser desfeita.`)) return;
    deletarSend(send.id);
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (isLoading) return <StandardPageLoader message="Carregando disparos..." />;
  if (isError) return (
    <div className="max-w-7xl mx-auto p-6">
      <Card className="p-10 text-center border border-destructive/30 bg-card rounded-[2px]">
        <p className="text-sm font-medium text-destructive mb-1">Erro ao carregar disparos</p>
        <p className="text-xs text-muted-foreground font-mono">{(error as Error)?.message}</p>
      </Card>
    </div>
  );

  return (
    <div className="bg-background">
      <div className="max-w-7xl mx-auto p-6 pb-20 space-y-5">

        {/* ── Toolbar ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end">
          <Button size="sm" className="h-[30px] rounded-[4px] text-xs gap-2" onClick={() => navigate('/send/novo')}>
            <Plus className="w-4 h-4" />
            Novo Disparo
          </Button>
        </div>

        {/* ── KPI bar ────────────────────────────────────────────────────── */}
        {!!sends?.length && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Total de campanhas"   value={kpis.total}     icon={SendIcon} />
            <KpiCard label="Em andamento"         value={kpis.running}   icon={TrendingUp} />
            <KpiCard label="Concluídas"           value={kpis.completed} icon={CheckCircle2} />
            <KpiCard label="Mensagens enviadas"   value={kpis.totalSent} icon={Users} />
          </div>
        )}

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <Card className="p-3 border border-border bg-card rounded-[2px]">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as SendStatus | 'all')}>
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="scheduled">Agendado</SelectItem>
                <SelectItem value="running">Em andamento</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {!sends?.length ? (
          <Card className="p-14 text-center border border-border bg-card rounded-[2px]">
            <div className="max-w-xs mx-auto">
              <div className="w-12 h-12 bg-primary/10 rounded-[4px] flex items-center justify-center mx-auto mb-4">
                <SendIcon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold mb-1.5">Nenhum disparo encontrado</h3>
              <p className="text-sm text-muted-foreground mb-5">
                {search || statusFilter !== 'all'
                  ? 'Tente ajustar os filtros de busca'
                  : 'Crie sua primeira campanha multicanal'}
              </p>
              {!search && statusFilter === 'all' && (
                <Button size="sm" className="h-[30px] rounded-[4px] text-xs gap-2" onClick={() => navigate('/send/novo')}>
                  <Plus className="w-4 h-4" />
                  Criar Disparo
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <Card className="border border-border bg-card rounded-[2px] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Campanha</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Progresso</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Resultados</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Canal</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Criado</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground w-[140px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sends.map(send => {
                  const statusInfo = STATUS_MAP[send.status] ?? STATUS_MAP.draft;
                  const progress = getProgress(send);

                  return (
                    <TableRow
                      key={send.id}
                      className="cursor-pointer hover:bg-white/[0.035] group"
                      onClick={() => navigate(`/send/${send.id}`)}
                    >
                      {/* Campanha */}
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm text-foreground">{send.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {send.type === 'imported' ? 'Lista importada' : 'Filtros avançados'}
                          </p>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Badge variant="outline" className={`rounded-[4px] text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </Badge>
                      </TableCell>

                      {/* Progress */}
                      <TableCell>
                        <div className="space-y-1.5 min-w-[110px]">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{progress}%</span>
                            <span>{send.sent_count + send.failed_count}/{send.total_contacts || 0}</span>
                          </div>
                          <Progress value={progress} className="h-1.5" />
                        </div>
                      </TableCell>

                      {/* Results */}
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          <p className="text-green-600 font-medium">
                            ✓ {send.sent_count || 0} enviados
                          </p>
                          {(send.failed_count || 0) > 0 && (
                            <p className="text-red-600 font-medium">
                              ✗ {send.failed_count} falhas
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Channel */}
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs rounded-[4px] font-medium">
                          {send.channel || 'whatsapp'}
                        </Badge>
                      </TableCell>

                      {/* Created */}
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          <p className="font-medium text-foreground">
                            {format(new Date(send.created_at), 'dd/MM/yy', { locale: ptBR })}
                          </p>
                          <p>{format(new Date(send.created_at), 'HH:mm', { locale: ptBR })}</p>
                        </div>
                      </TableCell>

                      {/* ── Actions ── */}
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">

                          {/* Primary action button */}
                          {(send.status === 'draft' || send.status === 'scheduled') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-[30px] rounded-[4px] px-2.5 gap-1.5 text-xs font-medium"
                              disabled={isUpdating}
                              onClick={() => handleAtivar(send)}
                            >
                              <Play className="w-3 h-3 fill-current" />
                              Ativar
                            </Button>
                          )}

                          {send.status === 'running' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-[30px] rounded-[4px] px-2.5 gap-1.5 text-xs font-medium"
                                disabled={isUpdating}
                                onClick={() => handlePausar(send)}
                              >
                                <Pause className="w-3 h-3 fill-current" />
                                Pausar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-[30px] w-[30px] p-0 text-muted-foreground hover:text-red-600"
                                disabled={isUpdating}
                                onClick={() => handleParar(send)}
                                title="Parar disparo"
                              >
                                <Square className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}

                          {send.status === 'paused' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-[30px] rounded-[4px] px-2.5 gap-1.5 text-xs font-medium"
                                disabled={isUpdating}
                                onClick={() => handleRetomar(send)}
                              >
                                <Play className="w-3 h-3 fill-current" />
                                Retomar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-[30px] w-[30px] p-0 text-muted-foreground hover:text-red-600"
                                disabled={isUpdating}
                                onClick={() => handleParar(send)}
                                title="Parar disparo"
                              >
                                <Square className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}

                          {send.status === 'completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-[30px] rounded-[4px] px-2.5 gap-1.5 text-xs font-medium"
                              disabled={isUpdating}
                              onClick={() => updateSend(
                                { id: send.id, data: { status: 'draft', completed_at: null } },
                                { onSuccess: () => toast.success('Disparo reaberto') }
                              )}
                            >
                              <RotateCcw className="w-3 h-3" />
                              Reabrir
                            </Button>
                          )}

                          {/* Overflow menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-[30px] w-[30px] p-0 text-muted-foreground"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => navigate(`/send/${send.id}`)}>
                                <Eye className="w-3.5 h-3.5 mr-2" />
                                Ver detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={isDuplicating}
                                onClick={() => duplicarSend(send.id, {
                                  onSuccess: (copy) => {
                                    toast.success('Campanha duplicada com sucesso');
                                    navigate(`/send/${copy.id}`);
                                  },
                                })}
                              >
                                <Copy className="w-3.5 h-3.5 mr-2" />
                                {isDuplicating ? 'Duplicando...' : 'Duplicar'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleExcluir(send)}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
