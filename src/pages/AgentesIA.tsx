import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Bot, Circle, ArrowRight, FlaskConical, Cpu, Mic, MessageCircle, RefreshCw } from 'lucide-react';
import RestrictedRoute from '@/components/auth/RestrictedRoute';
import { useAgentesIA } from '@/hooks/useAgentesIA';
import { usePipelines } from '@/hooks/usePipelines';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NovoAgenteModal } from '@/components/agentes-ia/NovoAgenteModal';
import { CentralDeTestes } from '@/components/agentes-ia/central-testes/CentralDeTestes';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AgentesIAContent = () => {
  const [activeTab, setActiveTab] = useState<'agentes' | 'central-testes'>('agentes');
  const [showModal, setShowModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'text' | 'voice'>('all');
  const { data: agentes, isLoading } = useAgentesIA();
  const { pipelines } = usePipelines();
  const navigate = useNavigate();

  const { data: stages } = useQuery({
    queryKey: ['leads-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads_stages')
        .select('*')
        .order('order_index', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const sortedAgentes = useMemo(() => {
    if (!agentes) return [];
    const filtered = typeFilter === 'all'
      ? agentes
      : agentes.filter(a => (a.agent_type || 'text') === typeFilter);
    return [...filtered].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [agentes, typeFilter]);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs coladas no topo */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 h-[45px] border-b border-border bg-card dark:bg-zinc-950 shrink-0">
          <TabsList className="h-full bg-transparent gap-1">
            <TabsTrigger
              value="agentes"
              className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none text-[13px] text-muted-foreground"
            >
              <Bot className="h-3.5 w-3.5 mr-1.5" />
              Agentes
            </TabsTrigger>
            <TabsTrigger
              value="central-testes"
              className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none text-[13px] text-muted-foreground"
            >
              <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
              Central de Testes
            </TabsTrigger>
          </TabsList>
          {activeTab === 'agentes' && (
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Type filter */}
              <div className="flex items-center rounded-[4px] border border-border overflow-hidden h-[30px]">
                {([
                  { value: 'all', label: 'Todos' },
                  { value: 'text', label: 'Texto', icon: MessageCircle },
                  { value: 'voice', label: 'Voz', icon: Mic },
                ] as const).map(({ value, label, icon: FilterIcon }) => (
                  <Button
                    key={value}
                    variant="ghost"
                    size="sm"
                    onClick={() => setTypeFilter(value)}
                    className={`px-2.5 h-full text-xs rounded-none transition-colors ${
                      typeFilter === value
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {FilterIcon && <FilterIcon className="h-3 w-3" />}
                    {label}
                  </Button>
                ))}
              </div>
              <Button onClick={() => setShowModal(true)} size="sm" className="gap-1.5 h-[30px] rounded-[4px] text-xs">
                <Plus className="h-3.5 w-3.5" />
                Novo Agente
              </Button>
            </div>
          )}
        </div>

        {/* ── Tab: Agentes ── */}
        <TabsContent value="agentes" className="mt-0 flex-1 overflow-auto">
          <div className="p-8 space-y-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 border border-white/[0.06] rounded-[2px]">
                    <Skeleton className="h-8 w-8 rounded-[2px] shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-52" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Table */}
                {sortedAgentes.length > 0 ? (
                  <div className="border border-white/[0.06] rounded-[2px] overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-card hover:bg-card border-border">
                          <TableHead className="text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-white/40 h-10 pl-4">Agente</TableHead>
                          <TableHead className="text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-white/40 h-10">Pipeline → Etapa</TableHead>
                          <TableHead className="text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-white/40 h-10 text-center w-20">Canais</TableHead>
                          <TableHead className="text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-white/40 h-10 text-center w-20">Versão</TableHead>
                          <TableHead className="text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-white/40 h-10 w-32">Atualizado</TableHead>
                          <TableHead className="text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-white/40 h-10 text-center w-24">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedAgentes.map((agente) => {
                          const pipeline = pipelines?.find(p => p.id === agente.pipeline_id);
                          const stage = stages?.find(s => s.id === agente.leads_stages_id);
                          return (
                            <TableRow
                              key={agente.id}
                              className="cursor-pointer hover:bg-white/[0.035] transition-all duration-300 border-white/[0.06]"
                              onClick={() => navigate(`/settings/crm/aiagents/${agente.id}`)}
                            >
                              <TableCell className="pl-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className={`p-1.5 rounded-[2px] shrink-0 ${agente.agent_type === 'voice' ? 'bg-purple-500/10' : 'bg-primary/10'}`}>
                                    {agente.agent_type === 'voice'
                                      ? <Mic className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                      : <Bot className="h-4 w-4 text-primary" />
                                    }
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[13px] font-medium text-foreground leading-tight">{agente.nome}</span>
                                      {agente.agent_type === 'voice' && (
                                        <span className="px-1 py-0 rounded text-[9px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                          Voz
                                        </span>
                                      )}
                                    </div>
                                    {agente.llm_model ? (
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <Cpu className="h-2.5 w-2.5 text-muted-foreground/40" />
                                        <span className="text-[10px] font-mono text-muted-foreground/60">{agente.llm_model}</span>
                                      </div>
                                    ) : agente.descricao ? (
                                      <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{agente.descricao}</div>
                                    ) : null}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-3">
                                {agente.agent_type === 'voice' ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-muted-foreground/60">Telefone</span>
                                    {agente.el_sync_status === 'synced' && (
                                      <span className="flex items-center gap-0.5 text-[10px] text-green-600 dark:text-green-400">
                                        <RefreshCw className="h-2.5 w-2.5" /> Sync
                                      </span>
                                    )}
                                    {agente.el_sync_status === 'error' && (
                                      <span className="text-[10px] text-red-500">Erro sync</span>
                                    )}
                                    {agente.el_sync_status === 'pending' && (
                                      <span className="text-[10px] text-amber-500">Pendente</span>
                                    )}
                                  </div>
                                ) : pipeline ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Badge variant="outline" className="text-[11px] h-5 font-normal border-border">{pipeline.nome}</Badge>
                                    {(() => {
                                      const activeStages = stages?.filter(s => agente.stage_ids?.includes(s.id)) ?? [];
                                      if (activeStages.length === 0 && stage) return (
                                        <>
                                          <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                                          <Badge variant="secondary" className="text-[11px] h-5 font-normal"
                                            style={{ backgroundColor: stage.color ? `${stage.color}20` : undefined, color: stage.color || undefined }}>
                                            {stage.name}
                                          </Badge>
                                        </>
                                      );
                                      if (activeStages.length === 0) return null;
                                      return (
                                        <>
                                          <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                                          {activeStages.slice(0, 2).map(s => (
                                            <Badge key={s.id} variant="secondary" className="text-[11px] h-5 font-normal"
                                              style={{ backgroundColor: s.color ? `${s.color}20` : undefined, color: s.color || undefined }}>
                                              {s.name}
                                            </Badge>
                                          ))}
                                          {activeStages.length > 2 && (
                                            <span className="text-[10px] text-muted-foreground/60">+{activeStages.length - 2}</span>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                ) : (
                                  <span className="text-[12px] text-muted-foreground/40">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center py-3">
                                {agente.agent_type === 'voice' ? (
                                  <span className="text-[11px] text-purple-600 dark:text-purple-400 flex items-center justify-center gap-1">
                                    <Mic className="h-3 w-3" /> Voz
                                  </span>
                                ) : agente.channel_types && agente.channel_types.length > 0 ? (
                                  <span className="text-[11px] text-muted-foreground">{agente.channel_types.length} canal{agente.channel_types.length > 1 ? 'is' : ''}</span>
                                ) : (
                                  <span className="text-[12px] text-muted-foreground/40">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center py-3">
                                <span className="text-[12px] text-muted-foreground">v{agente.versao_atual || 1}</span>
                              </TableCell>
                              <TableCell className="py-3">
                                <span className="text-[12px] text-muted-foreground">
                                  {format(new Date(agente.updated_at), 'dd MMM yyyy', { locale: ptBR })}
                                </span>
                              </TableCell>
                              <TableCell className="text-center py-3">
                                <div className="flex items-center justify-center gap-1.5">
                                  <Circle className={`h-1.5 w-1.5 fill-current shrink-0 ${agente.ativo ? 'text-emerald-500' : 'text-muted-foreground/40'}`} />
                                  <span className={`text-[12px] ${agente.ativo ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {agente.ativo ? 'Ativo' : 'Inativo'}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 border border-white/[0.06] rounded-[2px] bg-card">
                    <div className="w-12 h-12 bg-muted rounded-[2px] flex items-center justify-center mb-4">
                      <Bot className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-[14px] font-semibold text-foreground mb-1">Nenhum agente criado</h3>
                    <p className="text-[13px] text-muted-foreground mb-5 text-center max-w-xs">
                      Crie seu primeiro agente de IA para automatizar processos de qualificação
                    </p>
                    <Button onClick={() => setShowModal(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Criar Primeiro Agente
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* ── Tab: Central de Testes ── */}
        <TabsContent value="central-testes" className="mt-0 flex-1 overflow-hidden">
          <CentralDeTestes />
        </TabsContent>
      </Tabs>

      <NovoAgenteModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={(agentId) => { setShowModal(false); navigate(`/settings/crm/aiagents/${agentId}`); }}
      />
    </div>
  );
};

const AgentesIA = () => (
  <RestrictedRoute moduleKey="crm_pro">
    <AgentesIAContent />
  </RestrictedRoute>
);
export default AgentesIA;
