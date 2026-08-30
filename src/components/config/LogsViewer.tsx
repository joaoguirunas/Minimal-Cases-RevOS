import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSupabaseLogs, LogSource, LogEntry } from '@/hooks/useSupabaseLogs';
import {
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Play,
  Pause,
  AlertCircle,
  Info,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCES: { value: LogSource; label: string; description: string }[] = [
  { value: 'edge_logs',          label: 'API / REST',       description: 'Requests HTTP ao PostgREST e Storage' },
  { value: 'function_edge_logs', label: 'Edge Functions',   description: 'Invocações das Edge Functions' },
  { value: 'auth_logs',          label: 'Auth',             description: 'Autenticação GoTrue' },
  { value: 'postgres_logs',      label: 'Postgres',         description: 'Logs do banco de dados' },
  { value: 'realtime_logs',      label: 'Realtime',         description: 'WebSocket subscriptions' },
  { value: 'storage_logs',       label: 'Storage',          description: 'Upload/download de arquivos' },
  { value: 'pgbouncer_logs',     label: 'PgBouncer',        description: 'Connection pooler' },
];

const TIME_RANGES = [
  { value: '15m', label: 'Últimos 15 min' },
  { value: '1h',  label: 'Última hora' },
  { value: '6h',  label: 'Últimas 6h' },
  { value: '24h', label: 'Últimas 24h' },
  { value: '7d',  label: 'Últimos 7 dias' },
];

const LIMITS = [
  { value: '50',  label: '50 registros' },
  { value: '100', label: '100 registros' },
  { value: '200', label: '200 registros' },
  { value: '500', label: '500 registros' },
];

const AUTO_REFRESH_OPTIONS = [
  { value: '0',   label: 'Desativado' },
  { value: '15',  label: 'A cada 15s' },
  { value: '30',  label: 'A cada 30s' },
  { value: '60',  label: 'A cada 1 min' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectLevel(msg: string): 'error' | 'warning' | 'info' {
  const lower = msg.toLowerCase();
  if (lower.includes('error') || lower.includes('exception') || lower.includes(' 5') || lower.includes('fatal') || lower.includes('panic')) return 'error';
  if (lower.includes('warn') || lower.includes(' 4') || lower.includes('deprecated')) return 'warning';
  return 'info';
}

function levelColor(level: 'error' | 'warning' | 'info') {
  switch (level) {
    case 'error':   return 'text-red-500';
    case 'warning': return 'text-yellow-500';
    default:        return 'text-muted-foreground';
  }
}

function LevelIcon({ level }: { level: 'error' | 'warning' | 'info' }) {
  switch (level) {
    case 'error':   return <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
    case 'warning': return <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />;
    default:        return <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
  }
}

function LevelBadge({ level }: { level: 'error' | 'warning' | 'info' }) {
  const variants: Record<string, string> = {
    error:   'bg-red-500/10 text-red-500 border-red-500/20',
    warning: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    info:    'bg-blue-500/10 text-blue-500 border-blue-500/20',
  };
  return (
    <span className={cn('text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border', variants[level])}>
      {level}
    </span>
  );
}

function formatTs(ts: string): string {
  try {
    const date = new Date(Number(ts) / 1000);
    if (isNaN(date.getTime())) return ts;
    return format(date, 'HH:mm:ss.SSS');
  } catch {
    return ts;
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
    </button>
  );
}

// ── Log Row ───────────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const level = detectLevel(entry.event_message);

  return (
    <div className={cn('group border-b border-border hover:bg-muted/50 transition-colors', level === 'error' && 'bg-red-500/5')}>
      {/* Main row */}
      <div
        className="flex items-start gap-2 px-4 py-2 cursor-pointer select-none text-xs font-mono"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="shrink-0 mt-0.5">
          {expanded
            ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
            : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        </span>
        <LevelIcon level={level} />
        <span className="text-muted-foreground/60 shrink-0 w-24">{formatTs(entry.timestamp)}</span>
        <span className={cn('flex-1 break-all leading-relaxed', levelColor(level))}>
          {entry.event_message}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <LevelBadge level={level} />
          <CopyButton text={entry.event_message} />
        </div>
      </div>

      {/* Expanded metadata */}
      {expanded && (
        <div className="px-10 pb-3">
          <div className="rounded-[4px] border border-border bg-muted p-3 relative">
            <CopyButton text={JSON.stringify(entry.metadata, null, 2)} />
            <pre className="text-[10px] text-muted-foreground overflow-auto max-h-64 leading-relaxed whitespace-pre-wrap break-all">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function LogsViewer() {
  const qc = useQueryClient();
  const [source, setSource] = useState<LogSource>('edge_logs');
  const [timeRange, setTimeRange] = useState('1h');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [limit, setLimit] = useState(100);
  const [autoRefresh, setAutoRefresh] = useState(0);
  const [levelFilter, setLevelFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: logs = [], isLoading, isFetching, refetch, error } = useSupabaseLogs({
    source,
    timeRange,
    search,
    limit,
  });

  // Auto-refresh
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh > 0) {
      intervalRef.current = setInterval(() => {
        qc.invalidateQueries({ queryKey: ['supabase-logs', source, timeRange, search, limit] });
      }, autoRefresh * 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, source, timeRange, search, limit, qc]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filtered = levelFilter === 'all'
    ? logs
    : logs.filter(l => detectLevel(l.event_message) === levelFilter);

  const errorCount   = logs.filter(l => detectLevel(l.event_message) === 'error').length;
  const warningCount = logs.filter(l => detectLevel(l.event_message) === 'warning').length;

  const activeSource = SOURCES.find(s => s.value === source);

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Logs do Supabase</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{activeSource?.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Stats */}
          {errorCount > 0 && (
            <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/5 text-xs">
              {errorCount} erro{errorCount > 1 ? 's' : ''}
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="outline" className="text-yellow-600 border-yellow-500/30 bg-yellow-500/5 text-xs">
              {warningCount} aviso{warningCount > 1 ? 's' : ''}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {filtered.length} de {logs.length}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="h-[30px] px-2 text-xs"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('w-3 h-3 mr-1', isFetching && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Source tabs */}
      <div className="flex gap-1 px-6 py-2 border-b border-border overflow-x-auto">
        {SOURCES.map(s => (
          <button
            key={s.value}
            onClick={() => setSource(s.value)}
            className={cn(
              'px-3 py-1.5 rounded-[4px] text-xs font-medium whitespace-nowrap transition-colors',
              source === s.value
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-6 py-2 border-b border-border flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            placeholder="Filtrar logs..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="h-[30px] pl-7 text-xs font-mono"
          />
        </div>

        {/* Level filter */}
        <div className="flex items-center gap-1">
          {(['all', 'error', 'warning', 'info'] as const).map(l => (
            <button
              key={l}
              onClick={() => setLevelFilter(l)}
              className={cn(
                'px-2 py-1 rounded-[4px] text-[10px] font-medium uppercase transition-colors',
                levelFilter === l
                  ? l === 'all'    ? 'bg-foreground text-background'
                  : l === 'error'  ? 'bg-red-500 text-white'
                  : l === 'warning'? 'bg-yellow-500 text-black'
                                   : 'bg-blue-500 text-white'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {l === 'all' ? 'Todos' : l}
            </button>
          ))}
        </div>

        {/* Time range */}
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="h-[30px] text-xs w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGES.map(r => (
              <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Limit */}
        <Select value={String(limit)} onValueChange={v => setLimit(Number(v))}>
          <SelectTrigger className="h-[30px] text-xs w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMITS.map(l => (
              <SelectItem key={l.value} value={l.value} className="text-xs">{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Auto-refresh */}
        <Select value={String(autoRefresh)} onValueChange={v => setAutoRefresh(Number(v))}>
          <SelectTrigger className="h-[30px] text-xs w-36">
            <Activity className="w-3 h-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUTO_REFRESH_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {autoRefresh > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-green-500">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        )}
      </div>

      {/* Log entries */}
      <ScrollArea className="flex-1">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-xs gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Carregando logs...
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 mx-6 mt-4 p-4 rounded-[4px] border border-red-500/20 bg-red-500/5">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-red-500">Erro ao carregar logs</p>
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                {String(error)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-2">
                Verifique se a Edge Function <code className="bg-muted px-1 rounded">logs-proxy</code> está deployada.
              </p>
            </div>
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Activity className="w-8 h-8 opacity-30" />
            <p className="text-sm">Nenhum log encontrado</p>
            <p className="text-xs opacity-60">Tente ampliar o intervalo de tempo ou limpar o filtro</p>
          </div>
        )}

        {!isLoading && !error && filtered.map(entry => (
          <LogRow key={entry.id} entry={entry} />
        ))}
      </ScrollArea>
    </div>
  );
}
