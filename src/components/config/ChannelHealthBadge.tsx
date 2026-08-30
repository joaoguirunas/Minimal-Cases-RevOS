import { Circle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useOmniChannelHealth } from '@/hooks/useOmniChannelHealth';
import { cn } from '@/lib/utils';

interface ChannelHealthBadgeProps {
  channel: string;
}

const severityConfig = {
  info: { color: 'text-green-500', bg: 'bg-green-500', label: 'Healthy' },
  warning: { color: 'text-yellow-500', bg: 'bg-yellow-500', label: 'Slow' },
  error: { color: 'text-red-500', bg: 'bg-red-500', label: 'Down' },
} as const;

export default function ChannelHealthBadge({ channel }: ChannelHealthBadgeProps) {
  const { data: healthMap, isLoading } = useOmniChannelHealth();

  if (isLoading) return null;

  const status = healthMap?.[channel];
  if (!status) return null;

  const config = severityConfig[status.severity] ?? severityConfig.info;
  const checkedAt = status.details?.checked_at ?? status.created_at;
  const timeAgo = formatDistanceToNow(new Date(checkedAt), { addSuffix: true, locale: ptBR });
  const latency = status.details?.latency_ms;

  return (
    <div
      className="flex items-center gap-1.5 cursor-default"
      title={`${config.label}${latency ? ` (${latency}ms)` : ''} — ${timeAgo}${status.details?.error ? `\nErro: ${status.details.error}` : ''}`}
    >
      <Circle className={cn('w-2 h-2 fill-current', config.color)} />
      <span className={cn('text-[10px]', config.color)}>{config.label}</span>
    </div>
  );
}
