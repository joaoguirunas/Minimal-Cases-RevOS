import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Eye, RefreshCw, Loader2, Plus, Pencil, Send } from 'lucide-react';
import { useWhatsappTemplates, WhatsappTemplate } from '@/hooks/useWhatsappTemplates';
import { useWhatsappChannels } from '@/hooks/useWhatsappChannels';
import StandardPageLoader from '@/components/loading/StandardPageLoader';
import { WhatsappTemplateModal } from './WhatsappTemplateModal';
import { WhatsappTemplateBuilderModal } from './WhatsappTemplateBuilderModal';
import { WhatsappEvolutionTemplateModal } from './WhatsappEvolutionTemplateModal';
import { WhatsappTemplateVariablesModal, getVariablesMappingStatus } from './WhatsappTemplateVariablesModal';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface WhatsappTemplatesConfigProps {
  /** meta = templates oficiais (Cloud API, aprovação/categoria/idioma). evolution = texto livre, sem aprovação. */
  provider?: 'meta' | 'evolution';
}

export const WhatsappTemplatesConfig: React.FC<WhatsappTemplatesConfigProps> = ({ provider = 'meta' }) => {
  const isEvolution = provider === 'evolution';
  const queryClient = useQueryClient();
  const { data: allTemplates, isLoading } = useWhatsappTemplates();
  const templates = React.useMemo(
    () => allTemplates?.filter((t) => (t.provider ?? 'meta') === provider),
    [allTemplates, provider],
  );
  const { data: channels } = useWhatsappChannels();
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsappTemplate | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [variablesTemplate, setVariablesTemplate] = useState<WhatsappTemplate | null>(null);
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('active');

  const defaultChannel = channels?.find(c => c.is_default) ?? channels?.[0];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const zonedDate = toZonedTime(date, 'America/Sao_Paulo');
    return format(zonedDate, "dd/MM/yy HH:mm", { locale: ptBR });
  };

  const handleViewTemplate = (template: WhatsappTemplate) => {
    setSelectedTemplate(template);
    setModalOpen(true);
  };

  const handleEditVariables = (template: WhatsappTemplate) => {
    setVariablesTemplate(template);
    setVariablesOpen(true);
  };

  const handleSync = async () => {
    if (!defaultChannel) {
      toast.warning('Nenhum canal WhatsApp padrão configurado');
      return;
    }
    if (!defaultChannel.waba_id) {
      toast.error('WABA ID não configurado no canal. Configure em Canais & Meta.');
      return;
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-templates-sync', {
        body: { channel_id: defaultChannel.id },
      });

      if (error) {
        // error.context is the raw Response with unconsumed body
        let msg = error.message;
        try {
          const ctx = (error as unknown as { context: Response }).context;
          if (ctx?.json) {
            const body = await ctx.json() as Record<string, unknown>;
            msg = (body?.error as string) || (body?.message as string) || msg;
          }
        } catch { /* ignore */ }
        console.error('[whatsapp-templates-sync] error:', msg, error);
        toast.error(msg);
        return;
      }

      if (data?.error) {
        toast.error(data.error as string);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });

      const { synced, created, updated, deleted: deletedCount } = data as { synced: number; created: number; updated: number; submitted: number; deleted?: number };
      const parts = [`${synced} templates`];
      if (created) parts.push(`${created} novos`);
      if (updated) parts.push(`${updated} atualizados`);
      if (deletedCount) parts.push(`${deletedCount} removidos do Meta`);
      toast.success(`Sincronizado: ${parts.join(', ')}`);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Erro ao sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmitToMeta = async (template: WhatsappTemplate) => {
    if (!defaultChannel) {
      toast.warning('Nenhum canal WhatsApp padrão configurado');
      return;
    }
    if (!defaultChannel.waba_id) {
      toast.error('WABA ID não configurado no canal. Configure em Canais & Meta.');
      return;
    }

    const jd = template.json_data as
      | { category?: string; language?: string; components?: unknown }
      | null;
    const category = jd?.category;
    const language = jd?.language;
    const components = jd?.components;

    if (!category || !language || !Array.isArray(components) || components.length === 0) {
      toast.error('Template incompleto: faltam category, language ou components em json_data.');
      return;
    }

    setSubmittingId(template.id);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-templates-manage', {
        body: {
          action: 'create',
          channel_id: defaultChannel.id,
          name: template.nome,
          category,
          language,
          components,
        },
      });

      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as unknown as { context: Response }).context;
          if (ctx?.json) {
            const body = await ctx.json() as Record<string, unknown>;
            msg = (body?.error as string) || (body?.message as string) || msg;
          }
        } catch { /* ignore */ }
        console.error('[whatsapp-templates-manage] error:', msg, error);
        toast.error(msg);
        return;
      }

      if (data?.error) {
        toast.error(data.error as string);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast.success('Template enviado para aprovação da Meta');
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Erro ao enviar template para Meta');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleToggleSystemEnabled = async (templateId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('whatsapp_templates')
        .update({ system_enabled: !currentValue })
        .eq('id', templateId);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });

      toast.success(
        !currentValue
          ? 'Template habilitado no sistema'
          : 'Template desabilitado no sistema'
      );
    } catch (error) {
      console.error('Erro ao atualizar template:', error);
      toast.error('Erro ao atualizar template');
    }
  };

  // ── Status filter logic ──────────────────────────────────────────────────
  const statusCounts = React.useMemo(() => {
    if (!templates) return { active: 0, pending: 0, rejected: 0, deleted: 0, all: 0 };
    const counts = { active: 0, pending: 0, rejected: 0, deleted: 0, all: 0 };
    for (const t of templates) {
      counts.all++;
      const s = t.status.toLowerCase();
      if (s === 'approved' || s === 'active') counts.active++;
      else if (s === 'pending' || s === 'submitted') counts.pending++;
      else if (s === 'rejected') counts.rejected++;
      else if (s === 'deleted') counts.deleted++;
    }
    return counts;
  }, [templates]);

  const filteredTemplates = React.useMemo(() => {
    if (!templates) return [];
    if (statusFilter === 'all') return templates;
    return templates.filter(t => {
      const s = t.status.toLowerCase();
      switch (statusFilter) {
        case 'active': return s === 'approved' || s === 'active';
        case 'pending': return s === 'pending' || s === 'submitted';
        case 'rejected': return s === 'rejected';
        case 'deleted': return s === 'deleted';
        default: return true;
      }
    });
  }, [templates, statusFilter]);

  const STATUS_FILTERS = [
    { key: 'active', label: 'Ativos', count: statusCounts.active },
    { key: 'pending', label: 'Em análise', count: statusCounts.pending },
    { key: 'rejected', label: 'Rejeitados', count: statusCounts.rejected },
    { key: 'deleted', label: 'Excluídos', count: statusCounts.deleted },
    { key: 'all', label: 'Todos', count: statusCounts.all },
  ] as const;

  if (isLoading) {
    return <StandardPageLoader message="Carregando templates..." />;
  }

  const getCategoryStyle = (category: string | undefined) => {
    switch ((category ?? '').toUpperCase()) {
      case 'UTILITY':       return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'MARKETING':     return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'AUTHENTICATION': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default:              return 'bg-white/10 text-white/40 border-white/10';
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'approved':  return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'inactive':
      case 'rejected':  return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'pending':
      case 'submitted': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'paused':
      case 'disabled':  return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'deleted':   return 'bg-white/5 text-white/20 border-white/10';
      default:          return 'bg-white/5 text-white/30 border-white/10';
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Templates</span>
            {templates && templates.length > 0 && (
              <span className="text-[10px] text-white/20 font-mono">{statusCounts.all} total</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!isEvolution && !defaultChannel?.waba_id) {
                  toast.error('WABA ID não configurado no canal. Configure na aba Canais.');
                  return;
                }
                setBuilderOpen(true);
              }}
              className="h-7 gap-1.5 text-[11px] bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Plus className="h-3 w-3" />
              Novo
            </Button>
            {!isEvolution && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
                className="h-7 gap-1.5 text-[11px] bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
              >
                {syncing
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <RefreshCw className="h-3 w-3" />}
                {syncing ? 'Sincronizando...' : 'Sincronizar'}
              </Button>
            )}
          </div>
        </div>

        {/* Status filters */}
        {templates && templates.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.filter(f => f.count > 0 || f.key === 'active').map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
                  statusFilter === f.key
                    ? "bg-white/15 text-white border-white/20"
                    : "bg-transparent text-white/40 border-white/10 hover:border-white/20 hover:text-white/60"
                )}
              >
                {f.label} <span className="opacity-60">({f.count})</span>
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {!templates || templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <RefreshCw className="h-5 w-5 text-white/20" />
            </div>
            <p className="text-sm font-medium text-white/60 mb-1">Nenhum template encontrado</p>
            <p className="text-xs text-white/30 mb-4 max-w-xs leading-relaxed">
              {isEvolution
                ? 'Crie um template de texto livre — sem aprovação, fica pronto pra usar na hora.'
                : 'Sincronize para importar os templates aprovados da sua conta Meta.'}
            </p>
            {isEvolution ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBuilderOpen(true)}
                className="h-7 gap-1.5 text-[11px] border border-white/10 text-white/60 hover:text-white hover:border-white/20"
              >
                <Plus className="h-3 w-3" />
                Criar template
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
                className="h-7 gap-1.5 text-[11px] border border-white/10 text-white/60 hover:text-white hover:border-white/20"
              >
                <RefreshCw className="h-3 w-3" />
                Sincronizar agora
              </Button>
            )}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-white/10 bg-white/[0.02]">
            <p className="text-xs text-white/30">
              Nenhum template com status "{STATUS_FILTERS.find(f => f.key === statusFilter)?.label}".
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            {/* Table header */}
            <div className={cn(
              "grid gap-0 px-4 py-2 bg-white/[0.03] border-b border-white/10",
              isEvolution ? "grid-cols-[1fr_auto_auto_auto]" : "grid-cols-[1fr_auto_auto_auto_auto_auto]"
            )}>
              <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">Nome</span>
              {!isEvolution && (
                <>
                  <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider px-3">Categoria</span>
                  <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider px-3">Idioma</span>
                </>
              )}
              <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider px-3">Variáveis</span>
              <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider px-3">Status</span>
              <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider px-3 text-center">Ações</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-white/[0.06]">
              {filteredTemplates.map((template) => {
                const isDeleted = template.status.toLowerCase() === 'deleted';
                const isPending = template.status.toLowerCase() === 'pending';
                const isApproved = template.status.toLowerCase() === 'approved';
                const isLocalDraft = isPending && !template.id_template;
                const variablesStatus = getVariablesMappingStatus(template);
                const category = template.json_data?.category;

                return (
                  <div
                    key={template.id}
                    className={cn(
                      "grid gap-0 px-4 py-3 items-center hover:bg-white/[0.03] transition-colors",
                      isEvolution ? "grid-cols-[1fr_auto_auto_auto]" : "grid-cols-[1fr_auto_auto_auto_auto_auto]",
                      isDeleted && "opacity-30"
                    )}
                  >
                    {/* Name + enabled toggle */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Switch
                        checked={template.system_enabled}
                        onCheckedChange={() => handleToggleSystemEnabled(template.id, template.system_enabled)}
                        disabled={!isApproved}
                        className="scale-75 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-white truncate">{template.nome}</p>
                        <p className="text-[10px] text-white/30 font-mono mt-0.5">{formatDate(template.updated_at)}</p>
                      </div>
                    </div>

                    {!isEvolution && (
                      <>
                        {/* Category */}
                        <div className="px-3">
                          {category ? (
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border",
                              getCategoryStyle(category)
                            )}>
                              {category}
                            </span>
                          ) : (
                            <span className="text-[11px] text-white/20">—</span>
                          )}
                        </div>

                        {/* Language */}
                        <div className="px-3">
                          {template.json_data?.language ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 border border-white/10 text-white/40">
                              {template.json_data.language}
                            </span>
                          ) : (
                            <span className="text-[11px] text-white/20">—</span>
                          )}
                        </div>
                      </>
                    )}

                    {/* Variables */}
                    <div className="px-3">
                      {variablesStatus === 'none' ? (
                        <span className="text-[11px] text-white/20">—</span>
                      ) : variablesStatus === 'complete' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                          Mapeado
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                          Pendente
                        </span>
                      )}
                    </div>

                    {/* Status */}
                    <div className="px-3">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border",
                          getStatusBadgeStyle(template.status)
                        )}
                        title={isPending ? 'Submetido à Meta — aguardando aprovação (até 24h)' : undefined}
                      >
                        {isPending ? 'Em análise' : template.status}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="px-3 flex items-center justify-end gap-0.5">
                      {isLocalDraft && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSubmitToMeta(template)}
                          disabled={submittingId === template.id}
                          className="h-7 gap-1 text-[11px] px-2 text-white/50 hover:text-white hover:bg-white/10"
                          title="Enviar para aprovação da Meta"
                        >
                          {submittingId === template.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Send className="w-3 h-3" strokeWidth={1.5} />}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditVariables(template)}
                        className="h-7 w-7 p-0 text-white/30 hover:text-white hover:bg-white/10"
                        title="Editar variáveis"
                      >
                        <Pencil className="w-3 h-3" strokeWidth={1.5} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewTemplate(template)}
                        className="h-7 w-7 p-0 text-white/30 hover:text-white hover:bg-white/10"
                        title="Ver template"
                      >
                        <Eye className="w-3 h-3" strokeWidth={1.5} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <WhatsappTemplateModal
        template={selectedTemplate}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />

      <WhatsappTemplateVariablesModal
        template={variablesTemplate}
        open={variablesOpen}
        onOpenChange={setVariablesOpen}
      />

      {isEvolution ? (
        <WhatsappEvolutionTemplateModal
          open={builderOpen}
          onOpenChange={setBuilderOpen}
        />
      ) : (
        defaultChannel?.waba_id && (
          <WhatsappTemplateBuilderModal
            open={builderOpen}
            onOpenChange={setBuilderOpen}
            channelId={defaultChannel.id}
          />
        )
      )}
    </>
  );
};
