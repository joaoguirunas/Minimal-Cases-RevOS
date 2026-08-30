import { useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, MessageCircle, Mail, Instagram, Phone, MessageSquare,
  ArrowDownLeft, Bot, RefreshCw, ChevronDown,
  User, Megaphone, FileText, Repeat2, CalendarClock,
  ArrowUpRight, AlertTriangle, RotateCcw, CheckCircle2, XCircle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOmniMensagens, OmniMensagensFilters } from '@/hooks/useOmniMensagens';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useOmniDeadLetter, useOmniDeadLetterStats, useRetryDeadLetter } from '@/hooks/useOmniDeadLetter';

// ── Channel badge ─────────────────────────────────────────────────────────────

const INSTAGRAM_COMMENT_TYPES = new Set(['comentario', 'story_reply', 'story_mention', 'reply_comentario']);

function resolveChannelLabel(channel: string | null, messageType: string | null): string {
  const ch = channel ?? 'whatsapp';
  if (ch === 'instagram') {
    if (messageType && INSTAGRAM_COMMENT_TYPES.has(messageType)) return 'IG Comentário';
    return 'IG DM';
  }
  const labels: Record<string, string> = {
    whatsapp: 'WhatsApp', email: 'Email', sms: 'SMS', telefone: 'Telefone',
  };
  return labels[ch] ?? ch;
}

function ChannelBadge({ channel, messageType }: { channel: string | null; messageType?: string | null }) {
  const ch = channel ?? 'whatsapp';
  const Icon = ch === 'email' ? Mail
    : ch === 'instagram' ? Instagram
    : ch === 'sms' ? MessageSquare
    : ch === 'telefone' ? Phone
    : MessageCircle;
  const colors: Record<string, string> = {
    whatsapp:  'bg-green-500/10 text-green-600 dark:text-green-400',
    email:     'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    instagram: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    sms:       'bg-muted text-muted-foreground',
    telefone:  'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[11px] font-medium ${colors[ch] ?? colors.whatsapp}`}>
      <Icon size={10} />
      {resolveChannelLabel(channel, messageType ?? null)}
    </span>
  );
}

// ── Source origin icon ────────────────────────────────────────────────────────
// Combina from_contact + source_type para exibir ícone e label específico por origem

interface OriginConfig {
  icon: React.ElementType;
  label: string;
  color: string; // tailwind classes
}

function resolveOrigin(fromContact: string | null, sourceType: string | null): OriginConfig {
  // Inbound do cliente
  if (fromContact === 'cliente') {
    return { icon: ArrowDownLeft, label: 'Entrada', color: 'text-green-500' };
  }
  // AI Agent
  if (fromContact === 'agente_ia' || fromContact === 'ia') {
    return { icon: Bot, label: 'IA Agent', color: 'text-violet-500' };
  }
  // Humano via OMNI (manual)
  if (fromContact === 'humano' || sourceType === 'manual') {
    return { icon: User, label: 'Manual', color: 'text-zinc-500' };
  }
  // A partir daqui: from_contact = 'sistema' — distingue pelo source_type
  if (sourceType === 'campaign') {
    return { icon: Megaphone, label: 'Campanha', color: 'text-amber-500' };
  }
  if (sourceType === 'form') {
    return { icon: FileText, label: 'Formulário', color: 'text-cyan-500' };
  }
  if (sourceType === 'followup') {
    return { icon: Repeat2, label: 'Follow-up', color: 'text-rose-500' };
  }
  if (sourceType === 'appointment_reminder') {
    return { icon: CalendarClock, label: 'Lembrete', color: 'text-indigo-500' };
  }
  if (sourceType === 'inbound') {
    return { icon: ArrowDownLeft, label: 'Entrada', color: 'text-green-500' };
  }
  // Fallback: sistema genérico
  return { icon: ArrowUpRight, label: 'Sistema', color: 'text-blue-400' };
}

function OriginIcon({ fromContact, sourceType }: { fromContact: string | null; sourceType: string | null }) {
  const { icon: Icon, label, color } = resolveOrigin(fromContact, sourceType);
  return <Icon size={14} className={`${color} shrink-0`} title={label} />;
}

function OriginBadge({ fromContact, sourceType }: { fromContact: string | null; sourceType: string | null }) {
  const { label, color } = resolveOrigin(fromContact, sourceType);
  // Convert text color to matching bg/text badge
  const bgMap: Record<string, string> = {
    'text-green-500':  'bg-green-500/10 text-green-600 dark:text-green-400',
    'text-violet-500': 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    'text-zinc-500':   'bg-muted text-muted-foreground',
    'text-amber-500':  'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    'text-cyan-500':   'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    'text-rose-500':   'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    'text-indigo-500': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    'text-blue-400':   'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[2px] text-[11px] font-medium ${bgMap[color] ?? bgMap['text-zinc-500']}`}>
      {label}
    </span>
  );
}

// ── Status dot ────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { color: string; label: string }> = {
  pending:   { color: 'bg-muted-foreground/50',  label: 'Pendente' },
  sent:      { color: 'bg-muted-foreground/70',  label: 'Enviado' },
  delivered: { color: 'bg-blue-400',  label: 'Entregue' },
  read:      { color: 'bg-green-500', label: 'Lido' },
  error:     { color: 'bg-red-500',   label: 'Erro' },
};

function StatusDot({ status }: { status: string | null }) {
  if (!status) return null;
  const meta = STATUS_META[status] ?? { color: 'bg-muted-foreground/40', label: status };
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.color}`} title={meta.label} />
  );
}

// ── Filter definitions ────────────────────────────────────────────────────────

const CHANNEL_OPTIONS = [
  { value: '', label: 'Todos os canais' },
  { value: 'whatsapp',  label: 'WhatsApp' },
  { value: 'email',     label: 'Email' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'sms',       label: 'SMS' },
  { value: 'telefone',  label: 'Telefone' },
];

const DIRECTION_OPTIONS = [
  { value: '',        label: 'Direção' },
  { value: 'entrada', label: '← Entrada' },
  { value: 'saida',   label: '→ Saída' },
];

const SOURCE_OPTIONS = [
  { value: '',                     label: 'Todos os módulos' },
  { value: 'inbound',              label: '← Entrada (cliente)' },
  { value: 'manual',               label: '👤 Manual (OMNI)' },
  { value: 'ai_agent',             label: '🤖 IA Agent' },
  { value: 'campaign',             label: '📢 Campanha (SENDS)' },
  { value: 'form',                 label: '📄 Formulário (LP)' },
  { value: 'followup',             label: '🔄 Follow-up' },
  { value: 'appointment_reminder', label: '📅 Lembrete' },
];

// ── Main component ────────────────────────────────────────────────────────────

export function OmniMensagensContent() {
  const navigate = useNavigate();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [showDeadLetter, setShowDeadLetter] = useState(false);
  const { isManager, currentUserId } = useUserPermissions();

  const [filters, setFilters] = useState<OmniMensagensFilters>({
    channel: '', direction: '', source_type: '', search: '',
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, isRefetching } =
    useOmniMensagens({
      ...filters,
      responsavelId: !isManager && currentUserId ? currentUserId : undefined,
      _refreshKey: refreshKey,
    });

  const rows = useMemo(() => data?.pages.flatMap((p) => p.rows) ?? [], [data]);

  // Dead-letter state
  const [dlStatusFilter, setDlStatusFilter] = useState<string | undefined>(undefined);
  const dlStats = useOmniDeadLetterStats();
  const dlEntries = useOmniDeadLetter(dlStatusFilter, 50);
  const retryMutation = useRetryDeadLetter();

  // Infinite scroll via IntersectionObserver
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      });
      observerRef.current.observe(node);
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  function setFilter(key: keyof OmniMensagensFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleRowClick(peopleId: string | null) {
    if (!peopleId) return;
    navigate(`/omni?pessoaId=${peopleId}`);
  }

  function formatTs(ts: string | null) {
    if (!ts) return '—';
    try { return format(new Date(ts), 'dd/MM/yyyy HH:mm', { locale: ptBR }); }
    catch { return '—'; }
  }

  function truncate(text: string | null, max = 80) {
    if (!text) return '—';
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  return (
    <div className="flex flex-col h-full bg-background">

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-7 h-[30px] text-[13px] border-border"
            placeholder="Buscar no conteúdo…"
            value={filters.search ?? ''}
            onChange={(e) => setFilter('search', e.target.value)}
          />
        </div>

        <FilterDropdown options={CHANNEL_OPTIONS}   value={filters.channel ?? ''}     onChange={(v) => setFilter('channel', v)} />
        <FilterDropdown options={DIRECTION_OPTIONS} value={filters.direction ?? ''}   onChange={(v) => setFilter('direction', v)} />
        <FilterDropdown options={SOURCE_OPTIONS}    value={filters.source_type ?? ''} onChange={(v) => setFilter('source_type', v)} />

        {/* Dead-letter toggle */}
        <Button
          variant={showDeadLetter ? 'default' : 'outline'}
          size="sm"
          className={`h-[30px] text-[12px] gap-1.5 rounded-[4px] ml-auto ${showDeadLetter ? '' : (dlStats.data?.pending ?? 0) > 0 ? 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400' : ''}`}
          onClick={() => setShowDeadLetter(!showDeadLetter)}
        >
          <AlertTriangle size={12} />
          Falhas
          {(dlStats.data?.pending ?? 0) > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {dlStats.data!.pending}
            </span>
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-[30px] w-[30px] p-0 shrink-0 rounded-[4px]"
          disabled={showDeadLetter ? dlEntries.isRefetching : isLoading || isRefetching}
          onClick={() => showDeadLetter
            ? dlEntries.refetch()
            : setRefreshKey((k) => k + 1)}
          title="Atualizar"
        >
          <RefreshCw size={13} className={(showDeadLetter ? dlEntries.isRefetching : isLoading || isRefetching) ? 'animate-spin' : ''} />
        </Button>
      </div>

      {showDeadLetter ? (
        <>
          {/* Dead-letter filter bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-red-50/50 dark:bg-red-950/20 shrink-0">
            <AlertTriangle size={14} className="text-red-500 shrink-0" />
            <span className="text-[12px] font-medium text-red-700 dark:text-red-400">Falhas de Entrega</span>

            <div className="flex items-center gap-1 ml-4">
              {[
                { value: undefined, label: 'Todos' },
                { value: 'pending', label: 'Pendente' },
                { value: 'exhausted', label: 'Esgotado' },
                { value: 'resolved', label: 'Resolvido' },
              ].map((opt) => (
                <Button
                  key={opt.value ?? 'all'}
                  variant={dlStatusFilter === opt.value ? 'default' : 'ghost'}
                  size="sm"
                  className="h-[30px] text-[11px] px-2 rounded-[4px]"
                  onClick={() => setDlStatusFilter(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>

            {dlStats.data && (
              <div className="flex items-center gap-3 ml-auto text-[11px] text-muted-foreground">
                <span>Pendente: <strong className="text-red-600 dark:text-red-400">{dlStats.data.pending}</strong></span>
                <span>Esgotado: <strong className="text-orange-600 dark:text-orange-400">{dlStats.data.exhausted}</strong></span>
                <span>Resolvido: <strong className="text-green-600 dark:text-green-400">{dlStats.data.resolved}</strong></span>
              </div>
            )}
          </div>

          {/* Dead-letter table header */}
          <div className="grid grid-cols-[90px_100px_1fr_80px_80px_100px_80px] items-center gap-3 px-4 py-2 border-b border-border bg-card text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest shrink-0">
            <span>Data</span>
            <span>Canal</span>
            <span>Erro</span>
            <span className="text-center">Tentativas</span>
            <span className="text-center">Status</span>
            <span>Próximo Retry</span>
            <span className="text-center">Ação</span>
          </div>

          {/* Dead-letter rows */}
          <div className="flex-1 overflow-y-auto">
            {dlEntries.isLoading && (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-[13px]">
                Carregando…
              </div>
            )}

            {!dlEntries.isLoading && (!dlEntries.data || dlEntries.data.length === 0) && (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                <CheckCircle2 size={32} className="opacity-30 text-green-500" />
                <p className="text-[13px]">Nenhuma falha de entrega</p>
              </div>
            )}

            {dlEntries.data?.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-[90px_100px_1fr_80px_80px_100px_80px] items-center gap-3 px-4 py-2.5 border-b border-border text-[13px]"
              >
                {/* Created at */}
                <span className="text-muted-foreground text-[12px] tabular-nums whitespace-nowrap">
                  {formatTs(entry.created_at)}
                </span>

                {/* Channel */}
                <div><ChannelBadge channel={entry.channel} /></div>

                {/* Error */}
                <span className="truncate text-red-600 dark:text-red-400 text-[12px]" title={entry.error_message ?? undefined}>
                  {entry.error_message ? truncate(entry.error_message, 60) : entry.error_code ?? '—'}
                </span>

                {/* Attempts */}
                <div className="flex justify-center">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[2px] text-[11px] font-medium ${
                    entry.attempts >= entry.max_attempts
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {entry.attempts}/{entry.max_attempts}
                  </span>
                </div>

                {/* Status */}
                <div className="flex justify-center">
                  <DeadLetterStatusBadge status={entry.status} />
                </div>

                {/* Next retry */}
                <span className="text-muted-foreground text-[11px]">
                  {entry.status === 'pending' && entry.next_retry_at
                    ? formatDistanceToNow(new Date(entry.next_retry_at), { addSuffix: true, locale: ptBR })
                    : '—'}
                </span>

                {/* Retry button */}
                <div className="flex justify-center">
                  {entry.status !== 'resolved' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-[30px] text-[11px] gap-1 px-2 rounded-[4px]"
                      disabled={retryMutation.isPending}
                      onClick={() => retryMutation.mutate(entry.id)}
                    >
                      <RotateCcw size={11} />
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Table header */}
          <div className="grid grid-cols-[32px_90px_110px_120px_160px_1fr_52px] items-center gap-3 px-4 py-2 border-b border-border bg-card text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest shrink-0">
            <span title="Origem" />
            <span>Data/Hora</span>
            <span>Canal</span>
            <span>Módulo</span>
            <span>Pessoa</span>
            <span>Mensagem</span>
            <span className="text-center">Status</span>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-[13px]">
                Carregando…
              </div>
            )}

            {!isLoading && rows.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                <MessageCircle size={32} className="opacity-30" />
                <p className="text-[13px]">Nenhuma mensagem encontrada</p>
              </div>
            )}

            {rows.map((row) => (
              <div
                key={row.id}
                onClick={() => handleRowClick(row.people_id)}
                className={`
                  grid grid-cols-[32px_90px_110px_120px_160px_1fr_52px] items-center gap-3
                  px-4 py-2.5 border-b border-border text-[13px]
                  transition-colors
                  ${row.people_id ? 'cursor-pointer hover:bg-accent/50' : 'opacity-60'}
                `}
              >
                {/* Origin icon */}
                <div className="flex justify-center">
                  <OriginIcon fromContact={row.from_contact} sourceType={row.source_type} />
                </div>

                {/* Timestamp (sent_at ?? created_at) */}
                <span className="text-muted-foreground text-[12px] tabular-nums whitespace-nowrap">
                  {formatTs(row.ts)}
                </span>

                {/* Channel */}
                <div><ChannelBadge channel={row.channel} messageType={row.message_type} /></div>

                {/* Module/origin badge */}
                <div>
                  <OriginBadge fromContact={row.from_contact} sourceType={row.source_type} />
                </div>

                {/* Pessoa */}
                <span className="truncate font-medium text-foreground">
                  {row.pessoa_nome ?? <span className="text-muted-foreground italic text-[12px]">Sem pessoa</span>}
                </span>

                {/* Content */}
                <span className="truncate text-muted-foreground">
                  {truncate(row.content)}
                </span>

                {/* Status */}
                <div className="flex justify-center">
                  <StatusDot status={row.status} />
                </div>
              </div>
            ))}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-4" />

            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-4 text-muted-foreground text-[12px]">Carregando mais…</div>
            )}

            {!hasNextPage && rows.length > 0 && (
              <div className="flex items-center justify-center py-4 text-muted-foreground text-[11px]">
                {rows.length} mensagem{rows.length !== 1 ? 's' : ''} carregada{rows.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── DeadLetterStatusBadge ─────────────────────────────────────────────────────

const DL_STATUS_META: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  pending:   { color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Pendente', icon: RotateCcw },
  retrying:  { color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',    label: 'Retentando', icon: RefreshCw },
  exhausted: { color: 'bg-red-500/10 text-red-600 dark:text-red-400',       label: 'Esgotado', icon: XCircle },
  resolved:  { color: 'bg-green-500/10 text-green-600 dark:text-green-400', label: 'Resolvido', icon: CheckCircle2 },
};

function DeadLetterStatusBadge({ status }: { status: string }) {
  const meta = DL_STATUS_META[status] ?? DL_STATUS_META.pending;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[11px] font-medium ${meta.color}`}>
      <Icon size={10} />
      {meta.label}
    </span>
  );
}

// ── FilterDropdown ────────────────────────────────────────────────────────────

function FilterDropdown({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-[30px] text-[12px] gap-1.5 rounded-[4px] ${value ? 'border-foreground text-foreground' : ''}`}
        >
          {current.label}
          <ChevronDown size={11} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`text-[13px] ${opt.value === value ? 'font-medium' : ''}`}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
