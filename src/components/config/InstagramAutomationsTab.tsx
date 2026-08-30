import { useState, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, Zap, MessageCircle, MessageSquare,
  Heart, ChevronDown, X, Loader2, CheckCircle2, XCircle, Clock, SkipForward,
  Hash, Play, Image, AlertTriangle, ChevronUp, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useInstagramAutomations,
  useCreateInstagramAutomation,
  useUpdateInstagramAutomation,
  useDeleteInstagramAutomation,
  useInstagramAutomationLog,
  useInstagramPosts,
  type InstagramAutomation,
  type InstagramPost,
  type AutomationFilter,
  type QuickReply,
  type TriggerType,
  type ActionType,
  type FilterOp,
  type FilterType,
  type AutomationUpsert,
} from '@/hooks/useInstagramAutomations';

// ── PostCard ──────────────────────────────────────────────────────────────────

interface PostCardProps {
  post_id: string;
  thumbnail_url: string | null;
  caption: string | null;
  published_at: string;
  selected: boolean;
  onClick: () => void;
  showTypeBadge?: boolean;
  isReel?: boolean;
}

function PostCard({ post_id: _id, thumbnail_url, caption, published_at, selected, onClick, showTypeBadge, isReel }: PostCardProps) {
  const relativeDate = (() => {
    try { return formatDistanceToNow(new Date(published_at), { addSuffix: true, locale: ptBR }); }
    catch { return ''; }
  })();

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Post de ${relativeDate}${caption ? ': ' + caption.slice(0, 60) : ''}`}
      onClick={onClick}
      onKeyDown={handleKey}
      className={cn(
        'relative aspect-square rounded-[4px] overflow-hidden border-2 cursor-pointer transition-all focus-visible:outline-2 focus-visible:outline-primary',
        selected ? 'border-primary/60 bg-primary/5' : 'border-border hover:border-border/80',
      )}
    >
      {thumbnail_url ? (
        <img
          src={thumbnail_url}
          alt={caption?.slice(0, 60) ?? 'Post Instagram'}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-muted flex items-center justify-center">
          <Image className="w-6 h-6 text-muted-foreground/30" />
        </div>
      )}
      {showTypeBadge && (
        <div className="absolute top-1 left-1">
          <span className="text-[8px] font-medium px-1 py-0.5 rounded-[2px] bg-black/50 text-white/90 leading-none">
            {isReel ? 'Reels' : 'Post'}
          </span>
        </div>
      )}
      {selected && (
        <div className="absolute top-1 right-1">
          <CheckCircle2 className="w-4 h-4 text-primary drop-shadow" />
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
        {caption && (
          <p className="text-[9px] text-white/90 line-clamp-2 leading-tight">{caption}</p>
        )}
        <p className="text-[8px] text-white/60 mt-0.5">{relativeDate}</p>
      </div>
    </div>
  );
}

// ── PostPicker ────────────────────────────────────────────────────────────────

interface PostPickerProps {
  selectedId: string;
  onSelect: (id: string) => void;
  onManual: () => void;
  autoOpen?: boolean;
}

type PostTypeFilter = 'all' | 'posts' | 'reels';

const PAGE_SIZE = 6;

function PostPicker({ selectedId, onSelect, onManual, autoOpen }: PostPickerProps) {
  const [enabled, setEnabled] = useState(!!autoOpen);
  const [typeFilter, setTypeFilter] = useState<PostTypeFilter>('all');
  const [page, setPage] = useState(0);
  const { data: posts = [], isLoading, error } = useInstagramPosts(enabled);

  const openGallery = useCallback(() => setEnabled(true), []);

  const filteredPosts = posts.filter((p: InstagramPost) => {
    if (typeFilter === 'all') return true;
    const isReel = p.media_product_type === 'REELS' || (p.media_type === 'VIDEO' && p.media_product_type === 'REELS');
    return typeFilter === 'reels' ? isReel : !isReel;
  });

  const totalPages = Math.ceil(filteredPosts.length / PAGE_SIZE);
  const pagedPosts = filteredPosts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const resetPage = () => setPage(0);

  const readableError = (() => {
    if (!error) return null;
    const code = (error as { error?: string })?.error;
    if (code === 'no_instagram_config') return 'Instagram não está ligado';
    if (code === 'invalid_token') return 'Token Instagram expirou — reconecte em Configurações';
    return 'Não foi possível carregar posts';
  })();

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={openGallery}
        className="flex items-center gap-1.5 text-[11px] text-primary hover:underline"
      >
        <Play className="w-3 h-3" />
        Escolher post da galeria
      </button>
    );
  }

  const TYPE_FILTERS: { value: PostTypeFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'posts', label: 'Posts' },
    { value: 'reels', label: 'Reels' },
  ];

  return (
    <div className="space-y-2">
      {/* Filter buttons — skeleton placeholders while loading */}
      <div className="flex gap-1">
        {isLoading
          ? TYPE_FILTERS.map(f => (
              <div key={f.value} className="h-5 w-10 rounded-[3px] bg-muted animate-pulse" />
            ))
          : !readableError && posts.length > 0 && TYPE_FILTERS.map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => { setTypeFilter(f.value); resetPage(); }}
                className={cn(
                  'text-[10px] px-2 h-5 rounded-[3px] border transition-colors',
                  typeFilter === f.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-muted-foreground border-border hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))
        }
      </div>

      {isLoading && (
        <div className="grid grid-cols-3 max-sm:grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-[4px] bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && readableError && (
        <div className="flex items-start gap-2 p-2.5 rounded-[4px] border border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-600 dark:text-amber-400 flex-1">{readableError}</p>
        </div>
      )}

      {!isLoading && !readableError && filteredPosts.length === 0 && (
        <p className="text-[11px] text-muted-foreground">Sem posts encontrados.</p>
      )}

      {!isLoading && !readableError && filteredPosts.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 max-sm:grid-cols-2 gap-2">
            {pagedPosts.map((post: InstagramPost) => {
              const isReel = post.media_product_type === 'REELS';
              return (
                <PostCard
                  key={post.id}
                  post_id={post.id}
                  thumbnail_url={post.thumbnail_url ?? post.media_url}
                  caption={post.caption}
                  published_at={post.timestamp}
                  selected={selectedId === post.id}
                  onClick={() => onSelect(post.id)}
                  showTypeBadge={typeFilter === 'all'}
                  isReel={isReel}
                />
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Anterior
              </button>
              <span className="text-[10px] text-muted-foreground/50">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Próxima →
              </button>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onManual}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronUp className="w-3 h-3" />
        Inserir ID manualmente
      </button>
    </div>
  );
}

// ── PostPickerSection — toggle between gallery and manual input ───────────────

function PostPickerSection({ value, onChange }: { value: string; onChange: (id: string | null) => void }) {
  const [showManual, setShowManual] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(!value);
  const { data: posts = [] } = useInstagramPosts(!!value);
  const selectedPost = value ? posts.find((p: InstagramPost) => p.id === value) : null;

  const handleSelect = (id: string) => {
    onChange(id);
    setPickerOpen(false);
  };

  // Collapsed state — post already selected
  if (value && !pickerOpen) {
    return (
      <div className="flex items-center gap-2 py-0.5">
        {selectedPost?.thumbnail_url || selectedPost?.media_url ? (
          <img
            src={selectedPost.thumbnail_url ?? selectedPost.media_url ?? ''}
            alt=""
            className="w-8 h-8 rounded-[3px] object-cover shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-[3px] bg-muted shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-foreground truncate">
            {selectedPost?.caption?.slice(0, 60) ?? value}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="text-[11px] text-primary hover:underline shrink-0"
        >
          Alterar
        </button>
      </div>
    );
  }

  if (showManual) {
    return (
      <div className="space-y-1">
        <Input
          value={value}
          onChange={e => onChange(e.target.value || null)}
          placeholder="ID do post Instagram (ex: 17854360229135492)"
          className="h-[30px] text-xs font-mono"
        />
        <p className="text-[10px] text-muted-foreground">
          Cole o ID numérico do post. A automação só dispara para comentários neste post específico.
        </p>
        <button
          type="button"
          onClick={() => setShowManual(false)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronUp className="w-3 h-3" />
          Escolher da galeria
        </button>
      </div>
    );
  }

  return (
    <PostPicker
      selectedId={value}
      onSelect={handleSelect}
      onManual={() => setShowManual(true)}
      autoOpen
    />
  );
}

// ── PostPreviewCard ───────────────────────────────────────────────────────────

function PostPreviewCard({ postId }: { postId: string }) {
  const { data: posts = [], isLoading } = useInstagramPosts(true);
  const post = posts.find((p: InstagramPost) => p.id === postId);

  const relativeDate = (() => {
    if (!post) return '';
    try { return formatDistanceToNow(new Date(post.timestamp), { addSuffix: true, locale: ptBR }); }
    catch { return ''; }
  })();

  if (isLoading) {
    return <div className="aspect-square bg-muted animate-pulse" />;
  }

  if (!post) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-[11px] text-muted-foreground">Post não encontrado</p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5 font-mono">{postId}</p>
      </div>
    );
  }

  const isReel = post.media_product_type === 'REELS';
  const isCarousel = post.media_type === 'CAROUSEL_ALBUM';
  const typeLabel = isReel ? 'Reels' : isCarousel ? 'Carrossel' : 'Post';
  const TypeIcon = isCarousel ? Layers : isReel ? Play : Image;

  return (
    <div>
      <div className="relative aspect-square">
        {post.thumbnail_url ?? post.media_url ? (
          <img
            src={post.thumbnail_url ?? post.media_url ?? ''}
            alt={post.caption?.slice(0, 60) ?? 'Post Instagram'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <Image className="w-6 h-6 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute top-1.5 left-1.5">
          <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1 py-0.5 rounded-[2px] bg-black/60 text-white/90 leading-none">
            <TypeIcon className="w-2.5 h-2.5" />
            {typeLabel}
          </span>
        </div>
      </div>
      {post.caption && (
        <div className="px-3 py-2">
          <p className="text-[11px] text-foreground line-clamp-3 leading-relaxed">{post.caption}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{relativeDate}</p>
        </div>
      )}
      {!post.caption && (
        <div className="px-3 py-2">
          <p className="text-[10px] text-muted-foreground">{relativeDate}</p>
        </div>
      )}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<TriggerType, { label: string; icon: React.ReactNode; desc: string }> = {
  incoming_dm:    { label: 'DM recebido',         icon: <MessageCircle className="w-3.5 h-3.5" />, desc: 'Quando alguém te envia uma mensagem direta' },
  post_comment:   { label: 'Comentário em post',   icon: <MessageSquare className="w-3.5 h-3.5" />, desc: 'Quando alguém comenta em um dos seus posts' },
  story_mention:  { label: 'Menção em story',      icon: <Heart className="w-3.5 h-3.5" />,          desc: 'Quando alguém te menciona em um story' },
  story_reply:    { label: 'Resposta a story',     icon: <Zap className="w-3.5 h-3.5" />,            desc: 'Quando alguém responde ao seu story' },
};

const ACTION_LABELS: Record<ActionType, string> = {
  send_dm:         'Enviar DM',
  reply_comment:   'Responder comentário',
  reply_and_dm:    'Comentário + DM',
};

const FILTER_TYPE_LABELS: Record<FilterType, string> = {
  always:                 'Sempre (sem filtro)',
  is_first_contact:       'Apenas no primeiro contato',
  message_contains:       'Mensagem contém',
  message_not_contains:   'Mensagem não contém',
};

const DEFAULT_QUICK_REPLIES = [
  'Quero saber mais',
  'Como funciona?',
  'Me manda o link',
  'Não obrigado',
];

const DEFAULT_COMMENT_REPLIES = [
  'Mandei na DM!',
  'Acabei de enviar!',
  'Tá lá no direct!',
  'Olha sua DM!',
  'Tá no direct!',
  'Respondi no privado!',
  'Checa seu direct!',
  'Está na DM!',
  'Enviei!',
  'Tá lá.',
  'Enviei por DM.',
];

const STATUS_CONFIG = {
  success:  { label: 'Enviado',    icon: CheckCircle2, className: 'text-green-600 bg-green-500/10 border-green-500/20' },
  failed:   { label: 'Falhou',     icon: XCircle,       className: 'text-red-600 bg-red-500/10 border-red-500/20' },
  skipped:  { label: 'Ignorado',   icon: SkipForward,   className: 'text-muted-foreground bg-muted border-border' },
  cooldown: { label: 'Cooldown',   icon: Clock,         className: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
};

// ── Default form state ────────────────────────────────────────────────────────

const DEFAULT_FORM: AutomationUpsert = {
  name:                     '',
  description:              null,
  is_active:                true,
  trigger_type:             'incoming_dm',
  target_post_id:           null,
  filter_operator:          'any',
  filters:                  [],
  action_type:              'send_dm',
  action_dm_text:           '',
  action_dm_quick_replies:  [],
  action_comment_text:      null,
  action_comment_texts:     [],
  cooldown_hours:           24,
  priority:                 0,
};

// ── Root ──────────────────────────────────────────────────────────────────────

type View = { mode: 'list' } | { mode: 'form'; id: string | null };

export default function InstagramAutomationsTab({ initialEditId, onClose }: { initialEditId?: string | null; onClose?: () => void } = {}) {
  const [view, setView] = useState<View>(
    initialEditId != null ? { mode: 'form', id: initialEditId } : { mode: 'list' },
  );

  if (view.mode === 'form') {
    return (
      <AutomationForm
        id={view.id}
        onBack={onClose ?? (() => setView({ mode: 'list' }))}
      />
    );
  }

  return (
    <AutomationList
      onNew={() => setView({ mode: 'form', id: null })}
      onEdit={(id) => setView({ mode: 'form', id })}
    />
  );
}

// ── List ──────────────────────────────────────────────────────────────────────

function AutomationList({
  onNew,
  onEdit,
}: {
  onNew: () => void;
  onEdit: (id: string) => void;
}) {
  const { data: automations = [], isLoading } = useInstagramAutomations();
  const { mutate: del, isPending: deleting } = useDeleteInstagramAutomation();
  const { mutate: update } = useUpdateInstagramAutomation();
  const { toast } = useToast();

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Automações</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Respostas automáticas para DMs, comentários e stories — estilo ManyChat
          </p>
        </div>
        <Button size="sm" onClick={onNew} className="h-[30px] text-xs gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Nova automação
        </Button>
      </div>

      {/* Empty state */}
      {automations.length === 0 && (
        <div className="border border-dashed border-border rounded-[4px] py-10 flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <Zap className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Nenhuma automação configurada</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Crie sua primeira automação para responder automaticamente<br />a DMs e comentários do Instagram
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={onNew} className="h-[30px] text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Criar automação
          </Button>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {automations.map((a) => {
          const trigger = TRIGGER_LABELS[a.trigger_type];
          const filterSummary = getFilterSummary(a.filters, a.filter_operator);
          return (
            <div
              key={a.id}
              className={cn(
                'border rounded-[4px] p-3.5 transition-colors',
                a.is_active ? 'border-border bg-card' : 'border-border bg-muted',
              )}
            >
              <div className="flex items-start gap-3">
                {/* Toggle */}
                <Switch
                  checked={a.is_active}
                  onCheckedChange={() => handleToggle(a)}
                  className="mt-0.5 shrink-0"
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      'text-sm font-semibold',
                      a.is_active ? 'text-foreground' : 'text-muted-foreground',
                    )}>
                      {a.name}
                    </span>
                    {!a.is_active && (
                      <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50 font-semibold">
                        inativa
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 bg-muted">
                      {trigger.icon}
                      {trigger.label}
                    </span>
                    {a.target_post_id && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 border border-blue-500/20 rounded px-1.5 py-0.5 bg-blue-500/5">
                        <Hash className="w-2.5 h-2.5" />
                        Post: {a.target_post_id}
                      </span>
                    )}
                    {filterSummary && (
                      <span className="text-[10px] text-muted-foreground">· {filterSummary}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">→</span>
                    <span className="inline-flex items-center text-[10px] text-primary font-medium">
                      {ACTION_LABELS[a.action_type]}
                    </span>
                  </div>

                  {a.description && (
                    <p className="text-[10px] text-muted-foreground/60 mt-1 truncate">{a.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-[30px] w-[30px]"
                    onClick={() => onEdit(a.id)}
                  >
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-[30px] w-[30px]"
                    onClick={() => handleDelete(a.id, a.name)}
                    disabled={deleting}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Global log link */}
      {automations.length > 0 && (
        <AutomationLogSection automationId={null} />
      )}
    </div>
  );
}

function getFilterSummary(filters: AutomationFilter[], operator: FilterOp): string {
  if (!filters.length) return '';
  const parts = filters.map(f => {
    if (f.type === 'always') return 'Sempre';
    if (f.type === 'is_first_contact') return '1º contato';
    if (f.type === 'message_contains') return `Contém: ${f.value ?? ''}`;
    if (f.type === 'message_not_contains') return `Não contém: ${f.value ?? ''}`;
    return '';
  }).filter(Boolean);
  return parts.join(operator === 'any' ? ' OU ' : ' E ');
}

// ── Form ──────────────────────────────────────────────────────────────────────

function AutomationForm({
  id,
  onBack,
}: {
  id: string | null;
  onBack: () => void;
}) {
  const { data: existing } = useInstagramAutomations();
  const automation = id ? existing?.find(a => a.id === id) : null;

  const { mutate: create, isPending: creating } = useCreateInstagramAutomation();
  const { mutate: update, isPending: updating } = useUpdateInstagramAutomation();
  const { toast } = useToast();

  const [form, setForm] = useState<AutomationUpsert>(() =>
    automation
      ? {
          name:                     automation.name,
          description:              automation.description,
          is_active:                automation.is_active,
          trigger_type:             automation.trigger_type,
          target_post_id:           automation.target_post_id,
          filter_operator:          automation.filter_operator,
          filters:                  automation.filters,
          action_type:              automation.action_type,
          action_dm_text:           automation.action_dm_text,
          action_dm_quick_replies:  automation.action_dm_quick_replies ?? [],
          action_comment_text:      automation.action_comment_text,
          action_comment_texts:     automation.action_comment_texts ?? [],
          cooldown_hours:           automation.cooldown_hours,
          priority:                 automation.priority,
        }
      : { ...DEFAULT_FORM },
  );

  const isPending = creating || updating;

  const setField = <K extends keyof AutomationUpsert>(key: K, value: AutomationUpsert[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  // Filters
  const addFilter = () =>
    setField('filters', [...form.filters, { type: 'message_contains', value: '' }]);

  const updateFilter = (i: number, patch: Partial<AutomationFilter>) =>
    setField('filters', form.filters.map((f, idx) => idx === i ? { ...f, ...patch } : f));

  const removeFilter = (i: number) =>
    setField('filters', form.filters.filter((_, idx) => idx !== i));

  // Log collapsed state
  const [logsExpanded, setLogsExpanded] = useState(false);

  // Validation
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const hasFieldError = (field: string) => {
    if (!validationErrors.length) return false;
    if (field === 'name') return !form.name.trim();
    if (field === 'dm_text') return (form.action_type === 'send_dm' || form.action_type === 'reply_and_dm') && !form.action_dm_text?.trim();
    if (field === 'comment_texts') return (form.action_type === 'reply_comment' || form.action_type === 'reply_and_dm') && isComment && form.action_comment_texts.length === 0;
    return false;
  };

  // Tag input states
  const [quickReplyInput, setQuickReplyInput] = useState('');
  const [commentTextInput, setCommentTextInput] = useState('');

  // Tag-input filter state
  const [containsInput, setContainsInput] = useState('');
  const [notContainsInput, setNotContainsInput] = useState('');
  const [showContainsRow, setShowContainsRow] = useState(
    () => form.filters.some(f => f.type === 'message_contains'),
  );
  const [showNotContainsRow, setShowNotContainsRow] = useState(
    () => form.filters.some(f => f.type === 'message_not_contains'),
  );

  const containsTags = form.filters.filter(f => f.type === 'message_contains');
  const notContainsTags = form.filters.filter(f => f.type === 'message_not_contains');
  const hasAlwaysFilter = form.filters.some(f => f.type === 'always');
  const hasFirstContactFilter = form.filters.some(f => f.type === 'is_first_contact');

  const addContainsKeyword = (val: string) => {
    const v = val.trim();
    if (!v) return;
    setField('filters', [...form.filters, { type: 'message_contains', value: v }]);
    setContainsInput('');
  };
  const addNotContainsKeyword = (val: string) => {
    const v = val.trim();
    if (!v) return;
    setField('filters', [...form.filters, { type: 'message_not_contains', value: v }]);
    setNotContainsInput('');
  };
  const removeContainsTag = (value: string) =>
    setField('filters', form.filters.filter(f => !(f.type === 'message_contains' && f.value === value)));
  const removeNotContainsTag = (value: string) =>
    setField('filters', form.filters.filter(f => !(f.type === 'message_not_contains' && f.value === value)));
  const toggleAlwaysFilter = () => {
    if (hasAlwaysFilter) setField('filters', form.filters.filter(f => f.type !== 'always'));
    else setField('filters', [...form.filters, { type: 'always' }]);
  };
  const toggleFirstContactFilter = () => {
    if (hasFirstContactFilter) setField('filters', form.filters.filter(f => f.type !== 'is_first_contact'));
    else setField('filters', [...form.filters, { type: 'is_first_contact' }]);
  };

  // Derived
  const isComment = form.trigger_type === 'post_comment';
  const showDmText = form.action_type === 'send_dm' || form.action_type === 'reply_and_dm';
  const showCommentText = (form.action_type === 'reply_comment' || form.action_type === 'reply_and_dm') && isComment;
  const commentOnlyAction = form.action_type === 'reply_comment';
  // If trigger changes away from comment, reset reply_comment action
  const resolvedActionType: ActionType = (!isComment && commentOnlyAction) ? 'send_dm' : form.action_type;

  const handleSave = () => {
    const errors: string[] = [];
    if (!form.name.trim()) errors.push('Nome da automação é obrigatório');
    const dmRequired = form.action_type === 'send_dm' || form.action_type === 'reply_and_dm';
    if (dmRequired && !form.action_dm_text?.trim()) errors.push('Mensagem do DM não pode estar vazia');
    const commentRequired = (form.action_type === 'reply_comment' || form.action_type === 'reply_and_dm') && isComment;
    if (commentRequired && form.action_comment_texts.length === 0) errors.push('Adicione ao menos uma variação de resposta ao comentário');
    if (form.action_dm_quick_replies.some(qr => qr.title.length > 20)) errors.push('Quick reply com mais de 20 caracteres');
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    // Strip filters with empty value before saving
    const cleanedFilters = form.filters.filter(f => {
      const needsValue = f.type === 'message_contains' || f.type === 'message_not_contains';
      return !needsValue || (f.value ?? '').trim().length > 0;
    });

    // Sync legacy scalar field with first variation for backward compat
    const action_comment_text = form.action_comment_texts.length > 0
      ? form.action_comment_texts[0]
      : form.action_comment_text;
    const payload = { ...form, filters: cleanedFilters, action_type: resolvedActionType, action_comment_text };

    if (id) {
      update({ id, ...payload }, {
        onSuccess: () => { toast({ title: 'Automação atualizada' }); onBack(); },
        onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
      });
    } else {
      create(payload, {
        onSuccess: () => { toast({ title: 'Automação criada' }); onBack(); },
        onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
      });
    }
  };

  return (
    <div className="flex gap-6 items-start">
      {/* ── Coluna esquerda — campos principais ── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Name + active — inline header */}
        <div className="space-y-1 pb-2 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <input
                value={form.name}
                onChange={e => { setField('name', e.target.value); if (validationErrors.length) setValidationErrors(v => v.filter(e => !e.includes('Nome'))); }}
                placeholder="Nome da automação"
                className={cn(
                  'w-full text-[18px] font-semibold bg-transparent border-0 outline-none leading-tight',
                  hasFieldError('name')
                    ? 'text-destructive placeholder:text-destructive/30 border-b border-destructive pb-px'
                    : 'text-foreground placeholder:text-muted-foreground/30',
                )}
              />
              <input
                value={form.description ?? ''}
                onChange={e => setField('description', e.target.value || null)}
                placeholder="Descrição opcional..."
                className="w-full text-[12px] bg-transparent border-0 outline-none text-muted-foreground placeholder:text-muted-foreground/30 mt-1"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              <span className="text-[11px] text-muted-foreground">{form.is_active ? 'Ativa' : 'Inativa'}</span>
              <Switch
                checked={form.is_active}
                onCheckedChange={v => setField('is_active', v)}
                className="data-[state=checked]:bg-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Trigger */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Quando disparar</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(TRIGGER_LABELS) as [TriggerType, typeof TRIGGER_LABELS[TriggerType]][]).map(([key, t]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setField('trigger_type', key as TriggerType);
                  if (key !== 'post_comment') setField('target_post_id', null);
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 h-[28px] rounded-full text-[12px] border transition-all',
                  form.trigger_type === key
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground',
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div className="rounded-[4px] border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            {TRIGGER_LABELS[form.trigger_type]?.desc}
          </div>

          {isComment && (
            <div className="border border-border rounded-[4px] p-3 space-y-2 bg-muted/20">
              <p className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                <Hash className="w-3 h-3 text-muted-foreground" /> Post alvo
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setField('target_post_id', null)}
                  className={cn(
                    'inline-flex items-center px-3 h-[26px] rounded-full text-[12px] border transition-all',
                    form.target_post_id === null
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground',
                  )}
                >
                  Todos os posts
                </button>
                <button
                  type="button"
                  onClick={() => { if (form.target_post_id === null) setField('target_post_id', ''); }}
                  className={cn(
                    'inline-flex items-center px-3 h-[26px] rounded-full text-[12px] border transition-all',
                    form.target_post_id !== null
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground',
                  )}
                >
                  Post específico
                </button>
              </div>
              {form.target_post_id !== null && (
                <PostPickerSection
                  value={form.target_post_id}
                  onChange={(id) => setField('target_post_id', id || null)}
                />
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Filtros</p>

          {/* Toggle pills: Sempre / 1º contato */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={toggleAlwaysFilter}
              className={cn(
                'inline-flex items-center px-3 h-[26px] rounded-full text-[12px] border transition-all',
                hasAlwaysFilter
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground',
              )}
            >
              Sempre
            </button>
            <button
              type="button"
              onClick={toggleFirstContactFilter}
              className={cn(
                'inline-flex items-center px-3 h-[26px] rounded-full text-[12px] border transition-all',
                hasFirstContactFilter
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground',
              )}
            >
              Apenas 1º contato
            </button>
          </div>

          {/* Contém — tag input */}
          {(showContainsRow || containsTags.length > 0) && (
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Contém</span>
              <div
                className="flex flex-wrap gap-1.5 p-2 rounded-[4px] border border-border bg-background min-h-[34px] items-center cursor-text"
                onClick={() => document.getElementById('filter-contains-input')?.focus()}
              >
                {containsTags.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-muted text-[11px] text-foreground border border-border/60">
                    {f.value}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); removeContainsTag(f.value!); }}
                      className="text-muted-foreground/60 hover:text-foreground transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  id="filter-contains-input"
                  value={containsInput}
                  onChange={e => setContainsInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); addContainsKeyword(containsInput); }
                    if (e.key === 'Backspace' && containsInput === '' && containsTags.length > 0)
                      removeContainsTag(containsTags[containsTags.length - 1].value!);
                  }}
                  placeholder={containsTags.length === 0 ? 'Digite e pressione Enter...' : 'Adicionar...'}
                  className="flex-1 min-w-[120px] text-[12px] bg-transparent outline-none border-0 text-foreground placeholder:text-muted-foreground/40 h-[22px]"
                />
                <button
                  type="button"
                  onClick={() => { setShowContainsRow(false); containsTags.forEach(f => removeContainsTag(f.value!)); }}
                  className="ml-1 text-muted-foreground/30 hover:text-muted-foreground transition-colors shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Não contém — tag input */}
          {(showNotContainsRow || notContainsTags.length > 0) && (
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Não contém</span>
              <div
                className="flex flex-wrap gap-1.5 p-2 rounded-[4px] border border-border bg-background min-h-[34px] items-center cursor-text"
                onClick={() => document.getElementById('filter-not-contains-input')?.focus()}
              >
                {notContainsTags.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-muted text-[11px] text-foreground border border-border/60">
                    {f.value}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); removeNotContainsTag(f.value!); }}
                      className="text-muted-foreground/60 hover:text-foreground transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  id="filter-not-contains-input"
                  value={notContainsInput}
                  onChange={e => setNotContainsInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); addNotContainsKeyword(notContainsInput); }
                    if (e.key === 'Backspace' && notContainsInput === '' && notContainsTags.length > 0)
                      removeNotContainsTag(notContainsTags[notContainsTags.length - 1].value!);
                  }}
                  placeholder={notContainsTags.length === 0 ? 'Digite e pressione Enter...' : 'Adicionar...'}
                  className="flex-1 min-w-[120px] text-[12px] bg-transparent outline-none border-0 text-foreground placeholder:text-muted-foreground/40 h-[22px]"
                />
                <button
                  type="button"
                  onClick={() => { setShowNotContainsRow(false); notContainsTags.forEach(f => removeNotContainsTag(f.value!)); }}
                  className="ml-1 text-muted-foreground/30 hover:text-muted-foreground transition-colors shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Add filter type */}
          {(!showContainsRow && containsTags.length === 0) || (!showNotContainsRow && notContainsTags.length === 0) ? (
            <div className="flex gap-3">
              {!showContainsRow && containsTags.length === 0 && (
                <button type="button" onClick={() => setShowContainsRow(true)}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="w-3 h-3" /> Contém
                </button>
              )}
              {!showNotContainsRow && notContainsTags.length === 0 && (
                <button type="button" onClick={() => setShowNotContainsRow(true)}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="w-3 h-3" /> Não contém
                </button>
              )}
            </div>
          ) : null}

          {/* Operator segmented control */}
          {(containsTags.length + notContainsTags.length) > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Regra</span>
              <div className="flex items-center border border-border rounded-[4px] overflow-hidden h-[22px]">
                <button
                  type="button"
                  onClick={() => setField('filter_operator', 'any')}
                  className={cn(
                    'px-2.5 h-full text-[11px] transition-colors',
                    form.filter_operator === 'any'
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  qualquer (OU)
                </button>
                <div className="w-px h-3 bg-border" />
                <button
                  type="button"
                  onClick={() => setField('filter_operator', 'all')}
                  className={cn(
                    'px-2.5 h-full text-[11px] transition-colors',
                    form.filter_operator === 'all'
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  todos (E)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Resposta</p>
          <div className="flex flex-wrap gap-1.5">
            {(['send_dm', 'reply_comment', 'reply_and_dm'] as ActionType[]).map((type) => {
              const disabled = (type === 'reply_comment' || type === 'reply_and_dm') && !isComment;
              return (
                <button
                  key={type}
                  type="button"
                  disabled={disabled}
                  onClick={() => setField('action_type', type)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 h-[28px] rounded-full text-[12px] border transition-all',
                    form.action_type === type && !disabled
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground',
                    disabled && 'opacity-30 cursor-not-allowed',
                  )}
                >
                  {ACTION_LABELS[type]}
                </button>
              );
            })}
          </div>
          <div className="space-y-3">

          {/* DM text — Instagram bubble */}
          {showDmText && (
            <div className="space-y-3">
              {/* Bubble preview */}
              <div className={cn(
                'rounded-[10px] border bg-muted/20 px-3 pt-3 pb-2 space-y-2 transition-colors',
                hasFieldError('dm_text') ? 'border-destructive/60' : 'border-border/40',
              )}>
                <div className="flex justify-end">
                  <div className="w-[82%] space-y-0.5">
                    <div className="bg-[#3797F0] rounded-[18px] rounded-tr-[5px] px-3.5 pt-2.5 pb-2">
                      <textarea
                        value={form.action_dm_text ?? ''}
                        onChange={e => setField('action_dm_text', e.target.value)}
                        placeholder="Olá {{nome}}! Vi que você se interessou. Que tal conversarmos?"
                        rows={3}
                        className="w-full bg-transparent border-0 outline-none text-white text-[13px] leading-relaxed resize-none placeholder:text-white/40"
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground/40 text-right pr-0.5">DM privado</p>
                  </div>
                </div>

                {/* Quick replies preview */}
                {form.action_dm_quick_replies.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-end pb-1">
                    {form.action_dm_quick_replies.map((qr, i) => (
                      <span key={i} className="text-[11px] text-[#3797F0] border border-[#3797F0]/30 rounded-full px-2.5 py-0.5 bg-[#3797F0]/5">
                        {qr.title || 'Botão...'}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* {{nome}} hint */}
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground/60">
                  Use <code className="bg-muted px-1 rounded text-[9px]">{'{{nome}}'}</code> para o @username.
                </p>
                <button
                  type="button"
                  onClick={() => setField('action_dm_text', (form.action_dm_text ?? '') + '{{nome}}')}
                  className="text-[10px] text-primary hover:underline font-medium"
                >
                  + {'{{nome}}'}
                </button>
              </div>

              {/* Quick Replies editor — tag input */}
              <div className="space-y-2 border-t border-border/60 pt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">
                    Quick Replies
                    <span className="text-muted-foreground/50 font-normal ml-1">(botões de resposta rápida)</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{form.action_dm_quick_replies.length}/13</span>
                    <button
                      type="button"
                      onClick={() => setField('action_dm_quick_replies', DEFAULT_QUICK_REPLIES.map(t => ({ title: t })))}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Usar padrão
                    </button>
                  </div>
                </div>

                <div
                  className="flex flex-wrap gap-1.5 p-2 rounded-[4px] border border-border bg-background min-h-[34px] items-center cursor-text"
                  onClick={() => document.getElementById('qr-input')?.focus()}
                >
                  {form.action_dm_quick_replies.map((qr, i) => (
                    <span key={i} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full bg-[#3797F0]/10 text-[11px] text-[#3797F0] border border-[#3797F0]/20">
                      {qr.title}
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setField('action_dm_quick_replies', form.action_dm_quick_replies.filter((_, idx) => idx !== i)); }}
                        className="hover:opacity-60 transition-opacity shrink-0"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  {form.action_dm_quick_replies.length < 13 && (
                    <input
                      id="qr-input"
                      value={quickReplyInput}
                      onChange={e => setQuickReplyInput(e.target.value.slice(0, 20))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const v = quickReplyInput.trim();
                          if (v) { setField('action_dm_quick_replies', [...form.action_dm_quick_replies, { title: v }]); setQuickReplyInput(''); }
                        }
                        if (e.key === 'Backspace' && quickReplyInput === '' && form.action_dm_quick_replies.length > 0)
                          setField('action_dm_quick_replies', form.action_dm_quick_replies.slice(0, -1));
                      }}
                      placeholder={form.action_dm_quick_replies.length === 0 ? 'Digite e pressione Enter...' : 'Adicionar...'}
                      className="flex-1 min-w-[100px] text-[12px] bg-transparent outline-none border-0 text-foreground placeholder:text-muted-foreground/40 h-[22px]"
                    />
                  )}
                </div>
                {quickReplyInput.length > 0 && (
                  <p className="text-[10px] text-muted-foreground/50 text-right">{quickReplyInput.length}/20</p>
                )}
              </div>
            </div>
          )}

          {/* Comment reply — tag input */}
          {showCommentText && (
            <div className="space-y-2 mt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  Variações de resposta
                  <span className="text-muted-foreground/50 font-normal ml-1">(visível publicamente)</span>
                </Label>
                <div className="flex items-center gap-2">
                  {form.action_comment_texts.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {form.action_comment_texts.length} variação{form.action_comment_texts.length !== 1 ? 'ões' : ''}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const toAdd = DEFAULT_COMMENT_REPLIES.filter(t => !form.action_comment_texts.includes(t));
                      if (toAdd.length) setField('action_comment_texts', [...form.action_comment_texts, ...toAdd]);
                    }}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Usar padrão
                  </button>
                </div>
              </div>

              <div
                className={cn(
                  'flex flex-wrap gap-1.5 p-2 rounded-[4px] border bg-background min-h-[36px] items-center cursor-text transition-colors',
                  hasFieldError('comment_texts') ? 'border-destructive/60' : 'border-border',
                )}
                onClick={() => document.getElementById('comment-text-input')?.focus()}
              >
                {form.action_comment_texts.map((text, i) => (
                  <span key={i} className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-[3px] bg-muted text-[11px] text-foreground border border-border/60 max-w-[220px]">
                    <span className="truncate">{text}</span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setField('action_comment_texts', form.action_comment_texts.filter((_, idx) => idx !== i)); }}
                      className="text-muted-foreground/60 hover:text-foreground transition-colors shrink-0"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  id="comment-text-input"
                  value={commentTextInput}
                  onChange={e => setCommentTextInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const v = commentTextInput.trim();
                      if (v) { setField('action_comment_texts', [...form.action_comment_texts, v]); setCommentTextInput(''); }
                    }
                    if (e.key === 'Backspace' && commentTextInput === '' && form.action_comment_texts.length > 0)
                      setField('action_comment_texts', form.action_comment_texts.slice(0, -1));
                  }}
                  placeholder={form.action_comment_texts.length === 0 ? 'Digite e pressione Enter...' : 'Adicionar variação...'}
                  className="flex-1 min-w-[120px] text-[12px] bg-transparent outline-none border-0 text-foreground placeholder:text-muted-foreground/40 h-[22px]"
                />
              </div>

              <p className="text-[10px] text-muted-foreground/60">
                Uma variação é sorteada aleatoriamente. Use{' '}
                <code className="bg-muted px-1 rounded text-[9px]">{'{{nome}}'}</code> para o @username.
              </p>
            </div>
          )}

          {commentOnlyAction && !isComment && (
            <div className="text-[11px] text-amber-600 bg-amber-500/8 border border-amber-500/20 rounded-[4px] px-3 py-2">
              ⚠ Responder comentário só funciona com o gatilho "Comentário em post". Altere o gatilho ou escolha "Enviar DM".
            </div>
          )}
        </div>
        </div>

        {/* ── Log colapsável (apenas ao editar) ── */}
        {id && (
          <AutomationLogSection
            automationId={id}
            expanded={logsExpanded}
            onToggle={() => setLogsExpanded(v => !v)}
          />
        )}
      </div>

      {/* ── Coluna direita — preview + avançado + ações ── */}
      <div className="w-[280px] xl:w-[300px] shrink-0 space-y-4">
        {/* Post preview / trigger placeholder */}
        <div className="border border-border rounded-[4px] overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-[11px] font-semibold text-foreground">
              {form.target_post_id ? 'Preview do post' : 'Gatilho'}
            </p>
          </div>
          {form.target_post_id ? (
            <PostPreviewCard postId={form.target_post_id} />
          ) : isComment ? (
            <div className="px-3 py-4 text-center">
              <p className="text-[11px] text-muted-foreground">Todos os posts</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">A automação dispara em qualquer comentário</p>
            </div>
          ) : (
            <div className="px-3 py-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {TRIGGER_LABELS[form.trigger_type]?.icon}
                </div>
                <div>
                  <p className="text-[12px] font-medium text-foreground">{TRIGGER_LABELS[form.trigger_type]?.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{TRIGGER_LABELS[form.trigger_type]?.desc}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Advanced settings */}
        <div className="border border-border rounded-[4px] overflow-hidden">
          <div className="px-3 py-2 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Cooldown</span>
              <input
                type="number"
                min={0}
                value={form.cooldown_hours}
                onChange={e => setField('cooldown_hours', parseInt(e.target.value) || 0)}
                className="w-12 h-[22px] text-[11px] text-center bg-muted/40 border border-border/60 rounded-[3px] outline-none focus:border-foreground/30 transition-colors"
              />
              <span className="text-[11px] text-muted-foreground/50">h</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Prioridade</span>
              <input
                type="number"
                value={form.priority}
                onChange={e => setField('priority', parseInt(e.target.value) || 0)}
                className="w-10 h-[22px] text-[11px] text-center bg-muted/40 border border-border/60 rounded-[3px] outline-none focus:border-foreground/30 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Save/Cancel */}
        <div className="flex flex-col gap-2">
          <Button size="sm" onClick={handleSave} disabled={isPending} className="w-full h-[32px] text-[12px] gap-1.5">
            {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            {id ? 'Salvar alterações' : 'Criar automação'}
          </Button>
          <Button variant="outline" size="sm" onClick={onBack} disabled={isPending} className="w-full h-[32px] text-[12px]">
            Cancelar
          </Button>
          {validationErrors.length > 0 && (
            <div className="rounded-[4px] border border-destructive/40 bg-destructive/5 px-3 py-2 space-y-1">
              {validationErrors.map((err, i) => (
                <p key={i} className="text-[11px] text-destructive flex items-start gap-1.5">
                  <span className="shrink-0 mt-px">✕</span>
                  {err}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Filter Row ────────────────────────────────────────────────────────────────

function FilterRow({
  filter,
  onChange,
  onRemove,
}: {
  filter: AutomationFilter;
  onChange: (patch: Partial<AutomationFilter>) => void;
  onRemove: () => void;
}) {
  const needsValue = filter.type === 'message_contains' || filter.type === 'message_not_contains';

  return (
    <div className="flex items-center gap-2">
      <Select
        value={filter.type}
        onValueChange={(v) => onChange({ type: v as FilterType, value: needsValue ? filter.value : undefined })}
      >
        <SelectTrigger className="h-[30px] text-xs w-44 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.entries(FILTER_TYPE_LABELS) as [FilterType, string][]).map(([key, label]) => (
            <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {needsValue && (
        <Input
          value={filter.value ?? ''}
          onChange={e => onChange({ value: e.target.value })}
          placeholder="palavra1, palavra2, palavra3..."
          className="h-[30px] text-xs flex-1"
        />
      )}

      {!needsValue && <div className="flex-1" />}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-[30px] w-8 shrink-0"
        onClick={onRemove}
      >
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  label,
  desc,
  children,
  collapsible,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);

  return (
    <div className="border border-border rounded-[4px] overflow-hidden">
      <button
        type="button"
        className={cn(
          'w-full flex items-center justify-between px-4 py-3',
          collapsible && 'cursor-pointer hover:bg-muted/50',
          !collapsible && 'cursor-default',
        )}
        onClick={() => collapsible && setOpen(v => !v)}
      >
        <div>
          <p className="text-xs font-semibold text-foreground text-left">{label}</p>
          {desc && <p className="text-[10px] text-muted-foreground text-left mt-0.5">{desc}</p>}
        </div>
        {collapsible && (
          <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border">
          <div className="pt-3 space-y-3">{children}</div>
        </div>
      )}
    </div>
  );
}

// ── Log Section ───────────────────────────────────────────────────────────────

const TRIGGER_LABEL_MAP: Record<string, string> = {
  incoming_dm:    'DM recebido',
  post_comment:   'Comentário',
  story_mention:  'Menção em story',
  story_reply:    'Resposta a story',
};

const ACTION_LABEL_MAP: Record<string, string> = {
  send_dm:       'DM enviado',
  reply_comment: 'Comentário respondido',
  reply_and_dm:  'Comentário + DM',
};

function AutomationLogSection({
  automationId,
  expanded,
  onToggle,
}: {
  automationId: string | null;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const isCollapsible = onToggle !== undefined;
  const { data: logs = [], isLoading } = useInstagramAutomationLog(
    automationId ?? undefined,
    50,
    undefined,
  );

  const successCount = logs.filter(l => l.status === 'success').length;
  const failCount = logs.filter(l => l.status === 'failed').length;

  return (
    <div className="border border-border rounded-[4px] overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5 text-left',
          isCollapsible ? 'hover:bg-muted/40 transition-colors cursor-pointer' : 'cursor-default',
        )}
      >
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold text-foreground">
            {automationId ? 'Log de execuções' : 'Log geral'}
          </p>
          {!isLoading && logs.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground/60">{logs.length} registros</span>
              {successCount > 0 && (
                <span className="text-[10px] text-green-600 font-medium">{successCount} ok</span>
              )}
              {failCount > 0 && (
                <span className="text-[10px] text-red-500 font-medium">{failCount} falha{failCount !== 1 ? 's' : ''}</span>
              )}
            </div>
          )}
          {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </div>
        {isCollapsible && (
          <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform duration-150', expanded && 'rotate-180')} />
        )}
      </button>

      {/* Body */}
      {(!isCollapsible || expanded) && (
        <div className="border-t border-border">
          {!isLoading && logs.length === 0 && (
            <div className="px-3 py-5 text-center">
              <p className="text-[11px] text-muted-foreground">Nenhuma execução registrada ainda</p>
            </div>
          )}

          {!isLoading && logs.length > 0 && (
            <div className="divide-y divide-border/30">
              {logs.map((entry) => {
                const sc = STATUS_CONFIG[entry.status];
                const Icon = sc.icon;
                const relTime = (() => {
                  try { return formatDistanceToNow(new Date(entry.executed_at), { addSuffix: true, locale: ptBR }); }
                  catch { return ''; }
                })();
                const triggerLabel = entry.trigger_type ? (TRIGGER_LABEL_MAP[entry.trigger_type] ?? entry.trigger_type) : null;
                const actionLabel = entry.action_executed ? (ACTION_LABEL_MAP[entry.action_executed] ?? entry.action_executed) : null;

                return (
                  <div key={entry.id} className="px-3 py-2.5 group hover:bg-muted/20 transition-colors">
                    {/* Row 1: person + status badge + time */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Icon className={cn('w-3 h-3 shrink-0', sc.className.split(' ')[0])} />
                        <span className="text-[12px] font-medium text-foreground truncate">
                          {entry.person_name || 'Usuário'}
                        </span>
                        <span className={cn(
                          'inline-flex items-center text-[9px] font-semibold px-1.5 py-px rounded-[3px] border shrink-0',
                          sc.className,
                        )}>
                          {sc.label}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/50 shrink-0 whitespace-nowrap">{relTime}</span>
                    </div>

                    {/* Row 2: message text */}
                    {entry.message_text && (
                      <p className="text-[11px] text-muted-foreground mt-1 pl-[18px] line-clamp-1">
                        &ldquo;{entry.message_text}&rdquo;
                      </p>
                    )}

                    {/* Row 3: trigger → action meta */}
                    {(triggerLabel || actionLabel) && (
                      <div className="flex items-center gap-1.5 mt-1 pl-[18px]">
                        {triggerLabel && (
                          <span className="text-[10px] text-muted-foreground/50 inline-flex items-center gap-0.5">
                            {triggerLabel}
                          </span>
                        )}
                        {triggerLabel && actionLabel && (
                          <span className="text-[10px] text-muted-foreground/30">→</span>
                        )}
                        {actionLabel && (
                          <span className="text-[10px] text-muted-foreground/50">{actionLabel}</span>
                        )}
                        {!automationId && entry.automation_name && (
                          <>
                            <span className="text-[10px] text-muted-foreground/30">·</span>
                            <span className="text-[10px] text-muted-foreground/50 italic truncate">{entry.automation_name}</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Row 4: error */}
                    {entry.error_message && (
                      <p className="text-[10px] text-red-500 mt-1 pl-[18px] line-clamp-2">{entry.error_message}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
