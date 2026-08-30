import { useState, useMemo } from 'react';
import {
  Zap, CheckCircle2, XCircle, Clock, SkipForward, RefreshCw,
  Search, ChevronDown, Instagram, Plus, MoreVertical, Trash2, MessageCircle, MessageSquare,
  Heart, Image, Layers, Pencil,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useInstagramAutomationLog, useInstagramAutomations,
  useDeleteInstagramAutomation, useUpdateInstagramAutomation,
  useInstagramPosts,
  type InstagramAutomation, type InstagramPost,
} from '@/hooks/useInstagramAutomations';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { OmniTabNav } from '@/components/conversas/OmniTabNav';
import OmniNewContactConfig from '@/components/config/OmniNewContactConfig';
import InstagramAutomationsTab from '@/components/config/InstagramAutomationsTab';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  success:  { label: 'Enviado',  icon: CheckCircle2, className: 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20' },
  failed:   { label: 'Falhou',   icon: XCircle,      className: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20' },
  skipped:  { label: 'Ignorado', icon: SkipForward,  className: 'text-muted-foreground bg-card border-border' },
  cooldown: { label: 'Cooldown', icon: Clock,        className: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20' },
};

const TRIGGER_LABELS: Record<string, string> = {
  incoming_dm:   'DM recebido',
  post_comment:  'Comentário',
  story_mention: 'Menção story',
  story_reply:   'Resposta story',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'success',  label: 'Enviado' },
  { value: 'failed',   label: 'Falhou' },
  { value: 'skipped',  label: 'Ignorado' },
  { value: 'cooldown', label: 'Cooldown' },
];

// ── Main component ───────────────────────────────────────────────────────────

export function OmniAutomacoesLogContent() {
  const { isManager, currentUserId } = useUserPermissions();
  const { data: logs = [], isLoading, refetch } = useInstagramAutomationLog(
    undefined,
    200,
    !isManager && currentUserId ? currentUserId : undefined,
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = useMemo(() => {
    let result = logs;
    if (statusFilter) result = result.filter((l) => l.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((l) =>
        (l.person_name ?? '').toLowerCase().includes(q) ||
        (l.automation_name ?? '').toLowerCase().includes(q) ||
        (l.message_text ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, statusFilter, search]);

  const stats = useMemo(() => {
    const s = { success: 0, failed: 0, skipped: 0, cooldown: 0 };
    for (const l of logs) {
      if (l.status in s) s[l.status as keyof typeof s]++;
    }
    return s;
  }, [logs]);

  function formatTs(ts: string) {
    try { return format(new Date(ts), 'dd/MM HH:mm', { locale: ptBR }); }
    catch { return '—'; }
  }

  return (
    <div className="flex flex-col h-full bg-background">

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-7 h-[30px] text-[13px] border-border"
            placeholder="Buscar por pessoa, automação…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn('h-[30px] text-[12px] gap-1.5 rounded-[4px]', statusFilter && 'border-foreground text-foreground')}
            >
              {STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? 'Todos os status'}
              <ChevronDown size={11} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[180px]">
            {STATUS_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={cn('text-[13px]', opt.value === statusFilter && 'font-medium')}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-3 ml-auto text-[11px] text-muted-foreground">
          <span>Enviados: <strong className="text-green-600 dark:text-green-400">{stats.success}</strong></span>
          <span>Falhas: <strong className="text-red-600 dark:text-red-400">{stats.failed}</strong></span>
          <span>Cooldown: <strong className="text-amber-600 dark:text-amber-400">{stats.cooldown}</strong></span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-[30px] w-[30px] p-0 shrink-0 rounded-[4px]"
          onClick={() => refetch()}
          title="Atualizar"
        >
          <RefreshCw size={13} />
        </Button>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[80px_140px_1fr_140px_80px_80px] items-center gap-3 px-4 py-2 border-b border-border bg-card text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest shrink-0">
        <span>Data</span>
        <span>Automação</span>
        <span>Pessoa / Mensagem</span>
        <span>Trigger</span>
        <span>Ação</span>
        <span className="text-center">Status</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-[13px]">
            Carregando…
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Zap size={18} className="opacity-30" />
            </div>
            <p className="text-[13px]">Nenhuma execução registrada</p>
            <p className="text-[11px] text-muted-foreground/50">
              Automações executadas aparecerão aqui em tempo real
            </p>
          </div>
        )}

        {filtered.map((entry) => {
          const sc = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.success;
          const StatusIcon = sc.icon;
          return (
            <div
              key={entry.id}
              className="grid grid-cols-[80px_140px_1fr_140px_80px_80px] items-center gap-3 px-4 py-2.5 border-b border-border text-[13px]"
            >
              <span className="text-muted-foreground text-[12px] tabular-nums whitespace-nowrap">
                {formatTs(entry.executed_at)}
              </span>
              <span className="truncate font-medium text-foreground text-[12px]">
                {entry.automation_name ?? '—'}
              </span>
              <div className="min-w-0">
                <span className="truncate block text-foreground text-[13px]">
                  {entry.person_name ?? 'Usuário Instagram'}
                </span>
                {entry.message_text && (
                  <span className="truncate block text-[11px] text-muted-foreground/60 mt-0.5">
                    "{entry.message_text.length > 60 ? entry.message_text.slice(0, 60) + '…' : entry.message_text}"
                  </span>
                )}
                {entry.error_message && (
                  <span className="truncate block text-[11px] text-red-500 mt-0.5">
                    {entry.error_message}
                  </span>
                )}
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Instagram size={10} className="text-purple-500" />
                {TRIGGER_LABELS[entry.trigger_type ?? ''] ?? entry.trigger_type ?? '—'}
              </span>
              <span className="text-[11px] text-muted-foreground truncate">
                {entry.action_executed ?? '—'}
              </span>
              <div className="flex justify-center">
                <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 gap-0.5', sc.className)}>
                  <StatusIcon size={9} />
                  {sc.label}
                </Badge>
              </div>
            </div>
          );
        })}

        {!isLoading && filtered.length > 0 && (
          <div className="flex items-center justify-center py-4 text-muted-foreground text-[11px]">
            {filtered.length} execuç{filtered.length !== 1 ? 'ões' : 'ão'} carregada{filtered.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

// ── New OmniAutomacoes page ───────────────────────────────────────────────────

const HUB_TABS = ['Automações', 'Primeiro Contato'] as const;

export default function OmniAutomacoes() {
  const [tab, setTab] = useState(0);

  return (
    <div className="flex flex-col h-full bg-background">
      <OmniTabNav />

      <div className="flex border-b border-border px-4 gap-0 shrink-0">
        {HUB_TABS.map((label, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            className={cn(
              'px-4 h-[38px] text-[13px] border-b-2 transition-colors',
              tab === i
                ? 'border-foreground text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 0 ? (
          <AutomacoesHub />
        ) : (
          <div className="p-6 max-w-3xl">
            <OmniNewContactConfig />
          </div>
        )}
      </div>
    </div>
  );
}

// ── AutomacoesHub — rich card list ────────────────────────────────────────────

const TRIGGER_ICONS: Record<string, { label: string; icon: React.ReactNode }> = {
  incoming_dm:    { label: 'DM recebido',       icon: <MessageCircle className="w-3 h-3" /> },
  post_comment:   { label: 'Comentário em post', icon: <MessageSquare className="w-3 h-3" /> },
  story_mention:  { label: 'Menção em story',    icon: <Heart className="w-3 h-3" /> },
  story_reply:    { label: 'Resposta a story',   icon: <Zap className="w-3 h-3" /> },
};

const ACTION_LABELS: Record<string, string> = {
  send_dm:       'DM',
  reply_comment: 'Comentário',
  reply_and_dm:  'Comentário + DM',
};

function getFilterSummary(filters: InstagramAutomation['filters'], operator: string): string {
  if (!filters?.length) return '';
  const sep = operator === 'any' ? ' OU ' : ' E ';
  return filters.map(f => {
    if (f.type === 'always') return 'Sempre';
    if (f.type === 'is_first_contact') return '1º contato';
    if (f.type === 'message_contains') return `"${f.value ?? ''}"`;
    if (f.type === 'message_not_contains') return `Não "${f.value ?? ''}"`;
    return '';
  }).filter(Boolean).join(sep);
}

const TRIGGER_GRADIENTS: Record<string, string> = {
  incoming_dm:    'from-violet-500/20 via-purple-500/10 to-fuchsia-500/5',
  post_comment:   'from-pink-500/20 via-rose-500/10 to-orange-500/5',
  story_mention:  'from-amber-500/20 via-yellow-500/10 to-orange-400/5',
  story_reply:    'from-sky-500/20 via-blue-500/10 to-cyan-500/5',
};

const TRIGGER_ICON_BIG: Record<string, React.ElementType> = {
  incoming_dm:    MessageCircle,
  post_comment:   MessageSquare,
  story_mention:  Heart,
  story_reply:    Zap,
};

function usePostsMap() {
  const { data: posts = [] } = useInstagramPosts(true);
  return useMemo(() => {
    const m: Record<string, InstagramPost> = {};
    for (const p of posts) m[p.id] = p;
    return m;
  }, [posts]);
}

function CardCover({
  automation,
  postsMap,
}: {
  automation: InstagramAutomation;
  postsMap: Record<string, InstagramPost>;
}) {
  const post  = automation.target_post_id ? postsMap[automation.target_post_id] : null;
  const thumb = post ? (post.thumbnail_url ?? post.media_url) : null;
  const IconEl = TRIGGER_ICON_BIG[automation.trigger_type] ?? Zap;
  const grad   = TRIGGER_GRADIENTS[automation.trigger_type] ?? 'from-zinc-500/20 to-zinc-400/5';

  const isReel     = post?.media_product_type === 'REELS';
  const isCarousel = post?.media_type === 'CAROUSEL_ALBUM';

  return (
    <div className="relative w-full aspect-[4/3] overflow-hidden bg-muted">
      {thumb ? (
        <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className={cn('w-full h-full flex items-center justify-center bg-gradient-to-br', grad)}>
          <IconEl className="w-10 h-10 text-foreground/10" strokeWidth={1} />
        </div>
      )}
      {/* Bottom gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
      {/* Media type badge — bottom left */}
      {post && (isReel || isCarousel) && (
        <div className="absolute bottom-2 left-2">
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-[3px] bg-black/60 text-white/90 backdrop-blur-sm uppercase tracking-wide">
            {isReel ? (
              <><Image className="w-2.5 h-2.5" />Reels</>
            ) : (
              <><Layers className="w-2.5 h-2.5" />Carrossel</>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

function AutomationCard({
  automation,
  stats,
  postsMap,
  onEdit,
  onDelete,
  onToggle,
}: {
  automation: InstagramAutomation;
  stats: { total: number; success: number; failed: number };
  postsMap: Record<string, InstagramPost>;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const trigger      = TRIGGER_ICONS[automation.trigger_type] ?? { label: automation.trigger_type, icon: <Zap className="w-3 h-3" /> };
  const filterSummary = getFilterSummary(automation.filters, automation.filter_operator);
  const actionLabel  = ACTION_LABELS[automation.action_type] ?? automation.action_type;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={e => e.key === 'Enter' && onEdit()}
      className={cn(
        'group bg-card border border-border rounded-[6px] overflow-hidden flex flex-col',
        'cursor-pointer transition-all duration-150 hover:border-primary/40 hover:shadow-sm',
        !automation.is_active && 'opacity-55',
      )}
    >
      {/* Cover */}
      <div className="relative">
        <CardCover automation={automation} postsMap={postsMap} />
        {/* Menu — top right on hover */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-[4px] bg-black/50 hover:bg-black/70 text-white border-0"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px]">
              <DropdownMenuItem onClick={onEdit} className="text-[13px]">
                <Pencil className="w-3.5 h-3.5 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-[13px] text-destructive focus:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        {/* Name + toggle */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-1 flex-1 min-w-0">
            {automation.name}
          </p>
          <div onClick={e => e.stopPropagation()} className="shrink-0">
            <Switch
              checked={automation.is_active}
              onCheckedChange={onToggle}
              className="data-[state=checked]:bg-orange-500"
            />
          </div>
        </div>

        {/* Status badge */}
        <div>
          <span className={cn(
            'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-[3px] border',
            automation.is_active
              ? 'bg-orange-500/10 text-orange-500 border-orange-500/20 dark:text-orange-400'
              : 'bg-muted text-muted-foreground border-border',
          )}>
            <span className={cn('w-1 h-1 rounded-full', automation.is_active ? 'bg-orange-500' : 'bg-muted-foreground/40')} />
            {automation.is_active ? 'Ativo' : 'Inativo'}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            {trigger.icon}
            <span className="text-foreground/70">{trigger.label}</span>
          </div>
          {filterSummary && (
            <p className="line-clamp-1 text-foreground/60">{filterSummary}</p>
          )}
          <div className="flex items-center gap-1 text-foreground/70">
            <MessageCircle className="w-3 h-3 shrink-0" />
            <span>{actionLabel}</span>
          </div>
        </div>

        {/* Stats footer */}
        <div className="flex items-center mt-auto pt-2 border-t border-border">
          {stats.total > 0 ? (
            <span className="text-[10px] flex items-center gap-1.5">
              {stats.success > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{stats.success}✓</span>
              )}
              {stats.failed > 0 && (
                <span className="text-red-500 font-medium">{stats.failed}✗</span>
              )}
              {stats.success === 0 && stats.failed === 0 && (
                <span className="text-muted-foreground">{stats.total}×</span>
              )}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/40">sem execuções</span>
          )}
        </div>
      </div>
    </div>
  );
}

function AutomacoesHub() {
  const [editId, setEditId] = useState<string | null | undefined>(undefined);

  if (editId !== undefined) {
    const isNew = editId === null;
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border shrink-0">
          <button
            type="button"
            onClick={() => setEditId(undefined)}
            className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Voltar às automações
          </button>
          <span className="text-muted-foreground/30 text-[12px]">/</span>
          <span className="text-[13px] font-medium text-foreground">
            {isNew ? 'Nova automação' : 'Editar automação'}
          </span>
        </div>
        {/* Content — full width, scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-6">
            <InstagramAutomationsTab
              key={editId ?? 'new'}
              initialEditId={editId}
              onClose={() => setEditId(undefined)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <AutomacoesListView
      onNew={() => setEditId(null)}
      onEdit={(id) => setEditId(id)}
    />
  );
}

function AutomacoesListView({ onNew, onEdit }: { onNew: () => void; onEdit: (id: string) => void }) {
  const { data: automations = [], isLoading } = useInstagramAutomations();
  const { mutate: del } = useDeleteInstagramAutomation();
  const { mutate: update } = useUpdateInstagramAutomation();
  const { data: logs = [] } = useInstagramAutomationLog(undefined, 500);
  const { toast } = useToast();
  const postsMap = usePostsMap();

  const statsByAutomation = useMemo(() => {
    const map: Record<string, { total: number; success: number; failed: number }> = {};
    for (const l of logs) {
      if (!l.automation_id) continue;
      if (!map[l.automation_id]) map[l.automation_id] = { total: 0, success: 0, failed: 0 };
      map[l.automation_id].total++;
      if (l.status === 'success') map[l.automation_id].success++;
      if (l.status === 'failed') map[l.automation_id].failed++;
    }
    return map;
  }, [logs]);

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Remover a automação "${name}"?`)) return;
    del(id, {
      onSuccess: () => toast({ title: 'Automação removida' }),
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleToggle = (a: InstagramAutomation) => {
    update(
      { id: a.id, is_active: !a.is_active },
      { onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }) },
    );
  };

  const active   = automations.filter(a =>  a.is_active);
  const inactive = automations.filter(a => !a.is_active);

  if (isLoading) {
    return (
      <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[6px] overflow-hidden border border-border">
            <div className="aspect-[4/3] bg-muted animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-3 w-3/4 bg-muted animate-pulse rounded-[3px]" />
              <div className="h-2 w-1/2 bg-muted animate-pulse rounded-[3px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const cardProps = (a: InstagramAutomation) => ({
    automation: a,
    stats: statsByAutomation[a.id] ?? { total: 0, success: 0, failed: 0 },
    postsMap,
    onEdit:   () => onEdit(a.id),
    onDelete: () => handleDelete(a.id, a.name),
    onToggle: () => handleToggle(a),
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 w-full">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] font-semibold text-foreground">Automações Instagram</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Respostas automáticas para DMs, comentários e stories
          </p>
        </div>
        <Button size="sm" onClick={onNew} className="h-[30px] text-[12px] gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Nova automação
        </Button>
      </div>

      {/* Empty state */}
      {automations.length === 0 && (
        <div className="border border-dashed border-border rounded-[6px] py-20 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Zap className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-foreground">Nenhuma automação criada</p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-[240px] leading-relaxed">
              Crie sua primeira automação para responder automaticamente a DMs e comentários do Instagram
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={onNew} className="h-[30px] text-[12px] gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Criar automação
          </Button>
        </div>
      )}

      {/* Active grid */}
      {active.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] font-semibold">
            Ativas ({active.length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {active.map(a => <AutomationCard key={a.id} {...cardProps(a)} />)}
          </div>
        </div>
      )}

      {/* Inactive grid */}
      {inactive.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] font-semibold">
            Inativas ({inactive.length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {inactive.map(a => <AutomationCard key={a.id} {...cardProps(a)} />)}
          </div>
        </div>
      )}
    </div>
  );
}
