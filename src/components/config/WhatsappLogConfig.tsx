import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownLeft, ArrowUpRight, RefreshCw, Loader2,
  MessageSquare, ChevronDown, ChevronUp, Copy, CheckCheck,
  MessageCircle, Mail, Phone, Smartphone, AtSign, Inbox,
} from 'lucide-react';
import { format, formatDistanceToNow, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogMessage {
  id: number;
  content: string | null;
  from_contact: string | null;
  status: string | null;
  message_type: string | null;
  channel: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
  wa_message_id: string | null;
  wa_phone_number_id: string | null;
  execution_id: string | null;
  followup_id: string | null;
  clients_people: { name: string | null; whatsapp: string | null } | null;
}

type ChannelFilter = 'all' | 'whatsapp' | 'instagram' | 'email' | 'sms' | 'telefone';
type SourceFilter  = 'all' | 'cliente' | 'omni' | 'ia' | 'followup' | 'disparo' | 'lembrete';
type SourceType    = Exclude<SourceFilter, 'all'>;

interface Filters {
  channel:   ChannelFilter;
  source:    SourceFilter;
  direction: 'all' | 'in' | 'out';
  status:    string;
  period:    'today' | '24h' | '7d' | 'all';
}

// ── Source detection ──────────────────────────────────────────────────────────

function detectSource(msg: LogMessage): SourceType {
  if (msg.from_contact === 'cliente') return 'cliente';
  if (msg.from_contact === 'ia')      return 'ia';
  if (msg.followup_id)                return 'followup';
  const meta = msg.metadata as Record<string, unknown> | null;
  if (meta?.send_id || meta?.disparo_id || meta?.batch_id)               return 'disparo';
  if (meta?.meeting_id || meta?.reuniao_id || meta?.lembrete_reuniao)    return 'lembrete';
  return 'omni';
}

// ── Config maps ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  sent:      'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  delivered: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  read:      'bg-green-600/10 text-green-800 dark:text-green-300 border-green-600/20',
  error:     'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  pending:   'pendente',
  sent:      'enviada',
  delivered: 'entregue',
  read:      'lida',
  error:     'erro',
};

const CHANNEL_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  whatsapp:  { label: 'WhatsApp',  icon: MessageCircle, color: 'text-green-600 dark:text-green-400' },
  instagram: { label: 'Instagram', icon: AtSign,        color: 'text-pink-600 dark:text-pink-400'  },
  email:     { label: 'Email',     icon: Mail,          color: 'text-blue-600 dark:text-blue-400'  },
  sms:       { label: 'SMS',       icon: Smartphone,    color: 'text-purple-600 dark:text-purple-400' },
  telefone:  { label: 'Telefone',  icon: Phone,         color: 'text-orange-600 dark:text-orange-400' },
};

const SOURCE_LABELS: Record<SourceType, string> = {
  cliente:  'Cliente',
  omni:     'OMNI',
  ia:       'Agente IA',
  followup: 'Followup',
  disparo:  'Disparo',
  lembrete: 'Lembrete',
};

const SOURCE_STYLES: Record<SourceType, string> = {
  cliente:  'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  omni:     'bg-muted text-muted-foreground border-border',
  ia:       'bg-primary/10 text-primary border-primary/20',
  followup: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  disparo:  'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  lembrete: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
};

const CHANNEL_BADGES: { key: ChannelFilter; label: string; icon: React.ElementType }[] = [
  { key: 'all',       label: 'Todos',     icon: Inbox       },
  { key: 'whatsapp',  label: 'WhatsApp',  icon: MessageCircle },
  { key: 'instagram', label: 'Instagram', icon: AtSign      },
  { key: 'email',     label: 'Email',     icon: Mail        },
  { key: 'sms',       label: 'SMS',       icon: Smartphone  },
  { key: 'telefone',  label: 'Telefone',  icon: Phone       },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const isInbound = (msg: LogMessage) => msg.from_contact === 'cliente';

const getPeriodSince = (period: Filters['period']): Date | null => {
  const now = new Date();
  if (period === 'today') return startOfDay(now);
  if (period === '24h')   return subDays(now, 1);
  if (period === '7d')    return subDays(now, 7);
  return null;
};

const getMediaBadge = (type: string | null) => {
  if (!type || type === 'text' || type === 'texto') return null;
  const MAP: Record<string, string> = {
    audio: 'ÁUDIO', imagem: 'IMAGEM', image: 'IMAGEM',
    video: 'VÍDEO', document: 'DOC', documento: 'DOC', arquivo: 'ARQ',
  };
  return MAP[type] ?? type.toUpperCase();
};

// ── Copy button ───────────────────────────────────────────────────────────────

const CopyButton = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-1.5 text-muted-foreground/50 hover:text-foreground transition-colors"
    >
      {copied
        ? <CheckCheck className="h-3 w-3 text-green-500 inline" />
        : <Copy className="h-3 w-3 inline" />}
    </button>
  );
};

// ── Expanded row ──────────────────────────────────────────────────────────────

const ExpandedRow = ({ msg }: { msg: LogMessage }) => (
  <div className="px-4 py-3 bg-muted border-t border-border space-y-3 text-xs">
    <div className="space-y-1">
      <p className="text-muted-foreground font-medium uppercase text-[9px] tracking-wider">Conteúdo completo</p>
      <p className="text-foreground whitespace-pre-wrap">{msg.content || '—'}</p>
    </div>

    {msg.wa_message_id && (
      <div className="space-y-1">
        <p className="text-muted-foreground font-medium uppercase text-[9px] tracking-wider">
          WA Message ID (wamid)
          <CopyButton value={msg.wa_message_id} />
        </p>
        <code className="font-mono text-[10px] text-muted-foreground break-all">{msg.wa_message_id}</code>
      </div>
    )}

    {msg.wa_phone_number_id && (
      <div className="space-y-1">
        <p className="text-muted-foreground font-medium uppercase text-[9px] tracking-wider">
          Phone Number ID
          <CopyButton value={msg.wa_phone_number_id} />
        </p>
        <code className="font-mono text-[10px] text-muted-foreground">{msg.wa_phone_number_id}</code>
      </div>
    )}

    {msg.followup_id && (
      <div className="space-y-1">
        <p className="text-muted-foreground font-medium uppercase text-[9px] tracking-wider">Followup ID</p>
        <code className="font-mono text-[10px] text-muted-foreground break-all">{msg.followup_id}</code>
      </div>
    )}

    {msg.execution_id && (
      <div className="space-y-1">
        <p className="text-muted-foreground font-medium uppercase text-[9px] tracking-wider">Execution ID</p>
        <code className="font-mono text-[10px] text-muted-foreground break-all">{msg.execution_id}</code>
      </div>
    )}

    {msg.metadata && Object.keys(msg.metadata).length > 0 && (
      <div className="space-y-1">
        <p className="text-muted-foreground font-medium uppercase text-[9px] tracking-wider">Metadata</p>
        <pre className="font-mono text-[9px] text-muted-foreground bg-muted rounded-[4px] p-2 overflow-x-auto">
          {JSON.stringify(msg.metadata, null, 2)}
        </pre>
      </div>
    )}

    {msg.created_at && (
      <p className="text-muted-foreground/50 text-[9px]">
        {format(new Date(msg.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
      </p>
    )}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const WhatsappLogConfig = () => {
  const [filters, setFilters] = useState<Filters>({
    channel:   'all',
    source:    'all',
    direction: 'all',
    status:    '',
    period:    'today',
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: messages = [], isLoading, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['omni-message-log', filters],
    queryFn: async () => {
      let q = (supabase as any)
        .from('messages')
        .select(
          'id, content, from_contact, status, message_type, channel, created_at, metadata, wa_message_id, wa_phone_number_id, execution_id, followup_id, clients_people(name, whatsapp)'
        )
        .order('created_at', { ascending: false })
        .limit(500);

      if (filters.channel !== 'all') q = q.eq('channel', filters.channel);
      if (filters.direction === 'in')  q = q.eq('from_contact', 'cliente');
      if (filters.direction === 'out') q = q.neq('from_contact', 'cliente');
      if (filters.status) q = q.eq('status', filters.status);

      const since = getPeriodSince(filters.period);
      if (since) q = q.gte('created_at', since.toISOString());

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LogMessage[];
    },
    refetchInterval: 15_000,
    staleTime: 0,
  });

  // Source filter applied client-side (no DB column for derived source)
  const filteredMessages = filters.source === 'all'
    ? messages
    : messages.filter(m => detectSource(m) === filters.source);

  const inboundCount  = filteredMessages.filter(isInbound).length;
  const outboundCount = filteredMessages.filter(m => !isInbound(m)).length;
  const errorCount    = filteredMessages.filter(m => m.status === 'error').length;

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Log de Mensagens
            </h2>
            {dataUpdatedAt > 0 && (
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                Atualizado {formatDistanceToNow(dataUpdatedAt, { addSuffix: true, locale: ptBR })} · atualiza a cada 15s
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <ArrowDownLeft className="h-3 w-3" />
                {inboundCount} entrada
              </span>
              <span className="text-muted-foreground/30">·</span>
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <ArrowUpRight className="h-3 w-3" />
                {outboundCount} saída
              </span>
              {errorCount > 0 && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    {errorCount} erro{errorCount > 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-[30px] w-[30px] p-0"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Channel badge filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {CHANNEL_BADGES.map(({ key, label, icon: Icon }) => {
            const isActive = filters.channel === key;
            return (
              <button
                key={key}
                onClick={() => setFilters(f => ({ ...f, channel: key }))}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors',
                  isActive
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-muted text-muted-foreground border-border hover:border-border hover:text-foreground'
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Secondary filters (dropdowns) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Origem (source) */}
          <Select
            value={filters.source}
            onValueChange={v => setFilters(f => ({ ...f, source: v as SourceFilter }))}
          >
            <SelectTrigger className="h-[30px] text-xs w-40">
              <SelectValue placeholder="Origem: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Origem: Todos</SelectItem>
              <SelectItem value="cliente">Cliente</SelectItem>
              <SelectItem value="omni">OMNI</SelectItem>
              <SelectItem value="ia">Agente IA</SelectItem>
              <SelectItem value="followup">Followup</SelectItem>
              <SelectItem value="disparo">Disparo</SelectItem>
              <SelectItem value="lembrete">Lembrete</SelectItem>
            </SelectContent>
          </Select>

          {/* Direção */}
          <Select
            value={filters.direction}
            onValueChange={v => setFilters(f => ({ ...f, direction: v as Filters['direction'] }))}
          >
            <SelectTrigger className="h-[30px] text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Direção: Todos</SelectItem>
              <SelectItem value="in">Entrada</SelectItem>
              <SelectItem value="out">Saída</SelectItem>
            </SelectContent>
          </Select>

          {/* Status */}
          <Select
            value={filters.status || '__all__'}
            onValueChange={v => setFilters(f => ({ ...f, status: v === '__all__' ? '' : v }))}
          >
            <SelectTrigger className="h-[30px] text-xs w-36">
              <SelectValue placeholder="Status: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Status: Todos</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="sent">Enviada</SelectItem>
              <SelectItem value="delivered">Entregue</SelectItem>
              <SelectItem value="read">Lida</SelectItem>
              <SelectItem value="error">Erro</SelectItem>
            </SelectContent>
          </Select>

          {/* Período */}
          <Select
            value={filters.period}
            onValueChange={v => setFilters(f => ({ ...f, period: v as Filters['period'] }))}
          >
            <SelectTrigger className="h-[30px] text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="24h">Últimas 24h</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground/50">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-[4px]">
            <MessageSquare className="h-6 w-6 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma mensagem encontrada</p>
            <p className="text-xs text-muted-foreground/50 mt-0.5">Tente ajustar os filtros</p>
          </div>
        ) : (
          <div className="border border-border rounded-[4px] overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[28px_1fr_80px_90px_90px_80px_24px] gap-2 px-3 py-2 bg-muted border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <span />
              <span>Pessoa · Mensagem</span>
              <span>Canal</span>
              <span>Origem</span>
              <span>Status</span>
              <span className="text-right">Horário</span>
              <span />
            </div>

            {/* Rows */}
            <div className="divide-y divide-border/20 max-h-[600px] overflow-y-auto">
              {filteredMessages.map((msg) => {
                const inbound     = isInbound(msg);
                const person      = msg.clients_people;
                const statusKey   = msg.status ?? 'pending';
                const statusStyle = STATUS_STYLES[statusKey] ?? STATUS_STYLES.pending;
                const statusLabel = STATUS_LABELS[statusKey] ?? statusKey;
                const mediaBadge  = getMediaBadge(msg.message_type);
                const isExpanded  = expandedId === msg.id;

                const source      = detectSource(msg);
                const sourceLabel = SOURCE_LABELS[source];
                const sourceStyle = SOURCE_STYLES[source];

                const channelKey = msg.channel ?? 'whatsapp';
                const chanConfig = CHANNEL_CONFIG[channelKey];
                const ChanIcon   = chanConfig?.icon ?? MessageSquare;

                return (
                  <div key={msg.id}>
                    <div
                      className="grid grid-cols-[28px_1fr_80px_90px_90px_80px_24px] gap-2 px-3 py-2.5 items-center hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : msg.id)}
                    >
                      {/* Direction */}
                      <div className="flex justify-center">
                        {inbound ? (
                          <ArrowDownLeft className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        )}
                      </div>

                      {/* Person + content */}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {person?.name ?? person?.whatsapp ?? 'Desconhecido'}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate leading-relaxed">
                          {mediaBadge && (
                            <span className="text-[9px] font-medium uppercase text-muted-foreground/50 mr-1">
                              [{mediaBadge}]
                            </span>
                          )}
                          {msg.content ?? '—'}
                        </p>
                      </div>

                      {/* Canal */}
                      <div className="flex items-center gap-1 min-w-0">
                        <ChanIcon className={cn('h-3 w-3 shrink-0', chanConfig?.color ?? 'text-muted-foreground')} />
                        <span className="text-[11px] text-foreground truncate">
                          {chanConfig?.label ?? channelKey}
                        </span>
                      </div>

                      {/* Origem */}
                      <div>
                        <span className={cn(
                          'text-[9px] font-medium px-1.5 py-0.5 rounded border',
                          sourceStyle
                        )}>
                          {sourceLabel}
                        </span>
                      </div>

                      {/* Status */}
                      <div>
                        <span className={cn(
                          'text-[9px] font-medium px-1.5 py-0.5 rounded border',
                          statusStyle
                        )}>
                          {statusLabel}
                        </span>
                      </div>

                      {/* Time */}
                      <div className="text-right">
                        {msg.created_at ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] text-muted-foreground/60 cursor-default">
                                {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ptBR })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px]">
                              {format(new Date(msg.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                            </TooltipContent>
                          </Tooltip>
                        ) : '—'}
                      </div>

                      {/* Expand toggle */}
                      <div className="flex justify-center text-muted-foreground/40">
                        {isExpanded
                          ? <ChevronUp className="h-3 w-3" />
                          : <ChevronDown className="h-3 w-3" />}
                      </div>
                    </div>

                    {isExpanded && <ExpandedRow msg={msg} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default WhatsappLogConfig;
